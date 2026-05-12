# Subchain Router Cards — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Subchain View toggle to RouterManager cards that lets admins configure the system prompt and chain category for IMAGE_GEN sub-steps (Prompt Expander, Image Narration), replacing hardcoded values.

**Architecture:** Subchain configs are stored as JSON in the `settings` table under key `subchain_configs`. Each subchain entry has an `id`, `label`, `parent_category`, `chain_category` (which IntentCategory to pull the model from), and `system_prompt`. The RouterManager card gains a toggle that swaps its content to a subchain editor view. `expandImagePrompt` and `narrateGeneratedImage` read their config from this store at runtime instead of using hardcoded values.

**Tech Stack:** Next.js 14 App Router, React, Supabase (settings table), TypeScript, Tailwind CSS, existing RouterManager/actions patterns.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/app/admin/router/actions.ts` | Modify | Add `getSubchainConfigs`, `saveSubchainConfigs` server actions |
| `src/lib/subchain-config.ts` | Create | Runtime reader — `getSubchainConfig(id)` used by pipeline modules |
| `src/lib/bot/prompt-expansion.ts` | Modify | Read chain category + system prompt from DB instead of hardcoded |
| `src/lib/bot/image-narration.ts` | Modify | Read chain category + system prompt from DB instead of hardcoded |
| `src/components/admin/RouterManager.tsx` | Modify | Add subchain toggle, SubchainView component inline |
| `src/app/admin/router/page.tsx` | No change | Already passes chain + availableModels; subchains are self-contained |

---

## Task 1: Define subchain config types and the settings key

**Files:**
- Create: `src/lib/subchain-config.ts`

- [ ] **Step 1: Create the types and reader**

```ts
// src/lib/subchain-config.ts
import { supabaseAdmin } from './supabase'
import { IntentCategory } from './router-config'

export interface SubchainConfig {
  id: string           // e.g. 'prompt_expander', 'image_narration'
  label: string        // display name
  parent_category: string  // which router card owns this, e.g. 'IMAGE_GEN'
  chain_category: IntentCategory  // which chain to pull the model from
  system_prompt: string
}

const SETTINGS_KEY = 'subchain_configs'

const DEFAULTS: SubchainConfig[] = [
  {
    id: 'prompt_expander',
    label: 'Prompt Expander',
    parent_category: 'IMAGE_GEN',
    chain_category: 'FAST_SIMPLE',
    system_prompt: `You are a professional image prompt engineer. 
Your task is to take the user's current request and the conversation history, and generate a single, highly detailed, descriptive image generation prompt.

Rules:
1. Focus on: subject, style, lighting, composition, mood, and camera specifications.
2. The user might use words like "that", "this", "it", or refer to previous topics (like characters or locations mentioned earlier) — use the history to resolve these references into concrete descriptions.
3. If the user asks for "realistic", "photorealistic", "movie scene", or "cinematic", ensure the prompt describes:
   - Specific lighting (e.g., "volumetric lighting", "golden hour", "dramatic shadows").
   - Camera specs (e.g., "shot on 35mm lens", "f/1.8", "depth of field").
   - Texture details (e.g., "intricate skin textures", "highly detailed fabric").
   - 8k resolution, Unreal Engine 5 render style, or cinematic color grading.
4. If the user refers to a character, include their iconic features to ensure the image model captures them correctly.
5. Output ONLY the descriptive prompt. No explanations, no intro text.
6. Keep the prompt in English, even if the user request is in another language.`,
  },
  {
    id: 'image_narration',
    label: 'Image Narration',
    parent_category: 'IMAGE_GEN',
    chain_category: 'VISION',
    system_prompt: `You are an expert image analyst and storyteller. 
Your task is to provide a detailed, vivid description of the provided image.

Rules:
1. Length: Minimum 250 characters, Maximum 700 characters.
2. Content: Describe the subject, environment, lighting, colors, and mood.
3. Tone: Professional, descriptive, and engaging.
4. Output ONLY the description. No intro like "The image shows..." or "Here is the description:".
5. Focus on what is actually present in the image.`,
  },
]

let _cache: SubchainConfig[] | null = null

export async function getAllSubchainConfigs(): Promise<SubchainConfig[]> {
  if (_cache) return _cache
  try {
    const { data, error } = await supabaseAdmin
      .from('settings')
      .select('value')
      .eq('key', SETTINGS_KEY)
      .maybeSingle()
    if (error || !data?.value) {
      _cache = DEFAULTS
      return DEFAULTS
    }
    // Merge DB values over defaults (so new defaults appear if added)
    const saved = data.value as SubchainConfig[]
    const merged = DEFAULTS.map(d => {
      const override = saved.find(s => s.id === d.id)
      return override ? { ...d, ...override } : d
    })
    _cache = merged
    return merged
  } catch {
    return DEFAULTS
  }
}

