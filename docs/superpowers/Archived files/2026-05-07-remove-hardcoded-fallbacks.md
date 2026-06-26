# Remove Hardcoded Fallbacks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove every hardcoded fallback, default prompt, keyword list, and silent error from the bot core — everything must come from admin DB config or fail loudly with a specific activity log entry.

**Architecture:** Strip defaults from `classifier.ts`, `chainRouter.ts`, `compilePrompt.ts`, `google.ts`, `cloudflare.ts`, `pollinations.ts`, and `classifier/actions.ts`. Replace every silent fallback with a thrown error or null + specific admin log message. Delete `defaults.ts`. The bot must fail visibly and descriptively when any DB config is missing, rather than silently using invisible code-level values.

**Tech Stack:** TypeScript, Next.js App Router, Supabase (bot_settings, bot_compiled_prompt, settings tables), Telegram bot webhook

---

## File Map

| File | Action | What changes |
|---|---|---|
| `src/app/admin/bot/classifier/defaults.ts` | **Delete** | Entire file removed |
| `src/app/admin/bot/classifier/actions.ts` | **Modify** | Remove DEFAULT_* imports and fallbacks, return null when DB missing |
| `src/lib/bot/classifier.ts` | **Modify** | Remove MAPS_KEYWORDS, maps-override, DEFAULT_* fallbacks, FAST_SIMPLE fallback; throw on missing config |
| `src/lib/bot/chainRouter.ts` | **Modify** | Remove TOOL_CALLING/IMAGE_GEN hardcoded system prompts, remove "CRITICAL:..." global prepend, keep Date/Time injection and FAILURE_CACHE_MS |
| `src/lib/bot/compilePrompt.ts` | **Modify** | Remove hardcoded CATEGORY_LABELS ordering; keep section labels (cosmetic, not behavior) |
| `src/lib/bot/providers/google.ts` | **Modify** | Raise timeout to 30s, remove "Analyze this." fallback prompt, keep Gemma formatting workaround |
| `src/lib/bot/providers/cloudflare.ts` | **Modify** | Add 30s timeout, log actual CF error body |
| `src/lib/bot/providers/pollinations.ts` | **Modify** | Add 30s timeout |
| `src/lib/bot/providers/groq.ts` | **Modify** | Log 429 explicitly to logger (currently silent) |
| `src/lib/admin/logAction.ts` | **Read** | Understand signature so plan tasks use correct call |

---

## Task 1: Understand logAction signature

**Files:**
- Read: `src/lib/admin/logAction.ts`

- [ ] **Step 1: Read the file**

```bash
cat src/lib/admin/logAction.ts
```

Note the exact function signature. All subsequent tasks use `logAdminAction(action, message, metadata?)` — verify the parameter names match what you see.

- [ ] **Step 2: Commit nothing — this is a read-only orientation step**

---

## Task 2: Delete defaults.ts and fix classifier/actions.ts

**Files:**
- Delete: `src/app/admin/bot/classifier/defaults.ts`
- Modify: `src/app/admin/bot/classifier/actions.ts`

- [ ] **Step 1: Delete defaults.ts**

```bash
rm src/app/admin/bot/classifier/defaults.ts
```

- [ ] **Step 2: Rewrite classifier/actions.ts — remove all DEFAULT_* imports and fallbacks**

Replace the entire file with:

