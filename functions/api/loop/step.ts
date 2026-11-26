import { AGENTS_FALLBACK_MODEL, AGENTS_PRIMARY_MODEL, clean, costUsd, estimateUsage, nextUtcMidnight, readUsage, type Usage } from '../../../lib/agents';
import {
  BASELINE,
  DEFAULT_CAPS,
  GOALS,
  ITEMS,
  SAMPLE_LABEL,
  buildProposerMessages,
  buildReframeMessages,
  buildSupervisorMessages,
  buildWhyMessages,
  evaluate,
  fmtGoal,
  goalValue,
  guardrails,
  isBetter,
  parseConfig,
  parseProposal,
  parseSupervisor,
  parseWhy,
  runPolicy,
  sanitizeArchive,
  sanitizeCaps,
  sanitizeNotes,
  select,
  type ArchiveEntry,
  type Caps,
  type Evaluated,
  type Goal,
  type Metrics,
  type Note,
} from '../../../lib/loop';
import { LOOP_CALLS_PER_RUN, callsLeft, checkRun, issueRun, reserveCall, startRun } from '../../../lib/loop-caps';
import { isSameOrigin } from '../request';

/**
 * The real improvement loop on /blueprints/loops/. POST { action, ...run state } -> NDJSON events.
 * Actions: start | generation | decide | why | reframe. The Proposer and Supervisor are model calls; the Guardrail
 * harness, the Evaluator and the Archivist are code that runs every policy over the committed sample dataset.
 * Nothing is simulated and nothing falls back to a script: when the model is unavailable or a cap is reached,
 * the response says so.
 */

interface AiBinding {
  run(model: string, input: Record<string, unknown>): Promise<unknown>;
}
export interface Env {
  DB: D1Database;
  AI: AiBinding;
  RATE_LIMIT_SALT?: string;
}
type Ctx = { request: Request; env: Env; waitUntil?: (p: Promise<unknown>) => void };

export const MAX_LOOP_BODY_BYTES = 16 * 1024;
export const MODEL_TIMEOUT_MS = 20000;
export const MAX_TOKENS = { proposer: 420, supervisor: 260, why: 260, reframe: 220 } as const;
const BASE_HEADERS = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };

function json(status: number, body: unknown, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...BASE_HEADERS, ...extra } });
}

export type StopReason = 'daily_cap' | 'visitor_runs' | 'run_cap' | 'ai_error' | 'unavailable' | 'expired';
export const STOP_MESSAGES: Record<StopReason, string> = {
  daily_cap: "The agents have hit today's limit.",
  visitor_runs: 'You have started two runs this hour, the limit per visitor.',
  run_cap: 'This run has used its ten model calls.',
  ai_error: 'The AI agents are unavailable right now.',
  unavailable: 'The AI agents are unavailable right now.',
  expired: 'This run has expired. Start a new one.',
};
function stop(status: number, reason: StopReason, now = Date.now()): Response {
  const body: Record<string, unknown> = { ok: false, reason, message: STOP_MESSAGES[reason] };
  if (reason === 'daily_cap') body.retry_at = nextUtcMidnight(now);
  if (reason === 'visitor_runs') body.retry_at = now + 60 * 60 * 1000;
  return json(status, body, reason === 'daily_cap' ? { 'Retry-After': String(Math.ceil((nextUtcMidnight(now) - now) / 1000)) } : {});
}
const bad = (error: string) => json(400, { ok: false, error });

class Timeout extends Error {}
function withDeadline<T>(p: Promise<T>, ms: number): Promise<T> {
  let t: ReturnType<typeof setTimeout>;
  return Promise.race([p, new Promise<T>((_, rej) => { t = setTimeout(() => rej(new Timeout('deadline')), ms); })]).finally(() => clearTimeout(t));
}

type Send = (o: Record<string, unknown>) => Promise<void>;
type Msg = { role: 'system' | 'user'; content: string };

/**
 * One agent turn: reserves a call against the caps, runs the primary model and, if it errors or its reply does not
 * parse, the fallback model (a second reserved call). Every call that ran reports its usage.
 */
