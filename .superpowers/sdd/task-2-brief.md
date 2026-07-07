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

