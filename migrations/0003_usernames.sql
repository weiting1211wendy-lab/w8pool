ALTER TABLE users ADD COLUMN username TEXT;

UPDATE users
SET username = lower(replace(display_name, ' ', '_'))
WHERE username IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique_idx
  ON users(username COLLATE NOCASE);