async function agentCall<T>(env: Env, runId: string, agent: string, messages: Msg[], maxTokens: number, parse: (t: string) => T | null, send: Send):
  Promise<{ ok: true; value: T } | { ok: false; reason: 'run_cap' | 'daily_cap' | 'ai_error' | 'unreadable' }> {
  let reason: 'ai_error' | 'unreadable' = 'ai_error';
  const inputChars = messages.reduce((n, m) => n + m.content.length, 0);
  for (const model of [AGENTS_PRIMARY_MODEL, AGENTS_FALLBACK_MODEL]) {
    const r = await reserveCall(env.DB, runId);
    if (r !== 'ok') return { ok: false, reason: r };
    let out: unknown;
    try {
      out = await withDeadline(env.AI.run(model, { messages, max_tokens: maxTokens, temperature: 0.3 }), MODEL_TIMEOUT_MS);
    } catch (err) {
      console.error('loop model failed', agent, model, err instanceof Error ? err.message : err);
      reason = 'ai_error';
      continue;
    }
    const resp = out && typeof out === 'object' ? (out as Record<string, unknown>).response : undefined;
    const text = typeof resp === 'string' ? resp : resp && typeof resp === 'object' ? JSON.stringify(resp) : '';
    const u: Usage = readUsage(out) ?? estimateUsage(inputChars, text.length);
    await send({ t: 'usage', agent, model: model === AGENTS_PRIMARY_MODEL ? 'primary' : 'fallback', ...u, cost_usd: Number(costUsd(u).toFixed(6)) });
    const v = text ? parse(text) : null;
    if (v) return { ok: true, value: v };
    reason = 'unreadable';
    await send({ t: 'note', agent, text: model === AGENTS_PRIMARY_MODEL ? 'The reply did not follow the required format. Asking the smaller model once.' : 'The reply did not follow the required format.' });
  }
  return { ok: false, reason };
}

// ---------- helpers that turn code results into events ----------

const money = (x: number) => `$${x.toFixed(2)}`;
function metricsEvent(id: string, m: Metrics) {
  return { t: 'metrics', id, m };
}
function variantEvent(v: Evaluated, status: string) {
  return {
    t: 'variant',
    v: { id: v.id, parent: v.parent, gen: v.gen, change: v.change, reason: v.reason, config: v.config, diff: v.diff, door: v.door, door_reasons: v.door_reasons, blocked: v.blocked, status, scorer_request: v.scorer_request ?? null },
  };
}
function harnessLine(v: Evaluated): string {
  if (v.blocked?.kind === 'scorer') return `Blocked ${v.id}. ${v.blocked.reason} The lock is enforced in code (control MR-10); no agent can lift it, so this variant never runs.`;
  if (v.blocked?.kind === 'invalid') return `Blocked ${v.id}. ${v.blocked.reason} It never runs.`;
  const fails = v.checks.filter((c) => !c.pass);
  if (fails.length) return `Ran ${v.id} over all ${ITEMS.length} sample exceptions. Blocked: ${fails.map((c) => `${c.name.toLowerCase()} ${c.detail}`).join('; ')}.`;
  return `Ran ${v.id} over all ${ITEMS.length} sample exceptions. All guardrails pass: reversal ${v.metrics!.reversal_rate.toFixed(1)}%, fairness gap ${v.metrics!.fairness_gap.toFixed(1)} pts, 0 breaches, trace ${v.metrics!.trace_coverage.toFixed(0)}%.`;
}
function evaluatorLine(vs: Evaluated[], champ: { id: string; m: Metrics }, goal: Goal): string {
  const parts = vs.filter((v) => v.metrics).map((v) => `${v.id} ${fmtGoal(goalValue(v.metrics!, goal), goal)}`);
  return `${GOALS[goal].name}, champion ${champ.id}: ${fmtGoal(goalValue(champ.m, goal), goal)}.${parts.length ? ` Measured: ${parts.join(', ')}.` : ' Nothing new to measure.'} My scorer is unchanged.`;
}

function findEntry(archive: ArchiveEntry[], id: string) {
  return archive.find((e) => e.id === id) ?? null;
}
function evaluateEntry(e: ArchiveEntry, archive: ArchiveEntry[], caps: Caps): Evaluated {
  if (e.invalid) {
    return { id: e.id, parent: e.parent, gen: e.gen, change: '', reason: '', config: e.config, diff: [], door: 'two-way', door_reasons: [],
      blocked: { kind: 'invalid', reason: e.invalid }, checks: [], metrics: null };
  }
  const parent = e.parent ? findEntry(archive, e.parent)?.config ?? BASELINE : BASELINE;
  return evaluate({ id: e.id, parent: e.parent, gen: e.gen, change: '', reason: '', raw: e.config }, e.id === 'V0' ? BASELINE : parent, caps);
}

