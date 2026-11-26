import {
  FALLBACK_MODEL,
  FALLBACK_REPLY,
  GUIDE_RATE_LIMIT,
  LIMIT_REPLY,
  MAX_TOKENS,
  MAX_TURNS,
  PRIMARY_MODEL,
  REPLY_WORD_LIMIT,
  SUMMARY_WORD_LIMIT,
  buildMessages,
  buildSummaryMessages,
  clampWords,
  countUserTurns,
  isValidProfile,
  sanitizeHistory,
  shouldInvite,
  violatesRules,
  type Profile,
} from '../../lib/guide';
import { isHoneypotFilled, maturityLabel, validateConversationLead } from '../../lib/validate';
import { isRateLimited, isSameOrigin, saveRequest } from './request';

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

function json(status: number, body: unknown, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra },
  });
}

const fallback = (status = 503, reply = FALLBACK_REPLY) => json(status, { ok: false, fallback: true, reply, actions: true });

/** Runs the primary model, then the fallback model on any error or empty answer. */
export async function runModel(ai: AiBinding, messages: unknown[], maxTokens = MAX_TOKENS): Promise<string> {
  let lastErr: unknown = new Error('empty response');
  for (const model of [PRIMARY_MODEL, FALLBACK_MODEL]) {
    try {
      const out = (await ai.run(model, { messages, max_tokens: maxTokens, temperature: 0.3 })) as { response?: unknown };
      const text = typeof out?.response === 'string' ? out.response.trim() : '';
      if (text) return text;
    } catch (err) {
      lastErr = err;
      console.error('guide model failed', model, err instanceof Error ? err.message : err);
    }
  }
  throw lastErr;
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

  const profile: Profile = { role: String(input.role ?? ''), maturity: String(input.maturity ?? '') };
  const history = sanitizeHistory(input.messages);
  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
  const salt = env.RATE_LIMIT_SALT ?? 'autonomous-enterprise';

  if (input.action === 'lead') return handleLead(input, profile, history, env, ip, salt);
  if (input.action !== 'chat') return json(400, { ok: false, error: 'Unknown action.' });

  if (!isValidProfile(profile)) return json(400, { ok: false, error: 'Please choose your role and where your agents are today.' });
  if (!history.length || history[history.length - 1].role !== 'user') return json(400, { ok: false, error: 'Please ask a question.' });
  if (countUserTurns(history) > MAX_TURNS) return json(200, { ok: true, reply: LIMIT_REPLY, actions: true, done: true });
  if (!env.AI || !env.DB) return fallback();

  try {
    if (await isRateLimited(env.DB, ip, salt, Date.now(), { bucket: 'guide', max: GUIDE_RATE_LIMIT })) {
      return fallback(429, 'You have reached the guide\'s limit for this hour. The book and Hemanth can take it from here.');
    }
    const invite = shouldInvite(history);
    const raw = await runModel(env.AI, buildMessages(profile, history, { invite }));
    if (violatesRules(raw)) return json(200, { ok: true, reply: FALLBACK_REPLY, actions: true });
    return json(200, { ok: true, reply: clampWords(raw, REPLY_WORD_LIMIT), actions: invite, done: countUserTurns(history) >= MAX_TURNS });
  } catch (err) {
    console.error('guide failed', err instanceof Error ? err.message : err);
    return fallback();
  }
}

async function handleLead(input: Record<string, unknown>, profile: Profile, history: ReturnType<typeof sanitizeHistory>, env: Env, ip: string, salt: string) {
  if (isHoneypotFilled(input)) return json(200, { ok: true, id: null });
  const result = validateConversationLead(input);
  if (!result.ok) return json(400, { ok: false, error: 'Please check the highlighted fields.', errors: result.errors });
  if (!env.DB) return json(500, { ok: false, error: 'Requests are not available right now. Please try again later.' });
  const lead = result.value;

  try {
    if (await isRateLimited(env.DB, ip, salt)) {
      return json(429, { ok: false, error: 'Too many requests. Please try again in an hour.' }, { 'Retry-After': '3600' });
    }
    // The chat is only summarised, and the summary only stored, with the visitor's consent.
    let summary = '';
    if (lead.consent && history.length && env.AI) {
      try {
        summary = clampWords(await runModel(env.AI, buildSummaryMessages(profile, history), 220), SUMMARY_WORD_LIMIT);
        if (violatesRules(summary)) summary = '';
      } catch {
        summary = '';
      }
    }
    const id = await saveRequest(env.DB, {
      type: 'conversation',
      name: lead.name,
      email: lead.email,
      organization: lead.organization,
      role: lead.role || null,
      details: { role: lead.role, maturity: maturityLabel(lead.maturity) || lead.maturity, goal: lead.goal, summary },
    });
    return json(200, { ok: true, id });
  } catch (err) {
    console.error('conversation lead failed', err instanceof Error ? err.message : err);
    return json(500, { ok: false, error: 'Something went wrong on our side. Please try again later.' });
  }
}

export async function onRequest(): Promise<Response> {
  return json(405, { ok: false, error: 'Method not allowed.' }, { Allow: 'POST' });
}
