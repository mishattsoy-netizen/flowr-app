import { computeElbowPoints } from '@/lib/geometry/arrowPath';

export type ConnectorSide = 'top' | 'right' | 'bottom' | 'left';

export interface NodeBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Return the center point of the given side of a node box. */
export function connectorPoint(box: NodeBox, side: ConnectorSide): { x: number; y: number } {
  switch (side) {
    case 'top':    return { x: box.x + box.width / 2, y: box.y };
    case 'right':  return { x: box.x + box.width,     y: box.y + box.height / 2 };
    case 'bottom': return { x: box.x + box.width / 2, y: box.y + box.height };
    case 'left':   return { x: box.x,                  y: box.y + box.height / 2 };
  }
}

/**
 * Build an SVG `M … L …` path string between two connector points on two node boxes.
 * Uses computeElbowPoints for Z-shaped routing. Returns straight line when already
 * axis-aligned. Path uses stroke-linejoin:round at render time for rounded corners.
 */
export function buildEdgePath(
  fromBox: NodeBox, fromSide: ConnectorSide,
  toBox: NodeBox, toSide: ConnectorSide,
): string {
  const a = connectorPoint(fromBox, fromSide);
  const b = connectorPoint(toBox, toSide);
  const elbowPts = computeElbowPoints([[a.x, a.y], [b.x, b.y]]);
  return 'M ' + elbowPts.map(p => `${p[0]} ${p[1]}`).join(' L ');
}
