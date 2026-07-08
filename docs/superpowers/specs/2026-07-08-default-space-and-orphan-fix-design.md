# Default Space + Orphan Fix Design

**Date:** 2026-07-08
**Status:** Design — approved

---

## Problem

Tasks and entities in the `tasks` and `entities` tables can have `space_id = NULL`. The bot's `list_content` tool filters by `space_id` (scoped to the active space), so these orphan rows are invisible to the bot. They're visible in the web app because the UI displays everything from the local store regardless of `space_id`.

## Solution

Three-part fix: (1) prevent future orphans via a guaranteed fallback chain, (2) add a "Set as default" UI concept so users can designate their main space, (3) backfill existing orphans.

---

## 1. Database — `is_default` column

**Migration:** `supabase/migrations/20260709_spaces_is_default.sql`

```sql
ALTER TABLE spaces ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;

-- Partial unique index: at most one default per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_spaces_unique_default 
  ON spaces(owner_id) WHERE is_default = true;
```

### Model changes (`store.types.ts`)

```ts
export interface Space {
  // ...existing fields...
  isDefault?: boolean;  // NEW
}
```

### Sync changes (`sync.ts`)

**`rowToWorkspace`** (DB → model, line ~69):
```ts
return {
  id:           row.id,
  name:         row.name,
  type:         row.type ?? 'personal',
  ownerId:      row.owner_id ?? null,
  createdAt:    parseTimestamp(row.created_at) ?? 0,
  icon:         row.icon ?? undefined,
  color:        row.color ?? undefined,
  settings:     row.settings ?? undefined,
  syncMode:     row.sync_mode ?? 'full-sync',
  isDefault:    row.is_default ?? undefined,  // NEW
};
```

**`workspaceToRow`** (model → DB, line ~83):
```ts
function workspaceToRow(w: Space): Record<string, any> {
  const row: Record<string, any> = {
    id:            w.id,
    name:          w.name,
    type:          w.type,
  };
  if (w.ownerId)  row.owner_id = w.ownerId;
  if (w.icon)     row.icon     = w.icon;
  if (w.color)    row.color    = w.color;
  if (w.settings) row.settings = w.settings;
  if (w.syncMode) row.sync_mode = w.syncMode;
  if (w.isDefault) row.is_default = true;  // NEW
  ...
```

---

## 2. UI — Options Popup

### SpaceSwitcher.tsx (sidebar header dropdown)

**Before:** Each space row in the dropdown shows a Trash icon on hover.

**After:** Each space row shows an Options button (⋮) on hover. Clicking opens a small popover with:

| Option | Action |
|--------|--------|
| ✏️ Rename | `openModal({ kind: 'rename', entityId })` — existing modal |
| ⭐ Set as default | `updateSpace(id, { isDefault: true })` — if already default: show ✅ Default (disabled) |
| 🗑️ Delete | `openModal({ kind: 'deleteSpaceConfirm', spaceId })` — existing modal, marked danger |

### ContextMenu.tsx (right-click spaces section)

**Before:** Each space row has separate Edit2 (rename) and Trash2 (delete) inline buttons.

**After:** Replace the two inline buttons with the same three-option group in the right-click menu.

---

## 3. Server-Side — Fallback Chain

### Fix `resolveSpaceId` (in `handlers.ts`)

Current bug: `profiles.active_space_id` overwrites `context.activeSpaceId` even when null.

New chain (first non-null wins):

1. `context.activeSpaceId`
2. `profiles.active_space_id` (query profile table)
3. `spaces.is_default = true` for the user
4. First space in `spaces` table for the user (`ORDER BY created_at ASC LIMIT 1`)
5. If no spaces exist → create a "Main" space with `is_default = true` for the user

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
    
    // 4. Any space
    const { data: anySpace } = await supabaseAdmin!
      .from('spaces')
      .select('id')
      .eq('owner_id', context.userId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (anySpace?.id) return anySpace.id;
    
    // 5. Create Main space
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

### Auto-registration

New users get a "Main" space created automatically. This happens via step 5 of `resolveSpaceId` on first creation call, OR a Supabase trigger on `auth.users` insert:

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.spaces (id, name, type, owner_id, is_default)
  VALUES ('space-' || gen_random_uuid(), 'Main', 'personal', NEW.id, true);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### Login behavior

In the frontend store initialization — specifically after `setSpaces()` is called during initial data load: if the user has a space with `isDefault = true` and `activeSpaceId !== defaultSpace.id`, call `setActiveSpaceId(defaultSpace.id)`. This ensures they always land on their default space at login.

**Where:** In `useStore`'s initial load handler (after fetching spaces from DB), or in a `useEffect` in the root layout that watches spaces load for the first time.

---

## 4. Backfill Orphans

Run in the same migration file:

```sql
-- 1. Assign null space_id rows to user's default space
UPDATE tasks t
SET space_id = s.id
FROM spaces s
WHERE t.owner_id = s.owner_id
  AND t.space_id IS NULL
  AND s.is_default = true;

UPDATE entities e
SET space_id = s.id
FROM spaces s
WHERE e.owner_id = s.owner_id
  AND e.space_id IS NULL
  AND s.is_default = true;

-- 2. For users with no default space yet, assign to their first space
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
```

---

## Files to modify

| File | Change |
|------|--------|
| `supabase/migrations/20260709_spaces_is_default.sql` | New: add `is_default`, backfill orphans, trigger |
| `src/data/store.types.ts` | Add `isDefault?: boolean` to `Space` |
| `src/data/store.ts` | Update `createSpace`, login behavior for default space |
| `src/lib/sync.ts` | `workspaceToRow` + read mapping for `is_default` |
| `src/components/layout/SpaceSwitcher.tsx` | Replace Trash with Options ⋮ → popover |
| `src/components/layout/ContextMenu.tsx` | Replace inline rename/delete with three options |
| `src/lib/bot/tools/handlers.ts` | Fix `resolveSpaceId` fallback chain |