```typescript
'use server'

import { supabaseAdmin as supabase } from '@/lib/supabase'
import { logAdminAction } from '@/lib/admin/logAction'
import { revalidatePath } from 'next/cache'
import type { BotMode } from '@/data/store.types'

export async function getClassifierConfig(mode: BotMode = 'default'): Promise<{ prompt: string | null; keywords: Record<string, string[]> | null }> {
  const [promptResult, keywordsResult] = await Promise.all([
    supabase
      .from('bot_settings')
      .select('content')
      .eq('category', 'classifier_prompt')
      .eq('mode', mode)
      .maybeSingle(),
    supabase
      .from('bot_settings')
      .select('content')
      .eq('category', 'classifier_keywords')
      .eq('mode', 'default')
      .maybeSingle(),
  ])

  const prompt = promptResult.data?.content ?? null

  let keywords: Record<string, string[]> | null = null
  if (keywordsResult.data?.content) {
    try { keywords = JSON.parse(keywordsResult.data.content) } catch { keywords = null }
  }

  return { prompt, keywords }
}

export async function saveClassifierPrompt(prompt: string, mode: BotMode = 'default'): Promise<void> {
  const { error } = await supabase
    .from('bot_settings')
    .upsert(
      { category: 'classifier_prompt', content: prompt, mode, updated_at: new Date().toISOString() },
      { onConflict: 'category,mode' }
    )
  if (error) throw error
  await logAdminAction('settings_saved', `Saved classifier prompt [${mode}]`, { mode })
  revalidatePath(`/admin/bot/${mode}`)
}

export async function saveClassifierKeywords(keywords: Record<string, string[]>): Promise<void> {
  const { error } = await supabase
    .from('bot_settings')
    .upsert(
      { category: 'classifier_keywords', content: JSON.stringify(keywords), mode: 'default', updated_at: new Date().toISOString() },
      { onConflict: 'category,mode' }
    )
  if (error) throw error
  await logAdminAction('settings_saved', 'Saved classifier keywords')
  revalidatePath('/admin/bot/keywords')
}

export async function saveClassifierConfig(prompt: string, keywords: Record<string, string[]>, mode: BotMode = 'default'): Promise<void> {
  await saveClassifierPrompt(prompt, mode)
}
```

- [ ] **Step 3: Check for any other files that import from defaults.ts**

```bash
grep -r "from.*classifier/defaults" src/ --include="*.ts" --include="*.tsx"
```

If any results appear, remove those imports and update those files to not use DEFAULT_* constants.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -40
```

Expected: no errors referencing `defaults.ts` or `DEFAULT_CLASSIFICATION_PROMPT` / `DEFAULT_KEYWORDS`.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/bot/classifier/actions.ts
git rm src/app/admin/bot/classifier/defaults.ts
git commit -m "feat(bot): remove hardcoded classifier defaults — config must come from DB"
```

---

## Task 3: Rewrite classifier.ts — remove maps-override, FAST_SIMPLE fallback, DEFAULT_* usage

**Files:**
- Modify: `src/lib/bot/classifier.ts`

- [ ] **Step 1: Replace the entire file**

