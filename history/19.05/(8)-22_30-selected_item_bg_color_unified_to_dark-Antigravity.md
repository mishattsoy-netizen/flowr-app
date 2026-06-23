User request: "change selected item/button bg color to dark"

## 0. Date and time of the request
Date: 19.05 (May 19, 2026)
Time: 22:30

## 1. User request
"change selected item/button bg color to dark"

## 2. Objective Reconstruction
Standardize active and selected backgrounds for toggle buttons, dropdowns, workspace switchers, sidebars, icon pickers, and view/filter tab controls to use `bg-dark` (or equivalent dark background color matching the command palette selected item style) across the entire application interface instead of using the bone overlays (like `bg-[var(--bone-15)]`).

## 3. Strategic Reasoning
- **Aesthetic Consistency**: Aligning all active states with the digital instrument dashboard design.
- **Improved Contrast**: `bg-dark` provides a beautiful premium backdrop, elevating visual hierarchy in a sleek dark mode.
- **Maintainability**: Reusing existing CSS dark backdrop utilities instead of ad-hoc bone-15 values.

## 4. Detailed Blueprint
- `src/app/globals.css`: Update `btn-icon-toggle` active states to `bg-dark`.
- `src/components/layout/WorkspaceSwitcher.tsx`: Update active/open space button backgrounds to `bg-dark`.
- `src/components/workspace/widgets/RecentWidget.tsx`: Update active filter buttons to `bg-dark`.
- `src/components/workspace/widgets/AllFilesWidget.tsx`: Update active flat/tree mode buttons to `bg-dark`.
- `src/components/workspace/widgets/TasksWidget.tsx`: Update active list/status view buttons to `bg-dark`.
- `src/components/workspace/widgets/ClockWidget.tsx`: Update active clock style buttons to `bg-dark`.
- `src/components/workspace/widgets/FoldersWidget.tsx`: Update active folder options button background to `!bg-dark`.
- `src/components/admin/ModelDropdown.tsx`: Update active dropdown selection background to `bg-dark`.
- `src/components/admin/Sidebar.tsx`: Update active navigation links to `!bg-dark`.
- `src/components/chat/ChatHistoryPanel.tsx`: Update active chat items to `bg-dark`.
- `src/components/layout/IconPicker.tsx`: Update active icon button backgrounds to `bg-dark`.

## 5. Operational Trace
- Modified `src/app/globals.css` to update `btn-icon-toggle` active state utility to `@apply bg-dark text-[var(--bone-100)];`.
- Modified `src/components/layout/WorkspaceSwitcher.tsx` to replace `bg-[var(--bone-15)]` with `bg-dark`.
- Modified `src/components/workspace/widgets/RecentWidget.tsx` to replace `bg-[var(--bone-15)]` with `bg-dark` for filter selectors.
- Modified `src/components/workspace/widgets/AllFilesWidget.tsx` to replace `bg-[var(--bone-15)]` with `bg-dark` for flat/tree toggles.
- Modified `src/components/workspace/widgets/TasksWidget.tsx` to replace `bg-[var(--bone-15)]` with `bg-dark` for list/status views.
- Modified `src/components/workspace/widgets/ClockWidget.tsx` to replace `bg-[var(--bone-15)]` with `bg-dark` for clock style tabs.
- Modified `src/components/workspace/widgets/FoldersWidget.tsx` to replace `!bg-[var(--bone-15)]` with `!bg-dark` for active options button.
- Modified `src/components/admin/ModelDropdown.tsx` to replace `bg-[var(--bone-15)]` with `bg-dark` for selected models.
- Modified `src/components/admin/Sidebar.tsx` to replace `!bg-[var(--bone-15)]` with `!bg-dark` for selected navigation items.
- Modified `src/components/chat/ChatHistoryPanel.tsx` to replace `bg-[var(--bone-15)]` with `bg-dark` for active chat sessions.
- Modified `src/components/layout/IconPicker.tsx` to replace `bg-[var(--bone-15)]` with `bg-dark` for current icon badges.

## 6. Status Assessment
- **Completed**: All selected item backgrounds, active navigation lists, toggle buttons, and dropdown selector options across all notes, chat widgets, space switchers, sidebars, icon pickers, and widgets have been fully updated to utilize `bg-dark`.
- **Recommendation**: Run local development server and clear the application cache to view the premium dark accent backgrounds seamlessly.
