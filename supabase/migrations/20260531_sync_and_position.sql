-- 1. Add double-precision position column to tasks table
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS position double precision;

-- 2. Enable real-time updates for entities safely (catch if already registered)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE entities;
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'Relation entities is already a member of publication supabase_realtime';
END $$;

-- 3. Enable real-time updates for tasks safely (catch if already registered)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'Relation tasks is already a member of publication supabase_realtime';
END $$;
