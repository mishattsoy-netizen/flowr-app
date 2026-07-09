User request: "1. no, tasks must be only from current space 2. yes"

### 0. Date and time of the request
06.07 16:03

### 1. User request
User request: "1. no, tasks must be only from current space 2. yes"

### 2. Objective Reconstruction
Isolate the Recents section in the Home Dashboard, the Kanban Task Tracker, and the AI Chat histories specifically to the currently active Space, avoiding global sharing of data.

### 3. Strategic Reasoning
- The Recents section simply needs a filter to omit any entities that don't belong to the ctiveSpaceId.
- The Tracker had an explicitly decoupled "Tracker Workspace" filter. As requested by the user, this was removed entirely, hardcoding the Tracker to only display tasks for the ctiveSpaceId to enforce strict isolation.
- The AI chat global session ID must be unique per space. Modifying getChatSessionId to append ctiveSpaceId successfully silos the history.

### 4. Detailed Blueprint
- src/components/dashboard/Dashboard.tsx: Add ctiveSpaceId dependency and filter ecentEntities.
- src/components/workspace/widgets/RecentWidget.tsx: Filter by ctiveSpaceId with TS fixes.
- src/components/tracker/TrackerPage.tsx: Replace 	rackerFilterWorkspace with ctiveSpaceId, restrict the scope, and remove the explicit space-filter logic.
- src/components/layout/Sidebar.tsx: Remove references to 	rackerFilterWorkspace and setTrackerFilterWorkspace. Use ctiveSpaceId for tracker tree highlighting.
- src/data/store.types.ts: Remove 	rackerFilterWorkspace from state types.
- src/data/store.ts: Remove 	rackerFilterWorkspace from state. Update getChatSessionId to accept ctiveSpaceId and return isolated session keys. Update all calls to pass the space ID.

### 5. Operational Trace
- Wrote an implementation plan to clarify the scope of isolation for Tracker and Chat.
- Created 	ask.md checklist upon approval.
- Modified Dashboard.tsx to filter recent entities strictly by ctiveSpaceId.
- Modified RecentWidget.tsx to use the same filtering.
- Replaced all usages of 	rackerFilterWorkspace with ctiveSpaceId in TrackerPage.tsx and removed the explicit drop-down/all-spaces logic.
- Removed 	rackerFilterWorkspace from Zustand store (store.ts, store.types.ts).
- Removed 	rackerFilterWorkspace references in Sidebar.tsx, resolving a build error by fixing duplicate variables.
- Updated getChatSessionId via a Node.js script and multi-replace to accept ctiveSpaceId as a parameter and append it to the session fallback, properly siloing the chat per space.
- Fixed an implicitly ny typed variable error in handlers.ts during build.
- Ran successful 
pm run build verification.

### 6. Status Assessment
Completed. Spaces are now strictly isolated for recents, tasks, and chats.
