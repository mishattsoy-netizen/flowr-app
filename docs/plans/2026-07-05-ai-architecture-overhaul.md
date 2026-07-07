# AI Architecture Overhaul Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor the monolithic AI backend into a modular, cached, and reliable architecture. Implement zero-loop XML tag action intercepts, accurate token counting, and a pill-based UI for `@` mentions.

**Architecture:** Next.js Aggressive Caching for database configurations, single-responsibility services (`promptBuilder`, `memoryManager`, `providerExecution`), Zero-Loop XML Interceptor on the frontend for multi-step tool calls, and a `contentEditable` input for pill mentions.

**Tech Stack:** Next.js Server Components, Supabase, React, Tailwind CSS.

---

### Task 1: Next.js Caching for Configs
**Files:** Modify `src/lib/router-config.ts`, Create `src/app/api/admin/revalidate/route.ts`
Wrap Supabase config fetches in `unstable_cache` and create the `/revalidate` route.

### Task 2: Prompt Builder & Architecture
**Files:** Create `src/lib/bot/services/promptBuilder.ts`, Create `src/lib/bot/prompts/`
Create a dedicated `prompts` folder containing clean `.ts` files for each prompt (Global, Regular, Complex). The prompt builder loads the prompt for the selected mode and appends the static XML Tool Instructions.

### Task 3: Memory Manager Service
**Files:** Create `src/lib/bot/services/memoryManager.ts`
Extract history fetching and RAG logic.

### Task 4: Provider Execution & Async Logging
**Files:** Create `src/lib/bot/services/providerExecution.ts`
Extract `fetch` calls. Convert `logCost` to a fire-and-forget promise.

### Task 5: Refactor Orchestrator
**Files:** Modify `src/lib/bot/chainRouter.ts`
Wire services together: `getRouterChain` -> `buildSystemPrompt` -> `executeProvider`.

### Task 6: Zero-Loop XML Interceptor & Tool Execution Flow
**Files:** Modify `src/components/chat/ChatConversation.tsx`
This handles the multi-step API flow natively in the frontend. When the frontend silently re-enters the API, it will reuse the existing **Pipeline Status Messages** (e.g. "Searching...") to keep the user informed.
**Tools supported via XML Tags:** 
- Creation: `<create_note>`, `<generate_image>`, `<add_task>`, `<create_canvas>`
- Search/Research: `<web_search>`, `<deep_research>`, `<read_workspace>`
- Mutators/Cleanup: `<edit_note>`, `<edit_canvas>`, `<edit_task>`, `<move_entity>`, `<delete_entity>` (Allows AI to do mass-cleanups by reading the workspace first, then issuing delete tags).

### Task 7: Token Counting Fix
**Files:** Modify `src/components/assistant/AIAssistant.tsx`, `src/lib/bot/chainRouter.ts`
Ensure `displayedTokens` ignores the cached system prompts and only counts dynamic context.

### Task 8: @ Mention Menu Popup
**Files:** Modify `src/components/assistant/AIAssistant.tsx`
Update input to show a mention popup when typing `@`, fetching workspaces/entities.

### Task 9: @ Mention Pill Rendering
**Files:** Modify `src/components/assistant/AIAssistant.tsx`
Switch the standard `<textarea>` to a `contentEditable` div (Option B) to natively support rendering matched `@entities` as styled HTML pills inline.
