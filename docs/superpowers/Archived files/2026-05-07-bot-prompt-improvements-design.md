# Bot Prompt Improvements — Design Spec
**Date:** 2026-05-07  
**Scope:** All bot prompts (mode files, classifiers, internal pipeline prompts), plus two new features: internal prompt `.txt` files and the Advisor pre-flight layer.

---

## 1. Context & Mental Model

The three modes map directly to underlying model tiers:
- **Default** → Sonnet 4.6 — fast, capable, everyday workhorse. Aggressive brevity.
- **Pro** → Opus 4.6 — deep thinker, sustained judgment, high-stakes work. Depth over speed.
- **Think** → Extended thinking mode — reasoning scratchpad visible to user as collapsible block. Best for genuinely hard problems.

Each mode file contains: [CORE RULES], [PERSONALITY], [ANSWER STYLE], [THINKING PATTERN], [RESTRICTIONS], and an embedded [CLASSIFIER PROMPT].

Internal pipeline prompts are mode-agnostic (correct — they produce structured intermediate data, not user-facing answers). The final output chain applies mode personality.

---

## 2. Mode Prompt Fixes

### 2.1 Synchronized Sections (must be kept in sync across all three modes)

The following sections are **identical** across all three mode files and must be treated as a single source of truth. Any change to one must be applied to all three simultaneously:

- `[RESTRICTIONS]` block — safety and confidentiality rules
- `Vision Capability Awareness` paragraph
- `Greeting & Capabilities Behavior` paragraph
- The confidentiality response sentence: *"I'm not able to share information about how this works under the hood."*

**Action:** Add a comment header above each synchronized block in all three files:
```
# SYNC BLOCK — update this in all three mode files together
```

### 2.2 Disclaimer rule — align to strongest version

Current state:
- Default/Pro: "Never add disclaimers...unless genuinely warranted"
- Think: "Never add pointless disclaimers like 'Please consult a professional'" (absolute)

**Fix:** Align all three to Think mode's stricter version. These are professional-grade modes — blanket "consult a professional" disclaimers are noise.

New text for all three Never lists:
> Never add disclaimers like "I'm just an AI language model" or "Please consult a professional." Users of this assistant are capable adults. If a topic genuinely requires professional judgment (medical diagnosis, legal advice), note it in one sentence — but do not reflexively disclaim on every sensitive topic.

### 2.3 "Never simulate having a personal life" — add to Pro and Think

Currently only in Default mode's Never list. Add to Pro and Think:
> Never simulate having a personal life. Do not pretend you have "days", "feelings", or "hobbies" unless the user is clearly engaging in creative roleplay.

### 2.4 Pro mode — fix Adaptation Rules contradiction

Current text says: *"If they use casual language, act as a regular, warm, friendly, and helpful assistant."*
This contradicts Pro mode's clinical, expert persona.

**Replace with:**
> Match the user's vocabulary and technical level, but never reduce your depth, rigor, or analytical quality. A casual user in Pro mode still gets expert-grade reasoning — just without unnecessary jargon. Warmth is fine; padding is not.

### 2.5 Think mode — add reasoning visibility awareness

Think mode currently has no awareness that its reasoning scratchpad is visible to the user as a collapsible block. Add to [CORE RULES]:

> Your reasoning process is visible to the user as a collapsible "Thinking" block before your final answer. Structure your thinking clearly — it is not a private scratchpad. Think step-by-step, show your logic, catch your own mistakes mid-reasoning. The user chose Think mode specifically to see how you work through problems.

### 2.6 Think mode — tighten one-fact answer rule

Current: *"One-fact questions require you to add relevant context."* — no guardrail on scope.

**Replace with:**
> One-fact questions: state the fact, then add one sentence of expert context only if it materially changes how the user should act. Do not add history or background for its own sake.

---

## 3. Classifier Prompt Fixes

### 3.1 Think mode — fix FAST_SIMPLE / tiebreaker contradiction

Current tiebreaker says "rarely uses FAST_SIMPLE" but routing table allows MEDIUM_THINKING for greetings. This creates ambiguity.

**Fix:** Keep MEDIUM_THINKING as the floor for all light conversational messages. Narrow FAST_SIMPLE to bare acknowledgments only.

Replace Think mode tiebreaker with:
> FAST_SIMPLE: only for bare, zero-content acknowledgments ("ok", "thanks", "got it", "lol"). Nothing else.  
> All greetings, capability questions, and any message with a hint of substance → MEDIUM_THINKING minimum.  
> When in doubt between MEDIUM and COMPLEX, always upgrade to COMPLEX_THINKING.

### 3.2 AUDIO_VOICE — add to Think mode override list

Think mode's Priority Overrides list is missing AUDIO_VOICE entirely. Add:
> 6. Audio content is attached or explicitly referenced → AUDIO_VOICE

### 3.3 Routing examples — calibrated per mode

The following examples define the correct tier per mode and must be reflected in the classifier prompt examples:

