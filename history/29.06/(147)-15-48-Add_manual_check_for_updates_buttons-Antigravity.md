# History Report - Add Manual Check for Updates Buttons

### 0. Date and Time
Date: 29.06.2026
Time: 15:48

### 1. User Request
User request: "in npm run release 1.0.5 lets add check for updates button in this popup also in updates page in settings"

### 2. Objective Reconstruction
- Add "Check for Updates" trigger buttons in two places for desktop users:
  1. The user profile menu popover popup (rendered from `Sidebar.tsx`).
  2. The Updates ("What's New") tab page inside Settings (rendered from `UpdatesSection.tsx`).

### 3. Strategic Reasoning
- Providing explicit "Check for Updates" buttons allows desktop users to manually query GitHub releases for updates without waiting for background schedules to trigger.
- Constraining the buttons to `isDesktop()` ensures they only show on Electron desktop builds, keeping the web/PWA interface clean.

### 4. Detailed Blueprint
- **Files to Modify**:
  - `src/components/layout/Sidebar.tsx` (import `RefreshCw`, render button in profile popover menu).
  - `src/components/settings/UpdatesSection.tsx` (render desktop app update checking banner with status text and button).

### 5. Operational Trace
- Added `RefreshCw` to lucide-react imports in `Sidebar.tsx`.
- Integrated manual `checkForUpdates` trigger in profile popup inside `Sidebar.tsx`.
- Built state-driven `UpdatesSection` component with interactive check button, checking states, and feedback status text.

### 6. Status Assessment
- Features successfully integrated and ready for commit.
