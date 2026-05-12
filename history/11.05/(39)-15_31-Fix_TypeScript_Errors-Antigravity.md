User request: "fix current_problems"

## Date and time of the request
11.05.2026 15:29

## User request
"fix current_problems"

## Objective Reconstruction
Resolve a series of TypeScript errors and build-blocking issues across the AI pipeline and Admin Inspector components.

## Strategic Reasoning
- **Type Safety**: The `RoutingTrace` interface was out of sync with the data being injected during model rotation.
- **Initialization Order**: In `pipeline.ts`, the move to capture prompts introduced a race condition where the variable was used before it was defined. Reordering fixed this without changing logic.
- **Null Safety**: The diagnostic tool uses complex nested objects from server actions; added explicit guards to ensure UI stability.

## Detailed Blueprint
- **src/lib/bot/pipeline.ts**: Moved prompt assembly logic above step initialization.
- **src/lib/bot/chainRouter.ts**: Expanded `RoutingTrace` interface.
- **src/lib/bot/advisor.ts**: Updated `runAdvisor` signature.
- **src/components/admin/PromptInspector.tsx**: Added type casting and null guards.
- **src/lib/router-config.ts**: Added missing `logger` import.

## Operational Trace
- Fixed all 20+ reported IDE errors.
- Verified that the diagnostic tool still functions with the new type constraints.

## Status Assessment
- [x] Build errors resolved.
- [x] Prompt Inspector type-safe.
- [x] Advisor history context correctly passed.
