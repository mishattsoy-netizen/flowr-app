User request: "diagnostic manually, message must be treated like message sent to chat and i should see step by step chain, not just preview, but what was actually used, and in the end final answer"

## Date and time of the request
11.05.2026 15:08

## User request
"diagnostic manually, message must be treated like message sent to chat and i should see step by step chain, not just preview, but what was actually used, and in the end final answer"

## Objective Reconstruction
Implement live diagnostic execution in the Prompt Inspector by connecting the UI to the actual server-side AI pipeline, capturing intermediate state (prompts and outputs) for every step.

## Strategic Reasoning
- **Fidelity**: The previous implementation was a visual mock. To provide real value, the tool must use the `runChain` function directly to ensure the diagnostic perfectly matches production behavior.
- **Observability**: Added `inputPrompt` to the internal `PipelineStep` type to allow the server to "report back" the final assembled prompt stack used for each sub-step in the pipeline.

## Detailed Blueprint
- **lib/bot/pipeline.ts**: 
    - Extended `PipelineStep` interface.
    - Captured `stepPrompt` during `executePipeline`.
- **lib/bot/thinkChain.ts**:
    - Captured `thinkPrompt` in the thinking steps.
- **app/admin/router/actions.ts**:
    - Created `runDiagnosticAction` server action.
- **PromptInspector.tsx**:
    - Integrated the new server action.
    - Created a dynamic `renderedStages` list that maps server results into the vertical chain UI.

## Operational Trace
- Instrumented the backend pipeline logic to be "traceable".
- Created a secure server action for admin diagnostics.
- Refactored the UI to handle dynamic step lists (e.g., multi-step research chains).

## Status Assessment
- [x] Real pipeline execution connected.
- [x] Step-by-step intermediate output capture.
- [x] Actual injected prompt visibility per step.
- [x] Final answer parity with chat.
