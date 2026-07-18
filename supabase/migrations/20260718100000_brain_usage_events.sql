-- Brain usage tracking (spec 2026-07-18-brain-canvas-details-design.md §3.5):
-- one row per chat request that actually injected a brain's compiled block.
-- Powers the left panel's Requests/Active-days/streak/activity-calendar stats.
CREATE TABLE IF NOT EXISTS brain_usage_events (
  id         bigserial PRIMARY KEY,
  user_id    uuid NOT NULL,
  brain_id   uuid NOT NULL REFERENCES brains(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Stats queries always filter by (user_id, brain_id) and bucket by day.
CREATE INDEX IF NOT EXISTS idx_brain_usage_events_brain
  ON brain_usage_events(user_id, brain_id, created_at);

ALTER TABLE brain_usage_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "brain_usage_events_own" ON brain_usage_events;
CREATE POLICY "brain_usage_events_own" ON brain_usage_events
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Tier limit change (spec §3.6): business decision, data-only. Free has no AI
-- access so its row is inert and untouched. per_node_cap unchanged for all.
UPDATE brain_config SET token_limit = 8000  WHERE tier = 'pro';
UPDATE brain_config SET token_limit = 14000 WHERE tier = 'max';
