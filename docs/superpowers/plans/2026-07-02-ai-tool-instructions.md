# AI Tool Instructions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a system prompt block that tells the AI about its note-editing tools, plus a `search_notes` tool so it can find notes by title.

**Architecture:** Create `prompt.ts` exporting `TOOL_INSTRUCTIONS` as a string, inject into `chainRouter.ts` system prompt assembly, add `search_notes` tool definition + handler.

**Tech Stack:** TypeScript, Supabase, Next.js serverless

---

### Task 1: Create tool instructions file

**Files:**
- Create: `src/lib/bot/tools/prompt.ts`

- [ ] **Step 1: Create prompt.ts**

```typescript
// src/lib/bot/tools/prompt.ts
// Tool instructions injected into the AI system prompt for note-editing awareness.

export const TOOL_INSTRUCTIONS = `[AVAILABLE TOOLS]
You can edit the user's notes directly using these tools instead of writing markdown.

NOTE-EDITING TOOLS:
- update_note(id, blocks?, title?) — FULLY REPLACE a note's content. Use for "edit this" / "rewrite" / "format" / "make it readable". The blocks parameter replaces ALL existing content — include every block.
- append_note_blocks(id, blocks) — ADD blocks to the end of a note. Use for "add to this" / "append" / "add a section". NEVER use update_note when you mean append.
- create_note(title, blocks, parentId?) — Create a brand new note with structured content.
- search_notes(query) — Find a note by its title or name. Returns the note's ID, title, and type. Call this first when you don't know the exact ID.
- list_notes() — List all notes and folders in the workspace with IDs and titles.
- delete_note(id) — Permanently delete a note by its ID.
- create_folder(title, parentId?) — Create a new folder in the workspace.

BLOCK FORMAT (used by all note tools):
Each note is stored as an array of block objects. Here are the valid block types for notes:

  {"type": "text", "style": "body", "content": "Paragraph text"}
  {"type": "text", "style": "title", "content": "Note title"}
  {"type": "text", "style": "heading", "content": "Section heading"}
  {"type": "text", "style": "subheading", "content": "Sub-section heading"}
  {"type": "text", "style": "mono", "content": "Monospaced/code text"}
  {"type": "bulletList", "content": "A bullet point"}
  {"type": "numberedList", "content": "A numbered item"}
  {"type": "dashedList", "content": "A dashed item"}
  {"type": "checklist", "content": "Unchecked task", "checked": false}
  {"type": "checklist", "content": "Checked task", "checked": true}
  {"type": "quote", "content": "A blockquote"}
  {"type": "divider", "content": ""}
  {"type": "table", "content": "", "tableData": [["Header 1","Header 2"],["Cell 1","Cell 2"]]}
  {"type": "image", "content": "", "mediaUrl": "https://example.com/image.png"}
  {"type": "link", "content": "Link text", "linkUrl": "https://example.com"}

RULES:
1. The page context always includes "(entity ID: xxx)" for the current note — use that ID directly.
2. When the user says "edit this note" or "rewrite" → call update_note with the full block content. Never drop existing content unless asked.
3. When the user says "add to this note" or "append" → call append_note_blocks.
4. If you need a note you don't have the ID for → call search_notes() first.
5. When the user wants a new note → call create_note with proper block content.
6. Never suggest the user copy-paste markdown when you can use these tools.`
```

- [ ] **Step 2: Verify file compiles**

