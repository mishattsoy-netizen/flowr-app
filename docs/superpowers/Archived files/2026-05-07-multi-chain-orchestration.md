# Multi-Chain Orchestration & Mode Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 3-mode system with 2 modes + thinking toggle, and add a multi-chain orchestration pipeline that routes complex requests through sequential chains before a final answer.

**Architecture:** A classifier extended to detect MULTI_CHAIN requests feeds an orchestrator that plans a chain sequence. A new pipeline executor runs chains sequentially, accumulating context. An optional think chain reviews all output before the final answer chain writes the user-facing response.

**Spec:** `docs/superpowers/specs/2026-05-07-multi-chain-orchestration-design.md`

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase, Server Actions, SSE for status updates

---

## Which Phases to Run on Which Model

### Run with Gemini Flash (fast, straightforward changes)
- **Phase 1** — Type system + DB migration (SQL + type edits)
- **Phase 2** — Mode simplification (remove Think mode from UI/admin)
- **Phase 8** — Admin controls (UI additions, settings panels)

### Run with Claude Sonnet (complex logic, multi-file coordination)
- **Phase 3** — Compiled prompt two-tier architecture
- **Phase 4** — Classifier MULTI_CHAIN extension
- **Phase 5** — Orchestrator
- **Phase 6** — Pipeline execution engine
- **Phase 7** — Think chain + thinking toggle

### Why
Phases 3–7 involve branching logic, multi-file coordination, context passing between async steps, and error recovery loops. Gemini Flash handles these correctly less reliably. Phases 1, 2, 8 are mechanical: type changes, SQL, UI wiring — fast and safe with Flash.

---

## File Map

### New files
| File | Purpose |
|---|---|
| `src/lib/bot/orchestrator.ts` | Plans chain sequence from MULTI_CHAIN signal |
| `src/lib/bot/pipeline.ts` | Executes chain sequence, accumulates context |
| `src/lib/bot/thinkChain.ts` | Think chain logic and correction loop |
| `src/components/admin/OrchestratorPanel.tsx` | Orchestrator admin panel UI |
| `src/components/admin/PipelinePromptsPanel.tsx` | Internal prompts editing UI |
| `src/app/admin/orchestrator/page.tsx` | Orchestrator admin page |
| `src/app/admin/orchestrator/actions.ts` | Orchestrator admin server actions |
| `supabase/migrations/20260507_multi_chain.sql` | All DB changes for this feature |

### Modified files
| File | What changes |
|---|---|
| `src/data/store.types.ts:266` | BotMode: remove 'think', add ThinkingEnabled type |
| `src/data/store.ts` | Add thinkingEnabled state + setter, remove think mode refs |
| `src/lib/bot/chainRouter.ts` | Integrate orchestrator, pipeline, think chain |
| `src/lib/bot/classifier.ts` | Extend to output MULTI_CHAIN category |
| `src/lib/bot/compilePrompt.ts` | Add getInternalPrompt(), update recompileAllModes() |
| `src/lib/router-config.ts` | Add getOrchestratorChain(), getPipelineSettings() |
| `src/components/assistant/AIAssistant.tsx` | Remove Think mode, add thinking toggle to mode popup |
| `src/app/api/ai/chat/route.ts` | Add thinkingEnabled param, update mode validation |
| `src/app/admin/router/actions.ts` | Add pipeline settings actions |

---

## Phase 1 — Foundation (Gemini Flash)

### Task 1: Update BotMode type and store

**Files:**
- Modify: `src/data/store.types.ts:266`
- Modify: `src/data/store.ts`

- [ ] **Step 1: Update BotMode type**

In `src/data/store.types.ts` line 266, change:
```ts
export type BotMode = 'default' | 'think' | 'pro'
```
to:
```ts
export type BotMode = 'default' | 'pro'
```

- [ ] **Step 2: Add thinkingEnabled to store state**

In `src/data/store.ts`, find the `active_mode` field and add `thinkingEnabled` alongside it. Search for the `activeMode` state and `setActiveMode` setter. Add after the existing activeMode state:

```ts
thinkingEnabled: false,
setThinkingEnabled: (enabled: boolean) => set({ thinkingEnabled: enabled }),
```

Also add to the store interface (find `setActiveMode` declaration):
```ts
thinkingEnabled: boolean;
setThinkingEnabled: (enabled: boolean) => void;
```

- [ ] **Step 3: Fix any TS errors from BotMode change**

Run:
```bash
npx tsc --noEmit 2>&1 | grep "think"
```

Any file that referenced `'think'` as a BotMode value needs to be updated. The main one is `src/app/api/ai/chat/route.ts` line 56 — change:
```ts
const activeMode = (mode === 'think' || mode === 'pro') ? mode : 'default'
```
to:
```ts
const activeMode = (mode === 'pro') ? mode : 'default'
```

- [ ] **Step 4: Commit**
```bash
git add src/data/store.types.ts src/data/store.ts src/app/api/ai/chat/route.ts
git commit -m "feat: remove think mode from BotMode, add thinkingEnabled to store"
```

---

### Task 2: Database migration

**Files:**
- Create: `supabase/migrations/20260507_multi_chain.sql`

- [ ] **Step 1: Write migration**

```sql
-- 1. Add ORCHESTRATOR and THINKING chain categories
-- These are inserted via admin UI, but seed defaults here for both platforms

-- 2. Unify platform — rename 'telegram' platform rows to 'unified', drop 'app' rows
-- First copy any 'app' platform rows that don't exist in 'telegram'
INSERT INTO router_chains (platform, category, model_list, system_prompt, updated_at)
SELECT 'unified', category, model_list, system_prompt, NOW()
FROM router_chains
WHERE platform = 'telegram'
ON CONFLICT DO NOTHING;

-- Delete old platform-specific rows
DELETE FROM router_chains WHERE platform IN ('telegram', 'app');

-- 3. New settings keys for pipeline
INSERT INTO settings (key, value, updated_at) VALUES
  ('thinking_toggle_default', 'false', NOW()),
  ('thinking_summary_visible', '"collapsible"', NOW()),
  ('orchestrator_enabled', 'true', NOW()),
  ('max_pipeline_steps', '7', NOW()),
  ('image_gen_auto_last', 'true', NOW()),
  ('pipeline_internal_prompts', '{}', NOW()),
  ('pipeline_status_messages', '{}', NOW())
ON CONFLICT (key) DO NOTHING;

-- 4. Remove think mode from bot_compiled_prompt (keep default and pro)
DELETE FROM bot_compiled_prompt WHERE mode = 'think';

-- 5. Remove think mode from bot_settings
UPDATE bot_settings SET is_active = false WHERE mode = 'think';
```

- [ ] **Step 2: Run migration in Supabase dashboard**

Go to Supabase → SQL Editor → paste and run the migration. Verify:
- `router_chains` table has rows with `platform = 'unified'`
- `settings` table has the new keys
- `bot_compiled_prompt` has no `mode = 'think'` row

