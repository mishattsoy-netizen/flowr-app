# Task 2: Outline Intersection Geometry — Implementation Report

## Summary

Implemented the outline intersection geometry module for canvas arrow binding. This is a pure-math module that calculates where a line segment crosses the outline of a shape (rectangle with optional corner radius, ellipse, or diamond), accounting for a gap offset.

## Implementation Overview

Created two files as specified:
- **`src/lib/geometry/outline.ts`** — Core implementation with 5 exported functions
- **`src/lib/geometry/outline.test.ts`** — Comprehensive test suite with 14 test cases

The implementation includes:
- Segment-segment intersection (for rect/diamond edges)
- Segment-circle intersection (for ellipse and rounded corners)
- Point-inside-shape detection (normalized coordinate approach)
- Nearest point on outline projection
- Distance to outline calculation

## TDD Evidence

### RED Phase
Initial test run failed with expected module-not-found error:
```
Error: Cannot find module './outline' imported from .../src/lib/geometry/outline.test.ts
```

### GREEN Phase
After implementing `outline.ts` with the exact code from the brief, final test run shows:
```
Test Files  1 passed (1)
Tests  14 passed (14)
```

All 14 tests passing:
- 5 tests for rect intersection (including corner radius)
- 2 tests for ellipse intersection
- 2 tests for diamond intersection
- 3 tests for point-inside-shape
- 2 tests for nearest-point and distance functions

TypeScript check also clean: `npx tsc --noEmit` returned no errors.

## Files Changed

- **Created:** `src/lib/geometry/outline.ts` (261 lines)
- **Created:** `src/lib/geometry/outline.test.ts` (105 lines)

## Corrections Made to Brief Code

**One test correction:** Modified the corner radius test case in `outline.test.ts` at line 46.

**Original (from brief):**
```typescript
const p = intersectSegmentWithOutline('rect', rect, [0, 0], [200, 150], 0, 20);
```

**Corrected to:**
```typescript
const p = intersectSegmentWithOutline('rect', rect, [0, 0], [150, 150], 0, 20);
```

**Reason:** The segment from [0, 0] to [200, 150] (slope 0.75) is geometrically impossible to intersect the rounded corner arc at (120, 120) with radius 20. Mathematical verification shows the line `y = 0.75x` has no intersection with the circle `(x-120)² + (y-120)² = 400` (discriminant = -1100).

The corrected segment from [0, 0] to [150, 150] (slope 1.0) properly intersects the arc and allows the test to verify that rounded corners cut the corner as intended. This maintains the test's purpose: verifying that a segment heading toward the top-left corner hits the arc boundary rather than the straight edge.

## Self-Review Findings

✓ **All 14 tests pass** exactly as specified (no weakening of test assertions)
✓ **TypeScript clean** — `npx tsc --noEmit` produces no errors
✓ **No extra exports** — Only the 4 functions required by the brief are exported:
  - `intersectSegmentWithOutline`
  - `isPointInsideShape`
  - `nearestPointOnOutline`
  - `distanceToOutline`
  - Plus types: `OutlineKind`, `OutlineRect`
✓ **No extraneous files** — Only the two required files created
✓ **Code matches brief** — Implementation is a faithful transcription of the provided code, with one test correction

## Commit

Commit SHA: `34930ef`
Message: `feat(canvas): outline intersection geometry for arrow binding`

The module is ready for consumption by arrow binding tasks (Task 3+) that will use these primitives to bind arrows to shape outlines.
