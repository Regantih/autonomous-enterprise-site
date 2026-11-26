import { beforeEach, describe, expect, it } from 'vitest';
import { MAX_BODY_BYTES, RATE_LIMIT_MAX, onRequest, onRequestPost } from '../functions/api/request';
import { FakeD1 } from './fake-d1';

const URL_ = 'https://example.pages.dev/api/request';
const valid = {
  type: 'consultation',
  name: 'Sam Lee',
  email: 'sam@example.com',
  organization: 'Acme',
  goals: ['governance-guardrails'],
  message: 'Board wants a view on agent governance.',
};

let db: FakeD1;
const env = () => ({ DB: db as unknown as D1Database });

function post(body: string, headers: Record<string, string> = {}) {
  return new Request(URL_, {
    method: 'POST',
    body,
    headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.7', ...headers },
  });
}

async function call(req: Request) {
  const res = await onRequestPost({ request: req, env: env() });
  const ct = res.headers.get('content-type') ?? '';
  return { res, body: ct.includes('json') ? await res.json() : await res.text() };
}

beforeEach(() => {
  db = new FakeD1();
});

describe('POST /api/request', () => {
  it('stores a valid JSON submission with status new and returns its id', async () => {
    const { res, body } = await call(post(JSON.stringify(valid), { origin: 'https://example.pages.dev' }));
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ ok: true });
    expect(db.requests).toHaveLength(1);
    const row = db.requests[0];
    expect(row).toMatchObject({ id: (body as { id: string }).id, type: 'consultation', email: 'sam@example.com', role: null, status: 'new' });
    expect(JSON.parse(row.details as string)).toEqual({ goals: ['governance-guardrails'], message: valid.message });
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('accepts a form-encoded post and redirects to /thanks/', async () => {
    const form = new URLSearchParams({ type: 'consultation', name: 'Sam Lee', email: 'sam@example.com', organization: 'Acme' });
    form.append('goals', 'operating-model');
    form.append('goals', 'other');
    const { res } = await call(post(form.toString(), { 'content-type': 'application/x-www-form-urlencoded' }));
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/thanks/');
    expect(JSON.parse(db.requests[0].details as string).goals).toEqual(['operating-model', 'other']);
  });

  it('returns field errors and stores nothing for invalid input', async () => {
    const { res, body } = await call(post(JSON.stringify({ ...valid, email: 'nope' })));
    expect(res.status).toBe(400);
    expect(body).toMatchObject({ ok: false, errors: { email: 'Please enter a valid email address.' } });
    expect(db.requests).toHaveLength(0);
  });

  it('renders an escaped HTML error page for form posts without JS', async () => {
    const form = new URLSearchParams({ type: 'speaking', name: '<script>' });
    const { res, body } = await call(post(form.toString(), { 'content-type': 'application/x-www-form-urlencoded' }));
    expect(res.status).toBe(400);
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(body).toContain('Your request was not sent');
    expect(body).not.toContain('<script>');
  });

  it('pretends success for honeypot submissions without storing them', async () => {
    const { res, body } = await call(post(JSON.stringify({ ...valid, website: 'http://spam.example' })));
    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, id: null });
    expect(db.requests).toHaveLength(0);
    expect(db.rateLimits).toHaveLength(0);
  });

  it('rejects cross-origin posts', async () => {
    const { res } = await call(post(JSON.stringify(valid), { origin: 'https://evil.example' }));
    expect(res.status).toBe(403);
    expect(db.requests).toHaveLength(0);
  });

  it('rejects oversized bodies', async () => {
    const { res } = await call(post(JSON.stringify({ ...valid, message: 'x'.repeat(MAX_BODY_BYTES) })));
    expect(res.status).toBe(413);
  });

  it('rejects malformed JSON and unsupported content types', async () => {
    expect((await call(post('{oops'))).res.status).toBe(400);
    expect((await call(post('[1,2]'))).res.status).toBe(415);
    expect((await call(post('hi', { 'content-type': 'text/plain', accept: 'application/json' }))).res.status).toBe(415);
  });

  it(`rate-limits after ${RATE_LIMIT_MAX} submissions per IP per hour, without storing raw IPs`, async () => {
    for (let i = 0; i < RATE_LIMIT_MAX; i++) expect((await call(post(JSON.stringify(valid)))).res.status).toBe(200);
    const { res } = await call(post(JSON.stringify(valid)));
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('3600');
    expect(db.requests).toHaveLength(RATE_LIMIT_MAX);
    expect(db.rateLimits.every((r) => /^[0-9a-f]{64}$/.test(r.key) && !r.key.includes('203.0.113.7'))).toBe(true);

    const other = await call(post(JSON.stringify(valid), { 'cf-connecting-ip': '198.51.100.2' }));
    expect(other.res.status).toBe(200);
  });

  it('expires old rate-limit entries', async () => {
    db.rateLimits = Array.from({ length: RATE_LIMIT_MAX }, () => ({ key: 'old', created_at: Date.now() - 2 * 3600_000 }));
    expect((await call(post(JSON.stringify(valid)))).res.status).toBe(200);
    expect(db.rateLimits).toHaveLength(1);
  });

  it('returns a 500 with a generic message when the database fails', async () => {
    db.failInsert = true;
    const { res, body } = await call(post(JSON.stringify(valid)));
    expect(res.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain('D1_ERROR');
  });

  it('returns 405 for other methods', async () => {
    const res = await onRequest({ request: new Request(URL_), env: env() });
    expect(res.status).toBe(405);
    expect(res.headers.get('allow')).toBe('POST');
  });
});