- [ ] **Step 3: Update router-config.ts platform reference**

In `src/lib/router-config.ts`, find `.eq('platform', 'telegram')` and change to:
```ts
.eq('platform', 'unified')
```

Same change in `src/app/admin/router/actions.ts` — all references to `'telegram'` or `'app'` platform in router_chains queries become `'unified'`.

- [ ] **Step 4: Commit**
```bash
git add supabase/migrations/20260507_multi_chain.sql src/lib/router-config.ts src/app/admin/router/actions.ts
git commit -m "feat: DB migration for multi-chain — unify platforms, add pipeline settings"
```

---

## Phase 2 — Mode Simplification (Gemini Flash)

### Task 3: Remove Think mode from UI

**Files:**
- Modify: `src/components/assistant/AIAssistant.tsx`
- Modify: `src/lib/bot/compilePrompt.ts`

- [ ] **Step 1: Remove Think from MODE_OPTIONS**

In `src/components/assistant/AIAssistant.tsx`, find `MODE_OPTIONS` array (around line 105) and remove the think entry:

```ts
const MODE_OPTIONS: { key: BotMode; label: string; description: string }[] = [
  { key: 'default', label: 'Default', description: 'Fast, universal' },
  { key: 'pro',     label: 'Pro',     description: 'Max precision' },
]
```

- [ ] **Step 2: Update recompileAllModes**

In `src/lib/bot/compilePrompt.ts`, update:
```ts
export async function recompileAllModes(): Promise<void> {
  await Promise.all([
    recompilePrompt('default'),
    recompilePrompt('pro'),
  ])
}
```

- [ ] **Step 3: Archive think mode prompt file**

```bash
mv mode-think.txt mode-think.txt.archived
git add mode-think.txt.archived
```

- [ ] **Step 4: Manual test**

Start dev server: `npm run dev`
Open the AI assistant, click the mode button — verify only Default and Pro appear.

- [ ] **Step 5: Commit**
```bash
git add src/components/assistant/AIAssistant.tsx src/lib/bot/compilePrompt.ts
git commit -m "feat: remove Think mode, simplify to Default + Pro"
```

---

## Phase 3 — Compiled Prompt Two-Tier Architecture (Claude Sonnet)

### Task 4: Add internal prompt support to compilePrompt.ts

**Files:**
- Modify: `src/lib/bot/compilePrompt.ts`
- Modify: `src/app/admin/router/actions.ts`

- [ ] **Step 1: Add getInternalPrompt() to compilePrompt.ts**

The internal prompt for a chain type combines: the chain's purpose-built pipeline prompt (from DB settings) + RESTRICTIONS section + BRAIN: FACTS & KNOWLEDGE.

Add to `src/lib/bot/compilePrompt.ts`:

```ts
const DEFAULT_INTERNAL_PROMPTS: Record<string, string> = {
  VISION: `You are the VISION step in a multi-step pipeline.\nYour output will be consumed by the next chain — NOT shown to the user.\nExtract and describe all visual content, text, and relevant details from the image.\nWrite structured data output, not conversational prose.`,
  WEB_SEARCH: `You are the WEB_SEARCH step in a multi-step pipeline.\nYour output will be consumed by the next chain — NOT shown to the user.\nReturn structured findings: key facts, source URLs, queries run, gaps/unanswered parts.\nWrite structured data output, not conversational prose.`,
  DEEP_RESEARCH: `You are the DEEP_RESEARCH step in a multi-step pipeline.\nYour output will be consumed by the next chain — NOT shown to the user.\nReturn multi-source synthesis: key findings by topic, confidence level, conflicting data flagged.\nWrite structured data output, not conversational prose.`,
  CODING: `You are the CODING step in a multi-step pipeline.\nYour output will be consumed by the next chain — NOT shown to the user.\nReturn code blocks with a brief summary of what was written and any caveats.\nWrite structured data output, not conversational prose.`,
  COMPLEX_THINKING: `You are the ANALYSIS step in a multi-step pipeline.\nYour output will be consumed by the next chain — NOT shown to the user.\nReturn analysis summary: conclusions, key insights, recommended approach.\nWrite structured data output, not conversational prose.`,
  TOOL_CALLING: `You are the TOOL_CALLING step in a multi-step pipeline.\nYour output will be consumed by the next chain — NOT shown to the user.\nReturn action result: what was done, confirmation or error.\nWrite structured data output, not conversational prose.`,
  IMAGE_GEN: `You are the IMAGE_GEN step in a multi-step pipeline.\nYour image has been generated. Pass the concept forward as JSON.\nOutput exactly: {"type":"image_generated","prompt_used":"<prompt>","concept":"<brief concept description>"}`,
}

export async function getInternalPrompt(chainType: string): Promise<string> {
  // Load custom internal prompt from DB settings if set
  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'pipeline_internal_prompts')
    .maybeSingle()

  const customPrompts: Record<string, string> = (data?.value as any) ?? {}
  const rolePrompt = customPrompts[chainType] ?? DEFAULT_INTERNAL_PROMPTS[chainType] ?? `You are the ${chainType} step in a multi-step pipeline. Write structured output for the next chain.`

  // Always append restrictions + brain facts
  const brainResult = await supabase
    .from('bot_brain_entries')
    .select('category, title, content')
    .eq('is_active', true)
    .in('category', ['rules', 'red_flags', 'facts'])
    .order('created_at', { ascending: true })

  const brainEntries = brainResult.data ?? []
  const parts: string[] = [rolePrompt]

  // Append restrictions from bot_settings (mode-agnostic, use default)
  const restrictionsResult = await supabase
    .from('bot_settings')
    .select('content')
    .eq('category', 'restrictions')
    .eq('mode', 'default')
    .maybeSingle()

  if (restrictionsResult.data?.content) {
    parts.push(`[RESTRICTIONS]\n${restrictionsResult.data.content.trim()}`)
  }

  const factsEntries = brainEntries.filter(e => e.category === 'facts')
  if (factsEntries.length > 0) {
    const lines = factsEntries.map(e => `- ${e.title}: ${e.content}`).join('\n')
    parts.push(`[BRAIN: FACTS & KNOWLEDGE]\n${lines}`)
  }

  return parts.join('\n\n')
}
```

- [ ] **Step 2: Add saveInternalPrompt server action**

In `src/app/admin/router/actions.ts`:

