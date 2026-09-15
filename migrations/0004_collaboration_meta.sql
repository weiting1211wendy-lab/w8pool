CREATE TABLE IF NOT EXISTS job_copy_map (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  target_job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, source_job_id)
);

CREATE INDEX IF NOT EXISTS job_copy_map_user_idx ON job_copy_map(user_id);
CREATE INDEX IF NOT EXISTS job_copy_map_target_idx ON job_copy_map(target_job_id);

CREATE TABLE IF NOT EXISTS pool_views (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pool_id TEXT NOT NULL REFERENCES job_pools(id) ON DELETE CASCADE,
  last_seen_at TEXT NOT NULL,
  PRIMARY KEY (user_id, pool_id)
);
