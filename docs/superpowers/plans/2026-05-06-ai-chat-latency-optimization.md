# AI Chat Latency Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce AI chatbot response latency by 300–900ms by parallelizing sequential DB reads and eliminating redundant round-trips across 5 files.

**Architecture:** Group all DB reads that don't depend on each other into `Promise.all` batches. Remove the intent-tag Gemini consistency check entirely. Prefetch vault keys before the model loop. No changes to response format, admin settings, or model behavior.

**Tech Stack:** TypeScript, Next.js App Router, Supabase (supabaseAdmin), Vercel deployment.

---

## File Map

| File | What changes |
|------|-------------|
| `src/lib/router-config.ts` | Parallelize chain + temperatures queries inside `getRouterChain` |
| `src/lib/bot/classifier.ts` | Parallelize 3 classifier config queries; remove `checkTagConsistency` and its Gemini call |
| `src/lib/bot/context.ts` | Parallelize `getCompactionConfig` + `bot_session_states` query inside `getSessionState` |
| `src/lib/bot/chainRouter.ts` | Move `getFallbackModes` to upfront batch; prefetch vault keys before model loop; remove second `getCompactionConfig` call; pass compaction config through |
| `src/app/api/ai/chat/route.ts` | Parallelize `getCompiledPrompt` + `getWebConversationMemory` in Ollama branch |

---

## Task 1: Parallelize temperatures in `getRouterChain`

**Files:**
- Modify: `src/lib/router-config.ts`

### Context

`getRouterChain` currently fetches the chain row, then calls `getRouterTemperatures()` as a second sequential query. We fire both at once.

- [ ] **Step 1: Open `src/lib/router-config.ts` and replace `getRouterChain`**

Replace the entire `getRouterChain` function (lines 35–58) with:

```typescript
export async function getRouterChain(
  category: IntentCategory
): Promise<{ chain: RouterModel[], system_prompt?: string; temperature?: number }> {
  const [chainResult, tempsResult] = await Promise.all([
    supabase
      .from('router_chains')
      .select('model_list, system_prompt')
      .eq('category', category)
      .eq('platform', 'telegram')
      .maybeSingle(),
    supabase
      .from('settings')
      .select('value')
      .eq('key', 'router_temperatures')
      .maybeSingle()
  ])

  if (chainResult.error || !chainResult.data) {
    console.warn(`No router chain found for category: ${category}, platform: telegram.`)
    return { chain: [] }
  }

  const temps = (tempsResult.data?.value as Record<string, number>) ?? {}
  const customTemp = typeof temps[category] === 'number' ? temps[category] : 0.7

  return {
    chain: (chainResult.data.model_list as RouterModel[]).filter(m => m.is_enabled),
    system_prompt: (chainResult.data as any).system_prompt || undefined,
    temperature: customTemp
  }
}
```

- [ ] **Step 2: Delete `getRouterTemperatures` function**

Remove the entire `getRouterTemperatures` function (lines 24–33) since it's now inlined. Also remove it from any exports if exported — check with:

```bash
grep -r "getRouterTemperatures" src/
```

