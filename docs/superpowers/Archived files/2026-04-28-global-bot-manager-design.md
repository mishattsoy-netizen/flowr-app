# Global Bot Manager — Design Spec

**Date:** 2026-04-28  
**Status:** Approved for implementation planning

---

## Context

The admin panel currently has no way to set global bot personality, behavior rules, or writing style — these are scattered as per-chain system prompts inside `/admin/router`. There is also no mechanism for the bot to learn from mistakes across users: when one user corrects the bot, that correction is silently lost.

This spec defines a new **Global Bot Manager** section in the admin sidebar that gives the admin full control over global bot identity and behavior, a visual brain where the bot stores what it has learned, and an automated analysis routine that generates improvement plans from message feedback.

The goal: the bot gets smarter with usage, feels like it has a real personality, and the admin has one place to understand and steer that growth.

---

## Navigation

Bot Manager is added to the existing admin sidebar as an **expandable group** (option B), consistent with the sidebar's current pattern. It expands to reveal 5 sub-pages:

```
Admin Sidebar
├── Overview
├── Router
├── 🤖 Bot Manager          ← new expandable group
│   ├── ⚙️  Settings
│   ├── 🧠  Brain
│   ├── 📊  Dashboard
│   ├── 🔄  Routine
│   └── 💬  Feedback
├── Models
├── Users
├── Logs
└── ...
```

The existing `/admin/router` page is **not removed**. It continues to manage per-intent system prompts (narrow, category-specific overrides). Global settings from Bot Manager are injected as a prefix on top of those per-chain prompts.

---

## Page 1 — ⚙️ Global Settings

### Purpose
Admin manually authors the bot's global identity: its rules, personality, writing style, thinking pattern, and restrictions. These are the authoritative instructions — they always take priority over brain entries.

