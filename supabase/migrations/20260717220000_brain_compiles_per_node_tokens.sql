-- Per-node rendered token costs for brain canvas card pills.
-- Survives compile-cache hits without recomputing (see compileBrain).
ALTER TABLE brain_compiles
  ADD COLUMN IF NOT EXISTS per_node_tokens JSONB NOT NULL DEFAULT '{}'::jsonb;
