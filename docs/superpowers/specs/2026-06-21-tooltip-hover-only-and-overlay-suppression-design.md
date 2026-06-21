# Tooltip: Hover-Only & Overlay Suppression

## Problem

1. **Native `title` attributes** on buttons show on both hover AND keyboard focus, violating the "hover only" rule. These exist in `DatabaseBlock.tsx`, `BlockRenderer.tsx`, and `LinkPreview.tsx`.
2. **No centralized overlay suppression**: When a popup (options menu, slash menu, link popover), modal, context menu, or drag operation activates, tooltips that are currently visible should hide immediately and new ones should not appear. Currently this is handled ad-hoc (HeaderBar manually checks `modal`/`contextMenu`, BlockRenderer checks `isDraggingGlobal`).

## Solution

### 1. TooltipOverlayContext (`src/components/layout/TooltipOverlayContext.tsx`)

A React context that tracks active overlays via a `Set<string>` and exposes:

- `isSuppressed: boolean` — true when any overlay is active
- `registerOverlay(id: string): void` — add an overlay
- `unregisterOverlay(id: string): void` — remove an overlay

The Provider (`TooltipOverlayProvider`):
- Wraps the app in `Shell.tsx`
- Auto-subscribes to the zustand store for `modal`, `contextMenu`, and `taskContextMenu`
- Auto-suppresses tooltips when any of these global overlays are active

### 2. `useTooltipSuppression(active: boolean)` hook

When `active` transitions to `true`, generates a stable ID and calls `registerOverlay()`. When `active` → `false` or unmount, calls `unregisterOverlay()`.

### 3. Updated Tooltip component

- Subscribes to `TooltipOverlayContext.isSuppressed`
- When `isSuppressed` becomes true → immediately clears any pending timer and hides the tooltip (prevents new ones too)
- Adds `onPointerDown` handler (covers mousedown for drag starts, any pointer interaction)

### 4. Integration points

| Component | Overlay | Hook/Integration |
|---|---|---|
| `NoteEditor` | activeOptionsMenu, slashMenu, isDragging | `useTooltipSuppression(Boolean(activeOptionsMenu || slashMenu || isDragging))` |
| `BlockRenderer` | isDraggingGlobal (prop) | `useTooltipSuppression(isDraggingGlobal)` |
| `SelectionToolbar` | showLinkPopover, showHighlightPicker | `useTooltipSuppression(Boolean(showLinkPopover || showHighlightPicker))` |
| `Provider` (automatic) | store.modal, store.contextMenu, store.taskContextMenu | Zustand subscription in provider |
| `Sidebar` | drag active (from monitorForElements) | Local state + `useTooltipSuppression(localDragState)` |

### 5. Remove native `title` attributes

Strip `title` attributes from 20 buttons across:
- `DatabaseBlock.tsx` — 6 buttons (Move left/right, Delete column, Move up/down, Delete row)
- `BlockRenderer.tsx` — 12 buttons (Save/Cancel/Edit Label/Edit URL × 3 link edit popovers)
- `LinkPreview.tsx` — 2 buttons (Copy Link, Remove Link)

## Files Changed

| File | Change |
|---|---|
| `src/components/layout/TooltipOverlayContext.tsx` | **New** — context, provider, hook |
| `src/components/layout/Tooltip.tsx` | Subscribe to context, add onPointerDown |
| `src/components/layout/Shell.tsx` | Wrap with TooltipOverlayProvider |
| `src/components/editor/NoteEditor.tsx` | Add useTooltipSuppression for menus + drag |
| `src/components/editor/BlockRenderer.tsx` | Add useTooltipSuppression(isDraggingGlobal), remove 12 title attrs |
| `src/components/editor/DatabaseBlock.tsx` | Remove 6 title attrs |
| `src/components/editor/LinkPreview.tsx` | Remove 2 title attrs |
| `src/components/editor/SelectionToolbar.tsx` | Add useTooltipSuppression for inline link popover |
| `src/components/layout/Sidebar.tsx` | Add useTooltipSuppression for drag state |

## Verification

1. Run the app and navigate to a notes page
2. Hover toolbar/block buttons → tooltip appears after 500ms
3. Click a button that opens a popup → tooltip hides instantly
4. While popup is open, hover other elements → no tooltip
5. Drag a block/sidebar item → no tooltips during drag
6. Right-click to open context menu → tooltip hides
7. Tab through buttons → no native title tooltips (they've been removed)
