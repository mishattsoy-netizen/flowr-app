# Bot Prompt Improvements — Plan B (Code Changes + Advisor Feature)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the orchestrator final-chain hardcode bug, fix internal prompt mode-awareness, and implement the Advisor pre-flight layer with its toggle.

**Architecture:** Three independent code changes: (1) `getInternalPrompt` gets a `mode` parameter; (2) `chainRouter.ts` reads the orchestrator's planned final chain instead of hardcoding COMPLEX_THINKING; (3) new `advisor.ts` module runs before classification when `advisorEnabled` is true, sends questions to the user, and re-enters the pipeline with bundled context. The UI gets a new Advisor toggle alongside the existing Think toggle.

**Tech Stack:** TypeScript, Next.js, Supabase, React. Existing patterns: `runChain` in `chainRouter.ts`, `getCompiledPrompt` in `compilePrompt.ts`, Think toggle in store and UI for reference.

---

## File Map

**Modified:**
- `src/lib/bot/compilePrompt.ts` — add `mode` param to `getInternalPrompt`
- `src/lib/bot/pipeline.ts` — pass `mode` to `getInternalPrompt`
- `src/lib/bot/chainRouter.ts` — read orchestrator's final chain; add advisor pre-flight gate
- `src/data/store.types.ts` — add `advisorEnabled` to session/context types
- `src/data/store.ts` — add `advisorEnabled` state
- UI toggle component (same file as Think toggle) — add Advisor toggle below Think toggle

**Created:**
- `src/lib/bot/advisor.ts` — advisor pre-flight logic

---

### Task 1: Fix getInternalPrompt to use active mode for restrictions

Currently `getInternalPrompt()` in `compilePrompt.ts` always loads restrictions with `mode: 'default'`. This means Pro and Think mode users get Default mode restrictions injected into pipeline steps.

**Files:**
- Modify: `src/lib/bot/compilePrompt.ts`
- Modify: `src/lib/bot/pipeline.ts`

- [ ] **Step 1: Add mode parameter to getInternalPrompt signature**

In `src/lib/bot/compilePrompt.ts`, find:
```typescript
export async function getInternalPrompt(chainType: string): Promise<string> {
```
Replace with:
```typescript
export async function getInternalPrompt(chainType: string, mode: BotMode = 'default'): Promise<string> {
```

- [ ] **Step 2: Use mode parameter in the restrictions query**

In `getInternalPrompt`, find:
```typescript
  const restrictionsResult = await supabase
    .from('bot_settings')
    .select('content')
    .eq('category', 'restrictions')
    .eq('mode', 'default')
    .maybeSingle()
```
Replace with:
```typescript
  const restrictionsResult = await supabase
    .from('bot_settings')
    .select('content')
    .eq('category', 'restrictions')
    .eq('mode', mode)
    .maybeSingle()
```

- [ ] **Step 3: Pass mode from pipeline.ts to getInternalPrompt**

In `src/lib/bot/pipeline.ts`, find:
```typescript
    const internalPrompt = await getInternalPrompt(chainType)
```
Replace with:
```typescript
    const internalPrompt = await getInternalPrompt(chainType, context?.mode ?? 'default')
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/bot/compilePrompt.ts src/lib/bot/pipeline.ts
git commit -m "fix: pass active mode to getInternalPrompt for correct restrictions"
```

---

### Task 2: Fix chainRouter to respect orchestrator's final output chain

Currently `chainRouter.ts` always uses `COMPLEX_THINKING` as the final output chain after pipeline execution, ignoring what the orchestrator planned. The orchestrator plans a final text chain (FAST_SIMPLE, MEDIUM_THINKING, or COMPLEX_THINKING) that should be respected.

**Files:**
- Modify: `src/lib/bot/chainRouter.ts`

- [ ] **Step 1: Extract final chain from orchestrator plan before pipeline runs**

