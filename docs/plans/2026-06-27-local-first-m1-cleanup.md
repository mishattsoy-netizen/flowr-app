# M1: Cleanup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove all unused feature code (Life Mode, Databases, Embeds, Knowledge types) and sync schema.sql with production reality.

**Architecture:** Pure subtraction to shrink the codebase before introducing new architecture.

**Tech Stack:** TypeScript, React, Zustand, SQL

---

### Task 1: Remove Knowledge and Life Types

**Files:**
- Modify: `src/data/store.types.ts`

**Step 1: Remove type definitions**

In `src/data/store.types.ts`, remove the following interfaces and types (lines 5-16, 253-256):

```typescript
// DELETE:
export type Habit = { ... }
export type HabitCheck = { ... }
export type MoodEntry = { ... }
export type JournalEntry = { ... }
export type Goal = { ... }
export type Routine = { ... }
export type RoutineCheck = { ... }
export type Resource = { ... }
export type Snippet = { ... }
export type Guide = { ... }

// DELETE from ModalType:
| { type: 'habitDetail'; habitId: string }
| { type: 'goalDetail'; goalId: string }
| { type: 'journalDetail'; date: string }
| { type: 'routineDetail'; routineId: string }
```

**Step 2: Remove from BlockType and Embed/Database Types**

In `src/data/store.types.ts`, remove `database` and `embed` from `BlockType` (lines 56-57). Also remove `EmbedDisplayMode`, `DatabaseViewType`, `DatabaseColumnType`, `DatabaseColumn`, `DatabaseRow` entirely (lines 67-82).

Remove these fields from `EditorBlock` (lines 134-139):
```typescript
// DELETE:
embedEntityId?: string;
embedDisplayMode?: EmbedDisplayMode;
dbViewType?: DatabaseViewType;
dbColumns?: DatabaseColumn[];
dbRows?: DatabaseRow[];
dbGroupByColumnId?: string;
```

**Step 3: Remove State Arrays and Actions from AppState**

In `src/data/store.types.ts`, remove all life and knowledge arrays from `AppState` (lines 416-426):
```typescript
// DELETE:
lifeHabits: Habit[];
lifeHabitChecks: HabitCheck[];
lifeMoods: MoodEntry[];
lifeJournals: JournalEntry[];
lifeGoals: Goal[];
lifeRoutines: Routine[];
lifeRoutineChecks: RoutineCheck[];
knowledgeResources: Resource[];
knowledgeSnippets: Snippet[];
knowledgeGuides: Guide[];
```

Remove all life and knowledge actions from `AppState` (lines 618-633, plus knowledge actions):
```typescript
// DELETE all addHabit, updateHabit, etc.
// DELETE all addResource, updateResource, etc.
// DELETE setLifeData, setKnowledgeData
```

**Step 4: Verify Compilation Fails as Expected**

Run: `npm run build`
Expected: Multiple TypeScript errors in `store.ts` and components that used these types.

**Step 5: Commit**

```bash
git add src/data/store.types.ts
git commit -m "refactor: remove Life and Knowledge types from store.types.ts"
```

---

### Task 2: Remove Knowledge and Life from Store

**Files:**
- Modify: `src/data/store.ts`

**Step 1: Remove Initial State**

In `src/data/store.ts`, remove the default empty arrays (lines 131-137):
```typescript
// DELETE:
lifeHabits: [],
lifeHabitChecks: [],
lifeMoods: [],
lifeJournals: [],
lifeGoals: [],
lifeRoutines: [],
lifeRoutineChecks: [],
knowledgeResources: [],
knowledgeSnippets: [],
knowledgeGuides: [],
```

**Step 2: Remove Action Implementations**

In `src/data/store.ts`, delete the implementations for all life and knowledge actions (lines 2131-2189).

**Step 3: Remove from Partialize**

In `src/data/store.ts`, remove all life and knowledge keys from the `partialize` function (lines 2349-2358).

**Step 4: Verify Compilation Fails Only in UI Components Now**

