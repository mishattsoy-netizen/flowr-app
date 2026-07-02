# AI Tool Instructions Block — Design

**Date:** 2026-07-02
**Status:** Draft

## Problem

The AI has function-calling tools (`update_note`, `create_note`, etc.) passed as API-level function definitions to providers (Gemini, OpenRouter, Groq, Nvidia), but the **system prompt never tells the AI about them**. The model sees "here are functions you can call" with no guidance on *when* to call them versus just outputting markdown. This means the AI rarely uses the tools, defeating their purpose.

## Solution

Add a `[AVAILABLE TOOLS]` section to the system prompt for tool-enabled categories. The block lives in a dedicated file (`src/lib/bot/tools/prompt.ts`) and is injected during system prompt assembly in `chainRouter.ts`.

## Scope

- **New file:** `src/lib/bot/tools/prompt.ts` — exports `TOOL_INSTRUCTIONS` string
- **Injection:** `chainRouter.ts` — 4 lines added before page context injection
- **New tool:** `search_notes(query)` — allows AI to find notes by title without parsing a full workspace listing
- **No DB changes** — instructions are version-controlled code

## Tool Instructions Content

```
[AVAILABLE TOOLS]
You can edit the user's notes directly using these tools instead of writing markdown.

NOTE-EDITING TOOLS:
• update_note(id, blocks?, title?) — FULL REPLACE. Use for "edit this" / "rewrite".
• append_note_blocks(id, blocks) — ADD to end. Use for "add to this" / "append".
• create_note(title, blocks, parentId?) — Create a new note.
• search_notes(query) — Find a note by title. Returns ID.
• list_notes() — List everything in the workspace.
• delete_note(id) — Delete a note.
• create_folder(title, parentId?) — Create a folder.

BLOCK FORMAT:
Each note is an array of blocks. Valid types for notes:
  text       → style: body | title | heading | subheading | mono
  bulletList → content: "Item text"
  numberedList → content: "Item text"
  dashedList → content: "Item text"
  checklist  → content: "Task", checked: true/false
  quote      → content: "Quote"
  divider    → content: ""
  table      → tableData: [["H1","H2"],["C1","C2"]]
  image      → mediaUrl: "https://..."
  link       → content: "Label", linkUrl: "https://..."

RULES:
1. Page context always includes (entity ID: xxx) — use it.
2. "edit" → update_note with full blocks. Never drop existing content.
3. "add" / "append" → append_note_blocks.
4. Don't know the ID? → search_notes(query) first.
5. Create new notes with create_note.
6. Never suggest copy-paste when you can use tools.
```

## Injection Point

In `chainRouter.ts`, after the global prompt and about-app sections, injected when `category` is `REGULAR`, `COMPLEX`, or `CODING`:

```typescript
if (['REGULAR', 'COMPLEX', 'CODING'].includes(category)) {
  const { TOOL_INSTRUCTIONS } = await import('./tools/prompt')
  finalSysPrompt += "\n\n" + TOOL_INSTRUCTIONS
}
```

## New Tool: search_notes

A lightweight tool so the AI can find a note by title without calling `list_notes` (which returns everything):

- **definition:** `{ name: "search_notes", description: "Find a note by title/name. Returns matching note IDs, titles, and types.", parameters: { query: string } }`
- **handler:** `SELECT id, title, type FROM entities WHERE workspace_id = ? AND title ILIKE '%query%' LIMIT 10`
- **handler location:** `src/lib/bot/tools/handlers.ts`

## Block Types for Notes (Complete)

| Block Type    | Required Fields                | Optional Fields       |
|---------------|-------------------------------|-----------------------|
| text          | type, content, style           | children              |
| bulletList    | type, content                  | children              |
| dashedList    | type, content                  | children              |
| numberedList  | type, content                  | children              |
| checklist     | type, content, checked         | children              |
| quote         | type, content                  | —                     |
| divider       | type, content                  | —                     |
| table         | type, tableData: string[][]    | —                     |
| image         | type, mediaUrl                 | mediaCaption, mediaWidth |
| link          | type, content, linkUrl         | —                     |

## Files Changed

| File | Action |
|------|--------|
| `src/lib/bot/tools/prompt.ts` | **New** — exports `TOOL_INSTRUCTIONS` |
| `src/lib/bot/tools/definitions.ts` | Edit — add `search_notes` tool definition |
| `src/lib/bot/tools/handlers.ts` | Edit — add `search_notes` handler |
| `src/lib/bot/chainRouter.ts` | Edit — inject tool instructions for REGULAR/COMPLEX/CODING |

## Future Considerations

- Instructions are hardcoded. If editing from admin UI is needed later, add a `bot_tools_prompt` table and sync with `recompilePrompt()`.
- `search_notes` uses ILIKE. For large workspaces, add a pg_trgm index on `entities.title`.