Run: `npx tsc --noEmit src/lib/bot/tools/prompt.ts 2>&1 | head -20`
Expected: No errors (or a type-check skip since it's just a string export, no deps).

- [ ] **Step 3: Commit**

```bash
git add src/lib/bot/tools/prompt.ts
git commit -m "feat: add AI tool instructions prompt block"
```

---

### Task 2: Add search_notes tool definition

**Files:**
- Modify: `src/lib/bot/tools/definitions.ts` (append to FLOWR_TOOLS array)

- [ ] **Step 1: Add search_notes definition**

Insert before the closing `]` of `FLOWR_TOOLS`:

```typescript
  {
    name: "search_notes",
    description: "Finds a note or folder by searching its title. Returns matching IDs, titles, and types.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "The title or name to search for (e.g. 'Shopping List', 'Project notes')." }
      },
      required: ["query"]
    }
  },
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/bot/tools/definitions.ts
git commit -m "feat: add search_notes tool definition"
```

---

### Task 3: Add search_notes handler

**Files:**
- Modify: `src/lib/bot/tools/handlers.ts`

- [ ] **Step 1: Add search_notes handler**

Add before the closing `}` of `toolHandlers`:

```typescript
  /**
   * Search Notes by Title
   */
  async search_notes({ query }: { query: string }, context: any) {
    if (!supabaseAdmin) return { error: 'Supabase not configured' }
    if (!query?.trim()) return { error: 'Search query is required' }

    try {
      let workspaceId = context?.activeWorkspaceId

      if (context?.userId && context.userId !== 'anonymous') {
        const { data: user } = await supabaseAdmin
          .from('profiles')
          .select('active_workspace_id')
          .eq('id', context.userId)
          .single()
        if (user?.active_workspace_id) workspaceId = user.active_workspace_id
      }

      if (!workspaceId) return { error: 'No active workspace identified' }

      const { data, error } = await supabaseAdmin
        .from('entities')
        .select('id, title, type')
        .eq('workspace_id', workspaceId)
        .ilike('title', `%${query}%`)
        .limit(10)

      if (error) throw error

      return {
        results: data ?? [],
        total: data?.length ?? 0
      }
    } catch (e: any) {
      logger.error('Failed to search notes:', e.message)
      return { error: e.message }
    }
  },
```

- [ ] **Step 2: Verify the import for `type` usage**

The handler uses `query: string` inline — no new imports needed. The file already imports `logger` and `supabaseAdmin`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/bot/tools/handlers.ts
git commit -m "feat: add search_notes handler"
```

---

### Task 4: Inject tool instructions into system prompt

**Files:**
- Modify: `src/lib/bot/chainRouter.ts` (~1510 lines)

- [ ] **Step 1: Add injection in system prompt assembly**

Find this block in `chainRouter.ts` (around line 766-768):

```typescript
  if (internalPipelinePrompt && !PIPELINE_PROMPT_CHAINS.includes(category)) finalSysPrompt += "\n\n" + internalPipelinePrompt
  if (routerOverridePrompt) finalSysPrompt += "\n\n" + routerOverridePrompt
  if (context?.pageContext) finalSysPrompt += `\n\n[PAGE CONTEXT]\n${context.pageContext}\n`
```

Replace with:

```typescript
  if (internalPipelinePrompt && !PIPELINE_PROMPT_CHAINS.includes(category)) finalSysPrompt += "\n\n" + internalPipelinePrompt
  // Inject tool instructions for categories that have function-calling tools enabled
  if (['REGULAR', 'COMPLEX', 'CODING'].includes(category)) {
    const { TOOL_INSTRUCTIONS } = await import('./tools/prompt')
    finalSysPrompt += "\n\n" + TOOL_INSTRUCTIONS
  }
  if (routerOverridePrompt) finalSysPrompt += "\n\n" + routerOverridePrompt
  if (context?.pageContext) finalSysPrompt += `\n\n[PAGE CONTEXT]\n${context.pageContext}\n`
```

- [ ] **Step 2: Verify the build**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/bot/chainRouter.ts
git commit -m "feat: inject TOOL_INSTRUCTIONS into system prompt for tool-enabled categories"
```

---

### Task 5: Verify end-to-end

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Expected: Server starts without errors.

- [ ] **Step 2: Send a test AI message in the app**

Open the app, navigate to a note, type "edit this note and make it more readable" in the AI assistant.
Expected: AI calls `update_note` with the note's ID and structured blocks. Note content updates in the UI.
