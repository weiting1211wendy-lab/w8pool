CREATE TABLE IF NOT EXISTS personal_activity_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  target_title TEXT,
  summary TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS pal_user_time_idx
  ON personal_activity_logs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS pal_user_type_time_idx
  ON personal_activity_logs(user_id, type, created_at DESC);
