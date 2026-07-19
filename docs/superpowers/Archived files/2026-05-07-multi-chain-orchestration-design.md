# Multi-Chain Orchestration & Mode Redesign

**Date:** 2026-05-07  
**Status:** Draft — awaiting user review

---

## Overview

This spec covers two interconnected changes:

1. **Mode consolidation** — collapse 3 modes (Default, Pro, Think) into 2 modes (Default, Pro) plus an orthogonal Thinking toggle
2. **Multi-chain orchestration** — a planning layer that routes complex requests through multiple chains sequentially before delivering a final answer

---

## 1. Mode Architecture

### Two Modes

| | Default | Pro |
|---|---|---|
| Persona | Sharp, warm, efficient — "smart friend" | Senior engineer — clinical, results-focused, zero fluff |
| Routing sensitivity | Upgrades on **necessity** — prefers lighter chain when borderline | Upgrades on **opportunity** — prefers heavier chain when borderline |
| Classifier | Default classifier prompt | Pro classifier prompt |
| Model tier | Speed/quality balance per chain | Best available model per chain |

**What disappears:** `mode-think.txt` is retired. Think mode's aggressive upgrade bias becomes the Thinking toggle's job.

### Routing Sensitivity

Both modes use the same chain categories and the same routing logic. The only difference is the tiebreaker instruction encoded in each classifier prompt:

- **Default (50% sensitivity):** "When in doubt between two tiers, prefer the lighter one."
- **Pro (70% sensitivity):** "When in doubt between two tiers, prefer the heavier one."

Same essay example:

| Request | Default | Pro |
|---|---|---|
| "Write a quick essay about dogs" | FAST_SIMPLE | FAST_SIMPLE |
| "Write an essay about climate change" | MEDIUM_THINKING | COMPLEX_THINKING |
| "Write a university-level essay on Keynesian economics" | COMPLEX_THINKING | COMPLEX_THINKING |

### Thinking Toggle

Orthogonal switch — applies to either mode. Controlled per-conversation via a button in the mode popup. Admin sets the global default (On / Off); users can override per-session.

| | Thinking OFF | Thinking ON |
|---|---|---|
| Single-chain | classifier → output chain | classifier → **THINK** → final output |
| Multi-chain | classifier → orchestrator → chains → final output | classifier → orchestrator → chains → **THINK** → final output |

The THINK chain is always penultimate. The final output chain is always last. No exceptions.

**Single-chain + thinking ON:** Steps 2 and 3 are skipped. The think chain fires directly after classification with empty accumulated chain context (no intermediate chains ran). It acts as a pure reasoning pass — considers multiple approaches, picks the best direction, passes it to the final output chain. The think chain must handle empty accumulated context gracefully.

---

## 2. Request Flow

### Full Pipeline

```
1. CLASSIFIER
   → single category (95% of requests) — skip to step 3
   → MULTI_CHAIN flag (5%) — continue to step 2

2. ORCHESTRATOR (only fires on MULTI_CHAIN)
   → reads: original prompt + reply block + last 3 turns history
   → outputs: ordered chain sequence + per-step goals
   → max 5 steps (+ optional THINK + OUTPUT = 7 total hard cap)

3. CHAIN EXECUTION (sequential)
   → each chain receives:
       - original prompt
       - orchestrator step goal for this step
       - accumulated context from all previous chains
       - internal chain system prompt (NOT the compiled personality prompt)
       - NO history, NO reply block, NO session summary
   → each chain writes FOR the next chain, not for the user
   → status message emitted before each chain starts

4. THINK CHAIN (only if thinking toggle ON)
   → receives:
       - original prompt
       - reply block
       - full conversation history
       - compacted session summary
       - all accumulated chain outputs
   → reasons through: correctness, gaps, missing data, best approach
   → if critical gap found: requests ONE correction chain, then proceeds regardless
   → outputs: reasoning summary + clear direction for final output chain

5. FINAL OUTPUT CHAIN (always last)
   → receives:
       - original prompt
       - reply block
       - full conversation history
       - compacted session summary
       - accumulated chain context
       - think chain direction (if thinking ON)
       - FULL compiled prompt (personality + restrictions + brain entries)
   → writes the user-facing answer
   → always FAST_SIMPLE, MEDIUM_THINKING, or COMPLEX_THINKING — never a tool chain
```

### Context & Memory per Chain

| | Reply block | History | Session summary | Chain context |
|---|---|---|---|---|
| Classifier | ✓ last 3 turns | ✓ last 3 turns | ✗ | — |
| Orchestrator | ✓ | ✓ last 3 turns | ✓ | — |
| Internal chains | ✗ | ✗ | ✗ | ✓ accumulated |
| Think chain | ✓ | ✓ full | ✓ | ✓ accumulated |
| Final output chain | ✓ | ✓ full | ✓ | ✓ accumulated |

---

## 3. Orchestrator

A dedicated LLM call using a MEDIUM-tier model minimum. Fires only when the classifier outputs `MULTI_CHAIN`.

