-- 新增筛选状态「待定」（maybe）：放宽 user_job_states.screening_status 的 CHECK 约束。
-- SQLite 不支持修改既有表的 CHECK 约束，采用「建新表 → 全量拷贝 → 替换」的标准方式。
-- 所有已有数据原样保留，不删除、不修改任何记录。

CREATE TABLE IF NOT EXISTS user_job_states_new (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  screening_status TEXT NOT NULL DEFAULT 'to_review'
    CHECK (screening_status IN ('to_review', 'maybe', 'selected', 'skipped')),
  application_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (application_status IN ('pending', 'submitted', 'written_test', 'interview', 'offer', 'rejected')),
  priority INTEGER NOT NULL DEFAULT 0 CHECK (priority BETWEEN 0 AND 5),
  applied_at TEXT NOT NULL DEFAULT '',
  personal_notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, job_id)
);

INSERT INTO user_job_states_new (user_id, job_id, screening_status, application_status, priority, applied_at, personal_notes, created_at, updated_at)
SELECT user_id, job_id, screening_status, application_status, priority, applied_at, personal_notes, created_at, updated_at
FROM user_job_states;

DROP TABLE user_job_states;

ALTER TABLE user_job_states_new RENAME TO user_job_states;
