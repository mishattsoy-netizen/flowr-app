-- §6c retired (2026-07-14): automatic focus-shift detection never reliably
-- fired on real topic shifts across three live sessions, and a correctly
-- populated [FOCUS] block was separately observed being ignored by the
-- model. No evidence it ever changed a real outcome; the safety net
-- (turn_seq single-turn scoping) does not depend on it. current_focus/
-- previous_focus are unused dead columns now — drop them.
ALTER TABLE bot_session_states
  DROP COLUMN IF EXISTS current_focus,
  DROP COLUMN IF EXISTS previous_focus;
