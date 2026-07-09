# History Report

## 0. Date and Time of the Request
Date: 2026-07-07  
Time: 17:17

## 1. User Request
User request:
```
remove hardcoded 2026 year for futur proffness. also why did you point to old final prompts folder if our prompts are in this folder?@[c:\Users\misha\Documents\Dev\flowr-app copy\flowr-app copy\src\lib\bot\prompts]
```

## 2. Objective Reconstruction
1. Remove the hardcoded year `"2026"` from the `WEB_SEARCH` system prompt to make it future-proof.
2. Clarify the prompt folder layout: differentiate between `src/lib/bot/prompts` (which holds static, built-in code prompt assets) and `Final prompts(active)` (which stores full-chain prompts synced to the Supabase database router chains).

## 3. Strategic Reasoning
- The hardcoded date `2026` was replaced with a dynamic instruction referencing the year provided in `[CURRENT CONTEXT]` to ensure long-term compatibility.
- Added a query relative freshness threshold (e.g. discard results "2 years ago or older" rather than hardcoding dates).
- Explained the architecture: `src/lib/bot/prompts` contains static identity fragments (`personality`, `restrictions`, etc.) while `Final prompts(active)` holds the active, custom chain prompts mapped to database router settings (like `WEB_SEARCH`).

## 4. Detailed Blueprint
- **[system_prompt.txt](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/Final%20prompts(active)/chains/WEB_SEARCH/system_prompt.txt)**: Rephrase the freshness rule to extract current year from context dynamically instead of referencing 2026 literally.
- **[scratch.ts](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/scratch.ts)**: Sync the updated prompt to Supabase `router_chains` table.

## 5. Operational Trace
- Edited `Final prompts(active)/chains/WEB_SEARCH/system_prompt.txt` to remove `2026` and `2024/2025` references.
- Executed `scratch.ts` to sync the updated prompt to Supabase for the `app` and `telegram` router chain platform configurations.
- Cleared the scratch script content.

## 6. Status Assessment
- **Resolved**: The web search prompt is fully parameterized and future-proof.
- **Resolved**: Verified the exact role of the folders and clarified it to the user.
