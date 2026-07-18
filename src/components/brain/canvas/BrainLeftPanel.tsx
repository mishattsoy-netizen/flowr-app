"use client";

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Brain,
  ChevronDown,
  ChevronUp,
  Check,
  Gauge,
  Pencil,
  Star,
} from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';

export interface BrainLeftPanelBrain {
  id: string;
  title: string;
  description: string | null;
  is_default: boolean;
}

export interface BrainLeftPanelProps {
  brains: BrainLeftPanelBrain[];
  selectedBrainId: string | null;
  onSelect: (brainId: string) => void;
  budget: { used: number; limit: number };
  nodeCount: number;
  edgeCount: number;
  stats: { requests: number; activeDays: number };
  /** Commit rename via `update_brain` (parent wires mutate + list refresh). */
  onRenameBrain: (brainId: string, title: string) => Promise<void> | void;
  /** Set default via `set_default_brain`, then refresh brain list. */
  onSetDefaultBrain: (brainId: string) => Promise<void> | void;
  expanded?: boolean;
  onExpandChange?: (expanded: boolean) => void;
}

export function BrainLeftPanel({
  brains,
  selectedBrainId,
  onSelect,
  budget,
  nodeCount,
  edgeCount,
  stats,
  onRenameBrain,
  onSetDefaultBrain,
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
  const [busyId, setBusyId] = useState<string | null>(null);

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
    setRenamingId(brain.id);
    setRenameValue(brain.title);
  };

  const commitRename = async () => {
    if (!renamingId) return;
    const title = renameValue.trim() || 'Brain';
    const prev = brains.find(b => b.id === renamingId)?.title;
    setRenamingId(null);
    if (title === prev) return;
    setBusyId(renamingId);
    try {
      await onRenameBrain(renamingId, title);
    } finally {
      setBusyId(null);
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

  const { used, limit } = budget;
  const safeLimit = limit > 0 ? limit : 1;
  const pct = Math.min(100, Math.round((used / safeLimit) * 100));
  const isOverBudget = used >= limit;
  const isNearBudget = !isOverBudget && pct >= 80;

  const gridStats = [
    { label: 'Nodes', value: nodeCount },
    { label: 'Edges', value: edgeCount },
    { label: 'Active days', value: stats.activeDays },
    { label: 'Requests', value: stats.requests },
  ] as const;

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
                            setRenamingId(null);
                          }
                        }}
                        onClick={e => e.stopPropagation()}
                        className="flex-1 min-w-0 bg-transparent outline-none text-[13px] text-[var(--bone-100)] border-none p-0"
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

      {/* Expanded analytics — Task 7 fills this when `expanded` is true */}
      {expanded ? null : null}
    </div>
  );
}

