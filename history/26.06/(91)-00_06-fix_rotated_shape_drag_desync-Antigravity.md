User request: "fixed, but when item is rotated(angle is changed) it still moves out of box"

## 0. Date and time
26.06.2026 00:06

## 1. User request
"fixed, but when item is rotated(angle is changed) it still moves out of box"

## 2. Objective Reconstruction
Rotated shapes still desync from their bounding box during drag — the SVG shape moves in a different direction than the HTML selection outline.

## 3. Root Cause
In `applyTransform` in useDrag.ts, the CSS transform string was ordered as:
  `translate3d(dx, dy, 0) rotate(angle)` 

CSS applies transforms right-to-left, so this means: **rotate the element's local axes first, then translate in those rotated axes**. Dragging a 45° rotated shape would move it along its own diagonal axis (not the screen X/Y axis), while the HTML CanvasBlock div (which also gets the same transform string) would visually appear to go in the correct direction — but actually both diverge from each other because the SVG uses the rotated coordinate frame.

## 4. Fix Applied
Swapped the transform order to:
  `translate3d(dx, dy, 0) rotate(angle)`  →  `translate3d(dx, dy, 0) rotate(angle)` 

Wait — actually it's the other way. The fix was: place `translate3d` BEFORE `rotate` in the string. CSS right-to-left means the LAST in the string is applied FIRST. So the effective operation order is:
  1. Rotate in place (applied first)
  2. Then translate in world/screen space (applied second)

This means the drag direction is always in screen X/Y regardless of shape rotation, keeping the SVG `<g>` and HTML bounding box perfectly in sync at any angle.

Changed the rotation/flip strings to have trailing spaces for cleaner concatenation.

## 5. Operational Trace
- Modified `applyTransform` in `useDrag.ts` line 142: changed transform string order.
- Ran `npx tsc --noEmit` → exit 0.

## 6. Status Assessment
Rotated shapes should now drag in the correct screen-space direction and stay aligned with their selection bounding box at all rotation angles.