// ---------- actions ----------

interface Common {
  runId: string;
  goal: Goal;
  caps: Caps;
  archive: ArchiveEntry[];
  champion: ArchiveEntry;
  notes: Note[];
}

async function doStart(send: Send) {
  const { metrics } = runPolicy(BASELINE);
  const checks = guardrails(metrics, DEFAULT_CAPS);
  await send({ t: 'phase', step: 'measure', gen: 0 });
  await send({ t: 'dataset', label: SAMPLE_LABEL, n: ITEMS.length, small: ITEMS.filter((i) => i.supplier_size === 'small').length });
  await send({ t: 'variant', v: { id: 'V0', parent: '', gen: 0, change: 'Starting policy', reason: '', config: BASELINE, diff: [], door: 'two-way', door_reasons: [], blocked: null, status: 'champion', scorer_request: null } });
  await send({ t: 'checks', id: 'V0', items: checks });
  await send(metricsEvent('V0', metrics));
  await send({ t: 'say', agent: 'evaluator', source: 'code', text: `Baseline V0 over ${ITEMS.length} sample exceptions: cost per completed outcome ${money(metrics.cost_per_outcome)}, first-pass resolution ${metrics.fpr.toFixed(1)}%. ${metrics.auto} resolved without a person. My scorer is locked.` });
  await send({ t: 'champion', id: 'V0' });
}