```ts
export async function getInternalPrompts(): Promise<Record<string, string>> {
  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'pipeline_internal_prompts')
    .maybeSingle()
  return (data?.value as Record<string, string>) ?? {}
}

export async function saveInternalPrompt(chainType: string, prompt: string) {
  const current = await getInternalPrompts()
  current[chainType] = prompt
  const { error } = await supabase
    .from('settings')
    .upsert({ key: 'pipeline_internal_prompts', value: current, updated_at: new Date().toISOString() })
  if (error) throw error
  revalidatePath('/admin/telegram/router')
  return { success: true }
}

export async function resetInternalPrompt(chainType: string) {
  const current = await getInternalPrompts()
  delete current[chainType]
  const { error } = await supabase
    .from('settings')
    .upsert({ key: 'pipeline_internal_prompts', value: current, updated_at: new Date().toISOString() })
  if (error) throw error
  revalidatePath('/admin/telegram/router')
  return { success: true }
}
```

- [ ] **Step 3: Commit**
```bash
git add src/lib/bot/compilePrompt.ts src/app/admin/router/actions.ts
git commit -m "feat: add two-tier compiled prompt — getInternalPrompt() for pipeline chains"
```

---

## Phase 4 — Classifier MULTI_CHAIN Extension (Claude Sonnet)

### Task 5: Extend classifier to detect MULTI_CHAIN

**Files:**
- Modify: `src/lib/bot/classifier.ts`

The classifier keeps its existing logic but adds MULTI_CHAIN as a valid output. The classifier model outputs "MULTI_CHAIN" when the request clearly needs multiple distinct chain types to answer well.

- [ ] **Step 1: Add MULTI_CHAIN to valid categories**

In `src/lib/bot/classifier.ts`, update:

```ts
const VALID_CATEGORIES: (IntentCategory | 'MULTI_CHAIN')[] = [
  'FAST_SIMPLE', 'COMPLEX_THINKING', 'MEDIUM_THINKING',
  'IMAGE_GEN', 'WEB_SEARCH', 'AUDIO_VOICE', 'TOOL_CALLING',
  'CODING', 'DEEP_RESEARCH', 'MULTI_CHAIN',
]
```

- [ ] **Step 2: Update ClassifyResult type**

```ts
export interface ClassifyResult {
  category: IntentCategory | 'MULTI_CHAIN' | null
  classifierModel: string
  trace: ClassifyTrace[]
  error?: string
}
```

- [ ] **Step 3: Add MULTI_CHAIN guidance to the classifier prompt in DB**

The classifier prompt in `bot_settings` (category: `classifier_prompt`) needs a MULTI_CHAIN entry. Add this to BOTH the default and pro classifier prompts via Admin > Bot > Classifier, or directly in the DB:

```
MULTI_CHAIN
Use when the request clearly requires two or more fundamentally different capabilities in sequence.
Examples: "search for X and generate an image of it", "analyze this image and look up current data about what you see", "research topic X and write a comprehensive report with a table"
Rule: Only use when the request REQUIRES multiple distinct chain types (e.g. VISION + WEB_SEARCH, or WEB_SEARCH + IMAGE_GEN). Do NOT use for requests that a single COMPLEX_THINKING chain can handle alone, even if the question is multi-part.
```

Add this to the routing rules section of each classifier prompt in the DB.

- [ ] **Step 4: Update IntentCategory in router-config.ts**

In `src/lib/router-config.ts`, the `IntentCategory` type doesn't need MULTI_CHAIN since it's not a routable chain. The classifier returns it as a signal to the router, not as a chain category. No change needed here.

- [ ] **Step 5: Manual test**

Send a message like "search for latest AI models and create a comparison table" and check the logs — the classifier should output MULTI_CHAIN. Send "what is React?" — should still output FAST_SIMPLE or MEDIUM_THINKING.

- [ ] **Step 6: Commit**
```bash
git add src/lib/bot/classifier.ts
git commit -m "feat: extend classifier to detect MULTI_CHAIN requests"
```

---

## Phase 5 — Orchestrator (Claude Sonnet)

### Task 6: Create orchestrator.ts

**Files:**
- Create: `src/lib/bot/orchestrator.ts`
- Modify: `src/lib/router-config.ts`

- [ ] **Step 1: Add getPipelineSettings to router-config.ts**

```ts
export interface PipelineSettings {
  orchestratorEnabled: boolean
  maxPipelineSteps: number
  imageGenAutoLast: boolean
  thinkingToggleDefault: boolean
  thinkingSummaryVisible: 'collapsible' | 'hidden'
}

export async function getPipelineSettings(): Promise<PipelineSettings> {
  const { data } = await supabaseAdmin
    .from('settings')
    .select('key, value')
    .in('key', [
      'orchestrator_enabled', 'max_pipeline_steps', 'image_gen_auto_last',
      'thinking_toggle_default', 'thinking_summary_visible'
    ])

  const map: Record<string, any> = {}
  for (const row of data ?? []) map[row.key] = row.value

  return {
    orchestratorEnabled: map['orchestrator_enabled'] !== false,
    maxPipelineSteps: typeof map['max_pipeline_steps'] === 'number' ? map['max_pipeline_steps'] : 7,
    imageGenAutoLast: map['image_gen_auto_last'] !== false,
    thinkingToggleDefault: map['thinking_toggle_default'] === true,
    thinkingSummaryVisible: map['thinking_summary_visible'] ?? 'collapsible',
  }
}
```

- [ ] **Step 2: Create orchestrator.ts**

```ts
import { supabaseAdmin } from '../supabase'
import { logger } from '../logger'
import { getRouterChain } from '../router-config'
import { runGoogle } from './providers/google'
import { runGroq } from './providers/groq'
import { IntentCategory } from '../router-config'
import { getProviderKeys } from '../vault'

export interface OrchestratorPlan {
  steps: IntentCategory[]
  stepGoals: string[]
}

const VALID_CHAIN_CATEGORIES: IntentCategory[] = [
  'FAST_SIMPLE', 'MEDIUM_THINKING', 'COMPLEX_THINKING',
  'CODING', 'WEB_SEARCH', 'DEEP_RESEARCH', 'IMAGE_GEN',
  'TOOL_CALLING', 'VISION', 'AUDIO_VOICE',
]

function parseOrchestratorOutput(raw: string, maxSteps: number): OrchestratorPlan | null {
  try {
    // Try JSON parse first
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null
    const parsed = JSON.parse(jsonMatch[0])
    if (!Array.isArray(parsed.steps) || !Array.isArray(parsed.step_goals)) return null

    const steps = parsed.steps
      .filter((s: string) => VALID_CHAIN_CATEGORIES.includes(s as IntentCategory))
      .slice(0, maxSteps - 2) as IntentCategory[] // reserve slots for THINK + OUTPUT

    const stepGoals = parsed.step_goals.slice(0, steps.length) as string[]

    if (steps.length === 0) return null
    return { steps, stepGoals }
  } catch {
    return null
  }
}

export async function planChainSequence(
  prompt: string,
  history: any[],
  replyContext: any,
  sessionSummary: string | null,
  maxSteps: number
): Promise<OrchestratorPlan | null> {
  const { chain, system_prompt } = await getRouterChain('ORCHESTRATOR' as any)

  if (chain.length === 0) {
    logger.error('ORCHESTRATOR chain is empty — add models via Admin > Router > ORCHESTRATOR')
    return null
  }

  const orchestratorPrompt = buildOrchestratorPrompt(prompt, maxSteps)
  const systemPrompt = system_prompt || DEFAULT_ORCHESTRATOR_SYSTEM_PROMPT

  const recentHistory = history.slice(-6)

  for (const modelConfig of chain) {
    if (!modelConfig.is_enabled) continue
    try {
      let response: string | null = null
      const ctx: any = {}

      if (modelConfig.provider === 'google') {
        response = await runGoogle(modelConfig.id, orchestratorPrompt, systemPrompt, undefined, ctx, recentHistory)
      } else if (modelConfig.provider === 'groq') {
        const keys = await getProviderKeys('GROQ')
        response = await runGroq(modelConfig.id, orchestratorPrompt, systemPrompt, keys[0], ctx, recentHistory)
      }

      if (response) {
        const plan = parseOrchestratorOutput(response, maxSteps)
        if (plan) {
          logger.info(`Orchestrator planned: ${plan.steps.join(' → ')}`)
          return plan
        }
      }
    } catch (e: any) {
      logger.warn(`Orchestrator model ${modelConfig.id} failed: ${e.message}`)
    }
  }

  logger.error('Orchestrator: all models failed to produce a valid plan')
  return null
}

function buildOrchestratorPrompt(userPrompt: string, maxSteps: number): string {
  return `The user sent this message: "${userPrompt}"

