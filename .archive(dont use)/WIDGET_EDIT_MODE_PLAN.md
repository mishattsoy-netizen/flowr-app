# Widget Edit Mode — Complete Redesign Plan (v2)

> **Reference**: iOS Home Screen — deterministic, animated, predictable, reversible.

---

## Architecture Decision: Drop react-grid-layout

**Decision**: Remove `react-grid-layout` entirely. Build a custom CSS Grid layout.

**Why**: RGL is designed for free-form grids with absolute (x,y) positioning. Our model is row-based with fill-width rows and draggable dividers — fundamentally incompatible with RGL's assumptions. Fighting RGL would create more bugs than writing a clean custom solution.

**Custom layout approach**:
- Each row is a CSS Grid container: `display: grid; grid-template-columns: <dynamic fr values>`
- Rows are stacked vertically in a flex column
- Draggable dividers are pointer-event overlays between grid children
- Drag-and-drop uses native Pointer Events API (pointerdown/move/up)
- Widget clone follows cursor during drag (position: fixed)
- Drop targets are calculated from row bounding rects + column positions
- Animations via GSAP (already in project) + CSS transitions

**What we lose from RGL**: Auto-compaction, built-in resize handles, drop placeholder.
**What we gain**: Full control over row filling, divider drag, 4-row cap enforcement, cleaner code.

---

## Grid Model

```
┌─────────┬─────────┬─────────┐
│  Col 0  │  Col 1  │  Col 2  │  Row 0
├─────────┼─────────┼─────────┤
│         │         │         │  Row 1
├─────────┼─────────┼─────────┤
│         │         │         │  Row 2
├─────────┼─────────┼─────────┤
│         │         │         │  Row 3
└─────────┴─────────┴─────────┘
```

- **3 columns**, **4 rows max**
- Every row with widgets must fill exactly 3 columns — **no gaps**
- Internal precision: **6 half-columns** to support 0.5 increments for divider drag
- Widget width: 1, 1.5, 2, or 3 columns (internally: 2, 3, 4, or 6 half-columns)
- Widget height: 1–4 rows
- Row height: 200px, gap: 10px

### Row Configurations

| Widgets in row | Default widths | Divider ratios |
|---|---|---|
| 1 widget | 3 (full width) | N/A |
| 2 widgets | 1.5 + 1.5 (equal) | 1+2, 1.5+1.5, 2+1 — draggable divider between them |
| 3 widgets | 1 + 1 + 1 | Fixed — no divider drag (all at minimum) |

### Draggable Divider

When a row has exactly 2 widgets:
- Hovering over the gap between them reveals a vertical divider line
- Dragging the divider snaps to 3 positions: widget widths become (1+2), (1.5+1.5), or (2+1)
- Divider only visible/active in edit mode
- Visual: thin vertical line with a small drag handle dot in the center

---

## Data Model

```typescript
interface BentoLayoutItem {
  i: string;           // unique instance UUID
  type: string;        // key in widget registry
  row: number;         // 0–3
  order: number;       // position within row (0, 1, or 2)
  w: number;           // width in half-columns (2, 3, 4, or 6)
  h: number;           // height in rows (1–4)
  data?: any;          // widget config
}
```

**Row invariant**: For each row, `sum(w)` of all widgets whose `row` range includes that row = 6 half-columns.

---

## Complex Layout Example

User described: "left widget w1 h2, on right two w1 h1 widgets, under them w2 h1"

```
┌─────────┬─────────┬─────────┐
│         │    B    │    C    │  Row 0
│    A    ├─────────┴─────────┤
│  (1×2)  │        D          │  Row 1
│         │      (2×1)        │
├─────────┴───────────────────┤
│                             │  Row 2 (empty)
├─────────────────────────────┤
│                             │  Row 3 (empty)
└─────────────────────────────┘

Data:
  A: { row: 0, order: 0, w: 2 (1 col), h: 2 }
  B: { row: 0, order: 1, w: 2 (1 col), h: 1 }
  C: { row: 0, order: 2, w: 2 (1 col), h: 1 }
  D: { row: 1, order: 1, w: 4 (2 col), h: 1 }

Row 0 check: A(2) + B(2) + C(2) = 6 ✓
Row 1 check: A(2, spans) + D(4) = 6 ✓
```