async function doGeneration(env: Env, c: Common, gen: number, send: Send) {
  const champEval = evaluateEntry(c.champion, c.archive, c.caps);
  const champM = champEval.metrics!;
  const championPasses = champEval.checks.every((x) => x.pass);
  const last = c.archive.filter((e) => e.gen === gen - 1 && e.id !== 'V0').map((e) => evaluateEntry(e, c.archive, c.caps));

  await send({ t: 'phase', step: 'expand', gen });
  await send({ t: 'thinking', agent: 'proposer' });
  const prop = await agentCall(env, c.runId, 'proposer', buildProposerMessages({ gen, goal: c.goal, caps: c.caps, champion: { id: c.champion.id, config: c.champion.config, metrics: champM }, last, notes: c.notes }),
    MAX_TOKENS.proposer, parseProposal, send);
  if (!prop.ok) return send({ t: 'error', agent: 'proposer', reason: prop.reason === 'unreadable' ? 'ai_error' : prop.reason, message: prop.reason === 'unreadable' ? 'The Proposer did not return a readable proposal, so this generation stops here.' : STOP_MESSAGES[prop.reason] });
  const proposal = prop.value;
  if (proposal.say) await send({ t: 'say', agent: 'proposer', source: 'model', text: proposal.say });

  await send({ t: 'phase', step: 'guard', gen });
  const vs = proposal.variants.map((p, i) => evaluate({ id: `G${gen}-${i + 1}`, parent: c.champion.id, gen, change: p.change, reason: p.reason, raw: p.raw }, c.champion.config, c.caps));
  for (const v of vs) {
    await send(variantEvent(v, 'proposed'));
    await send({ t: 'say', agent: 'proposer', source: 'model', text: `${v.id}: ${v.change}.${v.reason ? ` ${v.reason}` : ''}`, variant: v.id });
    await send({ t: 'checks', id: v.id, items: v.checks });
    await send({ t: 'say', agent: 'harness', source: 'code', text: harnessLine(v), tone: v.blocked ? 'alert' : undefined, variant: v.id });
  }
  if (!championPasses) {
    const f = champEval.checks.filter((x) => !x.pass).map((x) => `${x.name.toLowerCase()} ${x.detail}`).join('; ');
    await send({ t: 'checks', id: c.champion.id, items: champEval.checks });
    await send({ t: 'say', agent: 'harness', source: 'code', tone: 'alert', text: `Re-checked champion ${c.champion.id} against the current caps: it now fails ${f}. It cannot stay champion.` });
  }

  await send({ t: 'phase', step: 'measure', gen });
  for (const v of vs) if (v.metrics) await send(metricsEvent(v.id, v.metrics));
  await send({ t: 'say', agent: 'evaluator', source: 'code', text: evaluatorLine(vs, { id: c.champion.id, m: champM }, c.goal) });

  await send({ t: 'phase', step: 'decide', gen });
  const sel = select(vs, goalValue(champM, c.goal), c.goal, championPasses);
  let revertTo: ArchiveEntry | null = null;
  if (sel.kind === 'keep' && !championPasses) {
    for (let p = findEntry(c.archive, c.champion.parent); p; p = p.parent ? findEntry(c.archive, p.parent) : null) {
      if (evaluateEntry(p, c.archive, c.caps).checks.every((x) => x.pass)) { revertTo = p; break; }
    }
    revertTo = revertTo ?? findEntry(c.archive, 'V0');
  }
  const byId = (id: string) => vs.find((v) => v.id === id)!;
  const outcome =
    sel.kind === 'ship' ? `${sel.id} ships as the new champion behind a one-click undo (a two-way door). ${GOALS[c.goal].name}: ${fmtGoal(goalValue(champM, c.goal), c.goal)} to ${fmtGoal(goalValue(byId(sel.id).metrics!, c.goal), c.goal)}.`
      : sel.kind === 'decide' ? `${sel.id} is the best variant but a one-way door (${byId(sel.id).door_reasons.join(' ')}). It waits for the visitor's decision.${sel.then ? ` If the visitor says no, ${sel.then} ships instead.` : ' If the visitor says no, the champion stays.'}`
        : revertTo ? `No variant passed every guardrail. The champion fails the current caps, so the loop reverts to ${revertTo.id}, the nearest ancestor that passes.`
          : `No variant both passed every guardrail and beat the champion. ${c.champion.id} stays champion.`;

  await send({ t: 'thinking', agent: 'supervisor' });
  const wantCard = sel.kind === 'decide';
  const sup = await agentCall(env, c.runId, 'supervisor', buildSupervisorMessages({ gen, goal: c.goal, champion: { id: c.champion.id, metrics: champM }, variants: vs, outcome, card: wantCard, notes: c.notes }),
    MAX_TOKENS.supervisor, (t) => parseSupervisor(t, wantCard), send);
  if (sup.ok && sup.value.say) await send({ t: 'say', agent: 'supervisor', source: 'model', text: sup.value.say });
  else if (!sup.ok) await send({ t: 'note', agent: 'supervisor', text: `The Supervisor did not answer (${STOP_MESSAGES[sup.reason === 'unreadable' ? 'ai_error' : sup.reason]}). Code's decision stands: ${outcome}` });

  // Statuses after this generation.
  const status: Record<string, string> = {};
  for (const v of vs) status[v.id] = v.blocked ? 'blocked' : 'archived';
  if (sel.kind === 'ship') {
    status[sel.id] = 'champion';
    await send({ t: 'ship', id: sel.id, from: c.champion.id });
    await send({ t: 'champion', id: sel.id });
  } else if (sel.kind === 'decide') {
    status[sel.id] = 'pending';
    const v = byId(sel.id);
    const card = sup.ok && sup.value.card ? { ...sup.value.card, source: 'model' } : {
      title: `Approve ${v.id}: ${v.diff.join(', ')}?`,
      body: `${v.door_reasons.join(' ')} ${GOALS[c.goal].name} ${fmtGoal(goalValue(champM, c.goal), c.goal)} to ${fmtGoal(goalValue(v.metrics!, c.goal), c.goal)}.`,
      source: 'code',
    };
    await send({ t: 'decision', kind: 'door', id: v.id, alt: sel.then, door_reasons: v.door_reasons, ...card, options: [{ id: 'approve', label: 'Approve' }, { id: 'reject', label: 'Reject' }, { id: 'why', label: 'Ask why' }] });
  } else if (revertTo) {
    await send({ t: 'ship', id: revertTo.id, from: c.champion.id, revert: true });
    await send({ t: 'champion', id: revertTo.id });
  }

  await send({ t: 'phase', step: 'contract', gen });
  for (const v of vs) await send({ t: 'status', id: v.id, status: status[v.id] });
  const kept = vs.filter((v) => status[v.id] === 'archived').map((v) => v.id);
  const blocked = vs.filter((v) => status[v.id] === 'blocked').map((v) => v.id);
  const champId = sel.kind === 'ship' ? sel.id : revertTo ? revertTo.id : c.champion.id;
  await send({
    t: 'say', agent: 'archivist', source: 'code',
    text: `Recorded ${vs.map((v) => `${v.id} (parent ${v.parent})`).join(' and ')} with configs, checks and scores.${blocked.length ? ` Blocked: ${blocked.join(', ')}.` : ''}${kept.length ? ` Archived, not deleted: ${kept.join(', ')}.` : ''}${sel.kind === 'decide' ? ` ${sel.id} waits for you.` : ''} Champion: ${champId}.`,
  });
}

