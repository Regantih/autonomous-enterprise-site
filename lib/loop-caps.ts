import { dayKey, nextUtcMidnight } from './agents';

/**
 * Cost caps for the real improvement loop, kept in the existing rate_limits table (no schema change).
 *   loop:runs:<sha256(salt:loop:ip)>   one row per run started, created_at = now (2 per visitor per hour)
 *   loop:calls:<runId>                 one row per model call in a run, created_at = now (10 per run)
 *   agents:global:YYYY-MM-DD           one row per model call site-wide, shared with /api/agents,
 *                                      created_at = next UTC midnight (120 per UTC day)
 * The shared cleanup deletes rows with created_at older than one hour.
 */
export const LOOP_RUNS_PER_HOUR = 2;
export const LOOP_CALLS_PER_RUN = 10;
export const GLOBAL_DAILY_CALLS = 120;
export const RUN_TTL_MS = 55 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

async function sha256Hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function count(db: D1Database, key: string, since: number): Promise<number> {
  const r = await db.prepare('SELECT COUNT(*) AS n FROM rate_limits WHERE key = ? AND created_at >= ?').bind(key, since).first<{ n: number }>();
  return r?.n ?? 0;
}
const insert = (db: D1Database, key: string, at: number) => db.prepare('INSERT INTO rate_limits (key, created_at) VALUES (?, ?)').bind(key, at).run();
const cleanup = (db: D1Database, now: number) => db.prepare('DELETE FROM rate_limits WHERE created_at < ?').bind(now - HOUR).run();

/** Starts a run if the visitor has runs left this hour and the site has model calls left today. */
export async function startRun(db: D1Database, ip: string, salt: string, now = Date.now()): Promise<'ok' | 'visitor_runs' | 'daily_cap'> {
  await cleanup(db, now);
  const key = `loop:runs:${await sha256Hex(`${salt}:loop:${ip}`)}`;
  if ((await count(db, key, now - HOUR)) >= LOOP_RUNS_PER_HOUR) return 'visitor_runs';
  if ((await count(db, dayKey(now), 0)) >= GLOBAL_DAILY_CALLS) return 'daily_cap';
  await insert(db, key, now);
  return 'ok';
}

export async function callsLeft(db: D1Database, runId: string, now = Date.now()): Promise<{ run: number; global: number }> {
  await cleanup(db, now);
  return {
    run: LOOP_CALLS_PER_RUN - (await count(db, `loop:calls:${runId}`, now - HOUR)),
    global: GLOBAL_DAILY_CALLS - (await count(db, dayKey(now), 0)),
  };
}

/** Reserves one model call against the run cap and the site-wide daily cap. */
export async function reserveCall(db: D1Database, runId: string, now = Date.now()): Promise<'ok' | 'run_cap' | 'daily_cap'> {
  const left = await callsLeft(db, runId, now);
  if (left.run <= 0) return 'run_cap';
  if (left.global <= 0) return 'daily_cap';
  await insert(db, `loop:calls:${runId}`, now);
  await insert(db, dayKey(now), nextUtcMidnight(now));
  return 'ok';
}

// ---------- run tokens ----------

/** A run id the server can check without storing it: issued time, random part and a salted signature. */
export async function issueRun(salt: string, now = Date.now()): Promise<string> {
  const rand = [...crypto.getRandomValues(new Uint8Array(8))].map((b) => b.toString(16).padStart(2, '0')).join('');
  const body = `${now.toString(36)}.${rand}`;
  return `${body}.${(await sha256Hex(`${salt}:run:${body}`)).slice(0, 24)}`;
}

export async function checkRun(token: unknown, salt: string, now = Date.now()): Promise<'ok' | 'invalid' | 'expired'> {
  if (typeof token !== 'string' || !/^[0-9a-z]{6,12}\.[0-9a-f]{16}\.[0-9a-f]{24}$/.test(token)) return 'invalid';
  const [t, rand, sig] = token.split('.');
  if ((await sha256Hex(`${salt}:run:${t}.${rand}`)).slice(0, 24) !== sig) return 'invalid';
  const issued = parseInt(t, 36);
  if (!Number.isFinite(issued) || issued > now + 60_000) return 'invalid';
  return now - issued > RUN_TTL_MS ? 'expired' : 'ok';
}

// ---------- shared helpers for other agents on the same budget (graph agent, intake agent) ----------

/**
 * Counts one question for a visitor in its own bucket (one row per question, created_at = now) and checks the
 * site-wide daily budget. Rows: '<bucket>:<sha256(salt:bucket:ip)>'. The model calls themselves are reserved with
 * reserveGlobalCall, one row each, in the same 'agents:global:YYYY-MM-DD' key /api/agents and /api/loop/step use.
 */
export async function startVisitorTurn(db: D1Database, bucket: string, ip: string, salt: string, perHour: number, now = Date.now()): Promise<'ok' | 'visitor_limit' | 'daily_cap'> {
  await cleanup(db, now);
  const key = `${bucket}:${await sha256Hex(`${salt}:${bucket}:${ip}`)}`;
  if ((await count(db, key, now - HOUR)) >= perHour) return 'visitor_limit';
  if ((await count(db, dayKey(now), 0)) >= GLOBAL_DAILY_CALLS) return 'daily_cap';
  await insert(db, key, now);
  return 'ok';
}

/** Reserves one model call against the site-wide daily budget only. */
export async function reserveGlobalCall(db: D1Database, now = Date.now()): Promise<'ok' | 'daily_cap'> {
  if ((await count(db, dayKey(now), 0)) >= GLOBAL_DAILY_CALLS) return 'daily_cap';
  await insert(db, dayKey(now), nextUtcMidnight(now));
  return 'ok';
}
