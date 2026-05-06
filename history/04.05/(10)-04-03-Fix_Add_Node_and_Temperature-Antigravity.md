User request: "i cant add node and i dont see temperature"

### Objective Reconstruction
The user identified two issues with the newly restyled Roadmap Router Settings modal:
1. They were unable to add a new model node (the "Add node" button did nothing).
2. The "Temperature" control was missing from the new UI.

### Strategic Reasoning
1. **Fixing the "Add Node" bug:** 
   - The bug was caused by a strict safeguard: `if (!firstModel) return`. If `availableModels` took a moment to load from the API, or if the array was empty, clicking "Add node" did nothing.
   - **Fix:** Provided a fallback default model (`{ id: 'gemma-3-2b-it', provider: 'google', max_rpd: null }`) so adding a node never silently fails, even before the model list fully populates.
2. **Re-introducing Temperature:**
   - The previous iteration removed temperature because it was believed to be part of the "preset" functionality the user wanted stripped out. Since the user wants it back, it needed to be integrated properly.
   - **Database update:** The `roadmap_router_chains` table did not have a `temperature` column. I modified the active migration file `20260504_roadmap_tables.sql` to add `temperature NUMERIC DEFAULT 0.7`.
   - **API update:** Updated `PATCH /api/admin/roadmap/router` to read and write the `temperature` property.
   - **UI update:** Added the temperature input field back to the header of each card in `RouterSettings.tsx` and wired it up to `updateTemperature()` state logic.

### Detailed Blueprint
- `src/components/admin/roadmap/RouterSettings.tsx`:
  - Modify `addModel` to use a fallback object.
  - Implement `updateTemperature` logic in the local state.
  - Render the temperature input box in the card header.
- `src/app/api/admin/roadmap/router/route.ts`:
  - Update `PATCH` handler to save the temperature payload.
- `supabase/migrations/20260504_roadmap_tables.sql`:
  - Inject `temperature NUMERIC DEFAULT 0.7` into the `roadmap_router_chains` schema.

### Operational Trace
- Replaced the strict `addModel` return clause with a safe fallback mechanism.
- Added `temperature?: number` to `RoadmapRouterChain` type in `RoadmapClient.tsx`.
- Updated the SQL schema to include the missing column.
- Added temperature controls back to the cloned glassmorphic UI.

### Status Assessment
The router matrix is fully functional again. Nodes can be added reliably, and temperature controls have been restored identically to the main Router Orchestration page. **Note:** The user will need to apply the database migration changes for the new `temperature` column to persist.
