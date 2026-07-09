User request: "1 2 3 4 done, execute 5"

### 0. Date and time
Date: 29.06.2026
Time: 23:02

### 1. User request
User request: "execute 5" — Phase 5 of the Frame & Group plan: rename the canvas 'section' tool to 'frame' throughout the UI layer.

### 2. Objective Reconstruction
Execute Phase 5 of the Figma-like Frame & Group implementation plan. This phase renames the `'section'` canvas tool to `'frame'` across all canvas files, ensuring the toolbar shows "Frame (F)", the keyboard shortcut sets the correct tool, and all type checks in rendering and layers panel logic use `'frame'` instead of `'section'`.

### 3. Strategic Reasoning
Phase 5 covers only the UI-facing tool renaming. Since the data model (phases 1–4) is already done externally, this change wires up the correct tool ID everywhere: toolbar definition, keyboard shortcut, frame creation logic, block rendering type checks, and layers panel filters.

### 4. Detailed Blueprint
Files modified:
- `CanvasToolbar.tsx` — CanvasTool union + CONTENT_TOOLS entry
- `CanvasPage.tsx` — frame creation (`activeTool === 'section'` → `'frame'`), `type: 'section'` → `type: 'frame'`, keyboard shortcut `case 'f'`
- `CanvasBlock.tsx` — isNoteBlock check, data-block-type attribute lookup, z-index/class conditions, render branch type check
- `CanvasLayersPanel.tsx` — icon map key, section/loose filter, LayerRow type check
- `LayersPanel.tsx` — section filter + icon switch

### 5. Operational Trace
- Replaced `'section'` → `'frame'` in `CanvasTool` union and `CONTENT_TOOLS` label
- Updated `case 'f': setActiveTool('frame')` keyboard shortcut
- Updated frame creation: `activeTool === 'frame'`, `type: 'frame'`
- Updated all type checks in `CanvasBlock.tsx` (5 occurrences)
- Updated `CanvasLayersPanel.tsx` icon map key + 3 filter/check occurrences
- Updated `LayersPanel.tsx` legacy panel (2 occurrences)

### 6. Status Assessment
- Completed: Phase 5 fully done. Toolbar shows "Frame (F)", F key activates the frame tool, all rendering and layers logic uses `'frame'` type.
- Note: Existing DB blocks saved as `type: 'section'` will still render — the migration (Phase 10) will handle converting those on load.
- Next: Phase 6 (CanvasBlock frame label + clip rendering improvements) or Phase 8 (CanvasPage group shortcuts).
