import { describe, it, expect } from 'vitest';
import {
  connectorPoint,
  buildEdgePath,
  type ConnectorSide,
  type NodeBox,
} from './connectorGeometry';

describe('connectorPoint local vs canvas', () => {
  const sides: ConnectorSide[] = ['top', 'right', 'bottom', 'left'];

  it('canvas point equals position + local point for every side', () => {
    const box: NodeBox = { x: 50, y: 80, width: 280, height: 160 };
    const localBox: NodeBox = { x: 0, y: 0, width: box.width, height: box.height };
    for (const side of sides) {
      const local = connectorPoint(localBox, side);
      const canvas = connectorPoint(box, side);
      expect(canvas.x).toBe(box.x + local.x);
      expect(canvas.y).toBe(box.y + local.y);
    }
  });
});

describe('connectorPoint', () => {
  const box: NodeBox = { x: 100, y: 80, width: 200, height: 120 };
  // 1px border → attachment sits 0.5px inward so the stroke bisects the dot
  const inset = 0.5;

  it('returns center of top edge (border midline)', () => {
    const p = connectorPoint(box, 'top');
    expect(p.x).toBe(200);  // 100 + 200/2
    expect(p.y).toBe(80 + inset);
  });

  it('returns center of right edge (border midline)', () => {
    const p = connectorPoint(box, 'right');
    expect(p.x).toBe(300 - inset);
    expect(p.y).toBe(140);  // 80 + 120/2
  });

  it('returns center of bottom edge (border midline)', () => {
    const p = connectorPoint(box, 'bottom');
    expect(p.x).toBe(200);
    expect(p.y).toBe(200 - inset);  // 80 + 120 - inset
  });

  it('returns center of left edge (border midline)', () => {
    const p = connectorPoint(box, 'left');
    expect(p.x).toBe(100 + inset);
    expect(p.y).toBe(140);
  });
});

describe('buildEdgePath', () => {
  it('returns a rounded-corner SVG path (start, then L/Q pairs per bend, then end)', () => {
    const a: NodeBox = { x: 0, y: 0, width: 200, height: 100 };
    const b: NodeBox = { x: 400, y: 200, width: 200, height: 100 };
    const path = buildEdgePath(a, 'right', b, 'left');
    // Path should start with M (move), and use Q (quadratic curve) at each
    // interior elbow bend instead of a sharp L-only corner.
    expect(path).toMatch(/^M [\d.-]+ [\d.-]+/);
    expect(path).toContain('Q');
  });

  it('leaves a bottom connector straight down before any horizontal turn', () => {
    const a: NodeBox = { x: 0, y: 0, width: 200, height: 100 };
    const b: NodeBox = { x: 300, y: 200, width: 200, height: 100 };
    const path = buildEdgePath(a, 'bottom', b, 'left');
    // First point = bottom connector center; second = stub straight down (same x, larger y)
    const coords = [...path.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map(m => ({
      x: parseFloat(m[1]),
      y: parseFloat(m[2]),
    }));
    expect(coords.length).toBeGreaterThanOrEqual(2);
    expect(coords[0].x).toBe(100); // box center x
    expect(coords[0].y).toBe(99.5); // bottom border midline
    expect(coords[1].x).toBe(coords[0].x);
    expect(coords[1].y).toBeGreaterThan(coords[0].y);
  });

  it('leaves a right connector straight right before any vertical turn', () => {
    const a: NodeBox = { x: 0, y: 0, width: 200, height: 100 };
    const b: NodeBox = { x: 400, y: 200, width: 200, height: 100 };
    const path = buildEdgePath(a, 'right', b, 'left');
    const coords = [...path.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map(m => ({
      x: parseFloat(m[1]),
      y: parseFloat(m[2]),
    }));
    expect(coords[0].x).toBe(199.5);
    expect(coords[0].y).toBe(50);
    expect(coords[1].y).toBe(coords[0].y);
    expect(coords[1].x).toBeGreaterThan(coords[0].x);
  });

  it('returns a valid SVG path for same-axis nodes (with exit stubs)', () => {
    const a: NodeBox = { x: 0, y: 100, width: 200, height: 100 };
    const b: NodeBox = { x: 400, y: 100, width: 200, height: 100 };
    const path = buildEdgePath(a, 'right', b, 'left');
    expect(path).toMatch(/^M /);
    // Start on A's right border midline, end on B's left border midline
    const coords = [...path.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map(m => ({
      x: parseFloat(m[1]),
      y: parseFloat(m[2]),
    }));
    expect(coords[0].x).toBe(199.5);
    expect(coords[coords.length - 1].x).toBe(400.5);
  });

  it('uses an L-route for bottom→top offset nodes (no mid zigzag)', () => {
    // Top card bottom connector → bottom-right card top connector (the screenshot case)
    const a: NodeBox = { x: 0, y: 0, width: 200, height: 100 };
    const b: NodeBox = { x: 280, y: 220, width: 200, height: 100 };
    const path = buildEdgePath(a, 'bottom', b, 'top');
    // L between stubs + entry stub turn → 2 rounded corners. Midpoint-Z adds a
    // third unnecessary mid elbow (3+ Qs).
    const qCount = (path.match(/Q/g) ?? []).length;
    expect(qCount).toBe(2);
    const coords = [...path.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map(m => ({
      x: parseFloat(m[1]),
      y: parseFloat(m[2]),
    }));
    expect(coords[0]).toEqual({ x: 100, y: 99.5 });
    expect(coords[coords.length - 1]).toEqual({ x: 380, y: 220.5 });
    // First free run is vertical (continues down from bottom), not a horizontal
    // jog along the card — second sample shares x with start and is lower.
    expect(coords[1].x).toBe(100);
    expect(coords[1].y).toBeGreaterThan(99.5);
  });
});