If no other files import it, delete it. If other files import it, keep the function but have it call the new parallel version internally (unlikely — it's only used inside `getRouterChain`).

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd "c:/Users/misha/Documents/Vibe Coding/flowr-4-main" && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors related to `router-config.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/router-config.ts
git commit -m "perf: parallelize router chain + temperatures queries"
```

---

## Task 2: Parallelize `getSessionState` internals

**Files:**
- Modify: `src/lib/bot/context.ts`

### Context

`getSessionState` calls `getCompactionConfig()` (1 DB query), waits for it, then queries `bot_session_states` (1 DB query). We fire both at once.

- [ ] **Step 1: Replace `getSessionState` in `src/lib/bot/context.ts`**

Replace the entire `getSessionState` function (lines 21–45) with:

```typescript
export async function getSessionState(chatId: string): Promise<SessionState | null> {
  const [config, sessionResult] = await Promise.all([
    getCompactionConfig(),
    supabase
      .from('bot_session_states')
      .select('*')
      .eq('chat_id', chatId)
      .maybeSingle()
  ])

  if (sessionResult.error) {
    logger.error(`Failed to fetch session state for ${chatId}:`, sessionResult.error)
    return null
  }

  if (!sessionResult.data) {
    return {
      chat_id: chatId,
      distilled_summary: null,
      token_usage_total: 0,
      context_limit: config.context_limit,
      compaction_threshold: config.compaction_threshold,
      last_summarized_at: new Date(0).toISOString()
    }
  }

  return { ...sessionResult.data, context_limit: config.context_limit, compaction_threshold: config.compaction_threshold }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "c:/Users/misha/Documents/Vibe Coding/flowr-4-main" && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors related to `context.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/bot/context.ts
git commit -m "perf: parallelize compaction config + session state queries"
```

---

## Task 3: Parallelize classifier config + remove tag consistency check

**Files:**
- Modify: `src/lib/bot/classifier.ts`

### Context

Two changes in one file:
1. The 3 sequential `bot_settings` queries become one `Promise.all`.
2. `checkTagConsistency` (a full Gemini call) and its usage are removed. Tags are now trusted directly.

- [ ] **Step 1: Remove `checkTagConsistency` function**

Delete the entire function from `src/lib/bot/classifier.ts` (lines 41–55):

```typescript
// DELETE THIS ENTIRE FUNCTION:
const TAG_CONSISTENCY_PROMPT = (tag: string, message: string) => `...`

async function checkTagConsistency(tag: string, message: string, modelId: string): Promise<boolean> {
  try {
    const result = await runGoogle(modelId, TAG_CONSISTENCY_PROMPT(tag, message), undefined)
    if (!result) return true
    return result.toUpperCase().includes('YES')
  } catch {
    return true
  }
}
```

- [ ] **Step 2: Simplify the intent tag block**

Find this block in `classifyIntentWithModel` (lines 82–94):

```typescript
if (intentTag && TAG_CATEGORY_MAP[intentTag]) {
  const { chain } = await getRouterChain('CLASSIFIER')
  const checkModel = modelId || chain.find(m => m.is_enabled)?.id || 'gemini-2.0-flash'
  const isConsistent = await checkTagConsistency(intentTag, message, checkModel)
  if (isConsistent) {
    if (intentTag === '/research' && detectMapsIntent(lowerMsg)) {
      return { category: 'WEB_SEARCH', classifierModel: 'maps-override', trace: [] }
    }
    return { category: TAG_CATEGORY_MAP[intentTag], classifierModel: 'tag', trace: [] }
  }
  // Tag ignored — fall through to normal classification
}
```

Replace it with:

```typescript
if (intentTag && TAG_CATEGORY_MAP[intentTag]) {
  if (intentTag === '/research' && detectMapsIntent(lowerMsg)) {
    return { category: 'WEB_SEARCH', classifierModel: 'maps-override', trace: [] }
  }
  return { category: TAG_CATEGORY_MAP[intentTag], classifierModel: 'tag', trace: [] }
}
```

- [ ] **Step 3: Parallelize the 3 classifier config queries**

Find this block (lines 101–130):

```typescript
try {
  const { data: keywordsEnabledBlock } = await supabaseAdmin
    .from('bot_settings')
    .select('is_active')
    .eq('category', 'classifier_keywords_enabled')
    .eq('mode', 'default')
    .maybeSingle()

  if (keywordsEnabledBlock) keywordsEnabled = keywordsEnabledBlock.is_active

  const { data: promptBlock } = await supabaseAdmin
    .from('bot_settings')
    .select('content')
    .eq('category', 'classifier_prompt')
    .eq('mode', mode)
    .maybeSingle()

  if (promptBlock?.content) activePrompt = promptBlock.content

  const { data: keywordsBlock } = await supabaseAdmin
    .from('bot_settings')
    .select('content')
    .eq('category', 'classifier_keywords')
    .eq('mode', mode)
    .maybeSingle()

  if (keywordsBlock?.content) {
    try { keywordsObj = JSON.parse(keywordsBlock.content) } catch {}
  }
} catch (err) {
  logger.warn(`Could not load classifier config [${mode}]: ${(err as Error).message}`)
}
```

Replace with:

```typescript
try {
  const [keywordsEnabledResult, promptResult, keywordsResult] = await Promise.all([
    supabaseAdmin
      .from('bot_settings')
      .select('is_active')
      .eq('category', 'classifier_keywords_enabled')
      .eq('mode', 'default')
      .maybeSingle(),
    supabaseAdmin
      .from('bot_settings')
      .select('content')
      .eq('category', 'classifier_prompt')
      .eq('mode', mode)
      .maybeSingle(),
    supabaseAdmin
      .from('bot_settings')
      .select('content')
      .eq('category', 'classifier_keywords')
      .eq('mode', mode)
      .maybeSingle(),
  ])

  if (keywordsEnabledResult.data) keywordsEnabled = keywordsEnabledResult.data.is_active
  if (promptResult.data?.content) activePrompt = promptResult.data.content
  if (keywordsResult.data?.content) {
    try { keywordsObj = JSON.parse(keywordsResult.data.content) } catch {}
  }
} catch (err) {
  logger.warn(`Could not load classifier config [${mode}]: ${(err as Error).message}`)
}
```

- [ ] **Step 4: Check if `runGoogle` import is still needed in classifier.ts**

```bash
grep -n "runGoogle" src/lib/bot/classifier.ts
```

If `runGoogle` is no longer referenced (only used by `checkTagConsistency`), remove its import line:

```typescript
// DELETE if no other usage:
import { runGoogle } from './providers/google'
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd "c:/Users/misha/Documents/Vibe Coding/flowr-4-main" && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors related to `classifier.ts`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/bot/classifier.ts
git commit -m "perf: parallelize classifier config queries, remove tag consistency Gemini call"
```

---

## Task 4: Parallelize Ollama path in `route.ts`

**Files:**
- Modify: `src/app/api/ai/chat/route.ts`

### Context

In the Ollama streaming branch, `getCompiledPrompt` and `getWebConversationMemory` are called sequentially after `getRouterChain`. Neither depends on the chain result — only the `activeModelConfig` from the chain is needed. We can fetch compiled prompt and memory in parallel with `getRouterChain` after classification.

- [ ] **Step 1: Find the Ollama branch in `route.ts`**

The block starts around line 78 after classification. The current sequential flow is:

```typescript
const { chain, system_prompt, temperature } = await getRouterChain(category)
let activeModelConfig = chain.find(m => m.is_enabled)
// ...
if (isOllama && activeModelConfig) {
  // ...
  const globalPrompt = await getCompiledPrompt()           // sequential
  // ...
  const history = await getWebConversationMemory(userId)   // sequential
```

- [ ] **Step 2: Parallelize `getRouterChain`, `getCompiledPrompt`, and `getWebConversationMemory` in the Ollama branch**

In `route.ts`, find the section after `classifyIntentWithModel` resolves and before the `isOllama` check. Replace:

```typescript
const { chain, system_prompt, temperature } = await getRouterChain(category)
let activeModelConfig = chain.find(m => m.is_enabled)
let isOllama = false

if (buffer) {
  const { chain: visionChain } = await getRouterChain('VISION')
  const visionModel = visionChain.find(m => m.is_enabled)
  if (visionModel && (visionModel.provider.toLowerCase() === 'ollama' || visionModel.provider.toLowerCase() === 'local' || visionModel.provider.toLowerCase() === 'ollama(my pc)')) {
    activeModelConfig = visionModel
    isOllama = true
  }
} else if (activeModelConfig && (activeModelConfig.provider.toLowerCase() === 'ollama' || activeModelConfig.provider.toLowerCase() === 'local' || activeModelConfig.provider.toLowerCase() === 'ollama(my pc)')) {
  isOllama = true
}

if (isOllama && activeModelConfig) {
  const now = new Date()
  const dateContext = `[CURRENT CONTEXT]\nDate: ${now.toDateString()}\nTime: ${now.toLocaleTimeString()}\n`
  
  const globalPrompt = await getCompiledPrompt()
  let fullSystemPrompt = system_prompt || ''
  if (globalPrompt) {
    fullSystemPrompt = globalPrompt + '\n\n' + fullSystemPrompt
  }
  fullSystemPrompt = dateContext + "\n\n" + fullSystemPrompt
  fullSystemPrompt = "CRITICAL: Provide ONLY the final answer. NEVER output internal reasoning, analysis, planning, or drafting. Do not use headers like '*Neutrality:*', '*Final version plan:*', or '*Self-Correction:*'. Jump directly to the response.\n" +
                  "When you use a tool or perform a search, always synthesize and summarize the tool results into a natural, complete, and helpful answer to the user's question. Do NOT output raw tool results verbatim.\n\n" + fullSystemPrompt;

  const history = await getWebConversationMemory(userId)
  const stream = await streamOllama(activeModelConfig.id, prompt, fullSystemPrompt, history, temperature)
```

With:

```typescript
const [{ chain, system_prompt, temperature }, globalPromptForOllama, ollamaHistory] = await Promise.all([
  getRouterChain(category),
  getCompiledPrompt(),
  getWebConversationMemory(userId),
])
let activeModelConfig = chain.find(m => m.is_enabled)
let isOllama = false

if (buffer) {
  const { chain: visionChain } = await getRouterChain('VISION')
  const visionModel = visionChain.find(m => m.is_enabled)
  if (visionModel && (visionModel.provider.toLowerCase() === 'ollama' || visionModel.provider.toLowerCase() === 'local' || visionModel.provider.toLowerCase() === 'ollama(my pc)')) {
    activeModelConfig = visionModel
    isOllama = true
  }
} else if (activeModelConfig && (activeModelConfig.provider.toLowerCase() === 'ollama' || activeModelConfig.provider.toLowerCase() === 'local' || activeModelConfig.provider.toLowerCase() === 'ollama(my pc)')) {
  isOllama = true
}

if (isOllama && activeModelConfig) {
  const now = new Date()
  const dateContext = `[CURRENT CONTEXT]\nDate: ${now.toDateString()}\nTime: ${now.toLocaleTimeString()}\n`
  
  let fullSystemPrompt = system_prompt || ''
  if (globalPromptForOllama) {
    fullSystemPrompt = globalPromptForOllama + '\n\n' + fullSystemPrompt
  }
  fullSystemPrompt = dateContext + "\n\n" + fullSystemPrompt
  fullSystemPrompt = "CRITICAL: Provide ONLY the final answer. NEVER output internal reasoning, analysis, planning, or drafting. Do not use headers like '*Neutrality:*', '*Final version plan:*', or '*Self-Correction:*'. Jump directly to the response.\n" +
                  "When you use a tool or perform a search, always synthesize and summarize the tool results into a natural, complete, and helpful answer to the user's question. Do NOT output raw tool results verbatim.\n\n" + fullSystemPrompt;

  const stream = await streamOllama(activeModelConfig.id, prompt, fullSystemPrompt, ollamaHistory, temperature)
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd "c:/Users/misha/Documents/Vibe Coding/flowr-4-main" && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors related to `route.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/ai/chat/route.ts
git commit -m "perf: parallelize getRouterChain + getCompiledPrompt + memory in Ollama path"
```

---

## Task 5: Move `getFallbackModes` upfront + prefetch vault keys in `chainRouter.ts`

**Files:**
- Modify: `src/lib/bot/chainRouter.ts`

### Context

Two changes in `runChain`:
1. `getFallbackModes()` is currently called after classification (line ~160). Move it into an upfront `Promise.all` with memory, compiled prompt, and session state — it doesn't depend on category.
2. After routing resolves (category + chain known), collect unique provider names and prefetch all vault keys in parallel before the model loop.
3. Remove the second `getCompactionConfig()` call (post-response, line ~265) since `getSessionState` already fetched it.

- [ ] **Step 1: Move `getFallbackModes` to the upfront parallel batch**

At the top of `runChain`, find the upfront fetches. Currently memory is fetched, then classification runs, then `getCompiledPrompt`, `getSessionState`, `getFallbackModes` are scattered. 

Replace the existing upfront section (after history fetch, before classification) with a parallel batch. Find this code after the history fetch:

```typescript
// 0. Fetch Session Context (Long-term Memory)
const sessionId = context?.chatId?.toString() || context?.activeEntityId || 'global'
const sessionState = await getSessionState(sessionId)
const currentSummary = sessionState?.distilled_summary || null
```

And the later sequential calls:

```typescript
const globalPrompt = await getCompiledPrompt(context?.mode ?? 'default')
// ...
const fallbackModes = await getFallbackModes()
const fallbackMode = fallbackModes[category] || 'model_first'
```

Replace by hoisting all three into one `Promise.all` right after the history fetch and before `classifyIntentWithModel`:

```typescript
// 0. Prefetch independent config in parallel
const sessionId = context?.chatId?.toString() || context?.activeEntityId || 'global'
const [sessionState, globalPrompt, fallbackModes] = await Promise.all([
  getSessionState(sessionId),
  getCompiledPrompt(context?.mode ?? 'default'),
  getFallbackModes(),
])
const currentSummary = sessionState?.distilled_summary || null
```

Then delete the two later sequential calls:
- `const globalPrompt = await getCompiledPrompt(context?.mode ?? 'default')` (around line 146)
- `const fallbackModes = await getFallbackModes()` (around line 160)

And update the fallback mode resolution (was line 161, now immediately after the batch):

The line `const fallbackMode = fallbackModes[category] || 'model_first'` stays where it is (after classification sets `category`) — just remove the `await getFallbackModes()` call above it since `fallbackModes` is already defined.

- [ ] **Step 2: Prefetch vault keys before the model loop**

Find the model loop in `runChain` which starts around:

```typescript
for (const modelConfig of chain) {
  if (!modelConfig.is_enabled) continue
  let key = modelConfig.provider === 'google' ? 'GEMINI' : modelConfig.provider.toUpperCase()
  if (modelConfig.id.includes('tavily')) key = 'TAVILY'
  let providerKeys: string[] = []
  providerKeys = await getProviderKeys(key)
```

Before the loop, add a prefetch block:

```typescript
// Prefetch vault keys for all unique providers in this chain
const uniqueProviderKeys = [...new Set(
  chain
    .filter(m => m.is_enabled)
    .map(m => {
      if (m.id.includes('tavily')) return 'TAVILY'
      return m.provider === 'google' ? 'GEMINI' : m.provider.toUpperCase()
    })
)]
const prefetchedKeys = Object.fromEntries(
  await Promise.all(
    uniqueProviderKeys.map(async k => [k, await getProviderKeys(k)] as [string, string[]])
  )
)
```

Then inside the loop, replace:

```typescript
providerKeys = await getProviderKeys(key)
```

With:

```typescript
providerKeys = prefetchedKeys[key] ?? []
```

- [ ] **Step 3: Remove the second `getCompactionConfig` call (post-response)**

Find around line 265 after the model returns a successful response:

```typescript
const config = await getCompactionConfig()
const newTokens = estimateTokens(prompt + finalContent + (system_prompt || ''))
const totalUsage = (sessionState?.token_usage_total || 0) + newTokens
const limit = config.context_limit
const threshold = config.compaction_threshold
```

Replace with (using `sessionState` which already has `context_limit` and `compaction_threshold` from Task 2):

```typescript
const newTokens = estimateTokens(prompt + finalContent + (system_prompt || ''))
const totalUsage = (sessionState?.token_usage_total || 0) + newTokens
const limit = sessionState?.context_limit ?? 32000
const threshold = sessionState?.compaction_threshold ?? 0.8
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd "c:/Users/misha/Documents/Vibe Coding/flowr-4-main" && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors related to `chainRouter.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/bot/chainRouter.ts
git commit -m "perf: hoist getFallbackModes to parallel batch, prefetch vault keys, remove duplicate getCompactionConfig"
```

---

## Task 6: Final verification

- [ ] **Step 1: Full TypeScript check across all changed files**

```bash
cd "c:/Users/misha/Documents/Vibe Coding/flowr-4-main" && npx tsc --noEmit 2>&1
```

Expected: zero errors.

- [ ] **Step 2: Verify no leftover references to removed code**

```bash
grep -rn "checkTagConsistency\|TAG_CONSISTENCY_PROMPT\|getRouterTemperatures" src/
```

Expected: no matches.

- [ ] **Step 3: Verify `getCompactionConfig` is only called in the right places**

```bash
grep -rn "getCompactionConfig" src/
```

Expected: called only in `context.ts` (inside `getSessionState`) and `compaction.ts` (inside `compactSession`). Should NOT appear in `chainRouter.ts` anymore.

- [ ] **Step 4: Verify `getProviderKeys` is not called inside any loop**

```bash
grep -n "getProviderKeys" src/lib/bot/chainRouter.ts
```

Expected: appears once in the prefetch block before the loop, not inside the `for` loop body.

- [ ] **Step 5: Start dev server and do a manual smoke test**

```bash
cd "c:/Users/misha/Documents/Vibe Coding/flowr-4-main" && npm run dev
```

Open the chat UI and send:
1. A plain message (e.g. "hello") — verify normal response
2. A message with `/search` tag active — verify it routes to search
3. A message with `/image` tag active — verify it routes to image gen
4. An image upload — verify vision response

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "perf: all latency optimizations complete — parallel DB reads, vault prefetch, remove tag consistency check"
```
