# Adaptive Deep Research Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix multi-constraint research requests (e.g. "best 10 LLMs under $X, must include model Y, as a table") by replacing the RESEARCH chain's single-search + gap-detector loop with a planner that decomposes the request into parallel targeted searches plus an explicit constraint checklist, and sharpen classifier routing so these requests reach RESEARCH instead of WEB_SEARCH.

**Architecture:** A new `runResearchPlanner` function in `deepResearch.ts` makes one LLM call to extract 1-3 sub-queries plus `mustInclude`/`constraints` from the user's request. `runDeepResearchChain` runs all sub-queries in parallel (replacing the old sequential round-1 + gap-detector + round-2), merges results, and appends a checklist built from the planner's output. `chainRouter.ts`'s existing model loop is untouched — it already runs RESEARCH's configured answer model against the merged findings. Separately, `classifier.txt` gets a sharper RESEARCH-vs-WEB_SEARCH boundary, and three independent Exa/Tavily provider fixes are applied.

**Tech Stack:** TypeScript, vitest, existing provider modules (`google.ts`, `openrouter.ts`, `groq.ts`, `tavily.ts`, `exa.ts`)

---

## File Structure

- **Modify** `src/lib/bot/providers/deepResearch.ts` — replace `detectGaps`/round-2 loop with `buildPlannerPrompt` (pure, testable) + `runResearchPlanner` (LLM call) + parallel search step in `runDeepResearchChain`.
- **Create** `src/lib/bot/prompts/chains/research_planner.txt` — new planner prompt (JSON-only output, mirrors `deep_research_gap_detector.txt` style).
- **Delete** `src/lib/bot/prompts/chains/deep_research_gap_detector.txt` — no longer used once gap-detector is removed.
- **Modify** `src/lib/bot/prompts/chains/classifier.txt` — sharpen RESEARCH definition and routing priority rule 5.
- **Modify** `src/lib/bot/providers/exa.ts` — fix `searchExa` to request `contents.text` so results aren't empty; cap `extractExaUrls`.
- **Modify** `src/lib/bot/providers/content-extract.ts` — cap Exa/Tavily extract content length.
- **Create** `src/lib/bot/providers/deepResearch.test.ts` — unit tests for the new pure planner-prompt-building and checklist-building functions.

`src/lib/bot/providers/tavily.ts` (the single-shot WEB_SEARCH provider) is NOT modified — it keeps `searchDepth: 'advanced'` since it only ever makes one call per request.

---

## Task 1: Fix Exa search content bug

**Files:**
- Modify: `src/lib/bot/providers/exa.ts:19-32`

**Problem:** `searchExa`'s POST body to `https://api.exa.ai/search` never requests `contents`, so Exa's `/search` endpoint returns only title/url/date — no page text. The result mapper at line 47-49 does `r.text || r.snippet || ''`, but neither field is ever populated, so every Exa search result today has an empty `CONTENT:` block.

- [ ] **Step 1: Read the current request body**

Confirm the current state at `src/lib/bot/providers/exa.ts:25-30`:

```typescript
      body: JSON.stringify({
        query: cleanQuery,
        numResults: 5,
        type: 'auto',
        startPublishedDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
      }),
```

- [ ] **Step 2: Add inline contents request**

Edit `src/lib/bot/providers/exa.ts:25-30` to:

```typescript
      body: JSON.stringify({
        query: cleanQuery,
        numResults: 5,
        type: 'auto',
        startPublishedDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        contents: { text: { maxCharacters: 2000 } },
      }),
```

- [ ] **Step 3: Verify the result mapper still works unchanged**

`src/lib/bot/providers/exa.ts:47-49` already reads `r.text` — no change needed there, since Exa returns extracted text under `results[].text` when `contents.text` is requested.

- [ ] **Step 4: Commit**

```bash
git add src/lib/bot/providers/exa.ts
git commit -m "fix(exa): request inline contents.text so search results include page content"
```

---

## Task 2: Cap extracted content length (Exa + Tavily)

**Files:**
- Modify: `src/lib/bot/providers/exa.ts:56-95` (`extractExaUrls`)
- Modify: `src/lib/bot/providers/content-extract.ts:10-54` (`extractViaExa`, `extractViaTavily`)

