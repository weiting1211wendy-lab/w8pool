CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);

CREATE TABLE IF NOT EXISTS job_pools (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('personal', 'group')),
  owner_user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  group_id TEXT,
  next_job_no INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (
    (kind = 'personal' AND owner_user_id IS NOT NULL AND group_id IS NULL) OR
    (kind = 'group' AND owner_user_id IS NULL AND group_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS personal_pool_owner_idx
  ON job_pools(owner_user_id) WHERE kind = 'personal';

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  pool_id TEXT NOT NULL REFERENCES job_pools(id) ON DELETE RESTRICT,
  no INTEGER NOT NULL,
  company_name TEXT NOT NULL,
  job_title TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL REFERENCES users(id),
  updated_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  deleted_by TEXT REFERENCES users(id),
  UNIQUE(pool_id, no)
);

CREATE INDEX IF NOT EXISTS jobs_pool_visible_idx
  ON jobs(pool_id, deleted_at, no);

CREATE TABLE IF NOT EXISTS job_events (
  id TEXT PRIMARY KEY,
  pool_id TEXT NOT NULL REFERENCES job_pools(id) ON DELETE RESTRICT,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE RESTRICT,
  actor_user_id TEXT NOT NULL REFERENCES users(id),
  action TEXT NOT NULL CHECK (action IN ('created', 'copied', 'updated', 'deleted', 'restored')),
  revision INTEGER NOT NULL,
  changed_fields_json TEXT NOT NULL,
  before_snapshot_json TEXT,
  after_snapshot_json TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS job_events_pool_time_idx
  ON job_events(pool_id, created_at DESC);
CREATE INDEX IF NOT EXISTS job_events_job_time_idx
  ON job_events(job_id, created_at DESC);

CREATE TABLE IF NOT EXISTS user_job_states (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  screening_status TEXT NOT NULL DEFAULT 'to_review'
    CHECK (screening_status IN ('to_review', 'selected', 'skipped')),
  application_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (application_status IN ('pending', 'submitted', 'written_test', 'interview', 'offer', 'rejected')),
  priority INTEGER NOT NULL DEFAULT 0 CHECK (priority BETWEEN 0 AND 5),
  applied_at TEXT NOT NULL DEFAULT '',
  personal_notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, job_id)
);
