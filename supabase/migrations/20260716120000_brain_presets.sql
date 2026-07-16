-- Brain P2a (spec: docs/superpowers/specs/2026-07-16-brain-presets-design.md).
-- Makes "brain" a first-class, nameable entity a user can have several of,
-- instead of one implicit brain per user (P1). Every existing brain_nodes/
-- brain_edges row gets backfilled into an auto-created "Main" brain per user.

CREATE TABLE IF NOT EXISTS brains (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL,
  title       text NOT NULL,
  description text,
  is_default  boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_brains_user ON brains(user_id);
-- At most one default brain per user (the lazy get-or-create's read-first
-- check relies on there being an unambiguous "the" default to find).
CREATE UNIQUE INDEX IF NOT EXISTS idx_brains_one_default_per_user
  ON brains(user_id) WHERE is_default = true;

-- Step A: add brain_id NULLABLE first — cannot be NOT NULL yet, the tables
-- already have rows with no brain_id value to satisfy that constraint.
ALTER TABLE brain_nodes ADD COLUMN IF NOT EXISTS brain_id uuid REFERENCES brains(id) ON DELETE CASCADE;
ALTER TABLE brain_edges ADD COLUMN IF NOT EXISTS brain_id uuid REFERENCES brains(id) ON DELETE CASCADE;

-- Step B: create one "Main" brain per distinct user_id that currently owns
-- brain_nodes or brain_edges rows (a user with zero existing brain content
-- gets their Main brain lazily on first touch instead — see
-- getOrCreateDefaultBrain in brainStore.ts — so this backfill only needs
-- to cover users who already have data to preserve).
INSERT INTO brains (user_id, title, is_default)
SELECT DISTINCT user_id, 'Main', true
FROM (
  SELECT user_id FROM brain_nodes
  UNION
  SELECT user_id FROM brain_edges
) existing_users
WHERE NOT EXISTS (
  SELECT 1 FROM brains b WHERE b.user_id = existing_users.user_id AND b.is_default = true
);

-- Step C: backfill brain_id on every existing row to point at that user's
-- new Main brain.
UPDATE brain_nodes bn
SET brain_id = b.id
FROM brains b
WHERE b.user_id = bn.user_id AND b.is_default = true AND bn.brain_id IS NULL;

UPDATE brain_edges be
SET brain_id = b.id
FROM brains b
WHERE b.user_id = be.user_id AND b.is_default = true AND be.brain_id IS NULL;

-- Step D: NOW it's safe to enforce NOT NULL — every row has a value.
ALTER TABLE brain_nodes ALTER COLUMN brain_id SET NOT NULL;
ALTER TABLE brain_edges ALTER COLUMN brain_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_brain_nodes_brain ON brain_nodes(brain_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_brain_edges_brain ON brain_edges(brain_id) WHERE deleted_at IS NULL;

-- Session binding: which brain is active for this chat session. Nullable —
-- a session created before this migration, or one that hasn't sent its
-- first message yet, has no active brain assigned until chainRouter
-- resolves one lazily on next use.
ALTER TABLE bot_session_states
  ADD COLUMN IF NOT EXISTS active_brain_id uuid REFERENCES brains(id);

ALTER TABLE brains ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "brains_own" ON brains;
CREATE POLICY "brains_own" ON brains
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
