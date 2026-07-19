# Canvas Redesign — Excalidraw-style Feature Parity

**Date:** 2026-05-06
**Status:** Approved

## Summary

Full overhaul of the existing canvas page: fix all broken interactions, replace the UI with a Framer-inspired design system aligned to the app's visual language, add Excalidraw-style shape tools and workflow features, and add cloud sync + real-time collaboration via Supabase.

The existing block types (text, image, video, section, comment, connection) are preserved and extended — not replaced.

---

## Approach

Native SVG shape layer on top of the existing React/CSS-transform canvas. New `shape` block type stored in the same Zustand store alongside existing block types. No new rendering library. Cloud sync via a new `canvas_blocks` Supabase table following the existing `sync.ts` pattern.

**Rejected alternatives:**
- Rough.js (hand-drawn aesthetic not wanted)
- tldraw embed (large bundle, hard to integrate with existing store)
- Full replace of existing blocks (user wants to preserve existing block types)

---

## Visual Design

Framer-inspired UI adapted to the app's design language:

- **Color palette:** `#141413` background, `#1c1c1a` panels, `#E9E9E2` bone scale for text/borders, `#d38f36` accent
- **Buttons:** No borders on filled buttons. Transparent icon buttons only.
- **Tool pills:** Grouped segments in the top center bar (Framer-style)
- **Panels:** Dark pill inputs (`#232321`), round color swatches, segmented controls, Framer-style switches
- **Dot grid:** Preserved exactly as-is
- **Animations:** 100–200ms transitions, instant drag/resize (no transition during pointer events)

---

## Architecture

### Rendering layers (bottom to top)
1. Dot-grid background (CSS `background-image`)
2. SVG overlay — `CanvasShapeLayer` (new shape blocks)
3. DOM layer — existing `CanvasBlock` components (text, image, video, section, comment)
4. SVG overlay — `CanvasConnections` (arrows/connections)
5. Interaction overlays — selection handles, rubber-band box, cursor indicators

### State
- All blocks (existing + new shapes) live in Zustand `blocks: EditorBlock[]`
- History stack managed by `useCanvasHistory` hook (separate from store, in-memory)
- Viewport (pan/zoom) stays as local component state in `CanvasPage`

### Sync
- New `canvas_blocks` Supabase table
- `canvasSync.ts` handles upsert/delete mirroring the existing `sync.ts` pattern
- Realtime subscription via Supabase channel for block updates
- Live cursors via Supabase Realtime broadcast (presence channel per canvas)

---

## Data Model

### EditorBlock additions

```ts
type ShapeKind = 'rect' | 'ellipse' | 'diamond' | 'line' | 'arrow' | 'freedraw'

interface BlockStyle {
  fill?: string
  fillOpacity?: number
  stroke?: string
  strokeWidth?: number
  strokeStyle?: 'solid' | 'dashed' | 'dotted'
  cornerRadius?: number
  opacity?: number
  locked?: boolean
}

// Added to existing EditorBlock:
shapeKind?: ShapeKind        // only when type === 'shape'
points?: [number, number][]  // for line, arrow, freedraw
style?: BlockStyle
groupId?: string             // for Ctrl+G grouping
```

### canvas_blocks Supabase table

| Column | Type | Notes |
|---|---|---|
| id | text PK | matches EditorBlock.id |
| canvas_id | text | references entities.id |
| user_id | uuid | FK to auth.users |
| workspace_id | text | for multi-workspace support |
| type | text | block type |
| shape_kind | text | nullable, only for shape type |
| x, y, width, height | float | position and size |
| content | text | nullable |
| style | jsonb | BlockStyle object |
| points | jsonb | nullable, array of [x,y] pairs |
| parent_id | text | nullable, for section children |
| z_index | int | layer order |
| group_id | text | nullable, for grouped elements |
| updated_at | timestamptz | for sync conflict resolution |

---

## Components

### Modified

| File | Changes |
|---|---|
| `CanvasPage.tsx` | Full rewrite — fix all pointer event bugs, add multi-select drag box, rubber-band selection, undo/redo integration, snap integration, live cursor rendering |
| `CanvasBlock.tsx` | Fix drag/resize pointer event bugs, wire `style` prop (fill, stroke, opacity, radius), fix z-index management |
| `CanvasToolbar.tsx` | Replace with Framer-style top-center tool pill groups |
| `CanvasConnections.tsx` | Bug fixes for path routing and connection point detection |
| `LayersPanel.tsx` | Rewrite as `CanvasLayersPanel.tsx` with new Framer-style sidebar (tabs, hover visibility toggle, indented tree) |

