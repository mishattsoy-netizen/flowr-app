# Bot Modes + Context Capacity Design

**Date:** 2026-05-05  
**Status:** Approved  

---

## Overview

Five features are being added to the Flowr bot system:

1. **Three bot modes** (Default / Think / Pro) — each with its own prompt identity, selectable per-message in chat
2. **Global Settings page** — consolidates global bot controls (Ollama, prompt injection, backend model, context, compaction)
3. **Advanced compaction chain** — 2-step draft+refine summarization with primary+fallback models per step
4. **New router chains** — dedicated Coding chain, split Web Search into Grounding chain and Deep Research chain
5. **Smart intent tags** — tool pills attached to messages that the bot honors when relevant and ignores when clearly mismatched

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

## 7. New Router Chains

### 7.1 Coding Chain (`CODING`)
A new classification category added to the classifier. Triggered by:
- User attaching the `/code` intent tag to a message
- Classifier detecting a coding question or code content in the message (auto-detection as fallback when no tag is set)

Router chain uses models best suited for code generation and debugging (configured in Router Matrix admin page like all other chains). No special provider logic — standard fallback chain behavior.

### 7.2 Web Search — Grounding Chain (`WEB_SEARCH`)
Replaces the current single `WEB_SEARCH` chain. Triggered by:
- `/search` tool tag
- Classifier routing to `WEB_SEARCH` (default web search behavior, unchanged)
- Any query the classifier detects involves maps, locations, or Google Maps data

Chain order:
1. **Gemini with Google Search + Maps grounding** (primary)
2. **DuckDuckGo** (fallback)

Maps queries always use this chain — even if the user has `/research` tag active, a detected maps intent overrides to grounding chain.

### 7.3 Deep Research Chain (`DEEP_RESEARCH`)
New classification category. Triggered exclusively by:
- User attaching the `/research` "Deep Research" tool tag

Chain order:
1. **Pollinations Perplexity model** (primary)
2. **Tavily Search** (secondary)
3. **DuckDuckGo** (fallback)

Does not support Google Maps grounding. If a maps query is detected while `/research` tag is active, the bot silently switches to the Grounding chain instead.

---

## 8. Smart Intent Tags

### 8.1 How tags work
When a user selects a tool from the `/` command menu, it attaches as a pill/tag to the current message input (visible in the input bar). On send, the tag is included in the API request alongside the message text.

Tags directly map to chains/actions:
| Tag | Triggers |
|-----|----------|
| `/image` | Image generation chain (existing) |
| `/search` | Grounding chain |
| `/research` | Deep Research chain |
| `/code` | Coding chain |
| `/note`, `/canvas`, `/split`, `/task` | Tool actions (existing) |

### 8.2 Smart tag override logic
Before routing, the classifier evaluates whether the attached tag is consistent with the message content:

- **Tag honored** — message content aligns with the tag (e.g., `/image` + "draw a sunset", `/code` + "write a Python function")
- **Tag ignored** — message content clearly contradicts the tag (e.g., `/image` left attached while asking "what is the capital of France?", `/code` tag with a casual greeting)
- **Maps override** — `/research` tag + detected maps/location intent → silently switch to Grounding chain, ignore Deep Research tag

The override decision is made by the classifier using a short consistency check prompt. If uncertain, the tag is honored (user intent takes precedence over classifier confidence).

### 8.3 Tag persistence
Tags are cleared after each message is sent. The user must re-attach a tag for the next message if needed. This matches the existing behavior shown in the UI screenshots.

---

## 9. Mode Prompt Files (Post-Implementation Deliverable)

After all implementation is complete, generate a `mode-prompts.txt` file containing ready-to-paste prompt content for each of the 3 modes across all 5 settings blocks (Core Rules, Personality, Answer Style, Thinking Pattern, Restrictions) plus a Classifier prompt per mode.

**Base reference:** The current compiled prompt (`compiled prompt.txt`) serves as the foundation — specifically the Default mode should feel like a natural evolution of the existing prompt. Think and Pro modes diverge from Default in reasoning depth, precision, and output style.

**Base reference:** The current compiled prompt (`compiled prompt.txt`) is the foundation for Default mode. Think and Pro diverge deliberately.

**Universal formatting rule (all modes):** When a response is informative or longer than usual, use structured formatting — headers, bullets, bold key terms, tables where relevant. Short/casual messages always get short/casual replies regardless of mode.

**Mode prompt character profiles:**

**Default mode**
- Fast, warm, universal. Handles anything with balanced quality vs speed.
- Tone and personality directly based on the current compiled prompt.
- Casual messages → casual replies. Complex questions → thorough but tight.
- Classifier: balanced routing, current behavior preserved. FAST_SIMPLE for greetings/simple questions, MEDIUM_THINKING for moderate tasks, COMPLEX_THINKING for clearly hard problems.

**Think mode**
- Deliberate, precise, thorough. Prioritizes accuracy and user satisfaction over speed.
- Best for: essays, research, analysis, explanations, important decisions, anything where quality matters more than quickness.
- Still responds casually and briefly to casual/simple messages — depth is applied where the task demands it, not universally.
- Retains warmth and personality. Not cold or robotic.
- Longer responses are expected and acceptable when the task warrants it.
- Formatting is more structured than Default — uses sections, bullets, and hierarchy for complex answers.
- Classifier: aggressively routes to MEDIUM_THINKING and COMPLEX_THINKING. Only clearly trivial messages (greetings, one-word questions) go to FAST_SIMPLE. Ambiguous cases default to MEDIUM_THINKING rather than FAST_SIMPLE.

**Pro mode**
- Maximum precision. Best possible output on every non-trivial task.
- Best for: coding, math, planning, strategy, professional/business work, optimization, brainstorming, analysis.
- Language/knowledge tasks (writing, research) are also handled with high quality — Pro means best output across all domains, not just technical ones.
- Still warm and has personality — just more focused, structured, and exact. No fluff, no filler.
- Responses are thorough, well-reasoned, and structured. Shows full reasoning where relevant.
- Casual messages still get brief, warm replies — Pro mode doesn't make small talk stiff.
- Formatting is always structured for anything beyond a simple reply — clear sections, precise language, code blocks, tables where they add clarity.
- Classifier: routes almost everything to COMPLEX_THINKING except obvious greetings and trivially simple factual questions. MEDIUM_THINKING used for moderately complex tasks. FAST_SIMPLE reserved only for pure social exchanges and single-fact lookups.

---

## 10. Out of Scope

- Per-mode router chain config (router stays shared)
- Per-mode brain entries (brain stays shared)
- More than 3 modes
- Mode-specific context limits (one global limit)
- Multiple simultaneous tags (one tag per message)
