User request: "wdym it work. it just prote few generical pharagraphs, this i not what i expect from Project Roadmap assistant and analyzer"

### Objective Reconstruction
The user correctly identified that the Planning Assistant was producing generic, text-only paragraphs instead of actionable structured output. It was behaving like a basic chatbot rather than a proper project analyzer and roadmap builder. Two root causes:
1. The AI had ZERO context about the project's current state (phases, tasks, progress).
2. The system prompt instructions were too vague — no clear mandate to generate `[ROADMAP_ACTION]` blocks.

### Strategic Reasoning
1. **Project Context Injection:**
   - The `PlanningAssistant.tsx` component already had access to `phases` and `tasks` props but was NOT sending them to the API.
   - Updated the fetch body to include `phases` and `tasks` in every request.
2. **Rich System Prompt:**
   - Rewrote `src/app/api/admin/roadmap/chat/route.ts` to build a full project state snapshot:
     - All phases with their status and ID
     - All tasks nested under their phases with status, priority, and sub-task progress
     - Overall project completion percentage
   - Added explicit rules mandating `[ROADMAP_ACTION]` block generation with detailed `agent_prompt` fields.
   - Provided exact JSON format examples for both `create_phase` and `create_task` actions.
3. **Action Block Preservation:**
   - Updated `roadmapRouter.ts` cleaning logic to extract `[ROADMAP_ACTION]` blocks BEFORE stripping thought/answer tags, then prepend them back to the clean response.
   - This ensures action blocks survive the cleaning pipeline and render as Apply buttons in the UI.

### Detailed Blueprint
- `src/components/admin/roadmap/PlanningAssistant.tsx`: Added `phases` and `tasks` to fetch body.
- `src/app/api/admin/roadmap/chat/route.ts`: Complete rewrite with project context builder and detailed structured output instructions.
- `src/lib/bot/roadmapRouter.ts`: Updated cleaning logic to preserve `[ROADMAP_ACTION]` blocks.

### Operational Trace
- Frontend now sends full project state with every chat message.
- Backend builds a structured snapshot and injects it into the system prompt.
- Cleaning pipeline safely preserves action blocks while stripping thought tags.

### Status Assessment
The Planning Assistant now has full project awareness and clear instructions to generate structured, actionable output. It will produce `[ROADMAP_ACTION]` blocks with Apply buttons instead of generic paragraphs.
