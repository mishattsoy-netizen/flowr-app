# History Report: Fix Title Double-Click Scroll Issue

**Date:** 12.05.2026
**Time:** 03:05

User request: "fix when i double click note page title, i scroll down"

### Objective Reconstruction
The user reported that double-clicking the note title (to rename it) was causing the entire editor to scroll to the bottom. This was unintended behavior that interrupted the renaming flow.

### Strategic Reasoning
The root cause was event bubbling. The `NoteEditor` has a global `onDoubleClick` handler on its background container that inserts a new text block at the end of the note and focuses it. Since the title is part of the header area and uses the same background class for styling, double-clicks on the title were bubbling up to the main container and triggering the "add new block" logic, which then focused the bottom of the page.

### Detailed Blueprint
- **Files involved:** `src/components/editor/NoteEditor.tsx`.
- **Target elements:** `h1` (Note Title) and the header widget container.
- **Action:** Prevent event bubbling for double-click events in the header section.

### Operational Trace
1.  **Modified `h1`**: Added `e.stopPropagation()` to the `onDoubleClick` handler of the title heading.
2.  **Hardened Header Container**: Added `onDoubleClick={(e) => e.stopPropagation()}` to the main metadata widget div to ensure that clicks in the "Last Modified" or "Tags" area also don't trigger new blocks.

### Status Assessment
- **Completed**: Double-clicking the title now correctly enters rename mode without any background side effects.
- **Result**: The view remains stable, and the renaming process is no longer interrupted by scrolling.
- **Next Recommendation**: Review other "background" areas in complex layouts (like Canvas or Mixed mode) to ensure similar click-bubbling issues aren't present.
