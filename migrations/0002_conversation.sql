-- Allow 'conversation' leads from the Talk to the Book guide.
-- SQLite cannot alter a CHECK constraint, so the table is rebuilt and existing rows copied.
CREATE TABLE requests_new (
  id           TEXT PRIMARY KEY,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  type         TEXT NOT NULL CHECK (type IN ('speaking', 'consultation', 'media', 'conversation')),
  name         TEXT NOT NULL,
  email        TEXT NOT NULL,
  organization TEXT NOT NULL,
  role         TEXT,
  details      TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(details)),
  status       TEXT NOT NULL DEFAULT 'new'
);

INSERT INTO requests_new (id, created_at, type, name, email, organization, role, details, status)
  SELECT id, created_at, type, name, email, organization, role, details, status FROM requests;

DROP TABLE requests;
ALTER TABLE requests_new RENAME TO requests;

CREATE INDEX IF NOT EXISTS idx_requests_created_at ON requests (created_at);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests (status);