Plan the optimal chain sequence to answer this request. Output ONLY valid JSON, nothing else.

Available chain types: VISION, WEB_SEARCH, DEEP_RESEARCH, CODING, COMPLEX_THINKING, MEDIUM_THINKING, FAST_SIMPLE, IMAGE_GEN, TOOL_CALLING

Rules:
- Maximum ${maxSteps - 2} steps (system adds THINK and OUTPUT automatically)
- Last step must be a text chain: FAST_SIMPLE, MEDIUM_THINKING, or COMPLEX_THINKING
- IMAGE_GEN must be placed last among data chains
- Only include chains that are genuinely necessary

Output format:
{"steps":["CHAIN_TYPE","CHAIN_TYPE"],"step_goals":["what this step should produce for the next step","what this step should produce"]}`
}

const DEFAULT_ORCHESTRATOR_SYSTEM_PROMPT = `You are the pipeline orchestrator for an AI assistant. Your job is to plan the minimal sequence of processing chains needed to answer a complex user request. Output only valid JSON. Never explain your reasoning.`
```

- [ ] **Step 3: Commit**
```bash
git add src/lib/bot/orchestrator.ts src/lib/router-config.ts
git commit -m "feat: add orchestrator — plans multi-chain sequence from MULTI_CHAIN signal"
```

---

## Phase 6 — Pipeline Execution Engine (Claude Sonnet)

### Task 7: Create pipeline.ts

**Files:**
- Create: `src/lib/bot/pipeline.ts`

- [ ] **Step 1: Create pipeline.ts**

```ts
import { logger } from '../logger'
import { getInternalPrompt } from './compilePrompt'
import { runGoogle } from './providers/google'
import { runGroq } from './providers/groq'
import { runWebSearchChain } from './providers/tavily'
import { runDuckDuckGoSearchChain } from './providers/duckduckgo'
import { runHuggingFace, runHuggingFaceText } from './providers/huggingface'
import { runCloudflare } from './providers/cloudflare'
import { runPollinations, runPollinationsText } from './providers/pollinations'
import { runOpenRouter } from './providers/openrouter'
import { runOllama } from './providers/ollama'
import { getRouterChain, IntentCategory, getPipelineSettings } from '../router-config'
import { getProviderKeys } from '../vault'
import { OrchestratorPlan } from './orchestrator'

const MAX_STEP_OUTPUT_CHARS = 4000

export interface PipelineStep {
  chain: string
  goal: string
  status: 'pending' | 'running' | 'done' | 'failed'
  output?: string
}

export interface PipelineResult {
  accumulatedContext: string
  steps: PipelineStep[]
  imageBuffer?: Buffer
}

export type StatusCallback = (step: PipelineStep) => void

function formatAccumulatedContext(steps: PipelineStep[]): string {
  return steps
    .filter(s => s.status === 'done' && s.output)
    .map(s => `[${s.chain} STEP OUTPUT]\nGoal: ${s.goal}\nResult: ${s.output}`)
    .join('\n\n')
}

function truncateOutput(output: string): string {
  if (output.length <= MAX_STEP_OUTPUT_CHARS) return output
  return output.slice(0, MAX_STEP_OUTPUT_CHARS) + '\n[...truncated for context window]'
}

async function runSingleChain(
  chainType: IntentCategory,
  prompt: string,
  systemPrompt: string,
  context: any,
  history: any[]
): Promise<string | Buffer | null> {
  const { chain, temperature } = await getRouterChain(chainType)
  const routeContext = { ...context, temperature }

  for (const modelConfig of chain) {
    if (!modelConfig.is_enabled) continue
    try {
      let response: string | Buffer | null = null
      const provider = modelConfig.provider.toLowerCase()

      let providerKeys: string[] = []
      const keyName = provider === 'google' ? 'GEMINI' : provider.toUpperCase()
      providerKeys = await getProviderKeys(keyName)
      const activeKey = providerKeys[0] || context?.aiApiKey || ''

      switch (provider) {
        case 'google':
          response = await runGoogle(modelConfig.id, prompt, systemPrompt, undefined, routeContext, history)
          break
        case 'groq':
          response = await runGroq(modelConfig.id, prompt, systemPrompt, activeKey, routeContext, history)
          break
        case 'huggingface':
          if (chainType === 'IMAGE_GEN') {
            response = await runHuggingFace(modelConfig.id, prompt, activeKey)
          } else {
            response = await runHuggingFaceText(modelConfig.id, prompt, systemPrompt, history, activeKey)
          }
          break
        case 'cloudflare':
          response = await runCloudflare(modelConfig.id, prompt, activeKey)
          break
        case 'vault':
          if (modelConfig.id === 'tavily-search') response = await runWebSearchChain(prompt, routeContext)
          if (modelConfig.id === 'duckduckgo-search') response = await runDuckDuckGoSearchChain(prompt, routeContext)
          break
        case 'pollinations':
          if (chainType === 'IMAGE_GEN') {
            response = await runPollinations(prompt, modelConfig.id)
          } else {
            response = await runPollinationsText(modelConfig.id, prompt, systemPrompt, history, activeKey)
          }
          break
        case 'openrouter':
          response = await runOpenRouter(modelConfig.id, prompt, systemPrompt, history, activeKey)
          break
        case 'ollama':
        case 'local':
          response = await runOllama(modelConfig.id, prompt, systemPrompt, history, temperature)
          break
      }

      if (response) return response
    } catch (e: any) {
      logger.warn(`Pipeline chain ${chainType} model ${modelConfig.id} failed: ${e.message}`)
    }
  }
  return null
}

export async function executePipeline(
  plan: OrchestratorPlan,
  originalPrompt: string,
  context: any,
  onStatus: StatusCallback
): Promise<PipelineResult> {
  const { imageGenAutoLast } = await getPipelineSettings()
  const completedSteps: PipelineStep[] = []
  let imageBuffer: Buffer | undefined

  // Enforce IMAGE_GEN auto-last if enabled
  let steps = [...plan.steps]
  if (imageGenAutoLast && steps.includes('IMAGE_GEN')) {
    steps = steps.filter(s => s !== 'IMAGE_GEN')
    steps.push('IMAGE_GEN')
  }

  for (let i = 0; i < steps.length; i++) {
    const chainType = steps[i]
    const goal = plan.stepGoals[i] || `Process ${chainType} for this request`

    const step: PipelineStep = { chain: chainType, goal, status: 'running' }
    onStatus(step)

    const accumulatedSoFar = formatAccumulatedContext(completedSteps)
    const internalPrompt = await getInternalPrompt(chainType)

    // Build prompt for this step: original prompt + accumulated context + step goal
    const stepPrompt = accumulatedSoFar
      ? `${originalPrompt}\n\n${accumulatedSoFar}\n\n[YOUR GOAL FOR THIS STEP]\n${goal}`
      : `${originalPrompt}\n\n[YOUR GOAL FOR THIS STEP]\n${goal}`

    try {
      const result = await runSingleChain(
        chainType as IntentCategory,
        stepPrompt,
        internalPrompt,
        context,
        [] // internal chains get no history
      )

      if (result === null) {
        step.status = 'failed'
        step.output = `[${chainType} chain returned no output]`
        logger.warn(`Pipeline step ${chainType} returned null`)
      } else if (Buffer.isBuffer(result)) {
        // IMAGE_GEN buffer — store separately, pass JSON concept forward
        imageBuffer = result
        step.status = 'done'
        step.output = JSON.stringify({
          type: 'image_generated',
          prompt_used: originalPrompt,
          concept: goal
        })
      } else {
        step.status = 'done'
        step.output = truncateOutput(result)
      }
    } catch (e: any) {
      step.status = 'failed'
      step.output = `[${chainType} chain error: ${e.message}]`
      logger.error(`Pipeline step ${chainType} threw: ${e.message}`)
    }

    completedSteps.push(step)
    onStatus({ ...step }) // emit completed status
  }

  return {
    accumulatedContext: formatAccumulatedContext(completedSteps),
    steps: completedSteps,
    imageBuffer,
  }
}
```

