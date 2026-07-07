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

  it('with a waypoint present, moving one shape leaves the other endpoint and the waypoint fixed', () => {
    const s1 = shape({ id: 'A', x: 0, y: 0, width: 100, height: 100 });
    const s2 = shape({ id: 'B', x: 300, y: 0, width: 100, height: 100 });
    const arrow: EditorBlock = {
      id: 'ar', type: 'shape', shapeKind: 'arrow', content: '', canvasId: 'c1',
      x: 0, y: 0, width: 0, height: 0, points: [[200, 50]],
      startBinding: { blockId: 'A', focus: 0.5, gap: 4 },
      endBinding: { blockId: 'B', focus: 0.5, gap: 4 },
    };
    const before = resolvePoints(arrow, [s1, s2, arrow]);
    // Move only shape B: A's endpoint aims at the waypoint (unchanged), so it must not move.
    const s2moved = { ...s2, x: 350, y: 80 };
    const after = resolvePoints(arrow, [s1, s2moved, arrow]);
    expect(after[0][0]).toBeCloseTo(before[0][0], 4);
    expect(after[0][1]).toBeCloseTo(before[0][1], 4);
    expect(after[1]).toEqual([200, 50]); // waypoint untouched
  });

  it('overlapping bound shapes still resolve to finite, sane endpoints (no flip to far edges)', () => {
    const s1 = shape({ id: 'A', x: 0, y: 0, width: 200, height: 200 });
    // B dragged to heavily overlap A
    const s2 = shape({ id: 'B', x: 100, y: 50, width: 200, height: 200 });
    const arrow: EditorBlock = {
      id: 'ar', type: 'shape', shapeKind: 'arrow', content: '', canvasId: 'c1',
      x: 0, y: 0, width: 0, height: 0, points: [],
      startBinding: { blockId: 'A', focus: 0.5, gap: 4 },
      endBinding: { blockId: 'B', focus: 0.5, gap: 4 },
    };
    const pts = resolvePoints(arrow, [s1, s2, arrow]);
    expect(pts.length).toBe(2);
    for (const p of pts) {
      expect(Number.isFinite(p[0])).toBe(true);
      expect(Number.isFinite(p[1])).toBe(true);
    }
    // Endpoints aim at each other's centers, so both must sit between the two centers —
    // start clipped on A's outline toward B's center (right/downward), not flipped away.
    expect(pts[0][0]).toBeGreaterThanOrEqual(100 - 6); // toward B's center (200,150)
    expect(pts[1][0]).toBeLessThanOrEqual(200 + 6);    // toward A's center (100,100)
  });
});
