# About the Creator Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a second "About the Creator & App" textarea in the AI settings that saves to the DB and injects as `[ABOUT THE CREATOR]` in the system prompt, alongside the existing `[ABOUT THE USER]`.

**Architecture:** Reuses the existing `settings` table with a new key `'ai_creator_info'`. Same pattern as `ai_user_description` — server actions, component textarea, parallel fetch in chainRouter.

---

### Task 1: Add server actions for creator info

**Files:**
- Modify: `src/app/settings/ai/actions.ts`

Add two new exported functions following the exact same pattern as `getAiUserDescription` / `saveAiUserDescription`:

```ts
export async function getAiCreatorInfo(userId: string): Promise<string | null> {
  if (!supabaseAdmin) return null
  const { data, error } = await supabaseAdmin
    .from('settings')
    .select('value')
    .eq('key', 'ai_creator_info')
    .eq('owner_id', userId)
    .maybeSingle()
  if (error) {
    console.error('[getAiCreatorInfo]', error)
    return null
  }
  return (data?.value as { description?: string })?.description ?? null
}

export async function saveAiCreatorInfo(userId: string, description: string): Promise<{ success: boolean; error?: string }> {
  if (!supabaseAdmin) return { success: false, error: 'Database not available' }
  const { error } = await supabaseAdmin
    .from('settings')
    .upsert(
      {
        key: 'ai_creator_info',
        value: { description, updated_at: new Date().toISOString() },
        owner_id: userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'owner_id,key' }
    )
  if (error) {
    console.error('[saveAiCreatorInfo]', error)
    return { success: false, error: error.message }
  }
  return { success: true }
}
```

---

### Task 2: Add creator textarea to AISettingsSection

**Files:**
- Modify: `src/components/settings/AISettingsSection.tsx`

Import the two new server actions and add a second textarea section below the existing one, separated by a border. Same save/load pattern, same styling, different copy.

The component should now manage two independent state sets (user description + creator info), each with their own save status, loading state, etc.

```tsx
import { saveAiUserDescription, getAiUserDescription, saveAiCreatorInfo, getAiCreatorInfo } from '@/app/settings/ai/actions';
```

Add after the "Tell me about yourself" section's closing `</div>`:

```tsx
      {/* Divider */}
      <hr className="border-[var(--bone-6)]" />

      {/* Creator Section */}
      <div>
        <h4 className="text-sm font-semibold text-[var(--bone-100)]">About the Creator & App</h4>
        <p className="text-xs text-[var(--bone-70)] mt-1">
          Information about who built Flowr and what it stands for. The AI uses this to
          understand the product's vision and philosophy.
        </p>
      </div>

      <textarea
        value={creatorDescription}
        onChange={(e) => { setCreatorDescription(e.target.value); setCreatorSaveStatus('idle'); }}
        placeholder="About the creator and app..."
        rows={8}
        disabled={isCreatorLoading}
        className="w-full bg-[var(--color-bg)] border border-[var(--bone-10)] rounded-[var(--radius-medium)] p-4 text-sm text-[var(--bone-100)] placeholder:text-[var(--bone-30)] resize-y focus:outline-none focus:ring-1 focus:ring-accent/40 focus:border-accent/40 disabled:opacity-50"
      />

      <div className="flex items-center gap-3">
        <button
          onClick={handleCreatorSave}
          disabled={isCreatorSaving || !creatorHasChanges || isCreatorLoading || !user?.id}
          className="px-5 py-2 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isCreatorSaving ? 'Saving...' : 'Save'}
        </button>
        {creatorSaveStatus === 'saved' && (
          <span className="text-xs text-green-500 font-medium">Saved</span>
        )}
        {creatorSaveStatus === 'error' && (
          <span className="text-xs text-red-500 font-medium">Failed to save</span>
        )}
        {!creatorHasChanges && savedCreatorDescription && creatorSaveStatus === 'idle' && (
          <span className="text-xs text-[var(--bone-40)]">No changes</span>
        )}
      </div>
```

State additions:
```ts
const [creatorDescription, setCreatorDescription] = useState('');
const [savedCreatorDescription, setSavedCreatorDescription] = useState('');
const [isCreatorSaving, setIsCreatorSaving] = useState(false);
const [isCreatorLoading, setIsCreatorLoading] = useState(true);
const [creatorSaveStatus, setCreatorSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
```

---

### Task 3: Inject `[ABOUT THE CREATOR]` into system prompt

**Files:**
- Modify: `src/lib/bot/chainRouter.ts`

Import the new action alongside the existing one:

```ts
import { getAiUserDescription, getAiCreatorInfo } from '@/app/settings/ai/actions'
```

Add `creatorInfo` to the parallel fetch:

```ts
const [sessionState, globalPrompt, fallbackModes, pipelineSettings, userDescription, creatorInfo] = await Promise.all([
  ...
  context?.userId ? getAiCreatorInfo(context.userId) : null,
])
```

Inject `[ABOUT THE CREATOR]` right after `[ABOUT THE USER]`:

```ts
  if (userDescription) {
    finalSysPrompt += `\n\n[ABOUT THE USER]\n...`
  }
  if (creatorInfo) {
    finalSysPrompt += `\n\n[ABOUT THE CREATOR]\n${creatorInfo}\n`
  }
```

Pre-filled content to seed the DB (by the creator/you): use the approved text from the discussion.

---

### Self-Review

**Spec coverage:**
- Server action to read creator info from DB ✓ (Task 1 - getAiCreatorInfo)
- Server action to write creator info to DB ✓ (Task 1 - saveAiCreatorInfo)
- UI textarea + save button ✓ (Task 2)
- `[ABOUT THE CREATOR]` block injected in system prompt ✓ (Task 3)
- Pre-filled content ✓ (approved in discussion)

**No placeholders.** All code is specified inline.

**Type consistency:** Function names match between server actions, component imports, and chainRouter imports.