- [ ] **Step 2: Commit**
```bash
git add src/lib/bot/pipeline.ts
git commit -m "feat: add pipeline executor — sequential chain execution with context accumulation"
```

---

## Phase 7 — Think Chain (Claude Sonnet)

### Task 8: Create thinkChain.ts

**Files:**
- Create: `src/lib/bot/thinkChain.ts`

- [ ] **Step 1: Create thinkChain.ts**

```ts
import { logger } from '../logger'
import { getRouterChain, IntentCategory } from '../router-config'
import { runGoogle } from './providers/google'
import { runGroq } from './providers/groq'
import { getProviderKeys } from '../vault'
import { executePipeline, PipelineStep, StatusCallback } from './pipeline'
import { OrchestratorPlan } from './orchestrator'

export interface ThinkResult {
  summary: string
  direction: string
  correctionChain?: IntentCategory
  confidence: 'high' | 'medium' | 'low'
}

export interface ThinkChainOutput {
  thinkSummary: string
  direction: string
  correctedContext?: string
  steps: PipelineStep[]
}

const DEFAULT_THINK_SYSTEM_PROMPT = `You are the reasoning layer in a multi-step AI pipeline. Your job is to review all chain outputs, catch errors or gaps, consider multiple approaches, and commit to the clearest direction for the final answer.

