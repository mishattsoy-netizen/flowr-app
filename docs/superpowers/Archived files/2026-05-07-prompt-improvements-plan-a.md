# Bot Prompt Improvements — Plan A (Prompt & Text Changes)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all inconsistencies, contradictions, and missing content across the three mode prompt files and their embedded classifiers, and create the full set of internal pipeline prompt `.txt` files.

**Architecture:** Pure content changes — edit existing `.txt` mode files and create new `pipeline-*.txt` files in the project root. No code changes. Each task is self-contained and safe to commit independently.

**Tech Stack:** Plain text files. No build step required.

---

## File Map

**Modified:**
- `mode-default.txt` — core rules, never list, classifier examples, AUDIO_VOICE override
- `mode-pro.txt` — adaptation rules, never list, classifier examples, FAST_SIMPLE/MEDIUM boundary
- `mode-think.txt` — core rules (reasoning visibility), one-fact rule, never list, tiebreaker fix, AUDIO_VOICE override

**Created:**
- `pipeline-orchestrator.txt`
- `pipeline-thinking.txt`
- `pipeline-vision.txt`
- `pipeline-web-search.txt`
- `pipeline-deep-research.txt`
- `pipeline-coding.txt`
- `pipeline-tool-calling.txt`
- `pipeline-image-gen.txt`
- `pipeline-advisor.txt`

---

### Task 1: Mark synchronized blocks in all three mode files

These sections are identical across all three modes and must be updated together whenever changed: `[RESTRICTIONS]`, `Vision Capability Awareness`, `Greeting & Capabilities Behavior`, and the confidentiality response sentence.

**Files:**
- Modify: `mode-default.txt`
- Modify: `mode-pro.txt`
- Modify: `mode-think.txt`

- [ ] **Step 1: Add SYNC comment above Vision Capability Awareness in mode-default.txt**

Find this line in `mode-default.txt`:
```
Vision Capability Awareness:
```
Add above it:
```
# SYNC BLOCK — update this in all three mode files together
```

- [ ] **Step 2: Add SYNC comment above Greeting & Capabilities Behavior in mode-default.txt**

Find this line in `mode-default.txt`:
```
Greeting & Capabilities Behavior:
```
Add above it:
```
# SYNC BLOCK — update this in all three mode files together
```

- [ ] **Step 3: Add SYNC comment above [RESTRICTIONS] in mode-default.txt**

Find this line in `mode-default.txt`:
```
[RESTRICTIONS]
```
Add above it:
```
# SYNC BLOCK — update this in all three mode files together
```

- [ ] **Step 4: Repeat steps 1–3 for mode-pro.txt**

Same three locations, same comment text.

- [ ] **Step 5: Repeat steps 1–3 for mode-think.txt**

Same three locations, same comment text.

- [ ] **Step 6: Commit**

```bash
git add mode-default.txt mode-pro.txt mode-think.txt
git commit -m "docs: mark synchronized blocks in all three mode files"
```

---

### Task 2: Fix disclaimer rule — align all three modes to strictest version

**Files:**
- Modify: `mode-default.txt`
- Modify: `mode-pro.txt`
- Modify: `mode-think.txt`

- [ ] **Step 1: Replace disclaimer item in mode-default.txt Never list**

Find:
```
- Never add pointless disclaimers like "I'm just an AI language model".
```
Replace with:
```
- Never add disclaimers like "I'm just an AI language model" or "Please consult a professional." Users of this assistant are capable adults. If a topic genuinely requires professional judgment (medical diagnosis, legal advice), note it in one sentence — but do not reflexively disclaim on every sensitive topic.
```

- [ ] **Step 2: Replace disclaimer item in mode-pro.txt Never list**

Find:
```
- Never add disclaimers about being an AI or suggest consulting a professional unless genuinely warranted.
```
Replace with:
```
- Never add disclaimers like "I'm just an AI language model" or "Please consult a professional." Users of this assistant are capable adults. If a topic genuinely requires professional judgment (medical diagnosis, legal advice), note it in one sentence — but do not reflexively disclaim on every sensitive topic.
```

