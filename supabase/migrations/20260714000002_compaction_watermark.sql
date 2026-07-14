-- §7b: watermark compaction. Two independent additions:
--
-- 1. last_compacted_message_id on bot_session_states: the id of the newest
--    message_logs row already folded into distilled_summary. The prompt
--    window is always "summary + messages after this id" — replacing the
--    old fixed "last 5 messages" slice, which created a context hole for
--    any message between what the summary covered and the last 5 (see
--    spec §7b defect 1).
--
-- 2. bot_compaction_config: previously HARDCODED_COMPACTION_CONFIG in
--    compaction.ts — the admin UI sliders wrote to a no-op function and
--    nothing persisted (spec §7b defect 4). Single-row table (like other
--    global config), touched only via supabaseAdmin (service role bypasses
--    RLS), same pattern as bot_session_states and telegram_media_groups.
ALTER TABLE bot_session_states
  ADD COLUMN IF NOT EXISTS last_compacted_message_id BIGINT;

CREATE TABLE IF NOT EXISTS bot_compaction_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  context_limit INTEGER NOT NULL DEFAULT 10000,
  compaction_threshold REAL NOT NULL DEFAULT 0.80,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT single_row CHECK (id = 1)
);

INSERT INTO bot_compaction_config (id, context_limit, compaction_threshold)
VALUES (1, 10000, 0.80)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE bot_compaction_config ENABLE ROW LEVEL SECURITY;