**Problem:** Full page text flows uncapped from Exa's `/contents` endpoint and Tavily's `extract` into the LLM context, inflating token cost. Cap both at ~4000 characters per page.

- [ ] **Step 1: Cap Exa's `/contents` call in `extractExaUrls`**

In `src/lib/bot/providers/exa.ts`, change the request body at line 72 from:

```typescript
      body: JSON.stringify({ urls }),
```

to:

```typescript
      body: JSON.stringify({ urls, text: { maxCharacters: 4000 } }),
```

- [ ] **Step 2: Cap Exa's `/contents` call in `content-extract.ts`'s `extractViaExa`**

In `src/lib/bot/providers/content-extract.ts`, change the request body at line 22 from:

```typescript
      body: JSON.stringify({ urls }),
```

to:

```typescript
      body: JSON.stringify({ urls, text: { maxCharacters: 4000 } }),
```

- [ ] **Step 3: Truncate Tavily's extract result in `content-extract.ts`'s `extractViaTavily`**

In `src/lib/bot/providers/content-extract.ts`, change the mapper at lines 46-50 from:

```typescript
    return results.results.map((r: any) => ({
      url: r.url,
      title: r.title || '',
      content: r.content || r.rawContent || '',
    }))
```

to:

```typescript
    return results.results.map((r: any) => ({
      url: r.url,
      title: r.title || '',
      content: (r.content || r.rawContent || '').slice(0, 4000),
    }))
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/bot/providers/exa.ts src/lib/bot/providers/content-extract.ts
git commit -m "perf(search): cap extracted page content at 4000 chars to bound LLM token cost"
```

---

## Task 3: Switch deep research's search depth to `basic`

**Files:**
- Modify: `src/lib/bot/providers/deepResearch.ts:15`

**Problem:** Deep research's parallel fan-out (1-3 queries per request, all via this local `searchTavily`) uses `searchDepth: 'advanced'` (2 credits/query). Since the redesign multiplies query count, switch this call site to `'basic'` (1 credit/query) to control cost — the single-shot `WEB_SEARCH` chain in `tavily.ts` keeps `'advanced'` unchanged since it only ever makes one call.

- [ ] **Step 1: Change the search depth**

In `src/lib/bot/providers/deepResearch.ts`, change line 15 from:

```typescript
    const results = await client.search(query, { searchDepth: 'advanced', maxResults: 5, days: 60 })
```

to:

```typescript
    const results = await client.search(query, { searchDepth: 'basic', maxResults: 5, days: 60 })
```

- [ ] **Step 2: Confirm `tavily.ts`'s single-shot search is untouched**

Run: `grep -n "searchDepth" src/lib/bot/providers/tavily.ts`
Expected: still shows `searchDepth: 'advanced'` at the primary search call (unchanged) — confirms only the RESEARCH-chain call site changed.

- [ ] **Step 3: Commit**

```bash
git add src/lib/bot/providers/deepResearch.ts
git commit -m "perf(research): use basic Tavily search depth for parallel research fan-out"
```

---

## Task 4: Sharpen classifier RESEARCH vs WEB_SEARCH routing

**Files:**
- Modify: `src/lib/bot/prompts/chains/classifier.txt`

**Problem:** `RESEARCH` is defined too vaguely and routing priority rule 5 sends any query naming a product straight to `WEB_SEARCH`, so multi-constraint requests never reach RESEARCH.

- [ ] **Step 1: Replace the RESEARCH category definition**

In `src/lib/bot/prompts/chains/classifier.txt`, replace line 27:

```
RESEARCH: Exhaustive topic research and synthesis. Triggered by deep research intents.
```

with:

```
RESEARCH: Multi-constraint queries where a single search result is unlikely to satisfy
everything at once — e.g. a ranked/list request combined with a filter (price range,
date range, etc.) AND a specific required inclusion; or requests explicitly combining
several distinct research angles (pricing + specs + availability) into one structured
output. Plain "compare X vs Y" or "X vs Y vs Z" is NOT RESEARCH by itself — comparison
articles are a standard single-search result. RESEARCH requires an extra constraint
beyond just naming multiple entities to compare (e.g. "compare X and Y, but only ones
under $50/mo", "compare X vs Y vs Z and tell me which supports feature W").
```

- [ ] **Step 2: Update routing priority rule 5**

In the same file, replace line 42:

