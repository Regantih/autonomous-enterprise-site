import { AGENTS_FALLBACK_MODEL, AGENTS_PRIMARY_MODEL, costUsd, estimateUsage, nextUtcMidnight, readUsage } from '../../lib/agents';
import {
  INTAKE_MAX_TOKENS,
  INTAKE_VISITOR_LIMIT,
  MAX_INTAKE_BODY_BYTES,
  MAX_INTAKE_MESSAGE_CHARS,
  MAX_INTAKE_TURNS,
  buildIntakeMessages,
  checkCaptured,
  isIntent,
  parseIntakeReply,
  sanitizeCaptured,
  sanitizeIntakeHistory,
  type Intent,
} from '../../lib/intake';
import { reserveGlobalCall, startVisitorTurn } from '../../lib/loop-caps';
import { isHoneypotFilled } from '../../lib/validate';
import { isRateLimited, isSameOrigin, saveRequest } from './request';

/**
 * The conversational intake agent. POST JSON:
 *   { action: "turn", intent?, messages, captured, edited }  -> one model call: the next short question and the fields it
 *        extracted. Code sanitises the fields and says what is still missing. No request is stored.
 *   { action: "submit", intent, captured, consent: true } -> code validates with the same rules the forms used and
 *        stores one row in the existing requests table. No model call. Refused without explicit consent.
 * Caps: 12 turns per visitor per hour; every model call counts against the site-wide daily budget shared with
 * /api/agents, /api/loop/step and /api/graph/ask. Submissions share the forms' 5-per-hour limit.
 * At a cap or a model error the reply says so plainly; the page then offers a plain link, never a form.
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

export const INTAKE_TIMEOUT_MS = 15000;
const HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
const json = (status: number, body: unknown, extra: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { ...HEADERS, ...extra } });

export type IntakeStop = 'visitor_limit' | 'daily_cap' | 'ai_error' | 'unavailable' | 'rule' | 'turns';
export const INTAKE_STOP_MESSAGES: Record<IntakeStop, string> = {
  visitor_limit: 'The intake agent is resting for you: twelve turns this hour is the limit per visitor.',
  daily_cap: 'The intake agent is resting: the site has used today\u2019s model calls.',
  ai_error: 'The intake agent is resting: the model is unavailable right now.',
  unavailable: 'The intake agent is resting: the model is unavailable right now.',
  rule: 'The agent\u2019s reply broke a site rule, so it was cut. Please rephrase, or edit the card yourself.',
  turns: 'That is the most this conversation can take. Edit the card yourself and send it.',
};
function stopped(status: number, reason: IntakeStop, extra: Record<string, unknown> = {}, now = Date.now()) {
  const retry_at = reason === 'daily_cap' ? nextUtcMidnight(now) : reason === 'visitor_limit' ? now + 3600_000 : undefined;
  return json(status, { ok: false, reason, message: INTAKE_STOP_MESSAGES[reason], ...(retry_at ? { retry_at } : {}), ...extra },
    reason === 'daily_cap' ? { 'Retry-After': String(Math.ceil((nextUtcMidnight(now) - now) / 1000)) } : reason === 'visitor_limit' ? { 'Retry-After': '3600' } : {});
}

class Timeout extends Error {}
function withDeadline<T>(p: Promise<T>, ms: number): Promise<T> {
  let t: ReturnType<typeof setTimeout>;
  return Promise.race([p, new Promise<T>((_, rej) => { t = setTimeout(() => rej(new Timeout('deadline')), ms); })]).finally(() => clearTimeout(t));
}

export async function onRequestPost({ request, env }: Ctx): Promise<Response> {
  if (!isSameOrigin(request)) return json(403, { ok: false, error: 'Requests must come from this site.' });
  if (Number(request.headers.get('content-length') ?? '0') > MAX_INTAKE_BODY_BYTES) return json(413, { ok: false, error: 'Too long.' });
  if (!(request.headers.get('content-type') ?? '').includes('application/json')) return json(415, { ok: false, error: 'Unsupported request format.' });
  let input: Record<string, unknown>;
  try {
    const buf = await request.arrayBuffer();
    if (buf.byteLength > MAX_INTAKE_BODY_BYTES) return json(413, { ok: false, error: 'Too long.' });
    const v = JSON.parse(new TextDecoder().decode(buf));
    if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('not an object');
    input = v as Record<string, unknown>;
  } catch {
    return json(400, { ok: false, error: 'We could not read your request.' });
  }
  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
  const salt = env.RATE_LIMIT_SALT ?? 'autonomous-enterprise';
  if (input.action === 'submit') return submit(input, env, ip, salt);
  if (input.action !== 'turn') return json(400, { ok: false, error: 'Unknown action.' });

  const intent: Intent | null = isIntent(input.intent) ? input.intent : null;
  const rawMsgs = Array.isArray(input.messages) ? input.messages : [];
  if (rawMsgs.some((m) => m && typeof m === 'object' && typeof (m as Record<string, unknown>).content === 'string' && ((m as Record<string, unknown>).content as string).length > MAX_INTAKE_MESSAGE_CHARS)) {
    return json(400, { ok: false, error: `Keep each message to ${MAX_INTAKE_MESSAGE_CHARS} characters.` });
  }
  const history = sanitizeIntakeHistory(rawMsgs);
  if (!history.length || history[history.length - 1].role !== 'user') return json(400, { ok: false, error: 'Please type a message.' });
  if (history.filter((m) => m.role === 'user').length > MAX_INTAKE_TURNS) return stopped(200, 'turns');
  const captured = intent ? sanitizeCaptured(intent, input.captured) : {};
  const before = intent ? checkCaptured(intent, captured) : null;
  if (!env.AI || !env.DB) return stopped(503, 'unavailable');

  try {
    const lim = await startVisitorTurn(env.DB, 'intake', ip, salt, INTAKE_VISITOR_LIMIT);
    if (lim !== 'ok') return stopped(429, lim);
  } catch (err) {
    console.error('intake limit check failed', err instanceof Error ? err.message : err);
    return stopped(503, 'unavailable');
  }

  const t0 = Date.now();
  const today = new Date().toISOString().slice(0, 10);
  const messages = buildIntakeMessages(intent, history, captured, before ? before.missing : [], today);
  const inputChars = messages.reduce((n, m) => n + m.content.length, 0);
  const visitorText = history.filter((m) => m.role === 'user').map((m) => m.content).join(' ');
  const calls: { model: 'primary' | 'fallback'; usage: ReturnType<typeof estimateUsage>; cost_usd: number }[] = [];
  for (const model of [AGENTS_PRIMARY_MODEL, AGENTS_FALLBACK_MODEL]) {
    try {
      if ((await reserveGlobalCall(env.DB)) !== 'ok') return stopped(429, 'daily_cap', { calls });
    } catch {
      return stopped(503, 'unavailable', { calls });
    }
    const which = model === AGENTS_PRIMARY_MODEL ? 'primary' : 'fallback';
    let out: unknown;
    try {
      out = await withDeadline(env.AI.run(model, { messages, max_tokens: INTAKE_MAX_TOKENS, temperature: 0.2 }), INTAKE_TIMEOUT_MS);
    } catch (err) {
      console.error('intake model failed', which, err instanceof Error ? err.message : err);
      continue;
    }
    const resp = out && typeof out === 'object' ? (out as Record<string, unknown>).response : undefined;
    const text = typeof resp === 'string' ? resp : resp && typeof resp === 'object' ? JSON.stringify(resp) : '';
    const usage = readUsage(out) ?? estimateUsage(inputChars, text.length);
    calls.push({ model: which, usage, cost_usd: Number(costUsd(usage).toFixed(6)) });
    const parsed = parseIntakeReply(text, intent, visitorText);
    if (!parsed.ok) {
      if (parsed.reason === 'rule') return stopped(200, 'rule', { calls });
      continue;
    }
    // The model may add or correct fields from the conversation; fields the visitor edited on the card stay as typed.
    const edited = Array.isArray(input.edited) ? input.edited.filter((k): k is string => typeof k === 'string').slice(0, 20) : [];
    const kept = Object.fromEntries(Object.entries(captured).filter(([k]) => edited.includes(k)));
    const merged = parsed.intent ? { ...captured, ...parsed.captured, ...kept } : {};
    const check = parsed.intent ? checkCaptured(parsed.intent, merged) : null;
    return json(200, {
      ok: true, reply: parsed.reply, intent: parsed.intent, extracted: parsed.captured, captured: merged,
      missing: check ? check.missing : [], ready: check ? check.ready : false, calls, latency_ms: Date.now() - t0,
    });
  }
  return stopped(503, 'ai_error', { calls });
}

async function submit(input: Record<string, unknown>, env: Env, ip: string, salt: string): Promise<Response> {
  if (isHoneypotFilled(input)) return json(200, { ok: true, id: null });
  if (!isIntent(input.intent)) return json(400, { ok: false, error: 'Please pick what you need first.' });
  if (input.consent !== true) return json(400, { ok: false, error: 'Please tick the box to agree before sending.' });
  const captured = sanitizeCaptured(input.intent, input.captured);
  const check = checkCaptured(input.intent, captured);
  if (!check.ready || !check.value) return json(400, { ok: false, error: 'Some details are missing or need a fix.', errors: check.errors, missing: check.missing });
  if (!env.DB) return json(500, { ok: false, error: 'Requests are not available right now. Please try again later.' });
  try {
    if (await isRateLimited(env.DB, ip, salt)) return json(429, { ok: false, error: 'Too many requests. Please try again in an hour.' }, { 'Retry-After': '3600' });
    const id = await saveRequest(env.DB, { ...check.value, details: { ...check.value.details, channel: 'intake agent', consent: 'yes' } });
    return json(200, { ok: true, id });
  } catch (err) {
    console.error('intake submit failed', err instanceof Error ? err.message : err);
    return json(500, { ok: false, error: 'Something went wrong on our side. Please try again later.' });
  }
}

export async function onRequest(): Promise<Response> {
  return json(405, { ok: false, error: 'Method not allowed.' }, { Allow: 'POST' });
}
