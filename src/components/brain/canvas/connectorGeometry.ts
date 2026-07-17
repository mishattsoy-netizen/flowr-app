import { computeElbowPoints } from '@/lib/geometry/arrowPath';

export type ConnectorSide = 'top' | 'right' | 'bottom' | 'left';

export interface NodeBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Default card border width (Tailwind `border` = 1px). Highlighted cards use 2px.
 * Attachment dots sit on the stroke midline so the border bisects each disc.
 */
export const NODE_BORDER_WIDTH = 1;

/** Radius of connector endpoint dots. */
export const CONNECTOR_DOT_R = 4;

/**
 * Point on the given side, centered on a border stroke of `borderWidth`.
 * With border-box sizing the outer edge is fixed; the stroke fills inward,
 * so midline is `borderWidth / 2` from the outer edge.
 */
export function connectorPoint(
  box: NodeBox,
  side: ConnectorSide,
  borderWidth: number = NODE_BORDER_WIDTH,
): { x: number; y: number } {
  const inset = borderWidth / 2;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  switch (side) {
    case 'top':    return { x: cx, y: box.y + inset };
    case 'right':  return { x: box.x + box.width - inset, y: cy };
    case 'bottom': return { x: cx, y: box.y + box.height - inset };
    case 'left':   return { x: box.x + inset, y: cy };
  }
}

const CORNER_RADIUS = 12;
/** Perpendicular run out of the node before any elbow may turn. */
export const EXIT_STUB = 20;

function outwardUnit(side: ConnectorSide): { x: number; y: number } {
  switch (side) {
    case 'top':    return { x: 0, y: -1 };
    case 'bottom': return { x: 0, y: 1 };
    case 'left':   return { x: -1, y: 0 };
    case 'right':  return { x: 1, y: 0 };
  }
}

/** Offset a canvas point outward along a connector side (for over-card stubs). */
export function offsetOutward(
  p: { x: number; y: number },
  side: ConnectorSide,
  stub: number = EXIT_STUB,
): { x: number; y: number } {
  switch (side) {
    case 'top':    return { x: p.x, y: p.y - stub };
    case 'bottom': return { x: p.x, y: p.y + stub };
    case 'left':   return { x: p.x - stub, y: p.y };
    case 'right':  return { x: p.x + stub, y: p.y };
  }
}

/**
 * Point stub-length outward from the connector, normal to `side`, so the
 * path never turns parallel to the card edge at the attachment point.
 */
function exitPoint(box: NodeBox, side: ConnectorSide, stub: number): { x: number; y: number } {
  return offsetOutward(connectorPoint(box, side), side, stub);
}

/** Drop intermediate points that sit on a straight axis-aligned run. */
function collapseColinear(pts: [number, number][]): [number, number][] {
  if (pts.length <= 2) return pts;
  const out: [number, number][] = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const [x0, y0] = out[out.length - 1];
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[i + 1];
    const sameX = Math.abs(x0 - x1) < 1e-6 && Math.abs(x1 - x2) < 1e-6;
    const sameY = Math.abs(y0 - y1) < 1e-6 && Math.abs(y1 - y2) < 1e-6;
    if (sameX || sameY) continue;
    // Degenerate zero-length hop
    if (Math.abs(x0 - x1) < 1e-6 && Math.abs(y0 - y1) < 1e-6) continue;
    out.push(pts[i]);
  }
  out.push(pts[pts.length - 1]);
  return out;
}

/**
 * Route between exit stubs with a single L-bend when possible (not a midpoint
 * Z with two unnecessary elbows). Prefers continuing the exit axis and
 * arriving perpendicular to the entry stub. Falls back to Z when both L
 * options reverse out of the exit side.
 */
