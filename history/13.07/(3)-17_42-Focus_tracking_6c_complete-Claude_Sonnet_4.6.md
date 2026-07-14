User request: "get ready for lassy step" -> confirmed as sec 6c (Focus tracking)

## 0. Date and Time
2026-07-13 at 17:42 (UTC+3)

## 1. User Request
User request: "get ready for lassy step" -> confirmed as sec 6c (Focus tracking)

## 2. Objective Reconstruction
Implement sec 6c of the bot-rework design: add an update_focus tool so the bot explicitly tracks topic shifts in session state. Prevents old context from bleeding into new unrelated requests.

## 3. Strategic Reasoning
sec 6c shares the same session-state infrastructure as sec 6b. Focus columns go into the same migration file (not yet applied), keeping the schema change atomic. The tool is lightweight: the model decides when to call it, so legitimate continuations do not incur extra round trips. The sec 6b/sec 6c interaction (topic shift clears pending_action) is handled inside the handler itself.

## 4. Detailed Blueprint
- Amend migration 20260714_bot_session_action_state.sql: add current_focus TEXT and previous_focus TEXT.
- Extend SessionState interface + all 3 fallback objects in context.ts.
- Add update_focus tool definition in definitions.ts.
- Add update_focus handler in handlers.ts: read-then-write, clear pending_action.
- Add currentFocus / previousFocus to PromptBuilderContext; inject [FOCUS] block in dynamicContext.
- Pass new fields in buildSystemPrompt call in chainRouter.ts.
- Update tools.txt: tool count to 8, add rule 16 for update_focus.
- Mark sec 6c done in spec.

## 5. Operational Trace
- Migration amended in-place (not yet applied).
- context.ts: current_focus and previous_focus added to interface + 3 fallback returns.
- definitions.ts: update_focus inserted between delete_content and list_content.
- handlers.ts: update_focus handler added, clears pending_action on every call.
- promptBuilder.ts: 2 fields added, [FOCUS] block appended after [PENDING CONFIRMATION].
- chainRouter.ts: 2 lines added to the buildSystemPrompt call.
- tools.txt: tool count updated to 8, rule 16 added.
- tsc --noEmit: clean. npm test: 359/359 passing.

## 6. Status Assessment
sec 6c complete. Full 2026-07-13-6bcd handoff done: sec 6d, sec 6b, sec 6c all shipped.
One remaining step: apply migration 20260714_bot_session_action_state.sql to Supabase before the new session-state fields are usable.
