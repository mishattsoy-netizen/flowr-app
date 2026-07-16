User request: "Implement Tasks 6-7 of the 'Brain P2a' plan"

2. Objective Reconstruction
Implement the front-end UI for the Brain P2a feature: the pill in the chat message bar for switching brains mid-session, and the dropdown in the Brain panel for managing brains, including creating and deleting them. Finally, verify the build and update the spec.

3. Strategic Reasoning
Followed the exact instructions in the handoff document. Used Zustand for state management. Added a system-style message rendering for the chat timeline to notify the user of a brain switch.

4. Detailed Blueprint
- src/data/store.ts & store.types.ts: Added activeBrainId and setActiveBrainId. (Done in earlier session for Task 6 step 1)
- src/app/api/ai/chat/route.ts: Plumbed activeBrainId through.
- src/components/assistant/AIAssistant.tsx: Added the pill UI and brain state fetch.
- src/components/assistant/components/ChatMessage.tsx: Added early return for system role to display the divider.
- src/components/brain/BrainPanel.tsx: Added dropdown, create, and delete controls.
- docs/superpowers/specs/2026-07-16-brain-presets-design.md and 2026-07-11-bot-rework-design.md: Updated status.

5. Operational Trace
- Replaced activeChatId destructuring in route.ts.
- Injected pill UI, hooks, state, and effect handlers in AIAssistant.tsx.
- Injected system check in ChatMessage.tsx.
- Ran npx tsc --noEmit and committed Task 6.
- Updated BrainPanel.tsx with dropdown and CRUD mutation triggers.
- Ran npx tsc --noEmit and npx vitest run (479 passed) and committed Task 7.
- Updated spec files and committed Task 8 (Steps 1 & 3).

6. Status Assessment
Code is fully complete and passes all automated tests.
REMAINING for owner (Task 8, Step 2 Live Verification):
1. Two-brain isolation live
2. Last-brain-delete guard
3. Pill swap correctness
4. Cache behavior around a swap
5. manage_brain targets active brain correctly
