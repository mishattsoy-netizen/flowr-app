User request: "Encountered two children with the same key... duplicate key value violates unique constraint 'models_pkey'"

### Objective Reconstruction
The goal was to resolve a critical crash in the Admin UI and a database error occurring during model registration. Specifically, SiliconFlow was returning duplicate model IDs in its discovery list, causing React key collisions on the frontend and "unique constraint violation" errors when attempting to batch-add these models to the registry.

### Strategic Reasoning
The errors indicated a lack of deduplication at both the discovery and persistence layers. 
- **Discovery Deduplication**: Providers (SiliconFlow in particular) may list the same model ID multiple times if it's available through different sub-endpoints. We must deduplicate by ID before presenting these to the user.
- **Data Integrity**: Subtle differences like trailing spaces can cause strings to be distinct in the database but identical in UI keys. 
- **Defense in Depth**: Added deduplication at the source (fetcher), the registry (server action), and the ingestion point (add action).

### Detailed Blueprint
1.  **Deduplicate SiliconFlow**: Updated `fetchSiliconFlow` to filter out duplicate IDs using a `Set`.
2.  **Global Deduplication**: Wrapped `fetchProviderModels` in a secondary deduplication loop as a fallback for all providers.
3.  **Trim and Guard**: Updated `addModel` to `trim()` IDs to prevent whitespace-based duplication.
4.  **UI Safety**: Updated `getModels` to deduplicate results before passing them to the `ModelsTable` component, preventing React crashes even if the DB contains near-duplicates.

### Operational Trace
-   **Modified**: `src/app/admin/discover/actions.ts` - Added two layers of model deduplication.
-   **Modified**: `src/app/admin/models/actions.ts` - Added `trim()` to model insertion and defensive deduplication to model fetching.

### Status Assessment
-   **Fixed**: React "duplicate key" error in `ModelsTable` and `ResultsTable`.
-   **Fixed**: Database "unique constraint" violation during "Add All" operations.
-   **Verified**: Logic ensures that even if a provider returns duplicates, only one instance is processed and stored.

### Next Recommendation
The user can now safely use the "Add All" feature on the SiliconFlow discovery page without triggering crashes or database errors.
