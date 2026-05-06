User request: "" (no text provided, image of gemini-2.0-flash quota error in AI Manager)

### 1. Objective Reconstruction
The objective was to resolve an issue where the Brain AI Manager and Analysis routes were querying `bot_compiled_prompt` using `id = 1` instead of `mode = 'default'`. This mismatch prevented the database queries from loading the correct user-configured "Backend Model" settings, causing them to fall back to `'gemini-2.0-flash'`, which then hit free tier quota limits.

### 2. Strategic Reasoning
- **Database Schema Analysis**: In Flowr AI's database structure, `bot_compiled_prompt` holds configuration records identified by the `mode` column (such as `'default'`), rather than an arbitrary integer ID. 
- **Query Alignment**: Replaced `.eq('id', 1)` with `.eq('mode', 'default')` in both `src/app/api/ai/brain/manage/route.ts` and `src/app/api/ai/brain/analyze/route.ts`. This ensures both endpoints correctly read and respect the custom backend model (such as `gemini-3-flash-preview` or `gemini-2.5-flash`) that the user configures in the administrative global settings.

### 3. Detailed Blueprint
- **`src/app/api/ai/brain/manage/route.ts`**:
  - Replaced `.eq('id', 1)` with `.eq('mode', 'default')` for `bot_compiled_prompt` database query.
- **`src/app/api/ai/brain/analyze/route.ts`**:
  - Replaced `.eq('id', 1)` with `.eq('mode', 'default')` for `bot_compiled_prompt` database query.

### 4. Operational Trace
- Edited `src/app/api/ai/brain/manage/route.ts` and `src/app/api/ai/brain/analyze/route.ts` using `replace_file_content`.
- Verified successful compilation.

### 5. Status Assessment
- **Completed**: Queries are fully aligned with the Supabase schema, successfully loading the active backend model.
