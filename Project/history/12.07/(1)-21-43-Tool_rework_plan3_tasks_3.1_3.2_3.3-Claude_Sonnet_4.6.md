User request: "Execute with subagents, after each task verify and stop before 3.4"

## 0. Date and Time
Date: 12.07.2026 — Completed at ~21:43 local time

## 1. User Request
Execute tasks 3.1, 3.2, and 3.3 from `docs/plans/2026-07-12-plan3-tool-rework.md`, verify after each, stop before 3.4.

## 2. Objective Reconstruction
Three self-contained tool-reliability improvements to Flowr's AI router, implemented in sequence with verification after each:
- 3.1 — Task creation dedup guard (30s window, same as entities)
- 3.2 — dueAfter/dueBefore date range filters for list_content taskFilters
- 3.3 — Centralized tier-aware MAX_TOOL_HOPS (Smart=8, Light=4)

## 3. Strategic Reasoning
Each task was implemented exactly as specified. For 3.3, the `tier` variable was inside an IIFE scope in chainRouter.ts, so a `primaryTier` variable was hoisted to the outer function scope and assigned inside the IIFE — cleanest fix without restructuring the surrounding code. All changes are additive, preserving backward compatibility for non-PRIMARY paths (still 4 hops).

## 4. Detailed Blueprint

### Task 3.1
- handlers.ts: dedup query on tasks table before INSERT in type==='task' branch
- Matches title + owner_id + entity_id + created within 30s
- Returns {success, id, type, title, deduplicated: true} if duplicate

### Task 3.2  
- definitions.ts: added dueAfter, dueBefore to taskFilters schema
- handlers.ts: added .gte/.lte calls after existing dueDate block
- tools.txt: added rule 4 (date ranges), renumbered rest (4-13 ? 5-14)

### Task 3.3
- NEW: src/lib/bot/toolLoopConfig.ts (MAX_TOOL_HOPS_SMART=8, LIGHT=4, resolveMaxToolHops)
- chainRouter.ts: hoisted primaryTier, added toolTier to routeContext
- openrouter.ts, groq.ts, nvidia.ts, google.ts: added import, replaced const MAX_TOOL_HOPS = 4

## 5. Operational Trace

Task 3.1: edited handlers.ts (18 lines added), tsc clean, 330/330 tests pass, committed: fix(tools): dedupe task creation within 30s window

Task 3.2: edited definitions.ts + handlers.ts + tools.txt, tsc clean, 330/330 tests pass, committed: feat(tools): dueAfter/dueBefore range filters on list_content

Task 3.3: created toolLoopConfig.ts, edited chainRouter.ts + 4 providers, tsc clean, 330/330 tests pass, committed: feat(tools): tier-aware MAX_TOOL_HOPS (smart=8, light=4)

STOPPED before Task 3.4 as instructed.

## 6. Status Assessment
- Task 3.1: DONE, committed
- Task 3.2: DONE, committed
- Task 3.3: DONE, committed
- Task 3.4: NOT started (awaiting owner greenlight per plan)
- All 330 tests passing, TypeScript clean after every task
- No pushes or releases performed

Recommendation: Review the 3 commits, confirm behavior, then decide on Task 3.4 (patch mode for update_content).
