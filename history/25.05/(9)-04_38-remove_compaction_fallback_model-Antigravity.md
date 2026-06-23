User request: "remove fallback!!"

### 0. Date and time of the request
Completed on: 25.05.2026 at 04:38

### 1. User request
"remove fallback!!"

### 2. Objective Reconstruction
Completely remove the hardcoded default backend model fallback (`gemini-2.0-flash`) from `compactSession` in `compaction.ts` so that the compaction loop executes strictly against the database-configured intent model list.

### 3. Strategic Reasoning
Following the user's explicit directive to remove the backend fallback model, we stripped the hardcoded default block in `src/lib/bot/compaction.ts`. Compaction will now strictly attempt to run using the models defined in the database/local cache settings for the `COMPACTION` category.

### 4. Detailed Blueprint
- `src/lib/bot/compaction.ts`:
  - Locate the fallback block targeting the `gemini-2.0-flash` RouterModel override.
  - Delete the block, keeping only the database model loop and the final warning logger.

### 5. Operational Trace
- **Modified `src/lib/bot/compaction.ts`**: Excised the fallback model definitions, system prompt strings, and provider calls.
- **TypeScript Check**: Ran `npx tsc --noEmit` which completed successfully with zero warnings or errors.

### 6. Status Assessment
- **Status**: 100% complete.
- **Unresolved Items**: None.
