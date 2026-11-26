import { AGENTS_FALLBACK_MODEL, AGENTS_PRIMARY_MODEL, costUsd, estimateUsage, nextUtcMidnight, readUsage, type Usage } from '../../../lib/agents';
import {
  ASK_MAX_TOKENS,
  ASK_VISITOR_LIMIT,
  MAX_ASK_BODY_BYTES,
  buildAskMessages,
  checkAnswer,
  gateControls,
  routeQuestion,
  selectSubgraphs,
  validateQuestion,
  type Eval,
  type Route,
  type Subgraph,
} from '../../../lib/graph';
import { reserveGlobalCall, startVisitorTurn } from '../../../lib/loop-caps';
import { isSameOrigin } from '../request';

/**
 * The graph agent and the enterprise brain on /blueprints/graphs/. POST { question } -> JSON.
 * Code routes the question (deterministic rules), traverses the knowledge graph and/or the skill graph to select a
 * subgraph, then one model call answers from that subgraph only. Code checks the answer (schema, citations, vendor
 * names, prompt leaks, length). Caps: 8 questions per visitor per hour, and every model call counts against the
 * site-wide daily budget shared with /api/agents and /api/loop/step. Every answer is a real model call: at a cap or
 * a model error the response says so, and still carries the route and subgraph, which are pure code.
 */

interface AiBinding {
  run(model: string, input: Record<string, unknown>): Promise<unknown>;
}
export interface Env {
  DB: D1Database;
  AI: AiBinding;
  RATE_LIMIT_SALT?: string;
}
type Ctx = { request: Request; env: Env };

export const ASK_TIMEOUT_MS = 20000;
const HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
const json = (status: number, body: unknown, extra: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { ...HEADERS, ...extra } });

export type AskStop = 'visitor_limit' | 'daily_cap' | 'ai_error' | 'unavailable' | 'rule' | 'unreadable';
export const ASK_STOP_MESSAGES: Record<AskStop, string> = {
  visitor_limit: 'You have asked eight questions this hour, the limit per visitor.',
  daily_cap: 'The graph agent is resting: the site has used today\u2019s model calls.',
  ai_error: 'The graph agent is resting: the model is unavailable right now.',
  unavailable: 'The graph agent is resting: the model is unavailable right now.',
  rule: 'The answer broke a site rule (a vendor name or prompt text), so it was cut.',
  unreadable: 'The model did not reply in the required format, so there is no answer.',
};

class Timeout extends Error {}
function withDeadline<T>(p: Promise<T>, ms: number): Promise<T> {
  let t: ReturnType<typeof setTimeout>;
  return Promise.race([p, new Promise<T>((_, rej) => { t = setTimeout(() => rej(new Timeout('deadline')), ms); })]).finally(() => clearTimeout(t));
}

interface Call { model: 'primary' | 'fallback'; usage: Usage; cost_usd: number }

function plan(route: Route, subs: Subgraph[]) {
  return {
    route,
    controls: gateControls(route),
    subgraphs: subs.map((s) => ({ graph: s.graph, nodes: s.nodes, edges: s.edges, path: s.path, notes: s.notes })),
  };
}

function stopped(status: number, reason: AskStop, base: ReturnType<typeof plan>, extra: Record<string, unknown> = {}, now = Date.now()) {
  const retry_at = reason === 'daily_cap' ? nextUtcMidnight(now) : reason === 'visitor_limit' ? now + 3600_000 : undefined;
  const headers: Record<string, string> = reason === 'daily_cap' ? { 'Retry-After': String(Math.ceil((nextUtcMidnight(now) - now) / 1000)) } : reason === 'visitor_limit' ? { 'Retry-After': '3600' } : {};
  return json(status, { ok: false, reason, message: ASK_STOP_MESSAGES[reason], ...(retry_at ? { retry_at } : {}), ...base, ...extra }, headers);
}

