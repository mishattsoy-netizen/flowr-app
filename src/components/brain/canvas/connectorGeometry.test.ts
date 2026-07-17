import { describe, it, expect } from 'vitest';
import {
  connectorPoint,
  buildEdgePath,
  type ConnectorSide,
  type NodeBox,
} from './connectorGeometry';

describe('connectorPoint', () => {
  const box: NodeBox = { x: 100, y: 80, width: 200, height: 120 };

  it('returns center of top edge', () => {
    const p = connectorPoint(box, 'top');
    expect(p.x).toBe(200);  // 100 + 200/2
    expect(p.y).toBe(80);   // 80 (top edge y)
  });

  it('returns center of right edge', () => {
    const p = connectorPoint(box, 'right');
    expect(p.x).toBe(300);  // 100 + 200
    expect(p.y).toBe(140);  // 80 + 120/2
  });

  it('returns center of bottom edge', () => {
    const p = connectorPoint(box, 'bottom');
    expect(p.x).toBe(200);
    expect(p.y).toBe(200);  // 80 + 120
  });

  it('returns center of left edge', () => {
    const p = connectorPoint(box, 'left');
    expect(p.x).toBe(100);
    expect(p.y).toBe(140);
  });
});

describe('buildEdgePath', () => {
  it('returns an SVG path string with 4 elbow vertices', () => {
    const a: NodeBox = { x: 0, y: 0, width: 200, height: 100 };
    const b: NodeBox = { x: 400, y: 200, width: 200, height: 100 };
    const path = buildEdgePath(a, 'right', b, 'left');
    // Path should start with M (move) and contain L (line) segments
    expect(path).toMatch(/^M [\d.]+ [\d.]+ L/);
    // Should have 4 coordinate pairs (start→elbow→elbow→end)
    const coords = path.match(/[\d.]+ [\d.]+/g);
    expect(coords).toHaveLength(4);
  });

  it('returns a valid SVG path for same-axis nodes', () => {
    const a: NodeBox = { x: 0, y: 100, width: 200, height: 100 };
    const b: NodeBox = { x: 400, y: 100, width: 200, height: 100 };
    const path = buildEdgePath(a, 'right', b, 'left');
    // Axis-aligned: straight line, only start + end
    const coords = path.match(/[\d.]+ [\d.]+/g);
    expect(coords).toHaveLength(2);
  });
});