```typescript
import { getRouterChain, IntentCategory } from '../router-config'
import { logger } from '../logger'
import { runGoogle } from './providers/google'
import { runGroq } from './providers/groq'
import { supabaseAdmin } from '../supabase'
import type { BotMode } from '@/data/store.types'
import { isModelFailed, markModelFailed } from './chainRouter'

function trackModelUsage(modelId: string, provider: string) {
  supabaseAdmin.rpc('increment_model_usage', { p_model_id: modelId, p_provider: provider })
    .then(({ error }: { error: any }) => { if (error) logger.warn(`Usage track failed [${modelId}]: ${error.message}`) })
}

export interface ClassifyTrace {
  model: string
  key: string
  success: boolean
}

export interface ClassifyResult {
  category: IntentCategory | null
  classifierModel: string
  trace: ClassifyTrace[]
  error?: string
}

const VALID_CATEGORIES: IntentCategory[] = [
  'FAST_SIMPLE', 'COMPLEX_THINKING', 'MEDIUM_THINKING',
  'IMAGE_GEN', 'WEB_SEARCH', 'AUDIO_VOICE', 'TOOL_CALLING',
  'CODING', 'DEEP_RESEARCH',
]

const TAG_CATEGORY_MAP: Record<string, IntentCategory> = {
  '/search':   'WEB_SEARCH',
  '/research': 'DEEP_RESEARCH',
  '/code':     'CODING',
  '/image':    'IMAGE_GEN',
  '/tool':     'TOOL_CALLING',
}

export async function classifyIntent(message: string, aiApiKey?: string, modelId?: string): Promise<IntentCategory | null> {
  const result = await classifyIntentWithModel(message, aiApiKey, modelId)
  return result.category
}

export async function classifyIntentWithModel(
  message: string,
  aiApiKey?: string,
  modelId?: string,
  mode: BotMode = 'default',
  intentTag?: string | null
): Promise<ClassifyResult> {
  const lowerMsg = message.trim().toLowerCase()

  // Intent tag handling — tags are trusted directly
  if (intentTag && TAG_CATEGORY_MAP[intentTag]) {
    return { category: TAG_CATEGORY_MAP[intentTag], classifierModel: 'Intent Tag', trace: [] }
  }

  // Load mode-specific classifier config — no fallbacks, missing = error
  let keywordsObj: Record<string, string[]> | null = null
  let activePrompt: string | null = null
  let keywordsEnabled = true

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
        .eq('mode', 'default')
        .maybeSingle(),
    ])

    if (keywordsEnabledResult.data) keywordsEnabled = keywordsEnabledResult.data.is_active

    activePrompt = promptResult.data?.content ?? null
    if (!activePrompt) {
      const errMsg = `Classifier prompt missing for mode "${mode}" — configure it in Admin > Bot > Classifier`
      logger.error(errMsg)
      return { category: null, classifierModel: 'Error', trace: [], error: errMsg }
    }

    if (keywordsResult.data?.content) {
      try { keywordsObj = JSON.parse(keywordsResult.data.content) } catch {
        logger.warn(`Classifier keywords JSON parse failed for mode "${mode}" — skipping keyword step`)
      }
    }
  } catch (err) {
    const errMsg = `Classifier DB config load failed [${mode}]: ${(err as Error).message}`
    logger.error(errMsg)
    return { category: null, classifierModel: 'Error', trace: [], error: errMsg }
  }

  // Keyword fast-path — only runs if keywords are configured and enabled
  if (keywordsEnabled && keywordsObj) {
    for (const cat of Object.keys(keywordsObj) as IntentCategory[]) {
      const list = keywordsObj[cat] || []
      for (const kw of list) {
        const kwLower = kw.trim().toLowerCase()
        if (!kwLower) continue
        const escapedKw = kwLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const regex = new RegExp(`\\b${escapedKw}\\b`, 'i')
        if (regex.test(lowerMsg)) {
          return { category: cat, classifierModel: 'Keywords', trace: [] }
        }
      }
    }
  }

  // Model classification
  const { chain } = await getRouterChain('CLASSIFIER')
  let activeChain = chain

  if (modelId) {
    const selected = chain.find(m => m.id === modelId)
    if (selected) {
      activeChain = [selected]
    } else {
      activeChain = [{ id: modelId, provider: 'google', is_enabled: true } as any]
    }
  }

  const trace: ClassifyTrace[] = []

  for (const modelConfig of activeChain) {
    if (!modelConfig.is_enabled) continue
    if (isModelFailed(modelConfig.id)) {
      logger.info(`Classifier skipping failed model: ${modelConfig.id}`)
      trace.push({ model: modelConfig.id, key: 'SKIPPED', success: false })
      continue
    }

    let key = modelConfig.provider === 'google' ? 'GEMINI' : modelConfig.provider.toUpperCase()
    if (modelConfig.provider.toLowerCase().includes('ollama')) key = 'LOCAL'

    try {
      let rawResponse: string | null = null
      const traceContext: any = { aiApiKey }
      const prompt = `${activePrompt}\n"${message}"`

      const provider = modelConfig.provider.toLowerCase()
      if (provider === 'google') {
        rawResponse = await runGoogle(modelConfig.id, prompt, undefined, undefined, traceContext)
      } else if (provider === 'groq') {
        rawResponse = await runGroq(modelConfig.id, prompt, undefined, aiApiKey, traceContext)
      } else if (provider === 'openrouter') {
        const orRes = await (await import('./providers/openrouter')).runOpenRouter(modelConfig.id, prompt, '', [], aiApiKey)
        rawResponse = typeof orRes === 'string' ? orRes : null
      } else if (provider === 'ollama' || provider === 'local') {
        const olRes = await (await import('./providers/ollama')).runOllama(modelConfig.id, prompt, '', [])
        rawResponse = typeof olRes === 'string' ? olRes : null
      } else if (provider === 'pollinations') {
        const polRes = await (await import('./providers/pollinations')).runPollinationsText(modelConfig.id, prompt, '', [])
        rawResponse = typeof polRes === 'string' ? polRes : null
      }

      if (rawResponse) {
        const cleaned = rawResponse.trim().toUpperCase()

        for (const cat of VALID_CATEGORIES) {
          if (cleaned === cat) {
            const displayKey = traceContext.usedKeyIndex ? `${key} ${traceContext.usedKeyIndex}` : `${key} 1`
            trace.push({ model: modelConfig.id, key: displayKey, success: true })
            trackModelUsage(modelConfig.id, modelConfig.provider)
            return { category: cat, classifierModel: modelConfig.id, trace }
          }
        }

        for (const cat of VALID_CATEGORIES) {
          const regex = new RegExp(`\\b${cat}\\b`, 'i')
          if (regex.test(cleaned)) {
            const displayKey = traceContext.usedKeyIndex ? `${key} ${traceContext.usedKeyIndex}` : `${key} 1`
            trace.push({ model: modelConfig.id, key: displayKey, success: true })
            trackModelUsage(modelConfig.id, modelConfig.provider)
            return { category: cat, classifierModel: modelConfig.id, trace }
          }
        }
      }

      trace.push({ model: modelConfig.id, key: `${key} 1`, success: false })
    } catch (error: any) {
      markModelFailed(modelConfig.id)
      trace.push({ model: modelConfig.id, key: `${key} 1`, success: false })
      logger.warn(`Classification failure [${modelConfig.id}]: ${error.message}`)
    }
  }

  // All models exhausted — no fallback, fail loudly
  const errMsg = `Classifier: all models exhausted for mode "${mode}" — no category could be determined. Check Admin > Router > CLASSIFIER chain.`
  logger.error(errMsg)
  return { category: null, classifierModel: 'Error', trace, error: errMsg }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -40
```

