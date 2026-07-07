# Mode-Based Router Chains Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `mode` (`default` | `pro`) as a first-class dimension of `router_chains`, so Default and Pro chat modes can route to different models per category, with automatic fallback to the `default` chain when no `pro` override is configured.

**Architecture:** `router_chains` gets a new `mode` column and its unique key changes from `(category, platform)` to `(category, platform, mode)`. `getRouterChain(category, mode)` looks up the mode-specific row first, falling back to `default` when missing or empty. All 9 existing call sites either pass through the caller's mode or explicitly use `'default'` for mode-agnostic utility chains (CLASSIFIER, COMPACTION, etc.). The admin Router Matrix page gets a Default/Pro tab per category card, reusing the existing `RouterManager` component per mode.

**Tech Stack:** Next.js server actions, Supabase (Postgres + `unstable_cache`), React (existing `RouterManager`/`RouterPageContent` components), Vitest.

---

## Reference: current state

- `router_chains` table: `id uuid pk`, `category text`, `platform text default 'telegram'`, `model_list jsonb`, `system_prompt text`, `updated_at`. Effective lookup key today is `(category, platform)` via `.eq('category', ...).eq('platform', ...).limit(1).maybeSingle()` in [router-config.ts:38-44](../../../src/lib/router-config.ts#L38).
- `getRouterChain(category: IntentCategory)` — [router-config.ts:129](../../../src/lib/router-config.ts#L129) — no mode parameter today.
- 9 call sites of `getRouterChain(...)`: [advisor.ts:230](../../../src/lib/bot/advisor.ts#L230), [analytics.ts:31](../../../src/lib/bot/analytics.ts#L31), [chainRouter.ts:325](../../../src/lib/bot/chainRouter.ts#L325), [chainRouter.ts:639](../../../src/lib/bot/chainRouter.ts#L639), [classifier.ts:233](../../../src/lib/bot/classifier.ts#L233), [compaction.ts:78](../../../src/lib/bot/compaction.ts#L78), [image-narration.ts:16](../../../src/lib/bot/image-narration.ts#L16), [prompt-expansion.ts:17](../../../src/lib/bot/prompt-expansion.ts#L17), [deepResearch.ts:134](../../../src/lib/bot/providers/deepResearch.ts#L134).
- `BotMode` type already exists: `export type BotMode = 'default' | 'pro'` at [store.types.ts:347](../../../src/data/store.types.ts#L347).
- Admin UI: `RouterPageContent` ([page.tsx](../../../src/app/admin/router/page.tsx)) renders one `RouterManager` card per category row. `createRouterChain(platform, category)` ([actions.ts:104](../../../src/app/admin/router/actions.ts#L104)) inserts a new row with empty `model_list`.
- `getLayeredPromptPreview(category, mode)` ([actions.ts:341](../../../src/app/admin/router/actions.ts#L341)) already accepts a `mode` param but `getInternalPrompt` ([compilePrompt.ts:138](../../../src/lib/bot/compilePrompt.ts#L138)) ignores it — vestigial, not a working mechanism. Out of scope to fix here; only `router_chains`/`getRouterChain` mode-awareness is in scope.

## Out of scope (per spec)

- A third `mode=max` — schema supports it later without rework, not built now.
- Any billing/credit logic — that's the separate credit-metering plan.
- Fixing `getInternalPrompt`'s dead `mode` parameter (system prompt personality layer) — unrelated system from model routing.

---

## Task 1: Migration — add `mode` column and composite unique key

**Files:**
- Create: `supabase/migrations/20260707_router_chains_mode.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Migration: 20260707_router_chains_mode.sql
-- Description: Add mode dimension to router_chains so Default/Pro chat modes
-- can route to different model chains per category. Existing rows become
-- mode='default'; unique key becomes (category, platform, mode).

ALTER TABLE router_chains ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'default';

-- Drop any stale unique constraint that only covered category (pre-platform-column era)
DO $$
DECLARE
  con_name TEXT;
BEGIN
  SELECT conname INTO con_name
  FROM pg_constraint
  WHERE conrelid = 'router_chains'::regclass
    AND contype = 'u'
    AND array_length(conkey, 1) = 1;
  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE router_chains DROP CONSTRAINT %I', con_name);
  END IF;
END $$;

-- Composite unique key: one row per category+platform+mode
CREATE UNIQUE INDEX IF NOT EXISTS router_chains_category_platform_mode_key
  ON router_chains (category, platform, mode);
```

- [ ] **Step 2: Apply the migration to the dev Supabase project**

Run via the project's existing migration application method (check `supabase/migrations/README.md` or run `supabase db push` if the Supabase CLI is linked; otherwise apply via the Supabase SQL editor). Confirm no error and that existing rows now show `mode = 'default'`:

```sql
SELECT category, platform, mode FROM router_chains LIMIT 5;
```

Expected: every existing row shows `mode = 'default'`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260707_router_chains_mode.sql
git commit -m "feat(router): add mode column to router_chains for default/pro chains"
```

---

## Task 2: `getRouterChain` accepts a `mode` parameter with fallback

**Files:**
- Modify: `src/lib/router-config.ts:31-136`
- Test: `src/lib/router-config.test.ts` (new)

- [ ] **Step 1: Write the failing test**

`fetchRouterChainFromDb` and `getRouterChain` both hit Supabase directly, so this is an integration-style test against the real query-building logic via a mocked Supabase client, following the pattern used elsewhere in this codebase for pure-logic extraction. Extract the fallback decision into a small pure function first so it's unit-testable without mocking Supabase:

```typescript
// src/lib/router-config.test.ts
import { describe, it, expect } from 'vitest'
import { resolveChainWithFallback } from './router-config'
import type { RouterModel } from './router-config'

const modelA: RouterModel = { id: 'model-a', provider: 'google', is_enabled: true }
const modelB: RouterModel = { id: 'model-b', provider: 'groq', is_enabled: true }

describe('resolveChainWithFallback', () => {
  it('uses the pro chain when it has enabled models', () => {
    const result = resolveChainWithFallback(
      { chain: [modelA] },
      { chain: [modelB] }
    )
    expect(result.chain).toEqual([modelA])
  })

  it('falls back to default when pro chain is empty', () => {
    const result = resolveChainWithFallback(
      { chain: [] },
      { chain: [modelB] }
    )
    expect(result.chain).toEqual([modelB])
  })

  it('falls back to default when pro chain is undefined (no row exists)', () => {
    const result = resolveChainWithFallback(
      undefined,
      { chain: [modelB] }
    )
    expect(result.chain).toEqual([modelB])
  })

  it('returns empty when both are empty', () => {
    const result = resolveChainWithFallback(
      { chain: [] },
      { chain: [] }
    )
    expect(result.chain).toEqual([])
  })

  it('preserves temperature and thinking_budget from the chosen chain', () => {
    const result = resolveChainWithFallback(
      { chain: [modelA], temperature: 0.9, thinking_budget: 'high' },
      { chain: [modelB], temperature: 0.5 }
    )
    expect(result.temperature).toBe(0.9)
    expect(result.thinking_budget).toBe('high')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/router-config.test.ts`
Expected: FAIL with `resolveChainWithFallback is not a function` (not exported yet).

- [ ] **Step 3: Implement `resolveChainWithFallback` and thread `mode` through the fetch/cache functions**

Modify [src/lib/router-config.ts](../../../src/lib/router-config.ts):

Replace the `fetchRouterChainFromDb` function signature and query (around line 31-44):

```typescript
export type RouterMode = 'default' | 'pro'

export function resolveChainWithFallback(
  primary: { chain: RouterModel[]; temperature?: number; thinking_budget?: string | number } | undefined,
  fallback: { chain: RouterModel[]; temperature?: number; thinking_budget?: string | number }
): { chain: RouterModel[]; temperature?: number; thinking_budget?: string | number } {
  if (primary && primary.chain.length > 0) return primary
  return fallback
}

async function fetchRouterChainFromDb(
  category: IntentCategory,
  mode: RouterMode
): Promise<{ chain: RouterModel[], temperature?: number; thinking_budget?: string | number }> {
  let retryCount = 0
  const maxRetries = 2

  while (retryCount <= maxRetries) {
    try {
      const [chainResult, tempsResult, budgetsResult, modelsResult] = await Promise.all([
        supabase
          .from('router_chains')
          .select('model_list')
          .eq('category', category)
          .eq('platform', 'telegram')
          .eq('mode', mode)
          .limit(1)
          .maybeSingle(),
        supabase
          .from('settings')
          .select('value')
          .eq('key', 'router_temperatures')
          .limit(1)
          .maybeSingle(),
        supabase
          .from('settings')
          .select('value')
          .eq('key', 'router_thinking_budgets')
          .limit(1)
          .maybeSingle(),
        supabase
          .from('models')
          .select('id, is_paid, prompt_cost, completion_cost')
      ])

      if (chainResult.error) throw new Error(chainResult.error.message)
      if (!chainResult.data) {
        // Self-healing: if the category is missing, attempt to create a default entry
        if (mode === 'default' && (category === 'VISION' || category === 'CODING' || category === 'IMAGE_GEN')) {
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

      const temps = (tempsResult.data?.value as Record<string, number>) ?? {}
      const customTemp = typeof temps[category] === 'number' ? temps[category] : 0.7

      const budgets = (budgetsResult.data?.value as Record<string, string | number>) ?? {}
      const customBudget = budgets[category]

      const pricingMap = new Map<string, { is_paid?: boolean, prompt_cost?: number, completion_cost?: number }>()
      if (modelsResult.data) {
        modelsResult.data.forEach((m: any) => {
          pricingMap.set(m.id, {
            is_paid: m.is_paid,
            prompt_cost: m.prompt_cost,
            completion_cost: m.completion_cost
          })
        })
      }

      const rawChain = (chainResult.data.model_list as RouterModel[] || []).filter(m => m.is_enabled)

      const enrichedChain = rawChain.map(m => {
        const price = pricingMap.get(m.id)
        if (!price) return m
        return {
          ...m,
          is_paid: price.is_paid,
          prompt_cost: price.prompt_cost,
          completion_cost: price.completion_cost
        }
      })

      return {
        chain: enrichedChain,
        temperature: customTemp,
        thinking_budget: customBudget
      }
    } catch (err) {
      if (retryCount === maxRetries) {
        logger.error(`RouterChain DB load failed for ${category} (mode=${mode}) after ${maxRetries} retries: ${(err as Error).message}.`)
        return { chain: [] }
      }
      retryCount++
      await new Promise(r => setTimeout(r, 1000 * retryCount))
    }
  }
  return { chain: [] }
}

export async function getRouterChain(category: IntentCategory, mode: RouterMode = 'default') {
  const getCachedForMode = (m: RouterMode) => unstable_cache(
    async () => fetchRouterChainFromDb(category, m),
    ['router-chain', category, m],
    { tags: ['router-config'], revalidate: false }
  )()

  if (mode === 'default') {
    return getCachedForMode('default')
  }

  const [proResult, defaultResult] = await Promise.all([
    getCachedForMode('pro'),
    getCachedForMode('default'),
  ])
  return resolveChainWithFallback(proResult, defaultResult)
}
```

Note: `mode === 'default'` skips the parallel fetch entirely (no need to fetch a "fallback for the fallback"), so default-mode requests — the common case — pay no extra query cost.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/router-config.test.ts`
Expected: PASS, all 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/router-config.ts src/lib/router-config.test.ts
git commit -m "feat(router): getRouterChain accepts mode with pro->default fallback"
```

---

## Task 3: Thread `mode` through all 9 call sites

**Files:**
- Modify: `src/lib/bot/chainRouter.ts:325,639`
- Modify: `src/lib/bot/advisor.ts:230`
- Modify: `src/lib/bot/analytics.ts:31`
- Modify: `src/lib/bot/classifier.ts:233`
- Modify: `src/lib/bot/compaction.ts:78`
- Modify: `src/lib/bot/image-narration.ts:16`
- Modify: `src/lib/bot/prompt-expansion.ts:17`
- Modify: `src/lib/bot/providers/deepResearch.ts:134`

Two groups: **user-facing category chains** (should honor the request's actual mode) vs **internal utility chains** (CLASSIFIER, COMPACTION, ADVISOR pre-flight — always cheap/fast regardless of user mode, so hardcode `'default'`).

- [ ] **Step 1: Update `chainRouter.ts` vision and main category lookups**

At [chainRouter.ts:325](../../../src/lib/bot/chainRouter.ts#L325):
```typescript
// Before:
const { chain: visionChain } = await getRouterChain('VISION')
// After:
const { chain: visionChain } = await getRouterChain('VISION', (context?.mode === 'pro' ? 'pro' : 'default'))
```

At [chainRouter.ts:639](../../../src/lib/bot/chainRouter.ts#L639):
```typescript
// Before:
let { chain, temperature, thinking_budget } = await getRouterChain(category)
// After:
let { chain, temperature, thinking_budget } = await getRouterChain(category, (context?.mode === 'pro' ? 'pro' : 'default'))
```

(`context` is already in scope at both call sites — `chainRouter.ts` threads `context?.mode` throughout the file already, e.g. line 203.)

- [ ] **Step 2: Update `classifier.ts` — always default (routing decision itself is cheap/utility)**

At [classifier.ts:233](../../../src/lib/bot/classifier.ts#L233):
```typescript
// Before:
const { chain } = await getRouterChain('CLASSIFIER')
// After:
const { chain } = await getRouterChain('CLASSIFIER', 'default')
```

- [ ] **Step 3: Update `compaction.ts` — always default (background summarization, not user-facing quality)**

At [compaction.ts:78](../../../src/lib/bot/compaction.ts#L78):
```typescript
// Before:
const { chain } = await getRouterChain('COMPACTION').catch(() => ({ chain: [] as RouterModel[] }))
// After:
const { chain } = await getRouterChain('COMPACTION', 'default').catch(() => ({ chain: [] as RouterModel[] }))
```

- [ ] **Step 4: Update `advisor.ts` — honor caller's mode (advisor is user-facing pre-flight)**

`runAdvisor` already receives `mode: BotMode` as its second parameter ([advisor.ts:221-229](../../../src/lib/bot/advisor.ts#L221)), so no signature change is needed:

```typescript
// Before (advisor.ts:230):
const { chain } = await getRouterChain('ADVISOR')
// After:
const { chain } = await getRouterChain('ADVISOR', mode === 'pro' ? 'pro' : 'default')
```

- [ ] **Step 5: Update `image-narration.ts` and `prompt-expansion.ts` — always default (utility subchains)**

At [image-narration.ts:16](../../../src/lib/bot/image-narration.ts#L16) and [prompt-expansion.ts:17](../../../src/lib/bot/prompt-expansion.ts#L17):
```typescript
// Before:
const { chain } = await getRouterChain(chainCategory)
// After:
const { chain } = await getRouterChain(chainCategory, 'default')
```

- [ ] **Step 6: Update `deepResearch.ts` — always default (gap-detector is an internal research subchain, not the user-facing synthesis step)**

At [deepResearch.ts:134](../../../src/lib/bot/providers/deepResearch.ts#L134):
```typescript
// Before:
const { chain: gapChain } = await getRouterChain(gapChainCategory)
// After:
const { chain: gapChain } = await getRouterChain(gapChainCategory, 'default')
```

- [ ] **Step 7: Update `analytics.ts` — always default (internal analytics/logging chain, not a live user request)**

At [analytics.ts:31](../../../src/lib/bot/analytics.ts#L31):
```typescript
// Before:
const { chain } = await getRouterChain('REGULAR')
// After:
const { chain } = await getRouterChain('REGULAR', 'default')
```

- [ ] **Step 8: Typecheck the whole project**

Run: `npx tsc --noEmit`
Expected: no new errors introduced by these 9 edits (pre-existing unrelated errors, if any, are not this task's concern — compare against a baseline run before this task if unsure).

- [ ] **Step 9: Commit**

```bash
git add src/lib/bot/chainRouter.ts src/lib/bot/advisor.ts src/lib/bot/analytics.ts src/lib/bot/classifier.ts src/lib/bot/compaction.ts src/lib/bot/image-narration.ts src/lib/bot/prompt-expansion.ts src/lib/bot/providers/deepResearch.ts
git commit -m "feat(router): thread mode through all getRouterChain call sites"
```

---

## Task 4: Admin UI — Default/Pro tabs on the Router Matrix page

**Files:**
- Modify: `src/app/admin/router/actions.ts`
- Modify: `src/app/admin/router/page.tsx`
- Modify: `src/components/admin/AddCategoryButton.tsx`

- [ ] **Step 1: Update `getRouterChains` to fetch both modes and `createRouterChain` to accept mode**

In [actions.ts:7](../../../src/app/admin/router/actions.ts#L7), the query already does `.eq('platform', platform)` with no mode filter — since rows for both modes now exist per category, this naturally returns all mode rows already; no change needed to the SELECT itself. Update `createRouterChain` to take a mode:

```typescript
// Before (actions.ts:104):
export async function createRouterChain(platform: 'app' | 'telegram', category: string) {
  const { error } = await supabase
    .from('router_chains')
    .insert({
      platform,
      category,
      model_list: [],
      system_prompt: ''
    })
  ...
}

// After:
export async function createRouterChain(platform: 'app' | 'telegram', category: string, mode: 'default' | 'pro' = 'default') {
  const { error } = await supabase
    .from('router_chains')
    .insert({
      platform,
      category,
      mode,
      model_list: [],
      system_prompt: ''
    })

  if (error) throw error
  revalidatePath('/admin/app/router')
  revalidatePath('/admin/telegram/router')
  // @ts-ignore
  revalidateTag('router-config')
  return { success: true }
}
```

- [ ] **Step 2: Group router rows by category in `RouterPageContent`, render a mode tab pair per category**

Modify [page.tsx](../../../src/app/admin/router/page.tsx):

```typescript
import { getRouterChains } from './actions'
import { getModels } from '@/app/admin/models/actions'
import RouterManager from '@/components/admin/RouterManager'
import AddCategoryButton from '@/components/admin/AddCategoryButton'
import { Cpu, Command, Share2, Zap, Image, Mic, Brain, Camera, Code, Microscope, Sparkles, Maximize2, FileText, MessageSquareMore, GripHorizontal } from 'lucide-react'

const CATEGORY_ICONS: Record<string, any> = {
  REGULAR: MessageSquareMore,
  COMPLEX: Cpu,
  CODING: Code,
  WEB_SEARCH: Share2,
  RESEARCH: Microscope,
  TOOLS: Command,
  IMAGE_GEN: Image,
  VISION: Camera,
  AUDIO: Mic,
  CLASSIFIER: Brain,
  THINKING: Sparkles,
  ADVISOR: Brain,
  COMPACTION: FileText,
}

const ALL_CATEGORIES = [
  'REGULAR', 'COMPLEX', 'VISION', 'CODING', 'WEB_SEARCH', 'RESEARCH',
  'IMAGE_GEN', 'AUDIO', 'CLASSIFIER', 'THINKING', 'ADVISOR', 'COMPACTION',
]

export async function RouterPageContent({ platform }: { platform: 'app' | 'telegram' }) {
  const [routers, models] = await Promise.all([getRouterChains(platform), getModels()])

  // Group rows by category so each category can show its default + pro chain side by side
  const byCategory = new Map<string, { default?: any; pro?: any }>()
  for (const router of routers) {
    const entry = byCategory.get(router.category) ?? {}
    entry[router.mode === 'pro' ? 'pro' : 'default'] = router
    byCategory.set(router.category, entry)
  }

  return (
    <div className="space-y-[10px] animate-in fade-in duration-500">
      <div className="mb-2">
        <h1 className="text-4xl font-display font-medium text-foreground mb-1">Router Matrix</h1>
        <p className="text-muted-foreground text-sm font-medium">
          Chain routing configuration — each chain is a mini-orchestrator with input/output contracts. Default and Pro modes route independently; Pro falls back to Default when unconfigured.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {ALL_CATEGORIES.map((category) => {
          const entry = byCategory.get(category)
          const Icon = CATEGORY_ICONS[category] || Cpu

          if (!entry?.default) {
            return <AddCategoryButton key={category} platform={platform} category={category} mode="default" />
          }

          return (
            <div key={category} className="space-y-2">
              <RouterManager
                chain={entry.default}
                title={`${category.replace(/_/g, ' ')} (Default)`}
                category={category}
                availableModels={models}
              />
              {entry.pro ? (
                <RouterManager
                  chain={entry.pro}
                  title={`${category.replace(/_/g, ' ')} (Pro)`}
                  category={category}
                  availableModels={models}
                />
              ) : (
                <AddCategoryButton platform={platform} category={category} mode="pro" label={`Add Pro override for ${category}`} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default async function RouterPage() {
  return <RouterPageContent platform="telegram" />
}
```

- [ ] **Step 3: Update `AddCategoryButton` to accept and pass `mode`**

Modify [AddCategoryButton.tsx](../../../src/components/admin/AddCategoryButton.tsx):

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

- [ ] **Step 4: Manually verify in the browser**

Run: `npm run dev`, navigate to `/admin/telegram/router` (or `/admin/app/router`).

Expected: each category shows its Default chain card; categories without a Pro row show an "Add Pro override" button instead of a second card. Clicking it creates an empty Pro chain row and the page shows both cards after refresh.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/router/actions.ts src/app/admin/router/page.tsx src/components/admin/AddCategoryButton.tsx
git commit -m "feat(router): admin UI shows Default/Pro chain cards per category"
```

---

## Task 5: `chainRouter.ts` context.mode normalization — verify no silent bugs

**Files:**
- Modify: `src/lib/bot/chainRouter.ts` (verification only, may require no changes)

The `context?.mode === 'pro' ? 'pro' : 'default'` pattern used in Task 3 treats any value other than the literal string `'pro'` as `'default'`. This matches existing behavior elsewhere in the file (e.g. [chainRouter.ts:41](../../../src/app/api/ai/chat/route.ts#L41): `const activeMode = (mode === 'pro') ? mode : 'default'`), so no separate normalization layer is needed — just confirm this by inspection.

- [ ] **Step 1: Grep for all `context?.mode` and `context.mode` usages to confirm consistent normalization**

Run: `grep -n "context?.mode\|context.mode" src/lib/bot/chainRouter.ts`

Expected: every usage either compares `=== 'pro'` explicitly (safe) or passes the raw value through to something that itself normalizes (e.g. `getCompiledPrompt(context?.mode ?? 'default')`). If any usage instead does something like `context.mode as RouterMode` without a check, flag it — that would let an unexpected value silently break `getRouterChain`.

- [ ] **Step 2: No code change expected; if a gap is found, fix it inline using the same `mode === 'pro' ? 'pro' : 'default'` pattern and commit**

```bash
git add src/lib/bot/chainRouter.ts
git commit -m "fix(router): normalize context.mode consistently before getRouterChain calls"
```

(Skip the commit if no gap was found — this task may be a no-op verification step.)

---

## Self-Review Notes

- **Spec coverage:** §2 `router_chains` mode + fallback (Tasks 1-2), 9 call sites (Task 3), admin UI (Task 4) are all covered. Tier↔mode relationship (tier sizes budget, mode picks models) belongs to the credit-metering plan, not this one — `subscription_tiers.router_mode` there just needs to resolve to `'default'` or `'pro'` and pass it into the chat route's existing `mode` request field, no changes needed here.
- **Fallback correctness:** `resolveChainWithFallback` is unit-tested directly (Task 2) rather than through a live Supabase round-trip, since the fallback decision is pure logic — the DB query itself is exercised implicitly by every existing manual/integration test of the chat flow.
- **No regression for `mode: 'default'` (the common case):** `getRouterChain(category, 'default')` skips the parallel dual-fetch and behaves identically to today's single-query path, just with an added `.eq('mode', 'default')` filter — this only matches existing rows post-migration since Task 1 backfills all existing rows to `mode = 'default'`.
