User request: "still shows 7k for some reason"

### 0. Date and time
06.07, 18:26

### 1. User request
User request: "still shows 7k for some reason" — prompt compression didn't reduce token count.

### 2. Objective
Find why the pipeline/output/behavior block was still appearing twice in the assembled system prompt despite compressing the .txt files.

### 3. Root Cause
The `routerOverridePrompt` in `promptBuilder.ts` is populated from `router_chains.system_prompt` in the Supabase DB (via `getRouterChain(category)`). For the REGULAR category, this DB column stored the old verbose pipeline block. This was being appended AFTER the already-compressed regular.txt chain instructions, causing full duplication.

### 4. Fix
In `promptBuilder.ts` line 65: added a guard so that `routerOverridePrompt` is skipped for REGULAR and COMPLEX categories. Those categories get their chain instructions from the .txt files (which are now compressed), so the DB override is stale and no longer needed.

### 5. Files Changed
- src/lib/bot/services/promptBuilder.ts: added FILE_CHAIN_CATEGORIES guard to skip DB system_prompt for REGULAR/COMPLEX

### 6. Result
The old verbose pipeline block will no longer be appended. The prompt should now reflect the compressed .txt files only. Expected token count: ~5,000-5,500.
