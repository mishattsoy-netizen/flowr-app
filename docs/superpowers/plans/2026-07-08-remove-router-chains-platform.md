# Remove `router_chains.platform` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the dead `router_chains.platform` column (never read by the runtime routing path) and simplify the two `message_logs`-derived platform displays (Logs and Feedback admin pages), without touching the dormant Telegram bot integration itself.

**Architecture:** A migration drops the `app`-platform rows, the `platform` column, and its unique index, replacing it with a `(category, mode)` unique index. Every function/component that currently threads a `platform` parameter purely to satisfy `router_chains` queries has that parameter removed. The Logs/Feedback pages' platform filter and badge — derived from `message_logs.telegram_id`, unrelated to `router_chains` — are simplified to not display a distinction that's slated for redesign once the Telegram connector work happens.

**Tech Stack:** Next.js server actions, Supabase (Postgres), React client components, Vitest.

---

## Reference: current state (verified by direct inspection during planning)

- `router_chains` table: primary key `(category, platform)` was already manually dropped via `ALTER TABLE router_chains DROP CONSTRAINT router_chains_pkey;` during this session's debugging (not yet captured in a migration file). Current uniqueness is enforced by `router_chains_category_platform_mode_key` (a unique index on `(category, platform, mode)`, created by [20260707_router_chains_mode.sql](../../../supabase/migrations/20260707_router_chains_mode.sql)).
- `getRouterChain`/`fetchRouterChainFromDb` in [router-config.ts](../../../src/lib/router-config.ts) hardcode `.eq('platform', 'telegram')` ([router-config.ts:52](../../../src/lib/router-config.ts#L52)) and `platform: 'telegram'` in the self-healing insert ([router-config.ts:80](../../../src/lib/router-config.ts#L80)) — confirmed this is the only runtime read path for `router_chains`, and it never varies by caller.
- `Platform` type exported at [router-config.ts:29](../../../src/lib/router-config.ts#L29): `export type Platform = 'telegram'` — unused single-value union. Confirmed via `grep -rn "import.*Platform" src/ --include="*.ts" --include="*.tsx"` returning zero matches: nothing imports it.
- Admin Router Matrix call chain threading `platform: 'app' | 'telegram'`: [router/actions.ts](../../../src/app/admin/router/actions.ts) (`getRouterChains`, `getRouterOrder`, `saveRouterOrder`, `createRouterChain`), [router/page.tsx](../../../src/app/admin/router/page.tsx) (`RouterPageContent`), [RouterMatrixGrid.tsx](../../../src/components/admin/RouterMatrixGrid.tsx), [RouterCategoryCard.tsx](../../../src/components/admin/RouterCategoryCard.tsx), [AddCategoryButton.tsx](../../../src/components/admin/AddCategoryButton.tsx), [SortableRouterGrid.tsx](../../../src/components/admin/SortableRouterGrid.tsx) (orphaned — no importer exists, confirmed via `grep -rln "SortableRouterGrid" src/`, but still updated for consistency since it's dead code that shouldn't be left half-migrated).
- Dead prompt-sync block: [bot/global/actions.ts:108-126](../../../src/app/admin/bot/global/actions.ts#L108) ("5. Compaction prompt → router_chains") upserts into `router_chains.system_prompt` with `onConflict: 'category,platform'` — this `onConflict` clause already doesn't match any real constraint (the actual unique key is `(category, platform, mode)` today, soon `(category, mode)`), and the column it writes is never read by `chainRouter.ts` (confirmed: chain prompts come from static files in `src/lib/bot/prompts/chains/`).
- `message_logs.telegram_id`-derived platform (unrelated subsystem): [logs/actions.ts](../../../src/app/admin/logs/actions.ts) (`Exchange.platform`, `getMessageExchanges`'s `platform` option, `getMessageLogs`'s `platform` option), [logs/LogsTable.tsx](../../../src/app/admin/logs/LogsTable.tsx) (`Filters.platform`, the app/telegram/all filter button row), [bot/feedback/actions.ts](../../../src/app/admin/bot/feedback/actions.ts) (`platform: l?.telegram_id ? 'telegram' : 'app'` field), [bot/feedback/FeedbackClient.tsx:326-329](../../../src/app/admin/bot/feedback/FeedbackClient.tsx#L326) (Globe/Bot icon badge). `logs/page.tsx` does not pass `platform` to `getMessageExchanges`, so no change needed there.
- Full design rationale: [docs/superpowers/specs/2026-07-08-remove-router-chains-platform-design.md](../specs/2026-07-08-remove-router-chains-platform-design.md).

## Out of scope (per spec)

- `src/lib/bot/telegram.ts`, `src/app/api/telegram/webhook/route.ts`, `src/lib/bot/notifications.ts`, `src/lib/bot/usageGuard.ts` — kept as-is, dormant, pending a dedicated future design for Telegram as an account-linked connector.
- `message_logs.telegram_id` column and its data — kept as-is; only the UI displays derived from it are simplified.
- Any change to `chainRouter.ts`'s routing logic or the mode-based (Default/Pro) routing already shipped.

---

## Task 1: Schema migration

**Files:**
- Create: `supabase/migrations/20260708_drop_router_chains_platform.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Migration: 20260708_drop_router_chains_platform.sql
-- Description: router_chains.platform was never read by the runtime routing
-- path (getRouterChain hardcodes platform='telegram' regardless of caller),
-- making every platform='app' row dead data. This migration removes the
-- column and collapses the unique key to (category, mode).
-- See docs/superpowers/specs/2026-07-08-remove-router-chains-platform-design.md

-- Sanity check before deleting: log how many 'app' rows exist and confirm
-- none have a non-empty model_list (i.e. confirm they're genuinely dead,
-- not silently-used real config). This raises a notice, does not abort —
-- reviewed manually before this migration is applied to production.
DO $$
DECLARE
  app_row_count INTEGER;
  app_rows_with_models INTEGER;
BEGIN
  SELECT COUNT(*) INTO app_row_count FROM router_chains WHERE platform = 'app';
  SELECT COUNT(*) INTO app_rows_with_models
    FROM router_chains
    WHERE platform = 'app' AND jsonb_array_length(model_list) > 0;
  RAISE NOTICE 'router_chains: % rows with platform=app, % of those have non-empty model_list', app_row_count, app_rows_with_models;
END $$;

DELETE FROM router_chains WHERE platform = 'app';

DROP INDEX IF EXISTS router_chains_category_platform_mode_key;

ALTER TABLE router_chains DROP COLUMN IF EXISTS platform;

CREATE UNIQUE INDEX IF NOT EXISTS router_chains_category_mode_key
  ON router_chains (category, mode);
```

- [ ] **Step 2: Apply the migration and verify the NOTICE output**

Apply via the project's Supabase migration workflow (SQL editor or CLI). Read the `RAISE NOTICE` output in the query results/logs before it proceeds to the `DELETE` — if `app_rows_with_models` is anything other than `0`, **stop and investigate** before continuing (this would mean an `app` row has real config that the earlier design-phase audit missed, and deleting it would be destructive). Per this session's earlier SQL audit, all `app` rows had `model_list: []`, so `0` is the expected value.

- [ ] **Step 3: Verify the resulting schema**

```sql
SELECT column_name FROM information_schema.columns WHERE table_name = 'router_chains';
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'router_chains';
SELECT category, mode, jsonb_array_length(model_list) AS model_count FROM router_chains ORDER BY category, mode;
```

Expected: `platform` is absent from the column list; `router_chains_category_mode_key` exists as a unique index on `(category, mode)`; every remaining row has exactly one `default` and (where created) one `pro` row per category, no duplicates.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260708_drop_router_chains_platform.sql
git commit -m "feat(router): drop dead router_chains.platform column"
```

---

## Task 2: `src/lib/router-config.ts`

**Files:**
- Modify: `src/lib/router-config.ts`
- Test: `src/lib/router-config.test.ts` (may not exist yet — create if the codebase has no prior test file for this module; check first)

- [ ] **Step 1: Check for an existing test file**

Run: `ls src/lib/router-config.test.ts 2>/dev/null || echo "no existing test file"`

If tests for `resolveChainWithFallback` already exist from the earlier mode-based-router-chains plan, this task extends that file rather than creating a new one.

- [ ] **Step 2: Remove `platform` from the query and self-healing insert**

At [router-config.ts:47-55](../../../src/lib/router-config.ts#L47):

```typescript
// Before:
const [chainResult, tempsResult, budgetsResult, modelsResult] = await Promise.all([
  supabase
    .from('router_chains')
    .select('model_list')
    .eq('category', category)
    .eq('platform', 'telegram')
    .eq('mode', mode)
    .limit(1)
    .maybeSingle(),
  // ...
])

// After:
const [chainResult, tempsResult, budgetsResult, modelsResult] = await Promise.all([
  supabase
    .from('router_chains')
    .select('model_list')
    .eq('category', category)
    .eq('mode', mode)
    .limit(1)
    .maybeSingle(),
  // ...
])
```

At [router-config.ts:74-89](../../../src/lib/router-config.ts#L74):

```typescript
// Before:
if (!chainResult.data) {
  // Self-healing: if the category is missing, attempt to create a default entry
  if (category === 'VISION' || category === 'CODING' || category === 'IMAGE_GEN') {
    try {
      await supabase.from('router_chains').insert({
        category,
        platform: 'telegram',
        mode: 'default',
        model_list: [],
        is_enabled: true,
      })
      logger.info(`Created missing router chain entry for: ${category}`)
    } catch (e) {
      logger.error(`Failed to self-heal missing category ${category}:`, e)
    }
  }
  return { chain: [] }
}

// After:
if (!chainResult.data) {
  // Self-healing: if the category is missing, attempt to create a default entry
  if (category === 'VISION' || category === 'CODING' || category === 'IMAGE_GEN') {
    try {
      await supabase.from('router_chains').insert({
        category,
        mode: 'default',
        model_list: [],
        is_enabled: true,
      })
      logger.info(`Created missing router chain entry for: ${category}`)
    } catch (e) {
      logger.error(`Failed to self-heal missing category ${category}:`, e)
    }
  }
  return { chain: [] }
}
```

- [ ] **Step 3: Remove the unused `Platform` type**

At [router-config.ts:29](../../../src/lib/router-config.ts#L29):

```typescript
// Delete this line entirely:
export type Platform = 'telegram'
```

Before deleting, confirm nothing imports it:

Run: `grep -rn "import.*{ *Platform *}\|import.*Platform.*from.*router-config" src/ --include="*.ts" --include="*.tsx"`
Expected: no matches. If any are found, remove the import at that call site too (it can only have been importing an unused type, since this migration removes the concept entirely).

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors from this file. (Downstream call sites still passing a `platform` argument to `getRouterChain` don't exist — `getRouterChain`'s signature is `(category, mode)`, never took `platform`, so this change is isolated to this file.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/router-config.ts
git commit -m "feat(router): stop filtering router_chains by platform in getRouterChain"
```

---

## Task 3: Admin Router Matrix — `actions.ts`

**Files:**
- Modify: `src/app/admin/router/actions.ts`

- [ ] **Step 1: Remove `platform` from `getRouterChains`**

At [actions.ts:7-38](../../../src/app/admin/router/actions.ts#L7):

```typescript
// Before:
export async function getRouterChains(platform: 'app' | 'telegram') {
  // Purge any legacy IMAGE_UPSCALE rows from the database
  await supabase
    .from('router_chains')
    .delete()
    .eq('category', 'IMAGE_UPSCALE')

  const { data, error } = await supabase
    .from('router_chains')
    .select('*')
    .eq('platform', platform)

  if (error) throw error

  const filtered = (data ?? []).filter((r: any) => r.category !== 'IMAGE_UPSCALE')

  // Try to get custom order
  const order = await getRouterOrder(platform)
  if (order && order.length > 0) {
    return filtered.sort((a: any, b: any) => {
      const indexA = order.indexOf(a.id)
      const indexB = order.indexOf(b.id)
      if (indexA === -1 && indexB === -1) return 0
      if (indexA === -1) return 1
      if (indexB === -1) return -1
      return indexA - indexB
    })
  }

  // Fallback to category alphabetical order
  return filtered.sort((a: any, b: any) => a.category.localeCompare(b.category))
}

// After:
export async function getRouterChains() {
  // Purge any legacy IMAGE_UPSCALE rows from the database
  await supabase
    .from('router_chains')
    .delete()
    .eq('category', 'IMAGE_UPSCALE')

  const { data, error } = await supabase
    .from('router_chains')
    .select('*')

  if (error) throw error

  const filtered = (data ?? []).filter((r: any) => r.category !== 'IMAGE_UPSCALE')

  // Try to get custom order
  const order = await getRouterOrder()
  if (order && order.length > 0) {
    return filtered.sort((a: any, b: any) => {
      const indexA = order.indexOf(a.id)
      const indexB = order.indexOf(b.id)
      if (indexA === -1 && indexB === -1) return 0
      if (indexA === -1) return 1
      if (indexB === -1) return -1
      return indexA - indexB
    })
  }

  // Fallback to category alphabetical order
  return filtered.sort((a: any, b: any) => a.category.localeCompare(b.category))
}
```

- [ ] **Step 2: Remove `platform` from `getRouterOrder`/`saveRouterOrder`**

At [actions.ts:40-64](../../../src/app/admin/router/actions.ts#L40):

```typescript
// Before:
export async function getRouterOrder(platform: 'app' | 'telegram'): Promise<string[]> {
  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('key', `router_chains_order_${platform}`)
    .limit(1)
    .maybeSingle()
  return (data?.value as string[]) ?? []
}

export async function saveRouterOrder(platform: 'app' | 'telegram', order: string[]) {
  const { error } = await supabase
    .from('settings')
    .upsert({
      key: `router_chains_order_${platform}`,
      value: order,
      updated_at: new Date().toISOString()
    })
  if (error) throw error
  revalidatePath('/admin/app/router')
  revalidatePath('/admin/telegram/router')
  // @ts-ignore
  revalidateTag('router-config')
  return { success: true }
}

// After:
export async function getRouterOrder(): Promise<string[]> {
  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'router_chains_order')
    .limit(1)
    .maybeSingle()
  return (data?.value as string[]) ?? []
}

export async function saveRouterOrder(order: string[]) {
  const { error } = await supabase
    .from('settings')
    .upsert({
      key: 'router_chains_order',
      value: order,
      updated_at: new Date().toISOString()
    })
  if (error) throw error
  revalidatePath('/admin/router')
  // @ts-ignore
  revalidateTag('router-config')
  return { success: true }
}
```

Note: this changes the `settings` key from `router_chains_order_app`/`router_chains_order_telegram` to a single `router_chains_order` — any previously saved custom card order under the old keys is not migrated (acceptable: it's a cosmetic ordering preference, not data loss, and the fallback is alphabetical order which still works correctly).

- [ ] **Step 3: Remove `platform` from `createRouterChain`**

At [actions.ts:104-142](../../../src/app/admin/router/actions.ts#L104):

```typescript
// Before:
export async function createRouterChain(platform: 'app' | 'telegram', category: string, mode: 'default' | 'pro' = 'default') {
  // Seed a new Pro override with the Default chain's current model_list, so it
  // starts as a working copy instead of an empty chain the admin has to
  // rebuild from scratch. Still fully independent once created.
  // (system_prompt is copied too for parity but isn't read by the runtime
  // pipeline — chainRouter builds prompts from the static prompt files.)
  let seedModelList: any[] = []
  let seedSystemPrompt = ''
  if (mode === 'pro') {
    const { data: defaultChain } = await supabase
      .from('router_chains')
      .select('model_list, system_prompt')
      .eq('platform', platform)
      .eq('category', category)
      .eq('mode', 'default')
      .maybeSingle()
    if (defaultChain) {
      seedModelList = defaultChain.model_list ?? []
      seedSystemPrompt = defaultChain.system_prompt ?? ''
    }
  }

  const { error } = await supabase
    .from('router_chains')
    .insert({
      platform,
      category,
      mode,
      model_list: seedModelList,
      system_prompt: seedSystemPrompt
    })

  if (error) throw error
  revalidatePath('/admin/app/router')
  revalidatePath('/admin/telegram/router')
  // @ts-ignore
  revalidateTag('router-config')
  return { success: true }
}

// After:
export async function createRouterChain(category: string, mode: 'default' | 'pro' = 'default') {
  // Seed a new Pro override with the Default chain's current model_list, so it
  // starts as a working copy instead of an empty chain the admin has to
  // rebuild from scratch. Still fully independent once created.
  // (system_prompt is copied too for parity but isn't read by the runtime
  // pipeline — chainRouter builds prompts from the static prompt files.)
  let seedModelList: any[] = []
  let seedSystemPrompt = ''
  if (mode === 'pro') {
    const { data: defaultChain } = await supabase
      .from('router_chains')
      .select('model_list, system_prompt')
      .eq('category', category)
      .eq('mode', 'default')
      .maybeSingle()
    if (defaultChain) {
      seedModelList = defaultChain.model_list ?? []
      seedSystemPrompt = defaultChain.system_prompt ?? ''
    }
  }

  const { error } = await supabase
    .from('router_chains')
    .insert({
      category,
      mode,
      model_list: seedModelList,
      system_prompt: seedSystemPrompt
    })

  if (error) throw error
  revalidatePath('/admin/router')
  // @ts-ignore
  revalidateTag('router-config')
  return { success: true }
}
```

- [ ] **Step 4: Simplify the remaining `revalidatePath('/admin/app/router')` + `revalidatePath('/admin/telegram/router')` pairs to a single path**

Every other function in this file (`updateRouterChain`, `updateRouterSystemPrompt`, `setFallbackMode`, `setRouterTemperature`, `saveInternalPrompt`, `resetInternalPrompt`, `syncInternalPromptsFromFiles`, `saveStatusMessage`, `savePipelineSetting`, `saveSubchainConfigsAction`) calls both `revalidatePath('/admin/app/router')` and `revalidatePath('/admin/telegram/router')` back-to-back. Since both routes now render identical (platform-less) content — confirmed in Task 4 — a single revalidate covers both pages either way, but for consistency replace every such pair with a single call. Example (repeat this exact substitution at each of the 10 remaining occurrences in the file, one per listed function):

```typescript
// Before (appears in each of the 10 functions listed above):
revalidatePath('/admin/app/router')
revalidatePath('/admin/telegram/router')

// After:
revalidatePath('/admin/router')
```

Run `grep -n "revalidatePath('/admin/app/router')" src/app/admin/router/actions.ts` to find every occurrence before editing — replace each pair.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: errors will surface at every caller of `getRouterChains`, `getRouterOrder`, `saveRouterOrder`, `createRouterChain` still passing a `platform` argument — these are exactly the call sites fixed in Tasks 4-6. Do not attempt to silence these errors in this task; they're expected and guide the remaining tasks.

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/router/actions.ts
git commit -m "feat(router): remove platform parameter from router admin actions"
```

---

## Task 4: Admin Router Matrix — page and client components

**Files:**
- Modify: `src/app/admin/router/page.tsx`
- Modify: `src/components/admin/RouterMatrixGrid.tsx`
- Modify: `src/components/admin/RouterCategoryCard.tsx`
- Modify: `src/components/admin/AddCategoryButton.tsx`

- [ ] **Step 1: Simplify `page.tsx` — one router, no platform argument**

Current content of [router/page.tsx](../../../src/app/admin/router/page.tsx):

```typescript
import { getRouterChains } from './actions'
import { getModels } from '@/app/admin/models/actions'
import RouterMatrixGrid from '@/components/admin/RouterMatrixGrid'

export async function RouterPageContent({ platform }: { platform: 'app' | 'telegram' }) {
  const [routers, models] = await Promise.all([getRouterChains(platform), getModels()])

  // Group rows by category so the grid can toggle all cards between default/pro at once
  const byCategory: Record<string, { default?: any; pro?: any }> = {}
  for (const router of routers) {
    const entry = byCategory[router.category] ?? {}
    entry[router.mode === 'pro' ? 'pro' : 'default'] = router
    byCategory[router.category] = entry
  }

  return <RouterMatrixGrid platform={platform} byCategory={byCategory} models={models} />
}

export default async function RouterPage() {
  return <RouterPageContent platform="telegram" />
}
```

Replace with:

```typescript
import { getRouterChains } from './actions'
import { getModels } from '@/app/admin/models/actions'
import RouterMatrixGrid from '@/components/admin/RouterMatrixGrid'

export async function RouterPageContent() {
  const [routers, models] = await Promise.all([getRouterChains(), getModels()])

  // Group rows by category so the grid can toggle all cards between default/pro at once
  const byCategory: Record<string, { default?: any; pro?: any }> = {}
  for (const router of routers) {
    const entry = byCategory[router.category] ?? {}
    entry[router.mode === 'pro' ? 'pro' : 'default'] = router
    byCategory[router.category] = entry
  }

  return <RouterMatrixGrid byCategory={byCategory} models={models} />
}

export default async function RouterPage() {
  return <RouterPageContent />
}
```

- [ ] **Step 2: Update the one other caller of `RouterPageContent`**

`RouterPageContent` has exactly one caller besides `page.tsx`'s own default export (confirmed via `grep -rln "RouterPageContent" src/ --include="*.tsx"`): [src/app/admin/telegram/router/page.tsx](../../../src/app/admin/telegram/router/page.tsx).

```typescript
// Before:
import { RouterPageContent } from '../../router/page'

export default async function TelegramRouterPage() {
  return <RouterPageContent platform="telegram" />
}

// After:
import { RouterPageContent } from '../../router/page'

export default async function TelegramRouterPage() {
  return <RouterPageContent />
}
```

(This route now renders identical content to `/admin/router` — no route deletion needed, per the spec's decision to avoid a routing change outside this fix's scope.)

- [ ] **Step 3: Update `RouterMatrixGrid.tsx`**

Current content of [RouterMatrixGrid.tsx](../../../src/components/admin/RouterMatrixGrid.tsx):

```typescript
'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import RouterCategoryCard from './RouterCategoryCard'
import AddCategoryButton from './AddCategoryButton'
import type { RegistryModel } from './model-utils'

const ALL_CATEGORIES = [
  'REGULAR', 'COMPLEX', 'VISION', 'CODING', 'WEB_SEARCH', 'RESEARCH',
  'IMAGE_GEN', 'AUDIO', 'CLASSIFIER', 'THINKING', 'ADVISOR', 'COMPACTION',
]

export default function RouterMatrixGrid({
  platform,
  byCategory,
  models,
}: {
  platform: 'app' | 'telegram'
  byCategory: Record<string, { default?: any; pro?: any }>
  models: RegistryModel[]
}) {
  const [mode, setMode] = useState<'default' | 'pro'>('default')

  return (
    <div className="space-y-[10px] animate-in fade-in duration-500">
      <div className="mb-2 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-display font-medium text-foreground mb-1">Router Matrix</h1>
          <p className="text-muted-foreground text-sm font-medium">
            Chain routing configuration — each chain is a mini-orchestrator with input/output contracts. Pro falls back to Default when unconfigured.
          </p>
        </div>

        <div className="flex items-center gap-1 shrink-0 mt-2">
          <button
            onClick={() => setMode('default')}
            className={cn(
              'px-3 py-1 rounded-sm text-[10px] font-bold uppercase tracking-wide transition-all duration-0',
              mode === 'default' ? 'bg-accent/20 text-accent' : 'text-bone-60 hover:text-foreground hover:bg-white/5'
            )}
          >
            Default
          </button>
          <button
            onClick={() => setMode('pro')}
            className={cn(
              'px-3 py-1 rounded-sm text-[10px] font-bold uppercase tracking-wide transition-all duration-0',
              mode === 'pro' ? 'bg-accent/20 text-accent' : 'text-bone-60 hover:text-foreground hover:bg-white/5'
            )}
          >
            Pro
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {ALL_CATEGORIES.map((category) => {
          const entry = byCategory[category]

          if (!entry?.default) {
            return <AddCategoryButton key={category} platform={platform} category={category} mode="default" />
          }

          return (
            <RouterCategoryCard
              key={category}
              platform={platform}
              category={category}
              mode={mode}
              defaultChain={entry.default}
              proChain={entry.pro ?? null}
              availableModels={models}
            />
          )
        })}
      </div>
    </div>
  )
}
```

Replace with (only the `platform` prop and its two threaded usages change):

```typescript
'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import RouterCategoryCard from './RouterCategoryCard'
import AddCategoryButton from './AddCategoryButton'
import type { RegistryModel } from './model-utils'

const ALL_CATEGORIES = [
  'REGULAR', 'COMPLEX', 'VISION', 'CODING', 'WEB_SEARCH', 'RESEARCH',
  'IMAGE_GEN', 'AUDIO', 'CLASSIFIER', 'THINKING', 'ADVISOR', 'COMPACTION',
]

export default function RouterMatrixGrid({
  byCategory,
  models,
}: {
  byCategory: Record<string, { default?: any; pro?: any }>
  models: RegistryModel[]
}) {
  const [mode, setMode] = useState<'default' | 'pro'>('default')

  return (
    <div className="space-y-[10px] animate-in fade-in duration-500">
      <div className="mb-2 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-display font-medium text-foreground mb-1">Router Matrix</h1>
          <p className="text-muted-foreground text-sm font-medium">
            Chain routing configuration — each chain is a mini-orchestrator with input/output contracts. Pro falls back to Default when unconfigured.
          </p>
        </div>

        <div className="flex items-center gap-1 shrink-0 mt-2">
          <button
            onClick={() => setMode('default')}
            className={cn(
              'px-3 py-1 rounded-sm text-[10px] font-bold uppercase tracking-wide transition-all duration-0',
              mode === 'default' ? 'bg-accent/20 text-accent' : 'text-bone-60 hover:text-foreground hover:bg-white/5'
            )}
          >
            Default
          </button>
          <button
            onClick={() => setMode('pro')}
            className={cn(
              'px-3 py-1 rounded-sm text-[10px] font-bold uppercase tracking-wide transition-all duration-0',
              mode === 'pro' ? 'bg-accent/20 text-accent' : 'text-bone-60 hover:text-foreground hover:bg-white/5'
            )}
          >
            Pro
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {ALL_CATEGORIES.map((category) => {
          const entry = byCategory[category]

          if (!entry?.default) {
            return <AddCategoryButton key={category} category={category} mode="default" />
          }

          return (
            <RouterCategoryCard
              key={category}
              category={category}
              mode={mode}
              defaultChain={entry.default}
              proChain={entry.pro ?? null}
              availableModels={models}
            />
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Update `RouterCategoryCard.tsx`**

Current content of [RouterCategoryCard.tsx](../../../src/components/admin/RouterCategoryCard.tsx):

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import RouterManager from './RouterManager'
import { createRouterChain } from '@/app/admin/router/actions'
import type { RegistryModel } from './model-utils'

export default function RouterCategoryCard({
  platform,
  category,
  mode,
  defaultChain,
  proChain,
  availableModels,
}: {
  platform: 'app' | 'telegram'
  category: string
  mode: 'default' | 'pro'
  defaultChain: any
  proChain: any | null
  availableModels?: RegistryModel[]
}) {
  const router = useRouter()
  const [isCreating, setIsCreating] = useState(false)
  const activeChain = mode === 'default' ? defaultChain : proChain

  const handleCreatePro = async () => {
    setIsCreating(true)
    try {
      await createRouterChain(platform, category, 'pro')
      router.refresh()
    } catch (e) {
      console.error(e)
    } finally {
      setIsCreating(false)
    }
  }

  if (activeChain) {
    return (
      <RouterManager
        key={activeChain.id}
        chain={activeChain}
        title={`${category.replace(/_/g, ' ')} (${mode === 'default' ? 'Default' : 'Pro'})`}
        category={category}
        availableModels={availableModels}
      />
    )
  }

  return (
    <button
      onClick={handleCreatePro}
      disabled={isCreating}
      className="group flex flex-col items-center justify-center gap-3 p-8 bg-white/[0.02] border border-[var(--bone-6)] rounded-big hover:bg-accent/5 transition-all w-full disabled:opacity-50"
    >
      <div className="text-center">
        <div className="text-[11px] font-ui-label font-bold text-muted-foreground uppercase tracking-widest opacity-40 group-hover:opacity-100">
          {isCreating ? 'Creating…' : `Add Pro override for ${category}`}
        </div>
        <p className="text-[10px] font-medium text-muted-foreground opacity-30 mt-1 max-w-[200px]">
          Create orchestration chain for {category.toLowerCase()} (Pro). Falls back to Default until configured.
        </p>
      </div>
    </button>
  )
}
```

Replace with:

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import RouterManager from './RouterManager'
import { createRouterChain } from '@/app/admin/router/actions'
import type { RegistryModel } from './model-utils'

export default function RouterCategoryCard({
  category,
  mode,
  defaultChain,
  proChain,
  availableModels,
}: {
  category: string
  mode: 'default' | 'pro'
  defaultChain: any
  proChain: any | null
  availableModels?: RegistryModel[]
}) {
  const router = useRouter()
  const [isCreating, setIsCreating] = useState(false)
  const activeChain = mode === 'default' ? defaultChain : proChain

  const handleCreatePro = async () => {
    setIsCreating(true)
    try {
      await createRouterChain(category, 'pro')
      router.refresh()
    } catch (e) {
      console.error(e)
    } finally {
      setIsCreating(false)
    }
  }

  if (activeChain) {
    return (
      <RouterManager
        key={activeChain.id}
        chain={activeChain}
        title={`${category.replace(/_/g, ' ')} (${mode === 'default' ? 'Default' : 'Pro'})`}
        category={category}
        availableModels={availableModels}
      />
    )
  }

  return (
    <button
      onClick={handleCreatePro}
      disabled={isCreating}
      className="group flex flex-col items-center justify-center gap-3 p-8 bg-white/[0.02] border border-[var(--bone-6)] rounded-big hover:bg-accent/5 transition-all w-full disabled:opacity-50"
    >
      <div className="text-center">
        <div className="text-[11px] font-ui-label font-bold text-muted-foreground uppercase tracking-widest opacity-40 group-hover:opacity-100">
          {isCreating ? 'Creating…' : `Add Pro override for ${category}`}
        </div>
        <p className="text-[10px] font-medium text-muted-foreground opacity-30 mt-1 max-w-[200px]">
          Create orchestration chain for {category.toLowerCase()} (Pro). Falls back to Default until configured.
        </p>
      </div>
    </button>
  )
}
```

- [ ] **Step 5: Update `AddCategoryButton.tsx`**

Current content of [AddCategoryButton.tsx](../../../src/components/admin/AddCategoryButton.tsx):

```typescript
'use client'

import { Plus } from 'lucide-react'
import { createRouterChain } from '@/app/admin/router/actions'
import { useState } from 'react'
import { cn } from '@/lib/utils'

export default function AddCategoryButton({
  platform,
  category,
  mode = 'default',
  label,
}: {
  platform: 'app' | 'telegram'
  category: string
  mode?: 'default' | 'pro'
  label?: string
}) {
  const [isPending, setIsPending] = useState(false)

  const handleCreate = async () => {
    setIsPending(true)
    try {
      await createRouterChain(platform, category, mode)
    } catch (e) {
      console.error(e)
    } finally {
      setIsPending(false)
    }
  }

  return (
    <button
      onClick={handleCreate}
      disabled={isPending}
      className="group flex flex-col items-center justify-center gap-3 p-8 bg-white/[0.02] border border-[var(--bone-6)] rounded-big hover:bg-accent/5 transition-all w-full"
    >
      <div className="w-10 h-10 rounded-xl bg-white/5 border border-[var(--bone-6)] flex items-center justify-center group-hover:bg-accent/10 transition-all">
        <Plus className={cn("w-5 h-5 transition-all", isPending ? "animate-spin opacity-40" : "text-muted-foreground group-hover:text-accent")} />
      </div>
      <div className="text-center">
        <div className="text-[11px] font-ui-label font-bold text-muted-foreground uppercase tracking-widest opacity-40 group-hover:opacity-100">
          {label ?? `Initialize ${category}`}
        </div>
        <p className="text-[10px] font-medium text-muted-foreground opacity-30 mt-1 max-w-[200px]">
          Create orchestration chain for {category.toLowerCase()}{mode === 'pro' ? ' (Pro)' : ''}
        </p>
      </div>
    </button>
  )
}
```

Replace with:

```typescript
'use client'

import { Plus } from 'lucide-react'
import { createRouterChain } from '@/app/admin/router/actions'
import { useState } from 'react'
import { cn } from '@/lib/utils'

export default function AddCategoryButton({
  category,
  mode = 'default',
  label,
}: {
  category: string
  mode?: 'default' | 'pro'
  label?: string
}) {
  const [isPending, setIsPending] = useState(false)

  const handleCreate = async () => {
    setIsPending(true)
    try {
      await createRouterChain(category, mode)
    } catch (e) {
      console.error(e)
    } finally {
      setIsPending(false)
    }
  }

  return (
    <button
      onClick={handleCreate}
      disabled={isPending}
      className="group flex flex-col items-center justify-center gap-3 p-8 bg-white/[0.02] border border-[var(--bone-6)] rounded-big hover:bg-accent/5 transition-all w-full"
    >
      <div className="w-10 h-10 rounded-xl bg-white/5 border border-[var(--bone-6)] flex items-center justify-center group-hover:bg-accent/10 transition-all">
        <Plus className={cn("w-5 h-5 transition-all", isPending ? "animate-spin opacity-40" : "text-muted-foreground group-hover:text-accent")} />
      </div>
      <div className="text-center">
        <div className="text-[11px] font-ui-label font-bold text-muted-foreground uppercase tracking-widest opacity-40 group-hover:opacity-100">
          {label ?? `Initialize ${category}`}
        </div>
        <p className="text-[10px] font-medium text-muted-foreground opacity-30 mt-1 max-w-[200px]">
          Create orchestration chain for {category.toLowerCase()}{mode === 'pro' ? ' (Pro)' : ''}
        </p>
      </div>
    </button>
  )
}
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors in these 4 files. `SortableRouterGrid.tsx` (Task 5) will still show an error at this point since it also calls `saveRouterOrder(platform, ...)` — that's expected, fixed next.

- [ ] **Step 7: Manually verify in the browser**

Run: `npm run dev`, navigate to `/admin/router` (or whichever route renders `RouterPageContent`).

Expected: page loads identically to before this task — all 12 categories, Default/Pro global toggle works, "Add Pro Override" still creates chains correctly (regression check against the constraint bug fixed earlier in this session).

- [ ] **Step 8: Commit**

```bash
git add src/app/admin/router/page.tsx src/components/admin/RouterMatrixGrid.tsx src/components/admin/RouterCategoryCard.tsx src/components/admin/AddCategoryButton.tsx
git commit -m "feat(router): remove platform prop from Router Matrix UI components"
```

---

## Task 5: `SortableRouterGrid.tsx` (orphaned component, updated for consistency)

**Files:**
- Modify: `src/components/admin/SortableRouterGrid.tsx`

This component has no importer anywhere in the codebase (confirmed via `grep -rln "SortableRouterGrid" src/` returning only its own file) — it's dead code, likely superseded by `RouterMatrixGrid`. It's still updated here rather than left broken, since a stray compile error in an unused file is still a compile error, and leaving it half-migrated would confuse the next person who finds it.

- [ ] **Step 1: Remove `platform` prop and its usage**

At [SortableRouterGrid.tsx:68-125](../../../src/components/admin/SortableRouterGrid.tsx#L68):

```typescript
// Before:
export default function SortableRouterGrid({ 
  initialRouters, 
  models, 
  platform,
  children
}: { 
  initialRouters: any[]
  models: any[]
  platform: 'app' | 'telegram'
  children?: React.ReactNode
}) {
  // ...
  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((item) => item.id === active.id)
      const newIndex = items.findIndex((item) => item.id === over.id)

      if (oldIndex !== -1 && newIndex !== -1) {
        const newItems = arrayMove(items, oldIndex, newIndex)
        setItems(newItems)

        try {
          await saveRouterOrder(platform, newItems.map(i => i.id))
        } catch (error) {
          console.error('Failed to save router order:', error)
        }
      }
    }
    setActiveId(null)
  }

// After:
export default function SortableRouterGrid({ 
  initialRouters, 
  models, 
  children
}: { 
  initialRouters: any[]
  models: any[]
  children?: React.ReactNode
}) {
  // ...
  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((item) => item.id === active.id)
      const newIndex = items.findIndex((item) => item.id === over.id)

      if (oldIndex !== -1 && newIndex !== -1) {
        const newItems = arrayMove(items, oldIndex, newIndex)
        setItems(newItems)

        try {
          await saveRouterOrder(newItems.map(i => i.id))
        } catch (error) {
          console.error('Failed to save router order:', error)
        }
      }
    }
    setActiveId(null)
  }
```

(Only the function signature's `platform` parameter and the one `saveRouterOrder(platform, ...)` call site change — the rest of the component body, `SortableItem`, `DndContext` setup, etc. are untouched.)

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: zero errors across the whole project now (all `platform`-related type errors from Task 3's Step 5 are resolved).

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/SortableRouterGrid.tsx
git commit -m "chore(router): remove platform param from orphaned SortableRouterGrid"
```

---

## Task 6: Dead prompt-sync block in `bot/global/actions.ts`

**Files:**
- Modify: `src/app/admin/bot/global/actions.ts`

- [ ] **Step 1: Remove the "Compaction prompt → router_chains" block**

At [bot/global/actions.ts:108-126](../../../src/app/admin/bot/global/actions.ts#L108):

```typescript
// Before:
  // 5. Compaction prompt → router_chains
  try {
    const content = readFile('compaction', 'system_prompt.txt')
    if (content) {
      await supabase.from('router_chains').upsert({
        category: 'COMPACTION',
        platform: 'app',
        system_prompt: content,
      }, { onConflict: 'category,platform' })
      await supabase.from('router_chains').upsert({
        category: 'COMPACTION',
        platform: 'telegram',
        system_prompt: content,
      }, { onConflict: 'category,platform' })
      synced.push('compaction system prompt')
    }
  } catch (e: any) {
    errors.push(`compaction: ${e.message}`)
  }

  // 6. Pipeline internal prompts → settings

// After:
  // 6. Pipeline internal prompts → settings
```

(The block is deleted entirely — its `try`/`catch` and the two upserts writing to `router_chains.system_prompt`, a column confirmed dead since `chainRouter.ts` reads chain prompts from static files, not this column. This also removes the last reference to `router_chains.platform` anywhere in the "sync from files" flow — its `onConflict: 'category,platform'` clause was already broken since Task 1's migration removed that column.)

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manually verify the sync button still works for everything else**

Run: `npm run dev`, navigate to the admin page that calls `syncFinalPrompts` (Global Settings, per the file's `revalidatePath('/admin/bot/global')`), trigger a sync.

Expected: sync completes without the "compaction system prompt" entry in the synced list (it's been removed), no errors reported, and all other sync steps (mode parts, classifier prompts, subchain configs, pipeline internal prompts, recompile) still succeed as before.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/bot/global/actions.ts
git commit -m "chore(prompts): remove dead compaction-prompt sync to router_chains.system_prompt"
```

---

## Task 7: Logs page — remove app/telegram filter

**Files:**
- Modify: `src/app/admin/logs/actions.ts`
- Modify: `src/app/admin/logs/LogsTable.tsx`

- [ ] **Step 1: Remove `platform` from `Exchange`, `getMessageExchanges`, and `getMessageLogs`**

At [logs/actions.ts:21-39](../../../src/app/admin/logs/actions.ts#L21), remove the `platform` field from the `Exchange` interface:

```typescript
// Before:
export interface Exchange {
  id: number
  created_at: string
  platform: 'app' | 'telegram'
  user_prompt: string | null
  model_response: string | null
  model_chain: string | null
  usage_type: string | null
  status: string | null
  telegram_id: number | null
  auth_user_id: string | null
  user_email: string | null
  topic_tag: string | null
  request_id: string | null
  feedback: 'like' | 'dislike' | null
  duration_ms: number | null
  image_description?: string | null
  step_traces: StepTrace[] | null
}

// After:
export interface Exchange {
  id: number
  created_at: string
  user_prompt: string | null
  model_response: string | null
  model_chain: string | null
  usage_type: string | null
  status: string | null
  telegram_id: number | null
  auth_user_id: string | null
  user_email: string | null
  topic_tag: string | null
  request_id: string | null
  feedback: 'like' | 'dislike' | null
  duration_ms: number | null
  image_description?: string | null
  step_traces: StepTrace[] | null
}
```

At [logs/actions.ts:61-95](../../../src/app/admin/logs/actions.ts#L61), remove `platform` from `getMessageExchanges`'s options and query filtering:

```typescript
// Before:
export async function getMessageExchanges(options: {
  platform?: 'all' | 'app' | 'telegram'
  usage_type?: string
  limit?: number
  offset?: number
} = {}): Promise<{ exchanges: Exchange[]; total: number }> {
  const { platform = 'all', usage_type, limit = 20, offset = 0 } = options

  if (!supabaseAdmin) return { exchanges: [], total: 0 }

  const authColExists = await checkAuthUserIdColumn()

  // Fetch model rows (these carry model_chain, status, usage_type)
  let modelQ = supabaseAdmin
    .from('message_logs')
    .select('*', { count: 'planned' })
    .eq('role', 'model')
    .order('id', { ascending: false })
    .range(offset, offset + limit - 1)

  if (authColExists) {
    if (platform === 'app') modelQ = modelQ.is('telegram_id', null)
    if (platform === 'telegram') modelQ = modelQ.not('telegram_id', 'is', null)
  } else if (platform === 'telegram') {
    modelQ = modelQ.not('telegram_id', 'is', null)
  }
  if (usage_type && usage_type !== 'all') modelQ = modelQ.eq('usage_type', usage_type)

// After:
export async function getMessageExchanges(options: {
  usage_type?: string
  limit?: number
  offset?: number
} = {}): Promise<{ exchanges: Exchange[]; total: number }> {
  const { usage_type, limit = 20, offset = 0 } = options

  if (!supabaseAdmin) return { exchanges: [], total: 0 }

  const authColExists = await checkAuthUserIdColumn()

  // Fetch model rows (these carry model_chain, status, usage_type)
  let modelQ = supabaseAdmin
    .from('message_logs')
    .select('*', { count: 'planned' })
    .eq('role', 'model')
    .order('id', { ascending: false })
    .range(offset, offset + limit - 1)

  if (usage_type && usage_type !== 'all') modelQ = modelQ.eq('usage_type', usage_type)
```

At [logs/actions.ts:132-168](../../../src/app/admin/logs/actions.ts#L132), remove the `platform` field computation from the returned exchange object:

```typescript
// Before:
    const platform: 'app' | 'telegram' = (m.auth_user_id || m.topic_tag?.startsWith('app:')) ? 'app' : (m.telegram_id ? 'telegram' : 'app')

    return {
      id: m.id,
      created_at: m.created_at,
      platform,
      user_prompt: matched?.content ?? null,

// After:
    return {
      id: m.id,
      created_at: m.created_at,
      user_prompt: matched?.content ?? null,
```

At [logs/actions.ts:204-247](../../../src/app/admin/logs/actions.ts#L204), remove `platform` from `getMessageLogs`'s options and filtering:

```typescript
// Before:
export async function getMessageLogs(options: {
  platform?: 'all' | 'app' | 'telegram'
  role?: 'all' | 'user' | 'model'
  usage_type?: string
  limit?: number
  offset?: number
} = {}): Promise<{ logs: LogEntry[]; total: number }> {
  const { platform = 'all', role = 'all', usage_type, limit = 50, offset = 0 } = options

  if (!supabaseAdmin) return { logs: [], total: 0 }

  const authColExists = await checkAuthUserIdColumn()

  let query = supabaseAdmin
    .from('message_logs')
    .select('*', { count: 'planned' })
    .order('id', { ascending: false })
    .range(offset, offset + limit - 1)

  if (authColExists) {
    if (platform === 'app') query = query.is('telegram_id', null)
    if (platform === 'telegram') query = query.not('telegram_id', 'is', null)
  } else if (platform === 'telegram') {
    query = query.not('telegram_id', 'is', null)
  }

  if (role !== 'all') query = query.eq('role', role)

// After:
export async function getMessageLogs(options: {
  role?: 'all' | 'user' | 'model'
  usage_type?: string
  limit?: number
  offset?: number
} = {}): Promise<{ logs: LogEntry[]; total: number }> {
  const { role = 'all', usage_type, limit = 50, offset = 0 } = options

  if (!supabaseAdmin) return { logs: [], total: 0 }

  const authColExists = await checkAuthUserIdColumn()

  let query = supabaseAdmin
    .from('message_logs')
    .select('*', { count: 'planned' })
    .order('id', { ascending: false })
    .range(offset, offset + limit - 1)

  if (role !== 'all') query = query.eq('role', role)
```

`checkAuthUserIdColumn`/`authColExists` remain in use elsewhere in both functions (populating `auth_user_id` on the returned rows) — only the platform-filtering `if` blocks that used it are removed, not the function itself.

- [ ] **Step 2: Remove the filter button row and `Filters.platform` from `LogsTable.tsx`**

At [logs/LogsTable.tsx:389-418](../../../src/app/admin/logs/LogsTable.tsx#L389):

```typescript
// Before:
interface Filters {
  platform: 'all' | 'app' | 'telegram'
  usage_type: string
}

export default function LogsTable({ initialExchanges, initialTotal }: { initialExchanges: Exchange[]; initialTotal: number }) {
  const [exchanges, setExchanges] = useState<Exchange[]>(initialExchanges)
  const [total, setTotal] = useState(initialTotal)
  const [page, setPage] = useState(0)
  const [filters, setFilters] = useState<Filters>({ platform: 'all', usage_type: 'all' })
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [isPending, startTransition] = useTransition()

  const PAGE_SIZE = 20
  const totalPages = Math.ceil(total / PAGE_SIZE)

  async function load(newFilters: Filters, newPage: number) {
    startTransition(async () => {
      const { exchanges: data, total: count } = await getMessageExchanges({
        platform: newFilters.platform,
        usage_type: newFilters.usage_type,
        limit: PAGE_SIZE,
        offset: newPage * PAGE_SIZE,
      })
      setExchanges(data)
      setTotal(count)
      setPage(newPage)
    })
  }

// After:
interface Filters {
  usage_type: string
}

export default function LogsTable({ initialExchanges, initialTotal }: { initialExchanges: Exchange[]; initialTotal: number }) {
  const [exchanges, setExchanges] = useState<Exchange[]>(initialExchanges)
  const [total, setTotal] = useState(initialTotal)
  const [page, setPage] = useState(0)
  const [filters, setFilters] = useState<Filters>({ usage_type: 'all' })
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [isPending, startTransition] = useTransition()

  const PAGE_SIZE = 20
  const totalPages = Math.ceil(total / PAGE_SIZE)

  async function load(newFilters: Filters, newPage: number) {
    startTransition(async () => {
      const { exchanges: data, total: count } = await getMessageExchanges({
        usage_type: newFilters.usage_type,
        limit: PAGE_SIZE,
        offset: newPage * PAGE_SIZE,
      })
      setExchanges(data)
      setTotal(count)
      setPage(newPage)
    })
  }
```

At [logs/LogsTable.tsx:448-460](../../../src/app/admin/logs/LogsTable.tsx#L448), remove the platform filter button row:

```typescript
// Before:
  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        {(['all', 'app', 'telegram'] as const).map(p => (
          <button key={p} onClick={() => setFilter('platform', p)}
            className={cn("px-3 py-1 rounded-full text-xs font-medium capitalize transition-all",
              filters.platform === p ? "bg-[var(--bone-15)] text-foreground" : "bg-[var(--bone-6)] text-bone-70 hover:text-foreground"
            )}>
            {p}
          </button>
        ))}
        <div className="w-px h-4 bg-white/10 mx-1" />
        {(['all', 'chat', 'tool', 'search', 'vision', 'image'] as const).map(t => (

// After:
  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        {(['all', 'chat', 'tool', 'search', 'vision', 'image'] as const).map(t => (
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manually verify in the browser**

Run: `npm run dev`, navigate to the Logs admin page.

Expected: page loads, shows messages, only the usage-type filter buttons remain (chat/tool/search/vision/image/all) — no app/telegram/all button row.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/logs/actions.ts src/app/admin/logs/LogsTable.tsx
git commit -m "chore(logs): remove app/telegram platform filter from Logs page"
```

---

## Task 8: Feedback page — remove platform badge

**Files:**
- Modify: `src/app/admin/bot/feedback/actions.ts`
- Modify: `src/app/admin/bot/feedback/FeedbackClient.tsx`

- [ ] **Step 1: Remove `platform` field from the `FeedbackLog` interface**

At [feedback/actions.ts:6-28](../../../src/app/admin/bot/feedback/actions.ts#L6):

```typescript
// Before:
export interface FeedbackLog {
  id: string
  message_log_id: number
  auth_user_id: string | null
  feedback: 'like' | 'dislike'
  created_at: string
  message_content: string | null
  user_prompt: string | null
  model_response: string | null
  model_chain: string | null
  usage_type: string | null
  status: string | null
  telegram_id: number | null
  user_email: string | null
  platform: 'app' | 'telegram'
  is_locked?: boolean
  context_messages: {
    classify?: { key: string; success: boolean }[]
    routing?: { key: string; success: boolean }[]
    history?: { role: string; content: string }[]
    is_locked?: boolean
  } | null
}

// After:
export interface FeedbackLog {
  id: string
  message_log_id: number
  auth_user_id: string | null
  feedback: 'like' | 'dislike'
  created_at: string
  message_content: string | null
  user_prompt: string | null
  model_response: string | null
  model_chain: string | null
  usage_type: string | null
  status: string | null
  telegram_id: number | null
  user_email: string | null
  is_locked?: boolean
  context_messages: {
    classify?: { key: string; success: boolean }[]
    routing?: { key: string; success: boolean }[]
    history?: { role: string; content: string }[]
    is_locked?: boolean
  } | null
}
```

At [feedback/actions.ts:184-188](../../../src/app/admin/bot/feedback/actions.ts#L184):

```typescript
// Before:
      status: l?.status ?? null,
      telegram_id: l?.telegram_id ?? null,
      user_email: null,
      platform: l?.telegram_id ? 'telegram' : 'app',
      is_locked: !!f.context_messages?.is_locked,

// After:
      status: l?.status ?? null,
      telegram_id: l?.telegram_id ?? null,
      user_email: null,
      is_locked: !!f.context_messages?.is_locked,
```

- [ ] **Step 2: Remove the platform badge from `FeedbackClient.tsx`**

At [feedback/FeedbackClient.tsx:324-329](../../../src/app/admin/bot/feedback/FeedbackClient.tsx#L324):

```typescript
// Before:
                    {/* User */}
                    <div className="flex items-center gap-1.5 self-center min-w-0">
                      {log.platform === 'app'
                        ? <Globe className="w-3 h-3 text-blue-400 opacity-50 shrink-0" />
                        : <Bot className="w-3 h-3 text-orange-400 opacity-50 shrink-0" />
                      }
                      <span className="text-[9px] font-mono text-bone-70 opacity-50 truncate" title={log.user_email || log.auth_user_id || String(log.telegram_id) || '—'}>

// After:
                    {/* User */}
                    <div className="flex items-center gap-1.5 self-center min-w-0">
                      <span className="text-[9px] font-mono text-bone-70 opacity-50 truncate" title={log.user_email || log.auth_user_id || String(log.telegram_id) || '—'}>
```

`Globe` and `Bot` (from `lucide-react`) are only used in this one badge block (confirmed via `grep -n "Globe\|Bot" src/app/admin/bot/feedback/FeedbackClient.tsx` — both appear only in the import line and the two lines just removed), so remove them from the import statement at the top of the file:

```typescript
// Before:
import { ThumbsUp, ThumbsDown, Send, Trash2, ChevronRight, ChevronDown, CheckCircle2, ArrowRight, Globe, Bot, XCircle, MessageSquare, Search, Wrench, Eye } from 'lucide-react'

// After:
import { ThumbsUp, ThumbsDown, Send, Trash2, ChevronRight, ChevronDown, CheckCircle2, ArrowRight, XCircle, MessageSquare, Search, Wrench, Eye } from 'lucide-react'
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manually verify in the browser**

Run: `npm run dev`, navigate to the Feedback admin page.

Expected: page loads, shows feedback entries, no Globe/Bot icon badge next to each entry's user identifier.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/bot/feedback/actions.ts src/app/admin/bot/feedback/FeedbackClient.tsx
git commit -m "chore(feedback): remove app/telegram platform badge from Feedback page"
```

---

## Self-Review Notes

- **Spec coverage:** §1 (schema migration) → Task 1. §2 (`getRouterChain`) → Task 2. §3 (Router Matrix admin UI) → Tasks 3-4-5. §4 (`bot/global/actions.ts` dead sync) → Task 6. §5 (Logs and Feedback pages) → Tasks 7-8. All five spec sections have a corresponding task.
- **Explicitly out of scope, respected:** no task touches `telegram.ts`, `webhook/route.ts`, `notifications.ts`, `usageGuard.ts`, or `message_logs.telegram_id` itself — only the `Exchange.platform`/`Filters.platform`/feedback badge display layers derived from it are simplified, per the spec's explicit boundary.
- **Sequencing:** Task 1 (schema) must run before Task 2 (code that queries the now-changed schema) — both are early. Task 3 must precede Task 4 (page/components call the actions changed in Task 3) — Task 3's Step 5 typecheck intentionally surfaces the Task 4 errors as a checkpoint rather than hiding them. Tasks 6-8 are independent of 1-5 and each other; could run in parallel if using subagent-driven execution.
- **Type consistency:** `createRouterChain(category, mode)` signature (Task 3) matches every call site updated in Task 4 (`RouterCategoryCard`, `AddCategoryButton`) — no site still passes `platform` as the first argument. `getRouterChains()`/`getRouterOrder()`/`saveRouterOrder(order)` (Task 3) match their sole caller in `page.tsx`/`SortableRouterGrid.tsx` (Tasks 4-5).