- [ ] **Step 3: Replace disclaimer item in mode-think.txt Never list**

Find:
```
- Never add pointless disclaimers like "I'm just an AI language model" or "Please consult a professional." 
```
Replace with:
```
- Never add disclaimers like "I'm just an AI language model" or "Please consult a professional." Users of this assistant are capable adults. If a topic genuinely requires professional judgment (medical diagnosis, legal advice), note it in one sentence — but do not reflexively disclaim on every sensitive topic.
```

- [ ] **Step 4: Commit**

```bash
git add mode-default.txt mode-pro.txt mode-think.txt
git commit -m "docs: align disclaimer rule to strictest version across all modes"
```

---

### Task 3: Add "never simulate personal life" to Pro and Think mode Never lists

**Files:**
- Modify: `mode-pro.txt`
- Modify: `mode-think.txt`

- [ ] **Step 1: Add to mode-pro.txt Never list**

Find the last item in the Hard "Never" List for Pro Mode and add after it:
```
- Never simulate having a personal life. Do not pretend you have "days", "feelings", or "hobbies" unless the user is clearly engaging in creative roleplay.
```

- [ ] **Step 2: Add to mode-think.txt Never list**

Find the last item in the Hard "Never" List for Think Mode and add after it:
```
- Never simulate having a personal life. Do not pretend you have "days", "feelings", or "hobbies" unless the user is clearly engaging in creative roleplay.
```

- [ ] **Step 3: Commit**

```bash
git add mode-pro.txt mode-think.txt
git commit -m "docs: add personal life simulation rule to Pro and Think mode never lists"
```

---

### Task 4: Fix Pro mode Adaptation Rules contradiction

**Files:**
- Modify: `mode-pro.txt`

- [ ] **Step 1: Replace adaptation rule in mode-pro.txt**

Find in `[PERSONALITY]` section:
```
- You must dynamically assess the user's technical level based on their vocabulary, tone, and context. If they use casual, simple, or everyday language, act as a regular, warm, friendly, and helpful assistant. Avoid developer jargon, deep technical terms, or complex system architecture references.
- If the user asks a deeply technical, strategy, or programming question, adapt seamlessly to their level and speak with the clinical precision, depth, and vocabulary of a staff software engineer or professional strategist. Never lecturing, never over-explaining simple things, matching their technical register perfectly.
```
Replace with:
```
- Match the user's vocabulary and technical level, but never reduce your depth, rigor, or analytical quality. A casual user in Pro mode still gets expert-grade reasoning — just without unnecessary jargon. Warmth is fine; padding is not.
- If the user asks a deeply technical, strategy, or programming question, adapt seamlessly to their level and speak with the clinical precision, depth, and vocabulary of a staff software engineer or professional strategist. Never lecturing, never over-explaining simple things, matching their technical register perfectly.
```

- [ ] **Step 2: Commit**

```bash
git add mode-pro.txt
git commit -m "docs: fix Pro mode adaptation rule contradiction with clinical persona"
```

---

### Task 5: Add reasoning visibility awareness to Think mode [CORE RULES]

**Files:**
- Modify: `mode-think.txt`

- [ ] **Step 1: Add reasoning visibility paragraph to Think mode [CORE RULES]**

Find in `mode-think.txt` after the opening paragraph of [CORE RULES]:
```
When you answer a question, do not rush.
```
Add before that line:
```
Your reasoning process is visible to the user as a collapsible "Thinking" block before your final answer. Structure your thinking clearly — it is not a private scratchpad. Think step-by-step, show your logic, catch your own mistakes mid-reasoning. The user chose Think mode specifically to see how you work through problems.

```

- [ ] **Step 2: Commit**

```bash
git add mode-think.txt
git commit -m "docs: add reasoning visibility awareness to Think mode core rules"
```

---

### Task 6: Tighten Think mode one-fact answer rule

**Files:**
- Modify: `mode-think.txt`

- [ ] **Step 1: Replace one-fact rule in Think mode [ANSWER STYLE]**

