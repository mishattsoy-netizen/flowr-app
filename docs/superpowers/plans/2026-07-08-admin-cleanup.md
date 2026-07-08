# Admin Panel Cleanup — Hardcode Prompts, Temperatures, Remove Dead UI

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate all DB-backed prompts, compiled prompts, and temperatures — everything comes from filesystem or hardcoded config. Remove all dead/orphaned UI pages and code that no longer affects runtime.

**Architecture:** The runtime already reads prompts from `src/lib/bot/prompts/` (filesystem via `getGlobalPrompt()`/`getChainPrompt()`). The DB tables `bot_settings`, `bot_compiled_prompt`, `bot_compaction_config`, and `settings` (for `router_temperatures` / `pipeline_settings`) are vestigial — they hold data the UI writes but the runtime either ignores or overwrites with filesystem values on sync. We remove the DB-backed code paths, gut the admin pages that edit dead tables, and hardcode temperatures and compaction config as constants.

**Tech Stack:** Next.js 15 App Router, Supabase, TypeScript, Tailwind CSS.

---

## File Map

### Delete these files (dead pages)
- `src/app/admin/bot/default/page.tsx` — Default mode editing (writes to `bot_settings`, runtime ignores)
- `src/app/admin/bot/pro/page.tsx` — Pro mode editing (same)
- `src/app/admin/bot/keywords/page.tsx` — Keyword editing (writes to DB, classifier reads from filesystem)
- `src/app/admin/bot/keywords/KeywordsClient.tsx` — Keywords client component
- `src/app/admin/bot/classifier/page.tsx` — Classifier page (orphaned, writes to DB, runtime reads filesystem)
- `src/app/admin/bot/settings/page.tsx` — Old settings page (orphaned, superseded by Global Settings)
- `src/app/admin/bot/settings/SettingsClient.tsx` — Old settings client component
- `src/app/admin/bot/_shared/ModeSettingsClient.tsx` — Shared mode settings (used by Default/Pro)
- `src/app/admin/telegram/router/page.tsx` — Telegram router (orphaned, identical to main router)

### Gut these files (remove dead code paths)
- `src/lib/bot/compilePrompt.ts` — Remove `recompilePrompt`, `recompileAllModes`. Keep only `getCompiledPrompt` but strip DB path (filesystem fallback only).
- `src/lib/router-config.ts` — Remove temperature DB lookup (`router_temperatures`), hardcode; remove `getPipelineSettings`, `getFallbackModes` DB lookups, hardcode.
- `src/lib/bot/compaction.ts` — Remove `getCompactionConfig`, `saveCompactionConfig` (DB), hardcode config.
- `src/lib/bot/context.ts` — Remove `getCompactionConfig`/`getPipelineSettings` calls, pass hardcoded config.
- `src/lib/bot/chainRouter.ts` — Remove `getCompiledPrompt` call (line 203) and `globalPrompt` usage. Use `getGlobalPrompt()` from `prompts/index.ts` instead. Remove pipeline settings dependency.
- `src/lib/bot/thinkChain.ts` — Remove `getPipelineSettings` import, use hardcoded status messages.
- `src/app/admin/router/actions.ts` — Remove `getRouterTemperatures`, `setRouterTemperature`, `updateRouterSystemPrompt`, `getInternalPromptsFull`, `getStatusMessages`, `getPipelineSettings`, `savePipelineSetting`.
- `src/app/admin/bot/settings/actions.ts` — Remove everything except what's needed. Remove `saveSettingBlock`, `toggleSettingBlock`, `syncCompiledPrompt`, `getCompiledPromptMeta`, `setGlobalPromptEnabled`/`getGlobalEnabled`, `setOllamaEnabled`/`getOllamaEnabled`, `setBackendModel`/`getBackendModel`, `getKeywordsEnabled`/`setKeywordsEnabled`.
- `src/app/admin/bot/classifier/actions.ts` — Remove `saveClassifierPrompt`, `saveClassifierConfig`, `getClassifierConfig` (prompt part). Keep only keyword functions (or remove entirely if Keywords page is deleted).
- `src/app/admin/bot/global/actions.ts` — Remove `syncFinalPrompts`, `syncCompiledPrompt`, re-exports of removed settings actions. Keep only `updateCompactionConfig`.
- `src/app/admin/bot/brain/actions.ts` — Remove `recompileAllModes` calls (brain entries still write to DB for runtime use).
- `src/app/admin/models/actions.ts` — Remove `bot_compiled_prompt` cascade for backend_model.
- `src/app/api/ai/brain/analyze/route.ts` — Remove `bot_compiled_prompt` read for backend_model.
- `src/app/api/ai/brain/manage/route.ts` — Remove `bot_compiled_prompt` read for backend_model.

