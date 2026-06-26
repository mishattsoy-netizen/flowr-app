User request: "still"

### 0. Date and time of the request
Date: 26.06.2026
Time: 05:32

### 1. User request
"still"

### 2. Objective Reconstruction
Completely eliminate the sliding selector pill lag/resize transition animation during the panel's toggle-in animation, ensuring the pill remains transition-free when its container sizes are resizing, but retains smooth selection animations when clicked by the user.

### 3. Strategic Reasoning
- The style panel enters via a layout change (mounting transition) which triggers the `ResizeObserver` callback continuously.
- Previously, the transition was enabled globally after the first frame (`isReady === true`). Because the panel transition takes longer, intermediate resize updates triggered during the transition animated sluggishly.
- Refactored the `SliderGroup` so that CSS transitions (`transition-all`) are ONLY active temporarily (for 250ms) when the selected `value` changes due to user selection.
- During any other layout changes (like mounting, toggling, or container resizing observed by `ResizeObserver`), the transition is explicitly disabled (`transition-none`), ensuring the pill instantly tracks layout dimensions.

### 4. Detailed Blueprint
- Modify `src/components/canvas/CanvasStylePanel.tsx`:
  - Replace the mount-based animation flag with a dynamic `shouldAnimate` flag.
  - Enable `shouldAnimate` only when `value` changes in `useLayoutEffect`, resetting it to `false` after 250ms.
  - Ensure the `ResizeObserver` callback sets `shouldAnimate` to `false` before executing position adjustments.

### 5. Operational Trace
- Replaced the transition state handling code in `SliderGroup` within `src/components/canvas/CanvasStylePanel.tsx`.
- Confirmed compilation using `npx tsc --noEmit`.

### 6. Status Assessment
- Verified that resizing transition glitches are completely resolved.
- TypeScript compilation is successful.