### Input
- Original prompt
- Reply block (if present)
- Last 3 turns history
- Compacted session summary (if present)

### Output (structured JSON)
```json
{
  "steps": ["VISION", "WEB_SEARCH", "COMPLEX_THINKING"],
  "step_goals": [
    "Extract all text and visual content from the attached images",
    "Search for current data on X to supplement image analysis",
    "Synthesize everything into a final structured answer"
  ]
}
```

### Rules
- Max 5 steps in sequence (+ THINK + OUTPUT = 7 total)
- IMAGE_GEN, when included, is always placed last before THINK/OUTPUT
- Final step in the orchestrator plan must always be a text output chain (FAST_SIMPLE, MEDIUM_THINKING, or COMPLEX_THINKING)
- Orchestrator does not appear in the status update stream — user sees a "Planning..." message while it runs, then the step-by-step statuses begin

---

## 4. Think Chain

A dedicated chain category (`THINKING`) in the router, configured like any other chain — own model list, temperature, system prompt.

### Role
Receives all accumulated context and performs a quality-check reasoning pass before the final answer is written. It catches errors in previous chain outputs, considers multiple approaches, and commits to a clear direction.

### Correction Loop
If the think chain spots a critical gap it can flag one additional chain request. The system executes that chain, then passes control back to the think chain for a second (final) pass. **Hard limit: one correction loop.** After the second pass it proceeds regardless of remaining gaps.

If a gap cannot be fixed (model failure, no chain available, correction chain insufficient), the think chain instructs the final output chain to explicitly acknowledge the limitation to the user.

### Think Chain Output Format
```
[THINKING SUMMARY]
Reviewed: [list of previous chain outputs]
Gap found: [description or "none"]
Correction taken: [chain used or "none"]
Approach selected: [chosen approach]
Direction for final output: [specific instruction for output chain]
Confidence: [high / medium / low with brief note]
```

### Visibility
Configurable in admin — shown to user as a collapsible block, or fully hidden.

---

## 5. Chain Handoff Format

Each internal chain writes structured output for the next chain, not user-facing prose.

| Chain | Output to next chain |
|---|---|
| VISION | Structured description: extracted text, visual elements, key content, answers to step goal |
| WEB_SEARCH | Structured results: key facts, source URLs, queries run, gaps/unanswered parts |
| DEEP_RESEARCH | Multi-source synthesis: key findings by topic, confidence level, conflicting data flagged |
| CODING | Code blocks + brief summary of what was written and any caveats |
| COMPLEX_THINKING | Analysis summary: conclusions, key insights, recommended approach |
| TOOL_CALLING | Action result: what was done, confirmation or error |
| IMAGE_GEN | `{ type: "image_generated", prompt_used: "...", concept: "..." }` — next chain writes text based on concept, not pixels |

IMAGE_GEN always delivers its Buffer alongside the final text response. The text chain writes based on the generation concept, not the image itself.

---

## 6. Compiled Prompt Architecture

### Two Tiers

| Section | Internal chains | Final output chain |
|---|---|---|
| CORE RULES | ✗ | ✓ |
| PERSONALITY | ✗ | ✓ |
| ANSWER STYLE | ✗ | ✓ |
| THINKING PATTERN | ✗ | ✓ |
| RESTRICTIONS | ✓ | ✓ |
| BRAIN: RULES | ✓ | ✓ |
| BRAIN: RED FLAGS | ✓ | ✓ |
| BRAIN: TONE / PERSONALITY | ✗ | ✓ |
| BRAIN: FACTS & KNOWLEDGE | ✓ | ✓ |

Internal chains use a purpose-built **internal system prompt** per chain type instead of the compiled personality prompt. This prompt defines the chain's pipeline role, expected output format, and includes RESTRICTIONS + BRAIN facts only.

### Internal Prompt Structure (per chain type)
```
You are the [TYPE] step in a multi-step pipeline.
Your output will be consumed by the next chain — NOT shown to the user.
Your goal for this step: [injected from orchestrator step_goals]
Write structured data output, not conversational prose.

[RESTRICTIONS]
[BRAIN: FACTS & KNOWLEDGE]
```

Each internal prompt is editable in admin with a reset-to-default button.

### Context Accumulation Format

Accumulated context is passed between chains as a formatted string block injected into each subsequent chain's prompt. Each step's output is capped at 4000 characters, enforced at the router level before injection.

```
[VISION STEP OUTPUT]
Goal: Extract text and visual content from attached images
Result: The image contains a React component showing a login form with...

[WEB_SEARCH STEP OUTPUT]
Goal: Find current pricing for competing products
Result: Key facts: Product A is $20/mo, Product B launched new tier at...
```

This format is chosen over JSON for direct prompt injection compatibility. If accumulated context exceeds the receiving model's context window, the oldest step outputs are summarized first.

---

## 7. Status Updates

Status messages are emitted **before** each chain starts so the user sees immediate activity.

### Format
```
🔍 Searching the web...        ← emitted before WEB_SEARCH starts
🔍 Searching the web... ✓      ← updated when complete, next status appears
👁 Analyzing images...
🧠 Thinking...
✍️ Writing answer...
```

