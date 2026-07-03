// Shared arrow/line path construction used by both the React renderer (VectorPath) and
// the imperative live-drag updaters (useDrag, CanvasBlock resize). Keeping this in one
// place guarantees the path a user sees mid-drag is identical to the one rendered after
// commit.
import { calculateCatmullRomPath, calculateAdvancedPath, calculatePolylinePath } from './splines';
import type { EditorBlock } from '@/data/store.types';

/**
 * Shorten the final segment of an SVG path string so the stroke ends short of the
 * arrowhead marker instead of poking through it. Token-level edit of the last x/y pair —
 * works for both polyline (M/L) and Catmull-Rom (C) output.
 */
export function trimPathEndForArrowhead(d: string, gap: number): string {
  if (!d) return d;
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

type ArrowPathBlock = Pick<EditorBlock, 'editMode' | 'pointRadiuses' | 'pathMode' | 'endArrowhead'>;

/**
 * The points that actually get stroked for a block — identical input for path building,
 * bounds computation, and label midpoint placement. Elbow mode re-routes; other modes
 * pass the resolved points through.
 */
export function computeRenderPoints(block: ArrowPathBlock, pts: [number, number][]): [number, number][] {
  return block.pathMode === 'elbow' ? computeElbowPoints(pts) : pts;
}

/** Full `d` for an arrow/line block from its resolved points, arrowhead trim included. */
export function buildArrowPathD(block: ArrowPathBlock, pts: [number, number][]): string {
  const renderPts = computeRenderPoints(block, pts);
  if (renderPts.length < 2) return '';
  const radiuses = block.pointRadiuses ?? [];
  const edge = (block.editMode === 'advanced' && radiuses.length > 0)
    ? calculateAdvancedPath(renderPts, radiuses)
    : block.pathMode === 'curved' ? calculateCatmullRomPath(renderPts) : calculatePolylinePath(renderPts);
  const headSize = block.endArrowhead?.size ?? 1;
  return trimPathEndForArrowhead(edge, 8 * headSize);
}
