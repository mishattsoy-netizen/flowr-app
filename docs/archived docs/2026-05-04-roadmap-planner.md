# Project Roadmap & Planning Hub — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a project roadmap page in the admin panel (`/admin/roadmap`) with phases, tasks (with sub-tasks & agent prompts), a resizable AI planning assistant sidebar with its own router matrix, and export capabilities.

**Architecture:** Supabase-backed data (4 tables), Next.js server components for the page shell, client components for interactivity, a dedicated API route for the planning bot that uses its own router chain separate from the main AI chat.

**Tech Stack:** Next.js 15 (App Router), Supabase (PostgreSQL), Zustand (local UI state only), Lucide icons, existing provider system (Google/Groq/Tavily/etc.)

---

## Decisions Log

| Decision | Choice |
|----------|--------|
| Location | Admin panel (`/admin/roadmap`) |
| Storage | Supabase |
| AI Assistant | Embedded resizable right sidebar |
| Hierarchy | Phases → Tasks with sub-tasks |
| Layout | Hybrid: top phase strip + focused task list |
| Model selection | Dropdown from model registry + mode switcher (Fast/Complex/Auto) |
| Router | Independent router matrix (CLASSIFIER, COMPLEX, FAST, VISION, WEB_SEARCH) |
| System prompt | Editable via settings modal, stored in Supabase |
| Agent prompts | Per-task field, AI-generated, manually editable, one-click copy |
| Export | Copy phase as markdown (all tasks + prompts + sub-tasks) |

---

## Task 1: Supabase Schema — Create Tables

**Files:**
- Create: `supabase/migrations/20260504_roadmap_tables.sql`

**Step 1: Write the migration SQL**

```sql
-- Roadmap Phases
CREATE TABLE IF NOT EXISTS roadmap_phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed')),
  sort_order INT NOT NULL DEFAULT 0,
  color TEXT DEFAULT '#E09952',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Roadmap Tasks
CREATE TABLE IF NOT EXISTS roadmap_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id UUID NOT NULL REFERENCES roadmap_phases(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  sort_order INT NOT NULL DEFAULT 0,
  sub_tasks JSONB DEFAULT '[]'::jsonb,
  tags TEXT[] DEFAULT '{}',
  agent_prompt TEXT DEFAULT '',
  prompt_context TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Roadmap AI Chat History
CREATE TABLE IF NOT EXISTS roadmap_ai_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  messages JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Roadmap Bot Config (system prompt, router config)
CREATE TABLE IF NOT EXISTS roadmap_bot_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system_prompt TEXT DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Roadmap Router Chains (separate from main router)
CREATE TABLE IF NOT EXISTS roadmap_router_chains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL UNIQUE CHECK (category IN ('CLASSIFIER', 'COMPLEX', 'FAST', 'VISION', 'WEB_SEARCH')),
  model_list JSONB DEFAULT '[]'::jsonb,
  system_prompt TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed default router chains
INSERT INTO roadmap_router_chains (category, model_list) VALUES
  ('CLASSIFIER', '[]'::jsonb),
  ('COMPLEX', '[]'::jsonb),
  ('FAST', '[]'::jsonb),
  ('VISION', '[]'::jsonb),
  ('WEB_SEARCH', '[]'::jsonb)
ON CONFLICT (category) DO NOTHING;

-- Seed default bot config
INSERT INTO roadmap_bot_config (system_prompt) VALUES (
  'You are a project planning assistant for Flowr, a Next.js productivity app. Help break down features into phases and tasks. For each task, generate an agent_prompt that can be copy-pasted to a coding assistant. Include file paths, code patterns, and implementation details in prompts.'
) ON CONFLICT DO NOTHING;

-- Updated_at triggers
CREATE OR REPLACE FUNCTION update_roadmap_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_roadmap_phases_updated BEFORE UPDATE ON roadmap_phases FOR EACH ROW EXECUTE FUNCTION update_roadmap_updated_at();
CREATE TRIGGER trg_roadmap_tasks_updated BEFORE UPDATE ON roadmap_tasks FOR EACH ROW EXECUTE FUNCTION update_roadmap_updated_at();
CREATE TRIGGER trg_roadmap_ai_chats_updated BEFORE UPDATE ON roadmap_ai_chats FOR EACH ROW EXECUTE FUNCTION update_roadmap_updated_at();
CREATE TRIGGER trg_roadmap_bot_config_updated BEFORE UPDATE ON roadmap_bot_config FOR EACH ROW EXECUTE FUNCTION update_roadmap_updated_at();

-- Enable RLS (admin-only access)
ALTER TABLE roadmap_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE roadmap_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE roadmap_ai_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE roadmap_bot_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE roadmap_router_chains ENABLE ROW LEVEL SECURITY;
```

**Step 2: Run the migration against Supabase**

Run in Supabase SQL editor or via CLI.

---

## Task 2: API Routes — CRUD for Phases & Tasks

**Files:**
- Create: `src/app/api/admin/roadmap/phases/route.ts`
- Create: `src/app/api/admin/roadmap/tasks/route.ts`

Standard CRUD routes using `supabaseAdmin`. GET (list with ordering), POST (create), PATCH (update by id), DELETE (delete by id). Tasks GET supports `?phase_id=` query param filtering.

---

## Task 3: API Route — Planning Bot Chat

**Files:**
- Create: `src/app/api/admin/roadmap/chat/route.ts`
- Create: `src/lib/bot/roadmapRouter.ts`