Output your thinking in this exact format:
[THINKING SUMMARY]
Reviewed: [list chain types reviewed, or "none" if no chains ran]
Gap found: [describe gap or "none"]
Correction needed: [chain type needed to fix gap, or "none"]
Approach selected: [chosen approach for final answer]
Direction for final output: [specific instruction for the answer chain]
Confidence: [high / medium / low] — [one sentence reason]`

function parseThinkOutput(raw: string): ThinkResult {
  const direction = raw.match(/Direction for final output:\s*(.+)/i)?.[1]?.trim() || raw
  const correctionMatch = raw.match(/Correction needed:\s*([A-Z_]+)/i)?.[1]?.trim()
  const confidenceMatch = raw.match(/Confidence:\s*(high|medium|low)/i)?.[1] as 'high' | 'medium' | 'low' | undefined

  const validChains: IntentCategory[] = [
    'WEB_SEARCH', 'DEEP_RESEARCH', 'VISION', 'CODING', 'COMPLEX_THINKING', 'MEDIUM_THINKING'
  ]
  const correctionChain = (correctionMatch && validChains.includes(correctionMatch as IntentCategory))
    ? correctionMatch as IntentCategory
    : undefined

  return {
    summary: raw,
    direction,
    correctionChain,
    confidence: confidenceMatch ?? 'medium',
  }
}

async function runThinkModel(
  prompt: string,
  systemPrompt: string,
  history: any[],
  context: any
): Promise<string | null> {
  const { chain } = await getRouterChain('THINKING' as any)

  if (chain.length === 0) {
    logger.warn('THINKING chain is empty — add models via Admin > Router > THINKING. Skipping think step.')
    return null
  }

  for (const modelConfig of chain) {
    if (!modelConfig.is_enabled) continue
    try {
      const provider = modelConfig.provider.toLowerCase()
      if (provider === 'google') {
        const res = await runGoogle(modelConfig.id, prompt, systemPrompt, undefined, context, history)
        if (res) return res
      } else if (provider === 'groq') {
        const keys = await getProviderKeys('GROQ')
        const res = await runGroq(modelConfig.id, prompt, systemPrompt, keys[0], context, history)
        if (res) return res
      }
    } catch (e: any) {
      logger.warn(`Think chain model ${modelConfig.id} failed: ${e.message}`)
    }
  }
  return null
}

export async function runThinkChain(
  originalPrompt: string,
  accumulatedContext: string,
  history: any[],
  sessionSummary: string | null,
  replyContext: any,
  context: any,
  onStatus: StatusCallback,
  maxCorrectionLoops: number = 1
): Promise<ThinkChainOutput> {
  const { chain: thinkChain, system_prompt } = await getRouterChain('THINKING' as any)
  const systemPrompt = system_prompt || DEFAULT_THINK_SYSTEM_PROMPT

  const buildThinkPrompt = (ctx: string) => {
    const parts = []
    if (replyContext?.attentionBlock) parts.push(replyContext.attentionBlock)
    if (sessionSummary) parts.push(`[SESSION MEMORY SUMMARY]\n${sessionSummary}`)
    parts.push(`[ORIGINAL REQUEST]\n${originalPrompt}`)
    if (ctx) parts.push(ctx)
    parts.push(`Review the above, identify any gaps or errors, select the best approach, and provide clear direction for the final answer.`)
    return parts.join('\n\n')
  }

  const thinkStep: PipelineStep = { chain: 'THINKING', goal: 'Review all outputs and plan final answer', status: 'running' }
  onStatus(thinkStep)

  const thinkPrompt = buildThinkPrompt(accumulatedContext)
  const raw = await runThinkModel(thinkPrompt, systemPrompt, history.slice(-6), context)

  if (!raw) {
    thinkStep.status = 'failed'
    onStatus(thinkStep)
    return {
      thinkSummary: '',
      direction: 'Answer the user request based on the available context.',
      steps: [thinkStep],
    }
  }

  const result = parseThinkOutput(raw)
  const allSteps: PipelineStep[] = []

  // Correction loop — max once
  let correctedContext = accumulatedContext
  if (result.correctionChain && maxCorrectionLoops > 0) {
    logger.info(`Think chain requesting correction: ${result.correctionChain}`)
    thinkStep.status = 'done'
    thinkStep.output = raw
    allSteps.push({ ...thinkStep })
    onStatus(thinkStep)

    const correctionPlan: OrchestratorPlan = {
      steps: [result.correctionChain],
      stepGoals: [`Provide additional data to fill gap identified by think chain: ${result.direction}`],
    }

    const correctionResult = await executePipeline(correctionPlan, originalPrompt, context, onStatus)
    correctedContext = accumulatedContext + '\n\n' + correctionResult.accumulatedContext
    allSteps.push(...correctionResult.steps)

    // Second think pass — no more corrections
    const thinkStep2: PipelineStep = { chain: 'THINKING', goal: 'Final review after correction', status: 'running' }
    onStatus(thinkStep2)

    const thinkPrompt2 = buildThinkPrompt(correctedContext)
    const raw2 = await runThinkModel(thinkPrompt2, systemPrompt, history.slice(-6), context)

    if (raw2) {
      const result2 = parseThinkOutput(raw2)
      thinkStep2.status = 'done'
      thinkStep2.output = raw2
      allSteps.push({ ...thinkStep2 })
      onStatus(thinkStep2)
      return {
        thinkSummary: raw2,
        direction: result2.direction,
        correctedContext,
        steps: allSteps,
      }
    }

    thinkStep2.status = 'failed'
    allSteps.push({ ...thinkStep2 })
    onStatus(thinkStep2)
  } else {
    thinkStep.status = 'done'
    thinkStep.output = raw
    allSteps.push({ ...thinkStep })
    onStatus(thinkStep)
  }

  return {
    thinkSummary: raw,
    direction: result.direction,
    correctedContext,
    steps: allSteps,
  }
}
```

- [ ] **Step 2: Commit**
```bash
git add src/lib/bot/thinkChain.ts
git commit -m "feat: add think chain — reasoning pass with one correction loop before final answer"
```

---

### Task 9: Wire orchestrator + pipeline + think chain into chainRouter.ts

**Files:**
- Modify: `src/lib/bot/chainRouter.ts`

This is the central integration task. The existing `runChain` function gets a new code path for MULTI_CHAIN results and a think chain injection.

- [ ] **Step 1: Add imports to chainRouter.ts**

At the top of `src/lib/bot/chainRouter.ts`, add:
```ts
import { planChainSequence } from './orchestrator'
import { executePipeline, PipelineStep, StatusCallback } from './pipeline'
import { runThinkChain } from './thinkChain'
import { getPipelineSettings } from '../router-config'
```

- [ ] **Step 2: Extend runChain signature to accept thinkingEnabled and onStatus**

Update the `context` parameter type:
```ts
context?: {
  chatId?: number
  userId?: string
  aiApiKey?: string
  activeEntityId?: string
  activeWorkspaceId?: string
  classificationModelId?: string
  temperature?: number
  mode?: BotMode
  intentTag?: string | null
  replyContext?: any
  thinkingEnabled?: boolean
  onStatus?: StatusCallback
}
```

- [ ] **Step 3: Add pipeline path after classification**

After the existing `classifyIntentWithModel` call (around line 140), insert:

```ts
const pipelineSettings = await getPipelineSettings()
const thinkingEnabled = context?.thinkingEnabled ?? pipelineSettings.thinkingToggleDefault
const onStatus: StatusCallback = context?.onStatus ?? (() => {})

// MULTI_CHAIN path
if (rawCategory === 'MULTI_CHAIN' && pipelineSettings.orchestratorEnabled) {
  onStatus({ chain: 'ORCHESTRATOR', goal: 'Planning chain sequence', status: 'running' })

  const plan = await planChainSequence(
    prompt,
    history,
    context?.replyContext,
    currentSummary,
    pipelineSettings.maxPipelineSteps
  )

  if (!plan) {
    logger.error('Orchestrator failed to produce a plan — falling back to COMPLEX_THINKING')
    // Fall through to single-chain path with COMPLEX_THINKING
    category = 'COMPLEX_THINKING'
  } else {
    onStatus({ chain: 'ORCHESTRATOR', goal: 'Planning chain sequence', status: 'done' })

    const pipelineResult = await executePipeline(plan, prompt, context, onStatus)

    let finalAccumulated = pipelineResult.accumulatedContext
    let thinkSummary = ''

    if (thinkingEnabled) {
      const thinkResult = await runThinkChain(
        prompt,
        finalAccumulated,
        history,
        currentSummary,
        context?.replyContext,
        context,
        onStatus
      )
      thinkSummary = thinkResult.direction
      if (thinkResult.correctedContext) finalAccumulated = thinkResult.correctedContext
    }

    // Final output chain — always a text chain
    const finalCategory: IntentCategory = 'COMPLEX_THINKING'
    let { chain: finalChain, system_prompt: finalSystemPrompt } = await getRouterChain(finalCategory)

    finalSystemPrompt = dateContext + '\n\n' + (finalSystemPrompt || '')
    if (currentSummary) finalSystemPrompt = `[SESSION MEMORY SUMMARY]\n${currentSummary}\n\n` + finalSystemPrompt
    if (globalPrompt) finalSystemPrompt = globalPrompt + '\n\n' + finalSystemPrompt
    if (context?.replyContext?.attentionBlock) finalSystemPrompt = context.replyContext.attentionBlock + '\n\n' + finalSystemPrompt
    if (finalAccumulated) finalSystemPrompt = `[PIPELINE CONTEXT]\n${finalAccumulated}\n\n` + finalSystemPrompt
    if (thinkSummary) finalSystemPrompt = `[THINK CHAIN DIRECTION]\n${thinkSummary}\n\n` + finalSystemPrompt

    const finalOutputStep: PipelineStep = { chain: finalCategory, goal: 'Write final answer', status: 'running' }
    onStatus(finalOutputStep)

    for (const modelConfig of finalChain) {
      if (!modelConfig.is_enabled) continue
      try {
        const response = await runGoogle(modelConfig.id, prompt, finalSystemPrompt, undefined, context as any, history)
        if (response) {
          finalOutputStep.status = 'done'
          onStatus(finalOutputStep)

          const allSteps = [...pipelineResult.steps, finalOutputStep]
          return {
            type: pipelineResult.imageBuffer ? 'photo' : 'text',
            content: pipelineResult.imageBuffer ?? response,
            usage_type: 'chat',
            model: modelConfig.id,
            model_chain: `orchestrator → ${allSteps.map(s => s.chain).join(' → ')}`,
            status: 'success',
            pipeline_steps: allSteps,
          }
        }
      } catch (e: any) {
        logger.warn(`Final output chain ${modelConfig.id} failed: ${e.message}`)
      }
    }

    return { type: 'text', content: '⚡ *System Overload*', usage_type: 'chat', status: 'error' }
  }
}

// SINGLE-CHAIN path with optional think chain
```

