# Default Space + Orphan Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent orphan tasks/entities with `space_id = NULL` by introducing a "default space" concept and a guaranteed fallback chain.

**Architecture:** Add `is_default` column to `spaces` table (DB) → add `isDefault` to `Space` model + sync → UI options popup in SpaceSwitcher/ContextMenu → fix `resolveSpaceId` fallback on server → revert the workaround OR query. Backfill existing orphans via migration.

**Tech Stack:** Supabase/Postgres, TypeScript, React/Zustand, Next.js

---

### Task 1: Migration — `is_default` column + backfill + auto-register trigger

**Files:**
- Create: `supabase/migrations/20260709_spaces_is_default.sql`

- [ ] **Step 1: Write the migration**

Content of `supabase/migrations/20260709_spaces_is_default.sql`:

```sql
-- ─── Spaces: Add is_default column ───────────────────────────────
ALTER TABLE spaces ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;

-- At most one default per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_spaces_unique_default
  ON spaces(owner_id) WHERE is_default = true;

-- ─── Backfill: assign orphan rows to user's default space ────────

-- Tasks without a space_id → user's default space
UPDATE tasks t
SET space_id = s.id
FROM spaces s
WHERE t.owner_id = s.owner_id
  AND t.space_id IS NULL
  AND s.is_default = true;

-- Entities without a space_id → user's default space
UPDATE entities e
SET space_id = s.id
FROM spaces s
WHERE e.owner_id = s.owner_id
  AND e.space_id IS NULL
  AND s.is_default = true;

-- Remaining orphans (user has no default yet) → user's first space
UPDATE tasks t
SET space_id = s.id
FROM (
  SELECT DISTINCT ON (owner_id) id, owner_id
  FROM spaces
  WHERE owner_id IS NOT NULL
  ORDER BY owner_id, created_at ASC
) s
WHERE t.owner_id = s.owner_id
  AND t.space_id IS NULL;

UPDATE entities e
SET space_id = s.id
FROM (
  SELECT DISTINCT ON (owner_id) id, owner_id
  FROM spaces
  WHERE owner_id IS NOT NULL
  ORDER BY owner_id, created_at ASC
) s
WHERE e.owner_id = s.owner_id
  AND e.space_id IS NULL;

-- ─── Auto-register: create a "Main" space for new users ──────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.spaces (id, name, type, owner_id, is_default)
  VALUES ('space-' || gen_random_uuid(), 'Main', 'personal', NEW.id, true);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260709_spaces_is_default.sql
git commit -m "feat(spaces): add is_default column, backfill orphans, auto-register Main space"
```

---

### Task 2: Model + Sync — Add `isDefault` to Space

**Files:**
- Modify: `src/data/store.types.ts` (Space interface)
- Modify: `src/lib/sync.ts` (rowToWorkspace + workspaceToRow)

- [ ] **Step 1: Add `isDefault` to Space interface**

In `src/data/store.types.ts`, add to the `Space` interface (around line 33):

```ts
export interface Space {
  id: string;
  name: string;
  type: SpaceType;
  ownerId: string | null;
  createdAt: number;
  icon?: string;
  color?: string;
  settings?: Record<string, unknown>;
  syncMode: SyncMode;
  isDefault?: boolean;     // NEW: marks this space as user's default
}
```

- [ ] **Step 2: Add read mapping in `rowToWorkspace`**

In `src/lib/sync.ts`, find `function rowToWorkspace` (~line 69), add:

```ts
  isDefault:    row.is_default ?? undefined,  // NEW
```

- [ ] **Step 3: Add write mapping in `workspaceToRow`**

In `src/lib/sync.ts`, find `function workspaceToRow` (~line 83), add:

```ts
  if (w.isDefault) row.is_default = true;  // NEW
```

- [ ] **Step 4: Commit**

```bash
git add src/data/store.types.ts src/lib/sync.ts
git commit -m "feat(spaces): add isDefault to Space model and sync mapping"
```

---

