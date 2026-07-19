"use client";

import { cn } from '@/lib/utils';
import { StickyNote, Link2, Gauge } from 'lucide-react';
import { Tooltip } from '@/components/layout/Tooltip';

export function BrainStatsPanel({
  used,
  limit,
  nodeCount,
  edgeCount,
}: {
  used: number;
  limit: number;
  nodeCount: number;
  edgeCount: number;
}) {
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const isOverBudget = used >= limit;
  const isNearBudget = !isOverBudget && pct >= 80;

  return (
    <div className="flex items-center gap-4 px-4 py-2.5 bg-panel/98 backdrop-blur-xl border border-[var(--bone-12)] shadow-[0_4px_16px_rgba(0,0,0,0.14)] rounded-[14px] select-none canvas-floating-panel">
      <div className="flex items-center gap-2">
        <StickyNote className="w-3.5 h-3.5 text-[var(--bone-100)] opacity-40" strokeWidth={2} />
        <span className="font-display font-medium text-[15px] text-[var(--bone-100)] tabular-nums leading-none">{nodeCount}</span>
        <span className="text-[10px] text-[var(--bone-40)] uppercase tracking-wide">nodes</span>
      </div>

      <div className="w-px h-4 bg-[var(--bone-10)]" />

      <div className="flex items-center gap-2">
        <Link2 className="w-3.5 h-3.5 text-[var(--bone-100)] opacity-40" strokeWidth={2} />
        <span className="font-display font-medium text-[15px] text-[var(--bone-100)] tabular-nums leading-none">{edgeCount}</span>
        <span className="text-[10px] text-[var(--bone-40)] uppercase tracking-wide">edges</span>
      </div>

      <div className="w-px h-4 bg-[var(--bone-10)]" />

      <Tooltip content={`${used.toLocaleString()} / ${limit.toLocaleString()} tokens`}>
        <div className="flex items-center gap-2.5">
          <Gauge className={cn("w-3.5 h-3.5", isOverBudget ? "text-danger" : isNearBudget ? "text-amber-400" : "text-[var(--bone-100)] opacity-40")} strokeWidth={2} />
          <div className="w-24 h-2.5 rounded-full bg-[var(--bone-6)] overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500 ease-out",
                isOverBudget ? "bg-danger" : isNearBudget ? "bg-amber-400" : "bg-[var(--brand-blue)]"
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className={cn(
            "font-display font-medium text-[15px] tabular-nums leading-none",
            isOverBudget ? "text-danger" : "text-[var(--bone-100)]"
          )}>
            {Math.round(used / 100) / 10}k
          </span>
        </div>
      </Tooltip>
    </div>
  );
}