export async function getSubchainConfig(id: string): Promise<SubchainConfig | undefined> {
  const all = await getAllSubchainConfigs()
  return all.find(c => c.id === id)
}

export function invalidateSubchainCache() {
  _cache = null
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/subchain-config.ts
git commit -m "feat: add subchain config types and DB reader with defaults"
```

---

## Task 2: Add server actions for reading and saving subchain configs

**Files:**
- Modify: `src/app/admin/router/actions.ts`

- [ ] **Step 1: Read the existing actions file to find the right place to add**

Read `src/app/admin/router/actions.ts` — find the exports list and the supabase import pattern used there.

- [ ] **Step 2: Add the two new server actions at the end of the file**

```ts
// Add to src/app/admin/router/actions.ts

import { invalidateSubchainCache, SubchainConfig } from '@/lib/subchain-config'

export async function getSubchainConfigsAction(): Promise<SubchainConfig[]> {
  'use server'
  const { getAllSubchainConfigs } = await import('@/lib/subchain-config')
  return getAllSubchainConfigs()
}

export async function saveSubchainConfigsAction(configs: SubchainConfig[]): Promise<void> {
  'use server'
  const { supabaseAdmin } = await import('@/lib/supabase')
  invalidateSubchainCache()
  const { error } = await supabaseAdmin
    .from('settings')
    .upsert({ key: 'subchain_configs', value: configs }, { onConflict: 'key' })
  if (error) throw new Error(error.message)
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/router/actions.ts
git commit -m "feat: add getSubchainConfigsAction and saveSubchainConfigsAction"
```

---

## Task 3: Wire prompt-expansion.ts to read from DB config

**Files:**
- Modify: `src/lib/bot/prompt-expansion.ts`

- [ ] **Step 1: Replace hardcoded system prompt and hardcoded chain with DB config**

Replace the entire file content:

```ts
// src/lib/bot/prompt-expansion.ts
import { logger } from '../logger'
import { getRouterChain, IntentCategory } from '../router-config'
import { getProviderKeys } from '../vault'
import { runGoogle } from './providers/google'
import { runGroq } from './providers/groq'
import { runOpenRouter } from './providers/openrouter'
import { getSubchainConfig } from '../subchain-config'

export async function expandImagePrompt(
  prompt: string,
  history: any[],
  context: any
): Promise<{ expanded: string; modelId?: string; provider?: string }> {
  const config = await getSubchainConfig('prompt_expander')
  const chainCategory: IntentCategory = config?.chain_category ?? 'FAST_SIMPLE'
  const systemPrompt = config?.system_prompt ?? ''

  const { chain } = await getRouterChain(chainCategory)
  const model = chain.find(m => m.is_enabled)
  if (!model) {
    logger.warn(`No ${chainCategory} model available for prompt expansion`)
    return { expanded: prompt }
  }

  try {
    let response: any = null
    const provider = model.provider.toLowerCase()
    const expansionPrompt = `User Request: "${prompt}"\n\nGenerate a detailed image prompt based on this and the provided conversation history.`

    if (provider === 'google') {
      response = await runGoogle(model.id, expansionPrompt, systemPrompt, undefined, context || {}, history)
    } else if (provider === 'groq') {
      response = await runGroq(model.id, expansionPrompt, systemPrompt, context?.aiApiKey, context || {}, history)
    } else if (provider === 'openrouter') {
      const keys = await getProviderKeys('OPENROUTER')
      response = await runOpenRouter(model.id, expansionPrompt, systemPrompt, history, context?.aiApiKey || keys[0], model.openrouter_provider || undefined)
    }

    if (response) {
      const expanded = typeof response === 'object' ? response.content : response
      if (expanded && expanded.length > 5) {
        logger.info(`Expanded image prompt: "${prompt}" -> "${expanded.slice(0, 100)}..."`)
        return { expanded: expanded.trim(), modelId: model.id, provider: model.provider }
      }
    }
  } catch (e: any) {
    logger.warn(`Failed to expand image prompt: ${e.message}, using original: "${prompt}"`)
  }
  return { expanded: prompt, modelId: model.id, provider: model.provider }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/bot/prompt-expansion.ts
git commit -m "feat: prompt expander reads chain category and system prompt from DB subchain config"
```

---

## Task 4: Wire image-narration.ts to read from DB config

**Files:**
- Modify: `src/lib/bot/image-narration.ts`

- [ ] **Step 1: Replace hardcoded system prompt and hardcoded chain with DB config**

Replace the entire file content:

```ts
// src/lib/bot/image-narration.ts
import { logger } from '../logger'
import { getRouterChain, IntentCategory } from '../router-config'
import { runGoogle } from './providers/google'
import { runCloudflare } from './providers/cloudflare'
import { runOpenRouter } from './providers/openrouter'
import { getSubchainConfig } from '../subchain-config'

export async function narrateGeneratedImage(
  imageBuffer: Buffer,
  context?: any
): Promise<{ description: string; modelId: string; provider: string } | null> {
  const config = await getSubchainConfig('image_narration')
  const chainCategory: IntentCategory = config?.chain_category ?? 'VISION'
  const systemPrompt = config?.system_prompt ?? ''

  const { chain } = await getRouterChain(chainCategory)
  const model = chain.find(m => m.is_enabled)

  if (!model) {
    logger.warn(`No ${chainCategory} model available for image narration`)
    return null
  }

  try {
    let response: any = null
    const provider = model.provider.toLowerCase()
    const prompt = 'Describe this image in detail (250-700 characters).'

    if (provider === 'google' || provider === 'gemini') {
      response = await runGoogle(model.id, prompt, systemPrompt, imageBuffer, context, [])
    } else if (provider === 'cloudflare') {
      response = await runCloudflare(model.id, prompt, context?.aiApiKey, systemPrompt, [], 'VISION')
    } else if (provider === 'openrouter') {
      response = await runOpenRouter(model.id, prompt, systemPrompt, [], context?.aiApiKey, model.openrouter_provider || undefined, imageBuffer)
    }

    if (response) {
      const description = typeof response === 'object' ? response.content : response
      if (description && description.length >= 10) {
        logger.info(`Narrated image using ${model.id}: ${description.slice(0, 50)}...`)
        return { description: description.trim(), modelId: model.id, provider: model.provider }
      }
    }
  } catch (e: any) {
    logger.warn(`Failed to narrate image: ${e.message}`)
  }

  return null
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/bot/image-narration.ts
git commit -m "feat: image narration reads chain category and system prompt from DB subchain config"
```

---

## Task 5: Add SubchainView UI to RouterManager

**Files:**
- Modify: `src/components/admin/RouterManager.tsx`

This is the main UI task. The RouterManager card gains:
1. A toggle button in the header (next to the Layers/presets icon)
2. When toggled on: header shows subchain tabs + prompt button + toggle; body shows SubchainView rows
3. SubchainView: one row per subchain for this `category`, with a chain category picker dropdown and the subchain label
4. Prompt button in subchain mode edits the active tab's system prompt (reuses the existing `isPromptOpen` textarea pattern)

- [ ] **Step 1: Read the current RouterManager file to note exact import list and component boundaries**

Read `src/components/admin/RouterManager.tsx` lines 1-50 to confirm current imports.

- [ ] **Step 2: Add imports and SubchainConfig type**

Add at the top of `RouterManager.tsx` after existing imports:

```ts
import { getSubchainConfigsAction, saveSubchainConfigsAction } from '@/app/admin/router/actions'
import type { SubchainConfig } from '@/lib/subchain-config'
import { Layers2 } from 'lucide-react'
```

Also add `Layers2` to the lucide import line (or add a new import line if it's a separate package version — `Layers2` is available in lucide-react ≥0.263).

- [ ] **Step 3: Add SUBCHAIN_CATEGORIES constant and subchain state**

Inside the `RouterManager` component function, after existing state declarations, add:

```ts
const SUBCHAIN_PARENT_MAP: Record<string, true> = { IMAGE_GEN: true }
const hasSubchains = category ? SUBCHAIN_PARENT_MAP[category] === true : false

const ALL_CATEGORIES: IntentCategory[] = [
  'FAST_SIMPLE', 'MEDIUM_THINKING', 'COMPLEX_THINKING', 'CLASSIFIER',
  'VISION', 'IMAGE_GEN', 'IMAGE_UPSCALE', 'WEB_SEARCH', 'DEEP_RESEARCH',
  'TOOL_CALLING', 'CODING', 'THINKING', 'ORCHESTRATOR', 'ADVISOR',
]

const [isSubchainView, setIsSubchainView] = useState(false)
const [subchains, setSubchains] = useState<SubchainConfig[]>([])
const [activeSubchainId, setActiveSubchainId] = useState<string | null>(null)
const [isSavingSubchain, setIsSavingSubchain] = useState(false)
```

Also add `IntentCategory` to the import from `@/lib/router-config` (or add it if not already imported):

```ts
import type { IntentCategory } from '@/lib/router-config'
```

- [ ] **Step 4: Add useEffect to load subchains when entering subchain view**

After the existing `useEffect` calls inside `RouterManager`:

```ts
useEffect(() => {
  if (!isSubchainView || !category) return
  getSubchainConfigsAction().then(all => {
    const mine = all.filter(s => s.parent_category === category)
    setSubchains(mine)
    if (mine.length > 0 && !activeSubchainId) {
      setActiveSubchainId(mine[0].id)
    }
  })
}, [isSubchainView, category])
```

- [ ] **Step 5: Add handleSaveSubchain function**

After `handleSavePrompt` function:

```ts
const activeSubchain = subchains.find(s => s.id === activeSubchainId) ?? null

const handleSubchainChainChange = (subchainId: string, newCategory: IntentCategory) => {
  setSubchains(prev => prev.map(s => s.id === subchainId ? { ...s, chain_category: newCategory } : s))
}

const handleSubchainPromptChange = (value: string) => {
  if (!activeSubchainId) return
  setSubchains(prev => prev.map(s => s.id === activeSubchainId ? { ...s, system_prompt: value } : s))
}

const handleSaveSubchains = async () => {
  if (!subchains.length) return
  setIsSavingSubchain(true)
  try {
    // Load all configs, replace entries for this category, save back
    const all = await getSubchainConfigsAction()
    const others = all.filter(s => s.parent_category !== category)
    await saveSubchainConfigsAction([...others, ...subchains])
  } catch (err: any) {
    alert(`Failed to save subchain config: ${err.message}`)
  } finally {
    setIsSavingSubchain(false)
  }
}
```

- [ ] **Step 6: Add the toggle button in the header**

In the header JSX, find the `<button>` for the Layers (preset) icon and add immediately before it:

```tsx
{hasSubchains && (
  <button
    onClick={() => setIsSubchainView(v => !v)}
    className={cn(
      'p-1 rounded-sm transition-all duration-0',
      isSubchainView ? 'bg-accent/20 text-accent' : 'hover:bg-white/5 text-muted-foreground/40 hover:text-foreground'
    )}
    title="Subchain View"
  >
    <Layers2 className="w-3.5 h-3.5" />
  </button>
)}
```

- [ ] **Step 7: Conditionally render header controls**

The header currently always shows the fallback mode toggle, temp input, prompt button, and preset button. Wrap the fallback/temp controls so they hide in subchain view, and add subchain tabs:

```tsx
{/* Subchain tabs — shown only in subchain view */}
{isSubchainView && (
  <div className="flex items-center gap-1 mr-auto">
    {subchains.map(s => (
      <button
        key={s.id}
        onClick={() => setActiveSubchainId(s.id)}
        className={cn(
          'px-2 py-0.5 rounded-sm text-[9px] font-bold uppercase tracking-wide transition-all duration-0',
          activeSubchainId === s.id
            ? 'bg-accent/20 text-accent'
            : 'text-bone-60 hover:text-foreground hover:bg-white/5'
        )}
      >
        {s.label}
      </button>
    ))}
  </div>
)}

{/* Normal controls — hidden in subchain view */}
{!isSubchainView && (
  <>
    {/* existing: fallback mode toggle button */}
    {/* existing: temp input */}
  </>
)}

{/* Prompt button — always shown, but in subchain view it edits the active subchain prompt */}
<button
  onClick={() => setIsPromptOpen(!isPromptOpen)}
  className={cn(
    'p-1 rounded-sm transition-all duration-0',
    isPromptOpen ? 'bg-accent/20 text-accent' : 'hover:bg-white/5 text-muted-foreground/40 hover:text-foreground'
  )}
  title={isSubchainView ? 'Subchain System Prompt' : 'System Prompt'}
>
  <MessageSquareCode className="w-3.5 h-3.5" />
</button>
```

For the prompt textarea, it already uses `systemPrompt` state. In subchain view it should display and update the active subchain's prompt. Update the textarea's `value` and `onChange`:

```tsx
<textarea
  value={isSubchainView ? (activeSubchain?.system_prompt ?? '') : systemPrompt}
  onChange={(e) =>
    isSubchainView
      ? handleSubchainPromptChange(e.target.value)
      : setSystemPrompt(e.target.value)
  }
  ...
/>
```

And update the save button handler:
```tsx
onClick={isSubchainView ? handleSaveSubchains : handleSavePrompt}
disabled={isSubchainView ? isSavingSubchain : isSavingPrompt}
```

And the label:
```tsx
<label>
  {isSubchainView && activeSubchain
    ? `${activeSubchain.label} — System Prompt`
    : 'System Prompt Override'}
</label>
```

- [ ] **Step 8: Add SubchainView body rows**

In the card body, before the existing `models.map(...)` section, add a conditional that swaps the whole body when `isSubchainView` is true:

```tsx
{isSubchainView ? (
  <div className="flex flex-col gap-1 pb-3">
    {subchains.map(s => (
      <div key={s.id} className="flex items-center gap-3 px-2 py-1.5 rounded-medium hover:bg-white/[0.02]">
        {/* Label */}
        <span className="text-[11px] font-medium text-bone-60 w-[120px] shrink-0 truncate">{s.label}</span>

        {/* Chain category picker */}
        <div className="relative flex-1">
          <select
            value={s.chain_category}
            onChange={(e) => handleSubchainChainChange(s.id, e.target.value as IntentCategory)}
            className="w-full bg-transparent border border-white/10 rounded-sm px-2 py-0.5 text-[11px] font-mono text-bone-100 focus:outline-none focus:ring-1 focus:ring-accent/30 appearance-none cursor-pointer hover:border-white/20 transition-all"
          >
            {ALL_CATEGORIES.map(cat => (
              <option key={cat} value={cat} className="bg-[#0f0f0f] text-bone-100">
                {cat.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-bone-60 opacity-40 pointer-events-none" />
        </div>

        {/* Active subchain indicator */}
        <div
          className={cn(
            'w-1.5 h-1.5 rounded-full shrink-0',
            activeSubchainId === s.id ? 'bg-accent' : 'bg-white/10'
          )}
        />
      </div>
    ))}

    {/* Save bar */}
    <div className="mt-2 px-2 flex justify-end">
      <button
        onClick={handleSaveSubchains}
        disabled={isSavingSubchain}
        className="bg-accent text-background px-3 py-1.5 rounded-medium text-[10px] font-bold tracking-widest hover:brightness-110 transition-all duration-0 uppercase disabled:opacity-50"
      >
        {isSavingSubchain ? 'Saving...' : 'Save Subchains'}
      </button>
    </div>
  </div>
) : (
  /* existing models.map(...) rows */
  <div className="flex flex-col gap-1 pb-3" onDragOver={...} onDrop={...}>
    {models.map(...)}
  </div>
)}
```

Also hide the "Add node" button and the hasChanges save bar in subchain view:

```tsx
{!isSubchainView && (
  <div className="mt-auto px-3 py-1 flex justify-between items-center border-t border-white/[0.03]">
    {/* existing Add node + Commit changes buttons */}
  </div>
)}
```

- [ ] **Step 9: Commit**

```bash
git add src/components/admin/RouterManager.tsx
git commit -m "feat: add subchain view toggle to RouterManager with chain picker and prompt editor"
```

---

## Task 6: Manual verification

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Open Admin > Router**

Navigate to `/admin/router`. Verify:
- The `Layers2` toggle button appears only on the IMAGE_GEN card (not on CLASSIFIER, VISION, etc.)
- Clicking the toggle switches the card to subchain view

- [ ] **Step 3: Verify subchain view header**

In subchain view, confirm:
- "Prompt Expander" and "Image Narration" tabs appear
- Fallback mode / temp controls are hidden
- Prompt (MessageSquareCode) button and toggle button remain

- [ ] **Step 4: Verify subchain rows**

Confirm:
- Two rows: "Prompt Expander" with FAST_SIMPLE selected, "Image Narration" with VISION selected
- Chain category dropdown opens and shows all categories
- Selecting a different category updates the row immediately

- [ ] **Step 5: Verify prompt editing**

- Click "Prompt Expander" tab, open prompt panel → see the Prompt Expander's system prompt
- Switch to "Image Narration" tab → see different system prompt
- Edit a prompt, click Save Subchains → reload page → confirm saved value persists

- [ ] **Step 6: Verify runtime effect**

Change Prompt Expander chain from FAST_SIMPLE to MEDIUM_THINKING (if configured). Generate an image. Check logs — confirm the expansion model comes from MEDIUM_THINKING, not FAST_SIMPLE.

- [ ] **Step 7: Commit any fixes found during verification**

```bash
git add -p
git commit -m "fix: subchain router card post-verification fixes"
```