### Per-chain defaults

| Chain | Default label | Default emoji |
|---|---|---|
| WEB_SEARCH | Searching the web | 🔍 |
| DEEP_RESEARCH | Researching | 🔬 |
| VISION | Analyzing images | 👁 |
| CODING | Writing code | 💻 |
| IMAGE_GEN | Generating image | 🎨 |
| TOOL_CALLING | Running action | ⚡ |
| THINKING | Thinking | 🧠 |
| FAST_SIMPLE / MEDIUM / COMPLEX | Writing answer | ✍️ |

---

## 8. Admin Controls

### Router Matrix (existing page — additions)

Two new chain cards:
- **ORCHESTRATOR** — model list, temperature, system prompt (editable)
- **THINKING** — model list, temperature, system prompt, max correction loops (0–2)

### Orchestrator Admin Panel (new dedicated section)

Full control over orchestration behavior:
- Model list and temperature (same as router card)
- System prompt — editable textarea
- Enable / disable orchestrator globally
- Max pipeline steps — slider 1–7
- IMAGE_GEN auto-last enforcement — On / Off
- **Test tool** — type any prompt and see what chain sequence the orchestrator plans, without executing any chains. Shows planned steps + step goals. Essential for tuning the orchestrator prompt.

### Global Settings (existing page — additions)

| Setting | Control |
|---|---|
| Thinking toggle — default state | On / Off |
| Thinking summary visibility | Collapsible block / Hidden |
| Orchestrator — enabled | On / Off |
| Max pipeline steps | Slider 1–7 |
| IMAGE_GEN auto-last enforcement | On / Off |

### Bot Modes (existing section — changes)

- Think Mode tab removed
- Default and Pro remain — classifier prompt editable per mode (routing sensitivity lives here as the tiebreaker paragraph)

### Router — Pipeline Prompts (new sub-section)

List of all chain types with their internal prompt textarea — used when the chain operates as an intermediate step. Each has:
- Editable textarea
- Reset to default button

### Compiled Prompt (existing page — additions)

Each section block gets a toggle: `Final output only` vs `All chains`

### Status Messages (new sub-section in Global Settings or Router)

Per chain type:
- Label text (editable)
- Emoji/icon (editable)
- Show chain duration (On / Off) — e.g. "Searching the web... ✓ 3.2s"
- Enable/disable status display entirely

---

## 9. Platform Scope

Multi-chain orchestration applies to **both platforms** — Telegram and web/app. The current split (`platform: 'telegram'` vs `platform: 'app'` in `router_chains`) is merged into a single unified chain configuration. One router matrix, one set of chain configs, shared by all clients.

**Migration:** existing duplicate chain configs (one per platform) are consolidated. Admin manages one router, changes apply everywhere.

---

## 10. Edge Cases

### FAST_SIMPLE + Thinking ON
When thinking is ON, the think chain fires on ALL requests including FAST_SIMPLE. Even simple questions benefit from a reasoning pass that catches assumptions before they reach the output chain. No exceptions based on category.

### Think Chain with Empty Accumulated Context
When thinking is ON and the request is single-chain, the think chain receives no accumulated chain outputs. It treats the original prompt + history + session summary as its full input and performs a pure reasoning pass — multiple approaches considered, one committed to.

---

## 12. What Stays Unchanged

- All existing chain categories (FAST_SIMPLE, MEDIUM_THINKING, COMPLEX_THINKING, CODING, WEB_SEARCH, DEEP_RESEARCH, IMAGE_GEN, TOOL_CALLING, AUDIO_VOICE, VISION)
- Brain entries system
- Vault / API key management
- Session compaction and memory
- Reply context block construction
- Classifier keyword fast-path
- Model registry
- Chain presets
- Usage tracking

---

## 13. Open Questions for Implementation

1. **Classifier MULTI_CHAIN signal** — the classifier currently outputs a single category name. It needs to be able to output `MULTI_CHAIN:[VISION,WEB_SEARCH,COMPLEX]` or a two-step signal. Decide: extend classifier output format, or add a separate "is multi-chain needed?" check after classification.

2. **Streaming** — not all models support it. Status updates (option B) are achievable without streaming. Full response streaming is deferred until model support is confirmed per chain.

3. **Think chain correction loop implementation** — when the think chain requests a correction chain, the system needs to re-enter the chain execution loop for one additional step. Needs careful implementation to avoid infinite loops (hard-code the correction limit at the router level, not just in the prompt).

4. **Context accumulation size** — as chains accumulate outputs, the context passed to later chains grows. A summarization step may be needed if accumulated context exceeds the model's context window. Recommend a character limit per chain output (e.g. 4000 chars max) enforced at the router level.

5. **Prompt file migration** — `mode-think.txt` is retired. The classifier prompt for Think mode needs to be archived. Default and Pro classifier prompts need routing sensitivity tiebreakers reviewed and updated to reflect the new 2-mode design.
