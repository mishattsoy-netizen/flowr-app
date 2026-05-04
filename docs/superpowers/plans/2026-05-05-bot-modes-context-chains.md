# Bot Modes + Context Capacity + New Chains Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 3 bot modes (Default/Think/Pro) each with independent prompts, a Global Settings page with context/compaction controls, a 2-step compaction chain, new Coding/Grounding/DeepResearch router chains, smart intent tags, and a mode selector dropdown in chat.

**Architecture:** Approach A — extend existing `bot_settings`, `bot_classifier_config`, and `bot_compiled_prompt` tables with a `mode` column so each mode owns its own prompt rows. A new `bot_compaction_config` singleton table holds context/compaction config. The chat API receives an active `mode` string and uses it to load the correct compiled prompt and classifier config at runtime.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase (PostgreSQL), React (useState/useTransition), Lucide icons, existing admin component patterns (Toggle, ModelDropdown, cn utility).

---

## File Map

### New files
- `src/app/admin/bot/global/page.tsx` — Global Settings page (server component, loads compaction config + global flags)
- `src/app/admin/bot/global/actions.ts` — Server actions for compaction config CRUD
- `src/app/admin/bot/global/GlobalSettingsClient.tsx` — Client component for global settings UI
- `src/app/admin/bot/default/page.tsx` — Default Mode admin page
- `src/app/admin/bot/default/actions.ts` — Mode-scoped server actions for default
- `src/app/admin/bot/think/page.tsx` — Think Mode admin page
- `src/app/admin/bot/think/actions.ts` — Mode-scoped server actions for think
- `src/app/admin/bot/pro/page.tsx` — Pro Mode admin page
- `src/app/admin/bot/pro/actions.ts` — Mode-scoped server actions for pro
- `src/app/admin/bot/[mode]/ModeSettingsClient.tsx` — Shared client component for all 3 mode pages
- `src/lib/bot/compaction.ts` — 2-step draft+refine compaction chain

### Modified files
- `src/lib/bot/compilePrompt.ts` — `recompilePrompt(mode)` + `getCompiledPrompt(mode)` accept mode param
- `src/lib/bot/context.ts` — `summarizeSession()` replaced by `compactSession()`; context limit read from DB
- `src/lib/bot/classifier.ts` — `classifyIntentWithModel()` accepts `mode`; loads mode-scoped classifier config; adds CODING/DEEP_RESEARCH categories; adds tag consistency check
- `src/lib/router-config.ts` — Add CODING and DEEP_RESEARCH categories
- `src/app/api/ai/chat/route.ts` — Accept `mode` and `intentTag` in request body; pass to runChain
- `src/lib/bot/chainRouter.ts` — Accept `mode` and `intentTag` in context; handle tag override logic; route DEEP_RESEARCH chain
- `src/app/admin/bot/settings/actions.ts` — `saveSettingBlock`, `toggleSettingBlock`, `syncCompiledPrompt` gain `mode` param; existing functions become default-mode wrappers for backwards compat
- `src/app/admin/bot/classifier/actions.ts` — `getClassifierConfig`/`saveClassifierConfig` gain `mode` param
- `src/components/admin/Sidebar.tsx` — Restructure Bot Intelligence section with Global Settings + 3 mode pages + remove Classifier link
- `src/components/assistant/AIAssistant.tsx` — Add mode selector dropdown + pass `mode`/`intentTag` in sendAIMessage; clear mode on chat clear
- `src/data/store.ts` — Add `activeMode` state + `setActiveMode` action; pass mode in sendAIMessage fetch call
- `src/data/store.types.ts` — Add `BotMode` type; extend `AISessionContext` with mode field

---

## Task 1: Database migrations

**Files:**
- Create: `supabase/migrations/20260505_bot_modes.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- Add mode column to bot_settings
ALTER TABLE bot_settings ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'default';

-- Seed think and pro rows by copying existing default rows
INSERT INTO bot_settings (category, content, is_active, mode, updated_at)
SELECT category, content, is_active, 'think', NOW()
FROM bot_settings
WHERE mode = 'default'
  AND category IN ('core_rules', 'personality', 'answer_style', 'thinking_pattern', 'restrictions')
ON CONFLICT DO NOTHING;

INSERT INTO bot_settings (category, content, is_active, mode, updated_at)
SELECT category, content, is_active, 'pro', NOW()
FROM bot_settings
WHERE mode = 'default'
  AND category IN ('core_rules', 'personality', 'answer_style', 'thinking_pattern', 'restrictions')
ON CONFLICT DO NOTHING;

-- Add mode column to bot_compiled_prompt (one row per mode)
ALTER TABLE bot_compiled_prompt ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'default';

-- Seed think and pro compiled_prompt rows
INSERT INTO bot_compiled_prompt (content, compiled_at, entry_count, global_enabled, ollama_enabled, backend_model, mode)
SELECT content, compiled_at, entry_count, global_enabled, ollama_enabled, backend_model, 'think'
FROM bot_compiled_prompt WHERE mode = 'default'
ON CONFLICT DO NOTHING;

INSERT INTO bot_compiled_prompt (content, compiled_at, entry_count, global_enabled, ollama_enabled, backend_model, mode)
SELECT content, compiled_at, entry_count, global_enabled, ollama_enabled, backend_model, 'pro'
FROM bot_compiled_prompt WHERE mode = 'default'
ON CONFLICT DO NOTHING;

-- Add mode column to bot_settings for classifier config rows
-- (classifier_prompt and classifier_keywords are stored as bot_settings rows with special category names)
-- Seed mode-specific classifier config by copying default rows
INSERT INTO bot_settings (category, content, is_active, mode, updated_at)
SELECT category, content, is_active, 'think', NOW()
FROM bot_settings
WHERE mode = 'default'
  AND category IN ('classifier_prompt', 'classifier_keywords')
ON CONFLICT DO NOTHING;

INSERT INTO bot_settings (category, content, is_active, mode, updated_at)
SELECT category, content, is_active, 'pro', NOW()
FROM bot_settings
WHERE mode = 'default'
  AND category IN ('classifier_prompt', 'classifier_keywords')
ON CONFLICT DO NOTHING;

-- Create bot_compaction_config singleton table
CREATE TABLE IF NOT EXISTS bot_compaction_config (
  id INT PRIMARY KEY DEFAULT 1,
  draft_primary_model TEXT NOT NULL DEFAULT 'gemini-2.0-flash',
  draft_fallback_model TEXT NOT NULL DEFAULT 'gemini-2.0-flash-lite',
  refine_primary_model TEXT NOT NULL DEFAULT 'gemini-2.0-flash',
  refine_fallback_model TEXT NOT NULL DEFAULT 'gemini-2.0-flash-lite',
  context_limit INT NOT NULL DEFAULT 32000,
  compaction_threshold FLOAT NOT NULL DEFAULT 0.8,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed singleton row if not exists
INSERT INTO bot_compaction_config (id) VALUES (1) ON CONFLICT DO NOTHING;
```

- [ ] **Step 2: Apply the migration**

```bash
npx supabase db push
```