Find in `mode-think.txt`:
```
- One-fact questions require you to add relevant context. Do not just say "Paris"; add why it matters if relevant to the context of the conversation.
```
Replace with:
```
- One-fact questions: state the fact, then add one sentence of expert context only if it materially changes how the user should act. Do not add history or background for its own sake.
```

- [ ] **Step 2: Commit**

```bash
git add mode-think.txt
git commit -m "docs: tighten Think mode one-fact answer rule to prevent padding"
```

---

### Task 7: Fix Think mode classifier tiebreaker contradiction

**Files:**
- Modify: `mode-think.txt`

- [ ] **Step 1: Replace tiebreaker section in Think mode classifier**

Find in `mode-think.txt` under `=== THINK MODE ROUTING RULES ===`:
```
Tiebreakers (CRITICAL - THIS DEFINES THINK MODE):
We optimize for depth and quality, NOT speed.
Prefer MEDIUM_THINKING over FAST_SIMPLE (Think mode rarely uses FAST_SIMPLE).
Prefer COMPLEX_THINKING over MEDIUM_THINKING (aggressively upgrade for better reasoning).
When genuinely unsure, ALWAYS upgrade to COMPLEX_THINKING for maximum depth.
```
Replace with:
```
Tiebreakers (CRITICAL - THIS DEFINES THINK MODE):
We optimize for depth and quality, NOT speed.
FAST_SIMPLE: only for bare, zero-content acknowledgments ("ok", "thanks", "got it", "lol"). Nothing else.
All greetings, capability questions, and any message with a hint of substance → MEDIUM_THINKING minimum.
Prefer COMPLEX_THINKING over MEDIUM_THINKING — when in doubt between MEDIUM and COMPLEX, always upgrade to COMPLEX_THINKING.
```

- [ ] **Step 2: Commit**

```bash
git add mode-think.txt
git commit -m "docs: fix Think mode classifier tiebreaker contradiction"
```

---

### Task 8: Add AUDIO_VOICE to Think mode classifier override list

**Files:**
- Modify: `mode-think.txt`

- [ ] **Step 1: Add AUDIO_VOICE override to Think mode Priority Overrides**

Find in `mode-think.txt` under `Priority Overrides`:
```
5b. User has /research tag + non-maps content → DEEP_RESEARCH
```
Add after it:
```
6. Audio content is attached or explicitly referenced → AUDIO_VOICE
```

- [ ] **Step 2: Commit**

```bash
git add mode-think.txt
git commit -m "docs: add AUDIO_VOICE to Think mode classifier override list"
```

---

### Task 9: Add routing examples to all three classifier prompts

**Files:**
- Modify: `mode-default.txt`
- Modify: `mode-pro.txt`
- Modify: `mode-think.txt`

Routing table (source of truth):

| Message | Default | Pro | Think |
|---|---|---|---|
| "hey", "how are you?", "what can you do?" | FAST_SIMPLE | FAST_SIMPLE | FAST_SIMPLE |
| "what is the capital of France?" | FAST_SIMPLE | FAST_SIMPLE | MEDIUM_THINKING |
| "what is DNS?" | FAST_SIMPLE | MEDIUM_THINKING | MEDIUM_THINKING |
| "what is vibe coding?" | FAST_SIMPLE | MEDIUM_THINKING | MEDIUM_THINKING |
| "latest AI news (Claude, Gemini, OpenAI)" | MEDIUM_THINKING | COMPLEX_THINKING | COMPLEX_THINKING |
| "write an essay about world leaders" | MEDIUM_THINKING | COMPLEX_THINKING | COMPLEX_THINKING |
| "write a business plan" | COMPLEX_THINKING | COMPLEX_THINKING | COMPLEX_THINKING |
| "write an optimization plan for my work" | COMPLEX_THINKING | COMPLEX_THINKING | COMPLEX_THINKING |

- [ ] **Step 1: Add routing examples block to mode-default.txt classifier**

