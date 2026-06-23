User request: "create new corner style: tiny and use it for collapse, options and plus buttons, ONLY for list items in sidebar"
"and it should be 3px btw"

## 0. Date and time of the request
Date: 19.05 (May 19, 2026)
Time: 02:42

## 1. User request
"create new corner style: tiny and use it for collapse, options and plus buttons, ONLY for list items in sidebar"
"and it should be 3px btw"

## 2. Objective Reconstruction
Define a new global corner style variable `--radius-tiny: 3px;` in the CSS system and apply it to the collapse (chevron), options (`...`), and plus (`+`) buttons strictly inside list items (tree items) in the sidebar, while leaving category header controls unchanged.

## 3. Strategic Reasoning
- **Visual Contrast**: A smaller 3px border-radius (`var(--radius-tiny)`) fits the tiny sizes of list item sub-buttons (`20px x 20px` overlay and `22px x 22px` utility buttons) much better than the standard 6px radius (`var(--radius-small)`), creating a sharp and refined aesthetic.
- **Strict Scope Isolation**: Applying `!rounded-[var(--radius-tiny)]` inside `TreeItem.tsx` restricts the radius change to list items, preserving the category header utility styling in `Sidebar.tsx`.

## 4. Detailed Blueprint
- `src/app/globals.css`: Add `--radius-tiny: 3px;` inside `:root`.
- `src/components/layout/TreeItem.tsx`:
  - Update chevron backdrop overlay container class to use `rounded-[var(--radius-tiny)]`.
  - Update plus button and options button classes to override default styling with `!rounded-[var(--radius-tiny)]`.

## 5. Operational Trace
- Edited `src/app/globals.css`: Added `--radius-tiny: 3px;` to `:root`.
- Edited `src/components/layout/TreeItem.tsx`:
  - Replaced `rounded-[var(--radius-small)]` with `rounded-[var(--radius-tiny)]` for the chevron hover trigger area.
  - Appended `!rounded-[var(--radius-tiny)]` to the plus button and options button classes.

## 6. Status Assessment
- **Completed**: Tiny 3px corner style created and successfully implemented strictly for sidebar list item action controls.
