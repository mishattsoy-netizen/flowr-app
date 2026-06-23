User request: "write final plan"

**Date/Time:** 2026-06-17, 00:33

---

## 1. Objective Reconstruction

User requested a final, actionable implementation plan based on the prior analysis of the `AI_AGENT_EVOLUTION.md` spec. The plan needed to be concrete enough to execute — exact files, exact line numbers, exact code changes.

## 2. Strategic Reasoning

Rather than proposing a full rewrite (as the original spec suggests), the plan follows the incremental 4-phase approach from the analysis:
1. Output Guard — zero-risk sanitization layer
2. Tool Injection — decouple tools from classification (biggest behavioral win)
3. Simplified Classifier — collapse categories
4. OpenRouter Tools — fill the last provider gap

Each phase is independently deployable and reversible.

## 3. Detailed Blueprint

Additional research performed before writing:
- Read `thinkChain.ts` (208 lines) — think chain pre-pass architecture
- Read `router-config.ts` (261 lines) — router chain DB system, IntentCategory type, PipelineSettings
- Read `groq.ts` (179 lines) — confirmed tool loop exists (L88-162, MAX_TOOL_HOPS=4)
- Read `nvidia.ts` (184 lines) — confirmed tool loop exists (L88-167, identical pattern)
- Read `openrouter.ts` (247 lines) — confirmed NO tool support (the gap)
- Read `chat/route.ts` (215 lines) — API entry point, streaming SSE architecture
- Searched all `useTools` references — found the single gate at chainRouter.ts L1027
- Searched all `FLOWR_TOOLS` references — found imports in google, groq, nvidia (not openrouter)

## 4. Operational Trace

- Created `implementation_plan.md` artifact with:
  - 3 open questions for user review
  - 2 user-review-required warnings
  - Phase 1: 3 file changes (1 new, 1 modify, 1 new test)
  - Phase 2: 3 file modifications with exact line numbers and diffs
  - Phase 3: 3 file modifications + SQL migration script
  - Phase 4: 1 file modification with detailed implementation spec
  - Verification plan with automated tests + manual verification per phase

## 5. Status Assessment

- **Completed:** Full implementation plan ready for user review
- **Awaiting:** User approval before any code changes begin
- **Key decisions needed:** Tool cost budget, OpenRouter model allowlist, streaming+tools hybrid behavior
