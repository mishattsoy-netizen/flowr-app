# Request History Report: Hide HeaderBar When Settings Page is Open

### 0. Date and time
Date: June 1, 2026  
Time: 03:16 AM

### 1. User request
User request: "i didnt mean section in settings page!! but the header itself, hide it when settings page opened"

### 2. Objective Reconstruction
The previous change wrongly removed the Tabs Header section from the SettingsPage content. The actual request was to hide the entire tabs header bar (HeaderBar component) when the settings page is the active view.

### 3. Operational Trace
- Reverted SettingsPage.tsx: restored Toggle import, isTabsHeaderVisible/toggleTabsHeader from useStore, and the Tabs Header section block
- HeaderBar.tsx: added `if (activeEntityId === 'settings') return null;` right after the existing `isTabsHeaderVisible` guard — one line, clean, uses the existing `activeEntityId === 'settings'` pattern already used in WorkspaceRouter
- TypeScript: zero errors

### 4. Status Assessment
- ✅ Tabs Header section restored in Settings → Interface page
- ✅ HeaderBar now hidden when settings page is open (activeEntityId === 'settings')
