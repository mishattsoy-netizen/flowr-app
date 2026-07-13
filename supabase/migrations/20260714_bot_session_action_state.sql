-- §6b/§6c: server-side action state, extending bot_session_states rather than
-- adding new tables (same session-scoped lifecycle, same access pattern via
-- getSessionState/updateSessionState in src/lib/bot/context.ts).
--
-- pending_action (§6b): the server's own record of what a dry-run tool call
-- (delete_content, or update_content full-replace) actually previewed, so the
-- model reasons over the real stored payload on every later turn instead of
-- re-deriving "what were we deleting again?" from raw conversation text —
-- that re-derivation is what caused the live bug where the bot confused
-- tasks with canvas blocks mid-confirmation.
--
-- current_focus / previous_focus (§6c): an explicit, model-maintained record
-- of what topic the conversation is currently on, so a topic shift doesn't
-- silently bleed old context into a new, unrelated request.
ALTER TABLE bot_session_states
  ADD COLUMN IF NOT EXISTS pending_action JSONB,
  ADD COLUMN IF NOT EXISTS current_focus TEXT,
  ADD COLUMN IF NOT EXISTS previous_focus TEXT;
