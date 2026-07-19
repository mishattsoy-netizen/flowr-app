# Bento Dashboard — Edit Mode Design Spec
**Date:** 2026-04-20

## Overview

A global widget Edit Mode system for the main dashboard and all workspaces. Users can rearrange, resize, add, and remove widgets on any surface. Layouts are persisted per user per context in Supabase.

---

## Architecture

Three new pieces are introduced. All existing widgets remain unchanged.

### `BentoDashboard` component
Wraps `react-grid-layout`. Renders the widget grid for a given surface. Accepts a `contextId` (e.g. `"dashboard"` or a workspace UUID) so each surface has its own independent layout. Passes `isDraggable` and `isResizable` based on Edit Mode state.

### `useBentoLayout` hook
Owns layout state for a given `contextId`. Loads from Supabase on mount. Writes back on `onLayoutChange` (debounced 800ms). Exposes `editMode` boolean and `toggleEditMode` function. Handles widget add/remove.

### Widget registry
A plain object `{ type → { label, component, defaultW, defaultH } }` listing every available widget. Adding a new widget means one entry here. The picker and the renderer both read from this registry.

---

## Data Model

### Supabase table: `bento_layouts`

| column | type | notes |
|---|---|---|
| id | uuid | primary key |
| user_id | uuid | foreign key → auth.users |
| context_id | text | `"dashboard"` or workspace UUID |
| layout | jsonb | array of layout items (see below) |
| updated_at | timestamptz | auto-updated |

Unique constraint on `(user_id, context_id)` — one row per user per context, upserted on save.

### Layout item shape

```json
{
  "i": "uuid-v4",
  "type": "habit-grid",
  "x": 0,
  "y": 0,
  "w": 2,
  "h": 3
}
```

- `i` — unique instance UUID (allows duplicate widget types on the same page)
- `type` — maps to the widget registry key
- `x/y` — grid column/row position (0-indexed)
- `w/h` — column span and row span

### Grid config
- **Columns:** 3
- **Row height:** 120px
- **Gap:** 8px
- **Widget min size:** 1×1
- **Widget max size:** 3×4

### Default layouts
Each context (dashboard, workspace) defines a fallback layout in code used when no Supabase row exists for the user yet.

---

## Edit Mode UX

### Toggle
An **"Edit Layout"** button lives in the top-right of each dashboard/workspace header. Edit Mode is scoped to one context — toggling it on one surface does not affect others.

When Edit Mode is ON, the button is replaced by a **"Done"** button.

### Edit Mode ON state
- Subtle animated border on the grid container signals edit state
- Every widget surface is draggable (`cursor: grab` on hover, `cursor: grabbing` while dragging)
- No grip icon — the entire widget is the drag target
- Each widget shows a **remove button** (×) in the top-right corner
- Widgets are resizable via `react-grid-layout` resize handles
- A **"+ Add Widget"** button appears, opening the widget picker panel

### Edit Mode OFF state
- Drag handles, remove buttons, and resize handles are hidden
- Layout is fully locked — `isDraggable={false}`, `isResizable={false}`

---

## Widget Picker Panel

A slide-in panel from the right side of the screen, visible only in Edit Mode.

- Lists all registered widget types with name and default size
- **Drag-to-place:** Widget cards in the picker use native HTML5 drag events (`draggable`, `onDragStart`). `react-grid-layout` exposes a `droppingItem` prop and `onDrop` callback specifically for receiving external drops — the picker sets `droppingItem` to the widget's default `w/h` while dragging, and `onDrop` creates the new instance at the grid drop position. No `@dnd-kit` needed for this interaction.
- **Click-to-add:** Clicking a widget card appends it at the bottom of the current layout at its default size.
- Multiple instances of the same widget type are allowed. Each gets a new UUID.

---

## Animations

### Widget repositioning
Handled natively by `react-grid-layout` CSS transitions during drag.

### Exit Edit Mode
When the user clicks "Done", any widget that changed position plays a brief settle animation via GSAP: `scale 1.02 → 1` over 150ms. Communicates that the layout is now locked.

### Widget added from picker
New widgets fade in with a scale-up: `opacity 0→1`, `scale 0.9→1` over 200ms via GSAP.

---

## Supabase Sync

- Layout loads on `useBentoLayout` mount via `select` on `bento_layouts` where `user_id` + `context_id` match.
- `onLayoutChange` (fired by `react-grid-layout` after drag/resize) debounced 800ms → upsert to Supabase.
- **Optimistic updates:** local state updates immediately; Supabase write is fire-and-forget.
- **Error handling:** if upsert fails, show a brief toast error. Local state is preserved — no rollback.

---

## Dependencies

| package | status | use |
|---|---|---|
| `react-grid-layout` | **new** | grid drag/resize/snap engine |
| `@dnd-kit/core` | existing | other drag interactions in the app (not used for picker) |
| `gsap` | existing | settle + entrance animations |
| `zustand` | existing | edit mode state |
| `@supabase/supabase-js` | existing | layout persistence |

---

## Out of Scope

- Responsive breakpoints (mobile layout) — fixed 3-col only
- Undo/redo for layout changes
- Sharing layouts between users
- Per-widget settings/configuration UI