Expected: no errors. Note that `ClassifyResult.category` is now `IntentCategory | null` — chainRouter.ts will need updating in the next task to handle null.

- [ ] **Step 3: Commit**

```bash
git add src/lib/bot/classifier.ts
git commit -m "feat(bot): classifier fails loudly on missing DB config, removes maps-override and FAST_SIMPLE fallback"
```

---

## Task 4: Rewrite chainRouter.ts — remove hardcoded system prompts, CRITICAL prepend, handle null category

**Files:**
- Modify: `src/lib/bot/chainRouter.ts`

This is the largest change. The key removals:
- Lines 152–157: hardcoded `TOOL_CALLING` and `IMAGE_GEN` system prompts
- Lines 172–174: the `"CRITICAL: Provide ONLY the final answer..."` global prepend
- Lines 113–119: hardcoded vision fallback prompts
- Line 126: `"You are a vision assistant."` hardcoded system prompt
- Lines 138, 141: hardcoded vision error strings → replaced with logger + null return
- Handle `category: null` from classifier (new — was always a string before)

- [ ] **Step 1: Replace the vision fallback prompts and hardcoded vision system prompt (lines ~113–141)**

Find this block:
```typescript
    let activePrompt = prompt;
    if (!activePrompt && activeBuffer) {
      if (history.length > 0) {
        activePrompt = "The user sent an image without a prompt. Analyze the conversation history and this image to understand what the user likely wants. If there is a clear task (e.g., 'extract text', 'describe this', 'summarize'), perform it. If the intent is unclear, describe the image and ask how you can help.";
      } else {
        activePrompt = "Analyze this image and decide how to answer by yourself. Describe it and ask how I can help.";
      }
    }
```