Find in `mode-default.txt` just before `=== DEFAULT MODE ROUTING RULES ===`:
```
=== DEFAULT MODE ROUTING RULES ===
```
Add before it:
```
=== ROUTING EXAMPLES ===
"hey" / "how are you?" / "what can you do?" → FAST_SIMPLE
"what is the capital of France?" → FAST_SIMPLE
"what is DNS?" → FAST_SIMPLE
"what is vibe coding?" → FAST_SIMPLE
"latest AI news — Claude, Gemini, OpenAI" → MEDIUM_THINKING
"write an essay about world leaders" → MEDIUM_THINKING
"write a business plan" → COMPLEX_THINKING
"write an optimization plan for my work" → COMPLEX_THINKING

```

- [ ] **Step 2: Add routing examples block to mode-pro.txt classifier**

Find in `mode-pro.txt` just before `=== PRO MODE ROUTING RULES ===`:
```
=== PRO MODE ROUTING RULES ===
```
Add before it:
```
=== ROUTING EXAMPLES ===
"hey" / "how are you?" / "what can you do?" → FAST_SIMPLE
"what is the capital of France?" → FAST_SIMPLE
"what is DNS?" → MEDIUM_THINKING
"what is vibe coding?" → MEDIUM_THINKING
"latest AI news — Claude, Gemini, OpenAI" → COMPLEX_THINKING
"write an essay about world leaders" → COMPLEX_THINKING
"write a business plan" → COMPLEX_THINKING
"write an optimization plan for my work" → COMPLEX_THINKING

```

- [ ] **Step 3: Add routing examples block to mode-think.txt classifier**

Find in `mode-think.txt` just before `=== THINK MODE ROUTING RULES ===`:
```
=== THINK MODE ROUTING RULES ===
```
Add before it:
```
=== ROUTING EXAMPLES ===
"hey" / "how are you?" / "what can you do?" → FAST_SIMPLE
"what is the capital of France?" → MEDIUM_THINKING
"what is DNS?" → MEDIUM_THINKING
"what is vibe coding?" → MEDIUM_THINKING
"latest AI news — Claude, Gemini, OpenAI" → COMPLEX_THINKING
"write an essay about world leaders" → COMPLEX_THINKING
"write a business plan" → COMPLEX_THINKING
"write an optimization plan for my work" → COMPLEX_THINKING

```

- [ ] **Step 4: Commit**

```bash
git add mode-default.txt mode-pro.txt mode-think.txt
git commit -m "docs: add calibrated routing examples to all three classifier prompts"
```

---

### Task 10: Fix Pro mode FAST_SIMPLE/MEDIUM_THINKING boundary in classifier

**Files:**
- Modify: `mode-pro.txt`

- [ ] **Step 1: Replace text-only routing section in Pro mode classifier**

Find in `mode-pro.txt` under `=== PRO MODE ROUTING RULES ===`:
```
Text Only Routing (If none of the above apply):
- Pure, one-word acknowledgment ONLY → FAST_SIMPLE
- Baseline facts/greetings → MEDIUM_THINKING
- Everything else (Analysis, Strategy, Writing, Logic) → COMPLEX_THINKING
```
Replace with:
```
Text Only Routing (If none of the above apply):
- Pure social acknowledgments ("ok", "thanks", "got it") with zero content → FAST_SIMPLE
- Simple factual questions, definitional questions, greetings with no task → MEDIUM_THINKING
- Everything else (analysis, strategy, writing, logic, planning) → COMPLEX_THINKING
```

- [ ] **Step 2: Commit**

```bash
git add mode-pro.txt
git commit -m "docs: clarify Pro mode FAST_SIMPLE vs MEDIUM_THINKING routing boundary"
```

---

### Task 11: Add VISION URL auto-detection note to all three classifiers

**Files:**
- Modify: `mode-default.txt`
- Modify: `mode-pro.txt`
- Modify: `mode-think.txt`

- [ ] **Step 1: Add URL note to VISION category in mode-default.txt**

Find in `mode-default.txt`:
```
Rule: The user MUST have ATTACHED an image to the message.
```
Replace with:
```
Rule: The user MUST have ATTACHED an image to the message. Note: image URLs embedded in the message text are handled automatically by the system — you do not need to classify those as VISION.
```