| Message | Default | Pro | Think |
|---|---|---|---|
| "hey", "how are you?", "what can you do?" | FAST_SIMPLE | FAST_SIMPLE | FAST_SIMPLE |
| "what is the capital of France?" | FAST_SIMPLE | FAST_SIMPLE | MEDIUM_THINKING |
| "what is DNS?" | FAST_SIMPLE | MEDIUM_THINKING | MEDIUM_THINKING |
| "what is vibe coding?" | FAST_SIMPLE | MEDIUM_THINKING | MEDIUM_THINKING |
| "latest AI news (Claude, Gemini, OpenAI)" | MEDIUM_THINKING | COMPLEX_THINKING | COMPLEX_THINKING |
| "write an essay about world leaders" | MEDIUM_THINKING | COMPLEX_THINKING | COMPLEX_THINKING |
| "write a business plan" | COMPLEX_THINKING | COMPLEX_THINKING | COMPLEX_THINKING |
| "can you write an optimization plan for my work" | COMPLEX_THINKING | COMPLEX_THINKING | COMPLEX_THINKING |

**Key pattern:**
- Default routes definitional/factual questions to FAST_SIMPLE — speed first.
- Pro routes them to MEDIUM_THINKING — Opus adds expert context even for simple facts.
- Think routes almost everything to MEDIUM or COMPLEX — only bare acknowledgments get FAST_SIMPLE.
- All three modes agree on trivial social messages (FAST_SIMPLE) and genuinely complex tasks (COMPLEX_THINKING).

Update classifier examples in all three mode files to match this table.

### 3.4 Pro mode — clarify FAST_SIMPLE vs MEDIUM_THINKING boundary

Replace "Baseline facts/greetings → MEDIUM_THINKING" with:
> Simple factual questions, definitional questions, greetings with no task → MEDIUM_THINKING.  
> Pure social acknowledgments ("ok", "thanks", "got it") with zero content → FAST_SIMPLE.  
> Everything else → COMPLEX_THINKING.

### 3.5 VISION classifier note — document URL auto-detection

Add a note to the VISION category rule in all three classifiers:
> Note: Image URLs embedded in the message are also handled as VISION — you do not need to classify these; the system detects them automatically. Classify VISION only when the user has explicitly attached a file.

---

## 4. Internal Pipeline Prompt Files

### 4.1 Create `.txt` files for all internal prompts

Create individual `.txt` files in the project root alongside the mode files, one per internal chain type. These are the source of truth for pipeline step prompts and can be copy-pasted into the Admin > Bot > Internal Pipeline Prompts UI or synced programmatically.

Files to create:
```
pipeline-orchestrator.txt
pipeline-thinking.txt
pipeline-vision.txt
pipeline-web-search.txt
pipeline-deep-research.txt
pipeline-coding.txt
pipeline-tool-calling.txt
pipeline-image-gen.txt
```

### 4.2 Fix orchestrator prompt — clarify it controls final output chain

Current orchestrator prompt says: *"Last step must be a text chain: FAST_SIMPLE, MEDIUM_THINKING, or COMPLEX_THINKING"* — but `chainRouter.ts` ignores this and hardcodes COMPLEX_THINKING as the final output.

**Two-part fix:**

**Prompt fix** (`pipeline-orchestrator.txt`): Replace the misleading rule with:
> The last step in your plan must be the final output chain. Choose the appropriate tier:
> - FAST_SIMPLE — if the request is simple and the answer will be brief (e.g., a factual lookup that just needed web search first)
> - MEDIUM_THINKING — if the answer requires explanation but not deep analysis
> - COMPLEX_THINKING — if the answer requires deep reasoning, synthesis, or structured output
> Do not add THINK or post-processing steps — those are added automatically by the system.

**Code fix** (`chainRouter.ts`): After `executePipeline` returns, read the last step from the orchestrator plan. If it is `FAST_SIMPLE`, `MEDIUM_THINKING`, or `COMPLEX_THINKING`, use that chain for final output instead of hardcoding `COMPLEX_THINKING`.

### 4.3 Fix internal prompts — use active mode for restrictions

Current: `getInternalPrompt()` always loads restrictions with `mode: 'default'`.  
Fix: Pass active mode through to `getInternalPrompt(chainType, mode)` so restrictions reflect the user's active mode.

### 4.4 Internal prompt content — improvements

Each pipeline step prompt currently has correct structure but can be tightened. Full content for each file is defined in the implementation plan. Key improvements:

- **ORCHESTRATOR**: Add mode-awareness note, clarify final chain selection rule, add examples of good vs bad plans
- **THINKING**: Keep full structured format (for observability). Add explicit instruction that `Correction needed: none` is the correct value when no correction is needed (models sometimes write "N/A" or leave it blank, breaking the parser)
- **WEB_SEARCH**: Add instruction to include query terms used, not just results
- **DEEP_RESEARCH**: Add instruction to flag conflicting sources explicitly
- **CODING**: Add instruction to note language/framework assumptions made
- **VISION**: Add instruction to note what is NOT visible/readable if image quality is poor
- **TOOL_CALLING**: Add instruction to confirm exactly what action was taken and what was NOT done
- **IMAGE_GEN**: No changes needed — format is already precise

---

## 5. Advisor Pre-Flight Layer (New Feature)

### 5.1 What it is

