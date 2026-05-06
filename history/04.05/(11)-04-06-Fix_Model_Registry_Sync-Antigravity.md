User request: "models and providers must be synced with registry"

### Objective Reconstruction
The user reported that the dropdown menu for selecting models in the newly designed Roadmap Router Settings was showing "No models found matching your search." This indicated that the frontend component was failing to sync with the central AI model registry.

### Strategic Reasoning
1. **Diagnosis:** Investigated why `availableModels` was empty. Found that the API endpoint `/api/admin/models` was returning a 500 error because it was attempting to query `.eq('is_enabled', true)` against the `models` table in Supabase.
2. **Root Cause:** The central `models` table does not have an `is_enabled` column. When the query failed, the `fetch` block in `RouterSettings` fell back to an empty array `[]`, leaving the dropdown unpopulated.
3. **Resolution:** Removed the invalid `.eq('is_enabled', true)` filter from the GET route. Also implemented the correct ordering logic (`is_favorite`, `sort_order`, `id`) to ensure models are displayed in the exact same priority order as the main Model Registry.

### Detailed Blueprint
- `src/app/api/admin/models/route.ts`:
  - Remove `.eq('is_enabled', true)` line.
  - Add `.order('is_favorite', { ascending: false })`.
  - Add `.order('sort_order', { ascending: true })`.
  - Add `.order('id', { ascending: true })`.

### Operational Trace
- Replaced the failing database query in the Models API route with a robust query that exactly mirrors `getModels()` from the admin actions module.

### Status Assessment
The model list dropdown in the Roadmap Router now properly pulls live data from the database Model Registry. Models, custom IDs, and providers will now sync seamlessly.
