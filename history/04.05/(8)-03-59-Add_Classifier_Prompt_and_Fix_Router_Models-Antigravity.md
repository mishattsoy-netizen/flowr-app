User request: "add classifier promt page in settiings and i cant add models in the routers"

### Objective Reconstruction
The user requested two features/fixes for the Roadmap Hub:
1. Add a dedicated settings page/tab for the AI classifier prompt.
2. Fix a bug preventing them from adding models to the router matrix.

### Strategic Reasoning
1. **Adding Models Bug:** The issue in `RouterSettings.tsx` was traced to the `setChains` state update logic. It was using a `.map()` function over the existing chains. If a category (e.g. `FAST`) didn't exist in the database yet (e.g., empty array after migration), the `.map()` simply ignored it. The fix was to check if the category exists; if not, append a new category object to the array.
2. **Classifier Prompt:** The roadmap bot config table only had a `system_prompt` field. To add a classifier prompt:
   - Modified `20260504_roadmap_tables.sql` to include `classifier_prompt TEXT`.
   - Updated the `/api/admin/roadmap/config` route to select and save the new field.
   - Added a new "Classifier Prompt" tab in `BotConfigModal.tsx` matching the glassmorphic aesthetics.
   - Updated `roadmapRouter.ts` to dynamically fetch the classifier prompt from the DB and fall back to the default if empty.

### Detailed Blueprint
- `src/components/admin/roadmap/RouterSettings.tsx`: Update `addModel` logic to append new categories.
- `src/components/admin/roadmap/BotConfigModal.tsx`: Add active tab state for `classifier` and corresponding text area.
- `supabase/migrations/20260504_roadmap_tables.sql`: Append `classifier_prompt` to the schema and seed payload.
- `src/app/api/admin/roadmap/config/route.ts`: Expose and persist the new `classifier_prompt` property.
- `src/lib/bot/roadmapRouter.ts`: Extract and use `classifier_prompt` inside `classifyRoadmapIntent()`.

### Operational Trace
- Edited `RouterSettings.tsx` replacing the strict `.map()` with a robust `.find()` / append logic.
- Expanded `roadmap_bot_config` in the migration file.
- Patched config API to read/write `classifier_prompt`.
- Refactored `BotConfigModal` with a 3-tab layout (`prompt`, `classifier`, `router`).
- Updated `classifyRoadmapIntent` to utilize the new DB-driven prompt rather than a hardcoded string.

### Status Assessment
The models can now be freely added to any router chain, even empty ones. The Classifier Prompt tab is fully functional and hooked up to the router logic. The user must execute the updated `20260504_roadmap_tables.sql` migration (or manually add the `classifier_prompt` column) to enable persistence.