Replace with:
```typescript
    const activePrompt = prompt || null
    if (!activePrompt) {
      logger.error('Vision request received with no prompt — configure a fallback in your VISION chain system_prompt')
    }
```

- [ ] **Step 2: Replace the hardcoded `"You are a vision assistant."` system prompt in the vision loop**

Find:
```typescript
        const visionRes = await runGoogle(modelConfig.id, activePrompt, dateContext + "\n\nYou are a vision assistant.", activeBuffer, context as any, history)
```

Replace with:
```typescript
        const visionRes = await runGoogle(modelConfig.id, activePrompt ?? '', dateContext + "\n\n" + (globalPrompt || ''), activeBuffer, context as any, history)
```

- [ ] **Step 3: Replace hardcoded vision error strings**

Find:
```typescript
    if (visionChain.length === 0) {
      logger.warn('No VISION chain configured in DB. Add models via Router admin.')
      return { type: 'text', content: "Vision chain is empty. Configure models in the VISION router.", usage_type: 'vision', model_chain: 'vision → (none)', status: 'error' }
    }
    
    return { type: 'text', content: "Vision failed. The configured models are either unreachable or do not support these images. Check your Router config and model IDs.", usage_type: 'vision', model_chain: 'vision → (none)', status: 'error' }
```

Replace with:
```typescript
    if (visionChain.length === 0) {
      logger.error('VISION chain is empty — add models via Admin > Router > VISION')
    }
    
    return { type: 'text', content: "⚡ *System Overload*", usage_type: 'vision', model_chain: 'vision → (none)', status: 'error' }
```

- [ ] **Step 4: Handle null category from classifier**

Find the line after classification:
```typescript
  const { category: rawCategory, classifierModel, trace: classificationTrace } = await classifyIntentWithModel(...)
  let category = rawCategory
```

Replace with:
```typescript
  const { category: rawCategory, classifierModel, trace: classificationTrace, error: classifyError } = await classifyIntentWithModel(prompt, context?.aiApiKey, context?.classificationModelId, context?.mode ?? 'default', context?.intentTag ?? null)

  if (!rawCategory) {
    logger.error(`Classification failed: ${classifyError ?? 'unknown reason'}`)
    return { type: 'text', content: "⚡ *System Overload*", usage_type: 'chat', model_chain: 'classifier → (failed)', status: 'error' }
  }

  let category = rawCategory
```

- [ ] **Step 5: Remove the hardcoded TOOL_CALLING and IMAGE_GEN system prompt injections**

Find:
```typescript
  // 3. Ensure System Prompt for Tool Calling
  if (!system_prompt && category === 'TOOL_CALLING') {
    system_prompt = "You are a workspace assistant. You can list, create, update, and delete notes/folders. When a user asks to modify a note by title, use list_notes first to find its ID. Always confirm actions."
  }
  if (!system_prompt && category === 'IMAGE_GEN') {
    system_prompt = "You are a creative artist. Generate high-quality images based on user prompts."
  }
```

Replace with:
```typescript
  // System prompts must be configured in Admin > Router for each chain category
  if (!system_prompt && (category === 'TOOL_CALLING' || category === 'IMAGE_GEN')) {
    logger.error(`No system_prompt configured for "${category}" chain — set it in Admin > Router > ${category}`)
  }
```

- [ ] **Step 6: Remove the "CRITICAL: Provide ONLY the final answer..." global prepend**

