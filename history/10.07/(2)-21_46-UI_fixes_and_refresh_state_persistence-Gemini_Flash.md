User request: " UI fixes and refresh state persistence\

### 2. Objective Reconstruction
Implemented various UI polish fixes in Split Mode, Sidebar, and Header, fixed white flash during hydration, and persisted active page state so Refresh (Ctrl+Shift+R) maintains the current view.

### 3. Strategic Reasoning
- Unified single column vs split mode tabs (left padding, absolute close button for fade out effect).
- Updated Zustand partialize to include active tab and entity IDs to survive page refresh.
- Group-hover on header wrapper correctly exposes split layout reset buttons.

### 4. Detailed Blueprint
- HeaderBar.tsx: Modified tabs padding, absolute close button, group/header class.
- Sidebar.tsx: Removed width transition, removed !isDesktopEnv Search and Sidebar toggle buttons. Fixed spaces vs storeWorkspaces TS error. Fixed sidebarWidth TS error.
- store.ts: Added openTabIds and activeEntityId to partialize. Added missing isChatHistoryLoading initialization.
- layout.tsx: Explicitly set html background colors during hydration script to avoid white flash.

### 5. Operational Trace
- Updated files using replace_file_content.

### 6. Status Assessment
All UI bugs fixed, reload state persistence achieved, build passes.