In `chainRouter.ts`, find the MULTI_CHAIN block. After `executePipeline` is called and `pipelineResult` is returned, find:
```typescript
      // Final output chain — COMPLEX_THINKING for orchestrated requests
      let { chain: finalChain, system_prompt: finalSysPrompt } = await getRouterChain('COMPLEX_THINKING')
```
Replace with:
```typescript
      // Use orchestrator's planned final output chain (last step), fallback to COMPLEX_THINKING
      const TEXT_CHAINS: IntentCategory[] = ['FAST_SIMPLE', 'MEDIUM_THINKING', 'COMPLEX_THINKING']
      const plannedFinalChain = plan.steps.length > 0
        ? plan.steps[plan.steps.length - 1]
        : 'COMPLEX_THINKING'
      const finalChainType: IntentCategory = TEXT_CHAINS.includes(plannedFinalChain)
        ? plannedFinalChain
        : 'COMPLEX_THINKING'

      let { chain: finalChain, system_prompt: finalSysPrompt } = await getRouterChain(finalChainType)
```

- [ ] **Step 2: Update model_chain label to reflect actual chain used**

In the same MULTI_CHAIN block, find:
```typescript
              model_chain: `orchestrator → ${allSteps.map(s => s.chain).join(' → ')}`,
```
This already uses `allSteps` so it will naturally reflect the correct chain. No change needed here.

- [ ] **Step 3: Commit**

```bash
git add src/lib/bot/chainRouter.ts
git commit -m "fix: respect orchestrator's planned final output chain instead of hardcoding COMPLEX_THINKING"
```

---

### Task 3: Create advisor.ts module

**Files:**
- Create: `src/lib/bot/advisor.ts`

- [ ] **Step 1: Create the file**

Create `src/lib/bot/advisor.ts` with this content:

```typescript
import { logger } from '../logger'
import { getRouterChain } from '../router-config'
import { getProviderKeys } from '../vault'
import type { BotMode } from '@/data/store.types'

export interface AdvisorResult {
  shouldAsk: boolean
  questions: string | null
}

const PASS_SIGNAL = 'PASS'

function buildAdvisorPrompt(
  message: string,
  mode: BotMode,
  thinkingEnabled: boolean,
  availableTools: string[]
): string {
  const sessionState = [
    `Mode: ${mode}`,
    `Think mode: ${thinkingEnabled ? 'on' : 'off'}`,
    `Advisor: on`,
    `Available tools: ${availableTools.length > 0 ? availableTools.join(', ') : 'none'}`,
  ].join('\n')

  return `[CURRENT SESSION STATE]\n${sessionState}\n\n[USER MESSAGE]\n${message}`
}

export async function runAdvisor(
  message: string,
  mode: BotMode,
  thinkingEnabled: boolean,
  availableTools: string[],
  context: any
): Promise<AdvisorResult> {
  const { chain, system_prompt } = await getRouterChain('ADVISOR' as any)

  if (chain.length === 0) {
    logger.warn('ADVISOR chain is empty — skipping advisor step. Add models via Admin > Router > ADVISOR.')
    return { shouldAsk: false, questions: null }
  }

  const systemPrompt = system_prompt || ''
  if (!systemPrompt) {
    logger.warn('ADVISOR chain has no system_prompt configured — skipping advisor step.')
    return { shouldAsk: false, questions: null }
  }

  const advisorPrompt = buildAdvisorPrompt(message, mode, thinkingEnabled, availableTools)

  for (const modelConfig of chain) {
    if (!modelConfig.is_enabled) continue
    try {
      const provider = modelConfig.provider.toLowerCase()
      let response: string | null = null

      if (provider === 'google') {
        const { runGoogle } = await import('./providers/google')
        response = await runGoogle(modelConfig.id, advisorPrompt, systemPrompt, undefined, context, [])
      } else if (provider === 'groq') {
        const { runGroq } = await import('./providers/groq')
        response = await runGroq(modelConfig.id, advisorPrompt, systemPrompt, undefined, context, [])
      } else if (provider === 'openrouter') {
        const { runOpenRouter } = await import('./providers/openrouter')
        const keys = await getProviderKeys('OPENROUTER')
        response = await runOpenRouter(modelConfig.id, advisorPrompt, systemPrompt, [], keys[0] || '')
      }

      if (response) {
        const trimmed = response.trim()
        if (trimmed.toUpperCase() === PASS_SIGNAL) {
          return { shouldAsk: false, questions: null }
        }
        // Non-PASS response = questions to ask
        return { shouldAsk: true, questions: trimmed }
      }
    } catch (e: any) {
      logger.warn(`Advisor model ${modelConfig.id} failed: ${e.message}`)
    }
  }

  // All models failed — fail open (skip advisor, don't block user)
  logger.warn('Advisor: all models failed — passing through silently')
  return { shouldAsk: false, questions: null }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/bot/advisor.ts
git commit -m "feat: add advisor pre-flight module"
```

