/**
 * Shared progress-bar fill colors across brain nodes, details panel,
 * left brain stats, and Settings → Usage.
 *
 * 0–60% brand blue · 60–80% amber · 80%+ red
 */
export function usageBarFillClass(pct: number): string {
  if (pct >= 80) return 'bg-red-400';
  if (pct >= 60) return 'bg-amber-400';
  return 'bg-[var(--brand-blue)]';
}

/** Clamp 0–100 for width styles. */
export function usageBarWidthPct(pct: number): number {
  if (!Number.isFinite(pct) || pct <= 0) return 0;
  return Math.min(100, pct);
}
