User request: "fix minimized sidebar, layout is inconsistant nad sidebar doesnt have border"

### 0. Date and time of the request
22.05.2026 01:26

### 1. User request
User request: "fix minimized sidebar, layout is inconsistant nad sidebar doesnt have border"

### 2. Objective Reconstruction
Fix visual layout inconsistencies in the minimized (collapsed) state of the sidebar and restore the missing right-side divider border of the sidebar when collapsed.

### 3. Strategic Reasoning
1. **Sidebar Right Border:** The vertical right border was conditionally hidden in `Shell.tsx` when the sidebar was collapsed (`currentSidebarCollapsed` is true). To fix this, we always render the border unless the sidebar is completely hidden (when the tab header is active and the sidebar collapses to 0px width).
2. **Inconsistent Button Sizing:** When collapsed, the Dashboard/Tasks/Chat/Star buttons were styled to have hover and background bounding boxes of `40px` (`w-10 h-10`), whereas the Toggle Sidebar button and footer buttons (Spaces/Theme/Settings) were kept at `22px` (`w-[22px] h-[22px]`). This created an inconsistent vertical stack of elements. We resized these small buttons to standard `w-10 h-10` dimensions with `rounded-[var(--radius-8)]` and matching hover and active behavior when collapsed, maintaining premium layout consistency.
3. **Toggle Sidebar Horizontal Alignment:** The Toggle Sidebar button wrapper had a `mr-[3px]` layout utility that pushed it slightly off-center when collapsed. Removing this margin conditionally centers the button perfectly.
4. **Star Icon Size:** The Star icon in the Pinned button was `w-5 h-5` while the others were `w-4 h-4`. Harmonizing it to `w-4 h-4` keeps all layout weights identical.

### 4. Detailed Blueprint
- `src/components/layout/Shell.tsx`: Modify the right border condition of the sidebar wrapper to stay active in minimized state.
- `src/components/layout/Sidebar.tsx`:
  - Update Toggle Sidebar button styles and align wrapper container centered when collapsed.
  - Harmonize Star button icon to `w-4 h-4` when collapsed.
  - Scale Spaces, Theme, and Settings buttons in the footer to `w-10 h-10` with rounded rounded-[var(--radius-8)] when collapsed.

### 5. Operational Trace
- Modified `src/components/layout/Shell.tsx` to use condition `(!currentSidebarCollapsed || !isTabsHeaderVisible)` for `border-r border-[var(--bone-15)]` class.
- Modified `src/components/layout/Sidebar.tsx` to conditionally apply `w-10 h-10 rounded-[var(--radius-8)]` styles and alignment fixes for Toggle Sidebar, Star, Spaces, Theme, and Settings buttons.

### 6. Status Assessment
- Completed all required layout and alignment fixes for the minimized sidebar state.
- Restored right border of the sidebar when collapsed.
