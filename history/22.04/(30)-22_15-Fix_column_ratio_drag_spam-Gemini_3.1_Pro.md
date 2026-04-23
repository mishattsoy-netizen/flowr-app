User request: "columnt ratio drag change doeant work"

## Objective Reconstruction
Fix the column ratio drag mechanism. The user reported that dragging the divider between two widgets in edit mode did not work as intended. 

## Strategic Reasoning
After investigating `BentoDashboard.tsx` and `useBentoLayout.ts`, I identified two critical issues causing the divider dragging to fail or lag heavily:
1. **History & Storage Spam**: The pointer-move event handler for the divider was directly calling `commitLayout` on every single pixel movement (60+ times a second). This caused rapid consecutive writes to `localStorage` and flooded the 20-step undo stack instantly, leading to severe lag and unresponsiveness.
2. **Invalid Divider Rendering**: The code allowed dividers to be drawn and dragged even if the row contained a spanner (where the two widgets didn't occupy the full 6 half-columns). Resizing them to sum to 6 in a 4-capacity row broke the math.

## Detailed Blueprint & Operational Trace
1. **Created Preview State for Dividers (`src/hooks/useBentoLayout.ts`)**:
   - Added `handleDividerDragPreview` to update `previewLayout` without triggering history/storage commits.
   - Added `handleDividerDragEnd` to finally call `commitLayout` only when the user releases the mouse.
2. **Hardened Divider Logic (`src/components/bento/BentoDashboard.tsx`)**:
   - Refactored the `pointermove` and `pointerup` event handlers to use the new preview/end lifecycle functions.
   - Added a strict constraint: `if (leftItem.w + rightItem.w === 6)`. Dividers are now only rendered if the two widgets occupy the *entire* horizontal space of the row, ensuring `snapDivider`'s 2-4, 3-3, 4-2 math is perfectly accurate.

## Status Assessment
- **Fixed**: The divider drag feature now performs smoothly without spamming `localStorage` or the history stack. Visual resizing is instantaneous via the preview state.
- **Next Recommendation**: None required. The drag logic is fully optimized.
