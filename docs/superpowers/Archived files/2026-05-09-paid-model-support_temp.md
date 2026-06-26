# Paid Model Support — Discovery, Registry, Cost Guardrails

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow operators to optionally discover, add, and use paid models from OpenRouter (and potentially other providers) with appropriate guardrails: opt-in UI toggles, visual cost badges, confirmation dialogs before adding paid models, and cost tracking at runtime.

**Background / Why This Exists:** Currently, `fetchOpenRouter()` in `src/app/admin/discover/actions.ts` strips out all paid models with a hard filter (`endsWith(':free') || price === 0`). Models like `google/gemini-3.1-flash-lite` (the non-`:free` variant) are invisible in the Discover page, can never be added to the model registry, and therefore can never be used in router chains — even if the operator explicitly wants to pay for them.

**Architecture:**
- **Database:** New `is_paid` + `prompt_cost` + `completion_cost` columns on `models` table; new `cost_log` table for per-request cost auditing
- **Discovery:** `fetchOpenRouter()` returns ALL models with pricing info; UI shows a "Show Paid Models" toggle (off by default); paid rows get amber visual badges
- **Registry:** `addModel`/`updateModel` accept optional cost fields; confirmation dialog before adding a paid model to prevent accidental billing
- **Router:** `FlowRouterModel` type gains `isPaid` field; OpenRouter runtime provider logs estimated cost per request to `cost_log`
- **Admin UI:** Models table shows paid/free badge and per-token cost; Router chain editor shows PAID indicator on paid model chips

**Risk:** Allowing paid models means potential billing exposure. Mitigations: (1) toggle is off by default, (2) confirmation dialog on every paid model add, (3) cost is logged per-request for auditability, (4) no auto-routing to paid models — operators must manually add them to chains.

**Tech Stack:** Next.js 14 App Router, React, Supabase (admin client), Tailwind, Lucide React, existing vault/models/router actions.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `supabase/migrations/20260509_paid_models.sql` | Create | Add `is_paid`, `prompt_cost`, `completion_cost` columns to `models`; create `cost_log` table |
| `src/app/admin/discover/actions.ts` | Modify | `fetchOpenRouter()` returns ALL models; add `isPaid`, `promptCost`, `completionCost` to `DiscoveredModel` |
| `src/app/admin/discover/DiscoverClient.tsx` | Modify | Add "Show Paid Models" toggle, cost column, PAID badge, confirmation dialog |
| `src/app/admin/models/actions.ts` | Modify | `addModel`/`updateModel` accept cost fields; add `logModelCost` action |
| `src/components/admin/ModelsTable.tsx` | Modify | Show paid/free badge and per-token cost columns |
| `src/data/store.types.ts` | Modify | Add `isPaid?: boolean` to `FlowRouterModel` |
| `src/lib/bot/providers/openrouter.ts` | Modify | Parse tokens from response; fire-and-forget log to `cost_log` |
| `src/lib/bot/chainRouter.ts` | Modify | Add `totalCost` to `ChainResponse`; annotate paid model usage in logs |
| `src/app/admin/router/actions.ts` | Modify | Join `is_paid` from models table for router admin UI data |
| `src/components/admin/SortableRouterGrid.tsx` | Modify | Show PAID badge on paid model chips in chain editor |



---

### Task 1: Database migration — add cost tracking fields

**Files:**
- Create: `supabase/migrations/20260509_paid_models.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- 20260509_paid_models.sql
-- Adds cost tracking to the models registry and creates a per-request cost log.

-- Add cost columns to existing models table
ALTER TABLE models 
  ADD COLUMN IF NOT EXISTS is_paid BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS prompt_cost NUMERIC(10,8) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS completion_cost NUMERIC(10,8) DEFAULT NULL;

-- Per-request cost log for auditing and billing awareness
CREATE TABLE IF NOT EXISTS cost_log (
  id BIGSERIAL PRIMARY KEY,
  model_id TEXT NOT NULL REFERENCES models(id),
  provider TEXT NOT NULL DEFAULT 'openrouter',
  prompt_cost NUMERIC(10,8) NOT NULL DEFAULT 0,
  completion_cost NUMERIC(10,8) NOT NULL DEFAULT 0,
  total_cost NUMERIC(10,8) NOT NULL DEFAULT 0,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for querying cost logs
CREATE INDEX IF NOT EXISTS idx_cost_log_model ON cost_log(model_id);
CREATE INDEX IF NOT EXISTS idx_cost_log_created ON cost_log(created_at);
```

