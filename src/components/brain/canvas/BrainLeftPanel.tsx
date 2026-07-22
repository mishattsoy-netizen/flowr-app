"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Brain,
  ChevronRight,
  ChevronUp,
  Check,
  Pencil,
  Star,
} from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { getEntityIcon, ICON_MAP, type IconName } from '@/data/icons';
import { usageBarFillClass } from '@/lib/usageBarColor';
import { authHeaders } from './useBrainData';

export interface BrainLeftPanelBrain {
  id: string;
  title: string;
  description: string | null;
  is_default: boolean;
  icon?: string | null;
}

const BRAIN_ICON_PICKS: IconName[] = [
  'Brain', 'Folder', 'Sparkles', 'Zap', 'Target', 'BookOpen', 'Lightbulb', 'Star', 'Rocket', 'Compass',
];

function resolveBrainIcon(icon?: string | null) {
  if (icon) return getEntityIcon(icon);
  return Brain;
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
  /** Persist brain icon via `update_brain`. */
  onSetBrainIcon: (brainId: string, icon: string) => Promise<void> | void;
  /** Optional; panel self-resets via API when omitted. Called after a successful reset. */
  onResetUsage?: () => Promise<void> | void;
  expanded?: boolean;
  onExpandChange?: (expanded: boolean) => void;
}

const CALENDAR_WEEKS = 26;

/** Top-5 bar colors — solid fills, no gradients (Figma). */
const TOP5_BAR_COLORS = [
  '#E8A23A', // orange
  '#2A78D6', // brand blue
  '#4ECB8D', // mint
  '#A78BFA', // purple
  '#F0A0C0', // pink
] as const;

// NOTE: --bone-8 does not exist in globals.css (the scale skips it), and an
// undefined var() paints nothing — which made every empty day invisible and
// left only the active cells floating. Use real tokens only.
const LEVEL_CLASS: Record<number, string> = {
  0: 'bg-[var(--bone-6)]',
  1: 'bg-emerald-900/55',
  2: 'bg-emerald-700/70',
  3: 'bg-emerald-500/80',
  4: 'bg-emerald-400',
};

