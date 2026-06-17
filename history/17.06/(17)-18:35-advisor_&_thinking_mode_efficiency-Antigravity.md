User request: "A" (Continuation of: "analyze this plan if its valid execute, if can be refined vrief with me")

0. Date and time of the request:
2026-06-17 18:35

1. User request:
"A"

2. Objective Reconstruction:
Implement the "ADVISOR & Thinking Mode — Efficiency & Stability Plan" to improve ADVISOR state parsing, enforce round ceilings, fix think-chain direction fallbacks, select Option A for think-chain correction flow, and plumb configurations (temperature and thinking budgets) to Gemini and OpenRouter providers.

3. Strategic Reasoning:
- Parse hardening: Fragile tags caused JSON parse errors when markdown JSON wrappers or trailing conversational prose leaked. Scanning for any JSON `{...}` containing `"phase"` resolves this.
- Round limits: Cap the ADVISOR conversation to 6 rounds to prevent loop traps and token exhaustion.
- Option A: Eliminates the think-chain correction pass to reduce latency and save tokens, as classification is already accurately handled upfront.
- Configuration plumbing: Exposing temperature and thinking budget inputs to providers enables precise model controls per intent category.

4. Detailed Blueprint:
- src/lib/bot/advisor.ts: Update regex, add fallback parser, cap rounds to 6.
- src/lib/bot/thinkChain.ts: Return empty string on direction fallback; remove correctionChain handling.
- src/lib/router-config.ts: Query and cache `router_thinking_budgets` setting.
- src/lib/bot/chainRouter.ts: Extract thinking budget and pass to routeContext.
- src/lib/bot/reasoning.ts: Create budget translators for Gemini/OpenRouter.
- src/lib/bot/providers/google.ts: Inject thinkingConfig.
- src/lib/bot/providers/openrouter.ts: Inject temperature and reasoning fields.

5. Operational Trace:
- Updated parseAdvisorResponse to strip markdown wrappers and support fallback JSON search.
- Added round capping checks inside parseAdvisorResponse and defined MAX_ROUNDS = 6.
- Modified thinkChain.ts parseThinkOutput and runThinkChain to simplify output parsing and discard correction pass.
- Plumbed settings query for router_thinking_budgets in router-config.ts.
- Destructured thinking_budget and passed it to routeContext in chainRouter.ts.
- Created src/lib/bot/reasoning.ts with toGeminiThinkingBudget and toOpenRouterReasoning helpers.
- Injected budget configurations into google.ts and openrouter.ts.
- Executed typescript verification command `node node_modules/typescript/bin/tsc --noEmit` which compiled cleanly with 0 errors.

6. Status Assessment:
- All items in the stability and efficiency plan have been implemented and verified.
- The codebase is fully type-safe and consistent.
- Next step: Verify operation end-to-end using the dev server.