### Task 3: Store — Login navigates to default space

**Files:**
- Modify: `src/data/store.ts`

- [ ] **Step 1: Add login behavior**

In `src/data/store.ts`, find where `setSpaces` is called during initial load, or add a `useEffect` in the root layout. Since `setSpaces` is already a store action, the simplest approach: modify `setSpaces` to also navigate to the default space.

Find the `setSpaces` action (~line 495):

```ts
setSpaces: (spaces) => set({ spaces }),
```

Change it to:

```ts
setSpaces: (spaces) => {
  set({ spaces });
  // If there's a default space and activeSpaceId isn't set to it, navigate to it
  const defaultSpace = spaces.find(s => s.isDefault);
  if (defaultSpace) {
    const currentActiveId = get().activeSpaceId;
    if (currentActiveId !== defaultSpace.id) {
      set({ activeSpaceId: defaultSpace.id });
      // Also update recent entity IDs
      const nextRecent = [defaultSpace.id, ...get().recentEntityIds.filter(rid => rid !== defaultSpace.id)].slice(0, 10);
      set({ recentEntityIds: nextRecent });
      import('@/lib/sync').then(({ upsertSetting }) => upsertSetting('recentEntityIds', nextRecent));
    }
  }
},
```

- [ ] **Step 2: Commit**

```bash
git add src/data/store.ts
git commit -m "feat(spaces): navigate to default space on login"
```

---

### Task 4: UI — SpaceSwitcher Options Popover

**Files:**
- Modify: `src/components/layout/SpaceSwitcher.tsx`

- [ ] **Step 1: Rewrite SpaceSwitcher space rows with Options button + popover**

Import the new icons:
```tsx
import { ChevronDown, Plus, Check, MoreVertical, Star } from 'lucide-react';
```

Add state for which space's options popover is open:
```tsx
const [optionsOpenFor, setOptionsOpenFor] = useState<string | null>(null);
```

Replace the current space row content (the `<button>` with `<Trash2>`) with:

```tsx
{spaces.map(ws => (
  <div key={ws.id} className="relative">
    <div
      onClick={() => { setActiveSpaceId(ws.id); setOpen(false); }}
      role="button"
      tabIndex={0}
      className={cn(
        "flex items-center w-full px-3 py-2 text-sm text-left gap-2 group",
        ws.id === activeSpaceId
          ? "bg-dark text-foreground"
          : "hover:bg-[var(--app-dark)] text-foreground/80 hover:text-foreground"
      )}
    >
      <span className="flex-1 text-fade">{ws.name}</span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOptionsOpenFor(optionsOpenFor === ws.id ? null : ws.id);
        }}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-white/10"
      >
        <MoreVertical strokeWidth={2} className="w-3.5 h-3.5 text-[var(--bone-50)] hover:text-[var(--bone-100)] shrink-0" />
      </button>
      {ws.id === activeSpaceId && (
        <Check strokeWidth={2} className="w-3.5 h-3.5 text-accent shrink-0" />
      )}
    </div>

    {/* Options popover */}
    {optionsOpenFor === ws.id && (
      <div className="absolute right-0 top-0 z-[60] bg-panel border border-border rounded-[var(--radius-medium)] shadow-lg py-1 min-w-[160px]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => {
            openModal({ kind: 'rename', entityId: ws.id });
            setOptionsOpenFor(null);
            setOpen(false);
          }}
          className="flex items-center w-full px-3 py-1.5 text-sm hover:bg-[var(--app-dark)] gap-2"
        >
          <Edit2 strokeWidth={2} className="w-3.5 h-3.5 shrink-0 text-[var(--bone-70)]" />
          <span>Rename</span>
        </button>

        <button
          onClick={() => {
            updateSpace(ws.id, { isDefault: true });
            setOptionsOpenFor(null);
            setOpen(false);
          }}
          disabled={ws.isDefault}
          className={cn(
            "flex items-center w-full px-3 py-1.5 text-sm gap-2",
            ws.isDefault
              ? "opacity-50 cursor-default"
              : "hover:bg-[var(--app-dark)]"
          )}
        >
          <Star strokeWidth={2} className={cn("w-3.5 h-3.5 shrink-0", ws.isDefault ? "text-accent" : "text-[var(--bone-70)]")} />
          <span>{ws.isDefault ? '✓ Default' : 'Set as default'}</span>
        </button>

        <div className="h-px bg-border mx-3 my-1" />

        <button
          onClick={() => {
            openModal({ kind: 'deleteSpaceConfirm', spaceId: ws.id });
            setOptionsOpenFor(null);
            setOpen(false);
          }}
          className="flex items-center w-full px-3 py-1.5 text-sm hover:bg-[var(--app-dark)] gap-2 text-red-400"
        >
          <Trash2 strokeWidth={2} className="w-3.5 h-3.5 shrink-0" />
          <span>Delete</span>
        </button>
      </div>
    )}
  </div>
))}
```

