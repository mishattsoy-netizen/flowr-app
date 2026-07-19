# AI Settings Tab & User Description Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "AI" tab to the settings page with a "Tell me about yourself" textarea that persists to Supabase, and injects the user's description into the AI's system prompt so the bot knows who the user is.

**Architecture:** The AI settings tab uses the existing `SettingsTab` pattern with a new component (`AISettingsSection`). Data is saved to the `settings` table (key-value, scoped by `owner_id`) via a server action. On each chat request, `chainRouter.ts` fetches the user's description in parallel with other config and injects an `[ABOUT THE USER]` block into the system prompt.

**Tech Stack:** Next.js App Router, Supabase (settings table), Zustand (UI state only), Server Actions, chainRouter system prompt assembly

---

### Task 1: Add `'ai'` to SettingsTab type

**Files:**
- Modify: `src/data/store.types.ts:205`

- [ ] **Step 1: Add `'ai'` to the SettingsTab union type**

From:
```ts
export type SettingsTab = 'profile' | 'interface' | 'account' | 'notifications' | 'integrations' | 'subscription' | 'security' | 'admin' | 'logs' | 'updates';
```

To:
```ts
export type SettingsTab = 'profile' | 'interface' | 'account' | 'notifications' | 'integrations' | 'subscription' | 'security' | 'admin' | 'logs' | 'updates' | 'ai';
```

---

### Task 2: Create server actions for AI user description

**Files:**
- Create: `src/app/settings/ai/actions.ts`

- [ ] **Step 1: Create server actions file**

```ts
'use server'

import { supabaseAdmin } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'

function getUserIdFromRequest(): string | null {
  // Placeholder — the actual auth check happens via supabaseAdmin
  // This function signature will be updated when integrated with auth
  return null
}

export async function getAiUserDescription(userId: string): Promise<string | null> {
  if (!supabaseAdmin) return null

  const { data, error } = await supabaseAdmin
    .from('settings')
    .select('value')
    .eq('key', 'ai_user_description')
    .eq('owner_id', userId)
    .maybeSingle()

  if (error) {
    console.error('[getAiUserDescription]', error)
    return null
  }

  return (data?.value as { description?: string })?.description ?? null
}

export async function saveAiUserDescription(formData: FormData) {
  const userId = formData.get('userId') as string
  const description = formData.get('description') as string

  if (!userId || !supabaseAdmin) {
    return { error: 'Not authenticated or database unavailable' }
  }

  const { error } = await supabaseAdmin
    .from('settings')
    .upsert(
      {
        key: 'ai_user_description',
        value: { description, updated_at: new Date().toISOString() },
        owner_id: userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'owner_id,key' }
    )

  if (error) {
    console.error('[saveAiUserDescription]', error)
    return { error: error.message }
  }

  revalidatePath('/settings/ai')
  return { success: true }
}
```

Wait — the `saveAiUserDescription` needs a proper auth pattern. This action is called from a client component inside the settings page which is rendered under the main app (not a standalone route). Let me use the auth pattern from the existing admin actions. The client should pass `userId` from the auth context.

Let me revise the approach: use a direct server action that takes `userId` and `description` as parameters, since the client component has access to the auth context.

Revised file:

```ts
'use server'

import { supabaseAdmin } from '@/lib/supabase'

export async function getAiUserDescription(userId: string): Promise<string | null> {
  if (!supabaseAdmin) return null

  const { data, error } = await supabaseAdmin
    .from('settings')
    .select('value')
    .eq('key', 'ai_user_description')
    .eq('owner_id', userId)
    .maybeSingle()

  if (error) {
    console.error('[getAiUserDescription]', error)
    return null
  }

  return (data?.value as { description?: string })?.description ?? null
}

export async function saveAiUserDescription(userId: string, description: string): Promise<{ success: boolean; error?: string }> {
  if (!supabaseAdmin) {
    return { success: false, error: 'Database not available' }
  }

  const { error } = await supabaseAdmin
    .from('settings')
    .upsert(
      {
        key: 'ai_user_description',
        value: { description, updated_at: new Date().toISOString() },
        owner_id: userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'owner_id,key' }
    )

  if (error) {
    console.error('[saveAiUserDescription]', error)
    return { success: false, error: error.message }
  }

  return { success: true }
}
```

---

### Task 3: Create AISettingsSection component

