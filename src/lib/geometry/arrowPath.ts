// Shared arrow/line path construction used by both the React renderer (VectorPath) and
// the imperative live-drag updaters (useDrag, CanvasBlock resize). Keeping this in one
// place guarantees the path a user sees mid-drag is identical to the one rendered after
// commit.
import { calculateCatmullRomPath, calculateAdvancedPath, calculatePolylinePath } from './splines';
import type { EditorBlock } from '@/data/store.types';
import { buildArrowheadGeometry, startDirection, endDirection } from './arrowheads';

/**
 * Shorten the final segment of an SVG path string so the stroke ends short of the
 * arrowhead marker instead of poking through it. Token-level edit of the last x/y pair —
 * works for both polyline (M/L) and Catmull-Rom (C) output. gap=0 is a safe no-op (used for
 * open/non-filled heads, which have nothing for the line to poke through).
 */
export function trimPathEndForArrowhead(d: string, gap: number): string {
  if (!d || gap <= 0) return d;
  const tokens = d.match(/[a-zA-Z]|-?\d+(?:\.\d+)?/g);
  if (!tokens || tokens.length < 4) return d;
  const len = tokens.length;
  const lx = parseFloat(tokens[len - 2]), ly = parseFloat(tokens[len - 1]);
  const px = parseFloat(tokens[len - 4]), py = parseFloat(tokens[len - 3]);
  if (isNaN(lx) || isNaN(ly) || isNaN(px) || isNaN(py)) return d;
  const dx = lx - px, dy = ly - py, dist = Math.hypot(dx, dy);
  if (dist === 0) return d;
  const ratio = Math.max(0, (dist - gap) / dist);
  tokens[len - 2] = (px + dx * ratio).toFixed(1);
  tokens[len - 1] = (py + dy * ratio).toFixed(1);
  return tokens.join(' ');
}

/** Same idea as trimPathEndForArrowhead but for the START of the path (the first M/L pair). */
export function trimPathStartForArrowhead(d: string, gap: number): string {
  if (!d || gap <= 0) return d;
  const tokens = d.match(/[a-zA-Z]|-?\d+(?:\.\d+)?/g);
  if (!tokens || tokens.length < 6 || tokens[0] !== 'M') return d;
  const fx = parseFloat(tokens[1]), fy = parseFloat(tokens[2]);
  // The next coordinate pair after the initial M — works whether the 2nd command is L or C's
  // first control point, since we only need "a point further along the path" to get direction.
  const nx = parseFloat(tokens[tokens[3] === 'C' ? 5 : 4]), ny = parseFloat(tokens[tokens[3] === 'C' ? 6 : 5]);
  if (isNaN(fx) || isNaN(fy) || isNaN(nx) || isNaN(ny)) return d;
  const dx = nx - fx, dy = ny - fy, dist = Math.hypot(dx, dy);
  if (dist === 0) return d;
  const ratio = Math.max(0, (dist - gap) / dist);
  tokens[1] = (fx + dx * ratio).toFixed(1);
  tokens[2] = (fy + dy * ratio).toFixed(1);
  return tokens.join(' ');
}

/**
 * Orthogonal (elbow) route between the path's endpoints: a Z-shaped run of axis-aligned
 * segments bending at the midpoint of the dominant axis. Manual waypoints are ignored in
 * elbow mode (matching Excalidraw, where elbow arrows own their routing).
 */
export function computeElbowPoints(pts: [number, number][]): [number, number][] {
  if (pts.length < 2) return pts;
  const [sx, sy] = pts[0];
  const [tx, ty] = pts[pts.length - 1];
  if (sx === tx || sy === ty) return [[sx, sy], [tx, ty]]; // already axis-aligned
  if (Math.abs(tx - sx) >= Math.abs(ty - sy)) {
    const mx = (sx + tx) / 2;
    return [[sx, sy], [mx, sy], [mx, ty], [tx, ty]];
  }
  const my = (sy + ty) / 2;
  return [[sx, sy], [sx, my], [tx, my], [tx, ty]];
}

type ArrowPathBlock = Pick<EditorBlock, 'editMode' | 'pointRadiuses' | 'pathMode' | 'startArrowhead' | 'endArrowhead' | 'canvasStyleExt'>;

/**
 * The points that actually get stroked for a block — identical input for path building,
 * bounds computation, and label midpoint placement. Elbow mode re-routes; other modes
 * pass the resolved points through.
 */
export function computeRenderPoints(block: Pick<ArrowPathBlock, 'pathMode'>, pts: [number, number][]): [number, number][] {
  return block.pathMode === 'elbow' ? computeElbowPoints(pts) : pts;
}

export interface ArrowPaths {
  /** The line itself, trimmed at each end so a filled head has no stroke poking through it. */
  line: string;
  startHead: { d: string; fill: 'stroke' | 'none' } | null;
  endHead: { d: string; fill: 'stroke' | 'none' } | null;
}

/**
 * Builds the line path plus each arrowhead's own path, all from the same resolved points —
 * used identically by the React renderer and every imperative live-drag updater so mid-gesture
 * and committed visuals are pixel-identical. Heads are separate geometry (not SVG <marker>s):
 * their angle is computed from a stable direction vector (see arrowheads.ts) so a waypoint
 * dragged near the tip can't make the head spin, and a filled head never shows the line's own
 * stroke inside it.
 */
export function buildArrowPaths(block: ArrowPathBlock, pts: [number, number][]): ArrowPaths {
  const renderPts = computeRenderPoints(block, pts);
  if (renderPts.length < 2) return { line: '', startHead: null, endHead: null };
  const radiuses = block.pointRadiuses ?? [];
  let edge = (block.editMode === 'advanced' && radiuses.length > 0)
    ? calculateAdvancedPath(renderPts, radiuses)
    : block.pathMode === 'curved' ? calculateCatmullRomPath(renderPts) : calculatePolylinePath(renderPts);

  const strokeWidth = block.canvasStyleExt?.strokeWidth ?? 2;
  const startType = block.startArrowhead?.type ?? 'none';
  const endType = block.endArrowhead?.type ?? 'none';

  const startGeo = buildArrowheadGeometry(startType, renderPts[0], startDirection(renderPts), strokeWidth);
  const endGeo = buildArrowheadGeometry(endType, renderPts[renderPts.length - 1], endDirection(renderPts), strokeWidth);

  if (startGeo && startGeo.fill === 'stroke') edge = trimPathStartForArrowhead(edge, startGeo.length);
  if (endGeo && endGeo.fill === 'stroke') edge = trimPathEndForArrowhead(edge, endGeo.length);

  return {
    line: edge,
    startHead: startGeo ? { d: startGeo.d, fill: startGeo.fill } : null,
    endHead: endGeo ? { d: endGeo.d, fill: endGeo.fill } : null,
  };
}

/** Line-only convenience wrapper for call sites that only need the stroked path (bounds,
 * hit-test computations) and don't render heads themselves. */
export function buildArrowPathD(block: ArrowPathBlock, pts: [number, number][]): string {
  return buildArrowPaths(block, pts).line;
}
