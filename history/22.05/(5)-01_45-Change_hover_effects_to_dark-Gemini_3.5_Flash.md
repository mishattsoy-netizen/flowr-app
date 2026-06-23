# History Report — Change Hover Effects to Dark

## 0. Date and Time of the Request
- Date: 22.05.2026
- Time: 01:45

## 1. User Request
User request: "also hcange hover effects to use dark not bone. like list items in sidebar or nav buttons"

## 2. Objective Reconstruction
Modify all primary hover background states across the navigation controls and sidebar items (e.g. sidebar navigation items, utility buttons, fold/unfold tree chevrons, close tab icon buttons, and popup menu options) to use the dark theme variable (`var(--app-dark)`) instead of the lighter bone-colored overlays (`var(--bone-10)` or `var(--bone-6)`).

## 3. Strategic Reasoning
- **Consistency**: Transitioning hover visual styling from the pale gray `var(--bone-10)` and `var(--bone-6)` shades to the premium monochromatic `var(--app-dark)` creates a much cleaner, cohesive look matching active navigation items.
- **Contrast**: Hovering over controls now shows a subtle dark background in both light and dark modes since `--app-dark` dynamically resolves to `#EFEEEB` in light mode (sleek gray overlay) and `#121212` in dark mode (deep elegant selection overlay).
- **Execution Precision**: Surgical replacement of the bone hover classes in key UI components (`Sidebar.tsx`, `TreeItem.tsx`, `HeaderBar.tsx`, `ContextMenu.tsx`) and CSS utility classes (`btn-sidebar-utility` and `popup-item`) achieves uniform behavior without disturbing active selectors or other block components.

## 4. Detailed Blueprint
Modify variables and tailwind classes in the following files:
- **[globals.css](file:///Users/mktsoy/Dev/flowr-4-main/src/app/globals.css)**: Replace `hover:bg-[var(--bone-10)]` with `hover:bg-[var(--app-dark)]` in `@utility btn-sidebar-utility`, and replace `hover:bg-[var(--bone-6)]` with `hover:bg-[var(--app-dark)]` in `@utility popup-item`.
- **[Sidebar.tsx](file:///Users/mktsoy/Dev/flowr-4-main/src/components/layout/Sidebar.tsx)**: Replace `hover:bg-[var(--bone-10)]` with `hover:bg-[var(--app-dark)]` for both the sidebar panel collapse button (line 494), active navigation item hovers (line 431), and the top search button (line 505).
- **[TreeItem.tsx](file:///Users/mktsoy/Dev/flowr-4-main/src/components/layout/TreeItem.tsx)**: Replace `hover:bg-[var(--bone-10)]` with `hover:bg-[var(--app-dark)]` for the interactive fold/unfold chevron overlay container (line 206).
- **[HeaderBar.tsx](file:///Users/mktsoy/Dev/flowr-4-main/src/components/layout/HeaderBar.tsx)**: Replace `hover:bg-[var(--bone-10)]` with `hover:bg-[var(--app-dark)]` in the close tab button selector (line 271).
- **[ContextMenu.tsx](file:///Users/mktsoy/Dev/flowr-4-main/src/components/layout/ContextMenu.tsx)**: Change the background of open submenus when `isOpen` is active from `bg-[var(--bone-10)]` to `bg-[var(--app-dark)]` (line 95).

## 5. Operational Trace
- **Step 1**: Updated active tab, search, and collapse toggle hover tailwind utilities in `src/components/layout/Sidebar.tsx` to `hover:bg-[var(--app-dark)]`.
- **Step 2**: Replaced tree item expand/collapse chevron container hover states in `src/components/layout/TreeItem.tsx` with `hover:bg-[var(--app-dark)]`.
- **Step 3**: Modified tab close button container hovers in `src/components/layout/HeaderBar.tsx` to use `hover:bg-[var(--app-dark)]`.
- **Step 4**: Adjusted open submenu items background highlight state in `src/components/layout/ContextMenu.tsx` from `bg-[var(--bone-10)]` to `bg-[var(--app-dark)]`.
- **Step 5**: Refactored CSS utility classes `@utility btn-sidebar-utility` and `@utility popup-item` in `src/app/globals.css` to use `hover:bg-[var(--app-dark)]` instead of the bone equivalents.
- **Step 6**: Ran unit tests (`npm run test`) to ensure build pipeline integrity.

## 6. Status Assessment
- **Completed**: Fully replaced all specified navigation, list item, chevron, and popup menu hover indicators to use `var(--app-dark)`.
- **Validation**: Visual transitions remain instant/smooth, matching clean modern aesthetic guidelines without any regression.
