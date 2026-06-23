User request: "fix folder pages ui, it doesnt alighnt with app ui"

### 0. Date and time of the request
2026-05-26 00:33:06 (Local time)

### 1. User request
"fix folder pages ui, it doesnt alighnt with app ui"

### 2. Objective Reconstruction
The user requested aligning the Folder View page's styling with the rest of the application's clean, modern Bento UI. The existing Folder View had mismatched layouts:
- It used small `8px` rounded corners and a dark `bg-sidebar` background for list sections.
- It suffered from "double-boxing" in the Files list, adding a nested boxed container with borders inside another card.
- It used incorrect hover background styles and invalid colors, making it stand out as unpolished compared to the homepage's high-aesthetic dashboard and card layouts.

### 3. Strategic Reasoning
1. **Unify Panel Aesthetics**: Changed the outer sections of both "Folders" and "Files" lists to use the standard dashboard panel card styles: `bg-panel` background, `rounded-[var(--radius-big)]` (24px) corners, and a thin, elegant `border border-[var(--bone-6)]`.
2. **Remove Double-Boxing**: Completely removed the nested inner list wrapper box inside the Files section, rendering the file rows directly on the card background separated by a clean layout gap.
3. **Elevate Folder Cards**: Redesigned the folder cards inside the grid to look like solid, well-integrated bento slots: styled with `bg-[var(--app-background)]`, `border-[var(--bone-6)]`, and standard hover properties (`hover:bg-[var(--app-dark)] hover:border-[var(--bone-12)]`).
4. **Standardize Action Widgets**: Upgraded the folder-specific Search box, Sort select dropdown, and New Item buttons in the header to use standard `bg-[var(--bone-5)]` backgrounds, thin `border-[var(--bone-6)]` lines, and proper padding to match the homepage's inputs.
5. **Align Rows**: Standardized the file rows to use the clean `hover:bg-[var(--app-dark)]` and `rounded-[var(--radius-small)]` settings found on all lists inside the workspace.

### 4. Detailed Blueprint
- **File modified**: [FolderView.tsx](file:///Users/mktsoy/Dev/flowr-4-main/src/components/folder/FolderView.tsx)
- **Modifications**:
  - Unify the layout to use standard `bg-panel border border-[var(--bone-6)] rounded-[var(--radius-big)]` sections.
  - Simplify header controls (search and sort) to match global input states.
  - Redesign folder grid card borders and hover reactions.
  - Re-structure files list rows and remove double-boxing wrapper.

### 5. Operational Trace
- Replaced the JSX tree in `FolderView.tsx` from lines 114 to 366 using `replace_file_content` to apply the redesigned Bento card grid and row elements.
- Verified that all styling now aligns beautifully with the dark/light bone variables.

### 6. Status Assessment
- **Status**: Completed.
- **Fixed**: The Folder View matches the premium design standard of the home dashboard cards and sidebar controls flawlessly.
