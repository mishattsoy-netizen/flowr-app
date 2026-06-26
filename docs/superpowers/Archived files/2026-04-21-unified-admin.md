# Unified Admin & AI Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify the Flowr web app and Telegram bot under one admin panel with per-platform router configuration, shared vault/users/analytics, and a unified AI engine (`runChain`) powering the app's chat.

**Architecture:** Add a `platform` column to `router_chains` so App and Telegram Bot each have independent model chains per intent category. The admin sidebar restructures to collapsible App/Telegram sections. The app's `sendAIMessage` is replaced with a call to a new `/api/ai/chat` route that runs `runChain` with `platform: 'app'`. A new `user_quotas` table tracks app-side daily usage independently from Telegram's `telegram_users` counter.

**Tech Stack:** Next.js 15 App Router, Supabase (supabaseAdmin for server actions), Zustand store, TypeScript, Tailwind CSS, Lucide icons.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `supabase/migrations/20260421_add_platform_column.sql` | Create | Add `platform` column + app router rows |
| `src/lib/router-config.ts` | Modify | Add `platform` param to `getRouterChain` |
| `src/lib/bot/chainRouter.ts` | Modify | Add `platform` param to `runChain`, pass to `getRouterChain` |
| `src/app/admin/router/actions.ts` | Modify | Filter `getRouterChains` by platform, update signature |
| `src/app/admin/router/page.tsx` | Modify | Accept `platform` searchParam, pass to `RouterManager` |
| `src/components/admin/RouterManager.tsx` | Modify | Accept `platform` prop, pass chain id to save |
| `src/components/admin/Sidebar.tsx` | Modify | Collapsible App/Telegram sections |
| `src/app/admin/app/router/page.tsx` | Create | App Router page (delegates to RouterPage with platform='app') |
| `src/app/admin/telegram/router/page.tsx` | Create | Telegram Router page (delegates with platform='telegram') |
| `src/app/api/ai/chat/route.ts` | Create | New unified AI chat API route using `runChain` |
| `src/data/store.ts` | Modify | Replace `sendAIMessage` implementation with fetch to `/api/ai/chat` |
| `supabase/migrations/20260421_user_quotas.sql` | Create | `user_quotas` table for app users |

---

## Task 1: DB Migration — Add `platform` Column to `router_chains`

**Files:**
- Create: `supabase/migrations/20260421_add_platform_column.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260421_add_platform_column.sql

-- Add platform column (default 'telegram' so existing rows stay valid)
ALTER TABLE router_chains ADD COLUMN IF NOT EXISTS platform TEXT NOT NULL DEFAULT 'telegram';

-- Drop old unique constraint on category alone
ALTER TABLE router_chains DROP CONSTRAINT IF EXISTS router_chains_category_key;

-- New unique constraint: one row per (category, platform) pair
ALTER TABLE router_chains ADD CONSTRAINT router_chains_category_platform_key
  UNIQUE (category, platform);

-- Mark existing rows explicitly as telegram
UPDATE router_chains SET platform = 'telegram' WHERE platform = 'telegram';

-- Seed App rows (same 7 categories, lighter default models)
INSERT INTO router_chains (category, platform, model_list, system_prompt) VALUES
('FAST_SIMPLE', 'app', '[
  {"id": "gemini-2.5-flash-lite", "provider": "google", "is_enabled": true},
  {"id": "llama-3.1-8b-instant",  "provider": "groq",   "is_enabled": true}
]'::jsonb, 'You are Flowr AI, a fast and helpful assistant. Be concise.'),

('COMPLEX_THINKING', 'app', '[
  {"id": "gemini-2.5-flash",           "provider": "google", "is_enabled": true},
  {"id": "llama-3.3-70b-versatile",    "provider": "groq",   "is_enabled": true}
]'::jsonb, 'You are Flowr AI. Think step by step and provide thorough answers.'),

('MEDIUM_THINKING', 'app', '[
  {"id": "gemini-2.5-flash",           "provider": "google", "is_enabled": true},
  {"id": "llama-3.3-70b-versatile",    "provider": "groq",   "is_enabled": true}
]'::jsonb, null),

('IMAGE_GEN', 'app', '[
  {"id": "black-forest-labs/FLUX.1-schnell", "provider": "huggingface", "is_enabled": true}
]'::jsonb, null),

('WEB_SEARCH', 'app', '[
  {"id": "tavily-search",    "provider": "vault",  "is_enabled": true},
  {"id": "gemini-2.5-flash", "provider": "google", "is_enabled": true}
]'::jsonb, null),

('AUDIO_VOICE', 'app', '[
  {"id": "whisper-large-v3-turbo", "provider": "groq",   "is_enabled": true},
  {"id": "gemini-2.5-flash",       "provider": "google", "is_enabled": true}
]'::jsonb, null),

('TOOL_CALLING', 'app', '[
  {"id": "gemini-2.5-flash", "provider": "google", "is_enabled": true}
]'::jsonb, null)

ON CONFLICT (category, platform) DO NOTHING;
```