**roadmapRouter.ts** contains:
- `getRoadmapRouterChain(category)` — reads from `roadmap_router_chains` table (NOT the main `router_chains`)
- `getRoadmapBotConfig()` — reads system prompt from `roadmap_bot_config`
- `classifyRoadmapIntent(message)` — uses CLASSIFIER chain to classify into COMPLEX/FAST/WEB_SEARCH/VISION
- `runRoadmapChain(prompt, systemPrompt, history, category)` — iterates through chain models, calls appropriate provider (Google/Groq/Tavily/DuckDuckGo), returns first successful response

**Chat route** accepts `{ prompt, mode, history, buffer }`:
- `mode`: `'complex'` | `'fast'` | `'auto'` — overrides or uses classifier
- Injects system prompt + structured output format instructions for `[ROADMAP_ACTION]` blocks
- Returns `{ content, model, category }`

---

## Task 4: API Routes — Bot Config & Router Config

**Files:**
- Create: `src/app/api/admin/roadmap/config/route.ts` — GET/PATCH for system prompt
- Create: `src/app/api/admin/roadmap/router/route.ts` — GET/PATCH for router chains

---

## Task 5: Admin Sidebar — Add Roadmap Link

**Files:**
- Modify: `src/components/admin/Sidebar.tsx`

Add `<NavLink href="/admin/roadmap" icon={Map}>Project Roadmap</NavLink>` after the Router Matrix link. Import `Map` from lucide-react.

---

## Task 6: Roadmap Page Shell (Server Component)

**Files:**
- Create: `src/app/admin/roadmap/page.tsx`

Server component that fetches phases, tasks, and router chains from Supabase, then renders `<RoadmapClient>` with the data as props.

---

## Task 7: RoadmapClient — Main Layout Component

**Files:**
- Create: `src/components/admin/roadmap/RoadmapClient.tsx`

Main client component rendering:
1. **Header bar:** "Project Roadmap" title + overall progress % + "Export All" button
2. **PhaseStrip** component (horizontal pills)
3. **Task list** for selected phase (renders TaskCard components)
4. **Resizable AI sidebar** on the right (PlanningAssistant)

State: `activePhaseId`, `phases`, `tasks`, `sidebarWidth` (default 400px, min 300, max 600)

Resizable sidebar uses mouse drag on a vertical divider (same pattern as main app sidebar resizer).

---

## Task 8: PhaseStrip Component

**Files:**
- Create: `src/components/admin/roadmap/PhaseStrip.tsx`

Horizontal scrollable row of phase pills. Each pill shows:
- Color dot + phase title + completion %
- Active state: highlighted background
- Click to select phase
- "+" button at the end to add new phase (inline title input)

---

## Task 9: TaskCard Component

**Files:**
- Create: `src/components/admin/roadmap/TaskCard.tsx`

Expandable card showing:
- **Collapsed:** Status dot + title + priority badge + tag chips
- **Expanded:** Description textarea, sub-tasks (checkboxes), agent_prompt block with "Copy Prompt" button, edit/delete buttons
- Sub-task checkbox toggles update JSONB via PATCH API
- "Copy Prompt" uses `navigator.clipboard.writeText()`
- Inline editing for title, description, agent_prompt

---

## Task 10: PlanningAssistant Sidebar Component

**Files:**
- Create: `src/components/admin/roadmap/PlanningAssistant.tsx`

Resizable right sidebar:
- **Header:** Title + gear icon (opens BotConfigModal) + model info display
- **Mode switcher:** ⚡Fast / 🧠Complex / 🔄Auto (three-way toggle)
- **Messages area:** Scrollable, markdown-rendered via existing markdown renderer
- **Action blocks:** Parses `[ROADMAP_ACTION]...[/ROADMAP_ACTION]` from bot responses, renders as cards with "Apply" / "Reject" buttons
- **Input bar:** Textarea + send button
- Sends to `/api/admin/roadmap/chat` with current mode, phases/tasks context in system prompt

---

## Task 11: Bot Config Modal + Router Settings

**Files:**
- Create: `src/components/admin/roadmap/BotConfigModal.tsx`
- Create: `src/components/admin/roadmap/RouterSettings.tsx`

**BotConfigModal:** Glass modal (uses `popup-glass-big` utility) with:
- Tab 1: System prompt textarea + template presets dropdown
- Tab 2: RouterSettings component

**RouterSettings:** 5 rows for CLASSIFIER/COMPLEX/FAST/VISION/WEB_SEARCH. Each row has model list (add from registry, remove, toggle enable). Save calls PATCH `/api/admin/roadmap/router`.

---

## Task 12: Export Functionality

**Files:**
- Add to: `src/components/admin/roadmap/RoadmapClient.tsx`

Two export functions:
1. **Export Phase** — generates markdown for one phase with all tasks, sub-tasks, and agent prompts
2. **Export All** — same but all phases concatenated

Format includes phase title/status/progress, task titles with priority/status, agent prompt in code blocks, sub-tasks as checkboxes, tags.

Copy to clipboard via `navigator.clipboard.writeText()` with success toast.

---

## Implementation Order

| Batch | Tasks | Focus |
|-------|-------|-------|
| Backend | 1 → 2 → 3 → 4 | Schema + APIs |
| Core UI | 5 → 6 → 7 → 8 → 9 | Page + components |
| AI + Polish | 10 → 11 → 12 | Bot integration + export |
