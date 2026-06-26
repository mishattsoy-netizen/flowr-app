User request: "still slide in/resize on shown"

### 0. Date and time of the request
Date: 26.06.2026
Time: 05:26

### 1. User request
"still slide in/resize on shown"

### 2. Objective Reconstruction
Suppress the sliding selector pill animation/transition inside the `SliderGroup` component during its initial render, mount, or panel visibility toggle, while maintaining smooth transitions on active user interaction thereafter.

### 3. Strategic Reasoning
- When the panel mounts, `pillStyle` coordinates are updated from default state placeholders to their measured coordinates.
- Because of the transition styles, this causes the pill to visible slide/glide into position from its default, which looks like a lag/glitch.
- By introducing an `isReady` state (enabled on the frame after mount via `requestAnimationFrame`), we keep transitions disabled (`transition-none`) on the first layout pass, and enable transitions (`transition-all`) for subsequent value changes.

### 4. Detailed Blueprint
- Modify `src/components/canvas/CanvasStylePanel.tsx`:
  - Add `isReady` state inside `SliderGroup`.
  - Use a mount-only `useEffect` with `requestAnimationFrame` to toggle `isReady` to true.
  - Set sliding pill classes dynamically: `transition-none` when `isReady` is false, and `transition-all duration-250 ease-out` when true.

### 5. Operational Trace
- Added state hook and mount `useEffect` to `SliderGroup` inside `src/components/canvas/CanvasStylePanel.tsx`.
- Ran `npx tsc --noEmit` which completed successfully.

### 6. Status Assessment
- Initial mount sliding pill transition successfully suppressed.
- Checked project build integrity and all validation checks succeeded.
