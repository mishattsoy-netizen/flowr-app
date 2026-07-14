-- Migration: Fix settings table primary key for multi-tenancy
-- The settings table had `key` as PRIMARY KEY, which prevented multiple users
-- from having their own settings with the same key (e.g., 'shortcuts').
-- Fix: change the primary key to (owner_id, key) so each user has isolated settings.

-- Step 1: Delete orphaned settings rows (owner_id IS NULL) — these are legacy
-- rows from before user scoping was added and are no longer accessible via RLS.
DELETE FROM settings WHERE owner_id IS NULL;

-- Step 2: Make owner_id NOT NULL so it can be part of the primary key
ALTER TABLE settings ALTER COLUMN owner_id SET NOT NULL;

-- Step 3: Drop the old primary key (key) and the redundant unique constraint
ALTER TABLE settings DROP CONSTRAINT settings_pkey;
ALTER TABLE settings DROP CONSTRAINT IF EXISTS settings_owner_key_unique;

-- Step 4: Add composite primary key (owner_id, key)
ALTER TABLE settings ADD PRIMARY KEY (owner_id, key);