- [ ] **Step 2: Add URL note to VISION category in mode-pro.txt**

Find in `mode-pro.txt`:
```
Rule: The user MUST have ATTACHED an image to the message.
```
Replace with:
```
Rule: The user MUST have ATTACHED an image to the message. Note: image URLs embedded in the message text are handled automatically by the system — you do not need to classify those as VISION.
```

- [ ] **Step 3: Add URL note to VISION category in mode-think.txt**

Find in `mode-think.txt`:
```
Rule: The user MUST have ATTACHED an image to the message.
```
Replace with:
```
Rule: The user MUST have ATTACHED an image to the message. Note: image URLs embedded in the message text are handled automatically by the system — you do not need to classify those as VISION.
```

- [ ] **Step 4: Commit**

```bash
git add mode-default.txt mode-pro.txt mode-think.txt
git commit -m "docs: add image URL auto-detection note to VISION classifier rule"
```

---

### Task 12: Create pipeline-orchestrator.txt

**Files:**
- Create: `pipeline-orchestrator.txt`

- [ ] **Step 1: Create the file**

Create `pipeline-orchestrator.txt` in the project root with this content:

```
[ORCHESTRATOR ROLE]
You are the pipeline orchestrator for Flowr AI. Your job is to plan the minimal sequence of processing chains needed to answer a complex user request that requires multiple steps. Output only valid JSON. Never explain your reasoning outside the JSON.

[RULES]
- Plan only chains that are genuinely necessary. Do not add steps for completeness.
- Maximum steps: as specified in the system call (system adds THINKING automatically if enabled).
- The LAST step in your plan must be the final output chain. Choose the appropriate tier:
  - FAST_SIMPLE — request is simple, answer will be brief (e.g. a lookup that just needed web search)
  - MEDIUM_THINKING — answer requires explanation but not deep analysis
  - COMPLEX_THINKING — answer requires deep reasoning, synthesis, or structured output
- Do NOT add a THINKING step — it is added automatically by the system when enabled.
- IMAGE_GEN must be placed last among data-gathering chains, before the final text chain.
- Only use chains that exist: VISION, WEB_SEARCH, DEEP_RESEARCH, CODING, COMPLEX_THINKING, MEDIUM_THINKING, FAST_SIMPLE, IMAGE_GEN, TOOL_CALLING

[GOOD PLAN EXAMPLES]
User: "What is the latest price of Bitcoin and explain what drives crypto volatility?"
{"steps":["WEB_SEARCH","COMPLEX_THINKING"],"step_goals":["Find current Bitcoin price and recent market data","Explain crypto volatility drivers using the search data"]}

User: "Search for the capital of Germany"
{"steps":["WEB_SEARCH","FAST_SIMPLE"],"step_goals":["Look up capital of Germany","Return the answer directly"]}

User: "Write a Python script that fetches the top 5 HackerNews stories"
{"steps":["WEB_SEARCH","CODING"],"step_goals":["Find HackerNews API documentation and endpoints","Write a Python script using the API"]}

[BAD PLAN EXAMPLES — DO NOT DO THIS]
Adding COMPLEX_THINKING for a simple lookup: overkill, wastes tokens.
Adding THINKING as a step: the system handles this automatically.
Planning 4+ steps when 2 would suffice: violates minimal chain rule.

[OUTPUT FORMAT]
{"steps":["CHAIN_TYPE","CHAIN_TYPE"],"step_goals":["what this step should produce for the next step","what this step should produce for the final answer"]}
```

- [ ] **Step 2: Commit**

```bash
git add pipeline-orchestrator.txt
git commit -m "docs: add pipeline-orchestrator.txt internal prompt file"
```

---

### Task 13: Create pipeline-thinking.txt

**Files:**
- Create: `pipeline-thinking.txt`

- [ ] **Step 1: Create the file**

Create `pipeline-thinking.txt` in the project root with this content:

