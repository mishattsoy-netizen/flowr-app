ALTER TABLE spaces ADD COLUMN IF NOT EXISTS last_modified bigint DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS last_modified bigint DEFAULT 0;
ALTER TABLE entities ADD COLUMN IF NOT EXISTS last_modified bigint DEFAULT 0;
