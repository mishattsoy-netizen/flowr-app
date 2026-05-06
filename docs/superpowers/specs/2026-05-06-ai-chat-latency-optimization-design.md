# AI Chat Latency Optimization Design
**Date:** 2026-05-06
**Goal:** Reduce perceived latency of the AI chatbot by parallelizing DB reads and eliminating redundant round-trips. Zero changes to bot behavior, answer quality, or admin settings.

---

## Problem

Every chat request currently executes ~12 sequential Supabase DB round-trips before the AI model starts. On Vercel + remote Supabase, each round-trip costs ~30–80ms, adding up to 500–900ms of pure waiting before inference begins. Additionally, vault keys are fetched inside the model fallback loop (once per model), and `getCompactionConfig` is fetched twice per request.

---

## Scope

**Files touched:**
- `src/app/api/ai/chat/route.ts`
- `src/lib/bot/classifier.ts`
- `src/lib/bot/chainRouter.ts`
- `src/lib/bot/context.ts`
- `src/lib/router-config.ts`

**Not touched:** model providers, memory logic, auth, analytics, response format, DB schema, admin UI.

---

## Changes

### 1. Parallelize temperatures inside `getRouterChain` (`router-config.ts`)

**Current:** `getRouterChain` fetches the chain row, then calls `getRouterTemperatures()` sequentially — 2 DB queries in series.

**Fix:** Fire both queries with `Promise.all` inside `getRouterChain`. Temperatures still come from the same `settings` table row; admin temperature settings are fully respected.

---

### 2. Parallelize classifier config queries (`classifier.ts`)

**Current:** Three sequential `supabaseAdmin` queries:
1. `classifier_keywords_enabled` from `bot_settings`
2. `classifier_prompt` from `bot_settings`
3. `classifier_keywords` from `bot_settings`

**Fix:** Replace with a single `Promise.all` firing all three at once. Same rows, same data, same fallback logic.

---

### 3. Remove intent tag consistency check (`classifier.ts`)

**Current:** When an intent tag is active (e.g. `/search`), a Gemini API call is made to ask "is this message consistent with the tag?" (~300ms). If Gemini says no, the tag is ignored.

**Fix:** Remove `checkTagConsistency` and the Gemini call entirely. Tags are always trusted directly. This is a deliberate behavior change: the tag the user selected always wins with no AI override.

**Rationale:** The user explicitly activated the tag. Overriding their intent via a hidden Gemini call is worse UX, not better. The check also adds a full AI round-trip before routing even starts.

---

### 4. Fix duplicate `getCompactionConfig` call (`context.ts`)

**Current:** `getSessionState()` calls `getCompactionConfig()` first, then queries `bot_session_states` — 2 sequential queries.

**Fix:** Fire both with `Promise.all` inside `getSessionState`. The second `getCompactionConfig` call in `chainRouter.ts` (line ~265, post-response) is also removed since the config is already available from the pre-fetched result passed through.

**Note:** The post-response call doesn't affect perceived latency (it runs after the model responds), but removing it reduces unnecessary DB load.

---

### 5. Move `getFallbackModes` to Group 1 parallel batch (`chainRouter.ts`)

**Current:** `getFallbackModes()` is called at line ~160, after classification completes.

**Fix:** Fetch it in parallel with memory, compiled prompt, and session state at the start of `runChain` — before classification. It doesn't depend on the category (it returns all modes at once).

---

### 6. Prefetch vault keys before the model loop (`chainRouter.ts`)

**Current:** Inside the model loop, `getProviderKeys(key)` is called for each model — one vault DB query per model per request.

**Fix:** Before the loop, collect the unique set of provider names from `chain`, then fetch all their keys in parallel with `Promise.all`. Dedupe provider names (e.g. two Google models → one vault query, not two). Pass prefetched keys into the loop.

---

### 7. Cover the Ollama streaming path (`route.ts`)

**Current:** The Ollama branch in `route.ts` has its own sequential reads: `classifyIntentWithModel` + `getRouterChain` + `getCompiledPrompt` + `getWebConversationMemory` — all sequential.

**Fix:** The classify → router chain steps are inherently sequential (chain depends on category). But `getCompiledPrompt` and `getWebConversationMemory` don't depend on the category and can be fetched in parallel with `getRouterChain` after classification resolves.

---

## What does NOT change

- All admin settings (temperatures, system prompts, router chains, fallback modes) are read from the same DB rows and fully respected.
- Keyword fast-path in the classifier is kept — it avoids a Gemini call for matched messages and runs in-process (no DB query after config is loaded).
- All fallback logic, model chains, provider key rotation — unchanged.
- Response format, logging, analytics — unchanged.
- DB schema — no migrations required.

---

## Expected latency improvement

| Change | Wall-clock savings |
|--------|--------------------|
| Parallelize classifier config (3→1 batch) | ~60–160ms |
| Parallelize temperatures in getRouterChain | ~50ms |
| Remove tag consistency Gemini call | ~300ms (when tag active) |
| Parallelize compaction config + session state | ~50ms |
| Move getFallbackModes to Group 1 | ~50ms |
| Prefetch vault keys before model loop | ~50–150ms |
| Parallelize compiled prompt + memory in Ollama path | ~50ms |
| **Total (typical request)** | **~300–600ms** |
| **Total (tag-active request)** | **~600–900ms** |
