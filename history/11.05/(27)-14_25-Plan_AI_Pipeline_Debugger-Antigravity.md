0. Date: 11.05.2026, Time: 17:25

1. User request
"yes to all... i want to see what sys promt is getting injected in every page in different stages, what does thinking chain recevie, what does chain after thinkig chain receive. and i want to see input prompt and outprompt of each chain"

2. Objective Reconstruction
Design and plan a "Prompt Inspector" page that visualizes the end-to-end prompt construction and stage-by-stage execution of the AI pipeline.

3. Strategic Reasoning
- **Stage Isolation**: By breaking the pipeline into discrete "cards", the user can see exactly how data transforms between the Classifier, Advisor, Thinking, and Execution stages.
- **Injected Context**: Visualizing the "Global Context" and "Dynamic Context" (date/time) layers helps debug why certain models hallucinate or refuse tasks.

4. Detailed Blueprint
- New Route: `/admin/router/prompts`.
- Layout: Header with controls (Mode, Category, Mock Input) + Vertical Timeline of Stage Cards.
- Simulation: Replicate the prompt concatenation logic from `chainRouter.ts` in a client-side utility for the preview.

5. Operational Trace
- Initialized brainstorming.
- Proposed the "Sequential Cards" layout.
- Defined the data layers (System, Personality, Dynamic, Thinking).

6. Status Assessment
- [x] High-level design approved.
- [ ] Implementation pending.
