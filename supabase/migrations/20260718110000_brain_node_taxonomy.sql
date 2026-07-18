-- Brain node taxonomy (spec 2026-07-18-brain-canvas-details-design.md §4C).
-- Custom tag (color + optional name) and temporary lifecycle live on the
-- brain_node (they describe the canvas node). brain_only lives on the entity
-- (it describes the note's workspace visibility) — two-row model, §4C intro.
ALTER TABLE brain_nodes ADD COLUMN IF NOT EXISTS tag_color    text;
ALTER TABLE brain_nodes ADD COLUMN IF NOT EXISTS tag_name     text;
ALTER TABLE brain_nodes ADD COLUMN IF NOT EXISTS active_from  timestamptz;
ALTER TABLE brain_nodes ADD COLUMN IF NOT EXISTS active_until timestamptz;

ALTER TABLE entities ADD COLUMN IF NOT EXISTS brain_only boolean NOT NULL DEFAULT false;
-- Every workspace/unsorted list filters this out; index the common case.
CREATE INDEX IF NOT EXISTS idx_entities_not_brain_only
  ON entities(owner_id) WHERE brain_only = false;
