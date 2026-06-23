User request: "same with right buttons"

## 0. Date and time of the request
Date: 19.05 (May 19, 2026)
Time: 02:38

## 1. User request
"same with right buttons"

## 2. Objective Reconstruction
Adjust the right margins of the right-aligned options (`...`) and add (`+`) buttons in both standard tree items (workspaces, collections, folders) and section headers (Pinned, Unsorted, Workspaces) to exactly match their 3px top and bottom margins, ensuring pixel-perfect alignment.

## 3. Strategic Reasoning
- **Visual Balance**: Shifting the row container's right padding from 6px to 3px perfectly moves the rightmost `22px x 22px` button highlight box to sit exactly 3px away from the row edge, mirroring the top/bottom margins (which are `(28 - 22) / 2 = 3px`).
- **Symmetric Continuity**: Applying this symmetrically to the tree rows inside `TreeItem.tsx` and the section header rows in `Sidebar.tsx` achieves complete layout integrity across the whole sidebar.

## 4. Detailed Blueprint
- `src/components/layout/TreeItem.tsx`: Change the row's `paddingRight` property from `6px` to `3px` inside the inline `style` attribute.
- `src/components/layout/Sidebar.tsx`: Change the headers' padding class from `pr-1.5` to `pr-[3px]`.

## 5. Operational Trace
- Edited `src/components/layout/TreeItem.tsx`: Set `paddingRight: '3px'` on the tree row element.
- Edited `src/components/layout/Sidebar.tsx`: Replaced `pr-1.5` with `pr-[3px]` on the Pinned, Unsorted, and Workspaces header row containers.

## 6. Status Assessment
- **Completed**: Equalized rightmost button margins to exactly 3px across all sidebar tree items and headers.
