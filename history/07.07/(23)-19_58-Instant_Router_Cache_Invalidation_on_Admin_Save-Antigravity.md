User request: "i said option b not a"

### 0. Date and time
2026-07-07 | 19:58 local time

### 1. User request
User clarified they wanted Option B (instant cache invalidation via a hook called on admin save), not Option A (timed 30-second revalidation). I had implemented Option A by mistake.

### 2. Objective Reconstruction
Implement proper cache invalidation so that any change made in the admin router UI instantly clears the Next.js `unstable_cache` used by `getRouterChain()` in `router-config.ts`.

### 3. Strategic Reasoning
The `getRouterChain()` function uses Next.js `unstable_cache` tagged with `'router-config'`. The correct way to bust this cache on demand is to call `revalidateTag('router-config')` from server actions that modify the router chains. The admin router `actions.ts` already had all the right save functions — they just needed `revalidateTag` added alongside the existing `revalidatePath` calls.

### 4. Detailed Blueprint
- `src/app/admin/router/actions.ts`: Add `revalidateTag` import and call it in all 4 mutation functions: `updateRouterChain`, `updateRouterSystemPrompt`, `saveRouterOrder`, `createRouterChain`.
- `src/lib/router-config.ts`: Revert `revalidate: 30` back to `revalidate: false`.

### 5. Operational Trace
- Added `revalidateTag` to the import on line 4 of actions.ts.
- Added `revalidateTag('router-config')` call to all 4 save actions.
- Reverted `router-config.ts` from `revalidate: 30` back to `revalidate: false`.

### 6. Status Assessment
Complete. Any change made via the admin router UI (adding/removing models, reordering, editing system prompts) will now instantly invalidate the chain cache. The next AI request after a save will always use the freshly loaded chain config from the database.
