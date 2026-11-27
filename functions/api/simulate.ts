import { PRIMARY_MODEL } from '../../lib/guide';
import {
  SIM_MAX_BODY_BYTES,
  SIM_MAX_TEXT,
  SIM_MAX_TOKENS,
  SIM_MIN_TEXT,
  SIM_PER_DAY,
  SIM_PER_HOUR,
  buildMessages,
  cleanDescription,
  countDraftToday,
  draftsToday,
  parseDraft,
} from '../../lib/simulate';
import { isRateLimited, isSameOrigin } from './request';

/**
 * Simulate your process, mode B. POST { action: "draft", text } -> { ok, draft: { template, steps } }.
 * One model call per request (the guide's primary model). The reply is parsed and rebuilt from fixed enums
 * (lib/simulate.ts), so only schema data reaches the page. Caps: POST only, same origin, body <= 4 KB, text <= 1,200
 * characters, SIM_PER_HOUR drafts per salted IP hash per hour, SIM_PER_DAY drafts site-wide per UTC day, all in the
 * existing rate_limits table. Nothing the visitor types is stored or logged. Every failure says to build step by step.
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

export const SIM_TIMEOUT_MS = 20000;
/** The guide's primary model. No fallback call: the cap is one model call per request. */
export const SIM_MODEL = PRIMARY_MODEL;

const STEP_BY_STEP = 'You can still build your flow step by step below.';
export const SIM_MESSAGES = {
  visitor_limit: `You have used the ${SIM_PER_HOUR} AI drafts this hour. ${STEP_BY_STEP}`,
  daily_cap: `The site has used today\u2019s ${SIM_PER_DAY} AI drafts. ${STEP_BY_STEP}`,
  unavailable: `The AI draft is not available right now. ${STEP_BY_STEP}`,
  unreadable: `The AI did not return a usable flow. ${STEP_BY_STEP}`,
  not_a_process: `That does not read like a work process with at least two steps. Try again with who does what, in order, or ${STEP_BY_STEP.charAt(0).toLowerCase()}${STEP_BY_STEP.slice(1)}`,
} as const;

function json(status: number, body: unknown, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra },
  });
}

function stop(status: number, reason: keyof typeof SIM_MESSAGES, extra: Record<string, string> = {}) {
  return json(status, { ok: false, reason, message: SIM_MESSAGES[reason], fallback: 'build' }, extra);
}

class Timeout extends Error {}
function withDeadline<T>(p: Promise<T>, ms: number): Promise<T> {
  let t: ReturnType<typeof setTimeout>;
  return Promise.race([p, new Promise<T>((_, rej) => { t = setTimeout(() => rej(new Timeout('deadline')), ms); })]).finally(() => clearTimeout(t));
}

export async function onRequestPost({ request, env }: Ctx): Promise<Response> {
  if (!isSameOrigin(request)) return json(403, { ok: false, error: 'Requests must come from this site.' });
  if (Number(request.headers.get('content-length') ?? '0') > SIM_MAX_BODY_BYTES) return json(413, { ok: false, error: 'Too long.' });
  if (!(request.headers.get('content-type') ?? '').includes('application/json')) return json(415, { ok: false, error: 'Unsupported request format.' });

  let input: Record<string, unknown> | null = null;
  try {
    const buf = await request.arrayBuffer();
    if (buf.byteLength > SIM_MAX_BODY_BYTES) return json(413, { ok: false, error: 'Too long.' });
    const v: unknown = JSON.parse(new TextDecoder().decode(buf));
    input = v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return json(400, { ok: false, error: 'We could not read your request.' });
  }
  if (!input) return json(400, { ok: false, error: 'We could not read your request.' });
  if (input.action !== 'draft') return json(400, { ok: false, error: 'Unknown action.' });

  const text = cleanDescription(input.text);
  if ([...text].length > SIM_MAX_TEXT) return json(413, { ok: false, error: `Please keep the description to ${SIM_MAX_TEXT} characters.` });
  if (text.length < SIM_MIN_TEXT) return json(400, { ok: false, error: 'Please describe your process in a sentence or two.' });
  if (!env.AI || !env.DB) return stop(503, 'unavailable');

  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
  const salt = env.RATE_LIMIT_SALT ?? 'autonomous-enterprise';
  try {
    if ((await draftsToday(env.DB)) >= SIM_PER_DAY) return stop(429, 'daily_cap', { 'Retry-After': '3600' });
    if (await isRateLimited(env.DB, ip, salt, Date.now(), { bucket: 'simulate', max: SIM_PER_HOUR })) return stop(429, 'visitor_limit', { 'Retry-After': '3600' });
    await countDraftToday(env.DB);
  } catch (err) {
    console.error('simulate limit check failed', err instanceof Error ? err.message : 'error');
    return stop(503, 'unavailable');
  }

  let reply = '';
  try {
    const out = await withDeadline(env.AI.run(SIM_MODEL, { messages: buildMessages(text), max_tokens: SIM_MAX_TOKENS, temperature: 0.1 }), SIM_TIMEOUT_MS);
    const resp = out && typeof out === 'object' ? (out as Record<string, unknown>).response : undefined;
    reply = typeof resp === 'string' ? resp : resp && typeof resp === 'object' ? JSON.stringify(resp) : '';
  } catch (err) {
    // Only the error kind is logged, never the visitor's text or the model's reply.
    console.error('simulate model failed', err instanceof Timeout ? 'timeout' : 'error');
    return stop(503, 'unavailable');
  }
  if (!reply.trim()) return stop(503, 'unavailable');

  const result = parseDraft(reply, text);
  if (!result.ok) return stop(200, result.reason);
  return json(200, { ok: true, draft: result.draft, repaired: result.repairs.length > 0 });
}

export async function onRequest(): Promise<Response> {
  return json(405, { ok: false, error: 'Method not allowed.' }, { Allow: 'POST' });
}
