"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Brain,
  ChevronDown,
  ChevronUp,
  Check,
  Flame,
  Gauge,
  Pencil,
  Star,
} from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { authHeaders } from './useBrainData';

export interface BrainLeftPanelBrain {
  id: string;
  title: string;
  description: string | null;
  is_default: boolean;
}

export interface BrainLeftPanelNode {
  id: string;
  title: string;
  priority?: number;
  tag_color?: string | null;
  tag_name?: string | null;
}

export interface UsageCalendarCell {
  date: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
}

export interface FullUsageStats {
  requests: number;
  activeDays: number;
  streak: number;
  calendar: UsageCalendarCell[];
}

export interface BrainLeftPanelProps {
  brains: BrainLeftPanelBrain[];
  selectedBrainId: string | null;
  onSelect: (brainId: string) => void;
  budget: { used: number; limit: number };
  nodeCount: number;
  edgeCount: number;
  stats: { requests: number; activeDays: number };
  nodes: BrainLeftPanelNode[];
  perNodeTokens: Record<string, number>;
  /** Commit rename via `update_brain` (parent wires mutate + list refresh). */
  onRenameBrain: (brainId: string, title: string) => Promise<void> | void;
  /** Set default via `set_default_brain`, then refresh brain list. */
  onSetDefaultBrain: (brainId: string) => Promise<void> | void;
  /** Optional; panel self-resets via API when omitted. Called after a successful reset. */
  onResetUsage?: () => Promise<void> | void;
  expanded?: boolean;
  onExpandChange?: (expanded: boolean) => void;
}

const CALENDAR_WEEKS = 26;

const LEVEL_CLASS: Record<number, string> = {
  0: 'bg-[var(--bone-8)]',
  1: 'bg-emerald-900/55',
  2: 'bg-emerald-700/70',
  3: 'bg-emerald-500/80',
  4: 'bg-emerald-400',
};