**Files:**
- Create: `src/components/settings/AISettingsSection.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { saveAiUserDescription, getAiUserDescription } from '@/app/settings/ai/actions';
import { useStore } from '@/data/store';

export default function AISettingsSection() {
  const { user } = useAuth();
  const [description, setDescription] = useState('');
  const [savedDescription, setSavedDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');

  useEffect(() => {
    if (!user?.id) return;
    setIsLoading(true);
    getAiUserDescription(user.id).then((val) => {
      const text = val ?? '';
      setDescription(text);
      setSavedDescription(text);
      setIsLoading(false);
    }).catch(() => {
      setIsLoading(false);
    });
  }, [user?.id]);

  const handleSave = useCallback(async () => {
    if (!user?.id) return;
    setIsSaving(true);
    setSaveStatus('idle');
    const result = await saveAiUserDescription(user.id, description);
    if (result.success) {
      setSavedDescription(description);
      setSaveStatus('saved');
    } else {
      setSaveStatus('error');
    }
    setIsSaving(false);
  }, [user?.id, description]);

  const hasChanges = description !== savedDescription;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h4 className="text-sm font-semibold text-[var(--bone-100)]">Tell me about yourself</h4>
        <p className="text-xs text-[var(--bone-70)] mt-1">
          Write a short summary about yourself — who you are, what you like, and what you do.
          The AI will use this to personalize its responses.
        </p>
      </div>

      <textarea
        value={description}
        onChange={(e) => { setDescription(e.target.value); setSaveStatus('idle'); }}
        placeholder="e.g. I'm a software engineer who loves hiking, photography, and reading sci-fi. I work at a startup building developer tools..."
        rows={8}
        disabled={isLoading}
        className="w-full bg-[var(--color-bg)] border border-[var(--bone-10)] rounded-[var(--radius-medium)] p-4 text-sm text-[var(--bone-100)] placeholder:text-[var(--bone-30)] resize-y focus:outline-none focus:ring-1 focus:ring-accent/40 focus:border-accent/40 disabled:opacity-50"
      />

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={isSaving || !hasChanges || isLoading || !user?.id}
          className="px-5 py-2 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>

        {saveStatus === 'saved' && (
          <span className="text-xs text-green-500 font-medium">Saved</span>
        )}
        {saveStatus === 'error' && (
          <span className="text-xs text-red-500 font-medium">Failed to save</span>
        )}

        {!hasChanges && savedDescription && saveStatus === 'idle' && (
          <span className="text-xs text-[var(--bone-40)]">No changes</span>
        )}
      </div>
    </div>
  );
}
```

---

### Task 4: Add AI tab to SettingsPage

**Files:**
- Modify: `src/components/settings/SettingsPage.tsx`

- [ ] **Step 1: Add `Bot` to lucide imports**

From:
```ts
import { User, Monitor, Settings as SettingsIcon, LucideIcon, ShieldCheck, Zap, Sun, Moon, Sparkles } from 'lucide-react';
```

To:
```ts
import { User, Monitor, Settings as SettingsIcon, LucideIcon, ShieldCheck, Zap, Sun, Moon, Sparkles, Bot } from 'lucide-react';
```

- [ ] **Step 2: Import AISettingsSection**

After the existing imports:
```ts
import AISettingsSection from '@/components/settings/AISettingsSection';
```

- [ ] **Step 3: Add AI tab to the tabs array**

From:
```ts
const tabs: { id: SettingsTab | 'admin'; label: string; icon: LucideIcon }[] = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'interface', label: 'Interface', icon: Monitor },
  { id: 'account', label: 'Account', icon: SettingsIcon },
  { id: 'updates', label: "What's New", icon: Sparkles },
  ...(isAdmin ? [{ id: 'admin' as const, label: 'Admin Suite', icon: ShieldCheck }] : []),
];
```

To:
```ts
const tabs: { id: SettingsTab | 'admin'; label: string; icon: LucideIcon }[] = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'interface', label: 'Interface', icon: Monitor },
  { id: 'account', label: 'Account', icon: SettingsIcon },
  { id: 'ai', label: 'AI', icon: Bot },
  { id: 'updates', label: "What's New", icon: Sparkles },
  ...(isAdmin ? [{ id: 'admin' as const, label: 'Admin Suite', icon: ShieldCheck }] : []),
];
```

- [ ] **Step 4: Add description text for the AI tab**

In the description section:
```ts
{activeTab === 'ai' && "Configure AI behavior, personal preferences, and memory settings."}
```

- [ ] **Step 5: Add conditional rendering for AI content**

