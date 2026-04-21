-- Fix vault table column names to match application code
-- Run this if vault table already existed with key_name/id columns

-- Step 1: Check if key_name exists and rename it to key_id
DO $$
BEGIN
  -- Rename key_name -> key_id if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vault' AND column_name = 'key_name'
  ) THEN
    ALTER TABLE vault RENAME COLUMN key_name TO key_id;
  END IF;

  -- Drop auto-increment id if key_id is now the primary key candidate
  -- First make key_id the primary key if it isn't already
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'vault'
      AND tc.constraint_type = 'PRIMARY KEY'
      AND kcu.column_name = 'key_id'
  ) THEN
    -- Drop existing PK if any
    ALTER TABLE vault DROP CONSTRAINT IF EXISTS vault_pkey;
    -- Make key_id the PK
    ALTER TABLE vault ADD PRIMARY KEY (key_id);
  END IF;

  -- Add missing columns if they don't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vault' AND column_name = 'description'
  ) THEN
    ALTER TABLE vault ADD COLUMN description TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vault' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE vault ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;
END $$;