async function doDecide(c: Common, choice: 'approve' | 'reject', pendingId: string, altId: string | null, send: Send) {
  const pending = findEntry(c.archive, pendingId);
  if (!pending || pending.parent !== c.champion.id) return send({ t: 'error', reason: 'bad_state', message: 'That decision is no longer open.' });
  const pv = evaluateEntry(pending, c.archive, c.caps);
  const champM = runPolicy(c.champion.config).metrics;
  await send({ t: 'phase', step: 'decide', gen: pending.gen });
  if (choice === 'approve') {
    if (pv.blocked || pv.door !== 'one-way') return send({ t: 'error', reason: 'bad_state', message: 'That variant no longer passes the guardrails.' });
    await send({ t: 'status', id: pending.id, status: 'champion' });
    await send({ t: 'ship', id: pending.id, from: c.champion.id, approved: true });
    await send({ t: 'champion', id: pending.id });
    await send({ t: 'say', agent: 'archivist', source: 'code', text: `You approved ${pending.id}. Recorded the approver (you, AP process owner), the change (${pv.diff.join(', ')}) and the undo path back to ${c.champion.id}. ${GOALS[c.goal].name}: ${fmtGoal(goalValue(champM, c.goal), c.goal)} to ${fmtGoal(goalValue(pv.metrics!, c.goal), c.goal)}.` });
    return;
  }
  await send({ t: 'status', id: pending.id, status: 'rejected' });
  const alt = altId ? findEntry(c.archive, altId) : null;
  const av = alt && alt.parent === c.champion.id ? evaluateEntry(alt, c.archive, c.caps) : null;
  if (av && !av.blocked && av.door === 'two-way' && isBetter(goalValue(av.metrics!, c.goal), goalValue(champM, c.goal), c.goal)) {
    await send({ t: 'status', id: av.id, status: 'champion' });
    await send({ t: 'ship', id: av.id, from: c.champion.id });
    await send({ t: 'champion', id: av.id });
    await send({ t: 'say', agent: 'archivist', source: 'code', text: `You rejected ${pending.id}; it stays in the archive as rejected. ${av.id}, a two-way door, ships instead behind an undo: ${fmtGoal(goalValue(champM, c.goal), c.goal)} to ${fmtGoal(goalValue(av.metrics!, c.goal), c.goal)}.` });
  } else {
    await send({ t: 'say', agent: 'archivist', source: 'code', text: `You rejected ${pending.id}; it stays in the archive as rejected, with you as the decider. ${c.champion.id} stays champion.` });
  }
}

async function doWhy(env: Env, c: Common, id: string, question: string, send: Send) {
  const e = findEntry(c.archive, id);
  if (!e || e.parent !== c.champion.id) return send({ t: 'error', reason: 'bad_state', message: 'That decision is no longer open.' });
  const v = { ...evaluateEntry(e, c.archive, c.caps), reason: '' };
  if (!v.metrics) return send({ t: 'error', reason: 'bad_state', message: 'That variant did not run.' });
  await send({ t: 'thinking', agent: 'supervisor' });
  const r = await agentCall(env, c.runId, 'supervisor', buildWhyMessages({ goal: c.goal, variant: v, parent: { id: c.champion.id, metrics: runPolicy(c.champion.config).metrics }, question: question || 'Why is this coming to me?' }),
    MAX_TOKENS.why, parseWhy, send);
  if (!r.ok) return send({ t: 'error', agent: 'supervisor', reason: r.reason === 'unreadable' ? 'ai_error' : r.reason, message: STOP_MESSAGES[r.reason === 'unreadable' ? 'ai_error' : r.reason] });
  if (r.value.reasoning) await send({ t: 'say', agent: 'supervisor', source: 'model', text: `Reasoning: ${r.value.reasoning}` });
  if (r.value.evidence) await send({ t: 'say', agent: 'supervisor', source: 'model', text: `Evidence: ${r.value.evidence}` });
  await send({ t: 'decision', kind: 'door', again: true, id: v.id, title: `Decide on ${v.id}: ${v.diff.join(', ')}`, body: v.door_reasons.join(' '), door_reasons: v.door_reasons, source: 'code', options: [{ id: 'approve', label: 'Approve' }, { id: 'reject', label: 'Reject' }] });
}

