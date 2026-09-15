CREATE TABLE IF NOT EXISTS registration_invites (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  used_at TEXT,
  used_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS registration_invites_available_idx
  ON registration_invites(used_at);
