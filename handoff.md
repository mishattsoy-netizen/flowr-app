# Handoff Document

## What was accomplished
1. **Fixed Vercel image upload bug:** Images dragged/pasted into the chat were failing to upload in the live Vercel environment because it was trying to write to the local read-only filesystem (`fs.writeFileSync`). I rewrote `/api/ai/upload/route.ts` to upload to a `user_uploads` bucket in Supabase, falling back to a `dataUrl` safely. The user confirmed this works!

## The current unresolved issue
The user reported: **"shortcuts and recents are still sometimes clearing"**. 

## Investigation & Root Cause Analysis
I have heavily investigated this and found the exact architectural flaws causing `shortcuts` and `recentEntityIds` to randomly clear across devices. They both stem from dangerous boot-time logic in `src/components/SupabaseProvider.tsx`.

### 1. The Shortcuts Boot-Loop Race Condition
In `SupabaseProvider.tsx` (`mergeCloudData`), when it processes shortcuts, it does this:
```typescript
useStore.getState().setShortcutsState(cleaned);
// Push cleaned shortcuts back to Supabase so unscoped keys don't come back
import('@/lib/sync').then(({ upsertSetting }) => upsertSetting('shortcuts', cleaned));
```
**The Problem:** Every time the app loads and fetches data from Supabase, it immediately pushes the exact same shortcuts BACK to Supabase! This triggers a realtime `postgres_changes` UPDATE event. If the user had added a shortcut locally during the initial load time, this incoming broadcast (of their old shortcuts) blindly overwrites their local state, causing the new shortcut to "disappear".
**Solution:** Remove that `upsertSetting` call from boot. The "legacy unscoped keys" migration was weeks ago, so there's no reason to aggressively push back to Supabase on every app load. Furthermore, local shortcuts and cloud shortcuts should be merged gracefully rather than blindly overwriting `setShortcutsState(cleaned)`.

### 2. The Recents Aggressive Purge
In `SupabaseProvider.tsx` (`mergeCloudData`), there is a "VITAL FIX: PURGE DEAD ENTITIES FROM RECENTS" block:
```typescript
const currentEntities = useStore.getState().entities;
const validEntityIds = new Set([...currentEntities.map(e => e.id), ...spaces]);
const validRecent = merged.filter(id => validEntityIds.has(id)).slice(0, 15);
// Push cleaned recent back to Supabase
if (validRecent.length !== cloudRecent.length) {
  import('@/lib/sync').then(({ upsertSetting }) => upsertSetting('recentEntityIds', validRecent));
}
```
**The Problem:** It relies on `useStore.getState().entities` being 100% complete. If the user is on the live Vercel app (where SQLite doesn't pre-hydrate entities) and they have >1000 entities, or if the entities query failed/timed out, `currentEntities` will be missing valid items. This script then mistakenly assumes they are "dead" and purges them from `recentEntityIds`, and IMMEDIATELY pushes this blanked-out array to Supabase!
**Solution:** Remove this aggressive boot-time purge. If an entity is deleted on another device, the realtime `DELETE` event handler in `src/lib/sync.ts` should be updated to also filter the ID out of `recentEntityIds` (currently it only removes it from `entities`). 

## Next Agent Instructions
1. Go into `src/components/SupabaseProvider.tsx` and strip out the aggressive boot-time `upsertSetting` writes for both `shortcuts` and `recentEntityIds`.
2. Update the realtime `DELETE` entity listener in `src/lib/sync.ts` to manually clean up `recentEntityIds` if that entity is deleted.
3. Consider improving how `shortcuts` merge across devices if one device was offline.
