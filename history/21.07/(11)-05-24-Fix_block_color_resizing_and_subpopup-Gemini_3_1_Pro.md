User request: "blocks mustnt change size or shape on bg color change. and BACKGROUND COLOR popup, shouldnt replace options poup, it shoul be subpopup, without back button. but tun into should stay same"

## 0. Date and time of the request
21.07.2026, 05:24

## 1. User request
User request: "blocks mustnt change size or shape on bg color change. and BACKGROUND COLOR popup, shouldnt replace options poup, it shoul be subpopup, without back button. but tun into should stay same"

## 2. Objective Reconstruction
1. Prevent blocks from shifting size or gaining padding when a background color is applied.
2. Refactor the Color options menu to render as an adjacent sub-popup to the main Block Options menu (instead of replacing it entirely), without a back button.
3. Keep the "Turn Into" menu functioning as an in-place replacement of the main Block Options menu.

## 3. Strategic Reasoning
- The visual shifting occurred because `BlockRenderer` was conditionally applying Tailwind classes `border px-[16px] py-[8px]` whenever `block.bgColor` was truthy. By removing this conditional class application, the block retains its native padding and only the inline style background color dictates its visual appearance.
- To convert the Color menu into a true sub-popup, the React render tree in `BlockOptionsMenu` was restructured. Previously, the component had early returns for `if (subMenu === 'color')` and `if (subMenu === 'turnInto')`. Now, the main menu renders for both `null` and `'color'`, and when `'color'` is active, a secondary absolute-positioned `div` is rendered alongside the main menu.
- The `turnInto` condition remains an early return, replacing the primary menu viewport entirely to allow for its complex search UI and scrollable height.

## 4. Detailed Blueprint
- `src/components/editor/BlockRenderer.tsx`: Remove `block.bgColor && "border px-[16px] py-[8px]"` from the block content container's classnames.
- `src/components/editor/BlockOptionsMenu.tsx`: 
  - Change the main menu condition to `if (subMenu === null || subMenu === 'color')`.
  - Inside that return, add an adjacent sibling div for the color options that only mounts `if (subMenu === 'color')`.
  - Strip the `ChevronLeft` back button header from the newly adjacent color sub-popup.
  - Position the sub-popup slightly to the right (`adjustedPos.x + 204`) of the main menu.
  - Retain `if (subMenu === 'turnInto')` as-is.

## 5. Operational Trace
- Used `replace_file_content` on `BlockRenderer.tsx` to strip out the size-altering padding and border classes.
- Used `replace_file_content` on `BlockOptionsMenu.tsx` to rewrite the rendering flow, nesting the Color grid alongside the main menu and stripping its title/back button.
- Cleaned up trailing syntax errors caused by an artifact replace operation.

## 6. Status Assessment
Completed. Blocks no longer resize when colored, and the Color picker is now a distinct, hovering sub-popup that displays simultaneously next to the active Block Options menu.
