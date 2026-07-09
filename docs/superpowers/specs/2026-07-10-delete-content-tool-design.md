# Delete Content Tool & Cleanup Behavior — Design

**Date:** 2026-07-10

## Goal

Add a `delete_content` tool that lets the AI bot permanently delete user content (notes, folders, canvases, canvas blocks, tasks) **only after** a user-facing confirmation loop. Also define the AI's behavior for cleanup/sorting requests — it must explore, suggest, and iterate with the user rather than acting autonomously.

## Non-Goals

- Deleting workspaces (top-level containers) — explicitly excluded
- UI confirmation modals — purely conversational
- Session descriptions ([parked for later](session-descriptions-idea.md))
- Undo/deletion recovery — permanent by design

## Tool: `delete_content`

### Definition (in `definitions.ts`)

```typescript
{
  name: "delete_content",
  description: "Permanently delete one or more items by ID. Supports notes, folders, canvases, canvas blocks, and tasks.\n\nCRITICAL SAFETY RULES — you MUST follow these exactly:\n1. Get PERMISSION FIRST: Before calling this tool, list EVERY item you intend to delete in your chat response with type + title for each item.\n2. AWAIT EXPLICIT CONFIRMATION: Do NOT call this tool until the user has explicitly confirmed they want those exact items deleted.\n3. ONLY the listed items: Delete only what you listed. If the user wants to keep some items from the list, loop back to step 1 with the adjusted list.\n4. Folders cascade: When a folder is deleted, ALL its children (notes, sub-folders, etc.) are also permanently deleted — note this in your list.\n\nIf the user corrects or adjusts the list, present the new list for re-confirmation before deleting.",
  parameters: {
    type: "object",
    properties: {
      ids: {
        type: "array",
        items: { type: "string" },
        description: "IDs of items to permanently delete. Supports entity IDs (notes, folders, canvases) and task IDs (prefixed 'task-'). Canvas block IDs also accepted."
      },
      type: {
        type: "string",
        enum: ["note", "task", "folder", "canvas"],
        description: "Optional type hint for display in the confirmation list."
      }
    },
    required: ["ids"]
  }
}
```

### Handler (in `handlers.ts`)

```typescript
async delete_content(args: any, context: any) {
  if (!supabaseAdmin) return { error: 'Supabase not configured' }
  if (isUserAnonymous(context)) {
    return { error: 'You are currently using Flowr in anonymous mode. Please log in to manage content.' }
  }

  const { ids } = args
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return { error: "'ids' array is required" }
  }

  try {
    const results: any[] = []
    
    for (const id of ids) {
      if (id.startsWith('task-')) {
        // Delete task
        const { error } = await supabaseAdmin
          .from('tasks')
          .delete()
          .eq('id', id)
          .eq('owner_id', context.userId)
        
        results.push({ id, type: 'task', success: !error, error: error?.message })
      } else {
        // Entity (note/folder/canvas) or canvas block.
        // Check entities table first (owner-scoped).
        const { data: entity, error: lookupErr } = await supabaseAdmin
          .from('entities')
          .select('id, type')
          .eq('id', id)
          .eq('owner_id', context.userId)
          .maybeSingle()
        
        if (entity) {
          // Delete entity
          const { error } = await supabaseAdmin
            .from('entities')
            .delete()
            .eq('id', id)
            .eq('owner_id', context.userId)
          results.push({
            id, type: entity.type, success: !error, error: error?.message,
            cascade: entity.type === 'folder' // frontend will handle descendants
          })
        } else {
          // Try canvas_blocks table
          const { error } = await supabaseAdmin
            .from('canvas_blocks')
            .delete()
            .eq('id', id)
            .eq('user_id', context.userId)
          results.push({ id, type: 'canvas_block', success: !error, error: error?.message })
        }
      }
    }

    return { success: true, deleted: results.filter(r => r.success).length, items: results }
  } catch (e: any) {
    logger.error('delete_content failed:', e.message)
    return { error: e.message }
  }
}
```

**Cascading deletes.** When a folder is deleted, the backend only removes the folder row itself. Its children (notes, canvases, sub-folders) remain in the DB with a `parent_id` pointing to a deleted folder. The frontend handles cleanup through `syncToolResults` — when it sees a folder deletion marked `cascade: true`, it calls `deleteEntity(id)` which finds and removes all descendants from local state. The sync layer (`deleteEntityFromDB`) deletes individual rows, but the children stay orphaned in the DB. This matches existing behavior — `fixDatabaseIntegrity` in the store can clean them up later.

The critical safety mechanism is the confirmation list: the AI MUST note "Folder X + everything inside it (N items)" so the user sees the full scope of what's being deleted.

### Store-side integration

The existing `syncToolResults` in `store.ts` already maps `toolResults` items to local store mutations. Add handling for `delete_content` results:

```typescript
if (tr.tool === 'delete_content' && tr.success && tr.id) {
  // For tasks: deleteTask(tr.id)
  // For entities: deleteEntity(tr.id) — already cascades descendants
  // For canvas blocks: deleteCanvasBlock(tr.id)
}
```

## Confirmation Loop Protocol

The AI follows this flow for EVERY deletion:

```
User: "delete these two notes"
  ↓
AI: list_content to find the notes by title/ID
  ↓
AI chat response: "I found these items to delete:
  1. 📄 "Old Meeting Notes" (note)
  2. 📄 "Draft Ideas" (note)
  
  Shall I permanently delete these 2 items?"
  ↓  (NO delete_content call yet)
User: "yes"  or  "keep #2"  or  "no"
  ↓
If confirmed  →  AI calls delete_content({ ids: [...] })
If adjusted   →  AI presents new list, loops back
If declined   →  AI acknowledges, does nothing
```

**The `delete_content` tool MUST NOT be called speculatively or proactively.** It is only called after user says yes.

## Cleanup/Sorting Behavior (System Prompt)

Added to `prompt.ts` tool instructions:

> **CLEANUP & SORTING:** When the user asks you to help clean up, sort, or organize their content, follow these rules:
> 1. Use `list_content` to explore — show titles/types only, NOT full content
> 2. Do NOT read full note content without asking permission first. Instead say: "I can read the content of X, Y, Z to check if they're relevant — shall I?"
> 3. If you find candidates (duplicates, empty notes, stale tasks, clutter), list them with your suggestion
> 4. Ask follow-up questions if the user's request is vague: "What should I look for? Empty notes? Duplicates? Old tasks?"
> 5. You can be proactive — if the user says "clean up" without specifics, use `list_content` to survey their space and propose what you find
> 6. CRITICAL: You CANNOT delete anything without running the full confirmation loop. Suggest, discuss, iterate — but never delete without explicit user consent on the exact list.

## Files to Modify

| File | Change |
|------|--------|
| `src/lib/bot/tools/definitions.ts` | Add `delete_content` tool definition |
| `src/lib/bot/tools/handlers.ts` | Add `delete_content` handler implementation |
| `src/lib/bot/tools/prompt.ts` | Remove "no delete tools" line; add cleanup behavior instructions |
| `src/data/store.ts` | Add `delete_content` handling in `syncToolResults` |
