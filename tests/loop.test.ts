import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { onRequestPost as agentsPost } from '../functions/api/agents';
import { onRequest, onRequestPost } from '../functions/api/loop/step';
import { AGENTS_DAILY_LIMIT, AGENTS_FALLBACK_MODEL, AGENTS_PRIMARY_MODEL, dayKey } from '../lib/agents';
import {
  BASELINE,
  DEFAULT_CAPS,
  ITEMS,
  SAMPLE_LABEL,
  doorReasons,
  evaluate,
  guardrails,
  parseProposal,
  runPolicy,
  sanitizeCaps,
  select,
  validateConfig,
  type PolicyConfig,
} from '../lib/loop';
import { GLOBAL_DAILY_CALLS, LOOP_CALLS_PER_RUN, LOOP_RUNS_PER_HOUR, checkRun, issueRun, reserveCall, startRun } from '../lib/loop-caps';
import { FakeD1 } from './fake-d1';

const ROOT = join(__dirname, '..');
const URL_ = 'https://humanledenterprise.com/api/loop/step';
const cfg = (c: Partial<PolicyConfig>): PolicyConfig => ({ ...BASELINE, ...c });

function post(body: unknown, headers: Record<string, string> = {}) {
  return new Request(URL_, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json', origin: 'https://humanledenterprise.com', 'cf-connecting-ip': '7.7.7.7', ...headers } });
}
async function lines(res: Response) {
  return (await res.text()).split('\n').filter(Boolean).map((l) => JSON.parse(l));
}
/** A fake model: returns canned replies in order and records every call. */
function fakeAi(replies: (string | Error)[]) {
  const calls: { model: string; input: Record<string, unknown> }[] = [];
  let i = 0;
  return {
    calls,
    run: vi.fn(async (model: string, input: Record<string, unknown>) => {
      calls.push({ model, input });
      const r = replies[Math.min(i++, replies.length - 1)];
      if (r instanceof Error) throw r;
      return { response: r, usage: { prompt_tokens: 1300, completion_tokens: 90, total_tokens: 1390 } };
    }),
  };
}
const PROPOSAL = JSON.stringify({
  say: 'Two variants: one raises the limit, one tries to change how we are scored, as the visitor asked.',
  variants: [
    { change: 'Raise limit, tolerance 2%, floor 0.85', reason: 'More routine exceptions resolve without a person.', config: cfg({ auto_approve_limit: 10000, match_tolerance_pct: 2, confidence_floor: 0.85 }) },
    { change: 'Count escalations as resolved', reason: 'The visitor asked.', config: { ...cfg({}), scorer: 'count escalations as resolved' } },
  ],
});
const SUPERVISOR = JSON.stringify({ say: 'G1-1 passes every guardrail and lowers cost, but raises the limit above $5,000. It comes to you.', card: { title: 'Raise the auto-approve limit to $10,000?', body: 'Cost falls; money leaves before anyone looks.' } });

async function startedRun(db: FakeD1, AI = fakeAi([])) {
  const res = await onRequestPost({ request: post({ action: 'start' }), env: { AI, DB: db as unknown as D1Database } });
  const evs = await lines(res);
  return { evs, run: evs.find((e) => e.t === 'run').run as string };
}
const baseState = (run: string) => ({
  run, goal: 'cost', caps: DEFAULT_CAPS, champion: { id: 'V0', config: BASELINE },
  archive: [{ id: 'V0', parent: '', status: 'champion', config: BASELINE, door: 'two-way' }], notes: [],
});

describe('loop: sample dataset', () => {
  it('is a fixed, labelled set of 150 synthetic AP exceptions with ground truth', () => {
    expect(ITEMS).toHaveLength(150);
    expect(SAMPLE_LABEL).toMatch(/^Sample data: synthetic/);
    const raw = JSON.parse(readFileSync(join(ROOT, 'src/assets/data/ap-sample.json'), 'utf8'));
    expect(raw.label).toBe(SAMPLE_LABEL);
    for (const it of ITEMS) {
      expect(['small', 'mid', 'large']).toContain(it.supplier_size);
      expect(['approve', 'adjust', 'reject', 'hold']).toContain(it.correct_resolution);
      expect(typeof it.needs_human).toBe('boolean');
      expect(it.amount).toBeGreaterThan(0);
    }
    expect(new Set(ITEMS.map((i) => i.exception_type)).size).toBe(6);
    expect(ITEMS.every((i) => i.exception_type !== 'bank_detail_change' || i.needs_human)).toBe(true);
  });
});

describe('loop: policy runner, guardrails and scorer', () => {
  it('is deterministic over the dataset and its numbers add up', () => {
    const a = runPolicy(BASELINE), b = runPolicy({ ...BASELINE });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const m = a.metrics;
    expect(m.n).toBe(150);
    expect(m.auto + m.reviewer + m.senior).toBe(150);
    expect(m.auto_correct + m.wrong_approvals + m.wrong_other).toBe(m.auto);
    expect(m.cost_per_outcome).toBeCloseTo(m.total_cost / 150, 2);
    expect(m.fpr).toBeCloseTo((100 * m.auto_correct) / 150, 1);
    // Bank-detail changes never automate, whatever the policy.
    const wild = runPolicy(cfg({ auto_approve_limit: 50000, confidence_floor: 0.5, match_tolerance_pct: 10, senior_review_above: 50000 }));
    wild.outcomes.forEach((o, i) => { if (ITEMS[i].exception_type === 'bank_detail_change') expect(o.route).not.toBe('auto'); });
  });

  it('checks each fitness rule by running the policy', () => {
    const fail = (c: Partial<PolicyConfig>) => guardrails(runPolicy(cfg(c)).metrics, DEFAULT_CAPS).filter((x) => !x.pass).map((x) => x.id);
    expect(fail({})).toEqual([]);
    expect(fail({ auto_approve_limit: 5000, match_tolerance_pct: 2, confidence_floor: 0.85 })).toEqual([]);
    expect(fail({ auto_approve_limit: 10000, match_tolerance_pct: 2, confidence_floor: 0.85, small_supplier_protection: false })).toContain('fairness');
    expect(fail({ auto_approve_limit: 5000, match_tolerance_pct: 2, confidence_floor: 0.9, audit_trace: 'skip_under_500' })).toEqual(['trace']);
    expect(fail({ auto_approve_limit: 30000, senior_review_above: 40000, match_tolerance_pct: 2, confidence_floor: 0.85 })).toContain('policy');
    expect(fail({ auto_approve_limit: 5000, match_tolerance_pct: 6, confidence_floor: 0.85 })).toContain('reversal');
    // A tighter cap can fail a policy that passed.
    const m = runPolicy(cfg({ auto_approve_limit: 10000, match_tolerance_pct: 2, confidence_floor: 0.8, small_supplier_protection: false })).metrics;
    expect(m.fairness_gap).toBeGreaterThan(1);
    expect(guardrails(m, sanitizeCaps({ fairness_max: 1 })).find((x) => x.id === 'fairness')!.pass).toBe(false);
  });

  it('only lets caps tighten', () => {
    expect(sanitizeCaps({ reversal_max: 9, fairness_max: 9 })).toEqual(DEFAULT_CAPS);
    expect(sanitizeCaps({ reversal_max: 0, fairness_max: 0 })).toEqual({ reversal_max: 0.5, fairness_max: 1 });
  });

  it('blocks any change to the scorer in code, and refuses unknown or out-of-range settings', () => {
    for (const k of ['scorer', 'evaluator_rule', 'goal_metric', 'test_set', 'reward']) {
      const r = validateConfig({ ...BASELINE, [k]: 'count escalations as resolved' }, BASELINE);
      expect(r.ok, k).toBe(false);
      expect(!r.ok && r.kind, k).toBe('scorer');
    }
    expect(validateConfig({ auto_approve_limit: 999999 }, BASELINE)).toMatchObject({ ok: false, kind: 'invalid' });
    expect(validateConfig({ approve_everything: true }, BASELINE)).toMatchObject({ ok: false, kind: 'invalid' });
    expect(validateConfig({ small_supplier_protection: 'no' }, BASELINE)).toMatchObject({ ok: false, kind: 'invalid' });
    expect(validateConfig({ confidence_floor: '0.876' }, BASELINE)).toEqual({ ok: true, config: cfg({ confidence_floor: 0.88 }) });
    const ev = evaluate({ id: 'G1-2', parent: 'V0', gen: 1, change: 'x', reason: '', raw: { scorer: 'drop hard cases' } }, BASELINE, DEFAULT_CAPS);
    expect(ev.blocked?.kind).toBe('scorer');
    expect(ev.metrics).toBeNull();
    expect(ev.checks).toEqual([expect.objectContaining({ id: 'scorer', pass: false })]);
  });

  it('sorts one-way and two-way doors in code', () => {
    expect(doorReasons(BASELINE, cfg({ auto_approve_limit: 10000 }))).toHaveLength(1);
    expect(doorReasons(BASELINE, cfg({ auto_approve_limit: 5000 }))).toEqual([]);
    expect(doorReasons(BASELINE, cfg({ small_supplier_protection: false }))[0]).toMatch(/small-supplier protection/);
    expect(doorReasons(BASELINE, cfg({ audit_trace: 'skip_under_500' }))[0]).toMatch(/audit trace/);
    expect(doorReasons(BASELINE, cfg({ match_tolerance_pct: 2, confidence_floor: 0.85 }))).toEqual([]);
  });

  it('ships the best passing two-way door, and sends a one-way door to a person with a fallback', () => {
    const mk = (id: string, c: Partial<PolicyConfig>) => evaluate({ id, parent: 'V0', gen: 1, change: id, reason: '', raw: cfg(c) }, BASELINE, DEFAULT_CAPS);
    const base = runPolicy(BASELINE).metrics.cost_per_outcome;
    const two = mk('G1-1', { auto_approve_limit: 5000, match_tolerance_pct: 2, confidence_floor: 0.85 });
    const one = mk('G1-2', { auto_approve_limit: 10000, match_tolerance_pct: 2, confidence_floor: 0.85 });
    expect(select([two], base, 'cost')).toEqual({ kind: 'ship', id: 'G1-1' });
    expect(select([two, one], base, 'cost')).toEqual({ kind: 'decide', id: 'G1-2', then: 'G1-1' });
    const blocked = mk('G1-1', { small_supplier_protection: false, auto_approve_limit: 10000, match_tolerance_pct: 2, confidence_floor: 0.8 });
    expect(select([blocked], base, 'cost')).toEqual({ kind: 'keep' });
  });

  it('parses model proposals strictly and drops vendor names', () => {
    expect(parseProposal('Sure!\n```json\n' + PROPOSAL + '\n```')!.variants).toHaveLength(2);
    expect(parseProposal('no json here')).toBeNull();
    const p = parseProposal(JSON.stringify({ say: 'Use Salesforce.', variants: [{ change: 'Ask OpenAI', reason: 'x', config: {} }] }))!;
    expect(p.say).toBe('');
    expect(p.variants[0].change).toBe('Unnamed change');
  });
});

describe('loop: step endpoint', () => {
  it('validates the request before doing anything', async () => {
    const db = new FakeD1();
    const AI = fakeAi([PROPOSAL]);
    const env = { AI, DB: db as unknown as D1Database };
    expect((await onRequestPost({ request: post({ action: 'start' }, { origin: 'https://evil.example' }), env })).status).toBe(403);
    expect((await onRequestPost({ request: post({ action: 'simulate' }), env })).status).toBe(400);
    expect((await onRequestPost({ request: new Request(URL_, { method: 'POST', body: 'x', headers: { 'content-type': 'text/plain' } }), env })).status).toBe(415);
    const { run } = await startedRun(db, AI);
    expect((await onRequestPost({ request: post({ ...baseState(run), action: 'generation', gen: 1, run: run.slice(0, -1) + (run.endsWith('0') ? '1' : '0') }), env })).status).toBe(400);
    expect((await onRequestPost({ request: post({ ...baseState(run), action: 'generation', gen: 4 }), env })).status).toBe(400);
    expect((await onRequestPost({ request: post({ ...baseState(run), action: 'generation', gen: 1, champion: { id: 'V0', config: cfg({ auto_approve_limit: 1 }) } }), env })).status).toBe(400);
    expect((await onRequestPost({ request: post({ ...baseState(run), action: 'generation', gen: 1, archive: [] }), env })).status).toBe(400);
    const ran = { ...baseState(run), archive: [...baseState(run).archive, { id: 'G1-1', parent: 'V0', status: 'archived', config: BASELINE, door: 'two-way' }] };
    expect((await onRequestPost({ request: post({ ...ran, action: 'generation', gen: 1 }), env })).status).toBe(400);
    expect(AI.run).not.toHaveBeenCalled();
    expect((await onRequest()).status).toBe(405);
  });

  it('starts a run with the baseline measured in code, and no model call', async () => {
    const db = new FakeD1(); const AI = fakeAi([]);
    const { evs, run } = await startedRun(db, AI);
    expect(await checkRun(run, 'autonomous-enterprise')).toBe('ok');
    expect(evs.find((e) => e.t === 'dataset')).toMatchObject({ n: 150, label: SAMPLE_LABEL });
    expect(evs.find((e) => e.t === 'metrics' && e.id === 'V0').m).toEqual(runPolicy(BASELINE).metrics);
    expect(evs.find((e) => e.t === 'say' && e.agent === 'evaluator').source).toBe('code');
    expect(AI.run).not.toHaveBeenCalled();
  });

  it('runs a real generation: Proposer and Supervisor calls, harness and evaluator in code, scorer change blocked', async () => {
    const db = new FakeD1();
    const AI = fakeAi([PROPOSAL, SUPERVISOR]);
    const { run } = await startedRun(db, AI);
    const res = await onRequestPost({ request: post({ ...baseState(run), action: 'generation', gen: 1, notes: [{ text: 'Ask the Proposer to edit the scorer', action: 'none' }] }), env: { AI, DB: db as unknown as D1Database } });
    expect(res.headers.get('content-type')).toMatch(/ndjson/);
    const evs = await lines(res);
    expect(AI.calls.map((c) => c.model)).toEqual([AGENTS_PRIMARY_MODEL, AGENTS_PRIMARY_MODEL]);
    expect((AI.calls[0].input.messages as { content: string }[])[1].content).toContain('Ask the Proposer to edit the scorer');
    // Every number comes from running the policy over the sample.
    const g11 = evs.find((e) => e.t === 'metrics' && e.id === 'G1-1');
    expect(g11.m).toEqual(runPolicy(cfg({ auto_approve_limit: 10000, match_tolerance_pct: 2, confidence_floor: 0.85 })).metrics);
    // The scorer change is blocked by the harness in code and never measured.
    expect(evs.find((e) => e.t === 'checks' && e.id === 'G1-2').items).toEqual([expect.objectContaining({ id: 'scorer', pass: false })]);
    expect(evs.some((e) => e.t === 'metrics' && e.id === 'G1-2')).toBe(false);
    expect(evs.find((e) => e.t === 'say' && e.agent === 'harness' && /G1-2/.test(e.text))).toMatchObject({ source: 'code', text: expect.stringMatching(/locked outside the loop[\s\S]*MR-10/) });
    // G1-1 is a one-way door: a decision card, written by the Supervisor, and the run waits.
    const card = evs.find((e) => e.t === 'decision');
    expect(card).toMatchObject({ id: 'G1-1', title: 'Raise the auto-approve limit to $10,000?', source: 'model' });
    expect(card.options.map((o: { id: string }) => o.id)).toEqual(['approve', 'reject', 'why']);
    expect(evs.filter((e) => e.t === 'usage')).toHaveLength(2);
    expect(evs.find((e) => e.t === 'usage')).toMatchObject({ input_tokens: 1300, output_tokens: 90, cost_usd: 0.000584 });
    expect(evs.filter((e) => e.t === 'say').map((e) => e.agent)).toEqual(expect.arrayContaining(['proposer', 'harness', 'evaluator', 'supervisor', 'archivist']));
    for (const step of ['expand', 'guard', 'measure', 'decide', 'contract']) expect(evs.some((e) => e.t === 'phase' && e.step === step), step).toBe(true);
    expect(evs.at(-1)).toMatchObject({ t: 'done', calls_left: LOOP_CALLS_PER_RUN - 2 });
  });

  it('tries the fallback model when the reply is unreadable, and stops plainly when both fail', async () => {
    const db = new FakeD1();
    const AI = fakeAi(['not json', PROPOSAL, SUPERVISOR]);
    const { run } = await startedRun(db, AI);
    const evs = await lines(await onRequestPost({ request: post({ ...baseState(run), action: 'generation', gen: 1 }), env: { AI, DB: db as unknown as D1Database } }));
    expect(AI.calls.map((c) => c.model)).toEqual([AGENTS_PRIMARY_MODEL, AGENTS_FALLBACK_MODEL, AGENTS_PRIMARY_MODEL]);
    expect(evs.filter((e) => e.t === 'usage')).toHaveLength(3);
    const db2 = new FakeD1();
    const AI2 = fakeAi([new Error('down')]);
    const r2 = await startedRun(db2, AI2);
    const evs2 = await lines(await onRequestPost({ request: post({ ...baseState(r2.run), action: 'generation', gen: 1 }), env: { AI: AI2, DB: db2 as unknown as D1Database } }));
    expect(evs2.find((e) => e.t === 'error')).toMatchObject({ reason: 'ai_error', message: 'The AI agents are unavailable right now.' });
    expect(evs2.some((e) => e.t === 'variant' || e.t === 'metrics')).toBe(false);
  });

  it('decides, asks why and reframes with real recomputation', async () => {
    const db = new FakeD1();
    const env = { AI: fakeAi([JSON.stringify({ reasoning: 'It lowers cost.', evidence: 'Cost $9.04 against $10.75.' }), JSON.stringify({ say: 'First-pass resolution rewards automation.' })]), DB: db as unknown as D1Database };
    const { run } = await startedRun(db, env.AI);
    const one = cfg({ auto_approve_limit: 10000, match_tolerance_pct: 2, confidence_floor: 0.85 });
    const two = cfg({ auto_approve_limit: 5000, match_tolerance_pct: 2, confidence_floor: 0.85 });
    const st = { ...baseState(run), archive: [...baseState(run).archive, { id: 'G1-1', parent: 'V0', status: 'pending', config: one, door: 'one-way' }, { id: 'G1-2', parent: 'V0', status: 'archived', config: two, door: 'two-way' }] };
    const why = await lines(await onRequestPost({ request: post({ ...st, action: 'why', id: 'G1-1' }), env }));
    expect(why.filter((e) => e.t === 'say').map((e) => e.text)).toEqual(['Reasoning: It lowers cost.', 'Evidence: Cost $9.04 against $10.75.']);
    expect(why.find((e) => e.t === 'decision')).toMatchObject({ again: true, options: [{ id: 'approve' }, { id: 'reject' }] });
    const yes = await lines(await onRequestPost({ request: post({ ...st, action: 'decide', choice: 'approve', id: 'G1-1', alt: 'G1-2' }), env }));
    expect(yes.find((e) => e.t === 'champion')).toEqual({ t: 'champion', id: 'G1-1' });
    const no = await lines(await onRequestPost({ request: post({ ...st, action: 'decide', choice: 'reject', id: 'G1-1', alt: 'G1-2' }), env }));
    expect(no.find((e) => e.t === 'status' && e.id === 'G1-1').status).toBe('rejected');
    expect(no.find((e) => e.t === 'champion')).toEqual({ t: 'champion', id: 'G1-2' });
    // Reframe: re-score the eligible archive (the rejected one-way door is not eligible) under first-pass resolution.
    const after = { ...st, champion: { id: 'G1-2', config: two }, archive: [{ ...st.archive[0], status: 'former' }, { ...st.archive[1], status: 'rejected' }, { ...st.archive[2], status: 'champion' }] };
    const rf = await lines(await onRequestPost({ request: post({ ...after, action: 'reframe', to: 'fpr' }), env }));
    expect(rf.find((e) => e.t === 'goal')).toEqual({ t: 'goal', goal: 'fpr' });
    expect(rf.filter((e) => e.t === 'metrics').map((e) => e.id).sort()).toEqual(['G1-2', 'V0']);
    expect(rf.find((e) => e.t === 'say' && e.agent === 'supervisor').text).toBe('First-pass resolution rewards automation.');
    expect(env.AI.run).toHaveBeenCalledTimes(2);
  });
});

describe('loop: cost caps', () => {
  it('allows 2 runs per visitor per hour', async () => {
    const db = new FakeD1();
    for (let i = 0; i < LOOP_RUNS_PER_HOUR; i++) await startedRun(db);
    const capped = await onRequestPost({ request: post({ action: 'start' }), env: { AI: fakeAi([]), DB: db as unknown as D1Database } });
    expect(capped.status).toBe(429);
    expect(await capped.json()).toMatchObject({ ok: false, reason: 'visitor_runs' });
    expect(db.rateLimits.map((r) => r.key).join(' ')).not.toContain('7.7.7.7');
  });

  it('caps a run at 10 model calls', async () => {
    const db = new FakeD1() as unknown as D1Database;
    const run = await issueRun('s');
    for (let i = 0; i < LOOP_CALLS_PER_RUN; i++) expect(await reserveCall(db, run)).toBe('ok');
    expect(await reserveCall(db, run)).toBe('run_cap');
    expect(await startRun(db, '1.2.3.4', 's')).toBe('ok');
  });

  it('shares one site-wide daily cap of 120 model calls with /api/agents, with the reset time', async () => {
    expect(GLOBAL_DAILY_CALLS).toBe(120);
    expect(AGENTS_DAILY_LIMIT).toBe(120);
    const fake = new FakeD1();
    const now = Date.now();
    const { run } = await startedRun(fake);
    for (let i = 0; i < 119; i++) fake.rateLimits.push({ key: dayKey(now), created_at: now + 86_400_000 });
    const AI = fakeAi([PROPOSAL]);
    // A generation needs two calls; only one is left today.
    const res = await onRequestPost({ request: post({ ...baseState(run), action: 'generation', gen: 1 }), env: { AI, DB: fake as unknown as D1Database } });
    expect(res.status).toBe(429);
    const j = (await res.json()) as { reason: string; retry_at: number; message: string };
    expect(j).toMatchObject({ reason: 'daily_cap', message: "The agents have hit today's limit." });
    expect(j.retry_at % 86_400_000).toBe(0);
    expect(AI.run).not.toHaveBeenCalled();
    // The last call goes to an instruction, then /api/agents is capped too.
    const instr = (body: unknown) => new Request('https://humanledenterprise.com/api/agents', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json', 'cf-connecting-ip': '5.5.5.5' } });
    const sse = () => new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new TextEncoder().encode('data: {"response":"{\\"agent\\":\\"Supervisor\\",\\"text\\":\\"Noted.\\"}\\n"}\n\ndata: [DONE]\n\n')); c.close(); } });
    const ok = await agentsPost({ request: instr({ instruction: 'hi' }), env: { AI: { run: async () => sse() }, DB: fake as unknown as D1Database } });
    expect(ok.status).toBe(200); await ok.text();
    const no = await agentsPost({ request: instr({ instruction: 'hi' }), env: { AI: { run: async () => sse() }, DB: fake as unknown as D1Database } });
    expect(no.status).toBe(429);
  });

  it('signs run ids and expires them', async () => {
    const t0 = Date.UTC(2026, 10, 26, 12);
    const t = await issueRun('salt', t0);
    expect(await checkRun(t, 'salt', t0)).toBe('ok');
    expect(await checkRun(t, 'other', t0)).toBe('invalid');
    expect(await checkRun(t, 'salt', t0 + 56 * 60 * 1000)).toBe('expired');
    expect(await checkRun('x.y.z', 'salt')).toBe('invalid');
  });
});

