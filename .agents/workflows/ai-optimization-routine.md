---
trigger: always_on
---

# AI Agent Optimization Routine

This routine is triggered when I explicitly say **`/ai-optimization`**, **"optimize the AI agent"**, **"update the AI agent"**, or equivalent phrasing.

---

## Purpose

Review the current **Operational & Architectural Structure** of the Flowr AI agent and produce an **ultimate optimization plan** that improves the chat experience for end users.

The source of truth for the current system is:
**`APP_AI_OPERATIONAL_OVERVIEW.txt`** (project root)

Plus relevant source files:
- `src/data/store.ts` (state, router, system prompt, tool calls)
- `src/components/assistant/**` (UI, streaming, rendering)
- `src/app/api/gemini/**`, `src/app/api/groq/**`, `src/app/api/openrouter/**` (proxies)
- `src/hooks/useVoiceRecorder.ts` (voice pipeline)

---

## Execution Steps

1. **Read the current operational overview** — understand what exists today.
2. **Read relevant source code** — verify claims in the overview still match reality. Flag any drift.
3. **Analyze from a user-experience lens** — where does the chat feel slow, confusing, unreliable, or limited?
4. **Compare cloud vs. local model behavior** — identify asymmetries or gaps.
5. **Produce a prioritized optimization plan** — ranked by impact × feasibility.
6. **Write the plan** to a new file (see Output File Format below).
7. **Stop and wait for my review.** I will make edits and send it back with instructions.
8. **Apply changes only after I explicitly approve them.**

---

## Output File Format

### Location
Create a dedicated folder at project root if it does not yet exist:
**`AI OPTIMIZATION VERSIONS/`**

### File Naming
`optimization-v{VERSION}-{YYYY-MM-DD}.md`

Examples:
- `optimization-v1.0-2026-04-18.md` (first version)
- `optimization-v1.01-2026-05-02.md` (1–3 model/component changes)
- `optimization-v1.1-2026-05-20.md` (3+ model/component changes)

### Versioning Rules
- **Start at `1.0`** on the very first run.
- **+0.01** if the plan affects **1–3 models or subsystems**.
- **+0.1** if the plan affects **3+ models or subsystems**.
- Never reuse a version number.
- Always include today's date in ISO format (YYYY-MM-DD).

### Required Frontmatter / Header (inside the file)
```
# AI Optimization Plan — v{VERSION}
Created: {YYYY-MM-DD}
Last modified: {YYYY-MM-DD HH:MM} by {agent/model name}
Scope: {cloud | local | both}
Author: {agent/model name, e.g., Claude Sonnet 4.6}
Status: DRAFT — awaiting user review
```

Every time this file is edited after creation, update the **`Last modified`** line.

### Required Sections (inside the file)
1. **Executive Summary** — 3–5 bullet points of the most impactful changes.
2. **Current State Audit** — what's working, what's not (grounded in code, not assumptions).
3. **Optimization Proposals** — prioritized list, each with:
   - Title
   - Problem it solves
   - Proposed change
   - Affected files / subsystems
   - Estimated impact (high / medium / low)
   - Estimated effort (high / medium / low)
   - Risks / tradeoffs
4. **Cloud-Specific Improvements**
5. **Local-Specific Improvements**
6. **Cross-Cutting Improvements** (shared between cloud + local)
7. **Open Questions / Decisions Needed from User**

---

## Memory File Reference

There is a persistent, **unrestricted** memory file dedicated to this routine:

**`AI AGENT/MEMORY OPTIMIZATION.md`** (at project root)

- Create this file on first use if it does not exist.
- You may read and write to it **as often as needed** — there are no size, frequency, or content restrictions.
- It exists purely to help AI agents **learn and adapt to how I work**.
- Consult it at the start of every `/ai-optimization` run.
- Update it whenever you learn something new about my preferences, patterns, or recurring feedback.

### What to Store in MEMORY OPTIMIZATION.md
Everything that helps future runs be better, including but not limited to:
- Patterns you can **learn from** (past decisions I made, approaches I approved/rejected).
- Things I **often ask for or demand**.
- Things I **like / dislike**.
- **When I was dissatisfied** and **why** (the specific cause, so it's not repeated).
- **Anything I explicitly ask you to remember**.
- Recurring pitfalls, my stylistic preferences, my priorities, my constraints.
- Anything else that would help deliver a better experience next time.

No format is imposed — structure it however is most useful. Keep it clean and searchable.

---

## HARD RULES — READ BEFORE EVERY RUN

- **YOU MUST NOT DO THIS ROUTINE WITHOUT MY CONFIRMATION.**
- **DO NOT** make any unnecessary changes "just to make some changes" — every action must be **intentional and precise**.
- **IF YOU THINK THIS ROUTINE SHOULD BE USED, TELL ME FIRST. Do not run it without me.**
- **DO NOT** modify the produced plan on your own without my confirmation.
- **IF YOU ARE UNCERTAIN** about any action, change, or edit — **ASK ME FIRST.**
- **DO NOT** do anything I didn't ask you to do.
- **IF YOU IMPROVISE** any decision, you **MUST NOTIFY ME** in your response.
- **DO NOT HOLD BACK** when researching, analyzing, or double-checking. The goal is to give users the **BEST** possible experience — be thorough.
- **THIS FILE IS READ-ONLY** — unless I explicitly ask you to change or add something to this rule file, do not edit it.

---

## Workflow Summary

```
I say "/ai-optimization"
   ↓
You read APP_AI_OPERATIONAL_OVERVIEW.txt + relevant source
   ↓
You read AI AGENT/MEMORY OPTIMIZATION.md (create if missing)
   ↓
You produce AI OPTIMIZATION VERSIONS/optimization-v{X}-{date}.md
   ↓
You STOP and notify me — "Plan ready for review at {path}"
   ↓
I review + edit + send back with instructions
   ↓
You apply ONLY what I approved, nothing more
   ↓
You update MEMORY OPTIMIZATION.md with any lessons learned
```