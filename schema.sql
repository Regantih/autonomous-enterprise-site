-- Speaking, advisory ('consultation') and media requests submitted from the site.
-- For media requests, `organization` holds the outlet.
CREATE TABLE IF NOT EXISTS requests (
  id           TEXT PRIMARY KEY,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  type         TEXT NOT NULL CHECK (type IN ('speaking', 'consultation', 'media')),
  name         TEXT NOT NULL,
  email        TEXT NOT NULL,
  organization TEXT NOT NULL,
  role         TEXT,
  details      TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(details)),
  status       TEXT NOT NULL DEFAULT 'new'
);

CREATE INDEX IF NOT EXISTS idx_requests_created_at ON requests (created_at);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests (status);

-- Short-lived rate-limit log. Stores a salted SHA-256 of the client IP, never the raw IP.
-- Rows older than one hour are deleted on each submission.
CREATE TABLE IF NOT EXISTS rate_limits (
  key        TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_key_time ON rate_limits (key, created_at);
