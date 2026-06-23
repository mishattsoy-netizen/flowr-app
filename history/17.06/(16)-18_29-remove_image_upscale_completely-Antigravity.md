User request: "removev image upscale completely from chain and code"

### 0. Date and time of the request
Date: 2026-06-17
Time: 18:29

### 1. User request
"removev image upscale completely from chain and code"

### 2. Objective Reconstruction
The objective of this task was to completely remove the `IMAGE_UPSCALE` category and its underlying logic, imports, caches, and frontend components from the application, ensuring that image generation does not run auto-upscale operations and all routing configurations ignore it.

### 3. Strategic Reasoning
We chose to perform a surgical removal of references to `IMAGE_UPSCALE` to simplify the model chain. Since the HuggingFace stability-based upscaler was prone to 404s/failures and increased latency, the user requested its complete removal. All references in the type declarations (`IntentCategory`), routing checks, local caches, discover action definitions, and front-end dashboard panels have been cleaned up to prevent UI and backend inconsistencies.

### 4. Detailed Blueprint
- `src/lib/bot/chainRouter.ts`: Remove upscale imports (`runHuggingFaceUpscale`, `getImageDimensions`), `runUpscaleChain` invocation in `runChain`, and delete `runUpscaleChain`.
- `src/lib/bot/providers/huggingface.ts`: Remove the unused wrapper `runHuggingFaceUpscale`.
- `src/lib/router-config.ts`: Exclude `IMAGE_UPSCALE` from `IntentCategory` union type and self-healing DB checker.
- Config caches (`pipeline-settings.json`, `router-chains.json`): Strip `IMAGE_UPSCALE` categories.
- Dashboard files: Remove `IMAGE_UPSCALE` category entries in `discover/actions.ts`, `RouterManager.tsx`, `router/page.tsx`, `LogsTable.tsx`, and `CostDashboardClient.tsx`.

### 5. Operational Trace
1. **Core Logic**:
   - Modified `src/lib/bot/chainRouter.ts` to delete the imports and remove the call block to `runUpscaleChain` inside `runChain` as well as deleting the `runUpscaleChain` helper function.
   - Modified `src/lib/bot/providers/huggingface.ts` to remove the `runHuggingFaceUpscale` function.
   - Modified `src/lib/router-config.ts` to remove `IMAGE_UPSCALE` from types and self-healing.
2. **Cache Configurations**:
   - Modified `bot configs(premission to edit needed!)/pipeline-settings.json` to remove `IMAGE_UPSCALE` from category lists.
   - Modified `bot configs(premission to edit needed!)/router-chains.json` to delete the `IMAGE_UPSCALE` chain block.
3. **Frontend Dashboard**:
   - Modified `src/app/admin/discover/actions.ts` to clean up modalities mapping.
   - Modified `src/components/admin/RouterManager.tsx` to remove icons mapping and categories.
   - Modified `src/app/admin/router/page.tsx` to remove adding upscale button.
   - Modified `src/app/admin/logs/LogsTable.tsx` and `src/app/admin/costs/CostDashboardClient.tsx` to remove upscale color mapping.
4. **Verification**:
   - Ran `node node_modules/typescript/bin/tsc --noEmit` directly, and verified it built successfully with no type safety issues.

### 6. Status Assessment
- **Completed**: Fully removed the `IMAGE_UPSCALE` logic, configs, wrappers, and frontend panels.
- **Verification**: TypeScript check is clean.
- **Unresolved/Next Steps**: The database `router_chains` table might still contain historical `IMAGE_UPSCALE` rows, which are now safely ignored by the code. The user may manually delete them if they want to keep the DB perfectly clean.
