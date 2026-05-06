User request: "you dont understant, in the image classify key is hsown to be GEMINI 1, but openai/gpt-oss-20b model is from groq, so gemini 1 wasnt used to calssify but grog key..."

### 1. Objective Reconstruction
Resolve a UI rendering bug in the Admin Logs trace (`LogsTable.tsx`) where the classification key was displayed as `GEMINI 1` even though the classification was successfully executed using a Groq model (`openai/gpt-oss-20b`) with a Groq API key (`GROQ 1`).

### 2. Strategic Reasoning
- **Root Cause Identified**: 
  - The classification model chain string stored in the database has the format: `openai/gpt-oss-20b|GROQ 1|true → FAST_SIMPLE → ...`.
  - In `LogsTable.tsx`, the parser extracted the first part `rawParts[0]` as the classifier string but **did not split it by the `|` character** to extract the model name, key, and success status (unlike the routing trace parser which correctly handled pipes).
  - Consequently, the raw string `openai/gpt-oss-20b|GROQ 1|true` was passed directly to the naive fallback helper `getProviderFromModelId`. Since it did not match any of the standard brand substrings (e.g., `llama`, `mixtral`, `gemma`), it fell back to `return 'GEMINI'`, resulting in the incorrect rendering of `GEMINI 1` as the key used.
- **Unified Parse Solution**: We aligned the classifier parsing logic with the routing parser by splitting the raw classifier string on the pipe (`|`) character, extracting the real model name (`openai/gpt-oss-20b`), key (`GROQ 1`), and success status (`true`), and updating `getProviderFromModelId` to correctly recognize `groq` and `openai` substrings as `GROQ`.

### 3. Detailed Blueprint
- **`src/app/admin/logs/LogsTable.tsx`**:
  - Enhanced `getProviderFromModelId` to return `'GROQ'` for model IDs containing `'groq'` or `'openai'`.
  - Refactored the `classifyTrace` extraction logic to check for the pipe (`|`) separator in the raw classifier string and correctly split out the model ID, key used, and success state.

### 4. Operational Trace
- Edited `src/app/admin/logs/LogsTable.tsx` using `replace_file_content`.
- Verified successful compilation.

### 5. Status Assessment
- **Completed**: The classification key trace rendering is now fully corrected. The Admin Logs will now accurately show `GROQ 1` instead of falsely defaulting to `GEMINI 1` when a Groq-based model classifies an incoming request.
