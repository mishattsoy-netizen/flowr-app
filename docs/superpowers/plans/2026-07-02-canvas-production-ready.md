# Canvas Production-Ready Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the canvas production-ready: Excalidraw-grade arrow binding (3 modes), transparent auto-sizing text + labels in shapes/on arrows, frames→sections, comments removed, eraser, curved-arrow toggle, interaction polish, `.flowr` file format, and a CanvasPage split.

**Architecture:** Rework in place on the existing React/SVG canvas + Zustand store. New geometry module for outline intersection (adapted from Excalidraw's MIT algorithms), rewritten binding resolution on top of existing `focus`/`fixedPoint`/`gap` primitives, Excalidraw-schema serializer for `.flowr` vault files replacing the legacy `.canvas` JSON.

**Tech Stack:** Next.js/React 18, TypeScript, Zustand, SVG, vitest, Supabase (`canvasSync.ts`), Electron file vault (`fileVault.ts`/`vaultSyncBridge.ts`).

**Spec:** `docs/superpowers/specs/2026-07-02-canvas-production-ready-design.md`

## Global Constraints

- No new npm dependencies.
- No data migration code — legacy paths are deleted, not migrated (spec: "no production users with canvas data").
- All colors/spacing use existing CSS variables (`--bone-*`, `--accent`, `--brand-blue`, `--app-dark`, `--radius-*`); no hardcoded hex except in serializer defaults.
- Tests: `npx vitest run <file>` (vitest v4, config already in repo). Full suite: `npm test`.
- Typecheck after every task: `npx tsc --noEmit`.
- Binding gap default: **4** canvas px. Edge-proximity binding threshold: **12** canvas px.
- File extension: `.flowr`; file content `type` field: `"excalidraw"`, `source: "flowr"`, extra top-level key `flowr`.
- Commit after every task (small commits within a task are fine). Commit messages end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- UI copy: the frame element is called **"Section"** everywhere users see it (toolbar tooltip, layers panel, style panel). Internal type stays `frame`.

---

### Task 1: Purge legacy — comments, connection type, legacy endpoints, auto-layout

Delete dead weight first so every later task works in a smaller codebase. No behavior added.

**Files:**
- Modify: `src/data/store.types.ts`
- Modify: `src/data/store.ts` (remove references; keep actions)
- Modify: `src/components/canvas/CanvasBlock.tsx`
- Modify: `src/components/canvas/CanvasPage.tsx`
- Modify: `src/components/canvas/CanvasToolbar.tsx`
- Modify: `src/components/canvas/CanvasConnections.tsx`
- Modify: `src/lib/geometry/resolvePoints.ts`
- Modify: `src/lib/canvasSync.ts` (drop removed columns/fields from payloads)
- Delete if present: auto-layout module (find via `grep -rn "computeAutoLayout" src`)

**Interfaces:**
- Consumes: nothing.
- Produces: `EditorBlock` without `fromId`/`toId`/`fromSide`/`toSide`/`autoLayout`/layout* fields; `BlockType` without `'comment' | 'connection'`; `resolvePoints(block, allBlocks)` handling bindings only; `CanvasTool` without `'comment'`.

- [ ] **Step 1: Remove types**

In `src/data/store.types.ts`:
- Remove `'comment'` and `'connection'` from `BlockType`.
- Remove from `EditorBlock`: `fromId`, `toId`, `fromSide`, `toSide`, `autoLayout`, `layoutDirection`, `layoutGap`, `layoutPaddingTop/Right/Bottom/Left`, `layoutAlign`, `layoutCrossAlign`, `frameResizingH/V`, `childResizingH/V`. Keep `clipContent` for now (Task 8 makes clipping unconditional and removes it).
- Remove `FrameLayoutDirection`, `FrameResizeMode`, `ChildResizeMode` type exports.
- Remove `fixedPointType` from `ArrowBinding` (unused by the new model; verify with `grep -rn "fixedPointType" src` and delete usages).

- [ ] **Step 2: Chase compile errors and delete dead code paths**

Run `npx tsc --noEmit` repeatedly; at every error, **delete** the legacy branch (do not stub):
- `CanvasBlock.tsx`: delete the `block.type === 'comment'` render branch (lines ~731–748), remove `'comment'` from the double-click gate (line ~526).
- `CanvasToolbar.tsx`: remove the `comment` entry from `CONTENT_TOOLS`, remove `'comment'` from `CanvasTool`, remove the now-unused `MessageSquarePlus` import. Rename the `frame` tool label to `Section` (keep shortcut `F`, keep `Frame` icon).
- `CanvasPage.tsx`: remove `'comment'` tool handling (creation on canvas click, shortcut `C` in the keyboard handler), remove any `type: 'connection'` creation/filter paths, remove `fromId/toId` checks (e.g. the `!(b.startBinding || b.endBinding || b.fromId || b.toId)` filter at ~line 1489 becomes `!(b.startBinding || b.endBinding)`), remove `computeAutoLayout` import and the auto-layout recompute block in `handleDragCommit` (lines ~194–213).
- `CanvasConnections.tsx`: filter becomes `b.type === 'shape' && (b.shapeKind === 'arrow' || b.shapeKind === 'line') && (b.startBinding || b.endBinding)`.
- `resolvePoints.ts`: delete `legacyEndpoint()` and the two `if (!start && block.fromId)` / `if (!end && block.toId)` lines.
- `VectorPath.tsx`: `const hasStart = !!(block.startBinding || block.fromId)` → `!!block.startBinding`.
- `canvasSync.ts`: remove removed fields from the upsert payload/row mapping if present.
- `Sidebar.tsx`, `useDrag.ts`: fix any references surfaced by tsc the same way (delete legacy handling).
- Run `grep -rn "computeAutoLayout\|'comment'\|\"comment\"\|fromSide\|toSide" src` — for each hit in canvas-related code, delete. (Ignore unrelated hits like editor note comments if any; check context.)

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` → 0 errors. Run: `npm test` → all existing tests pass (persistence tests etc.).
Run the app briefly if feasible (`npm run dev`) and open a canvas: shapes, arrows, select, undo still work; comment tool gone.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "refactor(canvas): remove comments, connection type, legacy endpoints, auto-layout"
```

---

### Task 2: Outline intersection geometry

Pure-math module: where does a segment aimed at a shape cross the shape's outline (rect with corner radius, ellipse, diamond), pushed back by `gap`.

**Files:**
- Create: `src/lib/geometry/outline.ts`
- Test: `src/lib/geometry/outline.test.ts`

**Interfaces:**
- Consumes: nothing (pure).
- Produces:
  - `type OutlineKind = 'rect' | 'ellipse' | 'diamond'`
  - `interface OutlineRect { x: number; y: number; width: number; height: number }`
  - `intersectSegmentWithOutline(kind: OutlineKind, rect: OutlineRect, from: [number,number], to: [number,number], gap?: number, cornerRadius?: number): [number,number] | null` — `from` outside, `to` inside/at target; returns crossing point offset `gap` px back toward `from`; `null` if no crossing.
  - `isPointInsideShape(kind: OutlineKind, rect: OutlineRect, p: [number,number]): boolean`
  - `nearestPointOnOutline(kind: OutlineKind, rect: OutlineRect, p: [number,number]): [number,number]`
  - `distanceToOutline(kind: OutlineKind, rect: OutlineRect, p: [number,number]): number`

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/geometry/outline.test.ts
import { describe, it, expect } from 'vitest';
import { intersectSegmentWithOutline, isPointInsideShape, nearestPointOnOutline, distanceToOutline } from './outline';

const rect = { x: 100, y: 100, width: 200, height: 100 }; // center (200,150)

describe('intersectSegmentWithOutline — rect', () => {
  it('hits the left edge coming from the left', () => {
    const p = intersectSegmentWithOutline('rect', rect, [0, 150], [200, 150]);
    expect(p).not.toBeNull();
    expect(p![0]).toBeCloseTo(100, 5);
    expect(p![1]).toBeCloseTo(150, 5);
  });
  it('applies gap back toward the source', () => {
    const p = intersectSegmentWithOutline('rect', rect, [0, 150], [200, 150], 4);
    expect(p![0]).toBeCloseTo(96, 5);
  });
  it('hits the top edge coming from above at an angle', () => {
    const p = intersectSegmentWithOutline('rect', rect, [200, 0], [200, 150]);
    expect(p![1]).toBeCloseTo(100, 5);
  });
  it('returns null when the segment misses the shape', () => {
    expect(intersectSegmentWithOutline('rect', rect, [0, 0], [50, 10])).toBeNull();
  });
  it('respects corner radius (cuts the corner)', () => {
    // Aim at the exact top-left corner: with r=20 the hit is on the arc, not at (100,100)
    const p = intersectSegmentWithOutline('rect', rect, [0, 0], [200, 150], 0, 20);
    const d = Math.hypot(p![0] - 120, p![1] - 120); // arc center (120,120), r=20
    expect(d).toBeCloseTo(20, 1);
  });
});

describe('intersectSegmentWithOutline — ellipse', () => {
  it('hits the ellipse boundary on the horizontal axis', () => {
    const p = intersectSegmentWithOutline('ellipse', rect, [0, 150], [200, 150]);
    expect(p![0]).toBeCloseTo(100, 4); // leftmost point of ellipse
    expect(p![1]).toBeCloseTo(150, 4);
  });
  it('boundary point satisfies the ellipse equation', () => {
    const p = intersectSegmentWithOutline('ellipse', rect, [0, 0], [200, 150])!;
    const nx = (p[0] - 200) / 100, ny = (p[1] - 150) / 50;
    expect(nx * nx + ny * ny).toBeCloseTo(1, 3);
  });
});

describe('intersectSegmentWithOutline — diamond', () => {
  it('hits the left vertex on the horizontal axis', () => {
    const p = intersectSegmentWithOutline('diamond', rect, [0, 150], [200, 150]);
    expect(p![0]).toBeCloseTo(100, 4);
    expect(p![1]).toBeCloseTo(150, 4);
  });
  it('hits the upper-left edge', () => {
    const p = intersectSegmentWithOutline('diamond', rect, [100, 100], [200, 150])!;
    // upper-left edge runs (100,150) → (200,100): x/ we expect p on that segment
    const t = (p[0] - 100) / 100;
    expect(p[1]).toBeCloseTo(150 - 50 * t, 3);
  });
});

describe('isPointInsideShape', () => {
  it('rect', () => {
    expect(isPointInsideShape('rect', rect, [150, 120])).toBe(true);
    expect(isPointInsideShape('rect', rect, [90, 120])).toBe(false);
  });
  it('ellipse excludes rect corners', () => {
    expect(isPointInsideShape('ellipse', rect, [105, 105])).toBe(false);
    expect(isPointInsideShape('ellipse', rect, [200, 150])).toBe(true);
  });
  it('diamond excludes rect corners', () => {
    expect(isPointInsideShape('diamond', rect, [110, 105])).toBe(false);
    expect(isPointInsideShape('diamond', rect, [200, 150])).toBe(true);
  });
});

describe('nearestPointOnOutline / distanceToOutline', () => {
  it('projects an outside point onto the rect edge', () => {
    expect(nearestPointOnOutline('rect', rect, [200, 90])).toEqual([200, 100]);
    expect(distanceToOutline('rect', rect, [200, 90])).toBeCloseTo(10, 5);
  });
  it('works for inside points too (distance to nearest edge)', () => {
    expect(distanceToOutline('rect', rect, [200, 110])).toBeCloseTo(10, 5);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/geometry/outline.test.ts`
Expected: FAIL — module `./outline` not found.

- [ ] **Step 3: Implement**

```ts
// src/lib/geometry/outline.ts
// Outline intersection for canvas binding. Approach adapted from Excalidraw (MIT).

export type OutlineKind = 'rect' | 'ellipse' | 'diamond';
export interface OutlineRect { x: number; y: number; width: number; height: number }
type Pt = [number, number];

function segSegIntersect(a1: Pt, a2: Pt, b1: Pt, b2: Pt): Pt | null {
  const d1x = a2[0] - a1[0], d1y = a2[1] - a1[1];
  const d2x = b2[0] - b1[0], d2y = b2[1] - b1[1];
  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-9) return null;
  const t = ((b1[0] - a1[0]) * d2y - (b1[1] - a1[1]) * d2x) / denom;
  const u = ((b1[0] - a1[0]) * d1y - (b1[1] - a1[1]) * d1x) / denom;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return [a1[0] + t * d1x, a1[1] + t * d1y];
}

function segCircleIntersections(a: Pt, b: Pt, c: Pt, r: number): Pt[] {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const fx = a[0] - c[0], fy = a[1] - c[1];
  const A = dx * dx + dy * dy;
  const B = 2 * (fx * dx + fy * dy);
  const C = fx * fx + fy * fy - r * r;
  const disc = B * B - 4 * A * C;
  if (disc < 0 || A < 1e-12) return [];
  const s = Math.sqrt(disc);
  const out: Pt[] = [];
  for (const t of [(-B - s) / (2 * A), (-B + s) / (2 * A)]) {
    if (t >= 0 && t <= 1) out.push([a[0] + t * dx, a[1] + t * dy]);
  }
  return out;
}

function diamondVertices(r: OutlineRect): Pt[] {
  const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
  return [[cx, r.y], [r.x + r.width, cy], [cx, r.y + r.height], [r.x, cy]];
}

function outlineSegments(kind: OutlineKind, r: OutlineRect): [Pt, Pt][] {
  if (kind === 'diamond') {
    const v = diamondVertices(r);
    return [[v[0], v[1]], [v[1], v[2]], [v[2], v[3]], [v[3], v[0]]];
  }
  // rect (ellipse handled analytically elsewhere)
  const tl: Pt = [r.x, r.y], tr: Pt = [r.x + r.width, r.y];
  const br: Pt = [r.x + r.width, r.y + r.height], bl: Pt = [r.x, r.y + r.height];
  return [[tl, tr], [tr, br], [br, bl], [bl, tl]];
}

export function isPointInsideShape(kind: OutlineKind, r: OutlineRect, p: Pt): boolean {
  const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
  const hw = r.width / 2, hh = r.height / 2;
  if (hw <= 0 || hh <= 0) return false;
  const nx = (p[0] - cx) / hw, ny = (p[1] - cy) / hh;
  switch (kind) {
    case 'rect': return Math.abs(nx) <= 1 && Math.abs(ny) <= 1;
    case 'ellipse': return nx * nx + ny * ny <= 1;
    case 'diamond': return Math.abs(nx) + Math.abs(ny) <= 1;
  }
}

export function intersectSegmentWithOutline(
  kind: OutlineKind, r: OutlineRect, from: Pt, to: Pt, gap = 0, cornerRadius = 0,
): Pt | null {
  let hits: Pt[] = [];
  if (kind === 'ellipse') {
    // Normalize ellipse to unit circle, intersect, map back.
    const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
    const a = r.width / 2, b = r.height / 2;
    if (a <= 0 || b <= 0) return null;
    const na: Pt = [(from[0] - cx) / a, (from[1] - cy) / b];
    const nb: Pt = [(to[0] - cx) / a, (to[1] - cy) / b];
    hits = segCircleIntersections(na, nb, [0, 0], 1).map(p => [p[0] * a + cx, p[1] * b + cy] as Pt);
  } else if (kind === 'rect' && cornerRadius > 0) {
    const rad = Math.min(cornerRadius, r.width / 2, r.height / 2);
    const x2 = r.x + r.width, y2 = r.y + r.height;
    const straight: [Pt, Pt][] = [
      [[r.x + rad, r.y], [x2 - rad, r.y]], [[x2, r.y + rad], [x2, y2 - rad]],
      [[x2 - rad, y2], [r.x + rad, y2]], [[r.x, y2 - rad], [r.x, r.y + rad]],
    ];
    for (const [s1, s2] of straight) {
      const h = segSegIntersect(from, to, s1, s2);
      if (h) hits.push(h);
    }
    const centers: Pt[] = [[r.x + rad, r.y + rad], [x2 - rad, r.y + rad], [x2 - rad, y2 - rad], [r.x + rad, y2 - rad]];
    for (const c of centers) {
      for (const h of segCircleIntersections(from, to, c, rad)) {
        // keep only hits on the actual quarter-arc (outside the straight-edge zone)
        const inCornerX = h[0] < r.x + rad || h[0] > x2 - rad;
        const inCornerY = h[1] < r.y + rad || h[1] > y2 - rad;
        if (inCornerX && inCornerY) hits.push(h);
      }
    }
  } else {
    for (const [s1, s2] of outlineSegments(kind, r)) {
      const h = segSegIntersect(from, to, s1, s2);
      if (h) hits.push(h);
    }
  }
  if (hits.length === 0) return null;
  // Closest hit to `from` = the entry point.
  hits.sort((p, q) => Math.hypot(p[0] - from[0], p[1] - from[1]) - Math.hypot(q[0] - from[0], q[1] - from[1]));
  const hit = hits[0];
  if (gap > 0) {
    const d = Math.hypot(hit[0] - from[0], hit[1] - from[1]);
    if (d > 1e-9) {
      const ux = (hit[0] - from[0]) / d, uy = (hit[1] - from[1]) / d;
      return [hit[0] - ux * gap, hit[1] - uy * gap];
    }
  }
  return hit;
}

function nearestOnSegment(p: Pt, a: Pt, b: Pt): Pt {
  const abx = b[0] - a[0], aby = b[1] - a[1];
  const len2 = abx * abx + aby * aby;
  if (len2 < 1e-12) return a;
  let t = ((p[0] - a[0]) * abx + (p[1] - a[1]) * aby) / len2;
  t = Math.max(0, Math.min(1, t));
  return [a[0] + t * abx, a[1] + t * aby];
}

export function nearestPointOnOutline(kind: OutlineKind, r: OutlineRect, p: Pt): Pt {
  if (kind === 'ellipse') {
    // Good-enough iterative projection: cast a ray from center through p.
    const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
    const a = r.width / 2, b = r.height / 2;
    const dx = p[0] - cx, dy = p[1] - cy;
    const len = Math.hypot(dx / a, dy / b);
    if (len < 1e-9) return [cx + a, cy];
    return [cx + dx / len, cy + dy / len];
  }
  let best: Pt = [r.x, r.y];
  let bestD = Infinity;
  for (const [a, b] of outlineSegments(kind, r)) {
    const q = nearestOnSegment(p, a, b);
    const d = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (d < bestD) { bestD = d; best = q; }
  }
  return best;
}

export function distanceToOutline(kind: OutlineKind, r: OutlineRect, p: Pt): number {
  const q = nearestPointOnOutline(kind, r, p);
  return Math.hypot(q[0] - p[0], q[1] - p[1]);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/geometry/outline.test.ts` → all PASS. Then `npx tsc --noEmit`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/geometry/outline.ts src/lib/geometry/outline.test.ts
git commit -m "feat(canvas): outline intersection geometry for arrow binding"
```

---

### Task 3: Binding resolution rewrite

Bound arrow endpoints resolve against the target shape's real outline: `fixedPoint` bindings aim at a stuck interior point; `focus` bindings slide along the outline; both clip outside the shape with `gap`.

**Files:**
- Modify: `src/lib/geometry/binding.ts`
- Modify: `src/lib/geometry/resolvePoints.ts`
- Test: `src/lib/geometry/binding.test.ts` (create)

**Interfaces:**
- Consumes: Task 2's `intersectSegmentWithOutline`, `isPointInsideShape`, `nearestPointOnOutline`; existing `focusToPerimeter`, `pointToFocus` (kept as-is).
- Produces:
  - `blockOutlineKind(block: EditorBlock): OutlineKind` — `'ellipse'`/`'diamond'` for those shapeKinds, `'rect'` for everything else (rect shape, text, image, video, frame).
  - `resolveBindingTarget(binding: ArrowBinding, block: EditorBlock): [number,number]` — the absolute aim point (fixedPoint offset, or perimeter point at `focus`).
  - `resolveBindingEndpoint(binding: ArrowBinding, aimFrom: [number,number], blocks: EditorBlock[]): [number,number] | null` — outline-clipped endpoint with gap.
  - `resolvePoints(block, allBlocks)` — unchanged signature; now aims each bound end at the adjacent path point.
  - Legacy `resolveBindingPosition` is deleted; call sites move to `resolveBindingEndpoint`/`resolveBindingTarget`.

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/geometry/binding.test.ts
import { describe, it, expect } from 'vitest';
import { resolveBindingTarget, resolveBindingEndpoint, blockOutlineKind } from './binding';
import { resolvePoints } from './resolvePoints';
import type { EditorBlock } from '@/data/store.types';

const shape = (over: Partial<EditorBlock>): EditorBlock => ({
  id: 'S1', type: 'shape', content: '', shapeKind: 'rect',
  x: 100, y: 100, width: 200, height: 100, canvasId: 'c1', ...over,
});

describe('blockOutlineKind', () => {
  it('maps shapeKinds and non-shapes', () => {
    expect(blockOutlineKind(shape({}))).toBe('rect');
    expect(blockOutlineKind(shape({ shapeKind: 'ellipse' }))).toBe('ellipse');
    expect(blockOutlineKind(shape({ shapeKind: 'diamond' }))).toBe('diamond');
    expect(blockOutlineKind(shape({ type: 'image', shapeKind: undefined }))).toBe('rect');
  });
});

describe('resolveBindingTarget', () => {
  it('fixedPoint is a relative offset', () => {
    expect(resolveBindingTarget({ blockId: 'S1', fixedPoint: [50, 25] }, shape({}))).toEqual([150, 125]);
  });
  it('focus maps to the perimeter (0.25 = top-right corner region start of right edge)', () => {
    // perimeter = 2*(200+100)=600; focus 0.25 → dist 150 → top edge ends at 200 → 150 is on top edge x=250
    expect(resolveBindingTarget({ blockId: 'S1', focus: 0.25 }, shape({}))).toEqual([250, 100]);
  });
});

describe('resolveBindingEndpoint', () => {
  const blocks = [shape({})];
  it('fixedPoint: endpoint sits on the outline with gap, aimed at the stuck point', () => {
    const p = resolveBindingEndpoint({ blockId: 'S1', fixedPoint: [100, 50], gap: 4 }, [0, 150], blocks)!;
    expect(p[0]).toBeCloseTo(96, 4); // left edge 100 minus gap 4
    expect(p[1]).toBeCloseTo(150, 4);
  });
  it('focus: endpoint never enters the shape even when focus is on the far side', () => {
    // Focus on the RIGHT edge center (perimeter dist 200+50=250 → focus 250/600)
    const p = resolveBindingEndpoint({ blockId: 'S1', focus: 250 / 600, gap: 4 }, [0, 150], blocks)!;
    expect(p[0]).toBeLessThanOrEqual(100); // clipped at/before left outline — not inside
  });
  it('returns null when the bound block is missing', () => {
    expect(resolveBindingEndpoint({ blockId: 'nope' }, [0, 0], blocks)).toBeNull();
  });
  it('aim point inside the shape falls back to nearest outline point', () => {
    const p = resolveBindingEndpoint({ blockId: 'S1', focus: 0, gap: 0 }, [200, 150], blocks)!;
    expect(Number.isFinite(p[0])).toBe(true);
    expect(Number.isFinite(p[1])).toBe(true);
  });
});

describe('resolvePoints (bound arrow end-to-end)', () => {
  it('a bound-both-ends arrow with no waypoints resolves to two outline points', () => {
    const s1 = shape({ id: 'A', x: 0, y: 0, width: 100, height: 100 });
    const s2 = shape({ id: 'B', x: 300, y: 0, width: 100, height: 100 });
    const arrow: EditorBlock = {
      id: 'ar', type: 'shape', shapeKind: 'arrow', content: '', canvasId: 'c1',
      x: 0, y: 0, width: 0, height: 0, points: [],
      startBinding: { blockId: 'A', focus: 0.5, gap: 4 },
      endBinding: { blockId: 'B', focus: 0.5, gap: 4 },
    };
    const pts = resolvePoints(arrow, [s1, s2, arrow]);
    expect(pts.length).toBe(2);
    expect(pts[0][0]).toBeGreaterThanOrEqual(96);   // exits A on its right side region
    expect(pts[1][0]).toBeLessThanOrEqual(304);     // enters B near its left side
    expect(pts[0][0]).toBeLessThan(pts[1][0]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/geometry/binding.test.ts`
Expected: FAIL — `resolveBindingTarget` / `blockOutlineKind` not exported.

- [ ] **Step 3: Implement**

Replace the bottom half of `src/lib/geometry/binding.ts` (keep `focusToPerimeter` and `pointToFocus` unchanged; delete `resolveBindingPosition` and `getBlockFixedPoints`):

```ts
// appended/replacing in src/lib/geometry/binding.ts
import { intersectSegmentWithOutline, isPointInsideShape, nearestPointOnOutline, type OutlineKind } from './outline';

export const BINDING_GAP = 4;

export function blockOutlineKind(block: EditorBlock): OutlineKind {
  if (block.type === 'shape') {
    if (block.shapeKind === 'ellipse') return 'ellipse';
    if (block.shapeKind === 'diamond') return 'diamond';
  }
  return 'rect';
}

function blockRect(block: EditorBlock): BlockRect {
  return { x: block.x ?? 0, y: block.y ?? 0, width: block.width ?? 280, height: block.height ?? 100 };
}

export function resolveBindingTarget(binding: ArrowBinding, block: EditorBlock): [number, number] {
  const rect = blockRect(block);
  if (binding.fixedPoint) return [rect.x + binding.fixedPoint[0], rect.y + binding.fixedPoint[1]];
  return focusToPerimeter(binding.focus ?? 0.5, rect, 0);
}

export function resolveBindingEndpoint(
  binding: ArrowBinding, aimFrom: [number, number], blocks: EditorBlock[],
): [number, number] | null {
  const block = blocks.find(b => b.id === binding.blockId);
  if (!block) return null;
  const rect = blockRect(block);
  const kind = blockOutlineKind(block);
  const gap = binding.gap ?? BINDING_GAP;
  const target = resolveBindingTarget(binding, block);
  const cornerRadius = block.canvasStyleExt?.cornerRadius ?? 0;

  if (isPointInsideShape(kind, rect, aimFrom)) {
    // Degenerate: the other end is inside this shape — sit on the nearest outline point.
    return nearestPointOnOutline(kind, rect, aimFrom);
  }
  // Aim from the free end toward the target; clip at the outline with gap.
  // For focus bindings the target is ON the perimeter; extend the ray slightly past it
  // toward the shape center so the intersection always registers.
  const cx = rect.x + rect.width / 2, cy = rect.y + rect.height / 2;
  const towardCenter: [number, number] = binding.fixedPoint ? target : [
    target[0] + (cx - target[0]) * 0.01, target[1] + (cy - target[1]) * 0.01,
  ];
  const hit = intersectSegmentWithOutline(kind, rect, aimFrom, towardCenter, gap, cornerRadius);
  if (hit) return hit;
  // Ray missed (e.g. focus on the far side): slide along the outline — nearest outline
  // point to the straight line aimFrom→target, approximated by projecting aimFrom.
  return nearestPointOnOutline(kind, rect, aimFrom);
}
```

Rewrite `src/lib/geometry/resolvePoints.ts` (two-pass aim):

```ts
// src/lib/geometry/resolvePoints.ts
import type { EditorBlock } from '@/data/store';
import { resolveBindingTarget, resolveBindingEndpoint } from './binding';

/**
 * Full resolved path for an arrow/line block.
 * Standalone: block.points. Bound: [clippedStart, ...points, clippedEnd].
 * Each bound end is aimed at its adjacent path point (waypoint if present,
 * otherwise the other end's binding target / free point).
 */
export function resolvePoints(block: EditorBlock, allBlocks: EditorBlock[]): [number, number][] {
  const mids: [number, number][] = block.points ?? [];
  const sB = block.startBinding, eB = block.endBinding;
  if (!sB && !eB) return mids;

  const sBlock = sB ? allBlocks.find(b => b.id === sB.blockId) : undefined;
  const eBlock = eB ? allBlocks.find(b => b.id === eB.blockId) : undefined;

  const startTarget = sB && sBlock ? resolveBindingTarget(sB, sBlock) : undefined;
  const endTarget = eB && eBlock ? resolveBindingTarget(eB, eBlock) : undefined;

  // Aim points: prefer nearest waypoint; else the opposite end's target; else opposite free point.
  const startAim = mids[0] ?? endTarget ?? mids[mids.length - 1];
  const endAim = mids[mids.length - 1] ?? startTarget ?? mids[0];

  const pts: [number, number][] = [];
  if (sB) {
    const p = startAim ? resolveBindingEndpoint(sB, startAim, allBlocks) : startTarget ?? null;
    if (p) pts.push(p);
  }
  pts.push(...mids);
  if (eB) {
    const p = endAim ? resolveBindingEndpoint(eB, endAim, allBlocks) : endTarget ?? null;
    if (p) pts.push(p);
  }
  return pts;
}
```

Fix call sites of the deleted `resolveBindingPosition` (find with `grep -rn "resolveBindingPosition" src`): in `VectorPath.tsx` lines ~87–88 replace with:

```ts
const startPos = resolvedPts.length > 0 && block.startBinding ? resolvedPts[0] : null;
const endPos = resolvedPts.length > 1 && block.endBinding ? resolvedPts[resolvedPts.length - 1] : null;
```

- [ ] **Step 4: Run tests + typecheck**

Run: `npx vitest run src/lib/geometry` → PASS. `npx tsc --noEmit` → 0 errors. `npm test` → all pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/geometry
git commit -m "feat(canvas): outline-clipped binding resolution with focus/fixedPoint modes"
```

---

### Task 4: Arrow creation UX — hover highlight, side dots, 3 binding modes

Excalidraw-style creation: with arrow/line tool active, hovering a bindable element highlights it and shows its 4 side-center dots. On release: dot → focus at side midpoint; inside → fixedPoint; within 12px of outline → focus at nearest perimeter point; else unbound. Removes the always-on 8-dot grid.

**Files:**
- Create: `src/lib/canvas/classifyBinding.ts`
- Test: `src/lib/canvas/classifyBinding.test.ts`
- Modify: `src/components/canvas/CanvasPage.tsx` (`commitFlowConnection`, hover tracking; delete `findClosestBlockHandle`)
- Modify: `src/components/canvas/CanvasBlock.tsx` (delete `allConnectionPoints` grid; add hover highlight ring + 4 side dots when hovered with drawing tool)

**Interfaces:**
- Consumes: Task 3's `blockOutlineKind`, `pointToFocus`; Task 2's `isPointInsideShape`, `distanceToOutline`, `nearestPointOnOutline`.
- Produces: `classifyBindingAt(point: [number,number], block: EditorBlock): ArrowBinding | null`; `findBindableBlockAt(point: [number,number], blocks: EditorBlock[]): EditorBlock | null`; CanvasPage state `hoverBindTargetId: string | null` passed to `CanvasBlock` as prop `bindHighlight: boolean`.

- [ ] **Step 1: Write failing tests for classification**

```ts
// src/lib/canvas/classifyBinding.test.ts
import { describe, it, expect } from 'vitest';
import { classifyBindingAt, findBindableBlockAt } from './classifyBinding';
import type { EditorBlock } from '@/data/store.types';

const rect: EditorBlock = { id: 'S1', type: 'shape', shapeKind: 'rect', content: '', x: 100, y: 100, width: 200, height: 100, canvasId: 'c1' };
const arrow: EditorBlock = { id: 'A1', type: 'shape', shapeKind: 'arrow', content: '', x: 0, y: 0, width: 0, height: 0, points: [[0,0],[10,10]], canvasId: 'c1' };

describe('classifyBindingAt', () => {
  it('inside the shape → fixedPoint binding (mode 2)', () => {
    const b = classifyBindingAt([150, 130], rect)!;
    expect(b.blockId).toBe('S1');
    expect(b.fixedPoint).toEqual([50, 30]);
    expect(b.focus).toBeUndefined();
  });
  it('within 12px of the outline → focus binding at nearest perimeter point (mode 3)', () => {
    const b = classifyBindingAt([250, 92], rect)!; // 8px above top edge at x=250
    expect(b.fixedPoint).toBeUndefined();
    // top edge, x=250 → perimeter dist 150 of 600 → focus 0.25
    expect(b.focus).toBeCloseTo(0.25, 3);
  });
  it('farther than 12px → no binding', () => {
    expect(classifyBindingAt([250, 80], rect)).toBeNull();
  });
});

describe('findBindableBlockAt', () => {
  it('finds shapes but never arrows/lines/freedraw', () => {
    expect(findBindableBlockAt([150, 130], [arrow, rect])?.id).toBe('S1');
    expect(findBindableBlockAt([5, 5], [arrow])).toBeNull();
  });
  it('prefers the topmost (last in array) when overlapping', () => {
    const top: EditorBlock = { ...rect, id: 'S2' };
    expect(findBindableBlockAt([150, 130], [rect, top])?.id).toBe('S2');
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run src/lib/canvas/classifyBinding.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement classification**

```ts
// src/lib/canvas/classifyBinding.ts
import type { ArrowBinding, EditorBlock } from '@/data/store.types';
import { blockOutlineKind, pointToFocus, BINDING_GAP } from '@/lib/geometry/binding';
import { isPointInsideShape, distanceToOutline, nearestPointOnOutline } from '@/lib/geometry/outline';

export const EDGE_BIND_THRESHOLD = 12;

const NON_BINDABLE_SHAPEKINDS = new Set(['arrow', 'line', 'freedraw']);

export function isBindable(block: EditorBlock): boolean {
  if (block.type === 'shape') return !NON_BINDABLE_SHAPEKINDS.has(block.shapeKind ?? '');
  return block.type === 'text' || block.type === 'image' || block.type === 'video' || block.type === 'frame';
}

function rectOf(b: EditorBlock) {
  return { x: b.x ?? 0, y: b.y ?? 0, width: b.width ?? 280, height: b.height ?? 100 };
}

/** Mode 2 (inside → fixedPoint) or mode 3 (near edge → focus); null if too far. */
export function classifyBindingAt(point: [number, number], block: EditorBlock): ArrowBinding | null {
  const rect = rectOf(block);
  const kind = blockOutlineKind(block);
  if (isPointInsideShape(kind, rect, point)) {
    return { blockId: block.id, fixedPoint: [point[0] - rect.x, point[1] - rect.y], gap: BINDING_GAP };
  }
  if (distanceToOutline(kind, rect, point) <= EDGE_BIND_THRESHOLD) {
    const onOutline = nearestPointOnOutline(kind, rect, point);
    return { blockId: block.id, focus: pointToFocus(onOutline[0], onOutline[1], rect), gap: BINDING_GAP };
  }
  return null;
}

/** Mode 1: side-center dot → focus at that side's midpoint. */
export function sideCenterBinding(block: EditorBlock, side: 'top' | 'right' | 'bottom' | 'left'): ArrowBinding {
  const rect = rectOf(block);
  const mid: Record<string, [number, number]> = {
    top: [rect.x + rect.width / 2, rect.y],
    right: [rect.x + rect.width, rect.y + rect.height / 2],
    bottom: [rect.x + rect.width / 2, rect.y + rect.height],
    left: [rect.x, rect.y + rect.height / 2],
  };
  const [mx, my] = mid[side];
  return { blockId: block.id, focus: pointToFocus(mx, my, rect), gap: BINDING_GAP };
}

/** Topmost bindable block whose bind zone (inside or ≤ threshold from outline) contains the point. */
export function findBindableBlockAt(point: [number, number], blocks: EditorBlock[]): EditorBlock | null {
  for (let i = blocks.length - 1; i >= 0; i--) {
    const b = blocks[i];
    if (!isBindable(b)) continue;
    const rect = rectOf(b);
    const kind = blockOutlineKind(b);
    if (isPointInsideShape(kind, rect, point) || distanceToOutline(kind, rect, point) <= EDGE_BIND_THRESHOLD) return b;
  }
  return null;
}
```

Run: `npx vitest run src/lib/canvas/classifyBinding.test.ts` → PASS.

- [ ] **Step 4: Wire creation flow in CanvasPage**

In `CanvasPage.tsx`:
1. Delete `findClosestBlockHandle` (lines ~269–293).
2. Replace the binding part of `commitFlowConnection` (~lines 295–324):

```ts
const commitFlowConnection = useCallback(() => {
  const { currentPath, isDrawing, clear } = useFlowState.getState();
  if (!isDrawing || currentPath.length < 2) { clear(); return; }

  const tool = activeTool === 'arrow' || activeTool === 'line' ? activeTool : 'arrow';
  const first = currentPath[0], last = currentPath[currentPath.length - 1];
  const liveBlocks = useStore.getState().blocks.filter(b => b.canvasId === entity.id);

  // Pending side-dot binding (mode 1) captured on pointerdown wins for the start.
  const pendingStart = pendingStartBindingRef.current;
  pendingStartBindingRef.current = null;

  const startTarget = pendingStart ?? (() => {
    const b = findBindableBlockAt(first, liveBlocks);
    return b ? classifyBindingAt(first, b) : null;
  })();
  const endBlock = findBindableBlockAt(last, liveBlocks);
  const endTarget = endBlock ? classifyBindingAt(last, endBlock) : null;

  addCanvasBlock({
    id: generateId(), type: 'shape', content: '', canvasId: entity.id,
    shapeKind: tool,
    startBinding: startTarget ?? undefined,
    endBinding: endTarget ?? undefined,
    points: currentPath.slice(startTarget ? 1 : 0, currentPath.length - (endTarget ? 1 : 0)),
    x: 0, y: 0, width: 0, height: 0,
    editMode: 'simple',
    startArrowhead: { type: 'none' },
    endArrowhead: tool === 'arrow' ? { type: 'filled-triangle', size: 1 } : { type: 'none' },
    canvasStyleExt: { stroke: '#d38f36', strokeWidth: 1, strokeStyle: 'solid', fill: 'transparent', fillOpacity: 0 },
  });
  clear();
  history.push(useStore.getState().blocks.filter(b => b.canvasId === entity.id));
}, [activeTool, addCanvasBlock, entity.id, history]);
```

Add near the top of the component: `const pendingStartBindingRef = useRef<ArrowBinding | null>(null);` and imports `import { classifyBindingAt, findBindableBlockAt, sideCenterBinding } from '@/lib/canvas/classifyBinding';`.

3. Hover highlight state: add `const [hoverBindTargetId, setHoverBindTargetId] = useState<string | null>(null);`. In the canvas `onPointerMove` handler (the one that already converts client→canvas coords for the flow-drawing preview), when `activeTool === 'arrow' || activeTool === 'line'`, set it:

```ts
const target = findBindableBlockAt([cx, cy], useStore.getState().blocks.filter(b => b.canvasId === entity.id));
setHoverBindTargetId(prev => (target?.id ?? null) === prev ? prev : (target?.id ?? null));
```

Clear it (`setHoverBindTargetId(null)`) when the tool changes away from arrow/line (add to the existing tool-change effect or `setActiveTool` wrapper). Pass `bindHighlight={hoverBindTargetId === block.id && (activeTool === 'arrow' || activeTool === 'line')}` and `onSideDotDown={(side) => { pendingStartBindingRef.current = sideCenterBinding(block, side); }}` to `CanvasBlock` where blocks are mapped.

- [ ] **Step 5: Replace the dot grid in CanvasBlock**

In `CanvasBlock.tsx`:
1. Delete `allConnectionPoints` (lines ~534–543) and the `{(activeTool === 'arrow' ...) && allConnectionPoints.map(...)}` render (lines ~622–644) plus the `onConnectStart` prop and its usages (also remove where CanvasPage passes it, line ~1521).
2. Add props to `CanvasBlockProps`: `bindHighlight?: boolean; onSideDotDown?: (side: 'top'|'right'|'bottom'|'left') => void;`.
3. Add render, in place of the removed grid:

```tsx
{/* Bind highlight + side-center dots (only on the hovered bindable element) */}
{bindHighlight && (
  <>
    <div className="absolute -inset-[2px] border-2 border-[var(--accent)] rounded-[inherit] pointer-events-none z-[95] opacity-70" />
    {(['top','right','bottom','left'] as const).map(side => (
      <div
        key={side}
        className={cn(
          "absolute w-3 h-3 rounded-full bg-[var(--accent)] border-2 border-background z-[100] cursor-crosshair",
          side === 'top' && "top-0 left-1/2 -translate-x-1/2 -translate-y-1/2",
          side === 'right' && "right-0 top-1/2 translate-x-1/2 -translate-y-1/2",
          side === 'bottom' && "bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2",
          side === 'left' && "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2",
        )}
        onPointerDown={() => onSideDotDown?.(side)}
      />
    ))}
  </>
)}
```

Note: do NOT `stopPropagation` or `preventDefault` in `onPointerDown` — the flow-drawing pointer handler on the canvas must still receive the event to start the stroke; the ref just records that this stroke starts bound to the side center.

- [ ] **Step 6: Verify manually**

`npx tsc --noEmit` → 0 errors. `npm run dev`, open a canvas:
- Arrow tool: hovering a rect highlights it with 4 dots; other blocks show nothing.
- Drag from a side dot to empty canvas → arrow start stays glued to that side center (with gap) when the shape is moved.
- Drag from empty canvas and release inside a shape → arrow endpoint aims at that interior point and clips at the outline; moving the shape keeps it stuck.
- Release ~8px outside an edge → binds; endpoint slides along the outline when either end moves and never enters the shape.
- Release 30px away → no binding.
- Works for ellipse and diamond outlines (arrowhead touches the curve/diagonal, not the bounding box).

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat(canvas): excalidraw-style arrow binding creation (3 modes, hover highlight)"
```

---

### Task 5: Endpoint drag rebinding + unbind on element delete

Dragging a bound/free arrow endpoint re-runs the same classification (highlight + rebind/unbind on release). Deleting an element converts its arrows' bindings to free points in place.

**Files:**
- Modify: `src/components/canvas/CanvasPage.tsx` (implement `onBindingDragStart` passed to `VectorPath` via `CanvasConnections`; also endpoint drag for *unbound* first/last waypoints stays as-is)
- Modify: `src/components/canvas/CanvasConnections.tsx` (thread the new prop)
- Modify: `src/data/store.ts` (`deleteCanvasBlock` cascade)
- Test: `src/data/store.canvasUnbind.test.ts` (create)

**Interfaces:**
- Consumes: Task 4's `classifyBindingAt`/`findBindableBlockAt`; Task 3's `resolvePoints`.
- Produces: store behavior — deleting a block rewrites arrows bound to it: binding removed, resolved endpoint appended to `points` so the arrow keeps its position.

- [ ] **Step 1: Write failing store test**

```ts
// src/data/store.canvasUnbind.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from './store';
import type { EditorBlock } from './store.types';

const rect: EditorBlock = { id: 'S1', type: 'shape', shapeKind: 'rect', content: '', x: 100, y: 100, width: 200, height: 100, canvasId: 'c1' };
const arrow: EditorBlock = {
  id: 'A1', type: 'shape', shapeKind: 'arrow', content: '', canvasId: 'c1',
  x: 0, y: 0, width: 0, height: 0, points: [[0, 150]],
  endBinding: { blockId: 'S1', focus: 0.5, gap: 4 },
};

describe('deleteCanvasBlock unbinds dependent arrows in place', () => {
  beforeEach(() => {
    useStore.setState({ blocks: [rect, arrow] });
  });
  it('removes the binding and freezes the endpoint as a free waypoint', () => {
    useStore.getState().deleteCanvasBlock('S1');
    const a = useStore.getState().blocks.find(b => b.id === 'A1')!;
    expect(a.endBinding).toBeUndefined();
    expect(a.points!.length).toBe(2); // original waypoint + frozen endpoint
    const frozen = a.points![1];
    expect(frozen[0]).toBeGreaterThan(0); // a real resolved coordinate, not [0,0]
  });
});
```

Adjust `useStore.setState` shape to the store's actual state key for canvas blocks (`blocks`) — confirm with `grep -n "blocks:" src/data/store.ts | head -5` before writing.

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run src/data/store.canvasUnbind.test.ts` → FAIL (bindings currently left dangling).

- [ ] **Step 3: Implement the cascade in `deleteCanvasBlock`**

In `src/data/store.ts`, inside the existing `deleteCanvasBlock` action, before removing the block, rewrite dependents:

```ts
import { resolvePoints } from '@/lib/geometry/resolvePoints'; // top of file

// inside deleteCanvasBlock(id), before filtering out the block:
const all = get().blocks;
const dependents = all.filter(b =>
  b.startBinding?.blockId === id || b.endBinding?.blockId === id
);
const rewritten = new Map<string, Partial<EditorBlock>>();
for (const dep of dependents) {
  const resolved = resolvePoints(dep, all);
  const upd: Partial<EditorBlock> = {};
  if (dep.startBinding?.blockId === id) {
    upd.startBinding = undefined;
    if (resolved.length > 0) upd.points = [resolved[0], ...(dep.points ?? [])];
  }
  if (dep.endBinding?.blockId === id) {
    upd.endBinding = undefined;
    const base = (upd.points ?? dep.points ?? []);
    if (resolved.length > 1) upd.points = [...base, resolved[resolved.length - 1]];
  }
  rewritten.set(dep.id, upd);
}
// then in the state update, apply rewritten entries to surviving blocks
```

Apply `rewritten` in the same `set()` that removes the block (map over blocks: if `rewritten.has(b.id)` merge updates; filter out the deleted id). Mirror the same cascade in the multi-delete action if one exists (`grep -n "deleteCanvasBlocks\|deleteBlocks" src/data/store.ts`).

- [ ] **Step 4: Run tests**

`npx vitest run src/data/store.canvasUnbind.test.ts` → PASS. `npm test` → all pass.

- [ ] **Step 5: Endpoint drag rebinding in CanvasPage**

`CanvasConnections.tsx`: add `onBindingDragStart?: (blockId: string, end: 'start' | 'end', e: React.PointerEvent) => void` to props and pass `onBindingDragStart={(end, e) => props.onBindingDragStart?.(block.id, end, e)}` into `VectorPath` (prop already exists there, currently unwired).

`CanvasPage.tsx`: pass a handler to `<CanvasConnections onBindingDragStart={handleBindingDrag} ...>`:

```ts
const handleBindingDrag = useCallback((blockId: string, end: 'start' | 'end', e: React.PointerEvent) => {
  e.stopPropagation();
  const rect = canvasContainerRef.current?.getBoundingClientRect();
  if (!rect) return;
  const toCanvas = (ev: PointerEvent | React.PointerEvent): [number, number] => {
    const vp = viewportRef.current;
    return [(ev.clientX - rect.left - vp.x) / vp.scale, (ev.clientY - rect.top - vp.y) / vp.scale];
  };
  const move = (ev: PointerEvent) => {
    const p = toCanvas(ev);
    const live = useStore.getState().blocks.filter(b => b.canvasId === entity.id && b.id !== blockId);
    const target = findBindableBlockAt(p, live);
    setHoverBindTargetId(target?.id ?? null);
    // live preview: temporarily write the endpoint as a free point
    const block = useStore.getState().blocks.find(b => b.id === blockId);
    if (!block) return;
    if (end === 'start') {
      useStore.getState().updateCanvasBlock(blockId, { startBinding: undefined, points: [p, ...(block.startBinding ? (block.points ?? []) : (block.points ?? []).slice(1))] });
    } else {
      const pts = block.endBinding ? (block.points ?? []) : (block.points ?? []).slice(0, -1);
      useStore.getState().updateCanvasBlock(blockId, { endBinding: undefined, points: [...pts, p] });
    }
  };
  const up = (ev: PointerEvent) => {
    document.removeEventListener('pointermove', move);
    document.removeEventListener('pointerup', up);
    setHoverBindTargetId(null);
    const p = toCanvas(ev);
    const live = useStore.getState().blocks.filter(b => b.canvasId === entity.id && b.id !== blockId);
    const target = findBindableBlockAt(p, live);
    if (target) {
      const binding = classifyBindingAt(p, target);
      const block = useStore.getState().blocks.find(b => b.id === blockId);
      if (binding && block) {
        // remove the temporary free endpoint added during preview
        const pts = end === 'start' ? (block.points ?? []).slice(1) : (block.points ?? []).slice(0, -1);
        useStore.getState().updateCanvasBlock(blockId, end === 'start' ? { startBinding: binding, points: pts } : { endBinding: binding, points: pts });
      }
    }
    history.push(useStore.getState().blocks.filter(b => b.canvasId === entity.id));
  };
  document.addEventListener('pointermove', move);
  document.addEventListener('pointerup', up);
}, [entity.id, history]);
```

Also in `VectorPath.tsx`, show the endpoint grab circles when `selected` (not only `editing`): change the `{editing && (` guard around the draggable start/end circles to `{(editing || selected) && (` and delete the duplicate non-interactive dots in the `{!editing && selected && (` block (keep waypoint preview dots there).

- [ ] **Step 6: Verify manually**

Dev app: select a bound arrow → drag its endpoint circle off the shape → detaches and follows cursor; release over another shape → rebinds (highlight shows); release on empty canvas → stays free. Delete a shape with two arrows bound → arrows stay put, unbound. Undo restores bindings.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat(canvas): endpoint drag rebinding and unbind-on-delete"
```

---

### Task 6: Text rework — transparent, auto-sizing, Excalidraw editing

Kill the boxed text block. Text = transparent content on canvas, auto-width/height while typing, created by text tool click or double-click on empty canvas, styled via `canvasStyleExt` + new text fields.

**Files:**
- Modify: `src/data/store.types.ts` (add `fontSize?: number; textAlign?: 'left'|'center'|'right'` to `EditorBlock`)
- Create: `src/components/canvas/CanvasTextElement.tsx`
- Modify: `src/components/canvas/CanvasBlock.tsx` (text branch delegates to `CanvasTextElement`)
- Modify: `src/components/canvas/CanvasPage.tsx` (text tool click + dbl-click empty canvas create text and enter edit mode)
- Modify: `src/components/canvas/CanvasStylePanel.tsx` (font size presets S/M/L/XL + numeric, align, color for text blocks)

**Interfaces:**
- Consumes: store actions `addCanvasBlock`, `updateCanvasBlock`, `deleteCanvasBlock`.
- Produces: `CanvasTextElement({ block, isEditing, onStartEdit, onEndEdit })` component; text blocks with `fontSize` (default **20**), `textAlign` (default `'left'`), color in `canvasStyleExt.stroke`; auto-size helper `measureTextSize(text: string, fontSize: number): { width: number; height: number }` exported from `CanvasTextElement.tsx`. Font sizes: S=16, M=20, L=28, XL=36. Empty text on blur → block deleted.

- [ ] **Step 1: Add type fields**

In `store.types.ts` `EditorBlock`, after `points`: `fontSize?: number;` and `textAlign?: 'left' | 'center' | 'right';`.

- [ ] **Step 2: Create CanvasTextElement**

```tsx
// src/components/canvas/CanvasTextElement.tsx
"use client";
import React, { useLayoutEffect, useRef } from 'react';
import { useStore, type EditorBlock } from '@/data/store';
import { cn } from '@/lib/utils';

export const TEXT_FONT_FAMILY = 'inherit'; // app font
export const DEFAULT_FONT_SIZE = 20;
export const LINE_HEIGHT = 1.25;

let measurer: HTMLDivElement | null = null;
export function measureTextSize(text: string, fontSize: number): { width: number; height: number } {
  if (typeof document === 'undefined') {
    const lines = text.split('\n');
    return { width: Math.max(...lines.map(l => l.length), 1) * fontSize * 0.6, height: lines.length * fontSize * LINE_HEIGHT };
  }
  if (!measurer) {
    measurer = document.createElement('div');
    measurer.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;left:-9999px;top:-9999px;';
    document.body.appendChild(measurer);
  }
  measurer.style.fontSize = `${fontSize}px`;
  measurer.style.lineHeight = String(LINE_HEIGHT);
  measurer.textContent = text || ' ';
  const rect = measurer.getBoundingClientRect();
  return { width: Math.max(rect.width + 2, fontSize * 0.6), height: Math.max(rect.height, fontSize * LINE_HEIGHT) };
}

interface Props {
  block: EditorBlock;
  isEditing: boolean;
  onStartEdit: () => void;
  onEndEdit: () => void;
}

export function CanvasTextElement({ block, isEditing, onStartEdit, onEndEdit }: Props) {
  const updateCanvasBlock = useStore(s => s.updateCanvasBlock);
  const deleteCanvasBlock = useStore(s => s.deleteCanvasBlock);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fontSize = block.fontSize ?? DEFAULT_FONT_SIZE;
  const color = block.canvasStyleExt?.stroke || 'var(--bone-90)';
  const align = block.textAlign ?? 'left';

  // Keep block dimensions synced to content (auto-size).
  useLayoutEffect(() => {
    const { width, height } = measureTextSize(block.content ?? '', fontSize);
    if (Math.abs((block.width ?? 0) - width) > 0.5 || Math.abs((block.height ?? 0) - height) > 0.5) {
      updateCanvasBlock(block.id, { width, height });
    }
  }, [block.content, fontSize]); // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    if (isEditing) {
      taRef.current?.focus();
      taRef.current?.setSelectionRange(taRef.current.value.length, taRef.current.value.length);
    }
  }, [isEditing]);

  const styleCommon: React.CSSProperties = {
    fontSize, lineHeight: LINE_HEIGHT, color, textAlign: align,
    fontFamily: TEXT_FONT_FAMILY, whiteSpace: 'pre', width: '100%', height: '100%',
  };

  if (isEditing) {
    return (
      <textarea
        ref={taRef}
        className="bg-transparent outline-none resize-none overflow-hidden block caret-[var(--brand-blue)]"
        style={styleCommon}
        value={block.content}
        onChange={e => updateCanvasBlock(block.id, { content: e.target.value })}
        onBlur={() => {
          if (!(block.content ?? '').trim()) deleteCanvasBlock(block.id);
          onEndEdit();
        }}
        onKeyDown={e => {
          if (e.key === 'Escape') { e.stopPropagation(); (e.target as HTMLTextAreaElement).blur(); }
        }}
        onPointerDown={e => e.stopPropagation()}
      />
    );
  }
  return (
    <div className={cn("select-none")} style={styleCommon} onDoubleClick={onStartEdit}>
      {block.content}
    </div>
  );
}
```

- [ ] **Step 3: Swap the text branch in CanvasBlock**

Replace the `block.type === 'text' ? (...)` branch (lines ~647–660) with:

```tsx
{block.type === 'text' ? (
  <CanvasTextElement
    block={block}
    isEditing={isEditing}
    onStartEdit={() => { setIsEditing(true); onSelect?.(block.id, false); }}
    onEndEdit={() => setIsEditing(false)}
  />
) : ...}
```

Import it. Also: for text blocks hide the 8 resize handles and dimension label while editing (text auto-sizes; corner resize scales `fontSize`): in the `HANDLES.map` guard add `&& block.type !== 'text'` for edge handles `n, e, s, w` — keep only corner handles for text, and in `handleResizeStart` for text blocks convert scale to font size: on commit, `updateCanvasBlock(block.id, { fontSize: Math.max(8, Math.round((block.fontSize ?? 20) * scaleFactor)) })` where `scaleFactor = newWidth / oldWidth` (hook into the existing resize commit path for the text case).

- [ ] **Step 4: Creation flows in CanvasPage**

1. Text tool click: find the canvas `onPointerDown`/click handler where `activeTool === 'text'` currently creates a text block (grep `'text'` in `CanvasPage.tsx`). Replace its creation payload with:

```ts
const id = generateId();
addCanvasBlock({
  id, type: 'text', content: '', canvasId: entity.id,
  x: cx, y: cy - 12, width: 20, height: 26,
  fontSize: 20, textAlign: 'left',
  canvasStyleExt: { stroke: 'var(--bone-90)' },
});
setSelectedIds(new Set([id]));
setEditingTextId(id);      // new state, see below
setActiveTool('select');
```

2. Add `const [editingTextId, setEditingTextId] = useState<string | null>(null);` and pass to `CanvasBlock` a prop `forceEditing={editingTextId === block.id}` — in `CanvasBlock`, `useEffect(() => { if (forceEditing) setIsEditing(true); }, [forceEditing])`, and call a new `onEditingEnded?: () => void` (wired to `setEditingTextId(null)`) inside `onEndEdit`.

3. Double-click empty canvas: in the canvas background double-click handler (add one on the canvas container if missing — it must ignore double-clicks that land on blocks, which already stopPropagation), run the same creation snippet at the cursor's canvas coords.

- [ ] **Step 5: Style panel**

In `CanvasStylePanel.tsx`, when the selection is a single `text` block, render a "Text" section: four preset buttons S/M/L/XL (16/20/28/36) + numeric input bound to `fontSize`, a 3-way segmented control for `textAlign`, and reuse the existing stroke color control bound to `canvasStyleExt.stroke` labeled "Color". Follow the panel's existing segmented-control and pill-input markup patterns (copy an existing section's classes).

- [ ] **Step 6: Verify**

`npx tsc --noEmit` → 0 errors. `npm test` → pass. Dev app:
- T + click → caret appears immediately, type → text grows right/down, no box.
- Double-click empty canvas → same. Escape/click-away commits; empty text vanishes.
- Double-click existing text → edits in place. S/M/L/XL changes size; alignment and color work.
- Corner-resize scales the font. Arrows can bind to text (rect outline).

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat(canvas): excalidraw-style transparent auto-sizing text"
```

---

### Task 7: Bound labels — text in shapes and on arrows

Double-click a shape → centered wrapping label that grows the container vertically. Double-click an arrow → midpoint label chip. Labels are real text blocks with `containerId`.

**Files:**
- Modify: `src/data/store.types.ts` (add `containerId?: string` to `EditorBlock`)
- Create: `src/lib/canvas/boundText.ts`
- Test: `src/lib/canvas/boundText.test.ts`
- Modify: `src/components/canvas/CanvasBlock.tsx` (shape dbl-click creates/edits label; render label inside shape; remove old `content`-in-shape rendering; container ops cascade)
- Modify: `src/components/canvas/CanvasPage.tsx` (arrow dbl-click → label instead of waypoint edit **when no waypoint edit intended**: keep waypoint editing on dbl-click of the path, add label on dbl-click via new "Enter" behavior — see Step 4)
- Modify: `src/components/canvas/edges/VectorPath.tsx` (render arrow label chip at path midpoint)
- Modify: `src/data/store.ts` (delete/duplicate/move cascades for `containerId`)

**Interfaces:**
- Consumes: Task 6's `measureTextSize`, `CanvasTextElement` patterns; `resolvePoints` for arrow midpoint.
- Produces:
  - `getBoundText(containerBlockId: string, blocks: EditorBlock[]): EditorBlock | undefined` (first text block with `containerId === id`)
  - `layoutLabelInShape(container: EditorBlock, fontSize: number, text: string): { x: number; y: number; width: number; height: number; containerGrowsTo?: number }` — wraps to `container.width - 2*PADDING` (PADDING = 12), centers H+V; `containerGrowsTo` set when text height + 2*PADDING exceeds container height.
  - `pathMidpoint(pts: [number,number][]): [number,number]`
  - Store cascade: deleting a container deletes its label; deleting a label alone leaves the container; moving/duplicating a container moves/duplicates the label.

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/canvas/boundText.test.ts
import { describe, it, expect } from 'vitest';
import { layoutLabelInShape, pathMidpoint, getBoundText, LABEL_PADDING } from './boundText';
import type { EditorBlock } from '@/data/store.types';

const container: EditorBlock = { id: 'S1', type: 'shape', shapeKind: 'rect', content: '', x: 100, y: 100, width: 200, height: 100, canvasId: 'c1' };

describe('layoutLabelInShape', () => {
  it('centers a short label', () => {
    const l = layoutLabelInShape(container, 20, 'Hi');
    expect(l.width).toBeLessThanOrEqual(200 - 2 * LABEL_PADDING);
    expect(l.x).toBeGreaterThan(100);
    expect(l.y).toBeGreaterThan(100);
    expect(l.containerGrowsTo).toBeUndefined();
  });
  it('grows the container when the text is too tall', () => {
    const long = Array(20).fill('line').join('\n');
    const l = layoutLabelInShape(container, 20, long);
    expect(l.containerGrowsTo).toBeGreaterThan(100);
  });
});

describe('pathMidpoint', () => {
  it('finds the halfway point along the polyline', () => {
    expect(pathMidpoint([[0, 0], [100, 0]])).toEqual([50, 0]);
    expect(pathMidpoint([[0, 0], [100, 0], [100, 100]])).toEqual([100, 0]);
  });
});

describe('getBoundText', () => {
  it('finds the label by containerId', () => {
    const label: EditorBlock = { id: 'T1', type: 'text', content: 'x', containerId: 'S1', canvasId: 'c1', x: 0, y: 0 };
    expect(getBoundText('S1', [container, label])?.id).toBe('T1');
    expect(getBoundText('S1', [container])).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify fail**

`npx vitest run src/lib/canvas/boundText.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement boundText helpers**

```ts
// src/lib/canvas/boundText.ts
import type { EditorBlock } from '@/data/store.types';
import { measureTextSize, LINE_HEIGHT } from '@/components/canvas/CanvasTextElement';

export const LABEL_PADDING = 12;

export function getBoundText(containerBlockId: string, blocks: EditorBlock[]): EditorBlock | undefined {
  return blocks.find(b => b.type === 'text' && b.containerId === containerBlockId);
}

/** Greedy word-wrap against a max width using the DOM measurer. */
export function wrapText(text: string, fontSize: number, maxWidth: number): string {
  const out: string[] = [];
  for (const rawLine of text.split('\n')) {
    const words = rawLine.split(' ');
    let line = '';
    for (const w of words) {
      const candidate = line ? `${line} ${w}` : w;
      if (measureTextSize(candidate, fontSize).width <= maxWidth || !line) line = candidate;
      else { out.push(line); line = w; }
    }
    out.push(line);
  }
  return out.join('\n');
}

export function layoutLabelInShape(container: EditorBlock, fontSize: number, text: string):
  { x: number; y: number; width: number; height: number; wrapped: string; containerGrowsTo?: number } {
  const cw = container.width ?? 0, ch = container.height ?? 0;
  const maxW = Math.max(cw - 2 * LABEL_PADDING, fontSize);
  const wrapped = wrapText(text, fontSize, maxW);
  const size = measureTextSize(wrapped, fontSize);
  const width = Math.min(size.width, maxW);
  const height = size.height;
  const neededH = height + 2 * LABEL_PADDING;
  const containerGrowsTo = neededH > ch ? neededH : undefined;
  const effectiveH = containerGrowsTo ?? ch;
  return {
    x: (container.x ?? 0) + (cw - width) / 2,
    y: (container.y ?? 0) + (effectiveH - height) / 2,
    width, height, wrapped, containerGrowsTo,
  };
}

export function pathMidpoint(pts: [number, number][]): [number, number] {
  if (pts.length === 0) return [0, 0];
  if (pts.length === 1) return pts[0];
  let total = 0;
  const segs: number[] = [];
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    segs.push(d); total += d;
  }
  let half = total / 2;
  for (let i = 0; i < segs.length; i++) {
    if (half <= segs[i]) {
      const t = segs[i] === 0 ? 0 : half / segs[i];
      return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t];
    }
    half -= segs[i];
  }
  return pts[pts.length - 1];
}
```

Note: `measureTextSize` has a non-DOM fallback so these tests run in a plain node environment; if the repo's vitest uses jsdom the real measurer runs — both fine (tests assert inequalities, not exact px).

Run: `npx vitest run src/lib/canvas/boundText.test.ts` → PASS. Add `containerId?: string;` to `EditorBlock` in `store.types.ts`.

- [ ] **Step 4: Shape labels in CanvasBlock**

1. Delete the old in-shape text render (the `block.type === 'shape' && !['line','arrow','freedraw']...` branch, lines ~749–765).
2. `handleDoubleClick` for eligible shapes now creates-or-edits the bound label:

```ts
if (block.type === 'shape' && !['line', 'arrow', 'freedraw'].includes(block.shapeKind || '')) {
  e.stopPropagation();
  const blocks = useStore.getState().blocks;
  const existing = getBoundText(block.id, blocks);
  if (existing) { onRequestLabelEdit?.(existing.id); return; }
  const id = generateId();
  useStore.getState().addCanvasBlock({
    id, type: 'text', content: '', canvasId: block.canvasId, containerId: block.id,
    x: (block.x ?? 0) + (block.width ?? 0) / 2, y: (block.y ?? 0) + (block.height ?? 0) / 2,
    width: 20, height: 26, fontSize: 20, textAlign: 'center',
    canvasStyleExt: { stroke: 'var(--bone-100)' },
  });
  onRequestLabelEdit?.(id);
  return;
}
```

`onRequestLabelEdit` is a new `CanvasBlock` prop wired in `CanvasPage` to `setEditingTextId` (from Task 6).
3. Render bound-label text blocks positioned by layout, not by their own x/y: in `CanvasBlock`, when `block.type === 'text' && block.containerId`, compute `layoutLabelInShape(containerBlock, fontSize, block.content)` (look up container from store) and use the layout's x/y/width/height for the wrapper div instead of `block.x/block.y/size`; render `wrapped` text with `whiteSpace: 'pre-wrap'`. When `containerGrowsTo` is set, in a `useLayoutEffect`, call `updateCanvasBlock(container.id, { height: containerGrowsTo })`. Labels are not individually draggable (pointer events pass through to the container except in edit mode) and hide resize handles: add `block.containerId` guards to the drag/resize handle renders.
4. Container cascades in `store.ts`:
   - `deleteCanvasBlock(id)`: also delete blocks with `containerId === id` (extend the Task 5 cascade).
   - Duplicate/copy action (find with `grep -n "duplicate" src/data/store.ts src/components/canvas/CanvasPage.tsx`): when duplicating a container, duplicate its label with `containerId` pointed at the new container id.
   - Label follows automatically on move since its position is derived from the container each render — no store change needed.

- [ ] **Step 5: Arrow labels in VectorPath**

Arrows/lines: double-click already routes to waypoint editing (`handleDoubleClickBlock` in CanvasPage). Change the split: **double-click enters label edit; double-click with Alt held enters waypoint edit** (waypoint editing is the power-user path). In `handleDoubleClickBlock`:

```ts
const handleDoubleClickBlock = useCallback((blockId: string, altKey?: boolean) => {
  const block = useStore.getState().blocks.find(b => b.id === blockId);
  if (!block) return;
  if (block.shapeKind === 'arrow' || block.shapeKind === 'line' || block.shapeKind === 'freedraw') {
    if (altKey || block.shapeKind === 'freedraw') {
      useFlowState.getState().clear();
      setSelectedPointIndex(null);
      setEditingBlockId(blockId);
      setActiveTool('select');
      return;
    }
    const existing = getBoundText(blockId, useStore.getState().blocks);
    if (existing) { setEditingTextId(existing.id); return; }
    const id = generateId();
    useStore.getState().addCanvasBlock({
      id, type: 'text', content: '', canvasId: block.canvasId, containerId: blockId,
      x: 0, y: 0, width: 20, height: 26, fontSize: 16, textAlign: 'center',
      canvasStyleExt: { stroke: 'var(--bone-100)' },
    });
    setEditingTextId(id);
  }
}, []);
```

Thread `altKey` from `VectorPath`'s double-click detection (`onDoubleClick?.()` → `onDoubleClick?.(e.altKey)` at both call sites in `VectorPath.tsx`).

Rendering: in `CanvasBlock` label branch, when the container is an arrow/line (`points` present), position at `pathMidpoint(resolvePoints(container, blocks))` centered, and wrap the label in a chip: `className="bg-[var(--app-dark)] px-1.5 py-0.5 rounded-[var(--radius-tiny)]"` so it stays readable over the stroke. No container growth for arrows.

- [ ] **Step 6: Verify**

`npx tsc --noEmit`, `npm test` → pass. Dev app:
- Double-click rect → type → label centered, wraps at shape width; keep typing past the bottom → shape grows taller.
- Move/resize shape → label re-centers. Delete shape → label gone. Duplicate shape → label duplicated.
- Double-click arrow → chip label at midpoint; move arrow/bound shape → label follows. Alt+double-click arrow → waypoint editing still available.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat(canvas): bound text labels in shapes and on arrows"
```

---

### Task 8: Sections — Excalidraw frames, simplified

Rename to Section in UI, always-clip, fully-inside containment on drop, no nesting, label editing, border/label selection.

**Files:**
- Modify: `src/components/canvas/CanvasBlock.tsx` (frame branch)
- Modify: `src/components/canvas/CanvasPage.tsx` (`handleDragCommit` containment; remove `hoveredFrameId` innermost logic in `handleDragMove`)
- Modify: `src/components/canvas/CanvasLayersPanel.tsx`, `CanvasStylePanel.tsx` (copy "Frame" → "Section")
- Modify: `src/data/store.types.ts` (remove `clipContent` — always on)

**Interfaces:**
- Consumes: existing `parentId` (Task 1 kept it), drag commit pipeline.
- Produces: containment rule — element (except other frames) with bounds fully inside a frame's bounds on drop → `parentId = frame.id`, else `parentId = undefined`. Frames render children clipped: children of a frame render inside the frame's clipping container.

- [ ] **Step 1: Containment on drop**

In `handleDragCommit` (CanvasPage, ~lines 150–216): replace the existing `containedBy` logic with fully-inside test and forbid frame-in-frame:

```ts
const frames = useStore.getState().blocks.filter(b => b.canvasId === entity.id && b.type === 'frame');
for (const block of draggedBlocks) {
  if (block.type === 'frame') continue; // no nesting
  const bx = block.x ?? 0, by = block.y ?? 0, bw = block.width ?? 0, bh = block.height ?? 0;
  let containedBy: string | undefined;
  for (const f of frames) {
    const fx = f.x ?? 0, fy = f.y ?? 0, fw = f.width ?? 0, fh = f.height ?? 0;
    if (bx >= fx && by >= fy && bx + bw <= fx + fw && by + bh <= fy + fh) { containedBy = f.id; break; }
  }
  if (containedBy !== block.parentId) batch.push({ id: block.id, updates: { parentId: containedBy } });
}
```

In `handleDragMove`, keep the frame-hover highlight but switch the test from cursor-inside to same fully-inside test on the dragged block's live bounds (compute from `activeDragOffsets` or the block's current store position — the current store position updates during drag via `updateCanvasBlocks`, so reuse it). Delete the smallest-area innermost scan (no nesting anymore — first match wins).

Also: dragging a frame moves members — verify `useDrag.ts` already moves `parentId` children with the frame (`grep -n "parentId" src/hooks/useDrag.ts`); if not, extend the drag set: when a dragged block is a frame, include all blocks with `parentId === frame.id` in the moved set.

- [ ] **Step 2: Clipping render**

In `CanvasBlock.tsx` frame branch: remove the `block.clipContent &&` condition — the body div always gets `overflow-hidden`. **Children must render inside the frame's box to be clipped.** Current architecture renders all blocks as siblings, so clipping needs a clip container: in `CanvasPage.tsx` where DOM blocks are mapped, render for each frame an absolutely-positioned clip wrapper:

```tsx
{frames.map(f => (
  <div key={`clip-${f.id}`} className="absolute overflow-hidden pointer-events-none"
       style={{ left: f.x, top: f.y, width: f.width, height: f.height, zIndex: 5 }}>
    <div className="absolute" style={{ left: -(f.x ?? 0), top: -(f.y ?? 0), pointerEvents: 'auto' }}>
      {childBlocks(f.id).map(renderBlock)}
    </div>
  </div>
))}
```

where `childBlocks(fid) = pageBlocks.filter(b => b.parentId === fid)` and top-level blocks render as before but excluding members (`pageBlocks.filter(b => !b.parentId || b.type === 'frame')`). `renderBlock` is the existing `CanvasBlock` mapping extracted into a function so both paths share it. Members keep absolute canvas coordinates (the inner div's negative offset re-bases them), so no coordinate rewriting is needed. Exception while dragging: a member currently being dragged renders in the top-level layer (unclipped) so it stays visible when dragged out — check `activeDragOffsets.has(b.id)` (already imported from `canvasDragState` in VectorPath; same import works here).

- [ ] **Step 3: Label + selection + copy**

- Remove the child-count badge (CanvasBlock frame branch, lines ~690–700).
- Label double-click → inline rename: replace the label `<span>` with an input when a new local `editingLabel` state is true (double-click on the label div sets it); commit on blur/Enter via `updateCanvasBlock(block.id, { content: value })`. Placeholder text `Section`.
- Selection: the frame body ignores pointer events (`pointer-events-none` on the body fill when the frame is not selected) so clicks inside hit members; the label and a 4px-wide border strip select the frame (keep the existing edge drag trigger `-inset-1` element but only for frames make it a thin border zone: replace `-inset-1` with four thin strips or set `clip-path` — simplest: give frames `pointerEvents` only on label + the existing `canvas-block-edge` element and set the body to `pointer-events-none`).
- Rename all user-visible "Frame" copy to "Section": `grep -rn "Frame" src/components/canvas` and update strings (toolbar label done in Task 1; layers panel, style panel, placeholder label).
- Remove `clipContent` from `store.types.ts` and fix tsc errors (delete the style-panel toggle for it if present).

- [ ] **Step 4: Verify**

`npx tsc --noEmit`, `npm test`. Dev app:
- Draw section, drop a shape fully inside → dragging the section moves the shape; partially overlapping shape does not join.
- Member shape dragged partially past the section border is visually clipped at the border; drop it fully outside → unclips and leaves the section.
- Section inside section → inner one does not become a member.
- Rename label works; clicking a member selects the member, clicking the label/border selects the section.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(canvas): excalidraw-style sections (containment, always-clip, no nesting)"
```

---

### Task 9: Eraser tool

**Files:**
- Create: `src/hooks/useEraser.ts`
- Test: `src/hooks/useEraser.test.ts` (hit-test core)
- Modify: `src/components/canvas/CanvasToolbar.tsx` (tool button, shortcut `E`)
- Modify: `src/components/canvas/CanvasPage.tsx` (route pointer events when `activeTool === 'eraser'`; render marked elements at 30% opacity)

**Interfaces:**
- Consumes: `distanceToOutline`/`isPointInsideShape` (Task 2), `resolvePoints` (Task 3), store delete actions.
- Produces: `hitTestBlock(p: [number,number], block: EditorBlock, allBlocks: EditorBlock[], tolerance: number): boolean` (exported pure fn); `useEraser({ canvasId, onCommit })` returning `{ markedIds, handleEraserDown }`; `'eraser'` added to `CanvasTool`.

- [ ] **Step 1: Write failing hit-test tests**

```ts
// src/hooks/useEraser.test.ts
import { describe, it, expect } from 'vitest';
import { hitTestBlock } from './useEraser';
import type { EditorBlock } from '@/data/store.types';

const rect: EditorBlock = { id: 'S1', type: 'shape', shapeKind: 'rect', content: '', x: 100, y: 100, width: 200, height: 100, canvasId: 'c1', canvasStyleExt: { fill: '#fff', fillOpacity: 1 } };
const hollow: EditorBlock = { ...rect, id: 'S2', canvasStyleExt: { fill: 'transparent', fillOpacity: 0 } };
const arrow: EditorBlock = { id: 'A1', type: 'shape', shapeKind: 'arrow', content: '', x: 0, y: 0, width: 0, height: 0, points: [[0, 0], [100, 100]], canvasId: 'c1' };

describe('hitTestBlock', () => {
  it('filled shape: anywhere inside hits', () => {
    expect(hitTestBlock([200, 150], rect, [rect], 8)).toBe(true);
  });
  it('hollow shape: only near the outline hits', () => {
    expect(hitTestBlock([200, 150], hollow, [hollow], 8)).toBe(false);
    expect(hitTestBlock([100, 150], hollow, [hollow], 8)).toBe(true);
  });
  it('arrow: near the polyline hits', () => {
    expect(hitTestBlock([52, 48], arrow, [arrow], 8)).toBe(true);
    expect(hitTestBlock([80, 20], arrow, [arrow], 8)).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify fail**

`npx vitest run src/hooks/useEraser.test.ts` → FAIL.

- [ ] **Step 3: Implement**

```ts
// src/hooks/useEraser.ts
import { useCallback, useState } from 'react';
import { useStore, type EditorBlock } from '@/data/store';
import { blockOutlineKind } from '@/lib/geometry/binding';
import { isPointInsideShape, distanceToOutline } from '@/lib/geometry/outline';
import { resolvePoints } from '@/lib/geometry/resolvePoints';

function distToPolyline(p: [number, number], pts: [number, number][]): number {
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
    const abx = bx - ax, aby = by - ay;
    const len2 = abx * abx + aby * aby;
    const t = len2 < 1e-12 ? 0 : Math.max(0, Math.min(1, ((p[0] - ax) * abx + (p[1] - ay) * aby) / len2));
    best = Math.min(best, Math.hypot(ax + t * abx - p[0], ay + t * aby - p[1]));
  }
  return best;
}

export function hitTestBlock(p: [number, number], block: EditorBlock, allBlocks: EditorBlock[], tolerance: number): boolean {
  const isLinear = block.type === 'shape' && ['arrow', 'line', 'freedraw'].includes(block.shapeKind ?? '');
  if (isLinear) {
    const pts = resolvePoints(block, allBlocks);
    return pts.length >= 2 && distToPolyline(p, pts) <= tolerance;
  }
  const rect = { x: block.x ?? 0, y: block.y ?? 0, width: block.width ?? 0, height: block.height ?? 0 };
  const kind = blockOutlineKind(block);
  const hasFill = block.type !== 'shape' ||
    (!!block.canvasStyleExt?.fill && block.canvasStyleExt.fill !== 'transparent' && (block.canvasStyleExt.fillOpacity ?? 1) > 0);
  if (hasFill && isPointInsideShape(kind, rect, p)) return true;
  return distanceToOutline(kind, rect, p) <= tolerance;
}

export function useEraser({ canvasId, onCommit }: { canvasId: string; onCommit: () => void }) {
  const [markedIds, setMarkedIds] = useState<Set<string>>(new Set());

  const handleEraserDown = useCallback((toCanvas: (ev: PointerEvent) => [number, number], firstEvent: PointerEvent) => {
    const marked = new Set<string>();
    const mark = (ev: PointerEvent) => {
      const p = toCanvas(ev);
      const blocks = useStore.getState().blocks.filter(b => b.canvasId === canvasId && !b.canvasStyleExt?.locked);
      for (const b of blocks) {
        if (!marked.has(b.id) && hitTestBlock(p, b, blocks, 8)) {
          marked.add(b.id); // labels erase individually; container→label deletion is handled by the store cascade
        }
      }
      setMarkedIds(new Set(marked));
    };
    const cancel = (e: KeyboardEvent) => { if (e.key === 'Escape') { marked.clear(); setMarkedIds(new Set()); cleanup(); } };
    const up = () => {
      cleanup();
      if (marked.size > 0) {
        const del = useStore.getState().deleteCanvasBlock;
        marked.forEach(id => del(id));
        onCommit(); // single history push for the whole gesture
      }
      setMarkedIds(new Set());
    };
    const cleanup = () => {
      document.removeEventListener('pointermove', mark);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('keydown', cancel);
    };
    document.addEventListener('pointermove', mark);
    document.addEventListener('pointerup', up);
    document.addEventListener('keydown', cancel);
    mark(firstEvent);
  }, [canvasId, onCommit]);

  return { markedIds, handleEraserDown };
}
```

- [ ] **Step 4: Run tests, wire UI**

`npx vitest run src/hooks/useEraser.test.ts` → PASS.

Wire: add `'eraser'` to `CanvasTool` union; add to `SHAPE_TOOLS` in the toolbar `{ id: 'eraser', icon: <Eraser className="w-4 h-4 text-[var(--bone-100)]" />, shortcut: 'E', label: 'Eraser' }` (lucide `Eraser` icon) and `E` to the keyboard shortcut handler in CanvasPage. In CanvasPage's canvas `onPointerDown`: if `activeTool === 'eraser'`, call `handleEraserDown(toCanvas, e.nativeEvent)` and return. Pass `markedIds` down so `CanvasBlock` and `VectorPath` render `opacity: 0.3` when their id is marked (new prop `erasing?: boolean`, applied as inline style on the container/g element). History: `onCommit: () => history.push(useStore.getState().blocks.filter(b => b.canvasId === entity.id))`. Undo restores everything from one gesture in one step (verify — history is snapshot-based so a single push after all deletes = one step). Cursor: `cursor-cell` on the canvas container when eraser active.

- [ ] **Step 5: Verify manually + commit**

Dev app: E → drag across 3 elements → they dim → release → gone; Ctrl+Z brings all 3 back at once; Escape mid-drag cancels. Bound arrows erased with their shape? No — erasing a shape (release) triggers Task 5's unbind cascade for surviving arrows. Locked elements ignored.

```bash
git add -A && git commit -m "feat(canvas): eraser tool"
```

---

### Task 10: Curved ↔ straight arrow toggle

Today every multi-point path renders as a Catmull-Rom spline. Add per-arrow `curved` flag: **straight** (polyline, new default for new arrows with waypoints) vs **curved** (existing spline).

**Files:**
- Modify: `src/data/store.types.ts` (add `curved?: boolean` to `EditorBlock`)
- Modify: `src/lib/geometry/splines.ts` (export `calculatePolylinePath(pts): string`)
- Modify: `src/components/canvas/edges/VectorPath.tsx` (path calc respects `curved`)
- Modify: `src/components/canvas/CanvasStylePanel.tsx` (segmented toggle for selected arrow/line)
- Test: extend `src/lib/geometry/splines.test.ts` if it exists, else create minimal

**Interfaces:**
- Consumes: existing `calculateCatmullRomPath`.
- Produces: `calculatePolylinePath(pts: [number,number][]): string` — `M x y L x y ...`; `block.curved === true` → spline, else polyline (2-point paths are identical either way).

- [ ] **Step 1: Failing test**

```ts
// in src/lib/geometry/splines.test.ts (create if missing)
import { describe, it, expect } from 'vitest';
import { calculatePolylinePath } from './splines';

describe('calculatePolylinePath', () => {
  it('renders M/L segments', () => {
    expect(calculatePolylinePath([[0, 0], [10, 5], [20, 0]])).toBe('M 0 0 L 10 5 L 20 0');
  });
  it('empty/single point → empty string', () => {
    expect(calculatePolylinePath([])).toBe('');
    expect(calculatePolylinePath([[1, 1]])).toBe('');
  });
});
```

Run → FAIL. Implement in `splines.ts`:

```ts
export function calculatePolylinePath(pts: [number, number][]): string {
  if (pts.length < 2) return '';
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ');
}
```

Run → PASS.

- [ ] **Step 2: Wire rendering + panel**

`VectorPath.tsx` `edgePath` memo (line ~58) and the inner `computePathD` (line ~127): 

```ts
if (isAdvanced && radiuses.length > 0) return calculateAdvancedPath(resolvedPts, radiuses);
return block.curved ? calculateCatmullRomPath(resolvedPts) : calculatePolylinePath(resolvedPts);
```

Style panel: when selection is a single arrow/line, add a two-option segmented control "Path: Straight | Curved" bound to `updateCanvasBlock(id, { curved: <bool> })`, using the panel's existing segmented-control markup. New arrows keep `curved: undefined` (straight).

- [ ] **Step 3: Verify + commit**

`npx tsc --noEmit`; dev app: arrow with a dragged waypoint → straight elbows; toggle Curved → smooth spline; bindings/labels unaffected.

```bash
git add -A && git commit -m "feat(canvas): straight/curved toggle for arrows and lines"
```

---

### Task 11: Interaction polish — Alt+drag duplicate, nudge, Escape chain, cursors

**Files:**
- Modify: `src/components/canvas/CanvasPage.tsx` (keyboard handler, Escape chain)
- Modify: `src/hooks/useDrag.ts` (Alt+drag duplicate)

**Interfaces:**
- Consumes: store `addCanvasBlock`, `updateCanvasBlocks`; existing keyboard handler in CanvasPage (find with `grep -n "addEventListener('keydown'\|onKeyDown" src/components/canvas/CanvasPage.tsx`).
- Produces: behaviors below; no new exports.

- [ ] **Step 1: Alt+drag duplicate**

In `useDrag.ts` `startDrag`: if `e.altKey` at drag start, before initiating the move, clone every selected block (new ids via `generateId()`, same x/y; clone bound labels with remapped `containerId`; remap internal `groupId` relationships within the copied set; drop `startBinding`/`endBinding` whose target is outside the copied set — actually keep bindings whose target is inside the copied set remapped to the new ids, drop others' — implement as a `duplicateBlocks(ids: string[]): string[]` store action so CanvasPage's existing duplicate button (line ~1605 `Copy` button) reuses it), select the clones, and drag the clones while originals stay. Add `duplicateBlocks` to `store.ts`:

```ts
duplicateBlocks: (ids) => {
  const state = get();
  const src = state.blocks.filter(b => ids.includes(b.id) || (b.containerId && ids.includes(b.containerId)));
  const idMap = new Map(src.map(b => [b.id, generateId()]));
  const remapBinding = (bd?: ArrowBinding) => bd && idMap.has(bd.blockId) ? { ...bd, blockId: idMap.get(bd.blockId)! } : undefined;
  const clones = src.map(b => ({
    ...b,
    id: idMap.get(b.id)!,
    containerId: b.containerId ? idMap.get(b.containerId) ?? b.containerId : undefined,
    groupId: b.groupId ? `${b.groupId}-copy` : undefined,
    parentId: b.parentId && idMap.has(b.parentId) ? idMap.get(b.parentId) : b.parentId,
    startBinding: remapBinding(b.startBinding),
    endBinding: remapBinding(b.endBinding),
  }));
  set({ blocks: [...state.blocks, ...clones] });
  return clones.filter(c => !c.containerId).map(c => c.id);
},
```

(Adapt the exact `set`/persist pattern to how neighboring store actions write `blocks` — copy their structure. If the existing duplicate button already has clone logic, extract THAT into `duplicateBlocks` instead of writing new logic, then add the binding/container remapping to it.)

- [ ] **Step 2: Arrow-key nudge**

In the CanvasPage keyboard handler (where Delete/Ctrl+Z live), when selection is non-empty, the event target is not an input/textarea, and key is an arrow key:

```ts
if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && selectedIds.size > 0) {
  e.preventDefault();
  const step = e.shiftKey ? 10 : 1;
  const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
  const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
  const updates = useStore.getState().blocks
    .filter(b => selectedIds.has(b.id))
    .map(b => {
      const isLinear = b.type === 'shape' && ['arrow','line','freedraw'].includes(b.shapeKind ?? '');
      return isLinear
        ? { id: b.id, updates: { points: (b.points ?? []).map(([px, py]) => [px + dx, py + dy] as [number, number]) } }
        : { id: b.id, updates: { x: (b.x ?? 0) + dx, y: (b.y ?? 0) + dy } };
    });
  useStore.getState().updateCanvasBlocks(updates);
  scheduleNudgeHistoryPush(); // debounced 500ms → one undo step per burst
}
```

`scheduleNudgeHistoryPush` = `useRef` timeout that calls `history.push(...)` 500ms after the last nudge.

- [ ] **Step 3: Escape chain + cursors**

Escape handler ordering (single `if/else` chain in the keydown handler): (1) if editing text/label → blur (handled by textarea, but also clear `editingTextId`); (2) else if `editingBlockId` (waypoint edit) → exit edit; (3) else if a drawing tool is active → `setActiveTool('select')`; (4) else if selection non-empty → clear selection. Cursors on the canvas container: `crosshair` for rect/ellipse/diamond/arrow/line/freedraw/text/frame tools, `cell` for eraser (Task 9), `grab` for pan, default for select — one `cn()` expression on the container keyed off `activeTool`.

- [ ] **Step 4: Verify + commit**

Dev app: Alt+drag a bound pair (two shapes + arrow, all selected) → full copy with working internal binding; nudge with arrows (1px) / Shift (10px), single undo per burst; Escape walks the chain.

```bash
git add -A && git commit -m "feat(canvas): alt-drag duplicate, arrow-key nudge, escape chain, tool cursors"
```

---

### Task 12: .flowr serializer (Excalidraw-compatible)

Lossless round-trip between store blocks and Excalidraw-schema JSON.

**Files:**
- Create: `src/lib/canvas/flowrFile.ts`
- Test: `src/lib/canvas/flowrFile.test.ts`

**Interfaces:**
- Consumes: `EditorBlock`, `Entity` types.
- Produces:
  - `serializeCanvas(entity: { id: string; title: string }, blocks: EditorBlock[]): string` — pretty-printed JSON.
  - `parseFlowrFile(json: string): { entityId?: string; title?: string; blocks: EditorBlock[] } ` — throws `Error('invalid-flowr-file')` on unparseable/wrong-type input.
  - Mapping table (both directions):
    | Store | Excalidraw element |
    |---|---|
    | `type:'shape', shapeKind:'rect'` | `type:'rectangle'` |
    | `shapeKind:'ellipse'/'diamond'/'line'/'arrow'/'freedraw'` | same-name types |
    | `type:'text'` | `type:'text'` (`text`, `fontSize`, `textAlign`, `containerId`) |
    | `type:'image'`/`'video'` | `type:'image'` (+`customData.flowr.kind='video'`, `customData.flowr.src=mediaUrl`) |
    | `type:'frame'` | `type:'frame'` (`name` ← `content`) |
    | `canvasStyleExt.stroke/fill/strokeWidth/strokeStyle/opacity/cornerRadius/rotation(deg)` | `strokeColor/backgroundColor/strokeWidth/strokeStyle/opacity(0-100)/roundness/angle(rad)` |
    | `points` absolute | `points` relative to element `x,y` (= path bbox min) |
    | `startBinding{blockId,focus,gap,fixedPoint}` | `startBinding{elementId,focus,gap,fixedPoint}` |
    | `groupId` | `groupIds:[groupId]` |
    | `parentId` (frame member) | `frameId` |
    | `zIndex` | array order (sorted by zIndex on write; index on read) |
    | `curved` | `roundness: {type:2}` on arrows |
    | `containerId` | `containerId` + container's `boundElements:[{id,type:'text'}]` |

- [ ] **Step 1: Write failing round-trip tests**

```ts
// src/lib/canvas/flowrFile.test.ts
import { describe, it, expect } from 'vitest';
import { serializeCanvas, parseFlowrFile } from './flowrFile';
import type { EditorBlock } from '@/data/store.types';

const blocks: EditorBlock[] = [
  { id: 'r1', type: 'shape', shapeKind: 'rect', content: '', canvasId: 'c1', x: 100, y: 100, width: 200, height: 100, zIndex: 0,
    canvasStyleExt: { stroke: '#e9e9e2', fill: '#d38f36', fillOpacity: 1, strokeWidth: 2, strokeStyle: 'solid', cornerRadius: 8, rotation: 45 } },
  { id: 't1', type: 'text', content: 'Label', canvasId: 'c1', x: 150, y: 130, width: 60, height: 25, zIndex: 1,
    fontSize: 20, textAlign: 'center', containerId: 'r1', canvasStyleExt: { stroke: '#ffffff' } },
  { id: 'a1', type: 'shape', shapeKind: 'arrow', content: '', canvasId: 'c1', x: 0, y: 0, width: 0, height: 0, zIndex: 2,
    points: [[320, 150], [420, 150]], curved: true,
    endBinding: { blockId: 'r1', focus: 0.25, gap: 4 },
    endArrowhead: { type: 'filled-triangle', size: 1 } },
  { id: 'f1', type: 'frame', content: 'My Section', canvasId: 'c1', x: 0, y: 300, width: 500, height: 300, zIndex: 3 },
  { id: 'r2', type: 'shape', shapeKind: 'ellipse', content: '', canvasId: 'c1', x: 50, y: 350, width: 80, height: 80, zIndex: 4, parentId: 'f1' },
];

describe('.flowr round trip', () => {
  const json = serializeCanvas({ id: 'c1', title: 'Test Canvas' }, blocks);

  it('produces excalidraw-typed JSON with a flowr key', () => {
    const doc = JSON.parse(json);
    expect(doc.type).toBe('excalidraw');
    expect(doc.source).toBe('flowr');
    expect(doc.flowr.entityId).toBe('c1');
    expect(doc.elements).toHaveLength(5);
  });

  it('maps element types and styles to excalidraw names', () => {
    const doc = JSON.parse(json);
    const rect = doc.elements.find((e: any) => e.id === 'r1');
    expect(rect.type).toBe('rectangle');
    expect(rect.strokeColor).toBe('#e9e9e2');
    expect(rect.backgroundColor).toBe('#d38f36');
    expect(rect.angle).toBeCloseTo(Math.PI / 4, 5);
    const text = doc.elements.find((e: any) => e.id === 't1');
    expect(text.containerId).toBe('r1');
    expect(rect.boundElements).toEqual([{ id: 't1', type: 'text' }]);
    const arrow = doc.elements.find((e: any) => e.id === 'a1');
    expect(arrow.endBinding.elementId).toBe('r1');
    expect(arrow.x).toBe(320); // bbox min
    expect(arrow.points[0]).toEqual([0, 0]); // relative
    const ell = doc.elements.find((e: any) => e.id === 'r2');
    expect(ell.frameId).toBe('f1');
    const frame = doc.elements.find((e: any) => e.id === 'f1');
    expect(frame.name).toBe('My Section');
  });

  it('round-trips losslessly', () => {
    const parsed = parseFlowrFile(json);
    expect(parsed.entityId).toBe('c1');
    const byId = Object.fromEntries(parsed.blocks.map(b => [b.id, b]));
    expect(byId['r1'].shapeKind).toBe('rect');
    expect(byId['r1'].canvasStyleExt?.rotation).toBeCloseTo(45, 4);
    expect(byId['r1'].canvasStyleExt?.cornerRadius).toBe(8);
    expect(byId['t1'].containerId).toBe('r1');
    expect(byId['t1'].fontSize).toBe(20);
    expect(byId['a1'].points).toEqual([[320, 150], [420, 150]]); // absolute again
    expect(byId['a1'].endBinding).toMatchObject({ blockId: 'r1', focus: 0.25, gap: 4 });
    expect(byId['a1'].curved).toBe(true);
    expect(byId['r2'].parentId).toBe('f1');
    expect(byId['f1'].content).toBe('My Section');
    expect(parsed.blocks.map(b => b.zIndex)).toEqual([0, 1, 2, 3, 4]);
  });

  it('rejects garbage', () => {
    expect(() => parseFlowrFile('not json')).toThrow('invalid-flowr-file');
    expect(() => parseFlowrFile('{"type":"something-else"}')).toThrow('invalid-flowr-file');
  });

  it('preserves unknown element types untouched (forward compat)', () => {
    const doc = JSON.parse(json);
    doc.elements.push({ id: 'x9', type: 'magicwand', x: 1, y: 2, custom: true });
    const reparsed = parseFlowrFile(JSON.stringify(doc));
    const rejson = JSON.parse(serializeCanvas({ id: 'c1', title: 'T' }, reparsed.blocks));
    expect(rejson.elements.find((e: any) => e.id === 'x9')).toMatchObject({ type: 'magicwand', custom: true });
  });
});
```

- [ ] **Step 2: Run to verify fail**

`npx vitest run src/lib/canvas/flowrFile.test.ts` → FAIL.

- [ ] **Step 3: Implement**

```ts
// src/lib/canvas/flowrFile.ts
import type { EditorBlock, ShapeKind, ArrowBinding } from '@/data/store.types';

const SHAPE_TO_EXCALIDRAW: Record<ShapeKind, string> = {
  rect: 'rectangle', ellipse: 'ellipse', diamond: 'diamond',
  line: 'line', arrow: 'arrow', freedraw: 'freedraw',
};
const EXCALIDRAW_TO_SHAPE: Record<string, ShapeKind> = Object.fromEntries(
  Object.entries(SHAPE_TO_EXCALIDRAW).map(([k, v]) => [v, k as ShapeKind]),
);
const LINEAR: ShapeKind[] = ['line', 'arrow', 'freedraw'];

const mapBindingOut = (b?: ArrowBinding) => b ? { elementId: b.blockId, focus: b.focus ?? null, gap: b.gap ?? null, fixedPoint: b.fixedPoint ?? null } : null;
const mapBindingIn = (b: any): ArrowBinding | undefined => b?.elementId ? {
  blockId: b.elementId,
  ...(b.focus != null ? { focus: b.focus } : {}),
  ...(b.gap != null ? { gap: b.gap } : {}),
  ...(b.fixedPoint != null ? { fixedPoint: b.fixedPoint as [number, number] } : {}),
} : undefined;

function blockToElement(b: EditorBlock, all: EditorBlock[]): Record<string, unknown> {
  const s = b.canvasStyleExt ?? {};
  const boundText = all.find(t => t.type === 'text' && t.containerId === b.id);
  const base: Record<string, unknown> = {
    id: b.id,
    x: b.x ?? 0, y: b.y ?? 0,
    width: b.width ?? 0, height: b.height ?? 0,
    angle: ((s.rotation ?? 0) * Math.PI) / 180,
    strokeColor: s.stroke ?? '#e9e9e2',
    backgroundColor: (s.fill && (s.fillOpacity ?? 1) > 0) ? s.fill : 'transparent',
    fillStyle: 'solid',
    strokeWidth: s.strokeWidth ?? 1,
    strokeStyle: s.strokeStyle ?? 'solid',
    roughness: 0,
    opacity: Math.round((s.opacity ?? 1) * 100),
    groupIds: b.groupId ? [b.groupId] : [],
    frameId: b.parentId ?? null,
    locked: s.locked ?? false,
    isDeleted: false,
    boundElements: boundText ? [{ id: boundText.id, type: 'text' }] : null,
  };

  if (b.type === 'shape' && b.shapeKind) {
    base.type = SHAPE_TO_EXCALIDRAW[b.shapeKind];
    if (LINEAR.includes(b.shapeKind)) {
      const pts = b.points ?? [];
      const minX = Math.min(...pts.map(p => p[0]), Infinity);
      const minY = Math.min(...pts.map(p => p[1]), Infinity);
      const ox = Number.isFinite(minX) ? minX : 0, oy = Number.isFinite(minY) ? minY : 0;
      base.x = ox; base.y = oy;
      base.points = pts.map(p => [p[0] - ox, p[1] - oy]);
      base.startBinding = mapBindingOut(b.startBinding);
      base.endBinding = mapBindingOut(b.endBinding);
      base.startArrowhead = b.startArrowhead?.type && b.startArrowhead.type !== 'none' ? 'triangle' : null;
      base.endArrowhead = b.endArrowhead?.type && b.endArrowhead.type !== 'none' ? 'triangle' : null;
      base.roundness = b.curved ? { type: 2 } : null;
      base.customData = { flowr: { startArrowhead: b.startArrowhead ?? null, endArrowhead: b.endArrowhead ?? null } };
    } else {
      base.roundness = s.cornerRadius ? { type: 3, value: s.cornerRadius } : null;
    }
  } else if (b.type === 'text') {
    base.type = 'text';
    base.text = b.content ?? '';
    base.fontSize = b.fontSize ?? 20;
    base.fontFamily = 1;
    base.textAlign = b.textAlign ?? 'left';
    base.verticalAlign = b.containerId ? 'middle' : 'top';
    base.containerId = b.containerId ?? null;
  } else if (b.type === 'image' || b.type === 'video') {
    base.type = 'image';
    base.fileId = b.id;
    base.status = 'saved';
    base.customData = { flowr: { kind: b.type, src: b.mediaUrl ?? null } };
  } else if (b.type === 'frame') {
    base.type = 'frame';
    base.name = b.content || 'Section';
    base.frameId = null;
  } else {
    // Unknown-to-us block preserved via passthrough (see parse) — serialize raw
    return { ...(b as any).__raw, id: b.id };
  }
  return base;
}

function elementToBlock(el: any, index: number, canvasId: string): EditorBlock {
  const style = {
    stroke: el.strokeColor,
    fill: el.backgroundColor,
    fillOpacity: el.backgroundColor === 'transparent' ? 0 : 1,
    strokeWidth: el.strokeWidth,
    strokeStyle: el.strokeStyle,
    opacity: (el.opacity ?? 100) / 100,
    rotation: ((el.angle ?? 0) * 180) / Math.PI,
    locked: el.locked ?? false,
    ...(el.roundness?.value ? { cornerRadius: el.roundness.value } : {}),
  };
  const common: EditorBlock = {
    id: el.id, type: 'shape', content: '', canvasId,
    x: el.x ?? 0, y: el.y ?? 0, width: el.width ?? 0, height: el.height ?? 0,
    zIndex: index,
    canvasStyleExt: style,
    ...(el.groupIds?.[0] ? { groupId: el.groupIds[0] } : {}),
    ...(el.frameId ? { parentId: el.frameId } : {}),
  };
  if (EXCALIDRAW_TO_SHAPE[el.type]) {
    const shapeKind = EXCALIDRAW_TO_SHAPE[el.type];
    const block: EditorBlock = { ...common, shapeKind };
    if (LINEAR.includes(shapeKind)) {
      block.points = (el.points ?? []).map((p: [number, number]) => [p[0] + (el.x ?? 0), p[1] + (el.y ?? 0)] as [number, number]);
      block.x = 0; block.y = 0; block.width = 0; block.height = 0;
      block.startBinding = mapBindingIn(el.startBinding);
      block.endBinding = mapBindingIn(el.endBinding);
      block.curved = el.roundness?.type === 2 ? true : undefined;
      const flowrHeads = el.customData?.flowr;
      block.startArrowhead = flowrHeads?.startArrowhead ?? (el.startArrowhead ? { type: 'filled-triangle', size: 1 } : { type: 'none' });
      block.endArrowhead = flowrHeads?.endArrowhead ?? (el.endArrowhead ? { type: 'filled-triangle', size: 1 } : { type: 'none' });
    }
    return block;
  }
  if (el.type === 'text') {
    return {
      ...common, type: 'text', content: el.text ?? '',
      fontSize: el.fontSize ?? 20, textAlign: el.textAlign ?? 'left',
      ...(el.containerId ? { containerId: el.containerId } : {}),
    };
  }
  if (el.type === 'image') {
    const kind = el.customData?.flowr?.kind === 'video' ? 'video' : 'image';
    return { ...common, type: kind, content: '', mediaUrl: el.customData?.flowr?.src ?? undefined };
  }
  if (el.type === 'frame') {
    return { ...common, type: 'frame', content: el.name ?? 'Section' };
  }
  // Unknown element: preserve raw for lossless re-serialization
  return { ...common, type: 'shape', shapeKind: undefined, __raw: el } as EditorBlock & { __raw: unknown };
}

export function serializeCanvas(entity: { id: string; title: string }, blocks: EditorBlock[]): string {
  const sorted = [...blocks].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
  return JSON.stringify({
    type: 'excalidraw',
    version: 2,
    source: 'flowr',
    elements: sorted.map(b => blockToElement(b, sorted)),
    appState: { viewBackgroundColor: '#141413' },
    files: {},
    flowr: { formatVersion: 1, entityId: entity.id, title: entity.title },
  }, null, 2);
}

export function parseFlowrFile(json: string): { entityId?: string; title?: string; blocks: EditorBlock[] } {
  let doc: any;
  try { doc = JSON.parse(json); } catch { throw new Error('invalid-flowr-file'); }
  if (!doc || doc.type !== 'excalidraw' || !Array.isArray(doc.elements)) throw new Error('invalid-flowr-file');
  const canvasId = doc.flowr?.entityId ?? '';
  return {
    entityId: doc.flowr?.entityId,
    title: doc.flowr?.title,
    blocks: doc.elements.map((el: any, i: number) => elementToBlock(el, i, canvasId)),
  };
}
```

Adjust during implementation until tests pass exactly (e.g. the unknown-type passthrough: `blockToElement` must return `(b as any).__raw` merged with current id when `__raw` exists — put that check FIRST in `blockToElement`).

- [ ] **Step 4: Run tests**

`npx vitest run src/lib/canvas/flowrFile.test.ts` → PASS. `npx tsc --noEmit` (the `__raw` cast may need `// eslint-disable` or a `RawElement` helper type — keep it typed as `EditorBlock & { __raw?: unknown }` via a local interface).

- [ ] **Step 5: Commit**

```bash
git add src/lib/canvas/flowrFile.ts src/lib/canvas/flowrFile.test.ts src/data/store.types.ts
git commit -m "feat(canvas): .flowr excalidraw-compatible serializer with lossless round-trip"
```

---

### Task 13: Vault sync — canvases persist as .flowr files

Replace the legacy `.canvas` raw-JSON path with `.flowr` in both directions (write-on-change, read-on-external-change), with the same protections notes have.

**Files:**
- Modify: `src/lib/persistence.ts` (`saveEntityToFile` canvas branch → `.flowr` + `serializeCanvas`)
- Modify: `src/lib/vaultSyncBridge.ts` (accept `.flowr`, drop `.canvas`)
- Modify: `src/lib/fileVault.ts` (`getEntityPath` extension for canvas entities → `.flowr`)
- Modify: `src/lib/syncFileScan.ts` (scan includes `*.flowr`)
- Test: extend `src/lib/persistence.test.ts` with a canvas→file naming/serialization case if the existing test structure supports it (it tests persistence pure functions — follow its patterns).

**Interfaces:**
- Consumes: Task 12's `serializeCanvas`/`parseFlowrFile`; existing `recordLocalWrite`, `getEntityPath`, `flowrFS`.
- Produces: canvas entities with `syncMode !== 'cloud-only'` write `<vault>/<path>/<title>.flowr` on change; external `.flowr` edits update the store; invalid `.flowr` files are logged and left untouched (never overwritten, never imported).

- [ ] **Step 1: Locate the write path**

`grep -n "canvas" src/lib/persistence.ts src/lib/fileVault.ts src/lib/syncFileScan.ts` — find where canvas entities currently serialize (the `.canvas` JSON `{entity, blocks}` writer) and where extensions are decided. Read those regions before editing.

- [ ] **Step 2: Write side**

In `fileVault.ts` `getEntityPath` (or wherever the extension is chosen): canvas-type entities → `.flowr`. In `persistence.ts` canvas branch: content becomes `serializeCanvas({ id: entity.id, title: entity.title }, blocksForCanvas)` where `blocksForCanvas = useStore.getState().blocks.filter(b => b.canvasId === entity.id)` (match how the caller currently supplies blocks — if `saveEntityToFile(entity, blocks)` already receives them, use the parameter). Keep `recordLocalWrite(absolutePath)` before writing (loopback guard). Debounce: reuse whatever debounce the note path has (same call chain).

- [ ] **Step 3: Read side**

In `vaultSyncBridge.ts` `handleLocalFileChanged`:
- Extension gate (line ~82): `if (!filename.endsWith('.md') && !filename.endsWith('.flowr')) return;` — `.canvas` no longer recognized.
- Replace the `.canvas` block (lines ~86–118) with:

```ts
if (filename.endsWith('.flowr')) {
  try {
    const { parseFlowrFile } = await import('./canvas/flowrFile');
    const parsed = parseFlowrFile(fileContent);
    const title = parsed.title || titleFromFilename;
    if (parsed.entityId) {
      const existing = state.entities.find(e => e.id === parsed.entityId);
      if (existing) {
        if (existing.title !== title) state.renameEntity(existing.id, title);
        state.replaceCanvasBlocks(existing.id, parsed.blocks); // see below
      } else {
        state.addEntity({ id: parsed.entityId, title, type: 'canvas', parentId: null, syncMode: 'full-sync', lastModified: Date.now() });
        state.replaceCanvasBlocks(parsed.entityId, parsed.blocks);
      }
    } else {
      // Foreign .excalidraw-style file dropped into the vault: import as new canvas
      const newId = state.addEntity({ title, type: 'canvas', parentId: null, syncMode: 'full-sync' });
      state.replaceCanvasBlocks(newId, parsed.blocks.map(b => ({ ...b, canvasId: newId })));
    }
  } catch (e) {
    console.warn('[Sync Bridge] Invalid .flowr file, leaving untouched:', absolutePath, e);
  }
  return;
}
```

Add store action `replaceCanvasBlocks(canvasId: string, blocks: EditorBlock[])` — removes all blocks with that `canvasId` and inserts the new set with `canvasId` stamped (skip the replace when structurally equal to avoid write loops; compare `JSON.stringify` of the sorted id+updated fields, mirroring `isContentEqual`'s intent). Verify the canvas entity type literal: `grep -n "'canvas'" src/data/store.types.ts` for the exact `EntityType` value; use it.
- Also update the deletion matcher and `syncFileScan.ts` extension lists (`grep -n "\.canvas" src` → replace every canvas-file reference with `.flowr`).

- [ ] **Step 4: Verify**

`npx tsc --noEmit`, `npm test` → pass. Manual (Electron dev, sync mode on):
- Edit a canvas → `<title>.flowr` appears in the vault; contents start with `"type": "excalidraw"`.
- Edit the file externally (change a `strokeColor`) → the canvas updates in-app.
- Corrupt the file (truncate) → warning logged, app data intact, file not overwritten until the next in-app canvas edit.
- Rename the file to `.excalidraw` and open on excalidraw.com → elements render.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(canvas): sync canvases to the vault as .flowr files"
```

---

### Task 14: Split CanvasPage.tsx

Mechanical extraction — no behavior change. Target: `CanvasPage.tsx` under ~500 lines.

**Files:**
- Create: `src/hooks/useCanvasViewport.ts` (pan/zoom/space-drag state + wheel/pointer handlers + `viewportRef`)
- Create: `src/hooks/useCanvasKeyboard.ts` (all keydown handling: shortcuts, delete, nudge, escape chain, undo/redo bindings — receives callbacks)
- Create: `src/hooks/useBindingDrag.ts` (Task 5's `handleBindingDrag` + Task 4's hover state)
- Create: `src/components/canvas/CanvasBottomBar.tsx` (zoom controls, undo/redo, snap/layers/style toggles — the JSX around lines 1660–1840)
- Modify: `src/components/canvas/CanvasPage.tsx`

**Interfaces:**
- Consumes: everything already in CanvasPage.
- Produces: same rendered output; hooks return exactly the values the JSX consumed before (`{ viewport, viewportRef, handlers }` etc. — choose signatures by reading what the extracted code touches; keep them narrow).

- [ ] **Step 1: Extract one unit at a time**

Order: `CanvasBottomBar` (pure JSX + props) → `useCanvasViewport` → `useCanvasKeyboard` → `useBindingDrag`. After EACH extraction: `npx tsc --noEmit` → 0 errors, quick dev-app smoke (pan, zoom, draw, undo), commit:

```bash
git commit -am "refactor(canvas): extract <unit> from CanvasPage"
```

- [ ] **Step 2: Final check**

`wc -l src/components/canvas/CanvasPage.tsx` → ≤ ~600 (hard cap 700). `npm test` → pass.

---

### Task 15: Final verification against the spec

**Files:** none created; fixes as needed.

- [ ] **Step 1: Full automated pass**

Run: `npm test` → all pass. `npx tsc --noEmit` → 0 errors. `npm run build` → succeeds.

- [ ] **Step 2: Manual QA checklist (spec §3–§8)**

In the dev app, verify each and fix on the spot (each fix gets its own commit):
- [ ] Arrow: all 3 binding modes on rect, ellipse, diamond; gap visible; endpoints slide, never enter shapes
- [ ] Move/resize/rotate a bound shape → arrows follow; delete it → arrows freeze in place unbound
- [ ] Endpoint drag: rebind, unbind; undo/redo of all binding operations
- [ ] Text: tool click, double-click canvas, auto-grow, S/M/L/XL, align, color, empty-delete, corner-resize scales font
- [ ] Labels: shape label wraps + grows container; arrow label chip at midpoint; cascades (move/duplicate/delete)
- [ ] Sections: containment on drop, clip at border, move together, rename, no nesting, member vs section selection
- [ ] Comments: no trace in UI or shortcuts
- [ ] Eraser: mark-translucent, single undo step, Escape cancels, locked skipped
- [ ] Curved toggle; Alt+drag duplicate (with bindings and labels); nudge 1px/10px; Escape chain; tool cursors
- [ ] `.flowr`: file written, external edit imported, corrupt file protected, renamed `.excalidraw` opens on excalidraw.com

- [ ] **Step 3: Update patch notes**

Add a canvas overhaul entry to `src/data/patches.ts` following the existing entry format.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "chore(canvas): final QA fixes and patch notes for canvas overhaul"
```