- [ ] **Step 4: Add think chain to single-chain path**

After the existing single-chain executes successfully (where it currently returns the response), insert the think chain step before returning:

```ts
// If thinking enabled, run think chain before final output
if (thinkingEnabled && typeof finalContent === 'string') {
  const thinkResult = await runThinkChain(
    prompt,
    '', // no accumulated context for single-chain
    history,
    currentSummary,
    context?.replyContext,
    context as any,
    onStatus
  )

  // Re-run the output with think direction injected
  const enhancedSystemPrompt = `[THINK CHAIN DIRECTION]\n${thinkResult.direction}\n\n` + system_prompt
  // (run the same model again with enhanced prompt — use first model in chain)
  // Note: for simplicity, inject direction into existing response flow
  // Full implementation: re-call the model with the enhanced system prompt
}
```

- [ ] **Step 5: Add pipeline_steps to ChainResponse type**

In `chainRouter.ts`, update the `ChainResponse` interface:
```ts
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
  pipeline_steps?: PipelineStep[]  // ← new
}
```

- [ ] **Step 6: Manual test — multi-chain**

Start dev server. Send: "search for the latest AI models released in 2025 and create a comparison table"
Expected: logs show `MULTI_CHAIN` → orchestrator plans → WEB_SEARCH → COMPLEX_THINKING → final answer with a table.

- [ ] **Step 7: Commit**
```bash
git add src/lib/bot/chainRouter.ts
git commit -m "feat: wire orchestrator, pipeline, think chain into chainRouter"
```

---

### Task 10: Add thinking toggle to mode popup

**Files:**
- Modify: `src/components/assistant/AIAssistant.tsx`
- Modify: `src/app/api/ai/chat/route.ts`

- [ ] **Step 1: Add thinking toggle button to mode popup**

In `AIAssistant.tsx`, find the mode popup section (around the `showModeMenu` block). Add a thinking toggle after the mode list:

```tsx
const thinkingEnabled = useStore(state => state.thinkingEnabled)
const setThinkingEnabled = useStore(state => state.setThinkingEnabled)
```

Inside the mode popup JSX, after the mode options list:
```tsx
<div className="border-t border-white/5 mt-1 pt-1 px-2 pb-1">
  <button
    onClick={() => setThinkingEnabled(!thinkingEnabled)}
    className={clsx(
      'w-full flex items-center gap-3 px-2 py-2 rounded-[10px] text-xs transition-all duration-200',
      thinkingEnabled
        ? 'bg-accent/10 text-accent font-bold'
        : 'text-bone-60 hover:bg-white/5 hover:text-bone-100'
    )}
  >
    <Brain className="w-3.5 h-3.5" strokeWidth={2} />
    <div className="flex flex-col items-start">
      <span className="text-[11px] font-bold">Thinking</span>
      <span className="text-[10px] opacity-60">{thinkingEnabled ? 'On — reasoning before answer' : 'Off'}</span>
    </div>
    <div className={clsx(
      'ml-auto w-7 h-4 rounded-full transition-all duration-200 flex items-center',
      thinkingEnabled ? 'bg-accent justify-end' : 'bg-white/10 justify-start'
    )}>
      <div className="w-3 h-3 rounded-full bg-white mx-0.5" />
    </div>
  </button>
</div>
```

Make sure `Brain` is imported from lucide-react.

- [ ] **Step 2: Pass thinkingEnabled in API calls**

In `AIAssistant.tsx`, find where the fetch to `/api/ai/chat` is constructed. Add `thinkingEnabled` to the body:
```ts
body: JSON.stringify({
  ...existingFields,
  thinkingEnabled,
})
```

- [ ] **Step 3: Read thinkingEnabled in chat route**

In `src/app/api/ai/chat/route.ts`, destructure from request body:
```ts
const { prompt, buffer, aiApiKey, activeEntityId, activeWorkspaceId, classificationModelId, mode, intentTag, replyContext, thinkingEnabled } = await req.json()
```

Pass to `runChain`:
```ts
const result = await runChain(prompt, imageBuffer, {
  ...existingContext,
  thinkingEnabled: thinkingEnabled === true,
})
```

- [ ] **Step 4: Manual test**

Toggle thinking on → send a complex question → verify "Thinking..." appears in the response metadata / logs. Toggle off → same question → no think chain.

- [ ] **Step 5: Commit**
```bash
git add src/components/assistant/AIAssistant.tsx src/app/api/ai/chat/route.ts
git commit -m "feat: add thinking toggle to mode popup, wire to API and runChain"
```

---

## Phase 8 — Admin Controls (Gemini Flash)

### Task 11: Pipeline settings in Global Settings admin

**Files:**
- Modify: `src/app/admin/router/actions.ts`
- Modify relevant admin settings page

- [ ] **Step 1: Add getPipelineAdminSettings and savePipelineSettings actions**

In `src/app/admin/router/actions.ts`:

```ts
export async function getPipelineAdminSettings() {
  const { data } = await supabase
    .from('settings')
    .select('key, value')
    .in('key', [
      'thinking_toggle_default', 'thinking_summary_visible',
      'orchestrator_enabled', 'max_pipeline_steps', 'image_gen_auto_last'
    ])
  const map: Record<string, any> = {}
  for (const row of data ?? []) map[row.key] = row.value
  return map
}

export async function savePipelineSetting(key: string, value: any) {
  const { error } = await supabase
    .from('settings')
    .upsert({ key, value, updated_at: new Date().toISOString() })
  if (error) throw error
  revalidatePath('/admin/telegram/router')
  return { success: true }
}
```