---

### Task 4: Wire advisor into chainRouter.ts

The advisor runs before classification. If it returns questions, `runChain` returns them as a special response type. The caller (API route / Telegram handler) is responsible for sending the questions to the user, collecting the answer, and calling `runChain` again with the bundled context.

**Files:**
- Modify: `src/lib/bot/chainRouter.ts`

- [ ] **Step 1: Import runAdvisor**

At the top of `chainRouter.ts`, add:
```typescript
import { runAdvisor } from './advisor'
```

- [ ] **Step 2: Add advisorEnabled to ChainResponse**

Find the `ChainResponse` interface and add:
```typescript
  advisor_questions?: string
```
So it reads:
```typescript
export interface ChainResponse {
  type: 'text' | 'photo'
  content: string | Buffer
  usage_type?: 'chat' | 'tool' | 'search' | 'vision' | 'image'
  model?: string
  model_chain?: string
  status?: 'success' | 'error'
  classification_trace?: any[]
  routing_trace?: RoutingTrace[]
  citations?: string[]
  tokens_used?: number
  pipeline_steps?: PipelineStep[]
  advisor_questions?: string
}
```

- [ ] **Step 3: Add advisor pre-flight gate at the top of runChain**

In `runChain`, after history is loaded and before the Vision flow check (before `// 1. Specialized Vision Flow`), add:

```typescript
  // Advisor pre-flight — runs before classification if enabled and no image attached
  if (context?.advisorEnabled && !inputBuffer) {
    const availableTools = ['web_search', 'deep_research', 'image_gen', 'tool_calling']
    const advisorResult = await runAdvisor(
      prompt,
      context?.mode ?? 'default',
      context?.thinkingEnabled ?? false,
      availableTools,
      context
    )
    if (advisorResult.shouldAsk && advisorResult.questions) {
      return {
        type: 'text',
        content: advisorResult.questions,
        usage_type: 'chat',
        model_chain: 'advisor → (awaiting user response)',
        status: 'success',
        advisor_questions: advisorResult.questions,
      }
    }
  }
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/bot/chainRouter.ts
git commit -m "feat: wire advisor pre-flight gate into runChain"
```

---

### Task 5: Handle advisor response in the API route

When `runChain` returns a response with `advisor_questions` set, the API route must mark it so the frontend knows this is a clarification request, not a final answer. When the user replies, the original message + Q&A must be bundled and re-submitted with `advisorEnabled: false` to prevent an infinite advisor loop.

**Files:**
- Modify: `src/app/api/ai/chat/route.ts`

- [ ] **Step 1: Read the current chat route to understand its response shape**

Read `src/app/api/ai/chat/route.ts` and identify:
- Where `runChain` is called
- How the response is returned to the frontend
- Where `thinkingEnabled` is read from the request context (to follow the same pattern for `advisorEnabled`)

- [ ] **Step 2: Pass advisorEnabled from request to runChain context**

Find where the `runChain` context object is constructed (look for where `thinkingEnabled` is passed). Add `advisorEnabled` alongside it, reading it from the request body the same way `thinkingEnabled` is read.

The context object should include:
```typescript
advisorEnabled: body.advisorEnabled ?? false,
```

- [ ] **Step 3: Pass advisor_questions flag in API response**

Find where the `runChain` result is serialized into the API response. Add `advisor_questions` to the response payload:
```typescript
advisor_questions: result.advisor_questions,
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/ai/chat/route.ts
git commit -m "feat: pass advisorEnabled to runChain and expose advisor_questions in API response"
```

---

### Task 6: Add advisorEnabled to store

Follow the exact same pattern as `thinkingEnabled` in `src/data/store.ts` and `src/data/store.types.ts`.

**Files:**
- Modify: `src/data/store.types.ts`
- Modify: `src/data/store.ts`

- [ ] **Step 1: Read store.types.ts and store.ts**

Read both files to understand how `thinkingEnabled` is typed and stored.

