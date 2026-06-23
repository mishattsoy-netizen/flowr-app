User request: "also change header text and button to bone 30 and change style, only first letter capital"

## 0. Date and time of the request
Date: 19.05 (May 19, 2026)
Time: 02:31

## 1. User request
"also change header text and button to bone 30 and change style, only first letter capital"

## 2. Objective Reconstruction
- Change text capitalization of the sidebar section headers ("Pinned", "Unsorted", "Workspaces") from all-caps (`uppercase`) to standard capitalization (only the first letter capital, e.g. "Pinned", "Unsorted", "Workspaces").
- Update the default/idle text color of the headers, the chevrons, and their utility action buttons (`MoreHorizontal` and `Plus`) from `var(--bone-70)` to `var(--bone-30)`.

## 3. Strategic Reasoning
- **Visual hierarchy**: Transitioning section headers from bold uppercase to standard capitalization reduces the "screaming" visual weight of secondary groupings, blending them cleanly into the aesthetic.
- **Calibrated contrast**: Shifting the idle color of these section headers and utility elements from `bone-70` to `bone-30` ensures they are highly readable yet sit clearly secondary to active items and major navigation options. On hover, they still elevate to fully bright `bone-100` as expected.

## 4. Detailed Blueprint
- `src/components/layout/Sidebar.tsx`:
  - In section headers for Pinned, Unsorted, and Workspaces, delete the `uppercase` utility class from `span` element classnames.
  - Replace `text-[var(--bone-70)]` color overrides with `text-[var(--bone-30)]` (or equivalent class styling) for the header row parent containers, chevrons, and buttons.

## 5. Operational Trace
- Edited `src/components/layout/Sidebar.tsx`:
  - Removed `uppercase` from header span text elements.
  - Changed the default text color class from `text-[var(--bone-70)]` to `text-[var(--bone-30)]` in:
    - Pinned header parent and its utility buttons.
    - Unsorted header parent and its utility buttons.
    - Workspaces header parent and its utility buttons.
  - Set ChevronDown stroke color to `text-[var(--bone-30)]`.

## 6. Status Assessment
- **Completed**: Header capitalization changed to standard title-casing (only first letter capital) and element color transitioned to a premium low-contrast `bone-30` state when idle, elevating on hover.