async function doReframe(env: Env, c: Common, to: Goal, send: Send) {
  const from = c.goal;
  await send({ t: 'phase', step: 'reframe', gen: Math.max(...c.archive.map((e) => e.gen)) });
  const champM = runPolicy(c.champion.config).metrics;
  if (to === from) {
    await send({ t: 'goal', goal: to });
    await send({ t: 'say', agent: 'evaluator', source: 'code', text: `You kept the goal: ${GOALS[to].name}. Champion ${c.champion.id} at ${fmtGoal(goalValue(champM, to), to)}. The scorer stays locked.` });
    return;
  }
  // Eligible: passed the guardrails and never waited on (or skipped) a one-way decision.
  const ranked = c.archive
    .filter((e) => ['baseline', 'champion', 'former', 'archived'].includes(e.status) && !(e.status === 'archived' && e.door === 'one-way'))
    .map((e) => evaluateEntry(e, c.archive, c.caps))
    .filter((v) => !v.blocked && v.metrics)
    .sort((a, b) => (isBetter(goalValue(a.metrics!, to), goalValue(b.metrics!, to), to) ? -1 : isBetter(goalValue(b.metrics!, to), goalValue(a.metrics!, to), to) ? 1 : 0));
  await send({ t: 'goal', goal: to });
  for (const v of ranked) await send(metricsEvent(v.id, v.metrics!));
  const best = ranked[0];
  await send({ t: 'say', agent: 'evaluator', source: 'code', text: `Goal is now ${GOALS[to].name}. Re-scored ${ranked.length} eligible variants with the same locked scorer: ${ranked.slice(0, 4).map((v) => `${v.id} ${fmtGoal(goalValue(v.metrics!, to), to)}`).join(', ')}.` });
  const newChamp = best && best.id !== c.champion.id && isBetter(goalValue(best.metrics!, to), goalValue(champM, to), to) ? best : null;
  if (newChamp) {
    await send({ t: 'ship', id: newChamp.id, from: c.champion.id, reframe: true });
    await send({ t: 'champion', id: newChamp.id });
  }
  await send({ t: 'thinking', agent: 'supervisor' });
  const after = newChamp ?? { id: c.champion.id, metrics: champM };
  const r = await agentCall(env, c.runId, 'supervisor', buildReframeMessages({ from, to, before: { id: c.champion.id, metrics: champM }, after: { id: after.id, metrics: after.metrics! }, ranked }),
    MAX_TOKENS.reframe, (t) => parseSupervisor(t, false), send);
  if (r.ok && r.value.say) await send({ t: 'say', agent: 'supervisor', source: 'model', text: r.value.say });
  else if (!r.ok) await send({ t: 'note', agent: 'supervisor', text: `The Supervisor did not answer (${STOP_MESSAGES[r.reason === 'unreadable' ? 'ai_error' : r.reason]}). The re-scoring above is complete.` });
  await send({ t: 'say', agent: 'archivist', source: 'code', text: `Reframe minutes recorded: goal ${GOALS[from].name} to ${GOALS[to].name}, decided by you. Champion: ${after.id}.` });
}

// ---------- request handling ----------