function routeBetweenStubs(
  a: { x: number; y: number },
  fromSide: ConnectorSide,
  b: { x: number; y: number },
  toSide: ConnectorSide,
): [number, number][] {
  if (Math.abs(a.x - b.x) < 1e-6 || Math.abs(a.y - b.y) < 1e-6) {
    return [[a.x, a.y], [b.x, b.y]];
  }

  // HV: horizontal then vertical — last leg is vertical (good for top/bottom entry)
  const hv: [number, number][] = [[a.x, a.y], [b.x, a.y], [b.x, b.y]];
  // VH: vertical then horizontal — last leg is horizontal (good for left/right entry)
  const vh: [number, number][] = [[a.x, a.y], [a.x, b.y], [b.x, b.y]];

  const out = outwardUnit(fromSide);
  const inn = outwardUnit(toSide);

  function score(pts: [number, number][]): number {
    const first = { x: pts[1][0] - pts[0][0], y: pts[1][1] - pts[0][1] };
    const last = { x: pts[2][0] - pts[1][0], y: pts[2][1] - pts[1][1] };
    const fLen = Math.hypot(first.x, first.y) || 1;
    const lLen = Math.hypot(last.x, last.y) || 1;
    const fDot = (first.x / fLen) * out.x + (first.y / fLen) * out.y;
    // Arrive at b from outside along the entry normal when possible (lastDir · inn < 0)
    const lDot = (last.x / lLen) * inn.x + (last.y / lLen) * inn.y;
    // Prefer continue exit (fDot > 0), prefer not arriving from inside (lDot < 0 → -lDot > 0)
    // Slight preference for matching entry axis on the last leg when tied.
    const entryAxis =
      (toSide === 'left' || toSide === 'right')
        ? Math.abs(last.x) > Math.abs(last.y) ? 0.1 : 0
        : Math.abs(last.y) > Math.abs(last.x) ? 0.1 : 0;
    return fDot - lDot + entryAxis;
  }

  const hvScore = score(hv);
  const vhScore = score(vh);
  const best = hvScore >= vhScore ? hv : vh;
  const bestScore = Math.max(hvScore, vhScore);

  // Both L-routes reverse out of the exit → use classic Z (two elbows)
  if (bestScore < -0.5) {
    return computeElbowPoints([[a.x, a.y], [b.x, b.y]]);
  }
  return best;
}

/**
 * Turn a polyline's interior corners into quadratic-curve rounds (constant
 * radius, clamped to half the shorter of the two adjacent segments so short
 * segments don't produce an overshooting curve). Endpoints are left as-is.
 */
function roundCorners(pts: [number, number][], radius: number): string {
  if (pts.length < 3) return 'M ' + pts.map(p => `${p[0]} ${p[1]}`).join(' L ');
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i - 1];
    const [cx, cy] = pts[i];
    const [nx, ny] = pts[i + 1];
    const distIn = Math.hypot(cx - px, cy - py);
    const distOut = Math.hypot(nx - cx, ny - cy);
    const r = Math.min(radius, distIn / 2, distOut / 2);
    const inX = cx + (px - cx) * (r / (distIn || 1));
    const inY = cy + (py - cy) * (r / (distIn || 1));
    const outX = cx + (nx - cx) * (r / (distOut || 1));
    const outY = cy + (ny - cy) * (r / (distOut || 1));
    d += ` L ${inX} ${inY} Q ${cx} ${cy} ${outX} ${outY}`;
  }
  const last = pts[pts.length - 1];
  d += ` L ${last[0]} ${last[1]}`;
  return d;
}

/**
 * Build a rounded-elbow SVG path between two connector points on two node
 * boxes. Each end first runs outward perpendicular to its side (exit stub),
 * then L-routes between the stubs (one elbow when possible), then enters
 * the target with a matching stub.
 */
export function buildEdgePath(
  fromBox: NodeBox, fromSide: ConnectorSide,
  toBox: NodeBox, toSide: ConnectorSide,
): string {
  const a = connectorPoint(fromBox, fromSide);
  const b = connectorPoint(toBox, toSide);
  // Shrink stubs if nodes are very close so exits don't cross / overlap.
  const aOutFull = exitPoint(fromBox, fromSide, EXIT_STUB);
  const bOutFull = exitPoint(toBox, toSide, EXIT_STUB);
  const gap = Math.hypot(bOutFull.x - aOutFull.x, bOutFull.y - aOutFull.y);
  const stub = gap < EXIT_STUB * 2 ? Math.max(4, gap / 3) : EXIT_STUB;
  const aOut = exitPoint(fromBox, fromSide, stub);
  const bOut = exitPoint(toBox, toSide, stub);
  const mid = routeBetweenStubs(aOut, fromSide, bOut, toSide);
  const pts = collapseColinear([[a.x, a.y], ...mid, [b.x, b.y]]);
  return roundCorners(pts, CORNER_RADIUS);
}

/** Pick the pair of sides on two boxes that face each other most directly. */
export function closestSides(a: NodeBox, b: NodeBox): [ConnectorSide, ConnectorSide] {
  const dx = (b.x + b.width / 2) - (a.x + a.width / 2);
  const dy = (b.y + b.height / 2) - (a.y + a.height / 2);
  const aSide: ConnectorSide = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'right' : 'left') : (dy >= 0 ? 'bottom' : 'top');
  const bSide: ConnectorSide = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'left' : 'right') : (dy >= 0 ? 'top' : 'bottom');
  return [aSide, bSide];
}
