User request: "dots not vissible"

### 0. Date and time
2026-06-25 at 22:09 (local time)

### 1. User Request
Fix visibility of the dots background pattern on the canvas editing workspace.

### 2. Objective Reconstruction
Modify the dots background CSS pattern to use a centered radial gradient with higher opacity (`var(--bone-12)` instead of the faint `var(--bone-3)`), preventing clipping at tile edges and improving visual feedback.

### 3. Strategic Reasoning
- Centering the dots in the cells (`radial-gradient(circle, ...)`) avoids alignment clipping issues at repeating tile edges.
- Since dots are tiny pixel groups, `var(--bone-3)` (3% opacity) was practically invisible. Upgrading to `var(--bone-12)` (12% opacity) renders a clear, sharp, yet subtle dot pattern.

### 4. Detailed Blueprint
- `CanvasPage.tsx`: Replace the `radial-gradient` center from `circle at 0px 0px` to `circle` and raise dot opacity color to `var(--bone-12)` (with a dot radius of `1.2px`).

### 5. Operational Trace
1. Adjusted `radial-gradient` pattern logic in `CanvasPage.tsx` line 713 and corrected ternary syntax.

### 6. Status Assessment
- Dots pattern is now clearly visible and properly centered.

*Agent used: `engineering-frontend-developer`*