Also add `Edit2` and `Trash2` to the imports. Update the import line:

```tsx
import { ChevronDown, Plus, Check, MoreVertical, Star, Edit2, Trash2 } from 'lucide-react';
```

Remove `Trash2` from the old location. Also import `cn` (already imported) and `updateSpace` from the store — add it to the destructured store values.

- [ ] **Step 2: Commit**

```bash
git add src/components/layout/SpaceSwitcher.tsx
git commit -m "feat(ui): replace Trash with Options popover in SpaceSwitcher"
```

---

### Task 5: UI — ContextMenu spaces section

**Files:**
- Modify: `src/components/layout/ContextMenu.tsx`

- [ ] **Step 1: Replace inline rename/delete buttons with three-option group**

In `ContextMenu.tsx`, find the `isSpacesMenu` section (~line 304-342). Currently:

```tsx
if (isSpacesMenu) {
  return [
    ...spaces.map(ws => ({
      label: ws.name,
      selected: ws.id === (activeSpaceId || 'ws-personal'),
      hideCheckmark: true,
      rightElement: (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={(e) => { e.stopPropagation(); openModal({ kind: 'rename', entityId: ws.id }); closeContextMenu(); }}>
            <Edit2 strokeWidth={2} className="w-3.5 h-3.5 text-[var(--bone-50)] hover:text-[var(--bone-100)] shrink-0" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); openModal({ kind: 'deleteSpaceConfirm', spaceId: ws.id }); closeContextMenu(); }}>
            <Trash2 strokeWidth={2} className="w-3.5 h-3.5 text-[var(--bone-50)] hover:text-red-400 shrink-0" />
          </button>
        </div>
      ),
      onClick: () => { setActiveSpaceId(ws.id); closeContextMenu(); }
    })),
    { isDivider: true },
    {
      label: 'New space',
      icon: <Plus strokeWidth={2} className="w-4 h-4" />,
      onClick: () => { openModal({ kind: 'newWorkspace' }); closeContextMenu(); }
    }
  ];
}
```

Replace with:

```tsx
if (isSpacesMenu) {
  return [
    ...spaces.map(ws => ({
      label: ws.name,
      selected: ws.id === (activeSpaceId || 'ws-personal'),
      hideCheckmark: true,
      children: [
        {
          label: 'Rename',
          icon: <Edit2 strokeWidth={2} className="w-4 h-4 text-[var(--bone-70)]" />,
          onClick: () => { openModal({ kind: 'rename', entityId: ws.id }); closeContextMenu(); },
        },
        {
          label: ws.isDefault ? '✓ Default' : 'Set as default',
          icon: <Star strokeWidth={2} className="w-4 h-4" />,
          onClick: ws.isDefault ? undefined : () => { updateSpace(ws.id, { isDefault: true }); closeContextMenu(); },
        },
        { isDivider: true },
        {
          label: 'Delete',
          icon: <Trash2 strokeWidth={2} className="w-4 h-4" />,
          onClick: () => { openModal({ kind: 'deleteSpaceConfirm', spaceId: ws.id }); closeContextMenu(); },
          danger: true,
        },
      ],
      onClick: () => { setActiveSpaceId(ws.id); closeContextMenu(); }
    })),
    { isDivider: true },
    {
      label: 'New space',
      icon: <Plus strokeWidth={2} className="w-4 h-4" />,
      onClick: () => { openModal({ kind: 'newWorkspace' }); closeContextMenu(); }
    }
  ];
}
```

