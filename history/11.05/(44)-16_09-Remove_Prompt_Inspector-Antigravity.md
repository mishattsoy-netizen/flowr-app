User request: "remove prompt inspector completely"

## Date and time of the request
11.05.2026 16:08

## User request
"remove prompt inspector completely"

## Objective Reconstruction
Completely dismantle and remove the "Prompt Inspector" feature, including all UI components, routes, server actions, and internal pipeline instrumentation.

## Strategic Reasoning
The user requested a full removal. This requires not only deleting the UI and routes but also reverting the changes made to core pipeline files (`pipeline.ts`, `thinkChain.ts`) that were added specifically to support the inspector's visibility into intermediate prompt stacks.

## Detailed Blueprint
- **src/components/admin/Sidebar.tsx**: Removed the "Prompt Inspector" link and the `Terminal` icon.
- **src/app/admin/router/actions.ts**: Removed the `runDiagnosticAction` server action.
- **src/lib/bot/pipeline.ts**: Reverted `PipelineStep` interface and `executePipeline` logic (removed `inputPrompt`).
- **src/lib/bot/thinkChain.ts**: Reverted `runThinkChain` logic (removed `inputPrompt` capture).
- **src/app/admin/router/prompts/**: Deleted the route directory.
- **src/components/admin/PromptInspector.tsx**: Deleted the component file.

## Operational Trace
- Cleaned up the Sidebar navigation.
- Reverted core engine instrumentation to its previous state to ensure no unnecessary data is processed or passed around.
- Deleted all feature-specific files and directories from the filesystem.

## Status Assessment
- [x] Feature removed completely.
- [x] Core pipeline reverted to baseline.
- [x] All server actions and routes purged.