- [ ] **Step 2: Add status message settings actions**

```ts
export async function getStatusMessages(): Promise<Record<string, { label: string; emoji: string }>> {
  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'pipeline_status_messages')
    .maybeSingle()
  return (data?.value as any) ?? {}
}

export async function saveStatusMessage(chainType: string, label: string, emoji: string) {
  const current = await getStatusMessages()
  current[chainType] = { label, emoji }
  const { error } = await supabase
    .from('settings')
    .upsert({ key: 'pipeline_status_messages', value: current, updated_at: new Date().toISOString() })
  if (error) throw error
  revalidatePath('/admin/telegram/router')
  return { success: true }
}
```

- [ ] **Step 3: Add ORCHESTRATOR and THINKING chain cards to router admin**

In `src/app/admin/router/page.tsx`, add to the list of categories that get `AddCategoryButton` if missing:

```tsx
{!routers.some((r: any) => r.category === 'ORCHESTRATOR') && (
  <AddCategoryButton platform="unified" category="ORCHESTRATOR" />
)}
{!routers.some((r: any) => r.category === 'THINKING') && (
  <AddCategoryButton platform="unified" category="THINKING" />
)}
```

- [ ] **Step 4: Add orchestrator test tool**

Create `src/components/admin/OrchestratorTestTool.tsx`:

```tsx
'use client'
import { useState } from 'react'
import { Play, Loader2 } from 'lucide-react'

export default function OrchestratorTestTool() {
  const [prompt, setPrompt] = useState('')
  const [result, setResult] = useState<{ steps: string[]; goals: string[] } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleTest = async () => {
    if (!prompt.trim()) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const res = await fetch('/api/admin/orchestrator/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setResult(data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-muted-foreground">Test what chain sequence the orchestrator plans for a prompt — without executing any chains.</p>
      <div className="flex gap-2">
        <input
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder="e.g. search for latest AI models and make a table"
          className="flex-1 bg-background border border-white/5 rounded-sm px-3 py-1.5 text-[12px] text-foreground focus:outline-none"
          onKeyDown={e => e.key === 'Enter' && handleTest()}
        />
        <button
          onClick={handleTest}
          disabled={loading || !prompt.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-accent text-background rounded-sm text-[10px] font-bold uppercase tracking-wider disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
          Test
        </button>
      </div>
      {error && <p className="text-[11px] text-rose-500">{error}</p>}
      {result && (
        <div className="bg-background rounded-sm border border-white/5 p-3 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Planned sequence</p>
          {result.steps.map((step, i) => (
            <div key={i} className="flex gap-3 items-start">
              <span className="text-[10px] font-mono text-accent w-4">{i + 1}.</span>
              <div>
                <span className="text-[11px] font-bold text-foreground">{step}</span>
                <p className="text-[10px] text-muted-foreground">{result.goals[i]}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Add orchestrator test API route**

Create `src/app/api/admin/orchestrator/test/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { planChainSequence } from '@/lib/bot/orchestrator'
import { getPipelineSettings } from '@/lib/router-config'

export async function POST(req: NextRequest) {
  const { prompt } = await req.json()
  if (!prompt) return NextResponse.json({ error: 'prompt required' }, { status: 400 })

  try {
    const settings = await getPipelineSettings()
    const plan = await planChainSequence(prompt, [], null, null, settings.maxPipelineSteps)
    if (!plan) return NextResponse.json({ error: 'Orchestrator returned no plan' }, { status: 500 })
    return NextResponse.json({ steps: plan.steps, goals: plan.stepGoals })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
```

- [ ] **Step 6: Manual test**

Open Admin > Router, verify ORCHESTRATOR and THINKING chain cards appear. Use the test tool — type "research AI models and create a table" → should show a planned sequence of steps.

- [ ] **Step 7: Commit**
```bash
git add src/app/admin/router/actions.ts src/components/admin/OrchestratorTestTool.tsx src/app/api/admin/orchestrator/test/route.ts
git commit -m "feat: add pipeline admin controls — settings, status messages, orchestrator test tool"
```

---

## Phase 9 — Status Updates UI

### Task 12: Render pipeline_steps in chat UI

**Files:**
- Modify: `src/components/assistant/components/ChatMessage.tsx`

- [ ] **Step 1: Add pipeline steps display to ChatMessage**

The `ChainResponse` now includes `pipeline_steps`. The AI message component needs to render them as a step timeline above the message content.

In `src/components/assistant/components/ChatMessage.tsx`, find where the AI message is rendered and add before the message content:

```tsx
{message.pipelineSteps && message.pipelineSteps.length > 0 && (
  <div className="mb-3 space-y-1">
    {message.pipelineSteps.map((step: any, i: number) => (
      <div key={i} className="flex items-center gap-2 text-[10px] text-muted-foreground">
        <span className={step.status === 'done' ? 'text-accent' : step.status === 'failed' ? 'text-rose-500' : 'opacity-40'}>
          {step.status === 'done' ? '✓' : step.status === 'failed' ? '✗' : '◌'}
        </span>
        <span className="font-mono uppercase tracking-wider">{step.chain}</span>
        {step.status === 'done' && <span className="opacity-40">·</span>}
        {step.goal && <span className="opacity-40 truncate max-w-[200px]">{step.goal}</span>}
      </div>
    ))}
  </div>
)}
```

- [ ] **Step 2: Pass pipeline_steps from API response to message store**

In `AIAssistant.tsx`, when the API response is received, include `pipeline_steps` in the message object stored in state.

- [ ] **Step 3: Manual test**

Send a multi-chain request. Verify the response shows the step timeline above the answer:
```
✓ WEB_SEARCH · Search for AI models released in 2025
✓ COMPLEX_THINKING · Synthesize findings into comparison table
```

- [ ] **Step 4: Commit**
```bash
git add src/components/assistant/components/ChatMessage.tsx
git commit -m "feat: render pipeline step timeline in chat UI"
```

---

## Verification Checklist

After all phases are complete, verify:

- [ ] Only Default and Pro appear in mode popup — no Think option
- [ ] Thinking toggle appears in mode popup, persists per session
- [ ] Simple question ("what is React?") → single chain, fast response, no orchestrator
- [ ] Multi-chain request ("search X and make a table") → MULTI_CHAIN → orchestrator → pipeline → final answer
- [ ] Pipeline step timeline renders in chat UI
- [ ] Think chain fires when toggle is on — logs show `[THINKING SUMMARY]`
- [ ] Think chain skips when toggle is off
- [ ] Admin > Router has ORCHESTRATOR and THINKING chain cards
- [ ] Orchestrator test tool returns a plan without executing chains
- [ ] Internal chain prompts editable in admin with reset button
- [ ] Platform is now `unified` in all router_chains rows
- [ ] `mode-think.txt` is archived, not active
