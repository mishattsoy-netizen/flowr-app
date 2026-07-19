---
title: Widget Min/Max Size Constraints + Layout Overlap Fix
date: 2026-04-28
status: approved
---

## Problem

Non-clock widgets have `minH: 1`, which allows them to be squished to a single row. Combined with `fillGaps` expanding widgets into available vertical space and percentage-based grid rendering, this produces visual overlaps when layouts contain tall spanners alongside short widgets (e.g., the default dashboard layout where Clock occupies only 1 row while Shortcuts spans 3).

## Goals

1. Enforce `minH: 2` and `maxW: 4` for all non-clock widgets in the registry.
2. Fix default layouts so no non-clock widget starts with `h < 2`.
3. Migrate existing saved layouts to clamp widget dimensions to new registry bounds.

## Non-Goals

- No changes to the bento engine (`bento-engine.ts`) logic.
- Clock widget constraints remain unchanged: `minW: 2, minH: 1, maxW: 4, maxH: 2`.
- No changes to the grid model (6 half-cols, 4 rows, MAX_PER_ROW=3).

---

## Design

### 1. Registry changes (`src/components/bento/registry.tsx`)

Update every non-clock entry:

| Widget | minW | minH | maxW | maxH |
|---|---|---|---|---|
| timer | 2 | 2 | 4 | 4 |
| all-files | 2 | 2 | 4 | 4 |
| tasks | 2 | 2 | 4 | 4 |
| quick-links | 2 | 2 | 4 | 4 |
| smart-tasks | 2 | 2 | 4 | 4 |
| stacked-widgets | 2 | 2 | 4 | 4 |
| shortcuts | 2 | 2 | 4 | 4 |
| recent | 2 | 2 | 4 | 4 |

Clock stays: `minW: 2, minH: 1, maxW: 4, maxH: 2`.

**Why maxW: 4?** Prevents any non-clock widget from going full-width (w=6), keeping space for at least one companion widget.

### 2. Default layout fixes (`src/hooks/useBentoLayout.ts`)

The `dashboard` default layout has `clock` at `h: 1`, which leaves a 1-row gap that triggers spanner/fillGaps confusion. The fix: keep clock at h=1 (it's the only widget allowed to be that short) but ensure all other widgets in the same default layout start at `h ≥ 2`.

**Dashboard default** — already valid after registry change (clock is the only h=1 widget):
```
row 0: clock(2w,1h)  smart-tasks(4w,2h)
row 1: shortcuts(2w,3h) [spans 1-3]
row 2: recent(2w,2h)  all-files(2w,2h)
```

**Workspace default** — must be updated. Current values violate new constraints:
- `shortcuts`: `w:6, h:1` → violates maxW:4 and minH:2
- Fix: `shortcuts: w:4, h:2`; add a companion widget or leave as single-widget row rebalanced to full width. Since shortcuts is the only widget in row 1, rebalanceAll will expand it to fill the row — but maxW:4 would cap it. **Resolution**: change shortcuts in workspace default to `w:4, h:2` and pair it with a second widget, OR accept that a single widget in a row always gets w=6 via `rebalanceRow` (which overrides maxW for single-item rows: `if (n === 1) return [{ ...items[0], w: total }]`).

The `rebalanceRow` single-item shortcut (`n === 1 → w: total`) bypasses maxW. This is intentional — a lone widget must fill its row. The maxW constraint only applies when there are neighbors to share space with. This is correct behavior and requires no change.

### 3. Saved layout migration (`src/hooks/useBentoLayout.ts`)

In the `loadBentoLayout` effect, the existing code already calls `recoverLayout` as a fallback. `recoverLayout` clamps each widget's `w` and `h` to its registry `minW/maxW/minH/maxH`.

**Change**: promote `recoverLayout` from fallback-only to always-run first pass. After loading saved items, run `recoverLayout` unconditionally before `validateLayout`. If `recoverLayout` returns a valid layout, use it (even if the original was already valid — the clamp is idempotent for valid layouts).

```ts
// In loadBentoLayout effect, replace:
const balanced = compactLayout(rebalanceAll(items));
if (validateLayout(balanced).valid) {
  setLayout(balanced);
} else {
  const recovered = recoverLayout(items);
  ...
}

// With:
const recovered = recoverLayout(items) ?? compactLayout(rebalanceAll(items));
if (validateLayout(recovered).valid) {
  setLayout(recovered);
} else {
  // fallback to defaults (existing logic)
}
```

`recoverLayout` already does: clamp w/h to registry bounds → `compactLayout(rebalanceAll(...))` → `validateLayout`. So this is safe and idempotent.

---

## Invariants Preserved

- Row invariant (sum of w per row = 6) — maintained by `rebalanceAll` inside `recoverLayout`.
- No engine logic changes — all min/max enforcement flows through existing registry reads.
- `validateLayout` already rejects layouts where any widget violates `minW/minH/maxW/maxH`.
- `resizeDivider`, `rebalanceRow`, `fillGaps`, `ruleInsertDisplace` etc. all read from registry — they will automatically respect new bounds after registry update.

---

## Files Changed

| File | Change |
|---|---|
| `src/components/bento/registry.tsx` | Update minH → 2, maxW → 4 for all non-clock widgets |
| `src/hooks/useBentoLayout.ts` | Fix workspace default (shortcuts h:1→2), promote `recoverLayout` to first-pass in load effect |

---

## Testing

1. Open dashboard with existing saved layout — verify widgets clamp to new bounds, no overlaps.
2. In edit mode, drag dividers — verify no widget can be shrunk below h=2 or expanded beyond w=4.
3. Add a new widget from WidgetPicker — verify it starts at h≥2.
4. Reset layout — verify default layout renders without overlap.
5. Verify clock can still be h=1 and w=2–4.
