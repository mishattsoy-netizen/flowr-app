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
    const p = intersectSegmentWithOutline('rect', rect, [0, 0], [150, 150], 0, 20);
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