### Modify these UI components
- `src/components/admin/Sidebar.tsx` — Remove dead nav items (Default, Pro, Keywords).
- `src/components/admin/RouterManager.tsx` — Remove system prompt editor, temperature slider, temperature/sysprompt action imports.
- `src/components/admin/RouterCategoryCard.tsx` — May need simplification.
- `src/app/admin/bot/global/GlobalSettingsClient.tsx` — Remove compaction chain prompt/temp editor, remove compiled prompt viewer, remove sync buttons, remove pipeline settings editor (or keep if Context & Settings is staying — user said it's working). Keep compaction config (context_limit, compaction_threshold).
- `src/app/admin/bot/global/page.tsx` — Simplify data fetching, remove compiled meta loading.
- `src/app/admin/page.tsx` — Remove hardcoded EventLog, replace with real activity log or remove section.

### Files with minor changes
- `src/app/admin/bot/feedback/actions.ts` — No change needed (reads from `message_feedback` DB, works)
- `src/app/admin/bot/routine/planActions.ts` — No change needed (reads from `bot_improvement_plans` DB, works)
- `src/app/admin/bot/dashboard/actions.ts` — No change needed (read-only stats from DB, works)

---

## Detailed Tasks

### Task 1: Hardcode temperatures and remove from DB + UI

**Problem:** Temperatures are stored in `settings` table key `router_temperatures`, read at runtime in `router-config.ts:90`. The admin UI has a temperature slider in `RouterManager.tsx:603-610`. The compaction section in Global Settings also has a temperature editor.

**Solution:** Hardcode a default temperature (0.7) as a constant. Remove the DB lookup and UI sliders.

**Files:**
- Modify: `src/lib/router-config.ts`
- Modify: `src/components/admin/RouterManager.tsx`
- Modify: `src/app/admin/router/actions.ts`
- Modify: `src/app/admin/bot/global/GlobalSettingsClient.tsx`

- [ ] **Step 1: Remove temperature functions from router actions**

In `src/app/admin/router/actions.ts`, delete `getRouterTemperatures` and `setRouterTemperature`:

```typescript
// DELETE these two functions entirely:

export async function getRouterTemperatures(): Promise<Record<string, number>> {
  ...
}

export async function setRouterTemperature(category: string, temp: number) {
  ...
}
```

Also remove their imports elsewhere after all tasks complete (cleanup in Task 5).

- [ ] **Step 2: Hardcode temperature in router-config.ts**

In `src/lib/router-config.ts`, change `fetchRouterChainFromDb` to not look up temperatures from DB:

```typescript
// At the top of the file, add:
const DEFAULT_TEMPERATURE = 0.7

// Inside fetchRouterChainFromDb, remove the tempsResult lookup and replace:
// Before:
const [chainResult, tempsResult, budgetsResult, modelsResult] = await Promise.all([
  supabase.from('router_chains').select('model_list')...,
  supabase.from('settings').select('value').eq('key', 'router_temperatures')...,  // REMOVE THIS
  ...
])
const customTemp = typeof temps[category] === 'number' ? temps[category] : 0.7  // REPLACE THIS

// After: 
const [chainResult, budgetsResult, modelsResult] = await Promise.all([
  supabase.from('router_chains').select('model_list')...,
  supabase.from('settings').select('value').eq('key', 'router_thinking_budgets')...,
  supabase.from('models').select('id, is_paid, prompt_cost, completion_cost')
])
const customTemp = DEFAULT_TEMPERATURE
```

- [ ] **Step 3: Remove temperature slider from RouterManager**

In `src/components/admin/RouterManager.tsx`:

```typescript
// Remove these imports:
import { getRouterTemperatures, setRouterTemperature, updateRouterSystemPrompt } from '@/app/admin/router/actions'

// Remove state and effects:
const [temperature, setTemperature] = useState<number>(0.7)  // REMOVE
const [systemPrompt, setSystemPrompt] = useState(chain.system_prompt || '')  // REMOVE

// Remove the loadModesAndTemps effect:
useEffect(() => {
  const loadModesAndTemps = async () => {
    const [modes, temps] = await Promise.all([getFallbackModes(), getRouterTemperatures()])
    setFallbackModeMap(modes)
    if (typeof temps[category] === 'number') setTemperature(temps[category])
  }
  loadModesAndTemps()
}, [category])  // REMOVE THIS ENTIRE useEffect

// Remove handleTempChange:
const handleTempChange = async (val: number) => { ... }  // REMOVE

// Remove the system prompt save handler that uses updateRouterSystemPrompt
// Remove the Temp slider UI at around line 603-610
```

Remove the Temp label and slider block:
```tsx
{/* DELETE this block — temperature is now hardcoded */}
<div className="flex items-center gap-2">
  <span>Temp</span>
  <input type="range" min="0" max="1" step="0.05"
    value={temperature}
    onChange={(e) => handleTempChange(parseFloat(e.target.value) || 0)}
  />
  <span>{temperature}</span>
</div>
```

- [ ] **Step 4: Remove compaction temperature editor from GlobalSettingsClient**

In `src/app/admin/bot/global/GlobalSettingsClient.tsx`, remove the compaction temperature state and slider:

```typescript
// Remove these:
import { updateRouterChain, updateRouterSystemPrompt, setRouterTemperature, savePipelineSetting } from '@/app/admin/router/actions'
// ... only keep savePipelineSetting if needed

const [chainTemp, setChainTemp] = useState(compactionTemperature)  // REMOVE
// Remove the setRouterTemperature call in the compaction save handler:
await setRouterTemperature('COMPACTION', chainTemp)  // REMOVE THIS LINE
```

Remove the temperature slider UI in the compaction section:
```tsx
{/* DELETE the temperature slider */}
<div>...</div>
```

---

### Task 2: Remove Default/Pro mode pages (dead — prompts are filesystem)

**Problem:** `/admin/bot/default` and `/admin/bot/pro` let you edit `bot_settings` in DB. But `buildSystemPrompt()` reads from `src/lib/bot/prompts/*.txt` filesystem. Changes made in these pages don't affect runtime.

**Solution:** Delete the pages and their dependencies. Remove the sidebar links.

**Files:**
- Delete: `src/app/admin/bot/default/page.tsx`
- Delete: `src/app/admin/bot/pro/page.tsx`
- Delete: `src/app/admin/bot/_shared/ModeSettingsClient.tsx`
- Modify: `src/components/admin/Sidebar.tsx`

- [ ] **Step 1: Delete Default mode page**

Delete `src/app/admin/bot/default/page.tsx` entirely.

- [ ] **Step 2: Delete Pro mode page**

Delete `src/app/admin/bot/pro/page.tsx` entirely.

- [ ] **Step 3: Delete ModeSettingsClient**

Delete `src/app/admin/bot/_shared/ModeSettingsClient.tsx` entirely.

- [ ] **Step 4: Remove sidebar links**

In `src/components/admin/Sidebar.tsx`, remove the Default and Pro nav links:

```tsx
// DELETE these two entries:
<NavLink href="/admin/bot/default" icon={Zap}>Default</NavLink>
<NavLink href="/admin/bot/pro" icon={Cpu}>Pro</NavLink>

// Also remove the "Modes" sub-heading if it becomes empty:
<div className="px-3 py-[3px] mt-1">
  <span className="text-[10px] font-ui-label font-medium uppercase tracking-wide text-[var(--bone-40)]">Modes</span>
</div>
// DELETE this entire block
```

---

### Task 3: Remove Keywords page (dead — classifier reads from filesystem)

**Problem:** `/admin/bot/keywords` saves keywords to `bot_settings` DB. The classifier at `classifier.ts:188` reads from `src/lib/bot/prompts/classifier_keywords.json` directly.

**Solution:** Delete the page. The keywords file is already the source of truth.

**Files:**
- Delete: `src/app/admin/bot/keywords/page.tsx`
- Delete: `src/app/admin/bot/keywords/KeywordsClient.tsx`
- Modify: `src/components/admin/Sidebar.tsx`

- [ ] **Step 1: Delete Keywords page files**

Delete `src/app/admin/bot/keywords/page.tsx` and `src/app/admin/bot/keywords/KeywordsClient.tsx`.

- [ ] **Step 2: Remove sidebar link**

```tsx
// DELETE from Sidebar.tsx:
<NavLink href="/admin/bot/keywords" icon={Zap}>Keywords</NavLink>
```

---

### Task 4: Remove orphaned pages (Classifier, Old Settings, Telegram Router)

**Problem:** Three pages exist but are not in the sidebar. They duplicate functionality in dead/overlapping ways.

**Files:**
- Delete: `src/app/admin/bot/classifier/page.tsx`
- Delete: `src/app/admin/bot/settings/page.tsx`
- Delete: `src/app/admin/bot/settings/SettingsClient.tsx`
- Delete: `src/app/admin/telegram/router/page.tsx`

- [ ] **Step 1: Delete Classifier page**
- [ ] **Step 2: Delete Old Settings page + client**
- [ ] **Step 3: Delete Telegram Router page**

(All are simple file deletions. No sidebar links to remove since they were orphaned.)

---

### Task 5: Remove bot_settings save actions (dead — prompts are filesystem)

**Problem:** `bot/settings/actions.ts` has functions to save/load/toggle `bot_settings` and `bot_compiled_prompt`. These were used by the Default/Pro/Global pages. After deleting those pages, the actions are unused.

**Solution:** Gut `bot/settings/actions.ts` — remove all save/get functions. If any are still needed by other files, move them to `bot/global/actions.ts`.

**Files:**
- Modify: `src/app/admin/bot/settings/actions.ts`
- Modify: `src/app/admin/bot/global/actions.ts`

- [ ] **Step 1: Gut bot/settings/actions.ts**

Remove everything except what's used elsewhere. The functions to remove:
```typescript
// DELETE all of these:
saveSettingBlock()
toggleSettingBlock()
syncCompiledPrompt()
getCompiledPromptMeta()
setGlobalPromptEnabled()
getGlobalEnabled()
setOllamaEnabled()
getOllamaEnabled()
setBackendModel()
getBackendModel()
getKeywordsEnabled()
setKeywordsEnabled()
```

The file should either be deleted entirely (if nothing imports from it) or left as an empty re-export module. Check imports first with:
```bash
grep -r "from '@/app/admin/bot/settings/actions'" src/ --include='*.ts' --include='*.tsx'
```

- [ ] **Step 2: Clean up global/actions.ts**

In `src/app/admin/bot/global/actions.ts`, remove:
```typescript
// Remove these re-exports:
export { getCompactionConfig, saveCompactionConfig, getGlobalEnabled, setGlobalPromptEnabled, 
  getOllamaEnabled, setOllamaEnabled, getBackendModel, setBackendModel, 
  syncCompiledPrompt, getCompiledPromptMeta, getKeywordsEnabled, setKeywordsEnabled }

// Remove the entire syncFinalPrompts function (reads from filesystem to overwrite DB — defeats the whole purpose of admin editing)
// Remove the syncCompiledPrompt calls

// Keep:
updateCompactionConfig()
```

---

### Task 6: Remove DB compiled prompt system (`bot_compiled_prompt`)

**Problem:** `bot_compiled_prompt` table stores a compiled version of all prompt parts + brain entries + backend_model. The runtime `getCompiledPrompt()` checks DB first, then falls back to `Final prompts(active)/` filesystem. We want it to only use filesystem.

**Files:**
- Modify: `src/lib/bot/compilePrompt.ts`
- Modify: `src/lib/bot/chainRouter.ts`
- Modify: `src/app/admin/bot/brain/actions.ts`
- Modify: `src/app/admin/models/actions.ts`
- Modify: `src/app/api/ai/brain/analyze/route.ts`
- Modify: `src/app/api/ai/brain/manage/route.ts`

- [ ] **Step 1: Simplify compilePrompt.ts to filesystem-only**

Replace `src/lib/bot/compilePrompt.ts` with a filesystem-only version:

```typescript
import fs from 'fs'
import path from 'path'
import { logger } from '../logger'

const CATEGORY_LABELS: Record<string, string> = {
  core_rules:       'CORE RULES',
  personality:      'PERSONALITY',
  answer_style:     'ANSWER STYLE',
  thinking_pattern: 'THINKING PATTERN',
  restrictions:     'RESTRICTIONS',
}

export async function getCompiledPrompt(mode: string = 'default'): Promise<string> {
  // Filesystem-only: read from Final prompts(active)/modes/{mode}/
  try {
    const parts: string[] = [];
    const settingsOrder = ['core_rules', 'personality', 'answer_style', 'thinking_pattern', 'restrictions'];
    for (const cat of settingsOrder) {
      const filePath = path.join(process.cwd(), 'Final prompts(active)', 'modes', mode, `${cat}.txt`);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        if (content?.trim()) {
          parts.push(`[${CATEGORY_LABELS[cat] ?? cat.toUpperCase()}]\n${content.trim()}`);
        }
      }
    }
    if (parts.length > 0) {
      const compiled = parts.join('\n\n');
      logger.info(`Loaded compiled prompt from Final prompts(active)/modes/${mode}`);
      return compiled;
    }
  } catch (err) {
    logger.warn(`Failed to read compiled prompt files: ${err}`)
  }
  return ''
}

export async function recompilePrompt(mode: string = 'default'): Promise<void> {
  // No-op — prompts are filesystem-only now
  logger.info(`[compilePrompt] Skipping recompilePrompt: prompts are filesystem-only`);
}

export async function recompileAllModes(): Promise<void> {
  // No-op
}
```

- [ ] **Step 2: Remove getInternalPrompt DB path**

In `src/lib/bot/compilePrompt.ts`, also simplify `getInternalPrompt` to be filesystem-only or remove it entirely if unused:

```typescript
export async function getInternalPrompt(chainType: string): Promise<string> {
  // Filesystem-only — read from Final prompts(active)/chains/ or return empty
  try {
    const filePath = path.join(process.cwd(), 'Final prompts(active)', 'chains', chainType, 'pipeline.txt');
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf8').trim();
    }
  } catch {}
  return ''
}
```

- [ ] **Step 3: Replace getCompiledPrompt with getGlobalPrompt in chainRouter.ts**

In `src/lib/bot/chainRouter.ts`, change the `globalPrompt` variable to use the filesystem prompt:

```typescript
// Change import:
import { getCompiledPrompt, getInternalPrompt } from './compilePrompt'
// To:
import { getGlobalPrompt } from './prompts'
// (keep getInternalPrompt if used)

// Change line 203 from:
getCompiledPrompt(context?.mode ?? 'default'),
// To:
Promise.resolve(getGlobalPrompt()),
```

This ensures the vision flow and other places that use `globalPrompt` still get the global prompt, but now from the filesystem.

- [ ] **Step 4: Remove recompileAllModes calls from brain actions**

In `src/app/admin/bot/brain/actions.ts`, replace each `recompileAllModes()` call with a no-op or remove:

```typescript
// In addBrainEntry, deleteBrainEntry, toggleBrainEntry, updateBrainEntry:
// Remove or comment out:
// await recompileAllModes()
```

- [ ] **Step 5: Remove bot_compiled_prompt cascade from models actions**

In `src/app/admin/models/actions.ts`, remove the backend_model cascade:

```typescript
// DELETE this block (around line 75-90):
// Cascade to backend model in bot_compiled_prompt
// ...
```

- [ ] **Step 6: Move backend_model to settings table (brain routes)**

The brain API routes read `backend_model` from `bot_compiled_prompt`. Move it to the `settings` table:

In `src/app/api/ai/brain/analyze/route.ts`:
```typescript
// Before:
const { data: promptRow } = await supabase
  .from('bot_compiled_prompt')
  .select('backend_model')
  .eq('mode', 'default')
  .limit(1)
  .single()

// After:
const { data: promptRow } = await supabase
  .from('settings')
  .select('value')
  .eq('key', 'backend_model')
  .maybeSingle()
const backendModel = promptRow?.value ?? 'gemini-2.0-flash'
```

Do the same in `src/app/api/ai/brain/manage/route.ts`.

Then create a new simple action to save the backend model:
In `src/app/admin/bot/global/actions.ts`, add:
```typescript
export async function getBackendModel(): Promise<string> {
  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'backend_model')
    .maybeSingle()
  return (data?.value as string) ?? 'gemini-2.0-flash'
}

export async function setBackendModel(model: string): Promise<void> {
  await supabase.from('settings').upsert(
    { key: 'backend_model', value: model },
    { onConflict: 'key' }
  )
}
```

---

### Task 7: Remove Router Matrix system prompt fields (dead — confirmed by code comment)

**Problem:** The `system_prompt` column in `router_chains` is written by `updateRouterSystemPrompt()` in the admin UI, but `fetchRouterChainFromDb()` at `router-config.ts:48` only selects `model_list`. The developer left a comment at `router/actions.ts:104` confirming it's unused.

**Solution:** Remove `updateRouterSystemPrompt()` and the system prompt textarea from `RouterManager`.

**Files:**
- Modify: `src/app/admin/router/actions.ts`
- Modify: `src/components/admin/RouterManager.tsx`

- [ ] **Step 1: Remove updateRouterSystemPrompt from actions**

Delete `updateRouterSystemPrompt()` from `src/app/admin/router/actions.ts`.

Also remove the `system_prompt` field from the `createRouterChain` function:
```typescript
// In createRouterChain, remove:
seedSystemPrompt = defaultChain.system_prompt ?? ''
// and:
system_prompt: seedSystemPrompt
```

- [ ] **Step 2: Remove system prompt editor from RouterManager**

In `src/components/admin/RouterManager.tsx`:
```typescript
// Remove import:
import { updateRouterSystemPrompt } from '@/app/admin/router/actions'

// Remove state:
const [systemPrompt, setSystemPrompt] = useState(chain.system_prompt || '')

// Remove the save handler:
await updateRouterSystemPrompt(chain.id, systemPrompt)

// Remove the system prompt textarea/editor UI from the component render
```

Search for the system prompt textarea in the render output (around line 552) and delete:
```tsx
{/* DELETE: system prompt textarea */}
<textarea value={systemPrompt} onChange={...} />
```

---

### Task 8: Remove pipeline settings DB dependency (Context & Settings)

**Note:** The user confirmed Context & Settings IS working. But we're asked to hardcode temperatures. Pipeline settings (`history_limit`, token limits, etc.) are still live DB reads — the user didn't ask to remove those. So skip this task unless the user confirms they want pipeline settings hardcoded too.

**Verdict: SKIP this task.** Context & Settings remains DB-backed as confirmed working.

---

### Task 9: Hardcode compaction config (Context & Compaction)

**Note:** The user confirmed Context & Compaction IS working. The compaction config (context_limit, compaction_threshold) reads from `bot_compaction_config` DB. The compaction chain prompt editor is dead (runtime uses `getChainPrompt('compaction')` from filesystem).

**Scope:** Only remove the dead compaction chain prompt/temp editor UI. Keep the compaction config section (context_limit, compaction_threshold) DB-backed as it's confirmed working.

**Files:**
- Modify: `src/app/admin/bot/global/GlobalSettingsClient.tsx`

- [ ] **Step 1: Remove compaction chain prompt/temp from Global Settings UI**

In `src/app/admin/bot/global/GlobalSettingsClient.tsx`:
```typescript
// Remove these states:
const [chainPrompt, setChainPrompt] = useState(compactionChain?.system_prompt ?? '')
const [chainTemp, setChainTemp] = useState(compactionTemperature)

// Remove the save handler lines that use updateRouterSystemPrompt and setRouterTemperature:
await updateRouterSystemPrompt(chainId, chainPrompt)
await setRouterTemperature('COMPACTION', chainTemp)

// Remove the chain prompt textarea and chain temperature slider from the "Context & Compaction" section
// Keep the compaction config inputs (context_limit, compaction_threshold)
```

---

### Task 10: Update Global Settings page (remove dead elements)

**Problem:** Global Settings page has dead elements: compiled prompt viewer, sync buttons, compaction chain editor, backend model selector (which used `bot_compiled_prompt` table).

**Files:**
- Modify: `src/app/admin/bot/global/GlobalSettingsClient.tsx`
- Modify: `src/app/admin/bot/global/page.tsx`

- [ ] **Step 1: Simplify GlobalSettingsClient**

Remove from `GlobalSettingsClient.tsx`:
- Compiled prompt viewer (`showPreview` toggle, compiled meta display)
- Sync Final Prompts button
- Sync compiled prompt button
- Compaction chain model list editor (if the chain models are edited via the Router Matrix page for COMPACTION category)

Keep:
- Backend model selector (moved to `settings` table in Task 6)
- Prompt enabled toggle (if still relevant — the compiled prompt is now filesystem-only)
- Context & Compaction (context_limit, compaction_threshold)
- Context & Settings (pipeline settings) — confirmed working
- Ollama enabled toggle

- [ ] **Step 2: Simplify Global Settings page data fetching**

In `src/app/admin/bot/global/page.tsx`:
```typescript
// Remove imports for removed functions:
import { getCompiledPromptMeta, getKeywordsEnabled } from '@/app/admin/bot/settings/actions'
import { getInternalPromptsFull, getStatusMessages, getPipelineSettings, getRouterChains, getRouterTemperatures } from '@/app/admin/router/actions'

// Simplify the Promise.all to only fetch what's needed
```

---

### Task 11: Remove hardcoded event log from System Overview

**Problem:** The System Overview page at `/admin` has a "Recent events log" section with hardcoded dummy data.

**Solution:** Either remove the section entirely or wire it to the real `activity_log` table.

**Files:**
- Modify: `src/app/admin/page.tsx`

- [ ] **Step 1: Remove the dummy EventLog**

Delete the EventLog component and its usage from the System Overview page:

```tsx
// DELETE this entire block from the grid:
<div className="bg-panel border border-[var(--bone-6)] rounded-big p-6 flex flex-col">
  <h2 className="text-[10px] ...">Recent events log</h2>
  <div className="space-y-1 flex-1">
    <EventLog message="User 12345 registered" time="2m ago" />
    <EventLog message="Fallback triggered: gemini-pro" time="15m ago" />
    ... etc
  </div>
</div>

// Also delete the EventLog helper component function at the bottom
```

Replace with either nothing (reduce grid to single column) or a placeholder that's honest:
```tsx
<div className="bg-panel border border-[var(--bone-6)] rounded-big p-6 flex flex-col items-center justify-center text-muted-foreground/40 text-sm">
  Real-time activity log coming soon
</div>
```

---

### Task 12: Clean up sidebar (remove dead nav items)

**Files:**
- Modify: `src/components/admin/Sidebar.tsx`

- [ ] **Step 1: Final sidebar cleanup**

After all the removals above, the sidebar should have these remaining items:

```
SYSTEM
System Overview
Analytics
Costs
Message Logs
Users
Admins
Beta Invites

INFRASTRUCTURE
Vault
Presets
Discover

BOT
Global Settings
Model Registry
Router Matrix
Brain
Dashboard
Routine
Feedback
```

Remove the "Modes" sub-heading entirely. Remove the "Config" sub-heading too (or keep it if Brain/Dashboard/Routine/Feedback remain under it).

---

### Task 13: Remove dead action code from router/actions.ts

**Files:**
- Modify: `src/app/admin/router/actions.ts`

- [ ] **Step 1: Remove dead functions**

Remove these exports from `src/app/admin/router/actions.ts`:
- `getRouterTemperatures()` — already removed in Task 1
- `setRouterTemperature()` — already removed in Task 1
- `updateRouterSystemPrompt()` — already removed in Task 7
- `getInternalPromptsFull()` — pipeline prompts are filesystem now
- `getStatusMessages()` — if confirmed unused
- `getPipelineSettings()` — if confirmed unused (but Context & Settings uses this!)
- `savePipelineSetting()` — if confirmed unused

**But wait:** Context & Settings is confirmed working and reads pipeline settings from DB. So KEEP:
- `getPipelineSettings()`
- `savePipelineSetting()`
- `getStatusMessages()`

Only remove the temperature and system prompt functions.

---

### Task 14: Verify no broken imports remain

- [ ] **Step 1: Check for broken imports**

```bash
grep -r "from '@/app/admin/bot/settings/actions'" src/ --include='*.ts' --include='*.tsx'
grep -r "from '@/app/admin/bot/classifier/actions'" src/ --include='*.ts' --include='*.tsx'
grep -r "from '@/lib/bot/compilePrompt'" src/ --include='*.ts' --include='*.tsx'
grep -r "bot_compiled_prompt" src/ --include='*.ts' --include='*.tsx'
grep -r "recompilePrompt\|recompileAllModes" src/ --include='*.ts' --include='*.tsx'
grep -r "getRouterTemperatures\|setRouterTemperature\|updateRouterSystemPrompt" src/ --include='*.ts' --include='*.tsx'
```

Fix any broken imports by updating them to point to the new locations.

- [ ] **Step 2: Build check**

```bash
npm run build 2>&1 | head -100
# or
npx tsc --noEmit 2>&1 | head -100
```

Fix any TypeScript errors from the removals.

---

## Spec Coverage Check

| Requirement | Task |
|-------------|------|
| Hardcode temperatures, remove from DB | Task 1 |
| Remove UI for hardcoded things | Tasks 1, 2, 3, 4, 7, 10 |
| All prompts filesystem-only | Task 6 (remove DB compiled prompt), vision already filesystem |
| Remove DB compiled prompt | Task 6 |
| Vision chain prompt in files | Already done (`getChainPrompt('vision')` at chainRouter.ts:333) |
| Remove dead elements from UI | Tasks 2, 3, 4, 7, 10, 11, 12 |
| Remove dead code | Tasks 1, 5, 6, 13, 14 |
| Answer about Context & Settings/Compaction | Answered in analysis (both are working, kept) |
