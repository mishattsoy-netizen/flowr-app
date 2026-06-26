Date and Time: 26.06.2026 17:10

User request: "baack to 220"

### 2. Objective Reconstruction
Revert the left layers/assets floating panel width from 250px back to 220px.

### 3. Strategic Reasoning
Following the user request, the left sidebar's layout width is reverted back to its original `w-[220px]` specification, preserving its compact styling.

### 4. Detailed Blueprint
- Modify `CanvasLayersPanel.tsx` to set `w-[220px]`.
- Verify the project builds cleanly.

### 5. Operational Trace
- Edited [CanvasLayersPanel.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/CanvasLayersPanel.tsx):
  - Changed container class to `w-[220px]`.
- Ran `npx tsc --noEmit`.

### 6. Status Assessment
- Verified the reversion. Left Layers panel width is successfully restored to 220px.