Find:
```typescript
  // Global constraint to prevent leaking internal reasoning/analysis
  system_prompt = "CRITICAL: Provide ONLY the final answer. NEVER output internal reasoning, analysis, planning, or drafting. Do not use headers like '*Neutrality:*', '*Final version plan:*', or '*Self-Correction:*'. Jump directly to the response.\n" +
                  "When you use a tool or perform a search, always synthesize and summarize the tool results into a natural, complete, and helpful answer to the user's question. Do NOT output raw tool results verbatim.\n\n" + (system_prompt || "");
```

Delete those 3 lines entirely. Nothing replaces them — if you want this behavior, add it to your chain's system_prompt in the admin.

- [ ] **Step 7: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -40
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/lib/bot/chainRouter.ts
git commit -m "feat(bot): remove all hardcoded system prompts from chainRouter — must be configured in Admin > Router"
```

---

## Task 5: Fix google.ts — raise timeout, remove "Analyze this." fallback

**Files:**
- Modify: `src/lib/bot/providers/google.ts`

- [ ] **Step 1: Raise timeout from 15s to 30s**

Find:
```typescript
const GOOGLE_TIMEOUT_MS = 15000
```

Replace with:
```typescript
const GOOGLE_TIMEOUT_MS = 30000
```

- [ ] **Step 2: Remove "Analyze this." fallback**

Find:
```typescript
      let finalPrompt = prompt || "Analyze this."
```

Replace with:
```typescript
      let finalPrompt = prompt
      if (!finalPrompt) {
        logger.error(`Google provider [${modelId}]: received empty prompt — no fallback configured`)
        return null
      }
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -40
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/bot/providers/google.ts
git commit -m "fix(bot): raise Gemini timeout to 30s, remove silent 'Analyze this.' fallback"
```

---

## Task 6: Fix cloudflare.ts and pollinations.ts — add timeouts, improve error logging

**Files:**
- Modify: `src/lib/bot/providers/cloudflare.ts`
- Modify: `src/lib/bot/providers/pollinations.ts`

- [ ] **Step 1: Add 30s timeout helper and improve error body logging in cloudflare.ts**

Replace the entire file:

```typescript
import { getVaultKey } from '../../vault'
import { logger } from '../../logger'

const CF_TIMEOUT_MS = 30000

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms))
  ])
}

export async function runCloudflare(modelId: string, prompt: string, aiApiKey?: string): Promise<Buffer | string | null> {
  const token = aiApiKey || await getVaultKey('CLOUDFLARE_TOKEN')
  const accountId = await getVaultKey('CLOUDFLARE_ACCOUNT_ID')

  if (!token || !accountId) {
    logger.error(`Cloudflare credentials missing from vault — token: ${!!token}, accountId: ${!!accountId}`)
    return null
  }

  const cfModel = modelId
  logger.info(`Cloudflare request: account=${accountId.slice(0, 8)}... model=${cfModel}`)

  try {
    const response = await withTimeout(
      fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${cfModel}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ prompt }),
        }
      ),
      CF_TIMEOUT_MS,
      `Cloudflare [${cfModel}]`
    )

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Cloudflare AI ${response.status}: ${error}`)
    }

    const contentType = response.headers.get('content-type') || ''

    if (contentType.includes('application/json')) {
      const json = await response.json() as any
      if (json?.success) {
        if (json?.result?.image) return Buffer.from(json.result.image, 'base64')
        if (json?.result?.response) return json.result.response
        if (json?.result?.text) return json.result.text
      }
      // Log full error shape so admin can see exactly what CF returned
      logger.error(`Cloudflare [${cfModel}] unexpected JSON shape: ${JSON.stringify(json).slice(0, 500)}`)
      throw new Error(`Cloudflare returned unexpected JSON shape — see logs`)
    }

    const arrayBuffer = await response.arrayBuffer()
    if (arrayBuffer.byteLength < 100) {
      throw new Error(`Cloudflare [${cfModel}] returned empty/tiny response (${arrayBuffer.byteLength} bytes)`)
    }
    return Buffer.from(arrayBuffer)
  } catch (error: any) {
    logger.error(`Cloudflare [${modelId}] failed: ${error.message}`)
    return null
  }
}
```

