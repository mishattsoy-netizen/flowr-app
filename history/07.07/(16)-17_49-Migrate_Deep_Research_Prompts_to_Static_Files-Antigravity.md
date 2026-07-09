# History Report

## 0. Date and Time
Date: 2026-07-07  
Time: 17:49

## 1. User Request
User request:
```
deep resaerch prompots in prompt folder
```

## 2. Objective Reconstruction
Migrate deep research-specific prompts from the database (`pipeline_internal_prompts` and subchain settings) to static files in the `src/lib/bot/prompts/chains/` directory.

## 3. Strategic Reasoning
Deep research runs in a multi-round pipeline utilizing:
1. An internal research prompt specifying format and rules.
2. A gap detector prompt identifying follow-up queries.

Moving these to static files ensures that:
- Prompts are fully git-tracked, offline-capable, and easily editable without manual database synchronization.
- Removed hardcoded year variables (like 2026) from the examples within the gap detector prompt to preserve future-proofing.

## 4. Detailed Blueprint
### New files created:
- **`src/lib/bot/prompts/chains/research.txt`**: The research pipeline mode formatting rules (previously loaded via `getInternalPrompt('RESEARCH')`).
- **`src/lib/bot/prompts/chains/deep_research_gap_detector.txt`**: The gap detector prompt (previously loaded via `getSubchainConfig('deep_research_gap_detector')`).

### Modified code:
- **`src/lib/bot/providers/deepResearch.ts`**:
  - Imported `getChainPrompt` from `../prompts`.
  - Replaced inline database/config lookups for `deep_research_gap_detector` and `RESEARCH` with direct calls to `getChainPrompt()`.
  - Cleaned up unused inline imports for `getSubchainConfig` and `getInternalPrompt`.

## 5. Operational Trace
1. Read existing prompts from `Final prompts(active1)/chains/RESEARCH/pipeline.txt` and `Final prompts(active1)/subchains/deep_research_gap_detector.txt`.
2. Created the corresponding static prompt files in `src/lib/bot/prompts/chains/`.
3. Updated `deepResearch.ts` to consume them statically.
4. Cleaned up unused dynamic imports.
5. Ran compilation check (`tsc`) to ensure no errors were introduced.

## 6. Status Assessment
- **Complete**: All deep research prompts are statically loaded.
- **Complete**: Gap detector examples are future-proofed (universal context, no hardcoded years).
