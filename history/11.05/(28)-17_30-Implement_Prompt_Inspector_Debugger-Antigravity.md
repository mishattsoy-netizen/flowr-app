0. Date: 11.05.2026, Time: 17:30

1. User request
"no, thikning chain is not shown by default... i want to see every chain input and ouput. i want to see how evey chan think and how it responds/operates by injected data/prompts"

2. Objective Reconstruction
Develop and deploy the "Prompt Inspector" tool to provide end-to-end transparency into prompt construction, dynamic data injection, and stage-by-stage pipeline hand-offs.

3. Strategic Reasoning
- **Educational Debugging**: Visualizing the "Prompt Stack" (Personality -> Dynamic -> System -> User) helps verify that all constraints are being respected.
- **Mock Simulation**: Adding mock input fields allows developers to test how different user messages or thinking results will affect the final output without burning API tokens on real LLM calls.

4. Detailed Blueprint
- **Page**: `src/app/admin/router/prompts/page.tsx` (Route entry).
- **Component**: `src/components/admin/PromptInspector.tsx` (Core UI logic).
- **Action**: `getLayeredPromptPreview` in `actions.ts` (Data fetcher).
- **UI**: Sequential cards for Classifier, Advisor, Thinking, and Execution.

5. Operational Trace
- Created the Prompt Inspector page and component.
- Implemented a "Timeline" view of the pipeline stages.
- Added "Mock Input" and "Mock Thinking" fields for interactive simulation.
- Linked the tool in the Admin Sidebar.

6. Status Assessment
- [x] Full visibility into layered prompt assembly.
- [x] Pipeline stage switching implemented.
- [x] Sidebar navigation updated.