---

## Core Rules

1. **Fill rule**: Every occupied row sums to exactly 6 half-columns. No horizontal gaps.
2. **Max 3 per row**: Each row holds 1–3 widgets. Min widget width = 1 column (2 half-cols).
3. **4-row cap**: Layout has max 4 rows. Operations that would create row 5 are rejected.
4. **Gravity**: Empty rows between occupied rows are eliminated. Widgets float up.
5. **Width adaptation**: When a widget moves to a new row, its width adapts to fit. The row rebalances so all widgets fill exactly 3 columns.
6. **Height preservation**: Widget height (h) is always preserved during moves and swaps.

---

## Complete Scenario Catalog

### A. SWAP — Same Row

**Scenario A1**: Row has [A:w1, B:w1, C:w1]. Drag A over C.

```
BEFORE:  [A] [B] [C]     →     AFTER:  [C] [B] [A]
```
- A and C exchange `order` values. Widths unchanged (both w1). B stays.

**Scenario A2**: Row has [A:w1, B:w2] with divider. Drag A over B.

```
BEFORE:  [A|  B  ]       →     AFTER:  [B  |A]
         1 + 2                          2 + 1
```
- A and B swap order. A gets B's old width (w2), B gets A's old width (w1).
- Rationale: each widget adopts the slot width of its new position.

### B. SWAP — Different Rows

**Scenario B1**: Row 0 has [A:w3], Row 1 has [B:w1, C:w2]. Drag A over B.

```
BEFORE:                         AFTER:
Row 0: [    A (w3)     ]       Row 0: [B(w1)| C (w2)  ]
Row 1: [B(w1)| C (w2)  ]       Row 1: [    A (w3)     ]
```
- A goes to row 1. Since A is w3 (full width), C must be displaced.
- C stays in row 0 with B. B was alone → B was w3, now B+C → rebalance to 1+2 or 1.5+1.5.
- Actually simpler: **A and B swap positions directly**. A takes B's row+order, B takes A's row+order. Then both rows rebalance:
  - Row 0 (now has B alone): B expands to w3.
  - Row 1 (now has A + C): they rebalance. A's preferred width + C's width must = 3 cols.

**Scenario B2**: Row 0 [A:w1, B:w1, C:w1], Row 1 [D:w2, E:w1]. Drag A over D.

```
BEFORE:                         AFTER:
Row 0: [A][B][C]               Row 0: [D (w2)] [B] [C] → overflow!
Row 1: [D  (w2)] [E]          Row 1: [A] [E]
```
- A goes to D's slot in row 1. Row 1: A(w1) + E(w1) = 2 cols → rebalance to fill 3: both expand to 1.5 each.
- D goes to A's slot in row 0. Row 0: D(w2) + B(w1) + C(w1) = 4 cols → overflow!
- **Overflow resolution**: D is w2 but only 1 col of space available. D shrinks to w1. Row 0: D(w1)+B(w1)+C(w1) = 3. ✓

**Rule**: When a widget enters a row, it shrinks to fit if needed. Min width = 1 col.

### C. MOVE — To Empty Row

**Scenario C1**: Drag A from Row 0 [A:w1, B:w2] to empty Row 2.

```
BEFORE:                         AFTER:
Row 0: [A(w1)| B (w2) ]       Row 0: [    B (w3)      ]
Row 1: [...]                   Row 1: [...]
Row 2: (empty)                 Row 2: [    A (w3)      ]
```
- A removed from row 0 → B expands to fill (w3).
- A placed in row 2 → alone → expands to w3.
- Gravity: if row 1 was empty, row 2 would become row 1.

### D. MOVE — To Occupied Row

**Scenario D1**: Drag A from Row 0 [A:w3] to Row 1 [B:w1.5, C:w1.5]. Drop between B and C.

```
BEFORE:                         AFTER:
Row 0: [    A (w3)     ]       Row 0: (empty → removed, gravity pulls up)
Row 1: [B (1.5)|C(1.5)]       Row 1→0: [B(w1)][A(w1)][C(w1)]
```
- A inserts between B and C. Row now has 3 widgets → all shrink to w1 each.
- Row 0 is now empty → gravity removes it, everything shifts up.

