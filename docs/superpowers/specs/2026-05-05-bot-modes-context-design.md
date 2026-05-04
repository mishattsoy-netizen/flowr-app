# Bot Modes + Context Capacity Design

**Date:** 2026-05-05  
**Status:** Approved  

---

## Overview

Three features are being added to the Flowr bot system:

1. **Three bot modes** (Default / Think / Pro) — each with its own prompt identity, selectable per-message in chat
2. **Global Settings page** — consolidates global bot controls (Ollama, prompt injection, backend model, context, compaction)
3. **Advanced compaction chain** — 2-step draft+refine summarization with primary+fallback models per step

---

## 1. Data Layer

### 1.1 `bot_settings` table
Add `mode` column: `'default' | 'think' | 'pro'`, default `'default'`.

All existing rows receive `mode = 'default'` via migration.

The 5 settings categories × 3 modes = 15 rows total. Each row is independently editable and toggleable.

### 1.2 `bot_classifier_config` table
Add `mode` column: `'default' | 'think' | 'pro'`, default `'default'`.

Each mode stores its own:
- `classifier_prompt` — the system prompt used during intent classification
- `classifier_keywords` — JSON object mapping categories to keyword arrays

Existing classifier config rows receive `mode = 'default'`.

### 1.3 `bot_compiled_prompt` table
Add `mode` column: `'default' | 'think' | 'pro'`, default `'default'`.

Three compiled prompts exist simultaneously. Each is rebuilt independently when its mode's settings or brain entries change. The `syncCompiledPrompt()` function accepts a `mode` parameter.

### 1.4 New `bot_compaction_config` table
Stores global compaction chain configuration (one row):

| Column | Type | Default |
|--------|------|---------|
| `id` | int | 1 (singleton) |
| `draft_primary_model` | string | existing backend model |
| `draft_fallback_model` | string | — |
| `refine_primary_model` | string | existing backend model |
| `refine_fallback_model` | string | — |
| `context_limit` | int | 32000 |
| `compaction_threshold` | float | 0.8 |
| `updated_at` | timestamp | — |

### 1.5 Brain entries
No schema change. Brain entries remain shared across all modes and are injected into every mode's compiled prompt.

---

## 2. Admin Pages

### 2.1 Global Settings page
**Route:** `/admin/bot/settings` (replaces current Settings page)

Contains all global bot controls — nothing mode-specific:
- **Prompt Injection** toggle — enables/disables global compiled prompt injection
- **Ollama** toggle — activates local Ollama instance
- **Backend Model** — model used for brain sync and routine analysis
- **Context Capacity section:**
  - Context limit input (tokens) — with preset options (32k / 64k / 128k / custom)
  - Compaction threshold % slider
  - Draft model: primary dropdown + fallback dropdown
  - Refine model: primary dropdown + fallback dropdown
- **Compiled Prompt** — preview panel with a tab switcher (Default / Think / Pro) showing each mode's independently compiled prompt, with a Sync All button (rebuilds all 3) and last-compiled timestamp per mode

### 2.2 Mode Pages (×3)
**Routes:** `/admin/bot/default`, `/admin/bot/think`, `/admin/bot/pro`

Each page is structurally identical. Contains 6 tabs:

| Tab | Content |
|-----|---------|
| Core Rules | Hard constraints for this mode |
| Personality | Tone, warmth, humor for this mode |
| Answer Style | Length, formatting for this mode |
| Thinking | Approach to simple vs complex questions for this mode |
| Restrictions | Off-limits topics/behaviors for this mode |
| Classifier | Mode-specific classifier prompt + keywords JSON |

Each tab has:
- Textarea for content
- Active/inactive toggle
- Save button (saves + triggers recompile for this mode)

### 2.3 Updated Bot Intelligence Sidebar

```
Bot Intelligence
  ├── 🌐 Global Settings
  │
  ├── Modes
  │   ├── ⚡ Default Mode
  │   ├── 🧠 Think Mode
  │   └── 🔥 Pro Mode
  │
  └── Intelligence
      ├── 🧠 Brain
      ├── 📊 Dashboard
      ├── 🔁 Routine
      └── 💬 Feedback
```

The standalone Classifier page is removed. Classifier config lives in each mode page's Classifier tab.

---

## 3. Chat UI

### 3.1 Mode selector
A dropdown button placed to the left of the send button in the chat input area.

- Shows current mode name + icon: `⚡ Default` / `🧠 Think` / `🔥 Pro`
- Opens a small upward dropdown with all 3 options
- Active mode highlighted in the dropdown
- Mode stored in React session state (`useState`)
- Resets to `'default'` when chat history is cleared or a new session starts

### 3.2 Mode passed through the stack
The active mode string is included in the chat API request body and flows through:

```
ChatInput → POST /api/ai/chat (mode) → runChain(prompt, buffer, { mode }) → 
  classifyIntentWithModel({ mode }) → compiled prompt lookup by mode →
  classifier config lookup by mode
```

Everything else (router chain config, brain entries, compaction logic, vision handling) is mode-agnostic.

---

## 4. Compaction Chain

### 4.1 Two-step process
Replaces the current single-model `summarizeSession()` call.

**Step 1 — Draft:**
1. Try `draft_primary_model` to generate a dense session summary
2. On failure, try `draft_fallback_model`
3. If both fail, abort compaction and keep existing summary

**Step 2 — Refine:**
1. Feed the draft summary back to `refine_primary_model` with a verification/improvement prompt
2. On failure, try `refine_fallback_model`
3. If both fail, use the draft summary as-is (do not discard progress)

**Final:** Store the refined summary in `session_state.distilled_summary`.

### 4.2 Trigger
Unchanged — fires when `token_usage_total` reaches `context_limit × compaction_threshold`.

### 4.3 Context limit + threshold
Read from `bot_compaction_config` at runtime (not hardcoded). `getSessionState()` uses the configured `context_limit` value instead of the current hardcoded 32000.

---

## 5. Prompt Compilation

`syncCompiledPrompt(mode)` builds the compiled prompt for a specific mode:

1. Load active `bot_settings` rows for that `mode`
2. Load all active brain entries (shared)
3. Merge in order: Core Rules → Personality → Answer Style → Thinking → Restrictions → Brain entries
4. Store result in `bot_compiled_prompt` with `mode` column set

When settings are saved on a mode page, only that mode's compiled prompt is rebuilt. Brain entry changes trigger a recompile for all 3 modes.

---

## 6. Out of Scope

- Per-mode router chain config (router stays shared)
- Per-mode brain entries (brain stays shared)
- More than 3 modes
- Mode-specific context limits (one global limit)