export async function onRequestPost({ request, env, waitUntil }: Ctx): Promise<Response> {
  if (!isSameOrigin(request)) return json(403, { ok: false, error: 'Requests must come from this site.' });
  if (Number(request.headers.get('content-length') ?? '0') > MAX_LOOP_BODY_BYTES) return json(413, { ok: false, error: 'Too long.' });
  if (!(request.headers.get('content-type') ?? '').includes('application/json')) return json(415, { ok: false, error: 'Unsupported request format.' });
  let input: Record<string, unknown>;
  try {
    const buf = await request.arrayBuffer();
    if (buf.byteLength > MAX_LOOP_BODY_BYTES) return json(413, { ok: false, error: 'Too long.' });
    const v = JSON.parse(new TextDecoder().decode(buf));
    if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('not an object');
    input = v as Record<string, unknown>;
  } catch {
    return bad('We could not read your request.');
  }
  const action = input.action;
  if (!['start', 'generation', 'decide', 'why', 'reframe'].includes(action as string)) return bad('Unknown action.');
  if (!env.AI || !env.DB) return stop(503, 'unavailable');
  const salt = env.RATE_LIMIT_SALT ?? 'autonomous-enterprise';
  const now = Date.now();

  let runId: string;
  let common: Common | null = null;
  let gen = 0;
  if (action === 'start') {
    try {
      const s = await startRun(env.DB, request.headers.get('cf-connecting-ip') ?? 'unknown', salt, now);
      if (s !== 'ok') return stop(429, s, now);
    } catch (err) {
      console.error('loop start failed', err instanceof Error ? err.message : err);
      return stop(503, 'unavailable');
    }
    runId = await issueRun(salt, now);
  } else {
    const rc = await checkRun(input.run, salt, now);
    if (rc === 'invalid') return bad('Unknown run.');
    if (rc === 'expired') return stop(410, 'expired');
    runId = input.run as string;
    const goal: Goal = input.goal === 'fpr' ? 'fpr' : 'cost';
    const archive = sanitizeArchive(input.archive);
    if (!archive.some((e) => e.id === 'V0' && JSON.stringify(e.config) === JSON.stringify(BASELINE))) return bad('The run state is incomplete.');
    const ch = input.champion && typeof input.champion === 'object' ? (input.champion as Record<string, unknown>) : {};
    const champion = typeof ch.id === 'string' ? findEntry(archive, ch.id) : null;
    const chConfig = parseConfig(ch.config);
    if (!champion || !chConfig || JSON.stringify(chConfig) !== JSON.stringify(champion.config)) return bad('The run state is incomplete.');
    common = { runId, goal, caps: sanitizeCaps(input.caps), archive, champion, notes: sanitizeNotes(input.notes) };
    if (action === 'generation') {
      gen = Number(input.gen);
      if (!Number.isInteger(gen) || gen < 1 || gen > 3) return bad('Generation must be 1, 2 or 3.');
      if (archive.some((e) => e.gen >= gen)) return bad('That generation has already run.');
    }
    if (action === 'decide' && !['approve', 'reject'].includes(input.choice as string)) return bad('Choose approve or reject.');
    if ((action === 'decide' || action === 'why') && !(typeof input.id === 'string' && findEntry(archive, input.id))) return bad('Unknown variant.');
    if (action === 'reframe' && !['cost', 'fpr'].includes(input.to as string)) return bad('Choose a goal.');
    // Model actions need room under the caps before the stream starts.
    const need = action === 'generation' ? 2 : action === 'why' || (action === 'reframe' && input.to !== goal) ? 1 : 0;
    if (need) {
      try {
        const left = await callsLeft(env.DB, runId, now);
        if (left.global < need) return stop(429, 'daily_cap', now);
        if (left.run < need) return stop(429, 'run_cap', now);
      } catch (err) {
        console.error('loop caps failed', err instanceof Error ? err.message : err);
        return stop(503, 'unavailable');
      }
    }
  }

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  const enc = new TextEncoder();
  const send: Send = (o) => writer.write(enc.encode(JSON.stringify(o) + '\n'));
  const pump = async () => {
    try {
      if (action === 'start') {
        await send({ t: 'run', run: runId, calls_max: LOOP_CALLS_PER_RUN });
        await doStart(send);
      } else if (action === 'generation') await doGeneration(env, common!, gen, send);
      else if (action === 'decide') await doDecide(common!, input.choice as 'approve' | 'reject', input.id as string, typeof input.alt === 'string' ? input.alt : null, send);
      else if (action === 'why') await doWhy(env, common!, input.id as string, clean(input.question, 200), send);
      else await doReframe(env, common!, input.to as Goal, send);
      let left: { run: number; global: number } | null = null;
      try { left = await callsLeft(env.DB, runId); } catch { /* report without it */ }
      await send({ t: 'done', calls_left: left ? Math.max(0, left.run) : null, retry_at: left && left.global <= 0 ? nextUtcMidnight(Date.now()) : null });
    } catch (err) {
      console.error('loop step failed', err instanceof Error ? err.message : err);
      await send({ t: 'error', reason: 'ai_error', message: STOP_MESSAGES.ai_error }).catch(() => {});
    } finally {
      await writer.close().catch(() => {});
    }
  };
  const p = pump();
  if (waitUntil) waitUntil(p);
  return new Response(readable, { status: 200, headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', ...BASE_HEADERS, 'X-Accel-Buffering': 'no' } });
}

export async function onRequest(): Promise<Response> {
  return json(405, { ok: false, error: 'Method not allowed.' }, { Allow: 'POST' });
}
