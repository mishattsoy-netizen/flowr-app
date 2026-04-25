User request: "fix bottom of the pinned list is always faded away"

### Objective Reconstruction
The objective was to fix a visual bug where the sidebar lists (specifically the pinned list) would show a transparent fade effect at the bottom even when the content was not scrollable or was already scrolled to the end.

### Strategic Reasoning
The issue was caused by a mismatch between the CSS utility and the JavaScript logic:
1. **CSS Defaults**: The `scroll-fade` utility in `globals.css` used `24px` as the default fallback for `--scroll-bottom-offset`. If the JS hadn't set a value yet, it would default to fading.
2. **JS Logic**: The `updateScrollFade` function in `Sidebar.tsx` was attempting to reset the alpha (visibility) of the fade using non-existent variables (`--scroll-top-alpha`) instead of resetting the actual offsets used by the mask.

### Detailed Blueprint
- **Sidebar.tsx**: Update `updateScrollFade` to correctly reset `--scroll-top-offset` and `--scroll-bottom-offset` to `0px` when content fits within the container.
- **globals.css**: Change the default fallback for scroll offsets from `24px` to `0px` to ensure no fading occurs by default.

### Operational Trace
1. Modified `src/components/layout/Sidebar.tsx` to fix the reset logic.
2. Modified `src/app/globals.css` to update the default CSS variable values.

### Status Assessment
The scroll-fade effect now correctly reflects the scroll state. It is invisible when content is not scrollable and properly disappears when the user reaches the top or bottom of a list.
