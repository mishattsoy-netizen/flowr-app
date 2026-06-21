# Handoff: Tooltip Hover-Only & Overlay Suppression

## What's Already Done ✅

### All source code changes are complete and sitting in the working tree (NOT committed):

| File | Change |
|---|---|
| `src/components/layout/TooltipOverlayContext.tsx` | **NEW** — React context + `TooltipOverlayProvider` + `useTooltipSuppression(active)` hook. Auto-tracks global overlays (modals, context menus via zustand store). Counter-based Set<string> so multiple overlays coexist. |
| `src/components/layout/Tooltip.tsx` | Added `useTooltipOverlay()` subscription — hides immediately when `isSuppressed`, blocks new tooltips. Added `onPointerDown` handler for drag-initiated mousedown and right-click. |
| `src/components/layout/Shell.tsx` | Wrapped app root in `<TooltipOverlayProvider>` |
| `src/components/editor/NoteEditor.tsx` | Added `useTooltipSuppression(Boolean(activeOptionsMenu \|\| slashMenu \|\| isDragging))` |
| `src/components/editor/BlockRenderer.tsx` | Added `useTooltipSuppression(isDraggingGlobal)`. Removed all 12 `title="Save"`, `title="Cancel"`, `title="Edit Label"`, `title="Edit URL"` native attributes. |
| `src/components/editor/DatabaseBlock.tsx` | Removed 6 `title` attributes (Move left/right, Delete column, Move up/down, Delete row) |
| `src/components/editor/LinkPreview.tsx` | Removed 2 `title` attributes (Copy Link, Remove Link) |
| `src/components/editor/SelectionToolbar.tsx` | Added `useTooltipSuppression(Boolean(showLinkPopover \|\| showHighlightPicker))` |
| `src/components/layout/Sidebar.tsx` | Added `useTooltipSuppression(activeDragId !== null)` |

### Files from this session that should also be committed:
- `.superpowers/sdd/task-1-brief.md` (plan artifact)
- `docs/superpowers/specs/2026-06-21-tooltip-hover-only-and-overlay-suppression-design.md` (spec)
- `docs/superpowers/plans/2026-06-21-tooltip-hover-only-and-overlay-suppression.md` (implementation plan)
- `.superpowers/sdd/handoff-to-next-ai.md` (this file — optional)

## What Still Needs Doing ❌

### 1. Verify compilation
```bash
cd /Users/mktsoy/Dev/flowr-app
npx tsc --noEmit --pretty
```
If there are type errors, fix them before committing.

### 2. Commit everything
```bash
git add src/components/layout/TooltipOverlayContext.tsx \
       src/components/layout/Tooltip.tsx \
       src/components/layout/Shell.tsx \
       src/components/editor/NoteEditor.tsx \
       src/components/editor/BlockRenderer.tsx \
       src/components/editor/DatabaseBlock.tsx \
       src/components/editor/LinkPreview.tsx \
       src/components/editor/SelectionToolbar.tsx \
       src/components/layout/Sidebar.tsx \
       .superpowers/sdd/task-1-brief.md \
       docs/superpowers/specs/2026-06-21-tooltip-hover-only-and-overlay-suppression-design.md \
       docs/superpowers/plans/2026-06-21-tooltip-hover-only-and-overlay-suppression.md

git commit -m "feat: tooltip hover-only and overlay suppression

- TooltipOverlayContext: centralized overlay tracking with auto-detection
  of global overlays (modals, context menus)
- Tooltip: subscribes to overlay context, hides when suppressed,
  adds onPointerDown handler
- NoteEditor: suppresses tooltips during options menu, slash menu, drag
- BlockRenderer: suppresses during global drag, removes 12 native title attrs
- DatabaseBlock: removes 6 native title attrs
- LinkPreview: removes 2 native title attrs
- SelectionToolbar: suppresses during link popover and highlight picker
- Sidebar: suppresses during drag state

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### 3. Run verification in dev server
```bash
npm run dev
```
Then test:
- **Notes page:** Hover toolbar buttons → tooltip shows after 500ms ✓
- **Options menu:** Click block drag handle → menu opens, tooltip hides ✓
- **While menu open:** Hover other elements → no tooltip ✓
- **Block drag:** Grab a block handle → tooltips suppressed during drag ✓
- **Context menu:** Right-click → tooltip hides ✓
- **Link popover:** Click link button in SelectionToolbar → tooltip hides ✓
- **Native titles:** Tab through editor buttons → no browser-native tooltips ✓
- **Sidebar (collapsed):** Hover icons → tooltip appears ✓
- **Sidebar drag:** Drag an item → tooltip suppressed ✓
- **Modals:** Open any modal → tooltips suppressed ✓

## Implementation Details

### How TooltipOverlayContext Works

```
TooltipOverlayProvider (in Shell.tsx)
├── Auto-detects: store.modal, store.contextMenu, store.taskContextMenu
├── Exposes: { isSuppressed, registerOverlay(id), unregisterOverlay(id) }
│
├── Tooltip subscribes to isSuppressed → hides when true
├── useTooltipSuppression(active) hook → register when active, unregister on cleanup
```

The provider uses a `Set<string>` internally so multiple concurrent overlays work:
- `__global__` — auto-reserved for modals + context menus
- `overlay-{random}` — each `useTooltipSuppression(true)` call gets a unique ID
- `isSuppressed` is `overlayIds.size > 0`

### Edge Cases Covered
- **Rapid open/close:** Multiple `useTooltipSuppression` calls with overlapping lifecycles work because each has a unique ID
- **Right-click context menu:** `onPointerDown` handler catches it (not just `onClick`)
- **Drag start:** `onPointerDown` fires before the drag fully starts, immediately hiding any visible tooltip
- **Tooltip already visible + overlay activates:** The `useEffect([isSuppressed])` in Tooltip.tsx line 29-33 catches this and hides instantly