Inside the content div, after the account block:
```tsx
{activeTab === 'ai' && <AISettingsSection />}
```

---

### Task 5: Add AI tab to SettingsModal

**Files:**
- Modify: `src/components/modals/SettingsModal.tsx`

- [ ] **Step 1: Add `Bot` to lucide imports**

From:
```ts
import { X, User, Monitor, Zap, Settings as SettingsIcon, LucideIcon, ShieldCheck, Sparkles } from 'lucide-react';
```

To:
```ts
import { X, User, Monitor, Zap, Settings as SettingsIcon, LucideIcon, ShieldCheck, Sparkles, Bot } from 'lucide-react';
```

- [ ] **Step 2: Import AISettingsSection**

After the existing imports:
```ts
import AISettingsSection from '@/components/settings/AISettingsSection';
```

- [ ] **Step 3: Add AI tab to the tabs array**

From:
```ts
const tabs: { id: SettingsTab | 'admin'; label: string; icon: LucideIcon }[] = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'interface', label: 'Interface', icon: Monitor },
  { id: 'account', label: 'Account', icon: SettingsIcon },
  { id: 'updates', label: "What's New", icon: Sparkles },
  ...(isAdmin ? [{ id: 'admin' as const, label: 'Admin Suite', icon: ShieldCheck }] : []),
];
```

To:
```ts
const tabs: { id: SettingsTab | 'admin'; label: string; icon: LucideIcon }[] = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'interface', label: 'Interface', icon: Monitor },
  { id: 'account', label: 'Account', icon: SettingsIcon },
  { id: 'ai', label: 'AI', icon: Bot },
  { id: 'updates', label: "What's New", icon: Sparkles },
  ...(isAdmin ? [{ id: 'admin' as const, label: 'Admin Suite', icon: ShieldCheck }] : []),
];
```

- [ ] **Step 4: Add conditional rendering for AI content**

Inside the content div, after the account block:
```tsx
{activeTab === 'ai' && <AISettingsSection />}
```

---

### Task 6: Inject user description into AI system prompt

**Files:**
- Modify: `src/lib/bot/chainRouter.ts`

- [ ] **Step 1: Import `getAiUserDescription`**

After the existing imports at the top:
```ts
import { getAiUserDescription } from '@/app/settings/ai/actions'
```

- [ ] **Step 2: Add user description fetch to parallel Promise.all**

At line 258, change:
```ts
const [sessionState, globalPrompt, fallbackModes, pipelineSettings] = await Promise.all([
  getSessionState(sessionId),
  getCompiledPrompt(context?.mode ?? 'default'),
  getFallbackModes(),
  getPipelineSettings(),
])
```

To:
```ts
const [sessionState, globalPrompt, fallbackModes, pipelineSettings, userDescription] = await Promise.all([
  getSessionState(sessionId),
  getCompiledPrompt(context?.mode ?? 'default'),
  getFallbackModes(),
  getPipelineSettings(),
  context?.userId ? getAiUserDescription(context.userId) : null,
])
```

- [ ] **Step 3: Inject `[ABOUT THE USER]` block into the system prompt**

After the global prompt injection (line 737), add:
```ts
// Inject user's personal description if available
if (userDescription) {
  finalSysPrompt += `\n\n[ABOUT THE USER]\nThe following is what the user has shared about themselves. Use this information to personalize your responses and understand who they are:\n${userDescription}\n`
}
```

So the relevant section becomes:
```ts
if (globalPrompt && isGlobalPromptEnabled) finalSysPrompt += "\n\n" + globalPrompt
// Inject user's personal description if available
if (userDescription) {
  finalSysPrompt += `\n\n[ABOUT THE USER]\nThe following is what the user has shared about themselves. Use this information to personalize your responses and understand who they are:\n${userDescription}\n`
}
// Skip internal pipeline prompt for chains that have their own router override —
```

---

### Task 7: Add `aiUserDescription` to Zustand store (UI convenience)

**Files:**
- Modify: `src/data/store.ts`

This is optional — the server action already persists to DB. We add it to the store for reactive UI (to show current value without fetching on every render). But since the component already fetches from DB on mount via server action, we don't strictly need it. Skipping this keeps things simpler.

---

### Implementation Order

1. Task 1: Add `'ai'` to SettingsTab type
2. Task 2: Create server actions
3. Task 3: Create AISettingsSection component
4. Task 4: Add AI tab to SettingsPage
5. Task 5: Add AI tab to SettingsModal
6. Task 6: Inject user description into chainRouter