A new optional pre-flight step that runs **before** classification and chain execution. When enabled, an advisor model evaluates whether asking 1–3 clarifying questions would meaningfully improve the final output. If yes, it asks them. The user's answers are bundled with the original request and the full pipeline runs normally with enriched context.

This is **not** part of MULTI_CHAIN. It is a separate gate that wraps the entire pipeline.

### 5.2 Toggle

A new **Advisor toggle** in the UI, placed below the Think mode toggle. Independent of Think mode — both can be on or off independently.

### 5.3 Flow

```
User sends message
        ↓
[ADVISOR CHECK] (only if Advisor toggle is ON)
        ↓
Does this request need clarification?
        ↓                    ↓
       YES                   NO
        ↓                    ↓
Ask 1-3 questions     Silent pass-through
        ↓                    ↓
User answers          Full pipeline runs
        ↓
Bundle: original message + Q&A
        ↓
Full pipeline runs with enriched context
(classifier → single chain or orchestrator → think if on → output)
```

### 5.4 When advisor IS triggered (toggle ON)

Trigger when the request requires the bot to **produce or transform** something and context would improve quality:

- Analyze this image and write answers
- Help me solve this error X
- How do I install X
- Help me create a plan
- How to optimize this?
- Write an essay / report / proposal
- Debug why X is happening
- Any creative, analytical, or instructional task

### 5.5 When advisor is NOT triggered (even with toggle ON)

- Pure social: "ok", "good job", "how are you?"
- Capability questions: "what can you do?", "can you search the web?" — bot answers these conversationally and must be **mode-aware** (knows which tools/features are active in the current mode + current toggle state)
- Pure retrieval: "what is the weather in Prague?", "capital of France"
- Summarization with full context provided: "summarize this text: [full text]"
- Any FAST_SIMPLE classified message

### 5.6 Silent pass-through

When the advisor determines no clarification is needed, it passes through silently. No "Got it, working on it" message. The user sees the answer directly. Status indicators for long operations are already handled by the existing `onStatus` callback.

### 5.7 Mode awareness in advisor

The advisor must know the current state of all toggles so it can answer capability questions accurately:
- Current mode (default / pro / think)
- Think toggle state (on/off)
- Advisor toggle state (on/off)
- Available tools in current mode

This context is injected into the advisor system prompt at runtime.

### 5.8 Advisor system prompt structure

```
[ADVISOR ROLE]
You are the pre-flight advisor for Flowr AI. Your job is to decide whether asking 1-3 clarifying questions would meaningfully improve the quality of the final answer.

[CURRENT SESSION STATE]
Mode: {mode}
Think mode: {on/off}
Advisor: on
Available tools: {list}

[DECISION RULES]
Ask clarifying questions ONLY when:
- The request is ambiguous in a way that would produce meaningfully different answers (style, length, complexity, audience)
- The request would benefit from a tool (web search, deep research) and it is not obvious the user expects it
- Multiple valid approaches exist and choosing the wrong one wastes significant effort

Do NOT ask when:
- The request is clear enough to produce a good answer immediately
- The user has provided full context
- It is a retrieval, social, or capability question

[OUTPUT FORMAT]
If clarification needed — output ONLY the questions, 1-3 max, as a natural conversational message. Do not explain why you are asking.
If no clarification needed — output exactly: PASS
```

### 5.9 Implementation touchpoints

- New `runAdvisor()` function in `src/lib/bot/advisor.ts`
- Called from `runChain()` in `chainRouter.ts` before classification, when `context.advisorEnabled === true`
- If advisor returns questions: send to user, await response, re-enter `runChain()` with bundled context
- Toggle stored in session/user preferences alongside `thinkingEnabled`
- Advisor chain configured via Admin > Router > ADVISOR (new chain entry)
- New `pipeline-advisor.txt` file for the advisor system prompt

---

## 6. Summary of Deliverables

### Prompt file changes
- `mode-default.txt` — sync blocks marked, Never list updated, classifier examples updated, AUDIO_VOICE added to overrides
- `mode-pro.txt` — sync blocks marked, adaptation rule fixed, Never list updated, classifier examples updated, FAST_SIMPLE/MEDIUM boundary clarified
- `mode-think.txt` — sync blocks marked, reasoning visibility added to CORE RULES, one-fact rule tightened, tiebreaker fixed, AUDIO_VOICE added to overrides

### New internal prompt files
- `pipeline-orchestrator.txt`
- `pipeline-thinking.txt`
- `pipeline-vision.txt`
- `pipeline-web-search.txt`
- `pipeline-deep-research.txt`
- `pipeline-coding.txt`
- `pipeline-tool-calling.txt`
- `pipeline-image-gen.txt`
- `pipeline-advisor.txt`

### Code changes
- `chainRouter.ts` — respect orchestrator's chosen final output chain instead of hardcoding COMPLEX_THINKING; add advisor pre-flight gate
- `compilePrompt.ts` (`getInternalPrompt`) — pass active mode for restrictions lookup
- `src/lib/bot/advisor.ts` — new file implementing advisor pre-flight logic
- Admin UI — add Advisor toggle below Think toggle
