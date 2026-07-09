# Session Descriptions — Future Idea (2026-07-10)

## Concept
Per-session descriptions auto-curated by the AI, persisted alongside each session, deleted with the session. Invisible to the user.

## Key Properties
- Max ~300 chars, silently generated/updated by AI after the first turn
- Updated only when the topic/scope actually changes — AI skips update if nothing meaningful changed
- Resent to itself on every turn as a metadata block (like context summary)
- Can be updated alongside any other tool invocation — no extra visible step
- Deleted when the session is deleted
- Would make sessions browsable via `list_content` — instead of loading full transcripts, AI reads the concise description
- Useful for cross-session awareness: "what was I working on in session X?"

## Why Not Implemented Now
- Not needed for the `delete_content` / cleanup feature
- Adds decision overhead on every turn (does this change the topic?)
- Existing compaction/summary system already handles in-session context
- Better scoped as an independent feature with its own design session

## Related
- Existing: `manage_memory` tool, session compaction (`/api/ai/memory/compact`), `aiSessionContext` / `distilled_summary`
- Future: could make sessions queryable content objects alongside notes/tasks