export async function onRequestPost({ request, env }: Ctx): Promise<Response> {
  if (!isSameOrigin(request)) return json(403, { ok: false, error: 'Requests must come from this site.' });
  if (Number(request.headers.get('content-length') ?? '0') > MAX_ASK_BODY_BYTES) return json(413, { ok: false, error: 'Too long.' });
  if (!(request.headers.get('content-type') ?? '').includes('application/json')) return json(415, { ok: false, error: 'Unsupported request format.' });
  let input: Record<string, unknown>;
  try {
    const buf = await request.arrayBuffer();
    if (buf.byteLength > MAX_ASK_BODY_BYTES) return json(413, { ok: false, error: 'Too long.' });
    const v = JSON.parse(new TextDecoder().decode(buf));
    if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('not an object');
    input = v as Record<string, unknown>;
  } catch {
    return json(400, { ok: false, error: 'We could not read your request.' });
  }
  const q = validateQuestion(input.question);
  if (!q.ok) return json(400, { ok: false, error: q.error });

  const t0 = Date.now();
  // Routing and traversal are code: they always run, even when the model is resting.
  const route = routeQuestion(q.value);
  const subs = selectSubgraphs(q.value, route);
  const base = plan(route, subs);
  if (!env.AI || !env.DB) return stopped(503, 'unavailable', base);

  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
  const salt = env.RATE_LIMIT_SALT ?? 'autonomous-enterprise';
  try {
    const lim = await startVisitorTurn(env.DB, 'graph', ip, salt, ASK_VISITOR_LIMIT);
    if (lim !== 'ok') return stopped(429, lim, base);
  } catch (err) {
    console.error('graph ask limit check failed', err instanceof Error ? err.message : err);
    return stopped(503, 'unavailable', base);
  }

  const messages = buildAskMessages(q.value, route, subs);
  const inputChars = messages.reduce((n, m) => n + m.content.length, 0);
  const calls: Call[] = [];
  let last: AskStop = 'ai_error';
  let evals: Eval[] = [];
  for (const model of [AGENTS_PRIMARY_MODEL, AGENTS_FALLBACK_MODEL]) {
    try {
      if ((await reserveGlobalCall(env.DB)) !== 'ok') return stopped(calls.length ? 503 : 429, 'daily_cap', base, { calls, evals });
    } catch {
      return stopped(503, 'unavailable', base, { calls });
    }
    const which = model === AGENTS_PRIMARY_MODEL ? 'primary' : 'fallback';
    let out: unknown;
    try {
      out = await withDeadline(env.AI.run(model, { messages, max_tokens: ASK_MAX_TOKENS, temperature: 0.2 }), ASK_TIMEOUT_MS);
    } catch (err) {
      console.error('graph ask model failed', which, err instanceof Error ? err.message : err);
      last = 'ai_error';
      continue;
    }
    const resp = out && typeof out === 'object' ? (out as Record<string, unknown>).response : undefined;
    const text = typeof resp === 'string' ? resp : resp && typeof resp === 'object' ? JSON.stringify(resp) : '';
    const usage = readUsage(out) ?? estimateUsage(inputChars, text.length);
    calls.push({ model: which, usage, cost_usd: Number(costUsd(usage).toFixed(6)) });
    const checked = checkAnswer(text, subs);
    evals = checked.evals;
    if (checked.ok) {
      return json(200, {
        ok: true, answer: checked.answer, cited: checked.cited, evals, calls, ...base,
        latency_ms: Date.now() - t0,
        trace: { at: new Date().toISOString(), signal: 'web', skill: 'SK-graph', agent: 'AG-graph', action: 'answer (read only)' },
      });
    }
    // A rule break is final: a cut answer is not retried on another model.
    if (checked.reason === 'rule') return stopped(200, 'rule', base, { calls, evals, latency_ms: Date.now() - t0 });
    last = 'unreadable';
  }
  return stopped(last === 'unreadable' ? 200 : 503, last, base, { calls, evals, latency_ms: Date.now() - t0 });
}

export async function onRequest(): Promise<Response> {
  return json(405, { ok: false, error: 'Method not allowed.' }, { Allow: 'POST' });
}
