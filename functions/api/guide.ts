import { costUsd, estimateUsage, readUsage } from '../../lib/agents';
import {
  FALLBACK_MODEL,
  GUIDE_RATE_LIMIT,
  LINKEDIN,
  MAX_TOKENS,
  MAX_TURNS,
  PRIMARY_MODEL,
  countUserTurns,
  sanitizeHistory,
  sanitizeProfile,
  shouldInvite,
} from '../../lib/guide';
import { runTurn, type CallRecord, type ModelCaller, type TurnStop } from '../../lib/guide-agent';
import { isRateLimited, isSameOrigin } from './request';

/**
 * "Talk to the book": an agent with tools. POST { action: "chat", messages, role?, maturity?, clarified? } -> JSON.
 * Free text works from the first message; role and maturity are optional context from the suggestion chips.
 * Each step of the loop is one real model call (lib/guide-agent.ts); code runs the tools (lib/guide-tools.ts).
 * Caps: every model call, tool steps and fallback calls included, counts against 30 per salted IP hash per hour;
 * 12 visitor messages per conversation. Nothing is stored except the rate-limit rows. The intake handoff only links
 * to the intake agent, which stores a request only after the visitor ticks consent and presses Send.
 * At a cap or a model failure the response says so plainly. There is no scripted reply.
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

export const MAX_GUIDE_BODY_BYTES = 32 * 1024;
export const GUIDE_TIMEOUT_MS = 20000;

export const GUIDE_STOP_MESSAGES: Record<TurnStop | 'turns' | 'unavailable', string> = {
  visitor_limit: `You have reached the guide\u2019s limit: ${GUIDE_RATE_LIMIT} model calls per hour per visitor.`,
  ai_error: 'The guide is offline: the model did not answer.',
  unavailable: 'The guide is offline: the model is not available right now.',
  rule: 'The guide\u2019s answer broke a site rule (a brand name, an email address or prompt text), so it was withheld. Please rephrase.',
  unreadable: 'The model did not reply in the format the guide needs, so there is no answer.',
  copied: 'The guide\u2019s answer copied its own instructions instead of answering, so it was withheld. Please ask again in other words.',
  ungrounded: 'The guide could not back its answer with passages from the book, so it was withheld. Please ask a narrower question.',
  steps: 'The guide used its tool steps without reaching an answer. Please ask a narrower question.',
  turns: `That is the most one conversation can take (${MAX_TURNS} messages). Start over, or reach Hemanth directly.`,
};

function json(status: number, body: unknown, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra },
  });
}

function stopped(status: number, reason: keyof typeof GUIDE_STOP_MESSAGES, extra: Record<string, unknown> = {}) {
  const retry = reason === 'visitor_limit' ? { retry_at: Date.now() + 3600_000 } : {};
  return json(status, { ok: false, reason, message: GUIDE_STOP_MESSAGES[reason], linkedin: LINKEDIN, actions: true, ...retry, ...extra },
    reason === 'visitor_limit' ? { 'Retry-After': '3600' } : {});
}

class Timeout extends Error {}
function withDeadline<T>(p: Promise<T>, ms: number): Promise<T> {
  let t: ReturnType<typeof setTimeout>;
  return Promise.race([p, new Promise<T>((_, rej) => { t = setTimeout(() => rej(new Timeout('deadline')), ms); })]).finally(() => clearTimeout(t));
}

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  if (!(request.headers.get('content-type') ?? '').includes('application/json')) return null;
  const buf = await request.arrayBuffer();
  if (buf.byteLength > MAX_GUIDE_BODY_BYTES) throw new RangeError('too large');
  const v = JSON.parse(new TextDecoder().decode(buf));
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

export async function onRequestPost({ request, env }: Ctx): Promise<Response> {
  if (!isSameOrigin(request)) return json(403, { ok: false, error: 'Requests must come from this site.' });
  if (Number(request.headers.get('content-length') ?? '0') > MAX_GUIDE_BODY_BYTES) return json(413, { ok: false, error: 'Too long.' });

  let input: Record<string, unknown> | null;
  try {
    input = await readJson(request);
  } catch (err) {
    return json(err instanceof RangeError ? 413 : 400, { ok: false, error: 'We could not read your request.' });
  }
  if (!input) return json(415, { ok: false, error: 'Unsupported request format.' });
  if (input.action !== 'chat') return json(400, { ok: false, error: 'Unknown action.' });

  const profile = sanitizeProfile(input);
  const history = sanitizeHistory(input.messages);
  if (!history.length || history[history.length - 1].role !== 'user') return json(400, { ok: false, error: 'Please ask a question.' });
  if (countUserTurns(history) > MAX_TURNS) return stopped(200, 'turns', { done: true });
  if (!env.AI || !env.DB) return stopped(503, 'unavailable');

  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
  const salt = env.RATE_LIMIT_SALT ?? 'autonomous-enterprise';
  const calls: CallRecord[] = [];
  const t0 = Date.now();

  const caller: ModelCaller = async (messages, which, step) => {
    try {
      if (await isRateLimited(env.DB, ip, salt, Date.now(), { bucket: 'guide', max: GUIDE_RATE_LIMIT })) return { ok: false, stop: 'visitor_limit' };
    } catch (err) {
      console.error('guide limit check failed', err instanceof Error ? err.message : err);
      return { ok: false, stop: 'ai_error' };
    }
    const model = which === 'primary' ? PRIMARY_MODEL : FALLBACK_MODEL;
    const inputChars = messages.reduce((n, m) => n + m.content.length, 0);
    try {
      const out = await withDeadline(env.AI.run(model, { messages, max_tokens: MAX_TOKENS, temperature: 0.2 }), GUIDE_TIMEOUT_MS);
      const resp = out && typeof out === 'object' ? (out as Record<string, unknown>).response : undefined;
      const text = typeof resp === 'string' ? resp : resp && typeof resp === 'object' ? JSON.stringify(resp) : '';
      const usage = readUsage(out) ?? estimateUsage(inputChars, text.length);
      calls.push({ step, model: which, usage, cost_usd: Number(costUsd(usage).toFixed(6)) });
      if (!text.trim()) return { ok: false, stop: 'ai_error' };
      return { ok: true, text };
    } catch (err) {
      console.error('guide model failed', which, err instanceof Error ? err.message : err);
      return { ok: false, stop: 'ai_error' };
    }
  };

  const invite = shouldInvite(history);
  const done = countUserTurns(history) >= MAX_TURNS;
  const result = await runTurn(profile, history, caller, { invite, clarified: input.clarified === true });
  const meta = { trace: result.trace, pages: result.pages, handoff: result.handoff, calls, steps: result.steps, latency_ms: Date.now() - t0, done };
  if (!result.ok) {
    const reason = result.stop ?? 'ai_error';
    return stopped(reason === 'visitor_limit' ? 429 : reason === 'ai_error' ? 503 : 200, reason, meta);
  }
  return json(200, {
    ok: true,
    reply: result.reply,
    cites: result.cites,
    not_covered: result.notCovered,
    clarify: result.clarify,
    actions: invite || !!result.handoff,
    ...meta,
  });
}

export async function onRequest(): Promise<Response> {
  return json(405, { ok: false, error: 'Method not allowed.' }, { Allow: 'POST' });
}