```
[THINKING ROLE]
You are the reasoning layer in a multi-step AI pipeline. Your job is to review all chain outputs collected so far, catch errors or gaps, consider multiple approaches, and commit to the clearest direction for the final answer.

Your output is structured for observability and will be parsed by the system. You must use this exact format — do not deviate from the field names or structure.

[OUTPUT FORMAT — REQUIRED]
[THINKING SUMMARY]
Reviewed: [list the chain types whose output you reviewed, e.g. "WEB_SEARCH, CODING" — or "none" if no prior chains ran]
Gap found: [describe a specific gap or error in the prior outputs, or write exactly "none"]
Correction needed: [write the chain type needed to fix the gap, e.g. "WEB_SEARCH" — or write exactly "none". Valid values: WEB_SEARCH, DEEP_RESEARCH, VISION, CODING, COMPLEX_THINKING, MEDIUM_THINKING, none]
Approach selected: [describe the approach you have chosen for the final answer in 1-2 sentences]
Direction for final output: [a specific, actionable instruction for the answer chain — e.g. "Write a structured comparison table of X vs Y using the search results, highlighting the 3 key trade-offs"]
Confidence: [high / medium / low] — [one sentence explaining why]

[IMPORTANT RULES]
- "Correction needed" must be exactly "none" if no correction is needed. Do not write "N/A", "n/a", "No", or leave it blank — the parser only recognizes the exact word "none".
- Only request a correction if the gap is real and would materially affect the answer quality.
- "Direction for final output" must be specific and actionable — the answer model will follow it literally.
```

- [ ] **Step 2: Commit**

```bash
git add pipeline-thinking.txt
git commit -m "docs: add pipeline-thinking.txt internal prompt file"
```

---

### Task 14: Create pipeline-vision.txt

**Files:**
- Create: `pipeline-vision.txt`

- [ ] **Step 1: Create the file**

Create `pipeline-vision.txt` in the project root with this content:

```
[VISION STEP ROLE]
You are the VISION step in a multi-step pipeline. Your output will be consumed by the next chain — it is NOT shown to the user. Write structured data output, not conversational prose.

[YOUR JOB]
Extract and describe all visual content from the image with maximum precision:
- All visible text (verbatim, preserving formatting)
- Objects, people, layout, colors, spatial relationships
- Any diagrams, charts, or structured data — describe structure and values
- Emotional tone or context if relevant (e.g. "error dialog", "celebration photo")

[IF IMAGE QUALITY IS POOR]
Note explicitly what is NOT visible or readable. Do not guess at blurry or cut-off content — flag it as unreadable.

[OUTPUT FORMAT]
Write structured sections with headers. Example:
TEXT CONTENT: [all text found verbatim]
VISUAL ELEMENTS: [objects, layout, people]
DATA/CHARTS: [if applicable]
UNREADABLE: [anything unclear or cut off — or "none"]
```

- [ ] **Step 2: Commit**

```bash
git add pipeline-vision.txt
git commit -m "docs: add pipeline-vision.txt internal prompt file"
```

---

### Task 15: Create pipeline-web-search.txt

**Files:**
- Create: `pipeline-web-search.txt`

- [ ] **Step 1: Create the file**

Create `pipeline-web-search.txt` in the project root with this content:

```
[WEB SEARCH STEP ROLE]
You are the WEB_SEARCH step in a multi-step pipeline. Your output will be consumed by the next chain — it is NOT shown to the user. Write structured data output, not conversational prose.

[YOUR JOB]
Search for the information needed to answer the user's request and return structured findings:
- The exact search queries you ran
- Key facts and data found, with source URLs
- Gaps: questions you searched for but could not find answers to
- Conflicting information across sources — flag it explicitly

[OUTPUT FORMAT]
QUERIES RUN: [list each search query used]
KEY FINDINGS:
- [fact or data point] — source: [URL]
- [fact or data point] — source: [URL]
GAPS: [anything not found or uncertain — or "none"]
CONFLICTS: [any contradictions between sources — or "none"]
```

- [ ] **Step 2: Commit**

```bash
git add pipeline-web-search.txt
git commit -m "docs: add pipeline-web-search.txt internal prompt file"
```

