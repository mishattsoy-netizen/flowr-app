User request: "it says empty board, it does not show preview. also remove elements count section. in canvas only show preview box"

Date/Time: 2026-06-30 21:38

Root Cause: Canvas blocks are NOT stored in entity.content. They live in a separate Supabase table (canvas_blocks) and are held in the Zustand store under state.blocks, keyed by block.canvasId. The previous implementation was filtering entity.content which is always empty for canvas entities.

Fixes applied (Dashboard.tsx):
1. CanvasMiniPreview now accepts canvasBlocks prop (EditorBlock[]) instead of entity.
2. subscribed to allBlocks = useStore(state => state.blocks) in Dashboard.
3. Passed allBlocks.filter(b => b.canvasId === entity.id) to CanvasMiniPreview.
4. Fixed field names: canvasStyleExt.fill (not canvasStyle.fill), shapeKind (not shapeType).
5. Footer sentence: now only shown for isNote cards. Canvas cards show only the preview box.

Status: TypeScript 0 errors. 126/126 tests passing.
