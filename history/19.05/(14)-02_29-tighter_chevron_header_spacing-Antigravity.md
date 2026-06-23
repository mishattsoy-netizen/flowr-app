User request: "closer to text"

## 0. Date and time of the request
Date: 19.05 (May 19, 2026)
Time: 02:29

## 1. User request
"closer to text"

## 2. Objective Reconstruction
Reduce the spacing between the sidebar section headers ("Pinned", "Unsorted", "Workspaces") and their hover collapse chevrons (`ChevronDown`):
- Decrease the layout flex container gap from `gap-1.5` (6px) to a tighter `gap-1` (4px).

## 3. Strategic Reasoning
Adjusting the spacing gap from 6px down to 4px (`gap-1`) places the chevron closer to the text bounds. This matches the target design reference perfectly, ensuring the hover chevron feels physically bound to the header word itself.

## 4. Detailed Blueprint
- `src/components/layout/Sidebar.tsx`: Change `gap-1.5` to `gap-1` in the flex layouts of the three section headers.

## 5. Operational Trace
- Edited `src/components/layout/Sidebar.tsx` to set `gap-1` inside the flex containers enclosing the header labels and `ChevronDown` for Pinned, Unsorted, and Workspaces.

## 6. Status Assessment
- **Completed**: Spacing between header text and collapse chevrons successfully tightened.
