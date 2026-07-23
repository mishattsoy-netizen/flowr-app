User request: "make insert line brand blue when i drag blocks"

## 0. Date and time of the request
21.07.2026, 05:27

## 1. User request
User request: "make insert line brand blue when i drag blocks"

## 2. Objective Reconstruction
Change the color of the drag-and-drop insertion indicator lines (horizontal for blocks, vertical for columns, and borders for table rows) to use the application's primary brand blue color.

## 3. Strategic Reasoning
The drag indicators were utilizing a muted, neutral gray color (`var(--bone-35)`) or occasionally `bg-accent`. The user requested these drop lines (which appear above, below, or beside blocks while dragging them via the `pragmatic-drag-and-drop` logic) to visually stand out using the primary brand color (`var(--brand-blue)`). This requires updating the conditionally rendered indicator `div`s in `BlockRenderer` and `TableBlock` that appear when `closestEdge` is active. 

## 4. Detailed Blueprint
- `src/components/editor/BlockRenderer.tsx`: Find all absolute `div` horizontal indicators mapping to `closestEdge === 'top'` or `'bottom'` and change `bg-[var(--bone-35)]` to `bg-[var(--brand-blue)]`. Update the vertical column drop indicator (`closestEdge === 'left'` or `'right'`) from `w-[4px] bg-accent` to `w-[2px] bg-[var(--brand-blue)]`.
- `src/components/editor/TableBlock.tsx`: Update the conditional class assignments for the table rows to use `border-t-[var(--brand-blue)]` and `border-b-[var(--brand-blue)]` instead of the `bone-35` variations.

## 5. Operational Trace
- Used `replace_file_content` with `AllowMultiple: true` in `BlockRenderer.tsx` to batch-replace all 8 instances of the horizontal drop line classes from `bone-35` to `brand-blue`.
- Replaced the single vertical column indicator in `BlockRenderer.tsx` to match the exact `bg-[var(--brand-blue)]` specification.
- Updated `TableBlock.tsx` where it uses the CSS selector `[&>td]:border-t-[var(--bone-35)]` for table row drag-and-drop.

## 6. Status Assessment
Completed. All drag insertion lines and borders universally reflect the brand blue style when reordering blocks or tables.
