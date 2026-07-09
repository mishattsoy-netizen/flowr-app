User request: "1. ai coulnd find personal workspace even though it clearly exists:ai-transcript-2026-07-06T20-29-37.md 2. what is this 3rd cards "MOVED Entity doc", it sohuld be just 2 New note and workspace artifacts. Note and workspace were create BUT note was create in the UNSORTED, not inside the worksapce. ai-transcript-2026-07-06T20-30-47.md analyze both problems"

## Objective Reconstruction
Analyze two AI tool-calling bugs from transcripts:
1. The AI failed to find the 'Personal' workspace despite it existing.
2. The AI created a note in Unsorted and emitted a weird "MOVED Entity doc" artifact when asked to create an 'Area 51' workspace and put the note inside.

## Strategic Reasoning
1. For problem 1, `list_content` had a strict `if (!spaceId) return error` check. When the user has no active workspace (e.g. Unsorted section), `spaceId` is null, which causes the search tool to fail immediately instead of searching across the user's account for the workspace. I needed to remove this strict block and modify the query to selectively filter by `space_id` only if one exists, ensuring workspaces (which are root level) can always be found.
2. For problem 2, I discovered that the `capturedToolCalls` data wasn't being logged into the transcript files, preventing me from seeing exactly what the AI passed in its tool arguments. However, deduction points to the AI attempting parallel tool calling: creating a workspace and a note simultaneously. Because it didn't know the new workspace's ID yet, the note defaulted to Unsorted, and it likely followed up by guessing a `parentId` like "Area 51" in a `move_content` call to try and fix it, which resulted in the 3rd card.
I needed to update `buildTranscript` to include `capturedToolCalls` so that re-running the test will reveal the precise tool payloads and allow a full fix.

## Detailed Blueprint
- Update `src/lib/bot/tools/handlers.ts` to allow `list_content` to run when `spaceId` is null, and adjust the Supabase queries to conditionally filter by `space_id`.
- Update `src/lib/bot/transcript.ts` to inject the `capturedToolCalls` JSON string into the Markdown output.

## Operational Trace
- Edited `src/lib/bot/tools/handlers.ts` to remove the hard error `if (!spaceId) return { error: ... }`.
- Adjusted the `entities` and `tasks` queries in `list_content` to add `.eq('owner_id', context.userId)` and conditionally apply the `space_id` filters if `spaceId` is present.
- Added `capturedToolCalls` property to `TranscriptData` interface in `transcript.ts`.
- Inserted code in `buildTranscript` to stringify and render `capturedToolCalls` before the Final Response section.

## Status Assessment
The `list_content` issue preventing the AI from finding workspaces without an active space is fixed. The transcript generator has been upgraded to log raw tool calls. The second issue's root cause (likely parallel tool calling missing IDs) is understood, but requires the user to re-run the Area 51 test to capture the tool execution trace for a permanent fix to the AI prompt or multi-hop execution logic.
