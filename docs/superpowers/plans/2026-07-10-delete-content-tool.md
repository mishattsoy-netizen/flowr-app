# Delete Content Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `delete_content` tool that the AI can only invoke after listing all items to delete and getting explicit user confirmation. Also add cleanup/sorting behavioral guidelines.

**Architecture:** One new tool definition + handler following the existing `create_content` / `update_content` pattern. Handler routes IDs by prefix (`task-` → tasks table, else tries entities then canvas_blocks). A confirmation loop protocol is enforced through the tool description and system prompt — the handler itself is stateless. Frontend `syncToolResults` integrates deletion results into the Zustand store.

**Tech Stack:** TypeScript, Supabase, Zustand (store), existing bot tool infrastructure

---

### Task 1: Add `delete_content` tool definition

**Files:**
- Modify: `src/lib/bot/tools/definitions.ts` — add the tool after `move_content` (line 130)

- [ ] **Step 1: Add delete_content to FLOWR_TOOLS array**

Insert after the `move_content` definition (ends line 130). The `type` parameter for the entity/hint:

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
  },
```

Insert right after line 130 (after `move_content`'s closing `},`). The existing `list_content` definition starts at line 132, so this pushes it down.

- [ ] **Step 2: Commit**

```bash
git add src/lib/bot/tools/definitions.ts
git commit -m "feat(ai): add delete_content tool definition with confirmation-loop instructions"
```

---

### Task 2: Add `delete_content` handler

**Files:**
- Modify: `src/lib/bot/tools/handlers.ts` — add handler + register in `toolHandlers` map

- [ ] **Step 1: Add handler before the closing of toolHandlers**

Insert after the `move_content` handler (ends around line 373) and before the `list_content` handler (starts line 376):

```typescript
  // ── DELETE CONTENT ────────────────────────────────────────────────────────────
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
          // Delete task from tasks table
          const { error } = await supabaseAdmin
            .from('tasks')
            .delete()
            .eq('id', id)
            .eq('owner_id', context.userId)

          results.push({ id, type: 'task', success: !error, error: error?.message })
          continue
        }

        // Entity (note/folder/canvas) or canvas block.
        // Check entities table first (owner-scoped).
        const { data: entity, error: lookupErr } = await supabaseAdmin
          .from('entities')
          .select('id, type')
          .eq('id', id)
          .eq('owner_id', context.userId)
          .maybeSingle()

        if (entity) {
          const { error } = await supabaseAdmin
            .from('entities')
            .delete()
            .eq('id', id)
            .eq('owner_id', context.userId)
          results.push({
            id,
            type: entity.type,
            success: !error,
            error: error?.message,
            cascade: entity.type === 'folder'
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

      return { success: true, deleted: results.filter(r => r.success).length, items: results }
    } catch (e: any) {
      logger.error('delete_content failed:', e.message)
      return { error: e.message }
    }
  },
```

Insert before the `list_content` handler (line 376). The comma at the end ensures it's a valid member of the `toolHandlers` object.

- [ ] **Step 2: Commit**

```bash
git add src/lib/bot/tools/handlers.ts
git commit -m "feat(ai): add delete_content handler with entity/task/canvas-block routing"
```

---

### Task 3: Update system prompt — remove "no delete tools" line, add cleanup behavior

**Files:**
- Modify: `src/lib/bot/tools/prompt.ts`

- [ ] **Step 1: Replace line 39 (the "no delete tools" restriction)**

Replace:
```
0. You DO NOT have any delete tools for safety reasons. If the user asks you to delete something, politely inform them that you cannot delete items for safety and they must delete it manually.
```
With:
```
0. DELETE TOOL AVAILABLE: You have a delete_content tool. CRITICAL: You may ONLY use it after you have listed EVERY item to be deleted in your chat message AND received explicit user confirmation. Never delete without confirmed consent. When deleting a folder, also note that everything inside it will be permanently deleted.
```

- [ ] **Step 2: Add cleanup/sorting behavior section at the end of prompt.ts**

Append before the closing backtick of the template literal (right before the `\` on line 58 `\``):

```typescript

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[CLEANUP & SORTING] — GUIDELINES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
When the user asks you to help clean up, sort, or organize their content:
1. Use list_content to explore — show titles/types only, NOT full content.
2. Do NOT read full note content without asking permission first. Instead say: "I can read the content of X, Y, Z to check if they're relevant — shall I?"
3. If you find candidates (empty notes, duplicates, stale tasks, clutter), list them with your suggestion.
4. Ask follow-up questions if the user's request is vague: "What should I look for? Empty notes? Duplicates? Old tasks?"
5. You can be proactive — if the user says "clean up" without specifics, use list_content to survey their space and propose what you find.
6. CRITICAL: You CANNOT delete anything without running the full confirmation loop (see DELETE TOOL rule). Suggest, discuss, iterate — but never delete without explicit user consent on the exact list.
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/bot/tools/prompt.ts
git commit -m "feat(ai): remove delete restriction, add delete tool availability and cleanup guidelines"
```

---

### Task 4: Add `delete_content` handling in store's `syncToolResults`

**Files:**
- Modify: `src/data/store.ts` — add delete handling in `syncToolResults` method

- [ ] **Step 1: Add delete_content handling after the append_to_note handler (line 3243)**

Insert right after line 3243 (after the closing `}` of the `append_to_note` if-block) and before the line that closes the for-loop (`}` on line 3244):

```typescript
          // delete_content: remove item from local store
          if (tr.tool === 'delete_content' && tr.success && tr.id) {
            if (tr.type === 'task') {
              get().deleteTask(tr.id);
            } else if (tr.type === 'canvas_block') {
              get().deleteCanvasBlock(tr.id);
            } else if (tr.cascade) {
              // Folders cascade to descendants — deleteEntity handles this
              get().deleteEntity(tr.id);
            } else {
              get().deleteEntity(tr.id);
            }
          }
```

- [ ] **Step 2: Commit**

```bash
git add src/data/store.ts
git commit -m "feat(ai): add delete_content result handling in syncToolResults"
```

---

### Task 5: Verify the full build

- [ ] **Step 1: Run the build and check for TypeScript errors**

```bash
npm run build 2>&1 | head -50
```

Expected: Build succeeds with no type errors.

- [ ] **Step 2: Verify the tool is registered**

Check that the `toolHandlers` object's keys match the `FLOWR_TOOLS` names by grepping:

```bash
grep -n "delete_content" src/lib/bot/tools/definitions.ts src/lib/bot/tools/handlers.ts
```

Expected: Found in definitions (tool entry) and handlers (handler + map key).

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: verify build passes for delete_content tool"
```

---

### Spec Coverage Check

| Spec Requirement | Task |
|---|---|
| Tool definition with safety description | Task 1 |
| Handler with entity/task/canvas-block routing | Task 2 |
| Cascade flag for folder deletions | Task 2 (handler returns `cascade: true`) |
| Frontend store sync for deletion results | Task 4 |
| Remove "no delete tools" restriction | Task 3, step 1 |
| Cleanup/sorting behavioral guidelines | Task 3, step 2 |
| Confirmation loop (conversational) | Task 1 (tool description) + Task 3 (prompt rules) |
| No workspace deletion | Task 2 (handled — workspaces ARE entities but the tool description says no; user instruction is the enforcement) |
