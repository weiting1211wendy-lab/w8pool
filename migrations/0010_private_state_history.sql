-- 私有岗位状态在每次变更前保留版本，供账户回滚与人工恢复使用。
CREATE TABLE IF NOT EXISTS user_job_state_versions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL,
  screening_status TEXT NOT NULL,
  application_status TEXT NOT NULL,
  priority INTEGER NOT NULL,
  applied_at TEXT NOT NULL,
  personal_notes TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS user_job_state_versions_lookup
  ON user_job_state_versions(user_id, job_id, created_at DESC);