```
5. Names ANY product/model/version/company/event (and NOT a reference to the user's own image) -> WEB_SEARCH
```

with:

```
5. Names ANY product/model/version/company/event (and NOT a reference to the user's own image):
   - Has 2+ independent constraints (list/ranking + filter + required inclusion, or
     comparison + an extra filter/feature requirement) -> RESEARCH
   - Single constraint / straightforward lookup (including plain "compare X vs Y") -> WEB_SEARCH
```

- [ ] **Step 3: Manually verify prompt loads without error**

Run: `node -e "const {getChainPrompt}=require('./src/lib/bot/prompts'); console.log(getChainPrompt('classifier').includes('RESEARCH requires an extra constraint'))"`

This requires the TS to be compiled or run via ts-node; if that's not set up, instead just re-read the file to confirm no syntax issues (it's a plain `.txt` file, loaded via `readFileSync`, so there's no compile step — a visual check that the file is well-formed text is sufficient):

Run: `cat "src/lib/bot/prompts/chains/classifier.txt"` and confirm the RESEARCH section and rule 5 read correctly with no stray characters.

- [ ] **Step 4: Commit**

```bash
git add src/lib/bot/prompts/chains/classifier.txt
git commit -m "fix(classifier): route multi-constraint product queries to RESEARCH instead of WEB_SEARCH"
```

---

## Task 5: Write the research planner prompt

**Files:**
- Create: `src/lib/bot/prompts/chains/research_planner.txt`

- [ ] **Step 1: Create the planner prompt file**

```
You are a research query planner. Given a user's research request, break it into
independent search queries and extract hard requirements the final answer must satisfy.

Identify each INDEPENDENT facet of the request — a ranking/list, a filter (price,
date, feature), a specific entity that must be covered, a comparison angle — and
turn each into its own targeted search query. Do not just repeat the user's question
as one query. If the request truly has only one facet, return exactly one query
that is the core topic.

Output ONLY a JSON object, nothing else, in this exact shape:
{"queries": ["...", "..."], "mustInclude": ["..."], "constraints": ["..."]}

- "queries": 1 to 3 search queries, one per independent facet. Never more than 3.
- "mustInclude": specific named entities/items the user explicitly required to be
  covered (e.g. a named product that must appear in a comparison). Empty array if none.
- "constraints": format or filter rules the final answer must follow (e.g. "price
  under $50/month", "output as a table", "only 2026 releases"). Empty array if none.

Examples:

User request: "what are the best 10 llms right now under $20/month, make sure to
include Claude, write it as a comparison table"
{"queries": ["best LLMs 2026 ranked", "LLM pricing under $20 per month", "Claude model pricing and specs"], "mustInclude": ["Claude"], "constraints": ["price under $20/month", "output as a comparison table"]}

User request: "compare gpt-5 and gemini 3 pro, but only if gemini supports function calling"
{"queries": ["gpt-5 vs gemini 3 pro comparison", "gemini 3 pro function calling support"], "mustInclude": [], "constraints": ["only relevant if gemini 3 pro supports function calling"]}

User request: "what is the latest version of react"
{"queries": ["latest React version"], "mustInclude": [], "constraints": []}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/bot/prompts/chains/research_planner.txt
git commit -m "feat(research): add research planner prompt for query decomposition"
```

---

## Task 6: Add pure helper functions with tests (planner prompt builder + checklist builder)

**Files:**
- Modify: `src/lib/bot/providers/deepResearch.ts`
- Create: `src/lib/bot/providers/deepResearch.test.ts`

**Rationale:** `runDeepResearchChain` and `runResearchPlanner` make live LLM/API calls and aren't unit-testable without mocking the entire provider stack. Extract the two pure pieces of logic — building the planner's input prompt, and building the constraint checklist from the planner's JSON output — into standalone functions so they're independently testable.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/bot/providers/deepResearch.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { buildPlannerPrompt, buildChecklist, parsePlannerOutput } from './deepResearch'

describe('buildPlannerPrompt', () => {
  it('embeds the planner system prompt and the user question', () => {
    const result = buildPlannerPrompt('best 10 llms under $20', 'PLANNER INSTRUCTIONS HERE')
    expect(result).toContain('PLANNER INSTRUCTIONS HERE')
    expect(result).toContain('best 10 llms under $20')
  })
})