- [ ] **Step 2: Run the migration in Supabase SQL editor**

Copy the file contents into the Supabase dashboard → SQL Editor → Run.

Expected: no errors. Run `SELECT category, platform FROM router_chains ORDER BY platform, category;` — you should see 14 rows (7 telegram + 7 app).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260421_add_platform_column.sql
git commit -m "feat: add platform column to router_chains, seed app rows"
```

---

## Task 2: DB Migration — `user_quotas` Table

**Files:**
- Create: `supabase/migrations/20260421_user_quotas.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260421_user_quotas.sql

CREATE TABLE IF NOT EXISTS user_quotas (
  auth_user_id        UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  messages_used_today INT  NOT NULL DEFAULT 0,
  last_reset_date     DATE NOT NULL DEFAULT CURRENT_DATE
);
```

- [ ] **Step 2: Run the migration in Supabase SQL editor**

Expected: table `user_quotas` created with no errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260421_user_quotas.sql
git commit -m "feat: add user_quotas table for app-side daily quota tracking"
```

---

## Task 3: Update `getRouterChain` to Accept Platform

**Files:**
- Modify: `src/lib/router-config.ts`

- [ ] **Step 1: Update `getRouterChain` signature and query**

Replace the entire file contents:

```typescript
import { supabase } from './supabase'

export interface RouterModel {
  id: string
  provider: 'google' | 'huggingface' | 'cloudflare' | 'groq' | 'local' | 'vault'
  is_enabled: boolean
}

export type IntentCategory = 
  | 'FAST_SIMPLE' 
  | 'COMPLEX_THINKING' 
  | 'MEDIUM_THINKING' 
  | 'AUDIO_VOICE' 
  | 'TOOL_CALLING' 
  | 'IMAGE_GEN' 
  | 'WEB_SEARCH'

export type Platform = 'app' | 'telegram'

export async function getRouterChain(
  category: IntentCategory,
  platform: Platform = 'telegram'
): Promise<{ chain: RouterModel[], system_prompt?: string }> {
  const { data, error } = await supabase
    .from('router_chains')
    .select('model_list, system_prompt')
    .eq('category', category)
    .eq('platform', platform)
    .maybeSingle()

  if (error || !data) {
    console.warn(`No router chain found for category: ${category}, platform: ${platform}.`)
    return { chain: [] }
  }

  return {
    chain: (data.model_list as RouterModel[]).filter(m => m.is_enabled),
    system_prompt: (data as any).system_prompt || undefined
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors related to `router-config.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/router-config.ts
git commit -m "feat: add platform param to getRouterChain"
```

---

## Task 4: Update `runChain` to Accept and Pass Platform

**Files:**
- Modify: `src/lib/bot/chainRouter.ts`

- [ ] **Step 1: Update `runChain` signature**

Replace the function signature and the `getRouterChain` call:

```typescript
import { classifyIntent } from './classifier'
import { getRouterChain, Platform } from '../router-config'
import { logger } from '../logger'
import { runGoogle } from './providers/google'
import { runGroq } from './providers/groq'
import { runHuggingFace } from './providers/huggingface'
import { runWebSearchChain } from './providers/tavily'
import { getConversationMemory } from './memory'

export interface ChainResponse {
  type: 'text' | 'photo'
  content: string | Buffer
  usage_type?: 'chat' | 'tool' | 'search' | 'vision'
}

