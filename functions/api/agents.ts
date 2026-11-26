import {
  AGENTS_DAILY_LIMIT,
  AGENTS_FALLBACK_MODEL,
  AGENTS_MAX_TOKENS,
  AGENTS_PRIMARY_MODEL,
  AGENTS_VISITOR_LIMIT,
  FIRST_TOKEN_TIMEOUT_MS,
  MAX_AGENTS_BODY_BYTES,
  TOTAL_TIMEOUT_MS,
  TurnStreamer,
  buildAgentsMessages,
  dayKey,
  estimateUsage,
  nextUtcMidnight,
  readUsage,
  sanitizeState,
  validateInstruction,
  type Usage,
} from '../../lib/agents';
import { RATE_LIMIT_WINDOW_MS, isSameOrigin, sha256Hex } from './request';

/**
 * Live AI agents for the operations room on /blueprints/loops/.
 * POST { instruction, state } -> NDJSON stream:
 *   {"delta":{"agent":"proposer","text":"..."}}   token-by-token text of the current turn
 *   {"agent":"Proposer","id":"proposer","text":"..."}   a finished turn (2 to 4 per reply)
 *   {"action":{"type":"propose_variant|tighten_guardrail|request_decision|reframe_goal|none"}}   optional
 *   {"usage":{"input_tokens":N,"output_tokens":N,"estimated":false,"model":"..."}}   always last on success
 *   {"error":"...","fallback":true}   the client shows the scripted reply instead
 * Caps, rate limits, AI errors and timeouts answer JSON { ok:false, fallback:true, reason } before any stream starts.
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

const BASE_HEADERS = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };

function json(status: number, body: unknown, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...BASE_HEADERS, ...extra } });
}

export type FallbackReason = 'visitor_limit' | 'daily_cap' | 'ai_error' | 'timeout' | 'unavailable';
const fallback = (status: number, reason: FallbackReason, extra: Record<string, string> = {}) =>
  json(status, { ok: false, fallback: true, reason, note: 'Live agents are resting; showing the simulated run.' }, extra);

/**
 * Per-visitor limit (8 live turns per hour) and global daily cap (60 per UTC day), both in rate_limits.
 * Visitor rows: key 'agents:<sha256(salt:agents:ip)>', created_at = now, so the shared one-hour cleanup clears them.
 * Global rows: key 'agents:global:YYYY-MM-DD', created_at = next UTC midnight, so the same cleanup
 * (which deletes created_at < now - 1h) keeps them for the whole day and clears them an hour after it ends.
 */
export async function checkAgentLimits(db: D1Database, ip: string, salt: string, now = Date.now()): Promise<'ok' | 'visitor_limit' | 'daily_cap'> {
  const visitorKey = `agents:${await sha256Hex(`${salt}:agents:${ip}`)}`;
  const since = now - RATE_LIMIT_WINDOW_MS;
  await db.prepare('DELETE FROM rate_limits WHERE created_at < ?').bind(since).run();
  const mine = await db.prepare('SELECT COUNT(*) AS n FROM rate_limits WHERE key = ? AND created_at >= ?').bind(visitorKey, since).first<{ n: number }>();
  if ((mine?.n ?? 0) >= AGENTS_VISITOR_LIMIT) return 'visitor_limit';
  const day = dayKey(now);
  const all = await db.prepare('SELECT COUNT(*) AS n FROM rate_limits WHERE key = ? AND created_at >= ?').bind(day, 0).first<{ n: number }>();
  if ((all?.n ?? 0) >= AGENTS_DAILY_LIMIT) return 'daily_cap';
  await db.prepare('INSERT INTO rate_limits (key, created_at) VALUES (?, ?)').bind(visitorKey, now).run();
  await db.prepare('INSERT INTO rate_limits (key, created_at) VALUES (?, ?)').bind(day, nextUtcMidnight(now)).run();
  return 'ok';
}

class Timeout extends Error {}
function withDeadline<T>(p: Promise<T>, deadline: number): Promise<T> {
  const ms = deadline - Date.now();
  if (ms <= 0) return Promise.reject(new Timeout('deadline'));
  let t: ReturnType<typeof setTimeout>;
  return Promise.race([p, new Promise<T>((_, rej) => { t = setTimeout(() => rej(new Timeout('deadline')), ms); })]).finally(() => clearTimeout(t));
}

/** Splits a Workers AI SSE byte stream into parsed data payloads. */
export class SseReader {
  private buf = '';
  private dec = new TextDecoder();
  push(chunk: Uint8Array | string): unknown[] {
    this.buf += typeof chunk === 'string' ? chunk : this.dec.decode(chunk, { stream: true });
    const out: unknown[] = [];
    let i: number;
    while ((i = this.buf.indexOf('\n')) >= 0) {
      const line = this.buf.slice(0, i).trim();
      this.buf = this.buf.slice(i + 1);
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      try { out.push(JSON.parse(data)); } catch { /* partial or junk line */ }
    }
    return out;
  }
}

type Started = { model: string; reader: ReadableStreamDefaultReader<Uint8Array>; first: ReadableStreamReadResult<Uint8Array> };