describe('parsePlannerOutput', () => {
  it('parses a well-formed planner JSON response', () => {
    const raw = '{"queries": ["a", "b"], "mustInclude": ["Claude"], "constraints": ["under $20"]}'
    const result = parsePlannerOutput(raw, 'fallback query')
    expect(result).toEqual({ queries: ['a', 'b'], mustInclude: ['Claude'], constraints: ['under $20'] })
  })

  it('extracts JSON embedded in surrounding text', () => {
    const raw = 'Here is the plan:\n{"queries": ["x"], "mustInclude": [], "constraints": []}\nDone.'
    const result = parsePlannerOutput(raw, 'fallback query')
    expect(result.queries).toEqual(['x'])
  })

  it('caps queries at 3 even if the model returns more', () => {
    const raw = '{"queries": ["a", "b", "c", "d", "e"], "mustInclude": [], "constraints": []}'
    const result = parsePlannerOutput(raw, 'fallback query')
    expect(result.queries).toHaveLength(3)
  })

  it('falls back to a single query built from the original prompt when parsing fails', () => {
    const result = parsePlannerOutput('not json at all', 'fallback query')
    expect(result).toEqual({ queries: ['fallback query'], mustInclude: [], constraints: [] })
  })

  it('falls back when the model returns null/empty response', () => {
    const result = parsePlannerOutput(null, 'fallback query')
    expect(result).toEqual({ queries: ['fallback query'], mustInclude: [], constraints: [] })
  })

  it('falls back to the original query when queries array is empty', () => {
    const raw = '{"queries": [], "mustInclude": [], "constraints": []}'
    const result = parsePlannerOutput(raw, 'fallback query')
    expect(result.queries).toEqual(['fallback query'])
  })
})