Note: the `MODEL_MAP` hardcoded alias (`cloudflare-workers-ai → @cf/black-forest-labs/flux-1-schnell`) is removed. Use the actual Cloudflare model path directly in your Router admin config.

- [ ] **Step 2: Add 30s timeout to pollinations.ts**

Replace the entire file:

```typescript
import { logger } from '../../logger'

const POLLINATIONS_TIMEOUT_MS = 30000

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms))
  ])
}

export async function runPollinations(prompt: string, model?: string): Promise<Buffer | null> {
  try {
    const seed = Math.floor(Math.random() * 1000000)
    let url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?seed=${seed}&width=1024&height=1024&nologo=true`
    if (model) url += `&model=${encodeURIComponent(model)}`

    logger.info(`Generating image via Pollinations [${model || 'default'}]: ${url}`)
    const response = await withTimeout(fetch(url), POLLINATIONS_TIMEOUT_MS, `Pollinations image [${model}]`)
    if (!response.ok) throw new Error(`Pollinations image ${response.status}: ${response.statusText}`)

    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch (error: any) {
    logger.error(`Pollinations image [${model}] failed: ${error.message}`)
    return null
  }
}

export async function runPollinationsText(
  modelId: string,
  prompt: string,
  systemPrompt?: string,
  history: any[] = [],
  apiKey?: string
): Promise<string | null> {
  try {
    const messages: { role: string; content: string }[] = []
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt })

    const recentHistory = (history || []).slice(-10)
    for (const msg of recentHistory) {
      if (msg.role && msg.content) messages.push({ role: msg.role, content: msg.content })
    }
    messages.push({ role: 'user', content: prompt })

    logger.info(`Routing text to Pollinations model: ${modelId}`)

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`

    const response = await withTimeout(
      fetch('https://gen.pollinations.ai/v1/chat/completions', {
        method: 'POST',
        headers,
        body: JSON.stringify({ model: modelId, messages, seed: Math.floor(Math.random() * 1000000) })
      }),
      POLLINATIONS_TIMEOUT_MS,
      `Pollinations text [${modelId}]`
    )

    if (!response.ok) {
      const errBody = await response.text().catch(() => '')
      throw new Error(`Pollinations text [${modelId}] ${response.status}: ${response.statusText} — ${errBody}`)
    }

    const data = await response.json()
    const content = data?.choices?.[0]?.message?.content
    if (!content) throw new Error(`Pollinations [${modelId}] returned empty content`)

    return content
  } catch (error: any) {
    logger.error(`Pollinations text [${modelId}] failed: ${error.message}`)
    return null
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -40
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/bot/providers/cloudflare.ts src/lib/bot/providers/pollinations.ts
git commit -m "fix(bot): add 30s timeouts to Cloudflare and Pollinations, remove CF MODEL_MAP alias, improve error logging"
```

---

## Task 7: Fix groq.ts — log 429 explicitly

**Files:**
- Modify: `src/lib/bot/providers/groq.ts`

- [ ] **Step 1: Replace silent 429 break with explicit log**

Find:
```typescript
        if (response.status === 429) {
          logger.warn(`Groq key rate limited (429). Trying next key...`)
          break // Break inner while, continue outer key loop
        }
```

Replace with:
```typescript
        if (response.status === 429) {
          logger.warn(`Groq [${modelId}] key index ${i + 1} rate limited (429) — trying next key if available`)
          break
        }
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -40
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/bot/providers/groq.ts
git commit -m "fix(bot): log Groq 429 rate limit with model and key index for admin visibility"
```

---

## Task 8: Admin action — add missing config to DB (manual step for you)

This is not a code task. After deploying, your bot will fail loudly on missing config. You need to add the following rows in Supabase (or via your admin UI) before the bot will work:

**`bot_settings` table — required rows:**