- [ ] **Step 2: Run the migration**

```bash
npx supabase migration up
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260509_paid_models.sql
git commit -m "feat(paid-models): add cost tracking columns and cost_log table"
```

---

### Task 2: Update DiscoveredModel type and OpenRouter fetcher

**Files:**
- Modify: `src/app/admin/discover/actions.ts`

- [ ] **Step 1: Extend `DiscoveredModel` interface**

Add to the existing interface (around line 19):

```typescript
export interface DiscoveredModel {
  id: string
  displayName: string
  provider: string
  contextWindow: number | null
  maxOutputTokens: number | null
  rpd: number | null
  rpm: number | null
  modalities: {
    input: string[]
    output: string[]
  }
  inRegistry: boolean
  // NEW FIELDS:
  isPaid?: boolean
  promptCost?: number | null
  completionCost?: number | null
}
```

- [ ] **Step 2: Rewrite `fetchOpenRouter()` to return ALL models with pricing**

Replace the entire `fetchOpenRouter` function (currently lines 196–228):

```typescript
async function fetchOpenRouter(apiKey: string): Promise<DiscoveredModel[]> {
  const res = await fetch('https://openrouter.ai/api/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (!res.ok) throw new Error(`OpenRouter API error: ${res.status} ${res.statusText}`)
  const data = await res.json()

  return (data.data ?? []).map((m: any) => {
    const arch = m.architecture ?? {}
    const promptPrice = parseFloat(m.pricing?.prompt ?? '0')
    const completionPrice = parseFloat(m.pricing?.completion ?? '0')
    const isFree = (m.id ?? '').toLowerCase().endsWith(':free') || (promptPrice === 0 && completionPrice === 0)

    return {
      id: m.id,
      displayName: m.name ?? m.id,
      provider: 'openrouter',
      contextWindow: m.context_length ?? null,
      maxOutputTokens: null,
      rpd: null,
      rpm: null,
      modalities: getModalities(m.id, arch.input_modalities ?? ['text'], arch.output_modalities ?? ['text']),
      isPaid: !isFree,
      promptCost: isFree ? 0 : promptPrice,
      completionCost: isFree ? 0 : completionPrice,
      inRegistry: false,
    }
  })
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/discover/actions.ts
git commit -m "feat(paid-models): discover all OpenRouter models with pricing info"
```

---

### Task 3: Update DiscoverClient — paid toggle, cost column, badge, confirmation dialog

**Files:**
- Modify: `src/app/admin/discover/DiscoverClient.tsx`

- [ ] **Step 1: Add `showPaid` state and filter visible models**

Add state at the top of the `DiscoverClient` component (around line 281):

```typescript
const [showPaid, setShowPaid] = useState(false)
```

Add a filter right before rendering `ResultsTable`:

```typescript
const visibleModels = showPaid ? models : models.filter(m => !m.isPaid)
```

- [ ] **Step 2: Add "Show Paid Models" toggle to the controls bar**

After the provider select dropdown (around line 387), add:

```tsx
{provider === 'openrouter' && (
  <label className="flex items-center gap-2 text-[11px] text-bone-60 cursor-pointer select-none ml-2">
    <input
      type="checkbox"
      checked={showPaid}
      onChange={e => { setShowPaid(e.target.checked); setModels([]) }}
      className="accent-accent w-3.5 h-3.5 rounded"
    />
    Show paid models
  </label>
)}
```

- [ ] **Step 3: Insert a "Cost" column into the header grid**

The current grid is `grid-cols-[2fr_1.5fr_80px_80px_70px_70px_100px_100px_60px_80px]`. Change it to:
`grid-cols-[2fr_1.5fr_80px_80px_70px_70px_100px_100px_100px_60px_80px]`