Also add `Star` to the imports from `lucide-react` if not already there, and destructure `updateSpace` from `useStore()`.

- [ ] **Step 2: Commit**

```bash
git add src/components/layout/ContextMenu.tsx
git commit -m "feat(ui): replace inline rename/delete with Options submenu in ContextMenu spaces"
```

---

### Task 6: Server — Fix `resolveSpaceId` fallback chain

**Files:**
- Modify: `src/lib/bot/tools/handlers.ts`

- [ ] **Step 1: Rewrite `resolveSpaceId`**

Find the current `resolveSpaceId` function (~line 7), replace entirely:

```ts
async function resolveSpaceId(context: any): Promise<string | null> {
  // 1. Context value takes priority
  if (context?.activeSpaceId) return context.activeSpaceId;

  if (context?.userId && context.userId !== 'anonymous') {
    // 2. Check profile
    const { data: user } = await supabaseAdmin!
      .from('profiles')
      .select('active_space_id')
      .eq('id', context.userId)
      .single();
    if (user?.active_space_id) return user.active_space_id;

    // 3. Check default space
    const { data: defaultSpace } = await supabaseAdmin!
      .from('spaces')
      .select('id')
      .eq('owner_id', context.userId)
      .eq('is_default', true)
      .maybeSingle();
    if (defaultSpace?.id) return defaultSpace.id;

    // 4. Any space at all
    const { data: anySpace } = await supabaseAdmin!
      .from('spaces')
      .select('id')
      .eq('owner_id', context.userId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (anySpace?.id) return anySpace.id;

    // 5. No spaces exist — create one
    const mainId = 'space-' + Date.now().toString();
    await supabaseAdmin!.from('spaces').insert({
      id: mainId,
      name: 'Main',
      type: 'personal',
      owner_id: context.userId,
      is_default: true,
      created_at: new Date().toISOString(),
    });
    return mainId;
  }

  return null;
}
```

- [ ] **Step 2: Revert the OR workaround query**

The earlier fix changed line 350-352 from:
```ts
if (spaceId) {
  query = query.eq('space_id', spaceId)
}
```
to:
```ts
if (spaceId) {
  query = query.or(`space_id.eq.${spaceId},space_id.is.null`)
}
```

Since the root cause is now fixed (no more null space_ids), revert it back:

```ts
if (spaceId) {
  query = query.eq('space_id', spaceId)
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/bot/tools/handlers.ts
git commit -m "fix(spaces): resolveSpaceId fallback chain + revert OR query workaround"
```

---

### Task 7: Run migration against Supabase

- [ ] **Step 1: Run the migration**

Open Supabase Dashboard → SQL Editor → run the contents of `20260709_spaces_is_default.sql`.

Or if Supabase CLI is available:
```bash
npx supabase db push
```

- [ ] **Step 2: Verify**

Check that:
```sql
SELECT is_default FROM spaces WHERE owner_id = 'a67b639a-ebdd-4a1d-b0ba-2a237f8fe843';
```
Returns `true` for one space.

```sql
SELECT count(*) FROM tasks WHERE space_id IS NULL;
SELECT count(*) FROM entities WHERE space_id IS NULL;
```
Both should return 0.

---

### Task 8: Push and deploy

- [ ] **Step 1: Push to remote**

```bash
cd "c:/Users/misha/Documents/Dev/flowr-app copy/flowr-app copy" && git push
```

- [ ] **Step 2: Test the bot**

Send "list all tasks" via Telegram — should now see all 22 tasks.