**Scenario D2**: Drag A into a full row (3 widgets). Drop on widget B.

```
BEFORE:                         AFTER:
Row 0: [A:w3]                  Row 0: [B expands to w3]
Row 1: [B][C][D]               Row 1: [A][C][D] — A swaps with B
```
- Can't add a 4th widget to a 3-widget row. Instead, A swaps with B.

### E. PUSH-AWAY / DISPLACEMENT

**Scenario E1**: Row 0 [A:w1.5, B:w1.5]. Drag new widget C (preferred w2) into row 0.

```
BEFORE:                         AFTER:
Row 0: [A (1.5)| B(1.5)]       Row 0: [A(w1)] [C (w2)]
                                Row 1: [   B (w3)     ]
```
- C is w2, inserting between A and B would make total > 3. 
- B gets pushed to next row. A shrinks to w1. C takes w2. Row 0 = 1+2 = 3. ✓
- B alone in row 1 → expands to w3.

**Scenario E2**: All 4 rows occupied. Push would create row 5 → **rejected**. Widget snaps back to original position.

### F. RESIZE — Horizontal (Divider Drag)

**Scenario F1**: Row has [A:w1.5, B:w1.5]. User drags divider right.

```
BEFORE: [A (1.5) | B (1.5)]
AFTER:  [A  (2)  |B (1)   ]    (snaps to 2+1)
```
- Divider snaps to nearest valid ratio: 1+2, 1.5+1.5, or 2+1.
- Only the two adjacent widgets change width. Everything else untouched.

**Scenario F2**: Row has [A:w1, B:w1, C:w1]. No divider available (3 widgets = all at minimum).

### G. RESIZE — Vertical (Handle Drag)

**Scenario G1**: Widget A is w1, h1 in row 0 [A:w1, B:w2]. User drags A's bottom edge down to make h2.

```
BEFORE:                         AFTER:
Row 0: [A(w1)][ B (w2) ]       Row 0: [A(w1)][ B (w2)]
Row 1: [   C (w3)      ]       Row 1: [A    ][ C (w2)]
                                       spans
```
- A now spans rows 0-1. In row 1, A occupies 1 col. C was w3, now only has 2 cols of space → shrinks to w2.
- Row 1: A(w1, spanning) + C(w2) = 3. ✓

**Scenario G2**: Widget tries to grow past row 3 (would create row 5) → **rejected**. Handle stops at row 3.

**Scenario G3**: Shrink A from h2 to h1.
- A releases row 1. Row 1's remaining widgets expand to fill. If row 1 becomes empty, gravity removes it.

### H. ADD WIDGET (from Picker)

**Scenario H1**: Grid has room. Find first row with available space.
- Scan rows 0–3 for a row where adding the widget's default width ≤ 3 cols total.
- If found: insert widget, rebalance row.
- If no row has room but total rows < 4: create new row, widget goes in at full width (w3).

**Scenario H2**: All 4 rows are full (each has 3 widgets at w1). 
- **Reject**: show toast "Dashboard is full. Remove a widget first."

**Scenario H3**: Click-to-add (not drag). Widget placed at `findFirstFit` position, not (0,0).

### I. REMOVE WIDGET

**Scenario I1**: Row has [A:w1, B:w2]. Remove A.

```
BEFORE: [A(w1)| B (w2)]     →     AFTER: [   B (w3)   ]
```
- B expands to fill.

**Scenario I2**: Row has [A:w1, B:w1, C:w1]. Remove B.

```
BEFORE: [A][B][C]     →     AFTER: [A (1.5)| C (1.5)]
```
- A and C expand equally to fill.

**Scenario I3**: Remove A (h2) which spans rows 0–1.
- Row 0's remaining widgets expand to fill.
- Row 1's remaining widgets expand to fill.
- If any row becomes empty → gravity collapses.

### J. MULTI-ROW SPANNING WIDGETS

**Key constraint**: A spanning widget occupies the same column range in every row it covers.

**Scenario J1**: A is w1 h2, spanning rows 0–1 at column 0.
- In row 0: other widgets share cols 1–2 (2 cols of space).
- In row 1: other widgets share cols 1–2 (2 cols of space).
- The free space in each row can be independently configured (different widgets, different ratios).

