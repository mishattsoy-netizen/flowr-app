export function calculateCatmullRomPath(points: [number, number][]): string {
  if (points.length < 2) return "";
  if (points.length === 2) {
    return `M ${points[0][0]} ${points[0][1]} L ${points[1][0]} ${points[1][1]}`;
  }

  // Add virtual points at start and end to handle boundaries
  const p = [...points];
  p.unshift([p[0][0] - (p[1][0] - p[0][0]), p[0][1] - (p[1][1] - p[0][1])]);
  p.push([p[p.length-1][0] + (p[p.length-1][0] - p[p.length-2][0]), p[p.length-1][1] + (p[p.length-1][1] - p[p.length-2][1])]);

  let path = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 1; i < p.length - 2; i++) {
    const p0 = p[i - 1], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2];
    
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
    
    path += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2[0]} ${p2[1]}`;
  }
  return path;
}

export function calculateAdvancedPath(points: [number, number][], radiuses: number[]): string {
  if (points.length < 2) return "";
  if (points.length === 2) return `M ${points[0][0]} ${points[0][1]} L ${points[1][0]} ${points[1][1]}`;

  let d = `M ${points[0][0]} ${points[0][1]}`;

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];

    if (!next) { d += ` L ${curr[0]} ${curr[1]}`; break; }

    const r = radiuses[i] ?? 20;
    if (r <= 0.5) { d += ` L ${curr[0]} ${curr[1]}`; continue; }

    const dx1 = prev[0] - curr[0], dy1 = prev[1] - curr[1];
    const dx2 = next[0] - curr[0], dy2 = next[1] - curr[1];
    const len1 = Math.hypot(dx1, dy1), len2 = Math.hypot(dx2, dy2);
    if (len1 < 0.001 || len2 < 0.001) { d += ` L ${curr[0]} ${curr[1]}`; continue; }

    const cosAngle = Math.max(-1, Math.min(1, (dx1 * dx2 + dy1 * dy2) / (len1 * len2)));
    const angle = Math.acos(cosAngle);
    const maxR = Math.min(r, len1 * 0.99, len2 * 0.99, (r / Math.tan(angle / 2)) * 0.99);
    const t1 = maxR / len1, t2 = maxR / len2;
    const sx = curr[0] + dx1 * t1, sy = curr[1] + dy1 * t1;
    const ex = curr[0] + dx2 * t2, ey = curr[1] + dy2 * t2;

    d += ` L ${sx.toFixed(2)} ${sy.toFixed(2)}`;
    d += ` Q ${curr[0]} ${curr[1]} ${ex.toFixed(2)} ${ey.toFixed(2)}`;
  }

  return d;
}
