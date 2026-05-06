User request: "Unexpected token '<', \"<!DOCTYPE \"... is not valid JSON"

### Objective Reconstruction
The user reported a console `SyntaxError` when parsing JSON. This typically occurs when a `fetch` call expects JSON but receives an HTML error page (like a 404 Not Found) instead, breaking `res.json()`.

### Strategic Reasoning
1. Tracked down all `fetch()` calls in the Roadmap components using `grep_search`.
2. Found that `RouterSettings.tsx` was fetching `/api/admin/models`.
3. Verified that the `api/admin/models` endpoint did not exist, leading to a 404 HTML page which broke `res.json()`. 
4. The fix requires creating the missing API endpoint so the router settings can fetch the `is_enabled` models.
5. Also added `res.ok` conditional checks before parsing `.json()` across `RouterSettings.tsx` and `BotConfigModal.tsx` to prevent hard crashes if endpoints fail or return HTML in the future.

### Detailed Blueprint
- `src/app/api/admin/models/route.ts`: Create a new GET endpoint to query the `models` table and return the data.
- `src/components/admin/roadmap/RouterSettings.tsx`: Safely wrap `res.json()` with `res.ok ? res.json() : []`.
- `src/components/admin/roadmap/BotConfigModal.tsx`: Safely wrap `res.json()` with `res.ok ? res.json() : {}`.

### Operational Trace
- Created `/api/admin/models/route.ts` that fetches active models from Supabase.
- Modified `RouterSettings.tsx` to safely handle arrays from the fetch.
- Modified `BotConfigModal.tsx` to safely handle the config object.

### Status Assessment
The missing endpoint was created, resolving the 404 HTML response issue. Additionally, all `fetch` queries on the roadmap settings now defensively check `res.ok` before parsing JSON, preventing similar crashes.