Run: `npm run build`
Expected: TypeScript errors in UI components, but `store.ts` should compile cleanly.

**Step 5: Commit**

```bash
git add src/data/store.ts
git commit -m "refactor: remove Life and Knowledge state from Zustand store"
```

---

### Task 3: Clean up Database & Embed Blocks

**Files:**
- Modify: `src/lib/editor/markdownBlocks.ts`
- Modify: `src/components/editor/BlockRenderer.tsx`
- Modify: `src/components/editor/SlashCommandMenu.tsx`
- Modify: `src/components/editor/BlockOptionsMenu.tsx`
- Modify: `src/components/editor/NoteEditor.tsx`
- Delete: `src/components/editor/DatabaseBlock.tsx`

**Step 1: Update markdownBlocks.ts**

In `src/lib/editor/markdownBlocks.ts` (lines 321-325), remove `'embed'` and `'database'`:
```typescript
const VALID_TYPES = new Set([
  'paragraph', 'h1', 'h2', 'h3', 'bullet_list', 'ordered_list',
  'todo_item', 'code_block', 'quote', 'image', 'callout', 'divider'
]);
```

**Step 2: Clean BlockRenderer.tsx**

In `src/components/editor/BlockRenderer.tsx`, remove the `import { DatabaseBlock }` and remove the switch cases for `'database'` and `'embed'`.

**Step 3: Clean Editor Components**

In `SlashCommandMenu.tsx` and `BlockOptionsMenu.tsx`, remove the options that create or modify Database/Embed blocks. In `NoteEditor.tsx`, remove any specific handling for them.

**Step 4: Delete DatabaseBlock.tsx**

Run: `rm "src/components/editor/DatabaseBlock.tsx"`

**Step 5: Commit**

```bash
git add src/lib/editor/markdownBlocks.ts src/components/editor/
git commit -m "refactor: remove Database and Embed blocks"
```

---

### Task 4: Clean up SupabaseProvider

**Files:**
- Modify: `src/components/SupabaseProvider.tsx`

**Step 1: Remove sync logic**

In `src/components/SupabaseProvider.tsx`, remove the hooks to `setLifeData`, `getLifeData`, `setKnowledgeData`, and `getKnowledgeData` (lines 89-115). Remove the entire effect block that syncs these tables with Supabase.

**Step 2: Commit**

```bash
git add src/components/SupabaseProvider.tsx
git commit -m "refactor: remove Life and Knowledge sync from SupabaseProvider"
```

---

### Task 5: Sync schema.sql

**Files:**
- Modify: `supabase/schema.sql`

**Step 1: Remove old tables**

In `supabase/schema.sql`, completely delete lines 167-295. This removes:
- `habits`, `habit_checks`, `mood_entries`, `journal_entries`, `goals`, `routines`, `routine_checks`
- `resources`, `snippets`, `guides`
- All their RLS policies and `alter publication` statements

**Step 2: Add missing columns**

Consolidate the existing `ALTER TABLE` statements (lines 145-157) into the actual `CREATE TABLE` statements for `entities` and `tasks`.

In `entities` CREATE TABLE (line 13), add:
```sql
  workspace_id text,
  mode_id      text,
  widget_layout jsonb,
```

In `tasks` CREATE TABLE (line 33), add:
```sql
  workspace_id text,
  mode_id      text,
  subtasks     jsonb,
  completed_at bigint,
  description  text,
  user_due_date text,
```

Remove the redundant `ALTER TABLE` statements at the bottom of the file.

**Step 3: Commit**

```bash
git add supabase/schema.sql
git commit -m "chore: sync schema.sql to match production and remove dead tables"
```

---

### Task 6: Final Verification

**Step 1: Run build and tests**

Run: `npm run build`
Expected: Successfully compiles without errors.

Run: `npm run test`
Expected: All tests pass.

**Step 2: Commit**

```bash
git commit --allow-empty -m "chore: complete M1 cleanup"
```

## Execution Handoff

Plan complete and saved to `docs/plans/2026-06-27-local-first-m1-cleanup.md`. Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
