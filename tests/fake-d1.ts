/** Minimal in-memory stand-in for the D1 statements used by functions/api/request.ts. */
export class FakeD1 {
  requests: Record<string, unknown>[] = [];
  rateLimits: { key: string; created_at: number }[] = [];
  failInsert = false;

  prepare(sql: string) {
    const db = this;
    let args: unknown[] = [];
    const stmt = {
      bind(...a: unknown[]) {
        args = a;
        return stmt;
      },
      async run() {
        if (sql.startsWith('DELETE FROM rate_limits')) {
          db.rateLimits = db.rateLimits.filter((r) => r.created_at >= (args[0] as number));
        } else if (sql.startsWith('INSERT INTO rate_limits')) {
          db.rateLimits.push({ key: args[0] as string, created_at: args[1] as number });
        } else if (sql.startsWith('INSERT INTO requests')) {
          if (db.failInsert) throw new Error('D1_ERROR: boom');
          const [id, created_at, type, name, email, organization, role, details] = args;
          db.requests.push({ id, created_at, type, name, email, organization, role, details, status: 'new' });
        } else throw new Error(`Unexpected SQL: ${sql}`);
        return { success: true };
      },
      async first() {
        if (!sql.startsWith('SELECT COUNT(*)')) throw new Error(`Unexpected SQL: ${sql}`);
        const [key, since] = args as [string, number];
        return { n: db.rateLimits.filter((r) => r.key === key && r.created_at >= since).length };
      },
    };
    return stmt;
  }
}