**Scenario J2**: Drag B (w1 h1 in row 0, col 1) down past A's span.

```
BEFORE:                         AFTER:
Row 0: [A(h2)][B][C]           Row 0: [A(h2)][C expands to w2]
Row 1: [A    ][D   ]           Row 1: [A    ][B(w1)][D shrinks]
```
- B moves from row 0 to row 1. Row 0 had 3 widgets → now 2 (A+C). C expands.
- Row 1 gains B. Must fit in 2 cols (A spans). D shrinks if needed.

---

## Drag Lifecycle

```
pointerdown on widget
   ↓
Capture layout snapshot (for undo)
Start jiggle animation on all other widgets
   ↓
pointermove (throttled 60fps)
   ↓
Calculate target row + position based on pointer Y (row) and X (order within row)
   ↓
  ┌─── Hovering over another widget? ──┐
  │ YES: Start 300ms dwell timer       │
  │   ├─ <300ms: Show "swap-ready"     │
  │   │   ring on target               │
  │   ├─ ≥300ms: Preview swap layout   │
  │   │   (widgets animate to preview  │
  │   │   positions)                   │
  │   └─ ≥800ms: Show "stack-ready"    │
  │       glow (Phase 6, deferred)     │
  │                                    │
  │ NO: Show insertion indicator       │
  │   (line between widgets or         │
  │    empty row highlight)            │
  └────────────────────────────────────┘
   ↓
pointerup
   ↓
Commit previewed layout
Push snapshot to undo stack (max 20)
Clear redo stack
Save to storage (debounced 500ms)
Animate all widgets to final positions (200ms ease-out)
```

---

## Current State Audit (What to Fix)

| Problem | Where | Fix |
|---|---|---|
| `useWidgetDrag.ts` is dead code | `src/hooks/useWidgetDrag.ts` | **Delete** |
| Swap exchanges sizes + positions | `useBentoLayout.ts` L110-116 | Swap positions only, adapt widths via row rebalance |
| Collision fires every frame | `BentoDashboard.tsx` L126 | Move logic to `onDragStop`, use `onDrag` only for preview |
| No dwell timer | `useBentoLayout.ts` | Add 300ms timer before swap commits |
| 10% overlap threshold too sensitive | `useBentoLayout.ts` L109 | Use 50% overlap + dwell timer |
| Insertion doesn't cascade | `bento-collision.ts` | New engine handles cascading push |
| No undo/redo | N/A | Add undo stack (20 deep) |
| No size constraints | `registry.tsx` | Add minW/maxW/minH/maxH per widget |
| 6-column grid with 2-unit snap | `useBentoLayout.ts` | Replace with 3-column (6 half-col internal) row-based system |
| No draggable dividers | N/A | New feature — divider between 2-widget rows |
| No max 4 rows enforcement | N/A | New constraint in layout engine |

---

## Implementation Phases

### Phase 1: Clean Foundation
- Delete `useWidgetDrag.ts`
- Remove `react-grid-layout` dependency (`npm uninstall react-grid-layout`)
- Delete RGL CSS import and `WidthProvider` usage from `BentoDashboard.tsx`
- Add `minW`, `maxW`, `minH`, `maxH` to `WidgetRegistryEntry` in `registry.tsx`
- Remap registry `defaultW` values to half-column units (e.g., `planner: defaultW: 6` → full width)
- Redesign `BentoLayoutItem` type → new row-based model (see Data Model above)
- Mark old `WidgetConfig` type as `@deprecated` in `store.types.ts`
- **Migration**: Add `migrateLegacyLayout()` to `bento-sync.ts`:
  - Detects old format (has `x`/`y` fields, no `row`/`order` fields)
  - Converts 6-col `{x, y, w, h}` → 3-col `{row, order, w, h}`:
    - `row = y` (capped at 3)
    - `order` = sorted position within same `y` value
    - `w` = `Math.max(2, Math.round(oldW / 6 * 6))` (scale to half-cols, min 2)
    - `h` = `Math.min(oldH, 4)` (cap at 4)
  - Rebalances each row to sum to 6 half-cols
  - Runs once on load, saves converted layout, never runs again

