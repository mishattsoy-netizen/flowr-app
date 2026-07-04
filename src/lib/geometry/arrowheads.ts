// Excalidraw-style arrowhead geometry: heads are drawn as their own filled/stroked SVG
// paths in the same coordinate space as the line, not as SVG <marker> elements. Markers
// rotate via `orient="auto"`, which reads the tangent of the last infinitesimal segment of
// the path — when a waypoint is dragged close to the tip, that segment shrinks toward zero
// length and the computed angle becomes unstable (the head visibly spins/detaches). Building
// the head directly as a small polygon from a stable direction vector avoids that entirely,
// and also lets outline styles omit the line's own stroke from poking through the head (no
// more "neck" visible inside an outlined triangle) and lets the head scale with stroke width.
import type { ArrowheadType } from '@/data/store.types';

export interface ArrowheadGeometry {
  /** Fill/stroke polygon or path data for the head shape, already positioned at the tip. */
  d: string;
  fill: 'stroke' | 'none';
  /** How far back along the line the head shape extends — the line itself must be trimmed
   * by (at least) this much so the stroke doesn't poke through a filled head. */
  length: number;
}

/** Walk backward from the tip through `pts` to find a direction vector unaffected by
 * near-zero-length final segments (e.g. a waypoint dragged to sit almost on top of the tip). */
function stableDirection(pts: [number, number][], tipIndex: number, step: 1 | -1): [number, number] {
  const tip = pts[tipIndex];
  const MIN_DIST = 4;
  let i = tipIndex + step;
  while (i >= 0 && i < pts.length) {
    const dx = pts[i][0] - tip[0];
    const dy = pts[i][1] - tip[1];
    const dist = Math.hypot(dx, dy);
    if (dist >= MIN_DIST) return [dx / dist, dy / dist];
    i += step;
  }
  // All segments degenerate (a fully collapsed line) — arbitrary stable fallback.
  return [1, 0];
}

/** Unit direction pointing FROM the line INTO the arrowhead tip, for the end of `pts`. */
export function endDirection(pts: [number, number][]): [number, number] {
  const [dx, dy] = stableDirection(pts, pts.length - 1, -1);
  return [-dx, -dy];
}

/** Unit direction pointing FROM the line INTO the arrowhead tip, for the start of `pts`. */
export function startDirection(pts: [number, number][]): [number, number] {
  const [dx, dy] = stableDirection(pts, 0, 1);
  return [-dx, -dy];
}

/**
 * Builds the SVG path `d` for one arrowhead, positioned with its tip at `tip` and pointing
 * along unit vector `dir` (pointing away from the line, into the head). `size` is the raw
 * stroke width the head should visually scale with (not the old size-multiplier field).
 */
export function buildArrowheadGeometry(type: ArrowheadType, tip: [number, number], dir: [number, number], strokeWidth: number): ArrowheadGeometry | null {
  if (type === 'none') return null;
  const [ux, uy] = dir;
  // Perpendicular unit vector.
  const px = -uy, py = ux;
  const scale = Math.max(1, strokeWidth);
  const [tx, ty] = tip;

  if (type === 'circle') {
    const r = 3 * scale;
    const cx = tx - ux * r, cy = ty - uy * r;
    return {
      d: `M ${cx - r},${cy} A ${r},${r} 0 1 0 ${cx + r},${cy} A ${r},${r} 0 1 0 ${cx - r},${cy} Z`,
      fill: 'stroke',
      length: 2 * r,
    };
  }

  if (type === 'diamond') {
    const len = 7 * scale, half = 3.5 * scale;
    const back: [number, number] = [tx - ux * len, ty - uy * len];
    const mid: [number, number] = [tx - ux * (len / 2), ty - uy * (len / 2)];
    const p1: [number, number] = [mid[0] + px * half, mid[1] + py * half];
    const p2: [number, number] = [mid[0] - px * half, mid[1] - py * half];
    return {
      d: `M ${tx},${ty} L ${p1[0]},${p1[1]} L ${back[0]},${back[1]} L ${p2[0]},${p2[1]} Z`,
      fill: 'stroke',
      length: len,
    };
  }

  // Triangle family (filled, outline, reverse-filled) and the default open chevron share the
  // same wingspan geometry; only fill/stroke and direction differ.
  const len = 9 * scale, half = 5 * scale;
  const back: [number, number] = [tx - ux * len, ty - uy * len];
  const p1: [number, number] = [back[0] + px * half, back[1] + py * half];
  const p2: [number, number] = [back[0] - px * half, back[1] - py * half];

  if (type === 'arrow') {
    // Open chevron (Excalidraw's default): two strokes meeting at the tip, no fill, and
    // — critically — no closing back edge, so there is no "neck" for the line to poke
    // through in the first place.
    return { d: `M ${p1[0]},${p1[1]} L ${tx},${ty} L ${p2[0]},${p2[1]}`, fill: 'none', length: len };
  }

  if (type === 'reverse-triangle') {
    // Filled triangle pointing backward along the line (wide end at the tip).
    const tipBack: [number, number] = [tx - ux * len, ty - uy * len];
    const wideP1: [number, number] = [tx + px * half, ty + py * half];
    const wideP2: [number, number] = [tx - px * half, ty - py * half];
    return { d: `M ${tipBack[0]},${tipBack[1]} L ${wideP1[0]},${wideP1[1]} L ${wideP2[0]},${wideP2[1]} Z`, fill: 'stroke', length: len };
  }

  // 'triangle' (outline) and 'filled-triangle' share the same closed wing shape.
  return {
    d: `M ${tx},${ty} L ${p1[0]},${p1[1]} L ${p2[0]},${p2[1]} Z`,
    fill: type === 'filled-triangle' ? 'stroke' : 'none',
    length: len,
  };
}
