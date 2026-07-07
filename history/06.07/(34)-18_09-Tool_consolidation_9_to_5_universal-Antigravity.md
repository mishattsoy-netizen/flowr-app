User request: "make sure it is reliable and stable. if one tool isnt reliable you can split to 4 different: create, update, append and move"

### 0. Date and time
06.07, 18:09

### 1. User request
User request: "make sure it is reliable and stable. if one tool isnt reliable you can split to 4 different: create, update, append and move"

### 2. Objective
Consolidate 9 individual AI write tools into 4 focused universal tools + 1 reading tool = 5 tools total.

### 3. Strategic Reasoning
A single mega-tool would be unreliable because the AI could confuse similar actions (e.g. update vs append). Splitting into 4 purpose-specific tools keeps each tool's intent unambiguous while still dramatically reducing total tool count from 9 to 5.

### 4. Blueprint
- create_content: replaces create_note, create_folder, create_workspace, create_task
- update_content: replaces update_note, update_task
- append_to_note: kept separate to prevent accidental overwrites
- move_content: replaces move_entity
- list_content: unchanged (already implemented)

### 5. Operational Trace
- Rewrote definitions.ts completely with 5 clean tool schemas
- Rewrote handlers.ts with a resolveSpaceId() helper to deduplicate space logic
- create_content routes to tasks or entities table based on type
- update_content detects the target table via ID prefix (task- vs doc-/folder-)
- Fixed TypeScript error in all 4 providers: [] -> ([] as string[])
- Updated tools.txt with complete, clean documentation

### 6. Status
Build passed. All 5 tools live. 9 ? 5 tool consolidation complete.
