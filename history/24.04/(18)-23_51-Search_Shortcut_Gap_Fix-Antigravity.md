User request: "increase gap between them"

### Objective Reconstruction
The objective was to improve the legibility of the `⇧Z` shortcut hint in the sidebar search bar by adding visual space between the symbols.

### Strategic Reasoning
The characters `⇧` and `Z` were visually colliding in the previous implementation. I added a space character between them within the `<kbd>` tag to ensure clear separation and better aesthetics.

### Detailed Blueprint
- **Sidebar.tsx**: Locate the `<kbd>` element and change `⇧Z` to `⇧ Z`.

### Operational Trace
Modified `src/components/layout/Sidebar.tsx` at line 353.

### Status Assessment
The shortcut hint now shows a clear gap between the shift symbol and the Z key.