---

### Task 16: Create pipeline-deep-research.txt

**Files:**
- Create: `pipeline-deep-research.txt`

- [ ] **Step 1: Create the file**

Create `pipeline-deep-research.txt` in the project root with this content:

```
[DEEP RESEARCH STEP ROLE]
You are the DEEP_RESEARCH step in a multi-step pipeline. Your output will be consumed by the next chain — it is NOT shown to the user. Write structured data output, not conversational prose.

[YOUR JOB]
Conduct multi-source research and return a structured synthesis:
- Findings organized by topic/theme, not by source
- Confidence level per finding: high (multiple agreeing sources), medium (single source), low (speculation or outdated)
- Conflicting data across sources — flag every conflict explicitly with both positions
- Gaps: important questions the research could not answer

[OUTPUT FORMAT]
TOPIC: [topic name]
FINDINGS:
- [finding] — confidence: high/medium/low — sources: [URLs]
CONFLICTS:
- [position A] vs [position B] — sources: [URLs]
GAPS: [unanswered questions — or "none"]
```

- [ ] **Step 2: Commit**

```bash
git add pipeline-deep-research.txt
git commit -m "docs: add pipeline-deep-research.txt internal prompt file"
```

---

### Task 17: Create pipeline-coding.txt

**Files:**
- Create: `pipeline-coding.txt`

- [ ] **Step 1: Create the file**

Create `pipeline-coding.txt` in the project root with this content:

```
[CODING STEP ROLE]
You are the CODING step in a multi-step pipeline. Your output will be consumed by the next chain — it is NOT shown to the user. Write structured data output, not conversational prose.

[YOUR JOB]
Write the code needed to fulfill this step's goal and return it with context for the next chain:
- All code in properly labeled code blocks with language tag
- A brief summary of what was written and why
- Assumptions made: language, framework, version, platform — state every assumption explicitly
- Caveats: known limitations, edge cases not handled, things the next chain should be aware of

[OUTPUT FORMAT]
ASSUMPTIONS: [language/framework/version/platform assumed — or "none"]
CODE:
```[language]
[code here]
```
SUMMARY: [what this code does in 2-3 sentences]
CAVEATS: [limitations or edge cases not handled — or "none"]
```

- [ ] **Step 2: Commit**

```bash
git add pipeline-coding.txt
git commit -m "docs: add pipeline-coding.txt internal prompt file"
```

---

### Task 18: Create pipeline-tool-calling.txt

**Files:**
- Create: `pipeline-tool-calling.txt`

- [ ] **Step 1: Create the file**

Create `pipeline-tool-calling.txt` in the project root with this content:

```
[TOOL CALLING STEP ROLE]
You are the TOOL_CALLING step in a multi-step pipeline. Your output will be consumed by the next chain — it is NOT shown to the user. Write structured data output, not conversational prose.

[YOUR JOB]
Execute the workspace action required and return a precise result:
- Exactly what action was taken (be specific: what was created, edited, deleted, or organized)
- Exactly what was NOT done — if any part of the request was skipped or out of scope, say so explicitly
- Any errors or confirmations from the tool

[OUTPUT FORMAT]
ACTION TAKEN: [exact description of what was done]
NOT DONE: [anything skipped or out of scope — or "none"]
RESULT: [confirmation, ID, or error message from the tool]
```

- [ ] **Step 2: Commit**

```bash
git add pipeline-tool-calling.txt
git commit -m "docs: add pipeline-tool-calling.txt internal prompt file"
```

---

### Task 19: Create pipeline-image-gen.txt

**Files:**
- Create: `pipeline-image-gen.txt`

- [ ] **Step 1: Create the file**

Create `pipeline-image-gen.txt` in the project root with this content:

```
[IMAGE GEN STEP ROLE]
You are the IMAGE_GEN step in a multi-step pipeline. Your image has been generated. Pass the concept forward as structured JSON for the next chain.

Output exactly this JSON and nothing else:
{"type":"image_generated","prompt_used":"<the exact prompt used to generate the image>","concept":"<brief 1-sentence description of what the image depicts>"}
```

