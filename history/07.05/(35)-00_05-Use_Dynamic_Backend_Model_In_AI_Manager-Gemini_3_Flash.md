User request: "why is AI Manager not using backend model?"

### 1. Objective Reconstruction
The objective was to resolve an issue where the Brain AI Manager component inside Flowr AI was failing because it was hardcoded to use `gemini-2.5-flash` instead of dynamically utilizing the user-configured "Backend Model" (e.g. `gemini-3-flash-preview`).

### 2. Strategic Reasoning
- **Database Alignment**: Investigated the AI Manager's POST route (`src/app/api/ai/brain/manage/route.ts`) and found that `gemini-2.5-flash` was hardcoded as the model parameter for calling the Google Generative AI API.
- **Dynamic Retrieval**: Reconfigured the route to fetch the active `backend_model` setting from the `bot_compiled_prompt` database table (exactly like the analysis stream route does), falling back to `gemini-2.0-flash` only if no record exists. This ensures the AI Manager respects whichever backend model has been selected in the admin dashboard (e.g., `gemini-3-flash-preview`).

### 3. Detailed Blueprint
- **`src/app/api/ai/brain/manage/route.ts`**:
  - Imported `supabase` and fetched `backend_model` from table `bot_compiled_prompt` where `id = 1`.
  - Replaced the hardcoded `'gemini-2.5-flash'` with the dynamically fetched `backendModel`.

### 4. Operational Trace
- Modified `src/app/api/ai/brain/manage/route.ts` using `replace_file_content`.
- Verified successful compilation.

### 5. Status Assessment
- **Completed**: The Brain AI Manager now dynamically fetches and executes using the user's active backend model (`gemini-3-flash-preview`), resolving the hardcoded fallback error.
