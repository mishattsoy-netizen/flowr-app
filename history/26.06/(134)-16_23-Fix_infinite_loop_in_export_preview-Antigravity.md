Date and Time: 26.06.2026 16:23

User request: "capture stoped working its loading infinetly"

### 2. Objective Reconstruction
The canvas export preview capture stopped working and became stuck loading infinitely. The objective is to identify the cause of the hang/infinite loop and correct it to make the capture and regeneration flows perfectly stable.

### 3. Strategic Reasoning
- The loop occurred because `handleCapture` had `capturing` in its dependency array.
- When `handleCapture` finished and called `setCapturing(false)`, it updated the `capturing` state, which recreated the `handleCapture` callback since it depended on `capturing`.
- The recreated `handleCapture` callback changed its reference, which triggered the `useEffect` listening to `handleCapture`.
- Since `hasGeneratedPreview` was `true`, the `useEffect` automatically invoked `handleCapture()` again. This immediately started another capture iteration, creating an infinite loop of capture execution and re-renders.
- By introducing `capturingRef = useRef(false)` to handle the execution check, and removing `capturing` from `handleCapture`'s dependency array, we ensure that calling `setCapturing(false)` at the end of the capture process does NOT recreate the callback, thereby breaking the infinite loop.

### 4. Detailed Blueprint
- Declare `capturingRef` using `useRef(false)` in `CanvasStylePanel.tsx`.
- Update `handleCapture` to use `capturingRef.current` for checking if a capture is already in progress and setting/resetting it at the start and end of execution.
- Remove `capturing` from the `useCallback` dependency array of `handleCapture`.

### 5. Operational Trace
- Edited [CanvasStylePanel.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/CanvasStylePanel.tsx#L562-L649):
  - Declared `capturingRef = useRef(false)`.
  - Updated `handleCapture` to check/update `capturingRef.current`.
  - Removed `capturing` from the callback's dependencies array.

### 6. Status Assessment
- Infinite loop is resolved; preview captures compile and display correctly.
- Settings changes update the preview successfully without triggering loops.