/** Starts the primary model, then the fallback model on an error, all within the first-token deadline. */
async function startModel(ai: AiBinding, messages: unknown[], deadline: number): Promise<Started> {
  let lastErr: unknown = new Error('no model');
  for (const model of [AGENTS_PRIMARY_MODEL, AGENTS_FALLBACK_MODEL]) {
    try {
      const out = await withDeadline(ai.run(model, { messages, max_tokens: AGENTS_MAX_TOKENS, temperature: 0.4, stream: true }), deadline);
      if (!(out instanceof ReadableStream)) throw new Error('model did not stream');
      const reader = (out as ReadableStream<Uint8Array>).getReader();
      const first = await withDeadline(reader.read(), deadline).catch((err) => { reader.cancel().catch(() => {}); throw err; });
      return { model, reader, first };
    } catch (err) {
      lastErr = err;
      if (err instanceof Timeout) throw err;
      console.error('agents model failed', model, err instanceof Error ? err.message : err);
    }
  }
  throw lastErr;
}

export async function onRequestPost({ request, env, waitUntil }: Ctx): Promise<Response> {
  if (!isSameOrigin(request)) return json(403, { ok: false, error: 'Requests must come from this site.' });
  if (Number(request.headers.get('content-length') ?? '0') > MAX_AGENTS_BODY_BYTES) return json(413, { ok: false, error: 'Too long.' });
  if (!(request.headers.get('content-type') ?? '').includes('application/json')) return json(415, { ok: false, error: 'Unsupported request format.' });

  let input: Record<string, unknown>;
  try {
    const buf = await request.arrayBuffer();
    if (buf.byteLength > MAX_AGENTS_BODY_BYTES) return json(413, { ok: false, error: 'Too long.' });
    const v = JSON.parse(new TextDecoder().decode(buf));
    if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('not an object');
    input = v as Record<string, unknown>;
  } catch {
    return json(400, { ok: false, error: 'We could not read your request.' });
  }

  const instr = validateInstruction(input.instruction);
  if (!instr.ok) return json(400, { ok: false, error: instr.error });
  const state = sanitizeState(input.state);
  if (!env.AI || !env.DB) return fallback(503, 'unavailable');

  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
  try {
    const limit = await checkAgentLimits(env.DB, ip, env.RATE_LIMIT_SALT ?? 'autonomous-enterprise');
    if (limit !== 'ok') return fallback(429, limit, { 'Retry-After': limit === 'visitor_limit' ? '3600' : String(Math.ceil((nextUtcMidnight(Date.now()) - Date.now()) / 1000)) });
  } catch (err) {
    console.error('agents limit check failed', err instanceof Error ? err.message : err);
    return fallback(503, 'unavailable');
  }

  const messages = buildAgentsMessages(instr.value, state);
  const inputChars = messages.reduce((n, m) => n + m.content.length, 0);
  const t0 = Date.now();
  let started: Started;
  try {
    started = await startModel(env.AI, messages, t0 + FIRST_TOKEN_TIMEOUT_MS);
  } catch (err) {
    const timeout = err instanceof Timeout;
    console.error('agents start failed', timeout ? 'timeout' : err instanceof Error ? err.message : err);
    return fallback(503, timeout ? 'timeout' : 'ai_error');
  }

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  const enc = new TextEncoder();
  const send = (o: unknown) => writer.write(enc.encode(JSON.stringify(o) + '\n'));

  const pump = async () => {
    const sse = new SseReader();
    const turns = new TurnStreamer();
    let usage: Usage | null = null;
    let failed = false;
    const handle = async (chunk: Uint8Array) => {
      for (const data of sse.push(chunk)) {
        const u = readUsage(data);
        if (u) usage = u;
        const piece = data && typeof data === 'object' ? (data as Record<string, unknown>).response : undefined;
        if (typeof piece === 'string' && piece) for (const ev of turns.feed(piece)) await send(ev);
        if (turns.violated) return;
      }
    };
    try {
      let r = started.first;
      const deadline = t0 + TOTAL_TIMEOUT_MS;
      while (!r.done) {
        await handle(r.value);
        if (turns.violated) break;
        r = await withDeadline(started.reader.read(), deadline);
      }
      if (!turns.violated) for (const ev of turns.end()) await send(ev);
      if (turns.violated) failed = true;
      else if (!turns.turnCount) { failed = true; await send({ error: 'empty', fallback: true }); }
    } catch (err) {
      failed = true;
      console.error('agents stream failed', err instanceof Error ? err.message : err);
      await send({ error: err instanceof Timeout ? 'timeout' : 'ai_error', fallback: true }).catch(() => {});
    } finally {
      started.reader.cancel().catch(() => {});
      const u: Usage = usage ?? estimateUsage(inputChars, turns.outputChars);
      await send({ usage: { ...u, model: started.model, ok: !failed } }).catch(() => {});
      await writer.close().catch(() => {});
    }
  };
  const p = pump();
  // Keep the pump alive after the response is returned.
  if (waitUntil) waitUntil(p);

  return new Response(readable, {
    status: 200,
    headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', ...BASE_HEADERS, 'X-Accel-Buffering': 'no' },
  });
}

export async function onRequest(): Promise<Response> {
  return json(405, { ok: false, error: 'Method not allowed.' }, { Allow: 'POST' });
}