### New

| File | Purpose |
|---|---|
| `CanvasShapeLayer.tsx` | SVG overlay rendering all `shape` type blocks. Handles click-drag creation per tool. |
| `CanvasStylePanel.tsx` | Right panel: alignment bar, size/position inputs, fill section, border section, options section |
| `useCanvasHistory.ts` | Undo/redo hook — history stack of block snapshots, Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z |
| `useCanvasSnap.ts` | Snap-to-grid (20px grid) + snap-to-object edges while dragging/resizing |
| `useCanvasMultiSelect.ts` | Rubber-band drag selection — tracks pointer drag on empty canvas, computes intersecting blocks |
| `canvasSync.ts` | Supabase upsert/delete for canvas blocks + realtime subscription setup |
| `canvasExport.ts` | PNG export via `html-to-image`, SVG export via serializing the shape SVG layer + DOM snapshot |
| `canvasShare.ts` | Generate public share URL from entity ID, toggle entity visibility |
| `supabase/migrations/20260506_canvas_blocks.sql` | Migration creating `canvas_blocks` table with RLS policies |

---

## Feature Scope

### Phase 1 — Bug fixes + UI overhaul
- Fix broken drag, resize, connect, select interactions in existing canvas
- Rebuild toolbar (Framer-style top pill groups with keyboard shortcut labels)
- Rebuild layers sidebar (Framer-style: tabs, tree, hover visibility)
- Add right style panel (alignment, size/position, fill, border, options)
- Undo/redo (Ctrl+Z / Ctrl+Y)
- Multi-select with rubber-band drag box
- Snap to grid (20px), toggle via bottom bar button
- Delete key removes selected block(s)
- Escape deselects / cancels active tool

### Phase 2 — Shape tools
- SVG shape layer rendering: rect, ellipse, diamond, line, arrow, freedraw
- Click-drag creation for all shape types
- Freedraw uses pointer pressure for stroke width variation on touch devices; fixed stroke width on mouse (pressure fallback)
- Style panel fully wired to shape properties (fill, stroke, opacity, radius, stroke style)
- Grouping: Ctrl+G to group selection, Ctrl+Shift+G to ungroup
- Lock: prevents move/resize, shown in layers panel with icon
- Z-order: bring up / send down from style panel arrange section
- Shift+click / Shift+drag adds to selection

### Phase 3 — Cloud sync + collaboration
- `canvas_blocks` Supabase table + RLS policies
- `canvasSync.ts`: upsert on every block change, debounced 300ms
- Realtime block subscriptions — other users' changes appear live
- Live cursors: broadcast `pointermove` on Supabase presence channel, render colored cursor + name labels
- Export PNG: `html-to-image` capturing the canvas viewport
- Export SVG: serialize shape layer + text blocks to clean SVG
- Share link: toggle entity to public, copy URL to clipboard
- Copy canvas as image to clipboard (Clipboard API)
- Paste image from clipboard onto canvas

---

## Keyboard Shortcuts

| Key | Action |
|---|---|
| V / Escape | Select tool / deselect |
| H | Pan tool |
| R | Rectangle |
| O | Ellipse |
| D | Diamond |
| A | Arrow |
| L | Line |
| P | Freedraw |
| T | Text |
| I | Image |
| C | Comment |
| F | Section frame |
| Ctrl+Z | Undo |
| Ctrl+Y / Ctrl+Shift+Z | Redo |
| Ctrl+G | Group selection |
| Ctrl+Shift+G | Ungroup |
| Delete / Backspace | Delete selected |
| Ctrl+C / Ctrl+V | Copy / paste |
| Shift+click | Add to selection |
| Space+drag | Pan (any tool) |
| Ctrl+scroll | Zoom |

---

## Out of Scope

- Hand-drawn / sketch aesthetic (Rough.js)
- Comments threading / reactions
- Version history / time travel
- Mobile touch support
- Offline mode / local-first CRDT