export async function runChain(
  prompt: string, 
  inputBuffer?: Buffer, 
  context?: { chatId?: number; userId?: string; platform?: Platform }
): Promise<ChainResponse> {
  const platform: Platform = context?.platform ?? 'telegram'
  const history = context?.chatId ? await getConversationMemory(context.chatId) : []
  
  // 1. Specialized Vision Flow
  if (inputBuffer) {
    const visionRes = await runGoogle('gemini-1.5-flash', prompt || "Analyze this.", undefined, inputBuffer, context?.chatId ? { chatId: context.chatId } : undefined, history)
    return { type: 'text', content: visionRes || "Analyzer failed.", usage_type: 'vision' }
  }

  // 2. Standard Routing Flow
  const category = await classifyIntent(prompt)
  const { chain, system_prompt } = await getRouterChain(category, platform)

  let finalUsageType: 'chat' | 'tool' | 'search' | 'vision' = 'chat'
  if (category === 'WEB_SEARCH') finalUsageType = 'search'

  for (const modelConfig of chain) {
    if (!modelConfig.is_enabled) continue

    try {
      let response: string | Buffer | null = null

      switch (modelConfig.provider) {
        case 'google':
          response = await runGoogle(modelConfig.id, prompt, system_prompt, undefined, context?.chatId ? { chatId: context.chatId } : undefined, history)
          break
        case 'groq':
          response = await runGroq(modelConfig.id, prompt, system_prompt)
          break
        case 'huggingface':
          response = await runHuggingFace(modelConfig.id, prompt)
          break
        case 'vault':
          if (modelConfig.id === 'tavily-search') response = await runWebSearchChain(prompt)
          break
      }

      if (response) {
        return {
          type: category === 'IMAGE_GEN' ? 'photo' : 'text',
          content: response as any,
          usage_type: finalUsageType
        }
      }
    } catch (error: any) {
      logger.warn(`Failure [${modelConfig.id}]: ${error.message}`)
    }
  }

  return { type: 'text', content: "⚡ *System Overload*", usage_type: 'chat' }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors. The Telegram webhook handler passes `{ chatId }` — that still works because `chatId` is still in the context shape.

- [ ] **Step 3: Commit**

```bash
git add src/lib/bot/chainRouter.ts
git commit -m "feat: add platform param to runChain, pass to getRouterChain"
```

---

## Task 5: Update Router Admin Actions to Filter by Platform

**Files:**
- Modify: `src/app/admin/router/actions.ts`

- [ ] **Step 1: Add platform filter to `getRouterChains` and keep `updateRouterChain` as-is**

```typescript
'use server'

import { supabaseAdmin as supabase } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'

export async function getRouterChains(platform: 'app' | 'telegram') {
  const { data, error } = await supabase
    .from('router_chains')
    .select('*')
    .eq('platform', platform)
    .order('category', { ascending: true })

  if (error) throw error
  return data
}

export async function updateRouterChain(id: string, modelList: any[]) {
  const { error } = await supabase
    .from('router_chains')
    .update({ 
      model_list: modelList,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)

  if (error) throw error
  revalidatePath('/admin/app/router')
  revalidatePath('/admin/telegram/router')
  return { success: true }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/admin/router/actions.ts
git commit -m "feat: filter getRouterChains by platform, revalidate both router paths"
```

---

## Task 6: Create Per-Platform Router Pages

**Files:**
- Create: `src/app/admin/app/router/page.tsx`
- Create: `src/app/admin/telegram/router/page.tsx`
- Modify: `src/app/admin/router/page.tsx` (extract shared RouterPage component)

- [ ] **Step 1: Refactor `src/app/admin/router/page.tsx` into a reusable async component**

Replace the file:

```typescript
import { getRouterChains } from '../actions'
import RouterManager from '@/components/admin/RouterManager'
import { Cpu, Command, Share2, Zap, Wand2, Image, Mic } from 'lucide-react'

const CATEGORY_ICONS: Record<string, any> = {
  TOOL_CALLING: Command,
  WEB_SEARCH: Share2,
  FAST_SIMPLE: Zap,
  MEDIUM_THINKING: Wand2,
  COMPLEX_THINKING: Cpu,
  IMAGE_GEN: Image,
  AUDIO_VOICE: Mic
}

export async function RouterPageContent({ platform }: { platform: 'app' | 'telegram' }) {
  const routers = await getRouterChains(platform)

  return (
    <div className="space-y-[10px] animate-in fade-in duration-500">
      <div className="flex flex-col gap-1.5 mb-2">
        <h1 className="text-3xl font-bold tracking-tight text-bone-100 font-instrument">Router Orchestration</h1>
        <p className="text-bone-60 text-[11px] font-bold tracking-tight opacity-60">
          {platform === 'app' ? 'Web app' : 'Telegram bot'} — real-time switching matrix for multi-agent model chains.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-[10px]">
        {routers.map((router: any) => {
          const Icon = CATEGORY_ICONS[router.category] || Cpu
          return (
            <div key={router.id} className="space-y-[6px]">
              <div className="flex items-center gap-2.5 px-6 pt-2">
                <Icon className="w-3.5 h-3.5 text-accent" strokeWidth={1.5} />
                <h3 className="text-[10px] font-black text-bone-60 tracking-[0.1em] uppercase opacity-50">
                  {router.category.replace(/_/g, ' ')} Registry
                </h3>
              </div>
              <RouterManager chain={router} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default async function RouterPage() {
  return <RouterPageContent platform="telegram" />
}
```

- [ ] **Step 2: Create `src/app/admin/app/router/page.tsx`**

```typescript
import { RouterPageContent } from '../../router/page'

export default async function AppRouterPage() {
  return <RouterPageContent platform="app" />
}
```

- [ ] **Step 3: Create `src/app/admin/telegram/router/page.tsx`**

```typescript
import { RouterPageContent } from '../../router/page'

export default async function TelegramRouterPage() {
  return <RouterPageContent platform="telegram" />
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/router/page.tsx src/app/admin/app/router/page.tsx src/app/admin/telegram/router/page.tsx
git commit -m "feat: create per-platform router pages for app and telegram"
```

---

## Task 7: Restructure Admin Sidebar (Option B — Collapsible Platform Sections)

**Files:**
- Modify: `src/components/admin/Sidebar.tsx`

- [ ] **Step 1: Replace Sidebar with collapsible platform sections**

```typescript
'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  LayoutGrid, 
  Cpu, 
  ShieldCheck, 
  Users, 
  Zap, 
  Activity,
  Settings,
  ChevronDown,
  Smartphone,
  Bot
} from 'lucide-react'
import { cn } from '@/lib/utils'

const SHARED_ITEMS = [
  { name: 'Vault', href: '/admin/vault', icon: ShieldCheck },
  { name: 'Users', href: '/admin/users', icon: Users },
  { name: 'Presets', href: '/admin/presets', icon: Zap },
  { name: 'Analytics', href: '/admin/analytics', icon: Activity },
]

const APP_ITEMS = [
  { name: 'Router', href: '/admin/app/router', icon: Cpu },
]

const TELEGRAM_ITEMS = [
  { name: 'Router', href: '/admin/telegram/router', icon: Cpu },
]

function NavLink({ href, icon: Icon, name }: { href: string; icon: any; name: string }) {
  const pathname = usePathname()
  const isActive = pathname === href

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-4 px-5 py-4 rounded-medium group text-[13px] font-bold border",
        isActive
          ? "bg-accent/10 text-accent border-accent/20 shadow-[inset_0_0_20px_rgba(224,153,82,0.02)]"
          : "text-bone-60 hover:text-bone-100 hover:bg-bone-hover border-transparent"
      )}
    >
      <Icon
        className={cn("w-5 h-5", isActive ? "text-accent" : "text-bone-60 group-hover:text-bone-100")}
        strokeWidth={1.5}
      />
      <span className={cn(isActive ? "tracking-tight" : "tracking-normal")}>{name}</span>
    </Link>
  )
}

function PlatformSection({
  label,
  icon: Icon,
  items,
  defaultOpen,
}: {
  label: string
  icon: any
  items: typeof APP_ITEMS
  defaultOpen: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-2 text-[10px] font-black text-bone-60 tracking-[0.1em] uppercase hover:text-bone-100"
      >
        <Icon className="w-3.5 h-3.5" strokeWidth={2} />
        <span className="flex-1 text-left">{label}</span>
        <ChevronDown className={cn("w-3 h-3 transition-transform duration-200", open && "rotate-180")} />
      </button>
      {open && (
        <div className="pl-4 space-y-1 mt-1">
          {items.map(item => (
            <NavLink key={item.href} {...item} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function Sidebar() {
  const pathname = usePathname()
  const isOverviewActive = pathname === '/admin'

  return (
    <div className="w-72 bg-panel flex flex-col h-full border-r border-white/5 relative z-50">
      <div className="p-10 flex items-center gap-4">
        <div className="w-10 h-10 flex items-center justify-center p-2 rounded-regular border border-bone bg-background shadow-[0_0_20px_rgba(233,233,226,0.05)]">
          <img src="/Logo.svg" alt="Logo" className="w-full h-full object-contain" />
        </div>
        <div className="flex flex-col -gap-1">
          <span className="font-black text-xl text-bone-100 tracking-tighter leading-none">Flowr AI</span>
          <span className="text-[10px] font-black text-bone-60 tracking-[0.05em] mt-1">Admin Suite</span>
        </div>
      </div>

      <nav className="flex-1 px-6 space-y-2 mt-4 overflow-y-auto">
        {/* Overview */}
        <NavLink href="/admin" icon={LayoutGrid} name="Overview" />

        {/* Platform sections */}
        <div className="pt-2 space-y-1">
          <PlatformSection
            label="App"
            icon={Smartphone}
            items={APP_ITEMS}
            defaultOpen={pathname.startsWith('/admin/app')}
          />
          <PlatformSection
            label="Telegram Bot"
            icon={Bot}
            items={TELEGRAM_ITEMS}
            defaultOpen={pathname.startsWith('/admin/telegram')}
          />
        </div>

        {/* Divider */}
        <div className="h-px bg-white/5 my-3" />

        {/* Shared sections */}
        <div className="space-y-1">
          <div className="text-[10px] font-black text-bone-60 tracking-[0.1em] mb-2 px-4 uppercase opacity-50">Shared</div>
          {SHARED_ITEMS.map(item => (
            <NavLink key={item.href} {...item} />
          ))}
        </div>
      </nav>

      <div className="p-8 border-t border-white/5 bg-background/20">
        <Link
          href="/admin/settings"
          className="flex items-center gap-4 px-5 py-3 text-[13px] font-bold text-bone-60 rounded-medium hover:text-bone-100 hover:bg-bone-hover group"
        >
          <Settings className="w-5 h-5 text-bone-60 group-hover:text-bone-100" strokeWidth={1.5} />
          Settings node
        </Link>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Start dev server and verify sidebar renders correctly**

```bash
npm run dev
```

Open http://localhost:3000/admin. Check:
- "App" section is collapsible, expands to show Router link pointing to `/admin/app/router`
- "Telegram Bot" section is collapsible, expands to show Router link pointing to `/admin/telegram/router`
- Vault, Users, Presets, Analytics appear below divider
- Active route highlights correctly

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/Sidebar.tsx
git commit -m "feat: restructure sidebar with collapsible App/Telegram platform sections"
```

---

## Task 8: Create `/api/ai/chat` Route

**Files:**
- Create: `src/app/api/ai/chat/route.ts`

- [ ] **Step 1: Create the route**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { runChain } from '@/lib/bot/chainRouter'
import { supabaseAdmin } from '@/lib/supabase'

const DEFAULT_DAILY_LIMIT = 50

async function checkAndIncrementQuota(authUserId: string): Promise<{ allowed: boolean }> {
  const today = new Date().toISOString().split('T')[0]

  const { data: existing } = await supabaseAdmin
    .from('user_quotas')
    .select('messages_used_today, last_reset_date')
    .eq('auth_user_id', authUserId)
    .maybeSingle()

  const needsReset = !existing || existing.last_reset_date < today
  const currentCount = needsReset ? 0 : existing.messages_used_today

  if (currentCount >= DEFAULT_DAILY_LIMIT) {
    return { allowed: false }
  }

  await supabaseAdmin
    .from('user_quotas')
    .upsert({
      auth_user_id: authUserId,
      messages_used_today: currentCount + 1,
      last_reset_date: today
    })

  return { allowed: true }
}

export async function POST(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { prompt, buffer } = await req.json()

  if (!prompt || typeof prompt !== 'string') {
    return NextResponse.json({ error: 'prompt is required' }, { status: 400 })
  }

  const { allowed } = await checkAndIncrementQuota(user.id)
  if (!allowed) {
    return NextResponse.json(
      { error: 'Daily message limit reached. Try again tomorrow.' },
      { status: 429 }
    )
  }

  const result = await runChain(
    prompt,
    buffer ? Buffer.from(buffer, 'base64') : undefined,
    { userId: user.id, platform: 'app' }
  )

  return NextResponse.json({ content: result.content, type: result.type, usage_type: result.usage_type })
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/ai/chat/route.ts
git commit -m "feat: add /api/ai/chat route using runChain with app platform and quota enforcement"
```

---

## Task 9: Replace `sendAIMessage` in Store

**Files:**
- Modify: `src/data/store.ts`

This is the biggest and most sensitive task. `sendAIMessage` in `store.ts` is a large function (~1000 lines) that handles Gemini key rotation, streaming, tool calls, etc. We replace the entire implementation body with a simple fetch to `/api/ai/chat`. The surrounding state shape (messages, loading) stays the same.

- [ ] **Step 1: Read the current sendAIMessage function to find exact line boundaries**

Open `src/data/store.ts`. Search for `sendAIMessage:` — it starts the function. Note the line number where it starts and where the next top-level key begins (e.g., `setAIFlowrMode`). You will replace only the function body, not the surrounding store keys.

- [ ] **Step 2: Replace the sendAIMessage implementation**

Find the `sendAIMessage` key in the store. Replace the entire function with:

```typescript
sendAIMessage: async (content: string, agentEnabled = false, attachments = []) => {
  const { aiMessages } = get()

  const userMessage: AIMessage = {
    id: crypto.randomUUID(),
    role: 'user',
    content,
    timestamp: Date.now(),
    attachments,
  }

  set({ aiMessages: [...aiMessages, userMessage], isAILoading: true })

  try {
    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: content }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Request failed' }))
      const errorMessage: AIMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: err.error || 'Something went wrong.',
        timestamp: Date.now(),
      }
      set(s => ({ aiMessages: [...s.aiMessages, errorMessage], isAILoading: false }))
      return
    }

    const data = await res.json()
    const assistantMessage: AIMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: data.content,
      timestamp: Date.now(),
    }
    set(s => ({ aiMessages: [...s.aiMessages, assistantMessage], isAILoading: false }))
  } catch {
    const errorMessage: AIMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: 'Connection error. Please try again.',
      timestamp: Date.now(),
    }
    set(s => ({ aiMessages: [...s.aiMessages, errorMessage], isAILoading: false }))
  }
},
```

- [ ] **Step 3: Remove now-unused AI runtime state from the initial state object**

In the initial state object, remove these fields (search and delete each):
- `aiRuntime`
- `localModel`
- `localModels`
- `localEndpoint`
- `aiGemmaMode`
- `aiFlowrMode`
- `aiModel`
- `aiGroqKey`
- `aiGeminiKey`
- `aiGeminiKeys`
- `aiGeminiKeyIndex`
- `geminiQuotaModels`
- `geminiModelIndex`
- `aiRoutingMode`
- `hybridManualModel`
- `flowRouterConfig`
- `priorityModels`
- `aiCloudModels`
- `aiRequestLog`
- `isLocalEnabled`
- `isLocalOnline`

Also remove the corresponding setter functions if they exist (e.g., `setAIFlowrMode`, `setAIGemmaMode`, `setAIFlowrManualId`, `setAIGemmaManualId`).

**IMPORTANT:** Before removing each field, grep for its usage in components:

```bash
grep -r "aiRuntime\|localModel\|aiGemmaMode\|aiFlowrMode\|aiModel\|flowRouterConfig" src/components src/app --include="*.tsx" --include="*.ts" -l
```

If any component references a removed field, note the file — you will fix it in Task 10.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Fix any type errors from removed state fields. If a component accesses a removed store field, either remove the reference or replace it with a static value.

- [ ] **Step 5: Commit**

```bash
git add src/data/store.ts
git commit -m "feat: replace sendAIMessage with /api/ai/chat fetch, remove legacy runtime state"
```

---

## Task 10: Clean Up AI UI Components

**Files:**
- Modify: Any components referencing removed store fields (found in Task 9 Step 3 grep)

- [ ] **Step 1: Find all components using removed fields**

```bash
grep -r "aiRuntime\|localModel\|aiGemmaMode\|aiFlowrMode\|aiModel\|isLocalEnabled\|isLocalOnline\|aiGroqKey\|aiGeminiKey\|flowRouterConfig\|aiRoutingMode" src/components src/app --include="*.tsx" --include="*.ts" -n
```

- [ ] **Step 2: For each file found, remove the model picker UI and references**

The AI assistant header/settings panel likely has a model selector dropdown. Remove it and replace with a static "Flowr AI" label. Example pattern — if you find something like:

```tsx
<select value={aiModel} onChange={...}>
  <option value="flowr/hybrid-free">Flowr AI</option>
  <option value="flowr/flow-1.0">Flow 1.0</option>
  ...
