User request: "phase 6"

### 0. Date and time
Date: 29.06.2026
Time: 23:07

### 1. User request
User request: "phase 6" — execute Phase 6 of the Frame & Group plan: improve CanvasBlock.tsx frame rendering.

### 2. Objective Reconstruction
Upgrade the frame block's visual rendering in CanvasBlock.tsx:
1. Add `data-block-type` attribute to the outer container (enables DOM-based drop-into-frame detection).
2. Replace the old hardcoded panel-style label inside the frame with a clean Figma-style label above the block, outside its bounds.
3. Apply `overflow: hidden` when `block.clipContent === true`.
4. Render the frame body with fill/stroke/cornerRadius from `canvasStyleExt`, falling back to subtle transparent defaults.
5. Remove the hardcoded p-4 padding and oversized border-dashed class from the outer container.

### 3. Strategic Reasoning
The old label was inside the block with a `bg-sidebar` tab look — not Figma-like. The new label is absolutely positioned at `top: -22px` outside the container, clean and minimal. The frame body is now a separate `div` inside the fragment with its styles driven by `canvasStyleExt`, matching how shapes work. This also unblocks Phase 8 (style panel) which will control fill/stroke/cornerRadius.

### 4. Detailed Blueprint
Modified: `CanvasBlock.tsx`
- Outer div: added `data-block-type={block.type}` attribute
- Outer div className: removed hardcoded dashed border/bg/padding, added `min-w/min-h` and clip conditional
- Frame render branch: replaced inner label div with fragment `<>` containing:
  - A positioned label span above the block
  - A full-size body div styled from canvasStyleExt

### 5. Operational Trace
- Added `data-block-type` to outer div
- Replaced outer className frame condition: removed `border-2 border-dashed ... p-4 min-w-[300px]`, added `min-w-[120px] min-h-[80px]` + overflow class
- Replaced inner frame JSX from `<div className="w-full h-full relative">` with a fragment containing label + body div
- Label: `absolute`, `top: -22`, `left: 0`, `text-[11px] font-medium`
- Body: `w-full h-full`, background/border/borderRadius from `canvasStyleExt`

### 6. Status Assessment
- Completed: Phase 6 done. Frames now render with Figma-style label above, configurable fill/border, clip toggle support, and correct data attribute for drop detection.
- Next: Phase 7 (CanvasLayersPanel groups), Phase 8 (CanvasPage shortcuts), or Phase 9 (style panel).