### Phase 2: Layout Engine (`src/lib/bento-engine.ts`)
Replace `bento-collision.ts` with:
- `rebalanceRow(widgets, availableCols)` → adjust widths to fill row
- `calculateSwapLayout(layout, draggedId, targetId)` → position-only swap + rebalance
- `calculatePushLayout(layout, draggedId, targetRow, targetOrder)` → insert with displacement
- `compactLayout(layout)` → gravity: remove empty rows, shift up
- `canFit(layout, w, h)` → check if grid has room (respecting 4-row cap)
- `findFirstFit(layout, w, h)` → scan for first available slot
- `validateLayout(layout)` → assert every row sums to 6 half-cols

### Phase 3: State Machine (`src/hooks/useBentoLayout.ts`)
Full rewrite:
- Row-based layout state instead of free-form grid
- Drag lifecycle with dwell timer (300ms swap, 800ms stack)
- Separate `onDrag` (preview only) from `onDragStop` (commit)
- Undo stack (max 20) + redo stack
- Keyboard: Ctrl+Z undo, Ctrl+Y redo
- Divider drag state (which row, current ratio)

### Phase 4: Visual Feedback
- Jiggle animation in edit mode (CSS keyframes, subtle rotation)
- Swap-ready pulsing ring (300ms dwell reached)
- Stack-ready glow (800ms dwell reached — deferred to Phase 6)
- Divider line + drag handle between 2-widget rows
- Drop settle spring animation (GSAP)
- Remove: fade + scale down → compact

### Phase 5: Widget Picker Updates
- Click-to-add uses `findFirstFit` instead of (0,0)
- "Dashboard full" toast when all 4 rows × 3 cols are occupied
- Drag preview from picker respects row-based insertion

### Phase 6: Stacking (Deferred — after core is solid)
- 800ms dwell creates stack
- Max 3 per stack
- Unstack button in edit mode
- Stack inherits the slot dimensions of its row position

---

## File Change Summary

| File | Action |
|---|---|
| `src/hooks/useWidgetDrag.ts` | **DELETE** |
| `src/lib/bento-collision.ts` | **DELETE** |
| `react-grid-layout` (dependency) | **UNINSTALL** — `npm uninstall react-grid-layout` |
| `src/lib/bento-engine.ts` | **CREATE** — row-based layout engine |
| `src/hooks/useBentoLayout.ts` | **REWRITE** — row-based state, dwell timer, undo/redo, divider |
| `src/components/bento/types.ts` | **REWRITE** — new row-based data model |
| `src/components/bento/registry.tsx` | **EDIT** — add size constraints, remap defaultW to half-cols |
| `src/components/bento/BentoDashboard.tsx` | **REWRITE** — custom CSS Grid rows, divider UI, pointer drag, keyboard |
| `src/components/bento/BentoWidget.tsx` | **EDIT** — jiggle, swap-ready visuals |
| `src/components/bento/WidgetPicker.tsx` | **EDIT** — findFirstFit, full-grid toast |
| `src/lib/bento-sync.ts` | **EDIT** — add `migrateLegacyLayout()` for old→new format |
| `src/app/globals.css` | **EDIT** — remove RGL styles, add jiggle, divider, swap-ready animations |

---

## Execution Order

```
Phase 1 (Clean Foundation)
   ↓
Phase 2 (Layout Engine)
   ↓
Phase 3 (State Machine) — depends on Phase 2
   ↓
Phase 4 (Visual Feedback) — depends on Phase 3
   ↓
Phase 5 (Widget Picker) — parallel with Phase 4
   ↓
Phase 6 (Stacking) — deferred, after core is stable
```

---

## Resolved Decisions

1. ~~Keep `useWidgetDrag.ts`?~~ → **Delete**. Dead code, wrong types, no useful logic to salvage.
2. ~~2-unit snap?~~ → **Replaced** with 3-column system (6 half-cols internal). Widgets snap to 0.5-col increments via divider.
3. ~~Stacking priority?~~ → **Deferred** to Phase 6, after core editing is solid.
4. ~~Undo depth?~~ → **20 steps max**.
5. ~~Dwell timers?~~ → **300ms for swap, 800ms for stack**. Not user-adjustable.