describe('buildChecklist', () => {
  it('returns empty string when there is nothing to check', () => {
    expect(buildChecklist({ queries: ['x'], mustInclude: [], constraints: [] })).toBe('')
  })

  it('formats mustInclude and constraints into a checklist block', () => {
    const result = buildChecklist({
      queries: ['x'],
      mustInclude: ['Claude'],
      constraints: ['under $20/month', 'output as a table'],
    })
    expect(result).toContain('Claude')
    expect(result).toContain('under $20/month')
    expect(result).toContain('output as a table')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/bot/providers/deepResearch.test.ts`
Expected: FAIL — `buildPlannerPrompt`, `buildChecklist`, `parsePlannerOutput` are not exported from `deepResearch.ts` yet.

- [ ] **Step 3: Implement `parsePlannerOutput`, `buildPlannerPrompt`, `buildChecklist`**

In `src/lib/bot/providers/deepResearch.ts`, remove the existing `detectGaps` function (lines 78-107) and replace it with:

```typescript
export interface ResearchPlan {
  queries: string[]
  mustInclude: string[]
  constraints: string[]
}

export function buildPlannerPrompt(originalQuestion: string, plannerSystemPrompt: string): string {
  return `${plannerSystemPrompt}\n\nUSER REQUEST: ${originalQuestion}`
}

export function parsePlannerOutput(raw: string | null, fallbackQuery: string): ResearchPlan {
  const fallback: ResearchPlan = { queries: [fallbackQuery], mustInclude: [], constraints: [] }
  if (!raw) return fallback

  try {
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return fallback
    const parsed = JSON.parse(match[0])

    const queries = Array.isArray(parsed.queries)
      ? parsed.queries.filter((q: any) => typeof q === 'string' && q.trim()).slice(0, 3)
      : []
    const mustInclude = Array.isArray(parsed.mustInclude)
      ? parsed.mustInclude.filter((m: any) => typeof m === 'string' && m.trim())
      : []
    const constraints = Array.isArray(parsed.constraints)
      ? parsed.constraints.filter((c: any) => typeof c === 'string' && c.trim())
      : []

    return {
      queries: queries.length > 0 ? queries : [fallbackQuery],
      mustInclude,
      constraints,
    }
  } catch {
    return fallback
  }
}

export function buildChecklist(plan: ResearchPlan): string {
  if (plan.mustInclude.length === 0 && plan.constraints.length === 0) return ''

  const lines: string[] = []
  if (plan.mustInclude.length > 0) {
    lines.push(`Must include: ${plan.mustInclude.join(', ')}`)
  }
  if (plan.constraints.length > 0) {
    lines.push(`Must satisfy: ${plan.constraints.join('; ')}`)
  }
  return `[ANSWER REQUIREMENTS — verify all before responding]\n${lines.join('\n')}`
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/bot/providers/deepResearch.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/bot/providers/deepResearch.ts src/lib/bot/providers/deepResearch.test.ts
git commit -m "refactor(research): replace detectGaps with testable planner prompt/output helpers"
```

---

## Task 7: Wire the planner LLM call and parallel search into `runDeepResearchChain`

**Files:**
- Modify: `src/lib/bot/providers/deepResearch.ts`

**Problem:** `runDeepResearchChain` still runs the old round1-then-gap-loop structure. Replace it with: fetch the planner model → call it once → parse its output into a `ResearchPlan` → run all `plan.queries` in parallel via `bestSearch` → merge results → append the checklist.

- [ ] **Step 1: Add a `runResearchPlanner` function**

In `src/lib/bot/providers/deepResearch.ts`, add this function near `buildPlannerPrompt` (after Task 6's helpers):

```typescript
async function runResearchPlanner(originalQuestion: string, plannerSystemPrompt: string, plannerModel: any, context?: any): Promise<ResearchPlan> {
  const fullPrompt = buildPlannerPrompt(originalQuestion, plannerSystemPrompt)

  try {
    let raw: string | null = null
    const provider = plannerModel.provider.toLowerCase()

    if (provider === 'google') {
      const { runGoogle } = await import('./google')
      const res = await runGoogle(plannerModel.id, fullPrompt, undefined, undefined, undefined)
      raw = typeof res === 'object' && res !== null ? (res as any).content ?? null : res ?? null
    } else if (provider === 'openrouter') {
      const { runOpenRouter } = await import('./openrouter')
      const res = await runOpenRouter(plannerModel.id, fullPrompt, undefined, [], undefined, { ...(context || {}), openrouterProvider: plannerModel.openrouter_provider })
      raw = typeof res === 'object' && res !== null ? (res as any).content ?? null : res ?? null
    } else if (provider === 'groq') {
      const { runGroq } = await import('./groq')
      const res = await runGroq(plannerModel.id, fullPrompt, undefined, undefined, undefined, [])
      raw = typeof res === 'string' ? res : null
    }

    return parsePlannerOutput(raw, originalQuestion)
  } catch {
    return parsePlannerOutput(null, originalQuestion)
  }
}
```

- [ ] **Step 2: Replace `runDeepResearchChain`'s body**

Replace the full function body (currently lines 122-193, from `export async function runDeepResearchChain` to its closing brace) with:

```typescript
export async function runDeepResearchChain(prompt: string, chainModels: import('../../router-config').RouterModel[], context?: any): Promise<{
  researchText: string
  findings?: string
  gapTrace: { model: string; key: string; success: boolean; category?: string }[]
}> {
  logger.info(`Starting adaptive deep research for: ${prompt}`)

  const { getRouterChain } = await import('../../router-config')

  const plannerChainCategory = 'REGULAR'
  const plannerSystemPrompt = getChainPrompt('research_planner')

  const { chain: plannerChain } = await getRouterChain(plannerChainCategory, 'default')
  const plannerModel = plannerChain.find(m => m.is_enabled)

  // Build a research query from vision notes when available.
  // The raw user prompt is often conversational ("imagine you are from prague..."),
  // but vision already extracted the real research topic in [VISION INSTRUCTIONS].
  const researchQuery = context?.vision_notes
    ? extractSearchQuery(context.vision_notes, prompt)
    : prompt
  logger.info(`Deep research using query: ${researchQuery}`)

  const plan: ResearchPlan = plannerModel
    ? await runResearchPlanner(researchQuery, plannerSystemPrompt, plannerModel, context)
    : { queries: [researchQuery], mustInclude: [], constraints: [] }

  logger.info(`Deep research plan: ${JSON.stringify(plan)}`)

  const searchResults = await Promise.all(plan.queries.map(q => bestSearch(q, chainModels, context)))

  const findingsParts: string[] = []
  for (let i = 0; i < plan.queries.length; i++) {
    const result = searchResults[i]
    if (!result) continue
    findingsParts.push(`[QUERY: ${plan.queries[i]}]\n${result.text}`)

    if (result.urls.length > 0) {
      const pages = await extractContent(result.urls, context)
      if (pages.length > 0) {
        findingsParts.push(`[EXTRACTED CONTENT for "${plan.queries[i]}"]\n${formatExtractedPages(pages)}`)
      }
    }
  }

  if (findingsParts.length === 0) {
    return { researchText: 'Search failed to retrieve results.', gapTrace: [] }
  }

  const checklist = buildChecklist(plan)
  const allFindings = findingsParts.join('\n\n---\n\n') + (checklist ? `\n\n${checklist}` : '')

  const gapTrace: { model: string; key: string; success: boolean; category?: string }[] = []
  if (plannerModel) {
    gapTrace.push({
      model: plannerModel.id,
      key: plannerChainCategory,
      success: true,
      category: plannerChainCategory,
    })
  }

  return {
    researchText: `RESEARCH FINDINGS:\n${allFindings}\n\nUSER QUESTION:\n${prompt}`,
    findings: allFindings,
    gapTrace,
  }
}
```

- [ ] **Step 3: Remove the now-unused `research_pipeline` prompt reference**

Confirm no remaining references to `getChainPrompt('research_pipeline')`:

Run: `grep -rn "research_pipeline" src/`
Expected: no output (the only reference was in the code just replaced).

- [ ] **Step 4: Run the full test suite**

Run: `npx vitest run src/lib/bot/providers/deepResearch.test.ts`
Expected: PASS (same 7 tests from Task 6 — `parsePlannerOutput`/`buildPlannerPrompt`/`buildChecklist` are unchanged, only `runDeepResearchChain`/`runResearchPlanner` were added/replaced around them)

- [ ] **Step 5: Type-check the project**

Run: `npx tsc --noEmit`
Expected: no new errors introduced in `deepResearch.ts` (pre-existing unrelated errors elsewhere, if any, are not this task's concern — only check that `deepResearch.ts` itself is clean)

- [ ] **Step 6: Commit**

```bash
git add src/lib/bot/providers/deepResearch.ts
git commit -m "feat(research): run planner-decomposed queries in parallel, remove gap-detector loop"
```

---

## Task 8: Delete the unused gap-detector prompt file

**Files:**
- Delete: `src/lib/bot/prompts/chains/deep_research_gap_detector.txt`

- [ ] **Step 1: Confirm no remaining references**

Run: `grep -rn "deep_research_gap_detector" src/`
Expected: no output.

- [ ] **Step 2: Delete the file**

```bash
git rm src/lib/bot/prompts/chains/deep_research_gap_detector.txt
```

- [ ] **Step 3: Commit**

```bash
git commit -m "chore(research): remove unused gap-detector prompt file"
```

---

## Task 9: Manual end-to-end verification

**Files:** none (manual testing against the running app)

- [ ] **Step 1: Start the dev server**

Run: `npm run dev` (or the project's existing dev script — check `package.json` `scripts.dev` if different)

- [ ] **Step 2: Test the motivating example routes to RESEARCH and covers all constraints**

In the running app, send: "what are the best 10 llms right now under $20/month, make sure to include Claude, write it as a comparison table"

Verify:
- Server logs show `Starting adaptive deep research for:` (confirms RESEARCH was selected, not WEB_SEARCH)
- Server logs show `Deep research plan:` with 2-3 queries, `mustInclude` containing something like "Claude", and `constraints` mentioning price/table
- The final answer is a table, respects the price constraint, and mentions Claude

- [ ] **Step 3: Test a plain comparison stays on WEB_SEARCH**

Send: "compare gpt-5 and gemini 3 pro"

Verify: server logs do NOT show `Starting adaptive deep research for:` — confirms it stayed on WEB_SEARCH per the classifier rule from Task 4.

- [ ] **Step 4: Test a single-facet product question degrades gracefully**

Send a query that should reach RESEARCH but only has one facet, e.g.: "research the history and current state of quantum computing, covering hardware approaches, error correction, and near-term commercial applications"

Verify: server logs show `Deep research plan:` with 1-3 queries and the final answer is coherent (no crash, no empty response).

- [ ] **Step 5: Confirm Exa search results now include content**

Check server logs or a direct WEB_SEARCH/RESEARCH query that uses Exa as its provider — confirm the search result text passed downstream is non-empty (was empty before Task 1's fix).
