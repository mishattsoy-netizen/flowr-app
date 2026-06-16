-- Migration: Drop legacy overly permissive policies that bypass user isolation
-- Today's Date: 2026-06-06

DROP POLICY IF EXISTS "entities: owner full access" ON entities;
DROP POLICY IF EXISTS "tasks: owner full access" ON tasks;
DROP POLICY IF EXISTS "settings: owner full access" ON settings;