- [ ] **Step 2: Add advisorEnabled to store types**

In `src/data/store.types.ts`, find where `thinkingEnabled` is declared and add `advisorEnabled` next to it with the same type (`boolean`).

- [ ] **Step 3: Add advisorEnabled to store state and actions**

In `src/data/store.ts`, follow the exact pattern of `thinkingEnabled`:
- Add `advisorEnabled: false` as default state
- Add a `setAdvisorEnabled` action (or equivalent toggle action matching the existing pattern)

- [ ] **Step 4: Commit**

```bash
git add src/data/store.types.ts src/data/store.ts
git commit -m "feat: add advisorEnabled to store"
```

---

### Task 7: Add Advisor toggle to UI

The Advisor toggle lives below the Think toggle. Follow the exact same component pattern as the Think toggle.

**Files:**
- Modify: the component file that contains the Think toggle (check `src/components/` — find by searching for `thinkingEnabled` usage in UI components)

- [ ] **Step 1: Find the Think toggle component**

```bash
grep -r "thinkingEnabled" src/components --include="*.tsx" -l
```

- [ ] **Step 2: Read that component file**

Read the file to understand the Think toggle's markup, state binding, and label structure.

- [ ] **Step 3: Add Advisor toggle directly below Think toggle**

Copy the Think toggle's JSX and change:
- `thinkingEnabled` → `advisorEnabled`
- `setThinkingEnabled` → `setAdvisorEnabled`
- Label: `"Think"` → `"Advisor"`
- Any tooltip/description: `"Extended reasoning scratchpad"` → `"Asks clarifying questions before answering"`

- [ ] **Step 4: Commit**

```bash
git add src/components/**
git commit -m "feat: add Advisor toggle to UI below Think toggle"
```

---

### Task 8: Add ADVISOR chain to router config

The advisor needs a chain entry in the router admin (same as ORCHESTRATOR and THINKING chains). This is a database-level configuration, not a code change. Document the required setup.

**Files:**
- No code change — admin configuration

- [ ] **Step 1: Add ADVISOR chain entry via Admin UI**

In Admin > Router, add a new chain:
- Chain name: `ADVISOR`
- System prompt: paste content from `pipeline-advisor.txt`
- Add at least one fast, cheap model (e.g. a Groq model or fast Gemini model — the advisor should be lightweight)
- Enable the chain

- [ ] **Step 2: Verify advisor chain is reachable**

Send a test message through the UI with Advisor toggle ON. Check server logs for:
```
ADVISOR chain is empty
```
If this appears, the chain was not saved correctly. Retry step 1.

If no such error appears and the bot either asks a question or answers directly, the chain is wired correctly.

- [ ] **Step 3: Commit documentation note**

```bash
git commit --allow-empty -m "docs: ADVISOR chain must be configured in Admin > Router with pipeline-advisor.txt as system prompt"
```

---

### Task 9: End-to-end smoke test

- [ ] **Step 1: Test advisor OFF — normal flow unchanged**

With Advisor toggle OFF, send: `"write me a short story"`
Expected: bot answers directly with no clarifying questions. No advisor log entries.

- [ ] **Step 2: Test advisor ON, PASS case**

With Advisor toggle ON, send: `"what is the capital of France?"`
Expected: bot answers directly (advisor returned PASS silently). No clarifying questions shown.

- [ ] **Step 3: Test advisor ON, questions case**

With Advisor toggle ON, send: `"write me an essay"`
Expected: bot asks 1-3 clarifying questions (topic? length? style?). Response has `advisor_questions` set.

- [ ] **Step 4: Test advisor ON, full round-trip**

After step 3, answer the questions. E.g.: `"about climate change, 500 words, college level"`
Expected: bot produces the essay using both the original message and the answers as context.

- [ ] **Step 5: Test orchestrator final chain fix**

With Advisor OFF, send a message that should trigger MULTI_CHAIN with a simple final answer. Check `model_chain` in the response — it should show the orchestrator's planned final chain (e.g. `FAST_SIMPLE` or `MEDIUM_THINKING`), not always `COMPLEX_THINKING`.

- [ ] **Step 6: Final commit**

```bash
git add .
git commit -m "feat: complete Plan B — advisor pre-flight, orchestrator chain fix, mode-aware internal prompts"
```
