User request: "make colors popup exact same as in tasks and colors exact same"

## 0. Date and time of the request
21.07.2026, 05:11

## 1. User request
User request: "make colors popup exact same as in tasks and colors exact same"

## 2. Objective Reconstruction
Update the block color submenu in `BlockOptionsMenu.tsx` to visually match the exact grid layout, "None" button, and specific color palette used in the tasks UI (`TaskContextMenu.tsx`).

## 3. Strategic Reasoning
The tracker task menu features a highly compact, polished 4x2 grid of 8 specific hex colors with a distinct full-width "None" button at the top, along with selected states featuring an outer ring. 
By importing the `CircleDashed` icon and migrating the exact markup pattern from `TaskContextMenu.tsx`, we can replicate the exact experience. 
The editor handles background color opacities gracefully at the `BlockRenderer` level (`color-mix` / `rgba`), so we can safely pass the solid hex values down without them appearing overpowering in the final UI.

## 4. Detailed Blueprint
- Remove the old `BLOCK_COLORS` array and `hexToRgba` utility from `BlockOptionsMenu.tsx`.
- Define the exact `COLORS` array from `TaskContextMenu` (`#EF4444`, `#F59E0B`, etc.).
- Rewrite the `subMenu === 'color'` block in `BlockOptionsMenu.tsx` to render two distinct sections (Text Color, Background Color).
- Each section features a "None" reset button using `CircleDashed` and a two-row grid (`grid-cols-4`) of color circles.
- Ensure the active state (`block.textColor === c` or `block.bgColor === c`) replicates the scaled-up ringed UI from the tasks.
- Ensure selection triggers `onUpdate` and `onClose()`.

## 5. Operational Trace
- Used `replace_file_content` to import `CircleDashed`.
- Used `replace_file_content` to replace the old color submenu JSX with the new double-grid layout.
- Used `replace_file_content` to prune the unused `BLOCK_COLORS` legacy code at the top of the file.

## 6. Status Assessment
Completed. The color popup in the editor is now fully aligned with the unified task color grid.
