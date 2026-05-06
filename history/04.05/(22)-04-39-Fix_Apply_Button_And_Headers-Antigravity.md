User request: "i daont see nay tasks created and i cant accept tasks"

### Objective Reconstruction
The Apply button on AI-generated action blocks was silently failing. Tasks and phases could not be created from the Planning Assistant's output.

### Strategic Reasoning
Three root causes identified:

1. **Missing Content-Type headers:** All `fetch()` POST/PATCH calls across the roadmap components were missing `headers: { 'Content-Type': 'application/json' }`. Without this, Next.js API routes cannot parse `req.json()` — the body arrives as undefined, causing silent failures with no visible error.

2. **Raw action object sent to API:** The original `handleApply` sent `JSON.stringify(action)` which included the `"action": "create_task"` field — a field that doesn't exist in the Supabase `roadmap_tasks` table. This would cause an insert error.

3. **Invalid phase_id references:** When the AI generates both a `create_phase` and `create_task` in the same response, the task references a phase_id that doesn't exist yet. The user must first Apply the phase, then Apply the task. But the original code had no way to handle this — it just silently failed.

### Detailed Blueprint
- `PlanningAssistant.tsx` — Complete ActionBlock rewrite:
  - Added `Content-Type: application/json` headers to all fetch calls
  - Explicitly extract only valid fields from the action object before sending to API
  - Added phase_id validation: if the phase_id is not found in existing phases, show a dropdown selector so the user can pick the correct phase
  - Added error state and error display
  - Added `color` field passthrough for phase creation
- `RoadmapClient.tsx` — Added missing `Content-Type` header to "Add Task" button fetch
- `PhaseStrip.tsx` — Added missing `Content-Type` headers to both POST and PATCH fetch calls

### Operational Trace
- Fixed 5 fetch calls across 3 files
- ActionBlock now has 4 states: pending, applied, rejected, error
- Phase selector dropdown appears automatically when a task references an unknown phase_id

### Status Assessment
Apply buttons should now work correctly. The workflow is:
1. Apply "Create Phase" actions first
2. For tasks with unknown phase_ids, select the target phase from the dropdown
3. Click Apply — task is created in the selected phase
