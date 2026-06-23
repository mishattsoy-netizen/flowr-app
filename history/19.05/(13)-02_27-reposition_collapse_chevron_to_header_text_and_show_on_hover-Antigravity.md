User request: "change collapse button position to this, next to the header text, and it shoud apear only on hover"

## 0. Date and time of the request
Date: 19.05 (May 19, 2026)
Time: 02:27

## 1. User request
"change collapse button position to this, next to the header text, and it shoud apear only on hover"

## 2. Objective Reconstruction
Reposition the collapse chevrons (`ChevronDown`) for the sidebar's category sections (Pinned, Unsorted, Workspaces):
- Move them from their previous absolute right-aligned container next to the utility buttons (`MoreHorizontal` and `Plus`).
- Place them immediately to the right of the header label text (e.g., `Pinned v`, `Unsorted v`, `Workspaces v`).
- Style them to be hidden by default (`opacity-0`) and transition to fully visible (`opacity-100`) only when the header row is hovered.

## 3. Strategic Reasoning
- **Premium Quiet Mode**: Moving collapse icons next to the text and only showing them on hover reduces visual noise inside the sidebar, creating a cleaner and quieter initial impression.
- **Accurate Group States**: Utilizing Tailwind's parent `group` trigger allows child chevrons and utility buttons to inherit hover states simultaneously, ensuring smooth layout styling without extra Javascript states.

## 4. Detailed Blueprint
- `src/components/layout/Sidebar.tsx`:
  - Locate section headers for `favorites`, `unsorted`, and `workspaces`.
  - Shift `<ChevronDown />` inside the left label container (`<div className="flex items-center">`), wrapping it with a small `gap-1.5` layout.
  - Apply `opacity-0 group-hover:opacity-100 transition-opacity duration-75` to the chevrons.
  - Also ensure other right-side action buttons (`...`, `+`) share this quiet mode styling to keep headers perfectly unified.

## 5. Operational Trace
- Edited `src/components/layout/Sidebar.tsx`:
  - **Pinned (Favorites)**: Moved `ChevronDown` inside `flex items-center gap-1.5` next to Pinned text; added `opacity-0 group-hover:opacity-100` to `ChevronDown` and `btn-sidebar-utility`.
  - **Unsorted**: Moved `ChevronDown` inside `flex items-center gap-1.5` next to Unsorted text; added `opacity-0 group-hover:opacity-100` to `ChevronDown` and `btn-sidebar-utility`.
  - **Workspaces**: Moved `ChevronDown` inside `flex items-center gap-1.5` next to Workspaces text; added `opacity-0 group-hover:opacity-100` to `ChevronDown` and `btn-sidebar-utility`.

## 6. Status Assessment
- **Completed**: The section collapse buttons are now beautifully positioned next to the header labels and reveal themselves elegantly on hover.
