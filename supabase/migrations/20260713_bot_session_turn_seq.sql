-- §6b follow-up: deterministic single-turn scoping for pending_action.
--
-- The confirmed:true id-match gate (added after a live bypass incident, see
-- handlers.ts) only protects a turn when the topic-shift detector correctly
-- clears pending_action first. Detection has since been shown unreliable
-- (misses real shifts more often than it catches them), which left the gate
-- depending on a 5-minute TTL as its only backstop — too coarse for a fast
-- conversation, where several unrelated turns can land within that window.
--
-- turn_seq is a per-session monotonic counter, incremented once per turn in
-- chainRouter.ts. A dry-run stamps the counter's value onto pending_action at
-- creation (as turn_seq, inside the existing pending_action JSONB — no new
-- column needed there). A confirmed:true call is only honored if the
-- session's current turn_seq is at most one turn ahead of the stamped value,
-- i.e. the confirmation must land on the very next turn. This makes
-- expiry deterministic and independent of whether focus-shift detection
-- ever fires, instead of relying on wall-clock time or detection luck.
ALTER TABLE bot_session_states
  ADD COLUMN IF NOT EXISTS turn_seq INTEGER NOT NULL DEFAULT 0;
