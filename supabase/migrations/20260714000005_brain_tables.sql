-- Brain P1 (spec: docs/superpowers/specs/2026-07-14-brain-design.md).
-- User-curated, token-budgeted knowledge base compiled into a cached
-- [BRAIN] system-prompt block. Replaces bot_memories injection + tool
-- (table kept as backup until live-verified; see spec §7).

CREATE TABLE IF NOT EXISTS brain_nodes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL,
  type        text NOT NULL CHECK (type IN ('workspace','entity','memory','section')),
  ref_id      text REFERENCES entities(id) ON DELETE SET NULL,
  content     text,
  label       text,
  section_id  uuid REFERENCES brain_nodes(id) ON DELETE SET NULL,
  priority    integer NOT NULL DEFAULT 0,
  pinned      boolean NOT NULL DEFAULT false,
  enabled     boolean NOT NULL DEFAULT true,
  created_by  text NOT NULL CHECK (created_by IN ('user','bot')),
  position    jsonb,
  deleted_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_brain_nodes_user ON brain_nodes(user_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS brain_edges (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL,
  from_node   uuid NOT NULL REFERENCES brain_nodes(id) ON DELETE CASCADE,
  to_node     uuid NOT NULL REFERENCES brain_nodes(id) ON DELETE CASCADE,
  label       text NOT NULL,
  created_by  text NOT NULL CHECK (created_by IN ('user','bot')),
  deleted_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_brain_edges_user ON brain_edges(user_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS brain_revisions (
  id          bigserial PRIMARY KEY,
  user_id     uuid NOT NULL,
  actor       text NOT NULL CHECK (actor IN ('user','bot')),
  op          text NOT NULL,
  payload     jsonb NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_brain_revisions_user ON brain_revisions(user_id);

CREATE TABLE IF NOT EXISTS brain_compiles (
  user_id     uuid NOT NULL,
  version     text NOT NULL,
  compiled    text NOT NULL,
  token_count integer NOT NULL,
  dropped_node_ids uuid[] NOT NULL DEFAULT '{}',
  broken_node_ids  uuid[] NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, version)
);

CREATE TABLE IF NOT EXISTS brain_config (
  tier         text PRIMARY KEY REFERENCES subscription_tiers(id),
  token_limit  integer NOT NULL,
  per_node_cap integer NOT NULL DEFAULT 2000
);
-- Real FK to subscription_tiers.id (free/pro/max — verified in
-- supabase/archived_migrations/20260707_credit_metering_schema.sql:7,18-21):
-- a typo'd tier name fails the migration loudly instead of silently
-- desyncing from the real tier list.
-- user_subscriptions.tier_id defaults to 'free' at the DB level, so every
-- user always has a matching row here — no runtime fallback tier needed.
INSERT INTO brain_config (tier, token_limit, per_node_cap) VALUES
  ('free', 2000,  1000),
  ('pro',  10000, 2000),
  ('max',  15000, 3000)
ON CONFLICT (tier) DO NOTHING;

-- Session pinning: the compiled brain version this chat session is locked to,
-- so mid-conversation brain edits don't bust the provider prompt cache
-- (spec §4 — load-bearing for the "build a brain about X" multi-op flow).
ALTER TABLE bot_session_states
  ADD COLUMN IF NOT EXISTS pinned_brain_version text;

-- Workspace descriptions (spec: ships with Brain P1's data layer;
-- editing UI comes later, compile reads it when present).
ALTER TABLE entities
  ADD COLUMN IF NOT EXISTS description text;

-- One memory system, not two: import existing bot_memories as memory nodes.
-- bot_memories table itself is KEPT as a backup until live-verified.
INSERT INTO brain_nodes (user_id, type, content, label, created_by, created_at, updated_at)
SELECT user_id, 'memory', content, title, 'bot', created_at, updated_at
FROM bot_memories
ON CONFLICT DO NOTHING;

ALTER TABLE brain_nodes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE brain_edges     ENABLE ROW LEVEL SECURITY;
ALTER TABLE brain_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE brain_compiles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE brain_config    ENABLE ROW LEVEL SECURITY;

-- User-facing settings/Brain UI reads via the RLS client; bot pipeline uses
-- service role (bypasses RLS — real guarantee is brainStore's ownership checks).
DROP POLICY IF EXISTS "brain_nodes_own" ON brain_nodes;
CREATE POLICY "brain_nodes_own" ON brain_nodes
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "brain_edges_own" ON brain_edges;
CREATE POLICY "brain_edges_own" ON brain_edges
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