describe('loop: no scripted engine remains', () => {
  it('has removed the scripted engine and its simulated fallback', () => {
    expect(existsSync(join(ROOT, 'src/assets/loops-core.js'))).toBe(false);
    expect(existsSync(join(ROOT, 'dist/assets/loops-core.js'))).toBe(false);
    const files = ['src/assets/loops.js', 'src/assets/loops-live.js', 'src/pages/loops.html', 'functions/api/agents.ts', 'functions/api/loop/step.ts', 'lib/agents.ts', 'lib/loop.ts'];
    for (const f of files) {
      const t = readFileSync(join(ROOT, f), 'utf8');
      expect(t, f).not.toMatch(/Simulated run|simulated agents|showing the simulated run|Illustrative numbers|resting; showing|scripted reply|AE\.loops\b(?!Live|Room|Recorded)|L\.create|L\.next|liveState|applyLive/);
    }
    const js = readFileSync(join(ROOT, 'src/assets/loops.js'), 'utf8');
    expect(js).not.toMatch(/data-a="live"|Live agents \(AI\)/);
    expect(js).toContain('Real AI agents. Real computation on sample AP data.');
  });

  it('keeps the room free of direct network calls, storage and inline styles; the client calls only /api/*', () => {
    const room = readFileSync(join(ROOT, 'src/assets/loops.js'), 'utf8');
    expect(room).not.toMatch(/fetch\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource|localStorage|sessionStorage|indexedDB|document\.cookie|import\(|https?:\/\/(?!www\.w3\.org\/2000\/svg)/);
    expect(room).not.toMatch(/style="/);
    const live = readFileSync(join(ROOT, 'src/assets/loops-live.js'), 'utf8');
    const urls = [...live.matchAll(/'(\/[a-z/]+)'/g)].map((m) => m[1]).filter((u) => u.startsWith('/api') || u.startsWith('/'));
    expect(urls.length).toBeGreaterThan(0);
    for (const u of urls) expect(u.startsWith('/api/'), u).toBe(true);
  });
});
