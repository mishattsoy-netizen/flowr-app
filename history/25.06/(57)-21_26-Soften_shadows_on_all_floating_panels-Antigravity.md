User request: "make shadows softer"

### 0. Date and time
2026-06-25 at 21:26 (local time)

### 1. User Request
Reduce the visual weight of shadows on all floating canvas UI elements.

### 2. Objective Reconstruction
Soften the drop shadows across all four floating elements: layers panel, style panel, toolbar, and zoom/undo-redo controls.

### 3. Strategic Reasoning
The previous shadow values (`rgba(0,0,0,0.3)` to `rgba(0,0,0,0.35)`) were too heavy for a refined design tool aesthetic. Reducing to `rgba(0,0,0,0.18)` with a consistent `0 4px 20px` spread gives a lighter, more premium feel while still providing visible depth separation.

### 4. Files Changed
- `CanvasLayersPanel.tsx` — boxShadow: `0 8px 32px rgba(0,0,0,0.35)` → `0 4px 20px rgba(0,0,0,0.18)`
- `CanvasStylePanel.tsx` — same change
- `CanvasToolbar.tsx` — shadow class: `0_4px_12px_rgba(0,0,0,0.3)` → `0_4px_20px_rgba(0,0,0,0.18)`
- `CanvasPage.tsx` — zoom controls and undo/redo controls: same update

### 5. Status
All floating panel shadows now use a consistent, soft `0 4px 20px rgba(0,0,0,0.18)` value.