function buildCalendarWeeks(calendar: UsageCalendarCell[]): { date: string; level: number }[][] {
  const byDate = new Map(calendar.map(c => [c.date, c.level as number]));
  const now = new Date();
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  // Align start to Sunday of the week that is CALENDAR_WEEKS-1 weeks before end's week.
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - end.getUTCDay() - (CALENDAR_WEEKS - 1) * 7);

  const weeks: { date: string; level: number }[][] = [];
  const cursor = new Date(start);
  for (let w = 0; w < CALENDAR_WEEKS; w++) {
    const week: { date: string; level: number }[] = [];
    for (let d = 0; d < 7; d++) {
      const key = cursor.toISOString().slice(0, 10);
      const future = cursor.getTime() > end.getTime();
      week.push({ date: key, level: future ? -1 : (byDate.get(key) ?? 0) });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

export function BrainLeftPanel({
  brains,
  selectedBrainId,
  onSelect,
  budget,
  nodeCount,
  edgeCount,
  stats,
  nodes,
  perNodeTokens,
  onRenameBrain,
  onSetDefaultBrain,
  onResetUsage,
  expanded: expandedProp,
  onExpandChange,
}: BrainLeftPanelProps) {
  const current = brains.find(b => b.id === selectedBrainId);

  const [internalExpanded, setInternalExpanded] = useState(false);
  const expanded = expandedProp ?? internalExpanded;
  const setExpanded = (next: boolean) => {
    onExpandChange?.(next);
    if (expandedProp === undefined) setInternalExpanded(next);
  };

  const [pickerOpen, setPickerOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);
  const renameLockRef = useRef(false);
  const renameCancelRef = useRef(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [fullStats, setFullStats] = useState<FullUsageStats | null>(null);
  const [fullStatsBrainId, setFullStatsBrainId] = useState<string | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const selectedBrainIdRef = useRef(selectedBrainId);
  selectedBrainIdRef.current = selectedBrainId;

  // Only display fullStats that belong to the currently selected brain.
  const statsForView = fullStatsBrainId === selectedBrainId ? fullStats : null;

  // Clear ownership mismatch in the same render (React-recommended pattern).
  if (fullStats !== null && fullStatsBrainId !== selectedBrainId) {
    setFullStats(null);
    setFullStatsBrainId(null);
  }

  const loadFullStats = async (
    brainId: string,
    signal?: { cancelled: boolean },
  ): Promise<boolean> => {
    setStatsLoading(true);
    try {
      const res = await fetch('/api/ai/user-brain', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ action: 'brain_usage_stats', brain_id: brainId }),
      });
      if (!res.ok || signal?.cancelled) return false;
      if (brainId !== selectedBrainIdRef.current) return false;
      const data = (await res.json()) as FullUsageStats;
      if (signal?.cancelled) return false;
      if (brainId !== selectedBrainIdRef.current) return false;
      setFullStats({
        requests: data.requests ?? 0,
        activeDays: data.activeDays ?? 0,
        streak: data.streak ?? 0,
        calendar: Array.isArray(data.calendar) ? data.calendar : [],
      });
      setFullStatsBrainId(brainId);
      return true;
    } finally {
      if (!signal?.cancelled && brainId === selectedBrainIdRef.current) {
        setStatsLoading(false);
      }
    }
  };

  // Lazy-load streak + calendar on first expand (or after brain switch).
  useEffect(() => {
    if (!expanded || !selectedBrainId || statsForView !== null) return;
    const signal = { cancelled: false };
    void loadFullStats(selectedBrainId, signal);
    return () => { signal.cancelled = true; };
    // statsForView gates re-entry; loadFullStats is stable enough via refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, selectedBrainId, statsForView]);

  useEffect(() => {
    if (renamingId) {
      // Focus after the input mounts inside the popover.
      requestAnimationFrame(() => {
        renameInputRef.current?.focus();
        renameInputRef.current?.select();
      });
    }
  }, [renamingId]);

  const startRename = (brain: BrainLeftPanelBrain) => {
    renameLockRef.current = false;
    renameCancelRef.current = false;
    setRenamingId(brain.id);
    setRenameValue(brain.title);
  };

  const commitRename = async () => {
    if (renameCancelRef.current) {
      renameCancelRef.current = false;
      return;
    }
    if (!renamingId || renameLockRef.current) return;
    renameLockRef.current = true;
    const id = renamingId;
    const title = renameValue.trim() || 'Brain';
    const prev = brains.find(b => b.id === id)?.title;
    setRenamingId(null);
    try {
      if (title !== prev) {
        setBusyId(id);
        await onRenameBrain(id, title);
      }
    } finally {
      setBusyId(null);
      renameLockRef.current = false;
    }
  };

  const handleSetDefault = async (brainId: string) => {
    setBusyId(brainId);
    try {
      await onSetDefaultBrain(brainId);
    } finally {
      setBusyId(null);
    }
  };

  const handleResetUsage = async () => {
    if (!selectedBrainId || resetting) return;
    if (!confirm('Reset usage statistics for this brain? This clears requests, active days, streak, and the activity calendar.')) {
      return;
    }
    const brainId = selectedBrainId;
    setResetting(true);
    try {
      const res = await fetch('/api/ai/user-brain', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ action: 'reset_brain_usage', brain_id: brainId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.error) {
        return;
      }
      // Only apply refetch if still on the same brain (loadFullStats owns the check).
      if (brainId === selectedBrainIdRef.current) {
        await loadFullStats(brainId);
      }
      await onResetUsage?.();
    } finally {
      setResetting(false);
    }
  };

  const { used, limit } = budget;
  const safeLimit = limit > 0 ? limit : 1;
  const pct = Math.min(100, Math.round((used / safeLimit) * 100));
  const isOverBudget = used >= limit;
  const isNearBudget = !isOverBudget && pct >= 80;

  const displayRequests = statsForView?.requests ?? stats.requests;
  const displayActiveDays = statsForView?.activeDays ?? stats.activeDays;

  const gridStats = [
    { label: 'Nodes', value: nodeCount },
    { label: 'Edges', value: edgeCount },
    { label: 'Active days', value: displayActiveDays },
    { label: 'Requests', value: displayRequests },
  ] as const;

  const top5 = useMemo(() => {
    return [...nodes]
      .map(n => {
        const tokens = perNodeTokens[n.id] ?? 0;
        const usagePct = Math.round((tokens / safeLimit) * 1000) / 10; // one decimal
        return { id: n.id, title: n.title, usagePct };
      })
      .sort((a, b) => b.usagePct - a.usagePct)
      .slice(0, 5);
  }, [nodes, perNodeTokens, safeLimit]);

  const priorityDist = useMemo(() => {
    const total = nodes.length || 1;
    let high = 0;
    let medium = 0;
    let low = 0;
    for (const n of nodes) {
      const p = n.priority ?? 3;
      if (p <= 1) high++;
      else if (p <= 2) medium++;
      else low++;
    }
    return [
      { label: 'High', count: high, pct: Math.round((high / total) * 100), color: 'bg-red-400' },
      { label: 'Medium', count: medium, pct: Math.round((medium / total) * 100), color: 'bg-amber-400' },
      { label: 'Low', count: low, pct: Math.round((low / total) * 100), color: 'bg-[var(--brand-blue)]' },
    ];
  }, [nodes]);

  const tagChips = useMemo(() => {
    const groups = new Map<string, { color: string | null; name: string | null; count: number }>();
    let untagged = 0;
    for (const n of nodes) {
      // Guard: Part C may not have shipped tag columns yet.
      const color = 'tag_color' in n ? (n.tag_color ?? null) : null;
      const name = 'tag_name' in n ? (n.tag_name ?? null) : null;
      if (!color && !name) {
        untagged++;
        continue;
      }
      const key = `${color ?? ''}\0${name ?? ''}`;
      const prev = groups.get(key);
      if (prev) prev.count++;
      else groups.set(key, { color, name, count: 1 });
    }
    const chips = [...groups.values()].sort((a, b) => b.count - a.count);
    chips.push({ color: null, name: 'Untagged', count: untagged });
    return chips;
  }, [nodes]);

  const calendarWeeks = useMemo(
    () => buildCalendarWeeks(statsForView?.calendar ?? []),
    [statsForView?.calendar],
  );
  const showStatsLoading = statsLoading && !statsForView;

  return (
    <div
      className={cn(
        "w-[280px] flex flex-col gap-2.5 px-3 py-2.5 select-none canvas-floating-panel",
        "bg-panel/98 backdrop-blur-xl border border-[var(--bone-12)] shadow-[0_4px_16px_rgba(0,0,0,0.14)] rounded-[14px]"
      )}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Row 1: brain switcher + expand toggle */}
      <div className="flex items-center gap-1.5 min-w-0">
        <Popover
          open={pickerOpen}
          onOpenChange={(open) => {
            setPickerOpen(open);
            if (!open) setRenamingId(null);
          }}
        >
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                "flex-1 min-w-0 flex items-center gap-2 h-8 px-2 rounded-[10px] text-[13px] font-medium",
                "text-[var(--bone-100)] transition-colors hover:bg-[var(--app-dark)] border-none outline-none"
              )}
            >
              <Brain className="w-4 h-4 text-[var(--accent)] shrink-0" strokeWidth={2} />
              <span className="font-display truncate flex-1 text-left">
                {current?.title ?? 'Select brain'}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-[var(--bone-30)] shrink-0" strokeWidth={2} />
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="w-64 p-1.5 bg-panel border border-[var(--bone-12)] shadow-[0_8px_30px_rgba(0,0,0,0.24)] rounded-[14px] z-[300] overflow-hidden"
            align="start"
            sideOffset={6}
          >
            <div className="flex flex-col gap-0.5">
              {brains.map(b => {
                const isSelected = b.id === selectedBrainId;
                const isRenaming = renamingId === b.id;
                const isBusy = busyId === b.id;

                if (isRenaming) {
                  return (
                    <div
                      key={b.id}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-[10px] bg-[var(--app-dark)]"
                    >
                      <Brain className="w-3.5 h-3.5 shrink-0 text-[var(--bone-40)]" strokeWidth={2} />
                      <input
                        ref={renameInputRef}
                        value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        onBlur={() => { void commitRename(); }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            void commitRename();
                          }
                          if (e.key === 'Escape') {
                            e.preventDefault();
                            renameCancelRef.current = true;
                            setRenamingId(null);
                          }
                        }}
                        onClick={e => e.stopPropagation()}
                        className="flex-1 min-w-0 bg-transparent outline-none text-[13px] text-[var(--bone-100)] border-none p-0 select-text"
                      />
                    </div>
                  );
                }

                return (
                  <div
                    key={b.id}
                    className={cn(
                      "group/row w-full flex items-center gap-1 px-1.5 py-1 rounded-[10px] text-[13px] transition-colors",
                      isSelected
                        ? "bg-[var(--app-dark)] text-[var(--bone-100)] font-medium"
                        : "text-[var(--bone-70)] hover:bg-[var(--app-dark)] hover:text-[var(--bone-100)]",
                      isBusy && "opacity-60 pointer-events-none"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(b.id);
                        setPickerOpen(false);
                      }}
                      className="flex-1 min-w-0 flex items-center gap-2 px-1 py-1 text-left border-none outline-none bg-transparent text-inherit"
                    >
                      <Brain className="w-3.5 h-3.5 shrink-0 text-[var(--bone-40)]" strokeWidth={2} />
                      <span className="truncate flex-1">{b.title}</span>
                      {b.is_default && (
                        <span className="text-[10px] text-[var(--bone-30)] uppercase tracking-wide shrink-0">
                          default
                        </span>
                      )}
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" strokeWidth={2.5} />
                      )}
                    </button>
                    <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover/row:opacity-100 focus-within:opacity-100">
                      <button
                        type="button"
                        title="Rename"
                        aria-label="Rename"
                        onClick={(e) => {
                          e.stopPropagation();
                          startRename(b);
                        }}
                        className="w-6 h-6 flex items-center justify-center rounded-[6px] text-[var(--bone-40)] hover:text-[var(--bone-100)] hover:bg-[var(--bone-8)] border-none outline-none bg-transparent"
                      >
                        <Pencil className="w-3 h-3" strokeWidth={2} />
                      </button>
                      {!b.is_default && (
                        <button
                          type="button"
                          title="Set as default"
                          aria-label="Set as default"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleSetDefault(b.id);
                          }}
                          className="w-6 h-6 flex items-center justify-center rounded-[6px] text-[var(--bone-40)] hover:text-[var(--bone-100)] hover:bg-[var(--bone-8)] border-none outline-none bg-transparent"
                        >
                          <Star className="w-3 h-3" strokeWidth={2} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>

        <button
          type="button"
          title={expanded ? 'Collapse' : 'Expand'}
          aria-label={expanded ? 'Collapse' : 'Expand'}
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
          className={cn(
            "w-8 h-8 shrink-0 flex items-center justify-center rounded-[10px] border-none outline-none",
            "text-[var(--bone-40)] hover:text-[var(--bone-100)] hover:bg-[var(--app-dark)] transition-colors"
          )}
        >
          {expanded
            ? <ChevronUp className="w-4 h-4" strokeWidth={2} />
            : <ChevronDown className="w-4 h-4" strokeWidth={2} />}
        </button>
      </div>

      {/* Row 2: budget bar (gauge markup from BrainStatsPanel) */}
      <div
        className="flex items-center gap-2.5 px-1"
        title={`${used.toLocaleString()} / ${limit.toLocaleString()} tokens`}
      >
        <Gauge
          className={cn(
            "w-3.5 h-3.5 shrink-0",
            isOverBudget ? "text-danger" : isNearBudget ? "text-amber-400" : "text-[var(--bone-40)]"
          )}
          strokeWidth={2}
        />
        <div className="flex-1 h-2.5 rounded-full bg-[var(--bone-6)] overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500 ease-out",
              isOverBudget ? "bg-danger" : isNearBudget ? "bg-amber-400" : "bg-[var(--brand-blue)]"
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span
          className={cn(
            "font-display font-medium text-[12px] tabular-nums leading-none shrink-0",
            isOverBudget ? "text-danger" : "text-[var(--bone-100)]"
          )}
        >
          {Math.round(used / 100) / 10}k/{Math.round(limit / 100) / 10}k · {pct}%
        </span>
      </div>

      {/* Row 3: 4-stat grid */}
      <div className="grid grid-cols-4 gap-1">
        {gridStats.map(s => (
          <div
            key={s.label}
            className="flex flex-col items-center gap-0.5 py-1.5 rounded-[10px] bg-[var(--bone-6)]/60"
          >
            <span className="font-display font-medium text-[15px] text-[var(--bone-100)] tabular-nums leading-none">
              {s.value}
            </span>
            <span className="text-[9px] text-[var(--bone-40)] uppercase tracking-wide leading-none">
              {s.label}
            </span>
          </div>
        ))}
      </div>

      {/* Expanded analytics (spec §3.4) */}
      {expanded && (
        <div className="flex flex-col gap-3 pt-1 border-t border-[var(--bone-8)]">
          {/* 1. Top 5 by usage */}
          <section className="flex flex-col gap-1.5">
            <h3 className="text-[10px] font-medium uppercase tracking-wide text-[var(--bone-40)] px-0.5">
              Top 5 by usage
            </h3>
            {top5.length === 0 ? (
              <p className="text-[11px] text-[var(--bone-30)] px-0.5">No nodes yet</p>
            ) : (
              <div className="flex flex-col gap-1">
                {top5.map(n => {
                  const barPct = Math.min(100, n.usagePct);
                  return (
                    <div key={n.id} className="flex flex-col gap-0.5">
                      <span className="text-[11px] text-[var(--bone-70)] truncate px-0.5" title={n.title}>
                        {n.title || 'Untitled'}
                      </span>
                      <div className="h-5 rounded-[6px] bg-[var(--bone-6)] overflow-hidden relative">
                        <div
                          className="h-full rounded-[6px] bg-gradient-to-r from-[var(--brand-blue)] to-[var(--accent)] transition-all duration-500 ease-out"
                          style={{ width: `${Math.max(barPct, barPct > 0 ? 8 : 0)}%` }}
                        />
                        <span className="absolute inset-y-0 left-2 flex items-center text-[10px] font-medium tabular-nums text-[var(--bone-100)] drop-shadow-[0_1px_1px_rgba(0,0,0,0.45)]">
                          {n.usagePct}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* 2. Priority distribution */}
          <section className="flex flex-col gap-1.5">
            <h3 className="text-[10px] font-medium uppercase tracking-wide text-[var(--bone-40)] px-0.5">
              Priority
            </h3>
            <div className="flex flex-col gap-1">
              {priorityDist.map(row => (
                <div key={row.label} className="flex items-center gap-2">
                  <span className="w-12 shrink-0 text-[10px] text-[var(--bone-50)]">{row.label}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-[var(--bone-6)] overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-500', row.color)}
                      style={{ width: `${row.pct}%` }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-right text-[10px] tabular-nums text-[var(--bone-50)]">
                    {nodes.length === 0 ? '—' : `${row.pct}%`}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* 3. Nodes by custom tag */}
          <section className="flex flex-col gap-1.5">
            <h3 className="text-[10px] font-medium uppercase tracking-wide text-[var(--bone-40)] px-0.5">
              Tags
            </h3>
            <div className="flex flex-wrap gap-1">
              {tagChips.map((chip, i) => {
                const isUntagged = chip.name === 'Untagged' && !chip.color;
                const label = chip.name
                  ? chip.name
                  : chip.color
                    ? '● (unnamed)'
                    : 'Untagged';
                return (
                  <span
                    key={`${chip.color ?? 'none'}-${chip.name ?? 'none'}-${i}`}
                    className={cn(
                      "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px]",
                      "bg-[var(--bone-6)] text-[var(--bone-70)] border border-[var(--bone-8)]"
                    )}
                  >
                    {!isUntagged && (
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: chip.color || 'var(--bone-30)' }}
                      />
                    )}
                    <span className="truncate max-w-[120px]">{label}</span>
                    <span className="tabular-nums text-[var(--bone-40)]">{chip.count}</span>
                  </span>
                );
              })}
            </div>
          </section>

          {/* 4. Activity calendar + streak */}
          <section className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between px-0.5">
              <h3 className="text-[10px] font-medium uppercase tracking-wide text-[var(--bone-40)]">
                Activity
              </h3>
              <span className="inline-flex items-center gap-1 text-[11px] tabular-nums text-[var(--bone-70)]">
                <Flame
                  className={cn(
                    "w-3 h-3",
                    !showStatsLoading && (statsForView?.streak ?? 0) > 0
                      ? "text-orange-400"
                      : "text-[var(--bone-30)]"
                  )}
                  strokeWidth={2}
                />
                {showStatsLoading ? '…' : `${statsForView?.streak ?? 0} day streak`}
              </span>
            </div>
            {showStatsLoading ? (
              <div className="h-[55px] mx-0.5 rounded-[8px] bg-[var(--bone-6)]/60 animate-pulse" />
            ) : (
              <div className="flex gap-px overflow-hidden justify-between px-0.5">
                {calendarWeeks.map((week, wi) => (
                  <div key={wi} className="flex flex-col gap-px">
                    {week.map(cell => (
                      <div
                        key={cell.date}
                        title={cell.level >= 0 ? cell.date : undefined}
                        className={cn(
                          'w-[7px] h-[7px] rounded-[2px]',
                          cell.level < 0 ? 'bg-transparent' : LEVEL_CLASS[cell.level] ?? LEVEL_CLASS[0]
                        )}
                      />
                    ))}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 5. Reset statistics — pinned bottom */}
          <div className="pt-1 border-t border-[var(--bone-8)]">
            <button
              type="button"
              disabled={resetting || !selectedBrainId}
              onClick={() => { void handleResetUsage(); }}
              className={cn(
                "w-full h-8 rounded-[10px] text-[12px] font-medium border-none outline-none transition-colors",
                "text-[var(--bone-50)] hover:text-danger hover:bg-danger/10",
                "disabled:opacity-50 disabled:pointer-events-none"
              )}
            >
              {resetting ? 'Resetting…' : 'Reset statistics'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
