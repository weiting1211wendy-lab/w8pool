-- 账户工作台的私有文档：任务、便签、网申材料、动态、标签和个人偏好均以账户为边界保存。
CREATE TABLE IF NOT EXISTS workspace_documents (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_key TEXT NOT NULL,
  data_json TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, document_key)
);

CREATE TABLE IF NOT EXISTS workspace_document_versions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_key TEXT NOT NULL,
  revision INTEGER NOT NULL,
  data_json TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT 'update',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS workspace_document_versions_lookup
  ON workspace_document_versions(user_id, document_key, created_at DESC);

CREATE TABLE IF NOT EXISTS account_snapshots (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS account_snapshots_lookup
  ON account_snapshots(user_id, created_at DESC);

ALTER TABLE user_job_states ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