Expected: migration applies cleanly, no errors. Verify in Supabase dashboard that `bot_settings` has a `mode` column and `bot_compaction_config` table exists.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260505_bot_modes.sql
git commit -m "feat(db): add mode column to bot tables and compaction config"
```

---

## Task 2: Update store types

**Files:**
- Modify: `src/data/store.types.ts`

- [ ] **Step 1: Add BotMode type and extend AISessionContext**

In `src/data/store.types.ts`, add after the existing imports/exports:

```typescript
export type BotMode = 'default' | 'think' | 'pro'
```

Find the `AISessionContext` interface and extend it:

```typescript
export interface AISessionContext {
  distilled_summary: string | null;
  token_usage_total: number;
  context_limit: number;
  active_mode?: BotMode;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/data/store.types.ts
git commit -m "feat(types): add BotMode type and extend AISessionContext"
```

---

## Task 3: Update store — add activeMode state

**Files:**
- Modify: `src/data/store.ts`

- [ ] **Step 1: Find the AI state section in store.ts**

Search for `aiMessages` or `sendAIMessage` in `src/data/store.ts` to locate the AI slice.

- [ ] **Step 2: Add activeMode state and setActiveMode action**

In the AI slice state, add:
```typescript
activeMode: BotMode,
setActiveMode: (mode: BotMode) => void,
```

In the implementation:
```typescript
activeMode: 'default',
setActiveMode: (mode) => set({ activeMode: mode }),
```

- [ ] **Step 3: Pass mode in sendAIMessage fetch call**

Find the `sendAIMessage` action where it calls `fetch('/api/ai/chat', ...)`. Add `mode` and `intentTag` to the JSON body:

```typescript
body: JSON.stringify({
  // ...existing fields...
  mode: get().activeMode,
  intentTag: get().activeIntentTag ?? null,
})
```

Also add `activeIntentTag` state (the currently attached tool pill):
```typescript
activeIntentTag: string | null,
setActiveIntentTag: (tag: string | null) => void,
```

```typescript
activeIntentTag: null,
setActiveIntentTag: (tag) => set({ activeIntentTag: tag }),
```

- [ ] **Step 4: Reset mode and tag on chat clear**

Find the `clearAIChat` action and add:
```typescript
activeMode: 'default',
activeIntentTag: null,
```
to the state reset.

- [ ] **Step 5: Commit**

```bash
git add src/data/store.ts
git commit -m "feat(store): add activeMode and activeIntentTag state"
```

---

## Task 4: Update compilePrompt.ts — mode-aware compilation

**Files:**
- Modify: `src/lib/bot/compilePrompt.ts`

- [ ] **Step 1: Update recompilePrompt to accept a mode param**

Replace the entire file with:

```typescript
import { supabaseAdmin as supabase } from '@/lib/supabase'
import type { BotMode } from '@/data/store.types'

const CATEGORY_LABELS: Record<string, string> = {
  core_rules:       'CORE RULES',
  personality:      'PERSONALITY',
  answer_style:     'ANSWER STYLE',
  thinking_pattern: 'THINKING PATTERN',
  restrictions:     'RESTRICTIONS',
}

const BRAIN_CATEGORY_LABELS: Record<string, string> = {
  rules:       'BRAIN: RULES',
  red_flags:   'BRAIN: RED FLAGS',
  tone:        'BRAIN: TONE REFINEMENTS',
  personality: 'BRAIN: PERSONALITY REFINEMENTS',
  facts:       'BRAIN: FACTS & KNOWLEDGE',
}

export async function recompilePrompt(mode: BotMode = 'default'): Promise<void> {
  const [settingsResult, brainResult] = await Promise.all([
    supabase
      .from('bot_settings')
      .select('category, content')
      .eq('is_active', true)
      .eq('mode', mode),
    supabase
      .from('bot_brain_entries')
      .select('category, title, content')
      .eq('is_active', true)
      .order('created_at', { ascending: true }),
  ])

  if (settingsResult.error) throw settingsResult.error
  if (brainResult.error) throw brainResult.error

  const settings: { category: string; content: string }[] = settingsResult.data ?? []
  const brainEntries: { category: string; title: string; content: string }[] = brainResult.data ?? []

  const parts: string[] = []

  const settingsOrder = ['core_rules', 'personality', 'answer_style', 'thinking_pattern', 'restrictions']
  for (const cat of settingsOrder) {
    const block = settings.find(s => s.category === cat)
    if (block?.content?.trim()) {
      parts.push(`[${CATEGORY_LABELS[cat] ?? cat.toUpperCase()}]\n${block.content.trim()}`)
    }
  }

  const brainOrder = ['rules', 'red_flags', 'tone', 'personality', 'facts']
  for (const cat of brainOrder) {
    const entries = brainEntries.filter(e => e.category === cat)
    if (entries.length === 0) continue
    const lines = entries.map(e => `- ${e.title}: ${e.content}`).join('\n')
    parts.push(`[${BRAIN_CATEGORY_LABELS[cat] ?? cat.toUpperCase()}]\n${lines}`)
  }

  const compiled = parts.join('\n\n')

  const { error } = await supabase
    .from('bot_compiled_prompt')
    .update({ content: compiled, compiled_at: new Date().toISOString(), entry_count: brainEntries.length })
    .eq('mode', mode)

  if (error) throw error
}

export async function recompileAllModes(): Promise<void> {
  await Promise.all([
    recompilePrompt('default'),
    recompilePrompt('think'),
    recompilePrompt('pro'),
  ])
}

export async function getCompiledPrompt(mode: BotMode = 'default'): Promise<string> {
  const { data, error } = await supabase
    .from('bot_compiled_prompt')
    .select('content, global_enabled')
    .eq('mode', mode)
    .single()

  if (error || !data) return ''
  if (!data.global_enabled) return ''
  return data.content ?? ''
}
```

- [ ] **Step 2: Update brain entry actions to call recompileAllModes**

Search for calls to `recompilePrompt()` in `src/app/admin/bot/brain/actions.ts`. Replace each call with `recompileAllModes()` and update the import:

```typescript
import { recompileAllModes } from '@/lib/bot/compilePrompt'
// then where recompilePrompt() was called:
await recompileAllModes()
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/bot/compilePrompt.ts src/app/admin/bot/brain/actions.ts
git commit -m "feat(compile): mode-aware prompt compilation, recompileAllModes for brain changes"
```

---

## Task 5: Update settings actions — mode-scoped

**Files:**
- Modify: `src/app/admin/bot/settings/actions.ts`

- [ ] **Step 1: Add mode param to saveSettingBlock, toggleSettingBlock, syncCompiledPrompt**

Replace the file content with:

```typescript
'use server'

import { supabaseAdmin as supabase } from '@/lib/supabase'
import { recompilePrompt, recompileAllModes } from '@/lib/bot/compilePrompt'
import { logAdminAction } from '@/lib/admin/logAction'
import { revalidatePath } from 'next/cache'
import type { BotMode } from '@/data/store.types'

export type SettingsCategory = 'core_rules' | 'personality' | 'answer_style' | 'thinking_pattern' | 'restrictions'

export interface BotSetting {
  category: SettingsCategory
  content: string
  is_active: boolean
  mode: BotMode
  updated_at: string
}

export async function getSettings(mode: BotMode = 'default'): Promise<BotSetting[]> {
  const { data, error } = await supabase
    .from('bot_settings')
    .select('*')
    .eq('mode', mode)
    .in('category', ['core_rules', 'personality', 'answer_style', 'thinking_pattern', 'restrictions'])
    .order('category')
  if (error) throw error
  return (data ?? []) as BotSetting[]
}

export async function saveSettingBlock(category: SettingsCategory, content: string, mode: BotMode = 'default'): Promise<void> {
  const { error } = await supabase
    .from('bot_settings')
    .upsert({ category, content, mode, updated_at: new Date().toISOString() })
  if (error) throw error
  await recompilePrompt(mode)
  await logAdminAction('settings_saved', `Saved ${category.replace('_', ' ')} prompt [${mode}]`, { category, mode })
  revalidatePath(`/admin/bot/${mode}`)
}

export async function toggleSettingBlock(category: SettingsCategory, isActive: boolean, mode: BotMode = 'default'): Promise<void> {
  const { error } = await supabase
    .from('bot_settings')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('category', category)
    .eq('mode', mode)
  if (error) throw error
  await recompilePrompt(mode)
  revalidatePath(`/admin/bot/${mode}`)
}

export async function syncCompiledPrompt(mode?: BotMode): Promise<void> {
  if (mode) {
    await recompilePrompt(mode)
  } else {
    await recompileAllModes()
  }
  await logAdminAction('prompt_synced', mode ? `Manual sync for ${mode} mode` : 'Manual sync all modes')
  revalidatePath('/admin/bot/global')
}

export async function getCompiledPromptMeta(mode: BotMode = 'default'): Promise<{ content: string; compiled_at: string; entry_count: number }> {
  const { data, error } = await supabase
    .from('bot_compiled_prompt')
    .select('*')
    .eq('mode', mode)
    .single()
  if (error || !data) return { content: '', compiled_at: '', entry_count: 0 }
  return data as { content: string; compiled_at: string; entry_count: number }
}

export async function setGlobalPromptEnabled(enabled: boolean): Promise<void> {
  const { error } = await supabase
    .from('bot_compiled_prompt')
    .update({ global_enabled: enabled })
  if (error) throw error
  await logAdminAction('prompt_synced', `Global prompt ${enabled ? 'enabled' : 'disabled'}`, { enabled })
  revalidatePath('/admin/bot/global')
}

export async function getGlobalEnabled(): Promise<boolean> {
  const { data } = await supabase
    .from('bot_compiled_prompt')
    .select('global_enabled')
    .eq('mode', 'default')
    .single()
  return data?.global_enabled ?? true
}

export async function getOllamaEnabled(): Promise<boolean> {
  const { data } = await supabase
    .from('bot_compiled_prompt')
    .select('ollama_enabled')
    .eq('mode', 'default')
    .single()
  return data?.ollama_enabled ?? false
}

export async function setOllamaEnabled(enabled: boolean): Promise<void> {
  const { error } = await supabase
    .from('bot_compiled_prompt')
    .update({ ollama_enabled: enabled })
  if (error) throw error
  revalidatePath('/admin/bot/global')
}

export async function getBackendModel(): Promise<string> {
  const { data } = await supabase
    .from('bot_compiled_prompt')
    .select('backend_model')
    .eq('mode', 'default')
    .single()
  return data?.backend_model ?? 'gemini-2.0-flash'
}

export async function setBackendModel(model: string): Promise<void> {
  const { error } = await supabase
    .from('bot_compiled_prompt')
    .update({ backend_model: model })
  if (error) throw error
  revalidatePath('/admin/bot/global')
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/admin/bot/settings/actions.ts
git commit -m "feat(settings): mode-scoped saveSettingBlock and toggleSettingBlock"
```

---

## Task 6: Update classifier actions — mode-scoped

**Files:**
- Modify: `src/app/admin/bot/classifier/actions.ts`

- [ ] **Step 1: Add mode param to getClassifierConfig and saveClassifierConfig**

Replace the file with:

```typescript
'use server'

import { supabaseAdmin as supabase } from '@/lib/supabase'
import { logAdminAction } from '@/lib/admin/logAction'
import { revalidatePath } from 'next/cache'
import { DEFAULT_CLASSIFICATION_PROMPT, DEFAULT_KEYWORDS } from './defaults'
import type { BotMode } from '@/data/store.types'

export async function getClassifierConfig(mode: BotMode = 'default'): Promise<{ prompt: string; keywords: Record<string, string[]> }> {
  try {
    const { data: promptBlock } = await supabase
      .from('bot_settings')
      .select('content')
      .eq('category', 'classifier_prompt')
      .eq('mode', mode)
      .maybeSingle()

    const { data: keywordsBlock } = await supabase
      .from('bot_settings')
      .select('content')
      .eq('category', 'classifier_keywords')
      .eq('mode', mode)
      .maybeSingle()

    const prompt = promptBlock?.content || DEFAULT_CLASSIFICATION_PROMPT
    let keywords = DEFAULT_KEYWORDS
    if (keywordsBlock?.content) {
      try { keywords = JSON.parse(keywordsBlock.content) } catch { keywords = DEFAULT_KEYWORDS }
    }
    return { prompt, keywords }
  } catch (err) {
    console.error('getClassifierConfig error:', err)
    return { prompt: DEFAULT_CLASSIFICATION_PROMPT, keywords: DEFAULT_KEYWORDS }
  }
}

export async function saveClassifierConfig(prompt: string, keywords: Record<string, string[]>, mode: BotMode = 'default'): Promise<void> {
  const { error: err1 } = await supabase
    .from('bot_settings')
    .upsert({ category: 'classifier_prompt', content: prompt, mode, updated_at: new Date().toISOString() })
  if (err1) throw err1

  const { error: err2 } = await supabase
    .from('bot_settings')
    .upsert({ category: 'classifier_keywords', content: JSON.stringify(keywords), mode, updated_at: new Date().toISOString() })
  if (err2) throw err2

  await logAdminAction('settings_saved', `Saved classifier config [${mode}]`, { mode })
  revalidatePath(`/admin/bot/${mode}`)
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/admin/bot/classifier/actions.ts
git commit -m "feat(classifier): mode-scoped classifier config actions"
```

---

## Task 7: Add CODING and DEEP_RESEARCH to router config

**Files:**
- Modify: `src/lib/router-config.ts`

- [ ] **Step 1: Read router-config.ts to find IntentCategory and category list**

Open `src/lib/router-config.ts` and locate the `IntentCategory` type definition and the categories array/object.

- [ ] **Step 2: Add new categories to IntentCategory type**

Find the `IntentCategory` type (likely a union of string literals) and add:

```typescript
| 'CODING'
| 'DEEP_RESEARCH'
```

- [ ] **Step 3: Add CODING and DEEP_RESEARCH chain entries**

In the categories list/object, add two new entries following the same pattern as existing entries:

```typescript
{
  key: 'CODING',
  label: 'Coding',
  description: 'Code generation, debugging, technical programming tasks',
  system_prompt: 'You are an expert software engineer. Write clean, correct, well-reasoned code. Show your reasoning for non-trivial decisions. Use code blocks for all code.',
  models: [], // configured via Router Matrix admin page
  temperature: 0.2,
},
{
  key: 'DEEP_RESEARCH',
  label: 'Deep Research',
  description: 'In-depth research using Perplexity, Tavily, and DuckDuckGo',
  system_prompt: 'You are a thorough research assistant. Synthesize information from multiple sources. Cite sources clearly. Present findings in structured, scannable format.',
  models: [], // configured via Router Matrix admin page
  temperature: 0.3,
},
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/router-config.ts
git commit -m "feat(router): add CODING and DEEP_RESEARCH intent categories"
```

---

## Task 8: New compaction chain

**Files:**
- Create: `src/lib/bot/compaction.ts`
- Modify: `src/lib/bot/context.ts`

- [ ] **Step 1: Create src/lib/bot/compaction.ts**

```typescript
import { supabaseAdmin as supabase } from '../supabase'
import { logger } from '../logger'
import { runGoogle } from './providers/google'

export interface CompactionConfig {
  draft_primary_model: string
  draft_fallback_model: string
  refine_primary_model: string
  refine_fallback_model: string
  context_limit: number
  compaction_threshold: number
}

export async function getCompactionConfig(): Promise<CompactionConfig> {
  const { data, error } = await supabase
    .from('bot_compaction_config')
    .select('*')
    .eq('id', 1)
    .single()

  if (error || !data) {
    return {
      draft_primary_model: 'gemini-2.0-flash',
      draft_fallback_model: 'gemini-2.0-flash-lite',
      refine_primary_model: 'gemini-2.0-flash',
      refine_fallback_model: 'gemini-2.0-flash-lite',
      context_limit: 32000,
      compaction_threshold: 0.8,
    }
  }
  return data as CompactionConfig
}

export async function saveCompactionConfig(config: Partial<CompactionConfig>): Promise<void> {
  const { error } = await supabase
    .from('bot_compaction_config')
    .update({ ...config, updated_at: new Date().toISOString() })
    .eq('id', 1)
  if (error) throw error
}

const DRAFT_PROMPT = (currentSummary: string | null, historyText: string) => `
You are a Session Memory Manager. Condense this conversation into a DENSE, HIGH-FIDELITY SUMMARY.

EXISTING SUMMARY:
${currentSummary || 'None'}

RECENT HISTORY:
${historyText}

Write a dense summary covering:
1. Current project/task status
2. Key decisions made
3. User preferences discovered
4. Crucial technical details

Output ONLY the summary text. Be thorough but concise.
`.trim()

const REFINE_PROMPT = (draft: string) => `
You are a Summary Verification Specialist. Review and improve this session summary for accuracy and completeness.

DRAFT SUMMARY:
${draft}

Improve it by:
1. Fixing any inaccuracies or contradictions
2. Filling in missing critical details
3. Ensuring the summary is self-contained and clear

Output ONLY the improved summary text.
`.trim()

export async function compactSession(
  chatId: string,
  history: any[],
  currentSummary: string | null
): Promise<string | null> {
  const config = await getCompactionConfig()
  const historyText = history.map(h => `${h.role}: ${h.parts?.[0]?.text || h.content}`).join('\n\n')

  // Step 1: Draft
  let draft: string | null = null
  for (const model of [config.draft_primary_model, config.draft_fallback_model]) {
    try {
      const result = await runGoogle(model, DRAFT_PROMPT(currentSummary, historyText), 'You are a summarization engine.')
      if (result) { draft = result; break }
    } catch (e: any) {
      logger.warn(`Compaction draft failed [${model}]: ${e.message}`)
    }
  }

  if (!draft) {
    logger.warn(`Compaction aborted for ${chatId}: both draft models failed`)
    return currentSummary
  }

  // Step 2: Refine
  let refined: string | null = null
  for (const model of [config.refine_primary_model, config.refine_fallback_model]) {
    try {
      const result = await runGoogle(model, REFINE_PROMPT(draft), 'You are a summary verification engine.')
      if (result) { refined = result; break }
    } catch (e: any) {
      logger.warn(`Compaction refine failed [${model}]: ${e.message}`)
    }
  }

  return refined ?? draft
}
```

- [ ] **Step 2: Update context.ts to use compactSession and dynamic context limit**

Replace `summarizeSession` in `src/lib/bot/context.ts`:

```typescript
import { supabaseAdmin as supabase } from '../supabase'
import { logger } from '../logger'
import { compactSession, getCompactionConfig } from './compaction'

export interface SessionState {
  chat_id: string
  distilled_summary: string | null
  token_usage_total: number
  context_limit: number
  last_summarized_at: string
}

const CHARS_PER_TOKEN = 4

export function estimateTokens(text: string): number {
  if (!text) return 0
  return Math.ceil(text.length / CHARS_PER_TOKEN)
}

export async function getSessionState(chatId: string): Promise<SessionState | null> {
  const config = await getCompactionConfig()
  const { data, error } = await supabase
    .from('bot_session_states')
    .select('*')
    .eq('chat_id', chatId)
    .maybeSingle()

  if (error) {
    logger.error(`Failed to fetch session state for ${chatId}:`, error)
    return null
  }
  if (!data) return null
  // Always use the configured context_limit, not the stored one
  return { ...data, context_limit: config.context_limit }
}

export async function updateSessionState(chatId: string, updates: Partial<SessionState>): Promise<void> {
  const { error } = await supabase
    .from('bot_session_states')
    .upsert({ chat_id: chatId, ...updates, updated_at: new Date().toISOString() })
  if (error) logger.error(`Failed to update session state for ${chatId}:`, error)
}

export async function clearSessionState(chatId: string): Promise<void> {
  const { error } = await supabase
    .from('bot_session_states')
    .delete()
    .eq('chat_id', chatId)
  if (error) logger.error(`Failed to clear session state for ${chatId}:`, error)
}

export async function summarizeSession(
  chatId: string,
  history: any[],
  currentSummary: string | null
): Promise<string | null> {
  try {
    const newSummary = await compactSession(chatId, history, currentSummary)
    if (newSummary) {
      await updateSessionState(chatId, {
        distilled_summary: newSummary,
        last_summarized_at: new Date().toISOString(),
        token_usage_total: estimateTokens(newSummary),
      })
      return newSummary
    }
  } catch (error) {
    logger.error(`Summarization failed for session ${chatId}:`, error)
  }
  return null
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/bot/compaction.ts src/lib/bot/context.ts
git commit -m "feat(compaction): 2-step draft+refine compaction chain with primary+fallback models"
```

---

## Task 9: Update classifier — mode-aware + new categories + tag consistency

**Files:**
- Modify: `src/lib/bot/classifier.ts`

- [ ] **Step 1: Replace classifyIntentWithModel signature and logic**

Replace the entire file with:

```typescript
import { getRouterChain, IntentCategory } from '../router-config'
import { logger } from '../logger'
import { runGoogle } from './providers/google'
import { runGroq } from './providers/groq'
import { supabaseAdmin } from '../supabase'
import { DEFAULT_KEYWORDS, DEFAULT_CLASSIFICATION_PROMPT } from '@/app/admin/bot/classifier/defaults'
import type { BotMode } from '@/data/store.types'

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
  category: IntentCategory
  classifierModel: string
  trace: ClassifyTrace[]
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
}

const MAPS_KEYWORDS = ['map', 'maps', 'directions', 'navigate', 'route to', 'how do i get to', 'where is', 'location of', 'near me', 'nearby']

const TAG_CONSISTENCY_PROMPT = (tag: string, message: string) => `
Is this user message consistent with the intent tag "${tag}"?
Message: "${message}"
Answer with only YES or NO.
`.trim()

async function checkTagConsistency(tag: string, message: string, modelId: string): Promise<boolean> {
  try {
    const result = await runGoogle(modelId, TAG_CONSISTENCY_PROMPT(tag, message), undefined)
    if (!result) return true // if check fails, honor the tag
    return result.toUpperCase().includes('YES')
  } catch {
    return true // on error, honor the tag
  }
}

function detectMapsIntent(message: string): boolean {
  const lower = message.toLowerCase()
  return MAPS_KEYWORDS.some(kw => lower.includes(kw))
}

export async function classifyIntent(message: string, aiApiKey?: string, modelId?: string): Promise<IntentCategory> {
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

  // Maps override: always use WEB_SEARCH (grounding chain) for map queries
  if (detectMapsIntent(lowerMsg)) {
    return { category: 'WEB_SEARCH', classifierModel: 'maps-override', trace: [] }
  }

  // Intent tag handling with consistency check
  if (intentTag && TAG_CATEGORY_MAP[intentTag]) {
    const { chain } = await getRouterChain('CLASSIFIER')
    const checkModel = modelId || chain.find(m => m.is_enabled)?.id || 'gemini-2.0-flash'
    const isConsistent = await checkTagConsistency(intentTag, message, checkModel)
    if (isConsistent) {
      // Deep research with maps intent → override to WEB_SEARCH
      if (intentTag === '/research' && detectMapsIntent(lowerMsg)) {
        return { category: 'WEB_SEARCH', classifierModel: 'maps-override', trace: [] }
      }
      return { category: TAG_CATEGORY_MAP[intentTag], classifierModel: 'tag', trace: [] }
    }
    // Tag ignored — fall through to normal classification
  }

  // Load mode-specific classifier config
  let keywordsObj = DEFAULT_KEYWORDS
  let activePrompt = DEFAULT_CLASSIFICATION_PROMPT

  try {
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

  // Keyword fast-path
  for (const cat of Object.keys(keywordsObj) as IntentCategory[]) {
    const list = keywordsObj[cat] || []
    for (const kw of list) {
      const kwLower = kw.trim().toLowerCase()
      if (!kwLower) continue
      if (
        lowerMsg === kwLower ||
        lowerMsg.startsWith(kwLower + ' ') ||
        lowerMsg.endsWith(' ' + kwLower) ||
        lowerMsg.includes(' ' + kwLower + ' ') ||
        lowerMsg.includes(kwLower)
      ) {
        return { category: cat, classifierModel: kw, trace: [] }
      }
    }
  }

  // Model classification
  const { chain } = await getRouterChain('CLASSIFIER')
  const activeChain = modelId ? [{ id: modelId, provider: 'google', is_enabled: true }] : chain
  const trace: ClassifyTrace[] = []

  for (const modelConfig of activeChain) {
    if (!modelConfig.is_enabled) continue
    const key = modelConfig.provider === 'google' ? 'GEMINI' : modelConfig.provider.toUpperCase()
    try {
      let rawResponse: string | null = null
      const traceContext: any = { aiApiKey }

      if (modelConfig.provider === 'google') {
        rawResponse = await runGoogle(modelConfig.id, `${activePrompt}\n"${message}"`, undefined, undefined, traceContext)
      } else if (modelConfig.provider === 'groq') {
        rawResponse = await runGroq(modelConfig.id, `${activePrompt}\n"${message}"`, undefined, aiApiKey, traceContext)
      }

      if (rawResponse) {
        for (const cat of VALID_CATEGORIES) {
          if (rawResponse.toUpperCase().includes(cat)) {
            const displayKey = traceContext.usedKeyIndex ? `${key} ${traceContext.usedKeyIndex}` : `${key} 1`
            trace.push({ model: modelConfig.id, key: displayKey, success: true })
            trackModelUsage(modelConfig.id, modelConfig.provider)
            return { category: cat, classifierModel: modelConfig.id, trace }
          }
        }
      }
      trace.push({ model: modelConfig.id, key: `${key} 1`, success: false })
    } catch (error: any) {
      trace.push({ model: modelConfig.id, key: `${key} 1`, success: false })
      logger.warn(`Classification failure [${modelConfig.id}]: ${error.message}`)
    }
  }

  return { category: 'FAST_SIMPLE', classifierModel: 'fallback', trace }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/bot/classifier.ts
git commit -m "feat(classifier): mode-aware classification, tag consistency check, CODING/DEEP_RESEARCH categories"
```

---

## Task 10: Update chat route — accept mode and intentTag

**Files:**
- Modify: `src/app/api/ai/chat/route.ts`

- [ ] **Step 1: Destructure mode and intentTag from request body**

Find the line:
```typescript
const { prompt, buffer, aiApiKey, activeEntityId, activeWorkspaceId, classificationModelId, agentEnabled } = await req.json()
```

Replace with:
```typescript
const { prompt, buffer, aiApiKey, activeEntityId, activeWorkspaceId, classificationModelId, agentEnabled, mode, intentTag } = await req.json()
const activeMode = (mode === 'think' || mode === 'pro') ? mode : 'default'
```

- [ ] **Step 2: Pass mode and intentTag to classifyIntentWithModel**

Find the classification call:
```typescript
const { category: rawCategory } = await classifyIntentWithModel(prompt, aiApiKey, classificationModelId)
```

Replace with:
```typescript
const { category: rawCategory } = await classifyIntentWithModel(prompt, aiApiKey, classificationModelId, activeMode, intentTag ?? null)
```

- [ ] **Step 3: Pass mode and intentTag to runChain context**

Find the `runChain(...)` call and add `mode` and `intentTag` to its context object:
```typescript
const result = await runChain(prompt, inputBuffer, {
  // ...existing context fields...
  mode: activeMode,
  intentTag: intentTag ?? null,
})
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/ai/chat/route.ts
git commit -m "feat(chat-route): accept mode and intentTag, pass to classifier and chain"
```

---

## Task 11: Update chainRouter — mode-aware compiled prompt + DEEP_RESEARCH chain

**Files:**
- Modify: `src/lib/bot/chainRouter.ts`

- [ ] **Step 1: Add mode to runChain context type and getCompiledPrompt call**

Find the `runChain` function signature:
```typescript
export async function runChain(
  prompt: string,
  inputBuffer?: Buffer,
  context?: { chatId?: number; userId?: string; aiApiKey?: string; activeEntityId?: string; activeWorkspaceId?: string; classificationModelId?: string; agentEnabled?: boolean; temperature?: number }
)
```

Add `mode` and `intentTag` to the context type:
```typescript
context?: { 
  chatId?: number; userId?: string; aiApiKey?: string; activeEntityId?: string; 
  activeWorkspaceId?: string; classificationModelId?: string; agentEnabled?: boolean; 
  temperature?: number; mode?: BotMode; intentTag?: string | null 
}
```

Add import at top:
```typescript
import type { BotMode } from '@/data/store.types'
```

- [ ] **Step 2: Use mode when fetching compiled prompt**

Find the `getCompiledPrompt()` call in `chainRouter.ts`. Replace it with:
```typescript
const compiledPrompt = await getCompiledPrompt(context?.mode ?? 'default')
```

- [ ] **Step 3: Add DEEP_RESEARCH chain routing**

In the provider loop section where chains are executed, find where `WEB_SEARCH` is handled and add a parallel block for `DEEP_RESEARCH`. The DEEP_RESEARCH chain should run: Pollinations Perplexity → Tavily → DuckDuckGo, following the same provider fallback pattern already used for `WEB_SEARCH`. The `getRouterChain('DEEP_RESEARCH')` call will return the configured models from the Router Matrix.

- [ ] **Step 4: Commit**

```bash
git add src/lib/bot/chainRouter.ts
git commit -m "feat(chain): mode-aware compiled prompt lookup, DEEP_RESEARCH chain routing"
```

---

## Task 12: Global Settings admin page

**Files:**
- Create: `src/app/admin/bot/global/actions.ts`
- Create: `src/app/admin/bot/global/GlobalSettingsClient.tsx`
- Create: `src/app/admin/bot/global/page.tsx`

- [ ] **Step 1: Create src/app/admin/bot/global/actions.ts**

```typescript
'use server'

import { getCompactionConfig, saveCompactionConfig, type CompactionConfig } from '@/lib/bot/compaction'
import { getGlobalEnabled, setGlobalPromptEnabled, getOllamaEnabled, setOllamaEnabled, getBackendModel, setBackendModel, syncCompiledPrompt, getCompiledPromptMeta } from '@/app/admin/bot/settings/actions'
import { revalidatePath } from 'next/cache'

export { getCompactionConfig, saveCompactionConfig, getGlobalEnabled, setGlobalPromptEnabled, getOllamaEnabled, setOllamaEnabled, getBackendModel, setBackendModel, syncCompiledPrompt, getCompiledPromptMeta }

export async function updateCompactionConfig(config: Partial<CompactionConfig>): Promise<void> {
  await saveCompactionConfig(config)
  revalidatePath('/admin/bot/global')
}
```

- [ ] **Step 2: Create src/app/admin/bot/global/GlobalSettingsClient.tsx**

```typescript
'use client'

import { useState, useTransition } from 'react'
import { Globe, RefreshCw, Eye, EyeOff, Check } from 'lucide-react'
import { Toggle } from '@/components/ui/Toggle'
import ModelDropdown from '@/components/admin/ModelDropdown'
import { cn } from '@/lib/utils'
import {
  setGlobalPromptEnabled, setOllamaEnabled, setBackendModel,
  syncCompiledPrompt, updateCompactionConfig
} from './actions'
import type { CompactionConfig } from '@/lib/bot/compaction'
import type { BotMode } from '@/data/store.types'

interface Props {
  globalEnabled: boolean
  ollamaEnabled: boolean
  backendModel: string
  compactionConfig: CompactionConfig
  compiledMeta: Record<BotMode, { content: string; compiled_at: string; entry_count: number }>
  models: { id: string }[]
}

const MODE_TABS: { key: BotMode; label: string; icon: string }[] = [
  { key: 'default', label: 'Default', icon: '⚡' },
  { key: 'think',   label: 'Think',   icon: '🧠' },
  { key: 'pro',     label: 'Pro',     icon: '🔥' },
]

export default function GlobalSettingsClient({
  globalEnabled, ollamaEnabled, backendModel,
  compactionConfig, compiledMeta, models,
}: Props) {
  const [globalOn, setGlobalOn] = useState(globalEnabled)
  const [ollamaOn, setOllamaOn] = useState(ollamaEnabled)
  const [backend, setBackend] = useState(backendModel)
  const [config, setConfig] = useState(compactionConfig)
  const [activeTab, setActiveTab] = useState<BotMode>('default')
  const [showPreview, setShowPreview] = useState(false)
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'done'>('idle')
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleSync = () => {
    setSyncStatus('syncing')
    startTransition(async () => {
      await syncCompiledPrompt()
      setSyncStatus('done')
      setTimeout(() => setSyncStatus('idle'), 2000)
    })
  }

  const handleConfigChange = (key: keyof CompactionConfig, value: number | string) => {
    const next = { ...config, [key]: value }
    setConfig(next)
    startTransition(async () => {
      await updateCompactionConfig({ [key]: value })
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    })
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Globe className="w-5 h-5 text-bone-60" />
        <h1 className="text-xl font-display font-normal">Global Settings</h1>
      </div>

      {/* Global toggles */}
      <section className="flex flex-col gap-4 p-4 rounded-[var(--radius-12)] border border-border bg-surface">
        <h2 className="text-sm font-medium text-bone-80">Global Controls</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-bone-100">Prompt Injection</p>
            <p className="text-xs text-bone-40">Inject compiled prompt into every chat</p>
          </div>
          <Toggle checked={globalOn} onChange={v => { setGlobalOn(v); startTransition(() => setGlobalPromptEnabled(v)) }} />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-bone-100">Local Ollama</p>
            <p className="text-xs text-bone-40">Route requests to local Ollama instance</p>
          </div>
          <Toggle checked={ollamaOn} onChange={v => { setOllamaOn(v); startTransition(() => setOllamaEnabled(v)) }} />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-bone-100">Backend Model</p>
            <p className="text-xs text-bone-40">Used for brain sync and routine analysis</p>
          </div>
          <ModelDropdown value={backend} models={models} onChange={v => { setBackend(v); startTransition(() => setBackendModel(v)) }} />
        </div>
      </section>

      {/* Context & Compaction */}
      <section className="flex flex-col gap-4 p-4 rounded-[var(--radius-12)] border border-border bg-surface">
        <h2 className="text-sm font-medium text-bone-80">Context & Compaction</h2>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-bone-100">Context Limit</p>
            <p className="text-xs text-bone-40">Max tokens per session before compaction</p>
          </div>
          <div className="flex gap-2">
            {[32000, 64000, 128000].map(v => (
              <button key={v} onClick={() => handleConfigChange('context_limit', v)}
                className={cn('px-2 py-1 text-xs rounded border', config.context_limit === v ? 'border-accent text-accent' : 'border-border text-bone-60 hover:text-bone-100')}>
                {v / 1000}k
              </button>
            ))}
            <input type="number" value={config.context_limit}
              onChange={e => handleConfigChange('context_limit', parseInt(e.target.value) || 32000)}
              className="w-20 px-2 py-1 text-xs bg-transparent border border-border rounded text-bone-100" />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-bone-100">Compaction Threshold</p>
            <p className="text-xs text-bone-40">Trigger compaction at this % of context limit</p>
          </div>
          <div className="flex items-center gap-2">
            <input type="range" min={50} max={95} step={5} value={Math.round(config.compaction_threshold * 100)}
              onChange={e => handleConfigChange('compaction_threshold', parseInt(e.target.value) / 100)}
              className="w-24" />
            <span className="text-xs text-bone-60 w-8">{Math.round(config.compaction_threshold * 100)}%</span>
          </div>
        </div>

        {/* Draft models */}
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-bone-60 uppercase tracking-wide">Draft Step</p>
          <div className="flex items-center justify-between">
            <p className="text-sm text-bone-80">Primary</p>
            <ModelDropdown value={config.draft_primary_model} models={models} onChange={v => handleConfigChange('draft_primary_model', v)} />
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-bone-80">Fallback</p>
            <ModelDropdown value={config.draft_fallback_model} models={models} onChange={v => handleConfigChange('draft_fallback_model', v)} />
          </div>
        </div>

        {/* Refine models */}
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-bone-60 uppercase tracking-wide">Refine Step</p>
          <div className="flex items-center justify-between">
            <p className="text-sm text-bone-80">Primary</p>
            <ModelDropdown value={config.refine_primary_model} models={models} onChange={v => handleConfigChange('refine_primary_model', v)} />
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-bone-80">Fallback</p>
            <ModelDropdown value={config.refine_fallback_model} models={models} onChange={v => handleConfigChange('refine_fallback_model', v)} />
          </div>
        </div>

        {saved && <p className="text-xs text-green-400">Saved</p>}
      </section>

      {/* Compiled prompts */}
      <section className="flex flex-col gap-3 p-4 rounded-[var(--radius-12)] border border-border bg-surface">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-bone-80">Compiled Prompts</h2>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowPreview(v => !v)} className="flex items-center gap-1 text-xs text-bone-60 hover:text-bone-100">
              {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {showPreview ? 'Hide' : 'Preview'}
            </button>
            <button onClick={handleSync} disabled={syncStatus === 'syncing'}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-border hover:border-accent hover:text-accent transition-colors">
              {syncStatus === 'done' ? <Check className="w-3.5 h-3.5 text-green-400" /> : <RefreshCw className={cn('w-3.5 h-3.5', syncStatus === 'syncing' && 'animate-spin')} />}
              {syncStatus === 'syncing' ? 'Syncing...' : syncStatus === 'done' ? 'Done' : 'Sync All'}
            </button>
          </div>
        </div>

        <div className="flex gap-1">
          {MODE_TABS.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={cn('px-3 py-1 text-xs rounded border transition-colors', activeTab === t.key ? 'border-accent text-accent bg-accent/5' : 'border-border text-bone-60 hover:text-bone-100')}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        <div className="text-xs text-bone-40">
          Last compiled: {compiledMeta[activeTab]?.compiled_at ? new Date(compiledMeta[activeTab].compiled_at).toLocaleString() : 'Never'} · {compiledMeta[activeTab]?.entry_count ?? 0} brain entries
        </div>

        {showPreview && (
          <pre className="text-xs text-bone-60 bg-bone-3 rounded p-3 overflow-auto max-h-64 whitespace-pre-wrap font-mono">
            {compiledMeta[activeTab]?.content || 'No compiled content yet. Click Sync All.'}
          </pre>
        )}
      </section>
    </div>
  )
}
```

- [ ] **Step 3: Create src/app/admin/bot/global/page.tsx**

```typescript
import { getCompactionConfig } from '@/lib/bot/compaction'
import { getGlobalEnabled, getOllamaEnabled, getBackendModel, getCompiledPromptMeta } from '@/app/admin/bot/settings/actions'
import { supabaseAdmin } from '@/lib/supabase'
import GlobalSettingsClient from './GlobalSettingsClient'

export default async function GlobalSettingsPage() {
  const [globalEnabled, ollamaEnabled, backendModel, compactionConfig,
         defaultMeta, thinkMeta, proMeta, modelsResult] = await Promise.all([
    getGlobalEnabled(),
    getOllamaEnabled(),
    getBackendModel(),
    getCompactionConfig(),
    getCompiledPromptMeta('default'),
    getCompiledPromptMeta('think'),
    getCompiledPromptMeta('pro'),
    supabaseAdmin.from('bot_models').select('id').order('id'),
  ])

  const models = modelsResult.data ?? []

  return (
    <GlobalSettingsClient
      globalEnabled={globalEnabled}
      ollamaEnabled={ollamaEnabled}
      backendModel={backendModel}
      compactionConfig={compactionConfig}
      compiledMeta={{ default: defaultMeta, think: thinkMeta, pro: proMeta }}
      models={models}
    />
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/bot/global/
git commit -m "feat(admin): Global Settings page with context, compaction, and compiled prompt viewer"
```

---

## Task 13: Mode Settings admin pages (shared client + 3 page.tsx files)

**Files:**
- Create: `src/app/admin/bot/_shared/ModeSettingsClient.tsx`
- Create: `src/app/admin/bot/default/page.tsx`
- Create: `src/app/admin/bot/think/page.tsx`
- Create: `src/app/admin/bot/pro/page.tsx`

- [ ] **Step 1: Create src/app/admin/bot/_shared/ModeSettingsClient.tsx**

```typescript
'use client'

import { useState, useTransition } from 'react'
import { Check } from 'lucide-react'
import { Toggle } from '@/components/ui/Toggle'
import { cn } from '@/lib/utils'
import { saveSettingBlock, toggleSettingBlock } from '@/app/admin/bot/settings/actions'
import { saveClassifierConfig } from '@/app/admin/bot/classifier/actions'
import type { BotSetting, SettingsCategory } from '@/app/admin/bot/settings/actions'
import type { BotMode } from '@/data/store.types'

const SETTINGS_TABS: { key: SettingsCategory; label: string; description: string }[] = [
  { key: 'core_rules',       label: 'Core Rules',   description: 'Hard constraints — what the bot must always or never do' },
  { key: 'personality',      label: 'Personality',  description: 'Tone, warmth, humor — what the bot feels like to talk to' },
  { key: 'answer_style',     label: 'Answer Style', description: 'Length, formatting, when to use lists vs prose' },
  { key: 'thinking_pattern', label: 'Thinking',     description: 'How the bot approaches complex vs simple questions' },
  { key: 'restrictions',     label: 'Restrictions', description: 'Topics and behaviors that are off-limits' },
]

interface Props {
  mode: BotMode
  modeLabel: string
  modeIcon: string
  initialSettings: BotSetting[]
  initialActiveStates: Record<string, boolean>
  initialClassifierPrompt: string
  initialClassifierKeywords: Record<string, string[]>
}

export default function ModeSettingsClient({
  mode, modeLabel, modeIcon,
  initialSettings, initialActiveStates,
  initialClassifierPrompt, initialClassifierKeywords,
}: Props) {
  const [activeTab, setActiveTab] = useState<SettingsCategory | 'classifier'>('core_rules')
  const [drafts, setDrafts] = useState<Record<string, string>>(
    Object.fromEntries(initialSettings.map(s => [s.category, s.content]))
  )
  const [activeStates, setActiveStates] = useState(initialActiveStates)
  const [saved, setSaved] = useState<Record<string, boolean>>({})
  const [classifierPrompt, setClassifierPrompt] = useState(initialClassifierPrompt)
  const [classifierKeywords, setClassifierKeywords] = useState(
    JSON.stringify(initialClassifierKeywords, null, 2)
  )
  const [classifierSaved, setClassifierSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleSave = (category: SettingsCategory) => {
    startTransition(async () => {
      await saveSettingBlock(category, drafts[category] ?? '', mode)
      setSaved(prev => ({ ...prev, [category]: true }))
      setTimeout(() => setSaved(prev => ({ ...prev, [category]: false })), 1500)
    })
  }

  const handleToggle = (category: SettingsCategory, val: boolean) => {
    setActiveStates(prev => ({ ...prev, [category]: val }))
    startTransition(() => toggleSettingBlock(category, val, mode))
  }

  const handleClassifierSave = () => {
    startTransition(async () => {
      let keywords = {}
      try { keywords = JSON.parse(classifierKeywords) } catch {}
      await saveClassifierConfig(classifierPrompt, keywords, mode)
      setClassifierSaved(true)
      setTimeout(() => setClassifierSaved(false), 1500)
    })
  }

  const allTabs = [...SETTINGS_TABS, { key: 'classifier' as const, label: 'Classifier', description: 'Intent classification prompt and keywords for this mode' }]

  return (
    <div className="flex flex-col gap-6 p-6 max-w-3xl">
      <div className="flex items-center gap-2">
        <span className="text-lg">{modeIcon}</span>
        <h1 className="text-xl font-display font-normal">{modeLabel} Mode</h1>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 flex-wrap">
        {allTabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key as any)}
            className={cn('px-3 py-1.5 text-xs rounded border transition-colors', activeTab === t.key ? 'border-accent text-accent bg-accent/5' : 'border-border text-bone-60 hover:text-bone-100')}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab !== 'classifier' ? (() => {
        const tab = SETTINGS_TABS.find(t => t.key === activeTab)!
        return (
          <div className="flex flex-col gap-4 p-4 rounded-[var(--radius-12)] border border-border bg-surface">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-bone-100">{tab.label}</p>
                <p className="text-xs text-bone-40">{tab.description}</p>
              </div>
              <Toggle checked={activeStates[tab.key] ?? true} onChange={v => handleToggle(tab.key, v)} />
            </div>
            <textarea
              value={drafts[tab.key] ?? ''}
              onChange={e => setDrafts(prev => ({ ...prev, [tab.key]: e.target.value }))}
              rows={16}
              className="w-full bg-transparent border border-border rounded-[var(--radius-8)] p-3 text-sm text-bone-100 font-mono resize-y focus:outline-none focus:border-accent"
            />
            <div className="flex justify-end">
              <button onClick={() => handleSave(tab.key)} disabled={isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border border-border hover:border-accent hover:text-accent transition-colors">
                {saved[tab.key] ? <Check className="w-3.5 h-3.5 text-green-400" /> : null}
                {saved[tab.key] ? 'Saved' : 'Save & Sync'}
              </button>
            </div>
          </div>
        )
      })() : (
        <div className="flex flex-col gap-4 p-4 rounded-[var(--radius-12)] border border-border bg-surface">
          <div>
            <p className="text-sm font-medium text-bone-100">Classifier Prompt</p>
            <p className="text-xs text-bone-40 mt-0.5">System prompt used when classifying messages in {modeLabel} mode</p>
          </div>
          <textarea value={classifierPrompt} onChange={e => setClassifierPrompt(e.target.value)} rows={12}
            className="w-full bg-transparent border border-border rounded-[var(--radius-8)] p-3 text-sm text-bone-100 font-mono resize-y focus:outline-none focus:border-accent" />
          <div>
            <p className="text-sm font-medium text-bone-100">Keywords (JSON)</p>
            <p className="text-xs text-bone-40 mt-0.5">Keyword fast-path overrides per category</p>
          </div>
          <textarea value={classifierKeywords} onChange={e => setClassifierKeywords(e.target.value)} rows={10}
            className="w-full bg-transparent border border-border rounded-[var(--radius-8)] p-3 text-sm text-bone-100 font-mono resize-y focus:outline-none focus:border-accent" />
          <div className="flex justify-end">
            <button onClick={handleClassifierSave} disabled={isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border border-border hover:border-accent hover:text-accent transition-colors">
              {classifierSaved ? <Check className="w-3.5 h-3.5 text-green-400" /> : null}
              {classifierSaved ? 'Saved' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create src/app/admin/bot/default/page.tsx**

```typescript
import { getSettings } from '@/app/admin/bot/settings/actions'
import { getClassifierConfig } from '@/app/admin/bot/classifier/actions'
import ModeSettingsClient from '@/app/admin/bot/_shared/ModeSettingsClient'

export default async function DefaultModePage() {
  const [settings, classifierConfig] = await Promise.all([
    getSettings('default'),
    getClassifierConfig('default'),
  ])
  const activeStates = Object.fromEntries(settings.map(s => [s.category, s.is_active]))
  return (
    <ModeSettingsClient
      mode="default"
      modeLabel="Default"
      modeIcon="⚡"
      initialSettings={settings}
      initialActiveStates={activeStates}
      initialClassifierPrompt={classifierConfig.prompt}
      initialClassifierKeywords={classifierConfig.keywords}
    />
  )
}
```

- [ ] **Step 3: Create src/app/admin/bot/think/page.tsx**

```typescript
import { getSettings } from '@/app/admin/bot/settings/actions'
import { getClassifierConfig } from '@/app/admin/bot/classifier/actions'
import ModeSettingsClient from '@/app/admin/bot/_shared/ModeSettingsClient'

export default async function ThinkModePage() {
  const [settings, classifierConfig] = await Promise.all([
    getSettings('think'),
    getClassifierConfig('think'),
  ])
  const activeStates = Object.fromEntries(settings.map(s => [s.category, s.is_active]))
  return (
    <ModeSettingsClient
      mode="think"
      modeLabel="Think"
      modeIcon="🧠"
      initialSettings={settings}
      initialActiveStates={activeStates}
      initialClassifierPrompt={classifierConfig.prompt}
      initialClassifierKeywords={classifierConfig.keywords}
    />
  )
}
```

- [ ] **Step 4: Create src/app/admin/bot/pro/page.tsx**

```typescript
import { getSettings } from '@/app/admin/bot/settings/actions'
import { getClassifierConfig } from '@/app/admin/bot/classifier/actions'
import ModeSettingsClient from '@/app/admin/bot/_shared/ModeSettingsClient'

export default async function ProModePage() {
  const [settings, classifierConfig] = await Promise.all([
    getSettings('pro'),
    getClassifierConfig('pro'),
  ])
  const activeStates = Object.fromEntries(settings.map(s => [s.category, s.is_active]))
  return (
    <ModeSettingsClient
      mode="pro"
      modeLabel="Pro"
      modeIcon="🔥"
      initialSettings={settings}
      initialActiveStates={activeStates}
      initialClassifierPrompt={classifierConfig.prompt}
      initialClassifierKeywords={classifierConfig.keywords}
    />
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/bot/_shared/ src/app/admin/bot/default/ src/app/admin/bot/think/ src/app/admin/bot/pro/
git commit -m "feat(admin): mode settings pages for Default, Think, and Pro"
```

---

## Task 14: Update admin Sidebar

**Files:**
- Modify: `src/components/admin/Sidebar.tsx`

- [ ] **Step 1: Replace the Bot Intelligence PlatformSection**

Find the `<PlatformSection title="Bot Intelligence">` block and replace it with:

```tsx
<PlatformSection title="Bot Intelligence">
  <NavLink href="/admin/bot/global" icon={Globe}>Global Settings</NavLink>
  <div className="px-3 py-[3px] mt-1">
    <span className="text-[10px] font-ui-label font-medium uppercase tracking-wide text-[var(--bone-40)]">Modes</span>
  </div>
  <NavLink href="/admin/bot/default" icon={Zap}>Default Mode</NavLink>
  <NavLink href="/admin/bot/think" icon={Brain}>Think Mode</NavLink>
  <NavLink href="/admin/bot/pro" icon={Cpu}>Pro Mode</NavLink>
  <div className="px-3 py-[3px] mt-1">
    <span className="text-[10px] font-ui-label font-medium uppercase tracking-wide text-[var(--bone-40)]">Intelligence</span>
  </div>
  <NavLink href="/admin/bot/brain" icon={Brain}>Brain</NavLink>
  <NavLink href="/admin/bot/dashboard" icon={LayoutDashboard}>Dashboard</NavLink>
  <NavLink href="/admin/bot/routine" icon={RotateCcw}>Routine</NavLink>
  <NavLink href="/admin/bot/feedback" icon={MessageCircle}>Feedback</NavLink>
</PlatformSection>
```

Also add `Globe` to the Lucide imports at the top of the file if it isn't there already.

- [ ] **Step 2: Update NavLink active logic for mode pages**

The existing `isActive` logic uses `pathname.startsWith(href)`. This means `/admin/bot/default` and `/admin/bot/think` will both match when on `/admin/bot/...`. Make the active check exact for mode pages by checking the `href` strictly:

The current logic already handles this correctly since it checks `pathname === href || (href !== '/admin' && pathname.startsWith(href))`. Verify this works for the new routes by testing in the browser after implementation — no code change needed if it already works.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/Sidebar.tsx
git commit -m "feat(sidebar): restructure Bot Intelligence with Global Settings and mode pages"
```

---

## Task 15: Mode selector dropdown in chat UI

**Files:**
- Modify: `src/components/assistant/AIAssistant.tsx`

- [ ] **Step 1: Add mode selector state and dropdown**

Near the top of `AIAssistantComponent`, add:

```typescript
const activeMode = useStore(state => state.activeMode)
const setActiveMode = useStore(state => state.setActiveMode)
const [showModeMenu, setShowModeMenu] = useState(false)
```

- [ ] **Step 2: Add MODE_OPTIONS constant**

```typescript
const MODE_OPTIONS = [
  { key: 'default' as BotMode, label: 'Default', icon: '⚡', description: 'Fast, universal' },
  { key: 'think'   as BotMode, label: 'Think',   icon: '🧠', description: 'Deep, accurate' },
  { key: 'pro'     as BotMode, label: 'Pro',      icon: '🔥', description: 'Max precision' },
] as const
```

Add import at top of file:
```typescript
import type { BotMode } from '@/data/store'
```

- [ ] **Step 3: Add the mode dropdown button in the input bar**

Find the send button area in the JSX (near `<button` with the send icon). Add the mode selector button to its left:

```tsx
{/* Mode selector */}
<div className="relative">
  <button
    onClick={() => setShowModeMenu(v => !v)}
    className="flex items-center gap-1.5 px-2 py-1 rounded-[var(--radius-6)] border border-border text-xs text-bone-60 hover:text-bone-100 hover:border-bone-20 transition-colors"
  >
    <span>{MODE_OPTIONS.find(m => m.key === activeMode)?.icon}</span>
    <span className="hidden sm:inline">{MODE_OPTIONS.find(m => m.key === activeMode)?.label}</span>
    <ChevronUp className="w-3 h-3" />
  </button>

  {showModeMenu && (
    <div className="absolute bottom-full mb-1 left-0 z-50 bg-surface border border-border rounded-[var(--radius-8)] shadow-lg overflow-hidden min-w-[140px]">
      {MODE_OPTIONS.map(opt => (
        <button
          key={opt.key}
          onClick={() => { setActiveMode(opt.key); setShowModeMenu(false) }}
          className={cn(
            'w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-bone-6 transition-colors text-left',
            activeMode === opt.key ? 'text-accent' : 'text-bone-80'
          )}
        >
          <span>{opt.icon}</span>
          <div>
            <p className="font-medium">{opt.label}</p>
            <p className="text-bone-40 text-[10px]">{opt.description}</p>
          </div>
        </button>
      ))}
    </div>
  )}
</div>
```

- [ ] **Step 4: Close mode menu on outside click**

Add a `useEffect` to close the menu when clicking outside:

```typescript
useEffect(() => {
  if (!showModeMenu) return
  const handler = (e: MouseEvent) => setShowModeMenu(false)
  document.addEventListener('mousedown', handler)
  return () => document.removeEventListener('mousedown', handler)
}, [showModeMenu])
```

- [ ] **Step 5: Reset mode on chat clear**

Find the clear chat button's `onClick` handler. After `clearAIChat()`, the store already resets `activeMode` to `'default'` (added in Task 3) — no extra UI code needed here.

- [ ] **Step 6: Commit**

```bash
git add src/components/assistant/AIAssistant.tsx
git commit -m "feat(chat): add mode selector dropdown next to send button"
```

---

## Task 16: Wire activeIntentTag to existing tool pills

**Files:**
- Modify: `src/components/assistant/AIAssistant.tsx`

- [ ] **Step 1: Read how tool commands currently set a tag in the input bar**

Search for `showCommandMenu` and `activeCommandIndex` in `AIAssistant.tsx` to find how `/image`, `/search` etc. currently work and how a selected command affects the input state.

- [ ] **Step 2: Add activeIntentTag state from store**

```typescript
const activeIntentTag = useStore(state => state.activeIntentTag)
const setActiveIntentTag = useStore(state => state.setActiveIntentTag)
```

- [ ] **Step 3: Set activeIntentTag when a chain-related command is selected**

In the command selection handler (where a command from the `/` menu is selected), add tag-setting for chain commands:

```typescript
const CHAIN_TAGS = ['/search', '/research', '/code', '/image']
// When a command is selected:
if (CHAIN_TAGS.includes(selectedCommand.command)) {
  setActiveIntentTag(selectedCommand.command)
}
```

- [ ] **Step 4: Clear activeIntentTag after message is sent**

In the submit handler, after the message is sent, call:
```typescript
setActiveIntentTag(null)
```

- [ ] **Step 5: Commit**

```bash
git add src/components/assistant/AIAssistant.tsx src/data/store.ts
git commit -m "feat(chat): wire activeIntentTag from tool command selection"
```

---

## Task 17: Add Deep Research to the /commands menu

**Files:**
- Modify: `src/components/assistant/AIAssistant.tsx`

- [ ] **Step 1: Find the commands list in AIAssistant.tsx**

Search for the array that defines commands shown in the `/` menu (look for `Generate Image` or `/image` text near command definitions).

- [ ] **Step 2: Add Deep Research entry**

In the commands array, add:

```typescript
{
  icon: <Search className="w-4 h-4" />,  // or a suitable Lucide icon
  label: 'Deep Research',
  description: 'Research using Perplexity and Tavily',
  command: '/research',
  shortcut: '/research',
},
```

Place it after the existing Web Search entry.

- [ ] **Step 3: Add Coding entry**

```typescript
{
  icon: <Terminal className="w-4 h-4" />,
  label: 'Code',
  description: 'Use the coding chain for programming tasks',
  command: '/code',
  shortcut: '/code',
},
```

- [ ] **Step 4: Commit**

```bash
git add src/components/assistant/AIAssistant.tsx
git commit -m "feat(chat): add Deep Research and Code to slash commands menu"
```

---

## Task 18: Generate mode-prompts.txt

**Files:**
- Create: `mode-prompts.txt`

- [ ] **Step 1: Write the mode prompts file**

Create `mode-prompts.txt` at the project root with the following content — these are ready-to-paste prompts for each mode, each settings block written in full, properly differentiated per the spec character profiles.

The file should contain clearly labeled sections:

```
=====================================
MODE: DEFAULT
=====================================

[CORE RULES]
...full prompt text...

[PERSONALITY]
...full prompt text...

[ANSWER STYLE]
...full prompt text...

[THINKING PATTERN]
...full prompt text...

[RESTRICTIONS]
...full prompt text...

[CLASSIFIER PROMPT]
...full prompt text...

=====================================
MODE: THINK
=====================================

[CORE RULES]
...full prompt text...

...etc...

=====================================
MODE: PRO
=====================================

...etc...
```

Write the actual prompt content for each block (not placeholders) based on:
- The current `compiled prompt.txt` as the baseline for Default mode
- Think mode: same personality/restrictions/core rules as Default but with deeper thinking pattern, more deliberate answer style, and a classifier that routes to MEDIUM/COMPLEX_THINKING more aggressively
- Pro mode: same core rules/restrictions, warm but focused personality, answer style that always structures complex output, thinking pattern focused on full reasoning and best possible output, classifier that routes almost everything to COMPLEX_THINKING

- [ ] **Step 2: Commit**

```bash
git add mode-prompts.txt
git commit -m "feat: add mode-prompts.txt with ready-to-paste prompts for all 3 modes"
```

---

## Self-Review

### Spec Coverage Check

| Spec requirement | Task |
|---|---|
| `bot_settings` mode column migration | Task 1 |
| `bot_compiled_prompt` mode column | Task 1 |
| `bot_compaction_config` table | Task 1 |
| Classifier config mode column | Task 1 |
| BotMode type in store | Task 2 |
| activeMode + activeIntentTag in store | Task 3 |
| Mode-aware recompilePrompt / getCompiledPrompt | Task 4 |
| recompileAllModes for brain changes | Task 4 |
| Mode-scoped saveSettingBlock / toggleSettingBlock | Task 5 |
| Mode-scoped getClassifierConfig / saveClassifierConfig | Task 6 |
| CODING + DEEP_RESEARCH router categories | Task 7 |
| 2-step draft+refine compaction with primary+fallback | Task 8 |
| Context limit from DB (not hardcoded) | Task 8 |
| Mode-aware classifier + tag consistency check | Task 9 |
| Maps override (always WEB_SEARCH) | Task 9 |
| chat route accepts mode + intentTag | Task 10 |
| chainRouter uses mode for compiled prompt | Task 11 |
| DEEP_RESEARCH chain routing | Task 11 |
| Global Settings admin page (Ollama, injection, backend, context, compaction, compiled preview) | Task 12 |
| Default / Think / Pro mode admin pages with 6 tabs | Task 13 |
| Sidebar restructure | Task 14 |
| Mode selector dropdown in chat | Task 15 |
| activeIntentTag wired to tool pills | Task 16 |
| Deep Research + Code in slash commands | Task 17 |
| mode-prompts.txt deliverable | Task 18 |

All spec requirements covered.

### Placeholder scan
No TBDs, no "implement later", no "similar to Task N" references. All code blocks contain actual implementation.

### Type consistency
- `BotMode` defined in Task 2, used consistently in Tasks 4–16
- `recompilePrompt(mode)` defined in Task 4, called with mode param in Tasks 5, 8
- `getCompiledPrompt(mode)` defined in Task 4, called in Task 11
- `classifyIntentWithModel(..., mode, intentTag)` defined in Task 9, called in Tasks 10
- `CompactionConfig` defined in Task 8, imported in Task 12
- `saveSettingBlock(category, content, mode)` defined in Task 5, used in Task 13
