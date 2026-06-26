User request: "continue" (converting left/right sidebars to floating panels — continued from previous session)

### 0. Date and time
2026-06-25 at 21:16 (local time)

### 1. User Request
User requested sidebars to become floating panels like the toolbar and zoom controls.
This was a continuation from session #55 which handled the toolbar and zoom/undo controls.

### 2. Objective Reconstruction
Convert the Layers panel (left sidebar) and Style panel (right sidebar) from fixed flex-row sidebars into floating glassmorphism panels that hover above the canvas surface, consistent with the floating toolbar and bottom controls.

### 3. Strategic Reasoning
The previous session already converted the toolbar (bottom-center) and zoom/undo-redo buttons (bottom-left) to floating overlays.
The sidebars were still traditional sidebar columns in a flex row that compressed the canvas.
Converting them to absolute-positioned overlays gives a true full-canvas editing surface, matching modern design tool aesthetics (Figma, Framer, etc.).

### 4. Detailed Blueprint
- `CanvasLayersPanel.tsx`: Change root wrapper from `w-[220px] bg-sidebar border-r ...` to a floating panel with glassmorphism inline styles (border, borderRadius: 12, boxShadow, backdropFilter).
- `CanvasStylePanel.tsx`: Same treatment — from `w-[250px] bg-sidebar border-l ...` to a floating panel with maxHeight scroll.
- `CanvasPage.tsx` (outer layout div): Changed from `flex flex-1 overflow-hidden` (flex row) to `flex-1 relative overflow-hidden`.
- `CanvasPage.tsx` (canvas container): Changed from `flex-1 relative overflow-hidden` to `absolute inset-0 overflow-hidden` to fill the full parent.
- `CanvasPage.tsx` (layers panel render): Wrapped in `absolute left-4 top-[52px] z-[1500]` overlay div.
- `CanvasPage.tsx` (style panel render): Wrapped in `absolute right-4 top-[52px] z-[1500]` overlay div.

### 5. Operational Trace
1. Read `CanvasLayersPanel.tsx` — found root wrapper at line 108.
2. Updated root wrapper to floating glassmorphism panel style.
3. Read `CanvasStylePanel.tsx` — found root wrapper at line 283.
4. Updated root wrapper to floating glassmorphism panel style with maxHeight scroll.
5. Updated `CanvasPage.tsx` outer layout div from flex row to `flex-1 relative overflow-hidden`.
6. Updated canvas container from `flex-1` to `absolute inset-0` to fill the full parent.
7. Wrapped `CanvasLayersPanel` in `absolute left-4 top-[52px] z-[1500]` overlay.
8. Wrapped `CanvasStylePanel` in `absolute right-4 top-[52px] z-[1500]` overlay.

### 6. Status Assessment
- Both sidebars are now floating panels with glassmorphism visual treatment.
- Canvas takes up the full editing area with no flex compression.
- Consistent with the floating toolbar and zoom controls from the previous session.
- Both panels have `stopPropagation` on pointer events to avoid triggering canvas interactions.
- Style panel has `maxHeight: calc(100vh - 100px)` with overflow-y scroll to prevent it from going off-screen.
- Panels sit at z-index 1500, below the toolbar (z-2000) but above canvas content.