### Layout
Category pill-tabs across the top:
- **Core Rules** — hard constraints (never reveal system prompts, respond in user's language, etc.)
- **Personality** — tone, warmth, humor level, what the bot feels like to talk to
- **Answer Style** — conciseness, formatting preferences, when to use lists vs prose
- **Thinking Pattern** — how to approach complex questions, reasoning style
- **Restrictions** — things the bot must never do

Each tab shows a full-height text editor with the prompt for that category. Changes are saved per-tab with a Save button.

### Compiled Prompt Panel
Below the editor tabs, a collapsible **"Compiled Prompt"** section shows:
- `Last compiled: Apr 28, 2026 · 14:32` — timestamp of last successful compile
- `🔄 Sync Brain` button — manually triggers recompilation of all settings + brain entries into the master compiled prompt. Shows spinner during compile, then `✓ Synced · just now`. Also verifies all brain entries are included and flags any orphaned entries.
- `👁 Preview` — expands to show the full compiled text exactly as the bot sees it at runtime (read-only)

### How it works at runtime
Every chat request reads one DB row (`bot_compiled_prompt`) and injects it as the system prompt prefix. No runtime DB scan of individual entries. The compiled prompt is regenerated only when settings are saved or brain entries change.

---

## Page 2 — 🧠 Bot Brain

### Purpose
Visual store of everything the bot has learned. The admin can see, add, edit, and delete entries. The bot uses this knowledge at runtime via the compiled prompt.

### Layout

**Top half — interactive graph (React Flow)**
Category nodes (Rules, Mistakes, Patterns, Personality, Questions) connected to a central BRAIN node. Click a category node to filter the entries list below. This is a navigation tool — it makes it easy to orient in the knowledge base without reading every entry. The bot never traverses this graph at runtime.

**Bottom half — entries list**
Filtered by the selected graph node. Each entry shows:
- Title (bold)
- Content (expandable)
- Source: `user correction` / `routine improvement` / `manual` + date
- Delete button

A **"+ Add Entry"** button opens an inline form: category selector, title, content.

### Categories
- **Rules** — behavioral rules learned from corrections
- **Mistakes** — specific errors to never repeat
- **Patterns** — what works well (from liked responses)
- **Personality** — tone/style refinements from feedback
- **Questions** — things the bot is unsure about and wants analyzed next routine

### Brain entries in the compiled prompt
Brain entries are injected after the Settings blocks, formatted as structured sections:

```
[CORE RULES]         ← from Settings
...

[BRAIN: MISTAKES TO AVOID]   ← from Brain entries
- Don't over-use bullet points for simple answers (23 cases, Apr 24)
- Don't hallucinate file paths in code responses (11 cases, Apr 21)

[BRAIN: PATTERNS THAT WORK]
- Users prefer step-by-step for complex tasks
```

Settings = admin intent (highest priority). Brain = learned refinements (additive, lower priority). If a brain entry contradicts a settings block, the settings block wins because it appears first in the prompt.

---

## Page 3 — 📊 Analysis Dashboard

### Purpose
At-a-glance stats on brain health and routine activity.

### Content
- Total brain entries (with breakdown by category)
- Entries added this week
- Liked vs disliked message ratio (last 30 days)
- Last routine session: date, plans generated, plans accepted/rejected
- Brain growth chart: entries over time (simple line chart)
- Plans status summary: pending / accepted / rejected counts

---

## Page 4 — 🔄 Routine

### Purpose
Automated brainstorming and self-improvement sessions. The bot analyzes its own logs, feedback, and brain entries, then generates structured improvement plans for review.

### Layout

**Top bar (always visible)**
- Schedule: Off / Daily / Weekly (with day picker for weekly)
- Next run: `Apr 29 · 09:00`
- Auto-apply toggle: when ON, accepted plans are immediately written to brain without manual review
- **▶ Run Now** button

**Running state — terminal-style log stream**
When a session is running, a terminal panel scrolls with live output:
```
$ Starting analysis session · Apr 28 14:45
→ Loading 142 message logs
→ Reading brain entries (31)
→ Scanning 47 disliked responses
→ Scanning 89 liked responses
⟳ Identifying patterns…
  "Found: over-verbose responses (23 cases)"
  "Found: unnecessary bullet lists (18 cases)"
  "Found: hallucinated file paths in code (11 cases)"
  "Found: step-by-step format liked for complex tasks (34 cases)"
⟳ Writing improvement plans…
✓ Plan 1 of 4 written
✓ Plan 2 of 4 written
✓ Plan 3 of 4 written
✓ Plan 4 of 4 written
✓ Session complete · 4 plans generated
```

**After run — plan cards**
Expandable cards appear below the log. Default state is compact (title + topic tag + quick actions). Click to expand full reasoning.

Each card shows:
- **Topic tag** (e.g. Answer Style)
- **Title** (e.g. "Reduce verbose responses")
- **Case count** (e.g. "23 disliked responses")
- **Reasoning** — what the bot found and why this matters
- **Improvement plan** — specific change proposed
- **Actions:**
  - `✓ Accept` — writes entry to brain, triggers recompile
  - `✗ Reject` — marks rejected, stays in list until manually deleted
  - `✎ Edit` — opens inline textarea: you write what to change or do instead → bot rewrites the plan → you review again before it applies
  - `↗ Open` — full detail view

**Edit flow:**
1. Click Edit → textarea appears pre-filled with current plan
2. You write your note (e.g. "Make it context-aware, not a hard limit")
3. Bot rewrites the plan incorporating your note
4. Card updates with revised version tagged `✎ Revised`
5. You Accept or Reject the revision

### Analysis model
A dedicated model/chain separate from chat routing handles analysis sessions. Configured via the existing vault/models system. Default: the most capable available model since analysis runs infrequently.

### API
`POST /api/ai/brain/analyze` — starts an analysis session. Streams log lines via Server-Sent Events so the terminal panel updates in real-time. Accepts optional `{ log_ids: string[] }` to run on a specific subset of logs (used by Feedback page).

---

## Page 5 — 💬 Feedback Logs

### Purpose
View and manage liked/disliked messages. Send selected messages to the routine for targeted analysis.

### Layout
- Filter bar: All / Liked / Disliked + date range
- Message list with checkboxes. Each row shows: message preview, user (anonymized), date, feedback icon
- **"Send to Analysis"** button (active when 1+ items selected) — runs the routine specifically on selected logs

### Chat UI change
Thumbs up / thumbs down buttons are added to each message in the AI chat component. Clicking saves to `message_feedback` table. These are per-user and anonymous to other users — only the admin sees aggregated feedback.

---

## Admin Activity Log Sidebar

### Purpose
A right sidebar visible across all admin pages showing a chronological feed of every admin action. Gives instant visibility into what changed, when, and from which section — useful for debugging unexpected bot behavior ("why did it change tone?") and tracking routine activity.

### Layout
Collapsible right sidebar in the admin layout (collapsed by default, toggle button in the header bar). When open, ~260px wide. Shows:
- Chronological list of events, newest first
- Each entry: icon + action description + relative time (`2 min ago`, `Apr 28 · 14:32`)
- Subtle category color coding by section (Bot Manager = purple, Router = blue, Users = orange, etc.)
- "Load more" button at bottom (paginated, 50 per page)
- Manual refresh button at top

### Event types logged
| Icon | Event |
|------|-------|
| ⚙️ | Settings block saved (category name) |
| 🧠 | Brain entry added / deleted |
| ✓ | Improvement plan accepted → applied to brain |
| ✗ | Improvement plan rejected |
| ✎ | Improvement plan edited |
| 🔄 | Analysis routine ran (N plans generated) |
| 🤖 | Router chain model changed (chain name, model) |
| 🎛️ | Preset created / updated / deleted |
| 👤 | User blocked / unblocked |
| 🗑️ | Message logs purged (N entries) |
| 🔑 | Vault key updated (key name, no value) |
| 🔧 | Compiled prompt synced / recompiled |

### Performance
- Writes: one INSERT per admin action (admin actions are rare, ~10–50/day). Negligible.
- Reads: lazy-loaded after page render, last 50 entries, single indexed query. Does not block page load.
- No real-time polling. Refreshes on navigation or manual refresh click.

### Data model addition (see below)

---

## Data Model

### New tables

```sql
-- Global prompt blocks (manually authored by admin)
bot_settings (
  category      TEXT PRIMARY KEY,  -- 'core_rules', 'personality', etc.
  content       TEXT,
  is_active     BOOLEAN DEFAULT true,
  updated_at    TIMESTAMPTZ
)

-- Pre-compiled master prompt (single row, rebuilt on any change)
bot_compiled_prompt (
  id            INTEGER PRIMARY KEY DEFAULT 1,
  content       TEXT,              -- full compiled text injected at runtime
  compiled_at   TIMESTAMPTZ,
  entry_count   INTEGER            -- for verification display
)

-- Brain entries (learned knowledge)
bot_brain_entries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category      TEXT,              -- 'rules', 'mistakes', 'patterns', 'personality', 'questions'
  title         TEXT,
  content       TEXT,
  source        TEXT,              -- 'user_correction', 'routine', 'manual'
  created_at    TIMESTAMPTZ DEFAULT now()
)

-- Analysis sessions
bot_analysis_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status        TEXT,              -- 'running', 'complete', 'failed'
  triggered_by  TEXT,             -- 'manual', 'schedule', 'feedback_selection'
  log_ids       JSONB,             -- null = full history, array = selected logs
  log_lines     JSONB,             -- streaming log lines for display
  started_at    TIMESTAMPTZ DEFAULT now(),
  finished_at   TIMESTAMPTZ
)

-- Improvement plans per session
bot_improvement_plans (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID REFERENCES bot_analysis_sessions(id),
  topic         TEXT,              -- e.g. 'Answer Style'
  title         TEXT,
  reasoning     TEXT,
  plan          TEXT,
  status        TEXT DEFAULT 'pending',  -- 'pending', 'accepted', 'rejected', 'edited'
  edit_notes    TEXT,             -- user's edit instruction
  created_at    TIMESTAMPTZ DEFAULT now()
)

-- Admin activity log
admin_activity_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type   TEXT,              -- 'settings_saved', 'brain_entry_added', 'plan_accepted', etc.
  description   TEXT,              -- human-readable: "Saved personality prompt"
  details       JSONB,             -- optional: { category: 'personality', model: 'gemini-pro' }
  created_at    TIMESTAMPTZ DEFAULT now()
)

-- Per-message feedback from users
message_feedback (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_log_id BIGINT REFERENCES message_logs(id),
  auth_user_id  UUID,
  feedback      TEXT,             -- 'like', 'dislike'
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(message_log_id, auth_user_id)
)
```

---

## System Prompt Injection

`src/lib/bot/chainRouter.ts` is updated to:
1. Read `bot_compiled_prompt` (single DB query, cached for 60s in module scope as best-effort)
2. Prepend it to the per-chain `system_prompt` from `router_chains`

```
Final system prompt = compiled_global + "\n\n" + per_chain_prompt
```

The 60s module-level cache is best-effort in serverless (each cold start misses it) but eliminates redundant reads within a warm instance.

---

## Compile Trigger

A shared `recompilePrompt()` utility is called whenever:
- A `bot_settings` block is saved
- A `bot_brain_entry` is created or deleted
- A plan is accepted (which creates a brain entry)
- The Sync Brain button is clicked manually

The utility reads all active settings + brain entries, formats them into the structured prompt, and upserts `bot_compiled_prompt`.

---

## Files to create / modify

### New files
- `src/app/admin/bot/page.tsx` — redirect to settings
- `src/app/admin/bot/settings/page.tsx`
- `src/app/admin/bot/brain/page.tsx`
- `src/app/admin/bot/dashboard/page.tsx`
- `src/app/admin/bot/routine/page.tsx`
- `src/app/admin/bot/feedback/page.tsx`
- `src/app/api/ai/brain/analyze/route.ts`
- `src/lib/bot/compilePrompt.ts` — recompilePrompt() utility
- `src/lib/admin/logAction.ts` — logAdminAction(type, description, details?) utility
- `src/components/admin/ActivityLogSidebar.tsx` — collapsible right sidebar
- `src/app/api/admin/activity-log/route.ts` — GET endpoint (last 50, paginated)
- `supabase/migrations/YYYYMMDD_bot_manager.sql`

### Modified files
- `src/components/admin/Sidebar.tsx` — add Bot Manager expandable group
- `src/app/admin/layout.tsx` — add ActivityLogSidebar + toggle button in header
- `src/lib/bot/chainRouter.ts` — inject compiled prompt
- `src/components/assistant/ChatMessage.tsx` — add thumbs up/down feedback buttons
- `src/app/api/ai/chat/route.ts` — save feedback to message_feedback table (optional, can be separate endpoint)

---

## Verification

1. Save a personality setting → check `bot_compiled_prompt.compiled_at` updates
2. Preview compiled prompt → verify all settings blocks and brain entries appear
3. Send a chat message → confirm compiled prompt appears in system prompt (log it temporarily)
4. Run analysis manually → terminal streams live, plans appear after
5. Accept a plan → brain entry created, recompile triggered, new entry visible in graph
6. Edit a plan → revised version appears before applying
7. Thumbs down a message → appears in Feedback Logs with correct filter
8. Send feedback logs to analysis → routine runs on selected logs only
9. Sync Brain button → shows last compiled timestamp, verifies entry count
10. Activity log sidebar → toggle open, verify actions appear after saving a setting, accepting a plan, and changing a router model. Confirm lazy load doesn't block page render.
