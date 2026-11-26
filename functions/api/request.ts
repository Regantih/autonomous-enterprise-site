import { isHoneypotFilled, validateRequest, type ValidRequest } from '../../lib/validate';

export interface Env {
  DB: D1Database;
  /** Optional secret mixed into the IP hash used for rate limiting. */
  RATE_LIMIT_SALT?: string;
}

export const MAX_BODY_BYTES = 16 * 1024;
export const RATE_LIMIT_MAX = 5;
export const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

type Ctx = { request: Request; env: Env };

const SECURITY_HEADERS = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

function wantsHtml(request: Request): boolean {
  const ct = request.headers.get('content-type') ?? '';
  const accept = request.headers.get('accept') ?? '';
  return !ct.includes('application/json') && !accept.includes('application/json');
}

function json(status: number, body: unknown, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...SECURITY_HEADERS, ...extra },
  });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
}

function htmlError(status: number, message: string, errors: Record<string, string> = {}): Response {
  const items = Object.values(errors)
    .map((e) => `<li>${escapeHtml(e)}</li>`)
    .join('');
  const body = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Request not sent | The Autonomous Enterprise</title><link rel="stylesheet" href="/assets/styles.css"></head><body><main id="main" class="section"><div class="container narrow"><h1 class="h2">Your request was not sent</h1><p>${escapeHtml(message)}</p>${items ? `<ul class="error-list">${items}</ul>` : ''}<p>Use your browser&rsquo;s back button to fix it, or <a href="/contact/">start again on the contact page</a>.</p></div></main></body></html>`;
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', ...SECURITY_HEADERS },
  });
}

function fail(request: Request, status: number, message: string, errors?: Record<string, string>, extra?: Record<string, string>) {
  return wantsHtml(request)
    ? htmlError(status, message, errors)
    : json(status, { ok: false, error: message, ...(errors ? { errors } : {}) }, extra);
}

function succeed(request: Request, id: string | null): Response {
  if (wantsHtml(request)) {
    return new Response(null, { status: 303, headers: { Location: '/thanks/', ...SECURITY_HEADERS } });
  }
  return json(200, { ok: true, id });
}

async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) throw new RangeError('too large');
  const ct = request.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  }
  if (ct.includes('application/x-www-form-urlencoded')) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of new URLSearchParams(raw)) {
      const prev = out[k];
      out[k] = prev === undefined ? v : Array.isArray(prev) ? [...prev, v] : [prev, v];
    }
    return out;
  }
  return null;
}

async function sha256Hex(s: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Returns true if the caller is over the limit; otherwise records this attempt. */
export async function isRateLimited(db: D1Database, ip: string, salt: string, now = Date.now()): Promise<boolean> {
  const key = await sha256Hex(`${salt}:${ip}`);
  const since = now - RATE_LIMIT_WINDOW_MS;
  await db.prepare('DELETE FROM rate_limits WHERE created_at < ?').bind(since).run();
  const row = await db
    .prepare('SELECT COUNT(*) AS n FROM rate_limits WHERE key = ? AND created_at >= ?')
    .bind(key, since)
    .first<{ n: number }>();
  if ((row?.n ?? 0) >= RATE_LIMIT_MAX) return true;
  await db.prepare('INSERT INTO rate_limits (key, created_at) VALUES (?, ?)').bind(key, now).run();
  return false;
}

export async function saveRequest(db: D1Database, req: ValidRequest): Promise<string> {
  const id = crypto.randomUUID();
  await db
    .prepare(
      'INSERT INTO requests (id, created_at, type, name, email, organization, role, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .bind(id, new Date().toISOString(), req.type, req.name, req.email, req.organization, req.role, JSON.stringify(req.details))
    .run();
  return id;
}

export async function onRequestPost({ request, env }: Ctx): Promise<Response> {
  const url = new URL(request.url);
  const origin = request.headers.get('origin');
  if (origin && origin !== 'null') {
    let host = '';
    try {
      host = new URL(origin).host;
    } catch {
      /* invalid origin */
    }
    if (host !== url.host) return fail(request, 403, 'Requests must come from this site.');
  }

  const declared = Number(request.headers.get('content-length') ?? '0');
  if (declared > MAX_BODY_BYTES) return fail(request, 413, 'Your message is too long.');

  let input: Record<string, unknown> | null;
  try {
    input = await readBody(request);
  } catch (err) {
    if (err instanceof RangeError) return fail(request, 413, 'Your message is too long.');
    return fail(request, 400, 'We could not read your request.');
  }
  if (!input) return fail(request, 415, 'Unsupported request format.');

  // Bots that fill the hidden field get a normal-looking success and nothing is stored.
  if (isHoneypotFilled(input)) return succeed(request, null);

  const result = validateRequest(input);
  if (!result.ok) return fail(request, 400, 'Please check the highlighted fields.', result.errors);

  if (!env.DB) return fail(request, 500, 'Requests are not available right now. Please try again later.');

  try {
    const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
    if (await isRateLimited(env.DB, ip, env.RATE_LIMIT_SALT ?? 'autonomous-enterprise')) {
      return fail(request, 429, 'Too many requests. Please try again in an hour.', undefined, { 'Retry-After': '3600' });
    }
    const id = await saveRequest(env.DB, result.value);
    return succeed(request, id);
  } catch (err) {
    console.error('request submission failed', err instanceof Error ? err.message : err);
    return fail(request, 500, 'Something went wrong on our side. Please try again later.');
  }
}

export async function onRequest({ request }: Ctx): Promise<Response> {
  return json(405, { ok: false, error: 'Method not allowed.' }, { Allow: 'POST' });
}