Add `{ label: 'Cost', field: null }` to the `HEADERS` array after the Output column (index 7).

- [ ] **Step 4: Add cost badge display in each row**

In each row grid cell, after the output modalities div, add a cost cell:

```tsx
{/* Cost */}
<div className="flex flex-wrap gap-1 self-center">
  {m.isPaid ? (
    <span className="px-1.5 py-0.5 rounded-medium text-[8px] font-bold uppercase tracking-wider border text-amber-400 border-amber-400/20 bg-amber-400/10">
      ${(m.promptCost ?? 0).toFixed(6)} / ${(m.completionCost ?? 0).toFixed(6)}
    </span>
  ) : (
    <span className="px-1.5 py-0.5 rounded-medium text-[8px] font-bold uppercase tracking-wider border text-green-400 border-green-400/20 bg-green-400/10">
      Free
    </span>
  )}
</div>
```

- [ ] **Step 5: Add confirmation dialog when adding a paid model to registry**

Modify the `handleAdd` function (around line 344):

```typescript
async function handleAdd(model: DiscoveredModel) {
  // Paid model confirmation guard
  if (model.isPaid && !model.inRegistry) {
    const confirmed = window.confirm(
      `⚠️ "${model.id}" is a PAID model.\n\n` +
      `Prompt cost: $${(model.promptCost ?? 0).toFixed(6)} per token\n` +
      `Completion cost: $${(model.completionCost ?? 0).toFixed(6)} per token\n\n` +
      `Adding it to the registry will allow routing to this model, ` +
      `which will incur charges on your OpenRouter account.\n\n` +
      `Are you sure you want to add this paid model?`
    )
    if (!confirmed) return
  }
  // ... rest of existing add logic ...
}
```

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/discover/DiscoverClient.tsx
git commit -m "feat(paid-models): add paid toggle, cost badge, and confirmation dialog"
```

---
### Task 4: Update Models admin actions — accept cost fields, add cost logging action

**Files:**
- Modify: `src/app/admin/models/actions.ts`

- [ ] **Step 1: Extend `addModel` to accept and store cost fields**

Modify the `addModel` function signature and body:

```typescript
export async function addModel(model: {
  id: string
  provider: string
  input_modalities: string[]
  output_modalities: string[]
  max_rpd?: number | null
  is_paid?: boolean
  prompt_cost?: number | null
  completion_cost?: number | null
}) {
  const { error } = await supabaseAdmin
    .from('models')
    .insert({ 
      ...model, 
      is_paid: model.is_paid ?? false,
      prompt_cost: model.prompt_cost ?? null,
      completion_cost: model.completion_cost ?? null,
      usage_today: 0, 
      last_reset_date: new Date().toISOString().split('T')[0] 
    })
  if (error) throw new Error(error.message)
  revalidatePath('/admin/models')
  revalidatePath('/admin/discover')
}
```

- [ ] **Step 2: Extend `updateModel` to accept cost fields**

Add `is_paid`, `prompt_cost`, `completion_cost` to the `updates` type.

- [ ] **Step 3: Add `logModelCost` server action**

Append this new action to the file:

```typescript
export async function logModelCost(cost: {
  model_id: string
  provider: string
  prompt_cost: number
  completion_cost: number
  total_cost: number
  prompt_tokens: number
  completion_tokens: number
}) {
  const { error } = await supabaseAdmin.from('cost_log').insert(cost)
  if (error) console.error('[CostLog] Failed to log cost:', error.message)
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/models/actions.ts
git commit -m "feat(paid-models): accept cost fields in add/update and add logModelCost action"
```

---

### Task 5: Update Models admin table — show paid/free badge and cost

**Files:**
- Modify: `src/components/admin/ModelsTable.tsx`

- [ ] **Step 1: Add cost-related fields to ModelRow interface**

In the `ModelRow` interface (around line 106), add:
```typescript
is_paid?: boolean
prompt_cost?: number | null
completion_cost?: number | null
```

- [ ] **Step 2: Add "Type" column header and cell**

After the provider column, add a new `<th>` for "Type" and render:
```tsx
{model.is_paid ? (
  <span className="px-1.5 py-0.5 rounded-medium text-[8px] font-bold uppercase tracking-wider border text-amber-400 border-amber-400/20 bg-amber-400/10">
    PAID
  </span>
) : (
  <span className="px-1.5 py-0.5 rounded-medium text-[8px] font-bold uppercase tracking-wider border text-green-400 border-green-400/20 bg-green-400/10">
    FREE
  </span>
)}
```

- [ ] **Step 3: Add "Cost" column**

After the type column, add per-token cost display:
```tsx
{model.is_paid && model.prompt_cost != null
  ? `$${model.prompt_cost.toFixed(6)} / $${model.completion_cost?.toFixed(6) ?? '?'}`
  : '—'}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/ModelsTable.tsx
git commit -m "feat(paid-models): show paid/free badge and cost in Models table"
```

---

### Task 6: Update FlowRouterModel type — add `isPaid` field

**Files:**
- Modify: `src/data/store.types.ts`

- [ ] **Step 1: Add `isPaid` field to `FlowRouterModel`**

```typescript
export interface FlowRouterModel {
  id: string
  label: string
  provider: 'openrouter' | 'gemini' | 'google' | 'groq' | 'local' | 'vault' | 'cloudflare' | 'huggingface' | 'pollinations'
  enabled: boolean
  dailyLimit: number | null
  isPaid?: boolean  // NEW: indicates this model costs money per-request
}
```

- [ ] **Step 2: Commit**

```bash
git add src/data/store.types.ts
git commit -m "feat(paid-models): add isPaid to FlowRouterModel type"
```


---

### Task 7: Router admin page — show paid indicator on model chips

**Files:**
- Modify: `src/app/admin/router/actions.ts` (router data fetching)
- Modify: `src/components/admin/SortableRouterGrid.tsx` (visual indicator)

- [ ] **Step 1: Join `is_paid` info when loading router chain data**

When fetching `router_chains` for the admin page, cross-reference with `models` table. After loading chain data, annotate each model:

```typescript
// After loading chain data from router_chains
const { data: modelsData } = await supabaseAdmin
  .from('models')
  .select('id, is_paid')
const paidMap = new Map((modelsData ?? []).map((m: any) => [m.id, m.is_paid]))

// Annotate each model in the chain
const annotatedChain = (chainResult.data.model_list as RouterModel[]).map(m => ({
  ...m,
  is_paid: paidMap.get(m.id) ?? false,
}))
```

- [ ] **Step 2: Add visual PAID indicator in SortableRouterGrid**

In `src/components/admin/SortableRouterGrid.tsx`, when rendering model chips in a chain, show an amber badge:

```tsx
{m.is_paid && (
  <span className="ml-1 px-1 py-0.5 rounded-sm text-[7px] font-bold uppercase tracking-wider text-amber-400 border border-amber-400/20 bg-amber-400/10">
    PAID
  </span>
)}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/router/actions.ts src/components/admin/SortableRouterGrid.tsx
git commit -m "feat(paid-models): show paid indicator in router chain editor"
```

---

### Task 8: Update chainRouter — add cost awareness

**Files:**
- Modify: `src/lib/bot/chainRouter.ts`

- [ ] **Step 1: Add `totalCost` to `ChainResponse` interface**

```typescript
export interface ChainResponse {
  // ... existing fields ...
  totalCost?: number  // NEW: accumulated cost in USD for this request
}
```

- [ ] **Step 2: Log cost info when a paid model succeeds**

After a successful response from any provider (around line 574), look up and log cost info:

```typescript
if (response) {
  // Fire-and-forget cost lookup
  if (category !== 'IMAGE_GEN') {
    supabaseAdmin
      .from('models')
      .select('is_paid, prompt_cost, completion_cost')
      .eq('id', modelConfig.id)
      .maybeSingle()
      .then(({ data: costData }) => {
        if (costData?.is_paid) {
          logger.info(`[Cost] ${modelConfig.id} is PAID ($${costData.prompt_cost}/$${costData.completion_cost per token)`)
        }
      })
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/bot/chainRouter.ts
git commit -m "feat(paid-models): add cost awareness to chain router response"
```

---
