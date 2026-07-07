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