</select>
```

Replace with:

```tsx
<span className="text-[13px] font-bold text-bone-60">Flowr AI</span>
```

For any `useStore` calls that destructure removed fields, remove those destructured names from the call.

- [ ] **Step 3: Verify TypeScript compiles with no errors**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Start dev server and manually test the chat**

```bash
npm run dev
```

Open http://localhost:3000. Open the AI assistant. Send a message. Verify:
- Message appears in chat
- "Flowr AI" response arrives (routed through `runChain` via `/api/ai/chat`)
- No model picker visible
- No console errors

- [ ] **Step 5: Commit**

```bash
git add src/components src/app
git commit -m "feat: remove model picker UI, show Flowr AI label only in chat assistant"
```

---

## Task 11: Verify Admin Router Pages End-to-End

- [ ] **Step 1: Open admin and verify both platform routers**

With the dev server running, navigate to:
1. http://localhost:3000/admin/app/router — should show 7 chains filtered to `platform='app'`
2. http://localhost:3000/admin/telegram/router — should show 7 chains filtered to `platform='telegram'`

Verify the sidebar:
- Clicking "App" section expands to show Router link
- Clicking the Router link navigates to `/admin/app/router` and highlights correctly
- Clicking "Telegram Bot" section expands and Router link goes to `/admin/telegram/router`

- [ ] **Step 2: Edit a model chain in the App router and save**

On `/admin/app/router`, toggle a model off, click "Commit changes". Reload the page. Verify the toggle persisted.

- [ ] **Step 3: Verify Telegram router is independent**

Navigate to `/admin/telegram/router`. Confirm the models shown are different from the app router (or the same — but that the data is fetched separately per platform). Make a change, save, reload — verify it saved independently.

- [ ] **Step 4: Commit (verification only — no code changes)**

If any bugs were found and fixed in this task, commit those fixes before proceeding.

---

## Task 12: Final Integration Check

- [ ] **Step 1: Build the project**

```bash
npm run build
```

Expected: no build errors. Note any warnings.

- [ ] **Step 2: Check Vault page still works**

Navigate to http://localhost:3000/admin/vault. Verify vault keys load with `key_id` column (from earlier vault migration). Add/delete a key to confirm read/write works.

- [ ] **Step 3: Check Users page still works**

Navigate to http://localhost:3000/admin/users. Verify Telegram users load correctly.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: final integration check, all systems verified"
```

---

## Spec Coverage Check

| Spec requirement | Task |
|-----------------|------|
| Separate `router_chains` rows per platform | Task 1 |
| `user_quotas` table for app users | Task 2 |
| `getRouterChain(category, platform)` | Task 3 |
| `runChain` accepts platform | Task 4 |
| Admin router actions filtered by platform | Task 5 |
| Per-platform router pages | Task 6 |
| Sidebar Option B collapsible sections | Task 7 |
| `/api/ai/chat` unified AI route | Task 8 |
| `sendAIMessage` → fetch to `/api/ai/chat` | Task 9 |
| Remove model picker, show "Flowr AI" only | Task 10 |
| Quota check + increment in API route | Task 8 |
| Telegram quota unchanged | Task 4 (runChain passes platform, bot path unchanged) |
