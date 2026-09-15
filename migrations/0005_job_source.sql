ALTER TABLE jobs ADD COLUMN added_at TEXT;
ALTER TABLE jobs ADD COLUMN added_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE jobs ADD COLUMN source_pool_id TEXT;
ALTER TABLE jobs ADD COLUMN source_job_id TEXT;

CREATE TABLE IF NOT EXISTS collaboration_activities (
  id TEXT PRIMARY KEY,
  pool_id TEXT NOT NULL REFERENCES job_pools(id) ON DELETE CASCADE,
  actor_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  affected_job_count INTEGER NOT NULL DEFAULT 0,
  affected_job_ids TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS collaboration_activities_pool_idx ON collaboration_activities(pool_id);

CREATE TABLE IF NOT EXISTS user_job_copies (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_group_job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  source_pool_id TEXT NOT NULL,
  personal_job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  copied_at TEXT NOT NULL,
  PRIMARY KEY (user_id, source_group_job_id)
);

CREATE INDEX IF NOT EXISTS user_job_copies_personal_idx ON user_job_copies(personal_job_id);
