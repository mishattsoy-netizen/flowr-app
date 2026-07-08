# History Report

## 0. Date and Time
Date: 2026-07-07  
Time: 17:54

## 1. User Request
User request:
```
Final prompts(active1)\subchains are these static aswell? Final prompts(active1)\chains\RESEARCH also is reseach had two prompts one long one short, which one is correct one?
```

## 2. Objective Reconstruction
1. Make subchain config prompts (`prompt_expander` and `image_narration`) static and load them from local files instead of querying the database.
2. Differentiate and correctly configure the two different prompts in the `RESEARCH` chain (the long system prompt for final reports, and the short pipeline formatting prompt for rounds).

## 3. Strategic Reasoning
- Subchain prompts are now moved to local text files (`prompt_expander.txt` and `image_narration.txt`) under `src/lib/bot/prompts/chains/`, removing Supabase dependencies for image expansion and narration.
- The two research prompts are now split cleanly:
  - `research.txt` holds the long, main system prompt for the final report generation mode (aligned in `promptBuilder.ts`).
  - `research_pipeline.txt` holds the short formatting instructions used by `deepResearch.ts` when collecting details across search rounds.

## 4. Detailed Blueprint
### New files created:
- `src/lib/bot/prompts/chains/prompt_expander.txt` (static subchain prompt)
- `src/lib/bot/prompts/chains/image_narration.txt` (static subchain prompt)
- `src/lib/bot/prompts/chains/research_pipeline.txt` (renamed short pipeline format)

### Modified files:
- `src/lib/bot/prompts/chains/research.txt` (overwritten with the long system prompt)
- `src/lib/bot/providers/deepResearch.ts` (uses `research_pipeline` instead of `research`)
- `src/lib/bot/prompt-expansion.ts` (loads statically via `getChainPrompt('prompt_expander')`)
- `src/lib/bot/image-narration.ts` (loads statically via `getChainPrompt('image_narration')`)
- `src/lib/bot/services/promptBuilder.ts` (maps `RESEARCH` category to the `research` prompt)

## 5. Operational Trace
- Wrote subchain prompt files to `src/lib/bot/prompts/chains/`.
- Updated `prompt-expansion.ts` and `image-narration.ts` to fetch statically and removed `getSubchainConfig` usage.
- Overwrote `research.txt` with the long system prompt and created `research_pipeline.txt` with the short one.
- Updated `deepResearch.ts` and `promptBuilder.ts` to map to their respective research prompts.

## 6. Status Assessment
- **Complete**: All subchain prompts are now fully static.
- **Complete**: Research prompts are correctly split and mapped.
