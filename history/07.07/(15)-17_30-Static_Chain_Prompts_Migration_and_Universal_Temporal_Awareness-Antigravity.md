# History Report

## 0. Date and Time
Date: 2026-07-07  
Time: 17:30

## 1. User Request
User request: "NO! 1. in prompt, dont focus on models, prompt must be universal for any type of information, not just models ids. 2. i want ALL chain prompt to be hardcoded in static prompts folder. and get rid of db sync prompts."

## 2. Objective Reconstruction
Two corrections to the previous approach:
1. The temporal awareness instruction was too model-specific (mentioned Gemini 1.5, Claude 3, GPT-4o by name). Make it universal for any type of rapidly-changing information.
2. All chain system prompts must live as static `.txt` files in `src/lib/bot/prompts/chains/` — not fetched from the Supabase database. Remove the entire DB-based `system_prompt` pipeline.

## 3. Strategic Reasoning
- Static files are faster (no DB round-trip), version-controllable (git-tracked), and easier to edit.
- DB sync was fragile: forgetting to sync after editing a file meant stale prompts in production.
- Universal temporal awareness works for any domain (not just AI models) — checks relative age against [CURRENT CONTEXT] date.

## 4. Detailed Blueprint
### New static chain files created:
- `web_search.txt` — moved from `Final prompts(active)/chains/WEB_SEARCH/system_prompt.txt`
- `thinking.txt` — moved from hardcoded `DEFAULT_THINK_SYSTEM_PROMPT` constant in thinkChain.ts
- `compaction.txt` — new (was DB-only before)
- `vision.txt` — new (was DB-only before)
- `advisor.txt` — new (was DB-only before)

### Code changes:
- `promptBuilder.ts` — expanded `getChainInstructions()` to map ALL categories to static files; removed `routerOverridePrompt` parameter
- `router-config.ts` — removed `system_prompt` from DB fetch
- `chainRouter.ts` — removed `system_prompt` destructuring; uses `getChainPrompt('vision')` for vision chain
- `thinkChain.ts` — uses `getChainPrompt('thinking')` instead of DB + hardcoded constant
- `compaction.ts` — uses `getChainPrompt('compaction')` instead of DB
- `advisor.ts` — uses `getChainPrompt('advisor')` instead of DB
- `actions.ts` — removed chain system_prompt DB sync section from `syncFinalPrompts()`

## 5. Operational Trace
1. Listed all directories in `Final prompts(active)` — only `WEB_SEARCH` existed
2. Read all consumer files to map the full `system_prompt` flow
3. Created 5 new `.txt` chain files in `src/lib/bot/prompts/chains/`
4. Rewrote `promptBuilder.ts` to serve all categories from static files
5. Removed `system_prompt` from `fetchRouterChainFromDb()` return type and DB select
6. Updated all 5 consumer files (chainRouter, thinkChain, compaction, advisor, actions)
7. Fixed 2 TypeScript errors introduced by the refactor (advisor.ts, chainRouter.ts)
8. Verified: `tsc --noEmit` shows 0 new errors (4 pre-existing unrelated errors remain)

## 6. Status Assessment
- **Complete**: All chain prompts are now static files in `src/lib/bot/prompts/chains/`
- **Complete**: Temporal awareness is universal (no model-name examples)
- **Complete**: DB sync for chain system_prompts is removed
- **Note**: `Final prompts(active)/` folder still exists on disk but is no longer read by the app for chain prompts. The admin `syncFinalPrompts()` still syncs mode parts, classifier, and subchain configs from that folder.
- **Recommendation**: Consider clearing cache and restarting the dev server to pick up the new static prompt files.
