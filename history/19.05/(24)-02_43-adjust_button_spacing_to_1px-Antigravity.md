User request: "gap between plus button and options should be 1px"

## 0. Date and time of the request
Date: 19.05 (May 19, 2026)
Time: 02:43

## 1. User request
"gap between plus button and options should be 1px"

## 2. Objective Reconstruction
Change the spacing (gap) between the plus button and the options button in the sidebar list items from 4px (`gap-1`) to 1px (`gap-[1px]`).

## 3. Strategic Reasoning
- Reducing the gap to 1px draws the tiny action buttons closer together, giving them a more unified, high-density dashboard appearance inside the small row item.

## 4. Detailed Blueprint
- `src/components/layout/TreeItem.tsx`: Change `gap-1` to `gap-[1px]` inside the buttons container element.

## 5. Operational Trace
- Edited `src/components/layout/TreeItem.tsx`: Modified the `className` of the action buttons container from `flex items-center gap-1 shrink-0` to `flex items-center gap-[1px] shrink-0`.

## 6. Status Assessment
- **Completed**: Button gap spacing adjusted to 1px.
