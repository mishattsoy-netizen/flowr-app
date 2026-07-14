-- Migration: Drop auto-generated "anon full access" policies that bypass user isolation
-- These policies (qualifier: true) let any authenticated user see ALL rows in
-- entities and tasks, overriding the per-user owner_id policies.
-- Likely auto-created by the Supabase Dashboard "Auto Generate API Policies" feature.
-- Date: 2026-06-29

DROP POLICY IF EXISTS "entities: anon full access" ON entities;
DROP POLICY IF EXISTS "tasks: anon full access" ON tasks;
DROP POLICY IF EXISTS "workspaces: owner access" ON workspaces;