| category | mode | content |
|---|---|---|
| `classifier_prompt` | `default` | Your classification prompt text |
| `classifier_prompt` | `think` | Your classification prompt text (can be same) |
| `classifier_prompt` | `pro` | Your classification prompt text (can be same) |
| `classifier_keywords` | `default` | JSON object with category arrays |

**`router_chains` table — required for each category:**
- `TOOL_CALLING` chain must have a `system_prompt` value set
- `IMAGE_GEN` chain must have a `system_prompt` value set
- `VISION` chain must have a `system_prompt` value set

You can copy the old prompts from `defaults.ts` (before it's deleted) and paste them into the admin UI. The classifier prompt was:

```
You are the brain of Flowr AI. Classify the user's message into exactly one of these categories:

1. FAST_SIMPLE: Greetings, slang greetings (e.g., broski, whatsup), casual chat, simple facts, quick questions, or non-technical follow-ups.
2. MEDIUM_THINKING: General knowledge questions, short creative writing, or moderately complex explanations.
3. COMPLEX_THINKING: Deep reasoning, coding requests, complex math, strategic planning, or creative long-form writing.
4. IMAGE_GEN: Requests to generate, draw, create, or visualize an image.
5. WEB_SEARCH: Questions about current events, news, specific people/companies, or requests to "search the web".
6. TOOL_CALLING: Requests to create, edit, delete, move, or modify notes, folders, tasks, or workspace items.
7. CODING: Programming, software architecture, debugging, or SQL.
8. DEEP_RESEARCH: Complex research queries (usually triggered by /research tag).
9. AUDIO_VOICE: Requests to transcribe, speak, or handle audio (if explicitly mentioned).

Respond with ONLY the category name.

User Message:
```

The old TOOL_CALLING system prompt was:
```
You are a workspace assistant. You can list, create, update, and delete notes/folders. When a user asks to modify a note by title, use list_notes first to find its ID. Always confirm actions.
```

The old IMAGE_GEN system prompt was:
```
You are a creative artist. Generate high-quality images based on user prompts.
```

**These are starting points only — edit them however you want in admin.**

---

## Self-Review

**Spec coverage:**
- [x] Remove `DEFAULT_CLASSIFICATION_PROMPT` — Task 2 + 3
- [x] Remove `DEFAULT_KEYWORDS` — Task 2 + 3
- [x] Remove `FAST_SIMPLE` fallback — Task 3
- [x] Remove `MAPS_KEYWORDS` / maps-override — Task 3
- [x] Remove hardcoded `TOOL_CALLING` system prompt — Task 4
- [x] Remove hardcoded `IMAGE_GEN` system prompt — Task 4
- [x] Remove `"CRITICAL: Provide ONLY..."` global prepend — Task 4
- [x] Remove hardcoded vision prompts — Task 4
- [x] Remove `MODEL_MAP` alias in Cloudflare — Task 6
- [x] Raise Gemini timeout 15s → 30s — Task 5
- [x] Remove `"Analyze this."` fallback — Task 5
- [x] Add Cloudflare 30s timeout — Task 6
- [x] Add Pollinations 30s timeout — Task 6
- [x] Log Groq 429 explicitly — Task 7
- [x] Keep `TAG_CATEGORY_MAP` (agreed to keep) — unchanged
- [x] Keep `FAILURE_CACHE_MS` (agreed to keep) — unchanged
- [x] Keep Date/Time injection — unchanged
- [x] Keep Gemma formatting workaround — unchanged
- [x] Keep `CATEGORY_LABELS` in compilePrompt.ts (cosmetic, not behavior) — unchanged
- [x] Keep "System Overload" message — kept exactly

**Placeholder scan:** No TBDs or TODOs. All code blocks are complete.

**Type consistency:** `ClassifyResult.category` changed from `IntentCategory` to `IntentCategory | null` — chainRouter.ts handles null in Task 4 Step 4 before using the value.