const SECTION_LABEL =
  'text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--bone-35)]';

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
  onSetBrainIcon,
  onResetUsage,
  expanded: expandedProp,
  onExpandChange,
}: BrainLeftPanelProps) {
  const current = brains.find(b => b.id === selectedBrainId);
  const CurrentIcon = resolveBrainIcon(current?.icon);

  const [internalExpanded, setInternalExpanded] = useState(false);
  const expanded = expandedProp ?? internalExpanded;
  const setExpanded = (next: boolean) => {
    onExpandChange?.(next);
    if (expandedProp === undefined) setInternalExpanded(next);
  };

  const [pickerOpen, setPickerOpen] = useState(false);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
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

  const displayRequests = statsForView?.requests ?? stats.requests;
  const displayActiveDays = statsForView?.activeDays ?? stats.activeDays;

  const gridStats = [
    { label: 'Nodes', value: nodeCount },
    { label: 'Edges', value: edgeCount },
    { label: 'Active Days', value: displayActiveDays },
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

  // Scale top-5 bars relative to the largest so the leader fills most of the track.
  const top5MaxPct = Math.max(...top5.map(n => n.usagePct), 0.1);

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
      { label: 'High', count: high, pct: Math.round((high / total) * 100), dot: '#F07178', bar: 'bg-[#F07178]' },
      { label: 'Medium', count: medium, pct: Math.round((medium / total) * 100), dot: '#E8A23A', bar: 'bg-[#E8A23A]' },
      { label: 'Low', count: low, pct: Math.round((low / total) * 100), dot: '#2A78D6', bar: 'bg-[var(--brand-blue)]' },
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

  /** Single-row ACTIVITY strip (Figma: one row, not a full github grid). */
  const activityStrip = useMemo(() => {
    // One cell per WEEK (max level in that week) across the whole ~6mo window,
    // rather than the last 18 days — the strip is meant to read as six months,
    // and 26 slim cells fit the panel width comfortably.
    const weekly: { date: string; level: number }[] = [];
    for (const week of calendarWeeks) {
      const days = week.filter(c => c.level >= 0);
      if (days.length === 0) continue;
      weekly.push({
        date: days[0].date,
        level: days.reduce((max, c) => Math.max(max, c.level), 0),
      });
    }
    return weekly;
  }, [calendarWeeks]);

  const showStatsLoading = statsLoading && !statsForView;

  return (
    <div
      className={cn(
        "w-[288px] flex flex-col gap-[12px] px-[13px] py-[14px] select-none canvas-floating-panel",
        "bg-[var(--app-panel)] backdrop-blur-xl shadow-[0_8px_28px_rgba(0,0,0,0.28)] rounded-[15px]",
        "border border-[var(--bone-10)]"
      )}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Header — icon (pick) · title (switch brain) · › expand — separate controls */}
      <div className="flex items-center gap-[7px] min-w-0 h-[26px]">
        {/* Icon — own control, opens icon picker for the selected brain */}
        <Popover open={iconPickerOpen} onOpenChange={setIconPickerOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              title="Change icon"
              aria-label="Change brain icon"
              disabled={!selectedBrainId}
              className={cn(
                "w-6 h-6 shrink-0 flex items-center justify-center rounded-[6px] border-none outline-none",
                "text-[var(--bone-100)] hover:bg-[var(--bone-6)] transition-colors",
                "disabled:opacity-40 disabled:pointer-events-none"
              )}
            >
              <CurrentIcon className="w-5 h-5" strokeWidth={1.6} />
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="w-auto p-2 bg-[var(--app-panel)] border border-[var(--bone-12)] shadow-[0_8px_30px_rgba(0,0,0,0.24)] rounded-[14px] z-[300]"
            align="start"
            sideOffset={6}
          >
            <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--bone-35)] px-1 mb-1.5">
              Icon
            </p>
            <div className="grid grid-cols-5 gap-1">
              {BRAIN_ICON_PICKS.map(name => {
                const Ic = ICON_MAP[name] ?? Brain;
                const isActive = (current?.icon ?? 'Brain') === name;
                return (
                  <button
                    key={name}
                    type="button"
                    title={name}
                    onClick={() => {
                      if (!selectedBrainId) return;
                      setIconPickerOpen(false);
                      void onSetBrainIcon(selectedBrainId, name);
                    }}
                    className={cn(
                      "w-8 h-8 flex items-center justify-center rounded-[6px] border-none outline-none transition-colors",
                      isActive
                        ? "bg-[var(--app-dark)] text-[var(--bone-100)]"
                        : "text-[var(--bone-70)] hover:text-[var(--bone-100)] hover:bg-[var(--app-dark)]"
                    )}
                  >
                    <Ic strokeWidth={2} className="w-4 h-4" />
                  </button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>

        {/* Title — brain switcher only */}
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
                "flex-1 min-w-0 flex items-center h-[26px] pr-1 rounded-[8px]",
                "text-[var(--bone-100)] transition-colors hover:bg-[var(--bone-6)] border-none outline-none"
              )}
            >
              <span className="font-serif font-normal text-[18px] leading-[18px] truncate flex-1 text-left text-[var(--bone-100)]">
                {current?.title ?? 'Select brain'}
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="w-64 p-1.5 bg-[var(--app-panel)] border border-[var(--bone-12)] shadow-[0_8px_30px_rgba(0,0,0,0.24)] rounded-[14px] z-[300] overflow-hidden"
            align="start"
            sideOffset={6}
          >
            <div className="flex flex-col gap-0.5">
              {brains.map(b => {
                const isSelected = b.id === selectedBrainId;
                const isRenaming = renamingId === b.id;
                const isBusy = busyId === b.id;
                const RowIcon = resolveBrainIcon(b.icon);

                if (isRenaming) {
                  return (
                    <div
                      key={b.id}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-[10px] bg-[var(--app-dark)]"
                    >
                      <RowIcon className="w-3.5 h-3.5 shrink-0 text-[var(--bone-100)] opacity-40" strokeWidth={2} />
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
                      <RowIcon className="w-3.5 h-3.5 shrink-0 text-[var(--bone-100)] opacity-40" strokeWidth={2} />
                      <span className="truncate flex-1">{b.title}</span>
                      {b.is_default && (
                        <span className="text-[10px] text-[var(--bone-30)] uppercase tracking-wide shrink-0">
                          default
                        </span>
                      )}
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 text-[var(--brand-blue)] shrink-0" strokeWidth={2.5} />
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
                        className="w-6 h-6 flex items-center justify-center rounded-[6px] text-[var(--bone-100)] opacity-40 hover:opacity-100 hover:bg-[var(--bone-6)] border-none outline-none bg-transparent"
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
                          className="w-6 h-6 flex items-center justify-center rounded-[6px] text-[var(--bone-100)] opacity-40 hover:opacity-100 hover:bg-[var(--bone-6)] border-none outline-none bg-transparent"
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
            "w-6 h-6 shrink-0 flex items-center justify-center rounded-[6px] border-none outline-none",
            "text-[var(--bone-100)] opacity-30 hover:opacity-70 transition-opacity"
          )}
        >
          {expanded
            ? <ChevronUp className="w-[14px] h-[14px]" strokeWidth={1.75} />
            : <ChevronRight className="w-[14px] h-[14px]" strokeWidth={1.75} />}
        </button>
      </div>

      {/* Budget pill — Figma: 9px radius, 10px labels, 4px bar */}
      <div
        className="rounded-[9px] bg-[var(--app-dark)] px-[13px] py-[11px]"
        title={`${used.toLocaleString()} / ${limit.toLocaleString()} tokens`}
      >
        <div className="flex items-baseline justify-between mb-[8px]">
          <span
            className={cn(
              "text-[10px] font-semibold tabular-nums leading-none font-sans",
              isOverBudget ? "text-danger" : "text-[var(--bone-100)]"
            )}
          >
            {pct}%
          </span>
          <span className="text-[10px] font-medium tabular-nums leading-none font-sans text-[var(--bone-30)]">
            100%
          </span>
        </div>
        <div className="w-full h-[4px] rounded-full bg-[var(--bone-10)] overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500 ease-out",
              usageBarFillClass(pct),
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* 4-stat tiles — Figma: 40px tall, 7px radius, 19px nums / 7px labels */}
      <div className="flex items-center gap-[5px]">
        {gridStats.map(s => (
          <div
            key={s.label}
            className="flex-1 min-w-0 h-[40px] flex flex-col items-start justify-center gap-0 pl-2 pr-1 rounded-[7px] bg-[var(--bone-6)]"
          >
            <span className="font-sans font-medium text-[19px] text-[var(--bone-70)] tabular-nums leading-none tracking-tight">
              {s.value}
            </span>
            <span className="font-sans font-medium text-[7px] text-[var(--bone-30)] leading-none mt-[3px] truncate max-w-full">
              {s.label}
            </span>
          </div>
        ))}
      </div>

      {/* Expanded analytics */}
      {expanded && (
        <div className="flex flex-col gap-[14px]">
          {/* Top 5 by usage — label column + a shared bar track, so every bar
              starts at the same x and is measured against the same width. The
              percentage rides inside the bar when it fits, outside when it's
              too narrow to hold the text. */}
          <section className="flex flex-col gap-2.5">
            <h3 className={cn(SECTION_LABEL, "px-0.5")}>Top 5 by usage</h3>
            {top5.length === 0 ? (
              <p className="text-[12px] text-[var(--bone-30)] px-0.5">No nodes yet</p>
            ) : (
              <div className="flex flex-col gap-[7px]">
                {top5.map((n, i) => {
                  // Longest bar fills the track; the rest scale against it, with
                  // a floor so a non-zero value is never an invisible sliver.
                  const barWidth = n.usagePct > 0
                    ? Math.max(12, Math.round((n.usagePct / top5MaxPct) * 100))
                    : 0;
                  const color = TOP5_BAR_COLORS[i % TOP5_BAR_COLORS.length];
                  const label = n.usagePct % 1 === 0 ? `${n.usagePct}%` : `${n.usagePct.toFixed(1)}%`;
                  // A % label needs ~34px of bar to sit inside without clipping.
                  const labelInside = barWidth >= 30;
                  return (
                    <div key={n.id} className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-[96px] shrink-0 text-[11.5px] text-[var(--bone-60)] truncate"
                        title={n.title}
                      >
                        {n.title || 'Untitled'}
                      </span>
                      <div className="flex-1 min-w-0 flex items-center gap-1.5">
                        <div
                          className="h-[17px] rounded-full transition-all duration-500 ease-out shrink-0 flex items-center justify-end overflow-hidden"
                          style={{ width: `${barWidth}%`, backgroundColor: color }}
                        >
                          {labelInside && (
                            <span className="text-[10px] font-semibold tabular-nums text-[var(--on-accent)] pr-1.5 leading-none">
                              {label}
                            </span>
                          )}
                        </div>
                        {!labelInside && (
                          <span className="text-[10px] font-semibold tabular-nums text-[var(--bone-60)] shrink-0 leading-none">
                            {label}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Priority distribution */}
          <section className="flex flex-col gap-2.5">
            <h3 className={SECTION_LABEL}>Priority distribution</h3>
            <div className="flex flex-col gap-2">
              {priorityDist.map(row => (
                <div key={row.label} className="flex items-center gap-2">
                  <span
                    className="w-[5px] h-[5px] rounded-full shrink-0"
                    style={{ backgroundColor: row.dot }}
                  />
                  <span className="w-[52px] shrink-0 text-[11.5px] text-[var(--bone-70)]">{row.label}</span>
                  <div className="flex-1 h-[6px] rounded-full bg-[var(--bone-6)] overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-500', row.bar)}
                      style={{ width: nodes.length === 0 ? 0 : `${row.pct}%` }}
                    />
                  </div>
                  <span className="w-[34px] shrink-0 text-right text-[11px] font-medium tabular-nums text-[var(--bone-70)]">
                    {nodes.length === 0 ? '—' : `${row.pct}%`}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Nodes by color tag */}
          <section className="flex flex-col gap-2.5">
            <h3 className={SECTION_LABEL}>Nodes by color tag</h3>
            <div className="flex flex-wrap gap-x-3.5 gap-y-2">
              {tagChips.map((chip, i) => {
                const isUntagged = chip.name === 'Untagged' && !chip.color;
                const label = chip.name
                  ? chip.name
                  : chip.color
                    ? 'Unnamed'
                    : 'Untagged';
                return (
                  <span
                    key={`${chip.color ?? 'none'}-${chip.name ?? 'none'}-${i}`}
                    className="inline-flex items-center gap-1.5 text-[12px] text-[var(--bone-70)]"
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{
                        backgroundColor: isUntagged
                          ? 'var(--bone-30)'
                          : (chip.color || 'var(--bone-30)'),
                      }}
                    />
                    <span className="truncate max-w-[100px]">{label}</span>
                    <span className="tabular-nums text-[var(--bone-35)]">· {chip.count}</span>
                  </span>
                );
              })}
            </div>
          </section>

          {/* Activity strip */}
          <section className="flex flex-col gap-2">
            <h3 className={SECTION_LABEL}>Activity (last ~6mo)</h3>
            {showStatsLoading ? (
              <div className="h-6 rounded-[6px] bg-[var(--bone-6)] animate-pulse" />
            ) : (
              <>
                <div className="flex items-center gap-[2px] w-full">
                  {activityStrip.map(cell => (
                    <div
                      key={cell.date}
                      title={cell.date}
                      className={cn(
                        'flex-1 min-w-0 h-[11px] rounded-[2px]',
                        LEVEL_CLASS[cell.level] ?? LEVEL_CLASS[0]
                      )}
                    />
                  ))}
                  {activityStrip.length === 0 && (
                    <div className="flex-1 h-[11px] rounded-[2px] bg-[var(--bone-6)]" />
                  )}
                </div>
                <div className="flex justify-between text-[9.5px] text-[var(--bone-35)] mt-0.5">
                  <span>6 months ago</span>
                  <span>Today</span>
                </div>
              </>
            )}
          </section>

          {/* Reset — full-width soft pill */}
          <button
            type="button"
            disabled={resetting || !selectedBrainId}
            onClick={() => { void handleResetUsage(); }}
            className={cn(
              "w-full h-10 rounded-[12px] text-[13px] font-medium border-none outline-none transition-colors",
              "bg-[var(--bone-6)] text-[var(--bone-60)] hover:text-[var(--bone-100)] hover:bg-[var(--bone-10)]",
              "disabled:opacity-50 disabled:pointer-events-none"
            )}
          >
            {resetting ? 'Resetting…' : 'Reset'}
          </button>
        </div>
      )}
    </div>
  );
}
