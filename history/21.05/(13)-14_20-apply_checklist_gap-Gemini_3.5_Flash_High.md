User request: "same gap apply to checklist"

### 0. Date and Time of the Request
- Date: 2026-05-21
- Time: 14:19:50+02:00

### 1. User Request
User request: "same gap apply to checklist"

### 2. Objective Reconstruction
The objective was to increase the visual gap between the checklist checkboxes and the list item text to match the newly established `10px` gap from the bullet and numbered list items, while maintaining perfect vertical baseline start-alignment across all list block types.

### 3. Strategic Reasoning
- Previously, bullet and numbered lists were modified to have a padding-right of `pr-2.5` (`10px`).
- To align checklists with this, the margin-right on the checklist checkbox was increased from `mr-1` (`4px`) to `mr-2.5` (`10px`), providing the exact same `10px` horizontal separation.
- To keep the editable text of all list types (checklists, bullet lists, dashed lists, numbered lists) perfectly aligned vertically, the outer width of the marker container for bullet/numbered/dashed lists was expanded from `20px` to `26px`.
- This ensures all text components start exactly at a vertical line of `26px` relative to their parent list row element:
  - Checklist: `16px` checkbox + `10px` gap (`mr-2.5`) = `26px`.
  - Bullets/Numbers: `26px` marker container width = `26px`.

### 4. Detailed Blueprint
- **File to modify**: `src/components/editor/ListBlock.tsx`
- **Changes**:
  - In `RowEl`, locate the checklist checkbox wrapper `div` and change its class `mr-1` to `mr-2.5`.
  - Locate the bullet/number marker wrapper `div` and change its style `width: '20px'` to `width: '26px'`.

### 5. Operational Trace
- Read the element configuration inside `src/components/editor/ListBlock.tsx`.
- Replaced `mr-1` with `mr-2.5` for checklists, and `width: '20px'` with `width: '26px'` for bullet/number markers using the `replace_file_content` tool.
- Verified TypeScript compilation using `npx tsc --noEmit` to ensure type-safety.

### 6. Status Assessment
- **Completed**: Checklist checkboxes now feature the matching `10px` visual gap, and all list types align perfectly at a `26px` offset.
- **Verification**: Clean TypeScript build with zero compilation errors.