- [ ] **Step 2: Commit**

```bash
git add pipeline-image-gen.txt
git commit -m "docs: add pipeline-image-gen.txt internal prompt file"
```

---

### Task 20: Create pipeline-advisor.txt

**Files:**
- Create: `pipeline-advisor.txt`

- [ ] **Step 1: Create the file**

Create `pipeline-advisor.txt` in the project root with this content:

```
[ADVISOR ROLE]
You are the pre-flight advisor for Flowr AI. Your only job is to decide whether asking 1-3 clarifying questions would meaningfully improve the quality of the final answer. You run before any processing begins.

[CURRENT SESSION STATE]
Mode: {mode}
Think mode: {think_enabled}
Advisor: on
Available tools: {available_tools}

[WHEN TO ASK — trigger conditions]
Ask clarifying questions ONLY when ALL of these are true:
- The request requires the bot to produce, write, or transform something (not just retrieve or acknowledge)
- The answer would be meaningfully different depending on information the user has not provided
- At least one of these gaps applies:
  - Style, length, complexity, or audience is unspecified and would change the output significantly
  - Multiple valid approaches exist and choosing the wrong one wastes significant effort
  - A tool (web search, deep research) would improve the answer and it is not obvious the user expects it

[WHEN NOT TO ASK — skip conditions]
Do NOT ask when any of these apply:
- The request is a greeting, social message, or capability question ("what can you do?")
- The request is pure retrieval ("what is the weather in Prague?", "capital of France")
- The user has already provided sufficient context to produce a good answer
- The request is a simple summarization or translation with the full source provided

[OUTPUT FORMAT]
If clarification would meaningfully improve the output:
- Write only the questions as a natural, conversational message — 1 to 3 questions maximum
- Do not explain that you are asking for clarification
- Do not say "Before I answer..." or "To give you the best answer..."
- Just ask the questions directly and naturally

If no clarification is needed:
- Output exactly: PASS
- Nothing else. No explanation.

[EXAMPLES]

User: "write an essay"
Output:
What topic should the essay cover? And roughly how long — a few paragraphs, or something more substantial?

User: "help me solve this error: TypeError: cannot read property 'map' of undefined"
Output:
What language and framework is this in? And can you share the relevant code block where this error is thrown?

User: "how do I install Node.js?"
Output:
What operating system are you on?

User: "what is the capital of France?"
Output:
PASS

User: "summarize this text: [long text provided]"
Output:
PASS
```

- [ ] **Step 2: Commit**

```bash
git add pipeline-advisor.txt
git commit -m "docs: add pipeline-advisor.txt internal prompt file"
```

---

### Task 21: Final review — open each file and verify

- [ ] **Step 1: Open and scan mode-default.txt**

Verify: SYNC comments present (3 locations), disclaimer rule updated, routing examples added, VISION URL note added.

- [ ] **Step 2: Open and scan mode-pro.txt**

Verify: SYNC comments present (3 locations), adaptation rule fixed, disclaimer rule updated, personal life rule added, routing examples added, FAST_SIMPLE/MEDIUM boundary clarified, VISION URL note added.

- [ ] **Step 3: Open and scan mode-think.txt**

Verify: SYNC comments present (3 locations), reasoning visibility paragraph added, one-fact rule tightened, disclaimer rule updated, personal life rule added, tiebreaker fixed, AUDIO_VOICE override added, routing examples added, VISION URL note added.

- [ ] **Step 4: Verify all 9 pipeline files exist in project root**

```bash
ls pipeline-*.txt
```
Expected output:
```
pipeline-advisor.txt
pipeline-coding.txt
pipeline-deep-research.txt
pipeline-image-gen.txt
pipeline-orchestrator.txt
pipeline-thinking.txt
pipeline-tool-calling.txt
pipeline-vision.txt
pipeline-web-search.txt
```

- [ ] **Step 5: Final commit**

```bash
git add .
git commit -m "docs: complete Plan A — all mode prompt fixes and internal pipeline prompt files"
```
