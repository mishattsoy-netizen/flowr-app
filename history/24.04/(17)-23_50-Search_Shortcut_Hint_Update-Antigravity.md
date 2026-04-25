User request: "change searchbar to actual shortcut"

### Objective Reconstruction
The objective was to update the visual shortcut hint in the sidebar search bar to accurately reflect the implemented keyboard shortcut (`Shift+Z`).

### Strategic Reasoning
The code in `Shell.tsx` implements the search palette trigger using `e.shiftKey && e.key === 'z'`. However, the UI hint in the sidebar was still showing the default `⌘K`. I updated the label to `⇧Z` to prevent user confusion and maintain UI/UX accuracy.

### Detailed Blueprint
- **Sidebar.tsx**: Locate the `<kbd>` element within the search button and replace the text `⌘K` with `⇧Z`.

### Operational Trace
Modified `src/components/layout/Sidebar.tsx` at line 353.

### Status Assessment
The search bar UI now correctly indicates the active shortcut for opening the command palette.
