"use client";

import { useStore } from '@/data/store';
import { cn } from '@/lib/utils';
import { isTaskOverdue, getEffectiveDeadline, isDeadlinePassed } from '@/lib/task-overdue';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Check, ChevronUp, ChevronDown, Trash2,
  Flag, Calendar as CalendarIcon, Tag as TagIcon, Folder, Loader, CircleDashed
} from 'lucide-react';
import { Calendar as CalendarUI } from '@/components/ui/calendar';
import { Toggle } from '@/components/ui/Toggle';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { getEntityIcon } from '@/data/icons';
import { format } from 'date-fns';

// Columns a task can be moved to via the menu — "Done" (completed) is excluded
// per spec; complete is its own action. Each carries its status colour (matching
// the column dots) so the submenu items read like the status picker in the task
// modal: a coloured dot, coloured text, and a coloured fill on hover. Full class
// strings (not interpolated) so Tailwind doesn't purge them.
const MOVE_TARGETS: { id: string; label: string; dot: string; text: string; hover: string }[] = [
  { id: 'todo', label: 'To Do', dot: 'bg-blue-500', text: 'text-blue-400/70', hover: 'hover:bg-blue-500/15 hover:text-blue-400' },
  { id: 'inProgress', label: 'In progress', dot: 'bg-amber-500', text: 'text-amber-400/70', hover: 'hover:bg-amber-500/15 hover:text-amber-400' },
  { id: 'today', label: 'Today', dot: 'bg-violet-500', text: 'text-violet-400/70', hover: 'hover:bg-violet-500/15 hover:text-violet-400' },
  { id: 'overdue', label: 'Overdue', dot: 'bg-red-500', text: 'text-red-400/70', hover: 'hover:bg-red-500/15 hover:text-red-400' },
];

const COLORS = [
  '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#F97316', '#06B6D4',
];

export function TaskContextMenu({
  onMoveToColumn,
  onMoveByOne,
}: {
  onMoveToColumn: (ids: string[], destColumn: string) => void;
  onMoveByOne: (id: string, dir: 'up' | 'down') => void;
}) {
  const menu = useStore(s => s.taskContextMenu);
  const close = useStore(s => s.closeTaskContextMenu);
  const selectedTaskIds = useStore(s => s.selectedTaskIds);
  const toggleTask = useStore(s => s.toggleTask);
  const deleteTask = useStore(s => s.deleteTask);
  const updateTask = useStore(s => s.updateTask);
  const tasks = useStore(s => s.tasks);
  const entities = useStore(s => s.entities);
  const trackerColumnSortModes = useStore(s => s.trackerColumnSortModes);

  const ref = useRef<HTMLDivElement>(null);
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);
  const [stuckSubmenu, setStuckSubmenu] = useState<string | null>(null);
  // Start at the requested point so the first paint is already near-correct
  // (avoids the top-left → final jump). `ready` gates the entrance animation:
  // the menu is invisible for one frame while we measure + clamp, then fades in.
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [ready, setReady] = useState(false);

  // Which ids this menu acts on: the whole selection when tasks are selected,
  // otherwise just the right-clicked task.
  const targetIds = menu
    ? (selectedTaskIds.length > 0 ? selectedTaskIds : [menu.taskId])
    : [];
  const isGroup = targetIds.length > 1;

  const targetTasks = tasks.filter(t => targetIds.includes(t.id));

  // Determine which kanban column a task belongs to, mirroring TrackerPage.buildColumns.
  const getColumnForTask = (t: { completed: boolean; status?: string | null; dueDate?: string | null; endDate?: string | null }, todayStr: string): string => {
    if (t.completed) return 'completed';
    if (t.status === 'in-progress') return 'inProgress';
    // When endDate is set it's the true deadline; otherwise use dueDate.
    const deadline = t.endDate || t.dueDate;
    if (deadline && deadline < todayStr) return 'overdue';
    if (deadline === todayStr) return 'today';
    return 'todo';
  };

  // Common values across ALL target tasks. When tasks disagree the value is
  // null/''/false so the display shows nothing — only what every task shares.
  const allCompleted = targetTasks.length > 0 && targetTasks.every(t => t.completed);
  const commonPriority = (() => {
    const vals = targetTasks.map(t => t.priority);
    const uniq = new Set(vals);
    return uniq.size === 1 ? vals[0] : null;
  })();
  const commonEntityId = (() => {
    const vals = targetTasks.map(t => t.entityId ?? null);
    const uniq = new Set(vals);
    return uniq.size === 1 ? vals[0] : null;
  })();
  const commonTag = (() => {
    const vals = targetTasks.map(t => t.tag ?? null);
    const uniq = new Set(vals);
    return uniq.size === 1 ? vals[0] : null;
  })();
  const commonColor = (() => {
    const vals = targetTasks.map(t => t.color || '');
    const uniq = new Set(vals);
    return uniq.size === 1 ? vals[0] : '';
  })();
  const commonDueDate = (() => {
    const vals = targetTasks.map(t => t.dueDate ?? null);
    const uniq = new Set(vals);
    return uniq.size === 1 ? vals[0] : null;
  })();
  const commonEndDate = (() => {
    const vals = targetTasks.map(t => t.endDate ?? null);
    const uniq = new Set(vals);
    return uniq.size === 1 ? vals[0] : null;
  })();
  const commonIncludeTime = (() => {
    const vals = targetTasks.map(t => t.includeTime ?? false);
    const uniq = new Set(vals);
    return uniq.size === 1 ? vals[0] : false;
  })();
  const commonReminder = (() => {
    const vals = targetTasks.map(t => t.reminder ?? null);
    const uniq = new Set(vals);
    return uniq.size === 1 ? vals[0] : null;
  })();
  const commonColumn = (() => {
    if (targetTasks.length === 0) return null;
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const cols = targetTasks.map(t => getColumnForTask(t, todayStr));
    const uniq = new Set(cols);
    return uniq.size === 1 ? cols[0] : null;
  })();

  // Is the common deadline overdue? (only if all tasks are not completed and share an overdue deadline)
  const isOverdue = !allCompleted && (() => {
    const deadline = getEffectiveDeadline(commonDueDate, commonEndDate);
    if (!deadline) return false;
    return isDeadlinePassed(deadline);
  })();

  // Current column's sort mode — determines whether Move up/down are visible.
  const columnSortMode = menu ? trackerColumnSortModes[menu.column] || 'manual' : 'manual';

  // All workspaces (entities of type 'workspace') for the workspace submenu.
  const workspaces = useMemo(() => entities.filter(e => e.type === 'workspace'), [entities]);

  // All unique task tags for the tag submenu.
  const allTaskTags = useMemo(() => {
    return Array.from(new Set(
      tasks
        .filter(t => t.tag && t.tag.trim() && t.tag.toLowerCase() !== 'none')
        .map(t => t.tag!.trim())
    )).sort();
  }, [tasks]);

  // Tag input state for the tag submenu filter.
  const [tagInput, setTagInput] = useState('');
  const filteredTags = useMemo(() => {
    const q = tagInput.trim().toLowerCase();
    if (!q) return allTaskTags;
    return allTaskTags.filter(t => t.toLowerCase().includes(q));
  }, [tagInput, allTaskTags]);

  // Format a date string into "h:mm AM/PM" for the time input.
  const getTimeText = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      const hours = d.getHours();
      const minutes = d.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const h12 = hours % 12 || 12;
      return `${h12}:${String(minutes).padStart(2, '0')} ${ampm}`;
    } catch { return ''; }
  };

  // Apply a time string ("h:mm AM/PM") to a date string, returning ISO.
  const ddApplyTime = (dateStr: string, timeText: string): string => {
    const d = new Date(dateStr);
    const match = timeText.match(/^(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?$/);
    if (match) {
      let h = parseInt(match[1]);
      const m = parseInt(match[2]);
      const ampm = match[3]?.toUpperCase();
      if (ampm === 'PM' && h < 12) h += 12;
      if (ampm === 'AM' && h === 12) h = 0;
      if (h >= 0 && h < 24 && m >= 0 && m < 60) d.setHours(h, m, 0, 0);
    }
    return d.toISOString();
  };

  // Due date picker local state — re-initialized on mount (context menu is ephemeral).
  const [ddEndDate, setDdEndDate] = useState<string | undefined>(commonEndDate ?? undefined);
  const [ddIncludeTime, setDdIncludeTime] = useState(commonIncludeTime);
  const [ddReminder, setDdReminder] = useState<string | undefined>(commonReminder ?? undefined);
  const [ddActiveInput, setDdActiveInput] = useState<'start' | 'end'>('start');
  const [ddHasEndDate, setDdHasEndDate] = useState(!!commonEndDate);
  const [ddStartTimeText, setDdStartTimeText] = useState(commonIncludeTime && typeof commonDueDate === 'string' && commonDueDate.includes('T') ? getTimeText(commonDueDate) : '');
  const [ddEndTimeText, setDdEndTimeText] = useState(commonIncludeTime && typeof commonEndDate === 'string' && commonEndDate.includes('T') ? getTimeText(commonEndDate) : '');

  // Reset tag input when the tag submenu closes.
  useEffect(() => {
    if (activeSubmenu !== 'tag') setTagInput('');
  }, [activeSubmenu]);

  // Measure + clamp on-screen BEFORE paint (layout effect) so the menu never
  // paints at the wrong spot first — that initial jump was the stutter. Then
  // flip `ready` on the next frame so the fade/scale-in actually animates from
  // the hidden state (a same-frame flip wouldn't transition).
  useLayoutEffect(() => {
    if (!menu) { setActiveSubmenu(null); setReady(false); return; }
    const el = ref.current;
    const w = el?.offsetWidth ?? 220;
    const h = el?.offsetHeight ?? 400;
    const x = Math.min(menu.x, window.innerWidth - w - 8);
    const y = Math.min(menu.y, window.innerHeight - h - 8);
    setPos({ x, y });
    const raf = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(raf);
  }, [menu]);

  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menu, close]);

  if (!menu || typeof document === 'undefined') return null;

  // Closes the entire context menu (for top-level actions).
  const act = (fn: () => void) => { fn(); close(); };

  // Closes only the active submenu (keeps the main menu open) unless it is stuck.
  const actSub = (fn: () => void) => { 
    fn(); 
    if (!stuckSubmenu) setActiveSubmenu(null); 
  };

  // Clear all date-related fields, then close the submenu.
  const handleDueDateClear = () => {
    targetIds.forEach(id => updateTask(id, { dueDate: undefined, endDate: undefined }));
    setDdEndDate(undefined);
    setDdActiveInput('start');
    if (!stuckSubmenu) setActiveSubmenu(null);
  };

  const handleMenuEnter = (id: string) => {
    if (!stuckSubmenu) setActiveSubmenu(id);
  };
  const handleMenuLeave = (id: string) => {
    if (!stuckSubmenu) setActiveSubmenu(prev => prev === id ? null : prev);
  };
  const handleMenuClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (stuckSubmenu === id) {
      setStuckSubmenu(null);
    } else {
      setStuckSubmenu(id);
      setActiveSubmenu(id);
    }
  };

  return createPortal(
    <div
      ref={ref}
      className={cn(
        "fixed popup-glass-small z-[9999] min-w-[180px] flex flex-col gap-[2px] shadow-2xl",
        "origin-top-left transition-[opacity,transform] duration-100 ease-out",
        ready ? "opacity-100 scale-100" : "opacity-0 scale-95"
      )}
      style={{ top: pos.y, left: pos.x }}
      // Stop both: mousedown (so the document outside-click handler doesn't
      // close us) AND click — React portals bubble events to their React parent
      // (TrackerPage), whose onClick clears the selection. Without this, the
      // Select click would set the selection and then immediately wipe it.
      onMouseDown={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
    >
      {/* 1. Mark as done — green status-style (matches the modal). Hidden if already completed. */}
      {!allCompleted && (
        <button
          className="w-full px-3 py-1.5 rounded-[8px] text-left text-[13px] font-medium flex items-center gap-2.5 cursor-pointer transition-none bg-emerald-500/8 text-emerald-400/80 hover:bg-emerald-500/15 hover:text-emerald-400"
          onClick={() => act(() => { targetIds.forEach(id => toggleTask(id)); })}
        >
          <Check className="w-3.5 h-3.5 shrink-0" />
          <span>Mark as done</span>
        </button>
      )}

      {/* 2. Priority → submenu */}
      <div
        className="relative"
        onMouseEnter={() => handleMenuEnter('priority')}
        onMouseLeave={() => handleMenuLeave('priority')}
      >
        <button 
          className={cn(
            "popup-item gap-2.5 w-full justify-between",
            stuckSubmenu === 'priority' && "bg-[var(--bone-6)] text-[var(--bone-100)]"
          )}
          onClick={(e) => handleMenuClick(e, 'priority')}
        >
          <span className="flex items-center gap-2.5">
            <Flag className="w-3.5 h-3.5 shrink-0" />
            <span>Priority</span>
          </span>
          {commonPriority && (
            <span className={cn(
              "text-[10px] px-1.5 py-0.5 rounded-[4px] capitalize font-medium shrink-0 -mr-1.5",
              commonPriority === 'high' ? "bg-red-500/15 text-red-400" :
              commonPriority === 'medium' ? "bg-amber-500/15 text-amber-400" :
              "bg-blue-500/15 text-blue-400"
            )}>
              {commonPriority}
            </span>
          )}
        </button>
        {activeSubmenu === 'priority' && (
          <div className="absolute left-full top-0 -mt-1.5 pl-1.5 z-[9999] shadow-2xl">
            <div className="popup-glass-small flex flex-col gap-[2px] min-w-[140px]">
              {(['high', 'medium', 'low'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => actSub(() => {
                    targetIds.forEach(id => updateTask(id, {
                      priority: commonPriority === p ? null : p
                    }));
                  })}
                  className={cn(
                    "w-full px-3 py-1.5 rounded-[8px] text-left text-[13px] font-medium flex items-center gap-2.5 cursor-pointer transition-none",
                    commonPriority === p
                      ? p === 'high' ? "bg-red-500/15 text-red-400" :
                        p === 'medium' ? "bg-amber-500/15 text-amber-400" :
                          "bg-blue-500/15 text-blue-400"
                      : "text-[var(--bone-70)] hover:bg-[var(--bone-5)]"
                  )}
                >
                  <span className={cn(
                    "w-1.5 h-1.5 rounded-full shrink-0",
                    p === 'high' ? "bg-red-400" :
                    p === 'medium' ? "bg-amber-400" :
                    "bg-blue-400"
                  )} />
                  <span className="capitalize">{p}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 3. Status → submenu */}
      <div
        className="relative"
        onMouseEnter={() => handleMenuEnter('moveTo')}
        onMouseLeave={() => handleMenuLeave('moveTo')}
      >
        <button 
          className={cn(
            "popup-item gap-2.5 w-full justify-between",
            stuckSubmenu === 'moveTo' && "bg-[var(--bone-6)] text-[var(--bone-100)]"
          )}
          onClick={(e) => handleMenuClick(e, 'moveTo')}
        >
          <span className="flex items-center gap-2.5">
            <Loader className="w-3.5 h-3.5 shrink-0" />
            <span>Status</span>
          </span>
          {(() => {
            if (allCompleted) {
              return <span className="w-2 h-2 rounded-full shrink-0 bg-emerald-400 mr-0.5" />;
            }
            if (commonColumn) {
              const cur = MOVE_TARGETS.find(t => t.id === commonColumn);
              if (cur) {
                return (
                  <span className={cn("w-2 h-2 rounded-full shrink-0 mr-0.5", cur.dot)} />
                );
              }
            }
            return null;
          })()}
        </button>
        {activeSubmenu === 'moveTo' && (
          <div className="absolute left-full top-0 -mt-1.5 pl-1.5 z-[9999] min-w-[150px] shadow-2xl">
            <div className="popup-glass-small flex flex-col gap-[2px]">
              {MOVE_TARGETS.map(c => {
                const isCurrent = c.id === commonColumn;
                return (
                  <button
                    key={c.id}
                    className={cn(
                      "w-full px-3 py-1.5 rounded-[8px] text-left text-[13px] font-medium flex items-center gap-2.5 cursor-pointer transition-none",
                      isCurrent
                        ? c.id === 'todo' ? "bg-blue-500/15 text-blue-400" :
                          c.id === 'inProgress' ? "bg-amber-500/15 text-amber-400" :
                          c.id === 'today' ? "bg-violet-500/15 text-violet-400" :
                          "bg-red-500/15 text-red-400"
                        : "text-[var(--bone-70)] hover:bg-[var(--bone-5)]"
                    )}
                    onClick={() => actSub(() => onMoveToColumn(targetIds, c.id))}
                  >
                    <span className={cn("w-2 h-2 rounded-full shrink-0", c.dot)} />
                    <span>{c.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 4. Due Date → submenu with calendar */}
      <div
        onMouseEnter={() => handleMenuEnter('dueDate')}
        onMouseLeave={() => handleMenuLeave('dueDate')}
      >
        <button 
          className={cn(
            "popup-item gap-2.5 w-full justify-between",
            stuckSubmenu === 'dueDate' && "bg-[var(--bone-6)] text-[var(--bone-100)]"
          )}
          onClick={(e) => handleMenuClick(e, 'dueDate')}
        >
          <span className="flex items-center gap-2.5">
            <CalendarIcon className="w-3.5 h-3.5 shrink-0" />
            <span>Date</span>
          </span>
          {commonDueDate || commonEndDate ? (
            <span className={cn(
              "text-[10px] whitespace-nowrap -mr-0.5",
              isOverdue ? "text-red-400 font-medium" : "text-[var(--bone-50)]"
            )}>
              {(() => {
                const fmt = (d: string) => {
                  try { return format(new Date(d), 'MMM d'); }
                  catch { return d; }
                };
                if (commonDueDate && commonEndDate) {
                  return <>{fmt(commonDueDate)} &rarr; {fmt(commonEndDate)}</>;
                }
                if (commonDueDate) return fmt(commonDueDate);
                return <>&rarr;&thinsp;{fmt(commonEndDate!)}</>;
              })()}
            </span>
          ) : null}
        </button>
        {activeSubmenu === 'dueDate' && (
          <div className="absolute left-full top-0 -mt-1.5 pl-1.5 z-[9999] shadow-2xl">
            <div className="w-[240px] bg-[var(--background-secondary)] bg-panel border border-[var(--bone-6)] shadow-2xl rounded-[12px] text-sm overflow-hidden">
              {/* Date text inputs */}
              <div className="p-3 pb-1 flex flex-col gap-2">
                {/* Start date input */}
                <div className={cn(
                  "flex items-center w-full rounded-[6px] transition-colors border",
                  ddActiveInput === 'start'
                    ? "border-[var(--brand-blue)] shadow-[0_0_0_0.5px_var(--brand-blue)] bg-[var(--bone-5)]"
                    : "border-[var(--bone-10)] bg-transparent"
                )}>
                  <input
                    type="text"
                    placeholder="Empty"
                    value={commonDueDate ? (() => {
                      try {
                        const d = new Date(commonDueDate);
                        return format(d, d.getFullYear() === new Date().getFullYear() ? 'MMM d' : 'MMM d, yyyy');
                      } catch { return commonDueDate; }
                    })() : ''}
                    onClick={() => setDdActiveInput('start')}
                    onChange={() => {}}
                    className="w-full bg-transparent px-3 py-1.5 text-sm font-medium outline-none text-[var(--bone-90)] placeholder-[var(--bone-40)]"
                  />
                  {ddIncludeTime && (
                    <>
                      <div className="w-[1px] h-4 bg-[var(--bone-10)] mx-1 shrink-0" />
                      <input
                        type="text"
                        placeholder="12:00 AM"
                        value={ddStartTimeText}
                        onChange={(e) => setDdStartTimeText(e.target.value)}
                        onBlur={(e) => {
                          const val = e.target.value.trim();
                          if (!val || !commonDueDate) return;
                          targetIds.forEach(id => updateTask(id, { dueDate: ddApplyTime(commonDueDate, val) }));
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur(); }
                        }}
                        className="w-[85px] bg-transparent px-2 py-1.5 text-sm font-medium outline-none text-[var(--bone-90)] text-center placeholder-[var(--bone-40)] border-none"
                      />
                    </>
                  )}
                </div>

                {/* End date input */}
                {ddHasEndDate && (
                  <div className={cn(
                    "flex items-center w-full rounded-[6px] transition-colors border",
                    ddActiveInput === 'end'
                      ? "border-[var(--brand-blue)] shadow-[0_0_0_0.5px_var(--brand-blue)] bg-[var(--bone-5)]"
                      : "border-[var(--bone-10)] bg-transparent"
                  )}>
                    <input
                      type="text"
                      placeholder="Empty"
                      value={ddEndDate ? (() => {
                        try {
                          const d = new Date(ddEndDate);
                          return format(d, d.getFullYear() === new Date().getFullYear() ? 'MMM d' : 'MMM d, yyyy');
                        } catch { return ddEndDate; }
                      })() : ''}
                      onClick={() => setDdActiveInput('end')}
                      onChange={() => {}}
                      className="w-full bg-transparent px-3 py-1.5 text-sm font-medium outline-none text-[var(--bone-90)] placeholder-[var(--bone-40)]"
                    />
                    {ddIncludeTime && (
                      <>
                        <div className="w-[1px] h-4 bg-[var(--bone-10)] mx-1 shrink-0" />
                        <input
                          type="text"
                          placeholder="12:00 AM"
                          value={ddEndTimeText}
                          onChange={(e) => setDdEndTimeText(e.target.value)}
                          onBlur={(e) => {
                            const val = e.target.value.trim();
                            if (!val || !ddEndDate) return;
                            const newStr = ddApplyTime(ddEndDate, val);
                            setDdEndDate(newStr);
                            targetIds.forEach(id => updateTask(id, { endDate: newStr }));
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur(); }
                          }}
                          className="w-[85px] bg-transparent px-2 py-1.5 text-sm font-medium outline-none text-[var(--bone-90)] text-center placeholder-[var(--bone-40)] border-none"
                        />
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Calendar */}
              <div className="flex flex-col items-center justify-center pt-1 px-0 pb-0.5">
                <CalendarUI
                  mode="single"
                  selected={commonDueDate ? new Date(commonDueDate) : undefined}
                  selectedEndDate={ddHasEndDate && ddEndDate ? new Date(ddEndDate) : undefined}
                  onSelect={(date) => {
                    if (!date) return;
                    const y = date.getFullYear();
                    const m = String(date.getMonth() + 1).padStart(2, '0');
                    const d = String(date.getDate()).padStart(2, '0');
                    const newStr = `${y}-${m}-${d}`;
                    if (ddActiveInput === 'start') {
                      const dueDateVal = ddIncludeTime && ddStartTimeText.trim()
                        ? ddApplyTime(newStr, ddStartTimeText)
                        : newStr;
                      targetIds.forEach(id => updateTask(id, { dueDate: dueDateVal }));
                      if (ddHasEndDate) setDdActiveInput('end');
                    } else {
                      const endDateVal = ddIncludeTime && ddEndTimeText.trim()
                        ? ddApplyTime(newStr, ddEndTimeText)
                        : newStr;
                      setDdEndDate(endDateVal);
                      targetIds.forEach(id => updateTask(id, { endDate: endDateVal }));
                    }
                  }}
                  className="w-full"
                  initialFocus
                />
              </div>

              <div className="border-t border-[var(--bone-6)] mx-2 mt-0.5" />

              {/* Toggles */}
              <div className="p-1.5 flex flex-col gap-0.5">
                <label className="flex items-center justify-between px-2 py-1 hover:bg-[var(--bone-5)] rounded-[6px] cursor-pointer">
                  <span className="text-xs text-[var(--bone-70)] font-medium">End date</span>
                  <Toggle
                    checked={ddHasEndDate}
                    onChange={(checked) => {
                      setDdHasEndDate(checked);
                      if (checked) {
                        setDdActiveInput('end');
                        if (!ddEndDate && commonDueDate) {
                          setDdEndDate(commonDueDate);
                          targetIds.forEach(id => updateTask(id, { endDate: commonDueDate }));
                        }
                      } else {
                        setDdActiveInput('start');
                        setDdEndDate(undefined);
                        targetIds.forEach(id => updateTask(id, { endDate: undefined }));
                      }
                    }}
                    className="scale-75"
                  />
                </label>
                <label className="flex items-center justify-between px-2 py-1 hover:bg-[var(--bone-5)] rounded-[6px] cursor-pointer">
                  <span className="text-xs text-[var(--bone-70)] font-medium">Include time</span>
                  <Toggle
                    checked={ddIncludeTime}
                    onChange={(checked) => {
                      setDdIncludeTime(checked);
                      if (checked) {
                        if (commonDueDate && !ddStartTimeText) {
                          if (commonDueDate.includes('T')) {
                            const t = getTimeText(commonDueDate);
                            setDdStartTimeText(t || '7:00 PM');
                            if (t) targetIds.forEach(id => updateTask(id, { dueDate: ddApplyTime(commonDueDate, t) }));
                          } else {
                            setDdStartTimeText('7:00 PM');
                            targetIds.forEach(id => updateTask(id, { dueDate: ddApplyTime(commonDueDate, '7:00 PM') }));
                          }
                        }
                        if (ddEndDate && !ddEndTimeText) {
                          if (ddEndDate.includes('T')) {
                            const t = getTimeText(ddEndDate);
                            setDdEndTimeText(t || '7:00 PM');
                            if (t) targetIds.forEach(id => updateTask(id, { endDate: ddApplyTime(ddEndDate, t) }));
                          } else {
                            setDdEndTimeText('7:00 PM');
                            targetIds.forEach(id => updateTask(id, { endDate: ddApplyTime(ddEndDate, '7:00 PM') }));
                          }
                        }
                      }
                      targetIds.forEach(id => updateTask(id, { includeTime: checked }));
                    }}
                    className="scale-75"
                  />
                </label>

                <div className="flex items-center justify-between px-2 py-1 hover:bg-[var(--bone-5)] rounded-[6px] cursor-pointer">
                  <span className="text-xs text-[var(--bone-70)] font-medium">Remind</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="flex items-center gap-1 opacity-60 font-semibold hover:opacity-100 transition-opacity cursor-pointer border-none bg-transparent outline-none text-xs text-[var(--bone-90)]">
                        <span>
                          {(() => {
                            switch (ddReminder) {
                              case "at_time": return "At time of event";
                              case "5m": return "5 mins before";
                              case "15m": return "15 mins before";
                              case "30m": return "30 mins before";
                              case "1h": return "1 hour before";
                              case "1d": return "1 day before";
                              default: return "None";
                            }
                          })()}
                        </span>
                        <ChevronDown className="w-3.5 h-3.5 opacity-60 text-[var(--bone-90)]" strokeWidth={2.5} />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[140px] p-1 bg-[var(--background-secondary)] bg-panel border border-[var(--bone-6)] shadow-[0_8px_30px_rgba(0,0,0,0.5)] rounded-[12px] z-[9999] overflow-hidden" align="end" alignOffset={-8} sideOffset={6}>
                      <div className="flex flex-col gap-0.5">
                        {[
                          { val: "none", label: "None" },
                          { val: "at_time", label: "At time of event" },
                          { val: "5m", label: "5 mins before" },
                          { val: "15m", label: "15 mins before" },
                          { val: "30m", label: "30 mins before" },
                          { val: "1h", label: "1 hour before" },
                          { val: "1d", label: "1 day before" }
                        ].map((opt) => {
                          const isSelected = (ddReminder || "none") === opt.val;
                          return (
                            <button
                              key={opt.val}
                              onClick={() => {
                                const v = opt.val === "none" ? undefined : opt.val;
                                setDdReminder(v);
                                targetIds.forEach(id => updateTask(id, { reminder: v }));
                              }}
                              className={cn(
                                "w-full flex items-center justify-between px-2 py-1.5 text-xs rounded-[8px] cursor-pointer transition-colors border-none bg-transparent outline-none",
                                isSelected
                                  ? "bg-black/35 text-[var(--bone-100)] font-medium"
                                  : "text-[var(--bone-70)] hover:bg-[var(--bone-10)] hover:text-[var(--bone-90)]"
                              )}
                            >
                              <span>{opt.label}</span>
                              {isSelected && <Check className="w-3 h-3 text-[var(--bone-50)]" />}
                            </button>
                          );
                        })}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="border-t border-[var(--bone-6)] mx-2" />
              <div className="p-1.5">
                <button
                  onClick={handleDueDateClear}
                  className="w-full text-left px-2 py-1 text-xs font-medium text-[var(--bone-90)] hover:bg-[var(--bone-5)] rounded-[6px] transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 5. Workspace → submenu */}
      <div
        className="relative"
        onMouseEnter={() => handleMenuEnter('workspace')}
        onMouseLeave={() => handleMenuLeave('workspace')}
      >
        <button 
          className={cn(
            "popup-item gap-2.5 w-full justify-between",
            stuckSubmenu === 'workspace' && "bg-[var(--bone-6)] text-[var(--bone-100)]"
          )}
          onClick={(e) => handleMenuClick(e, 'workspace')}
        >
          <span className="flex items-center gap-2.5">
            <Folder className="w-3.5 h-3.5 shrink-0" />
            <span>Assigned</span>
          </span>
          {(() => {
            if (!commonEntityId) return null;
            const ws = workspaces.find(w => w.id === commonEntityId);
            return ws ? (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] text-[10px] font-medium bg-[var(--bone-10)] text-[var(--bone-80)] shrink-0 capitalize max-w-[80px] -mr-1.5">
                <span className="truncate max-w-full">{ws.title}</span>
              </span>
            ) : null;
          })()}
        </button>
        {activeSubmenu === 'workspace' && (
          <div className="absolute left-full top-0 -mt-1.5 pl-1.5 z-[9999] min-w-[160px] max-h-[260px] shadow-2xl">
            <div className="popup-glass-small flex flex-col gap-[2px] max-h-[240px] overflow-y-auto scrollbar-thin">
              <button
                onClick={() => actSub(() => {
                  targetIds.forEach(id => updateTask(id, { entityId: null }));
                })}
                className={cn(
                  "w-full px-3 py-1.5 rounded-[8px] text-left text-[13px] font-medium flex items-center justify-between cursor-pointer transition-none",
                  !commonEntityId
                    ? "bg-[var(--bone-6)] text-[var(--bone-100)]"
                    : "text-[var(--bone-70)] hover:bg-[var(--bone-5)]"
                )}
              >
                <span>None</span>
                {!commonEntityId && <Check className="w-3 h-3 text-[var(--bone-60)] shrink-0" />}
              </button>
              {workspaces.map(w => {
                const WsIcon = getEntityIcon(w.icon);
                return (
                  <button
                    key={w.id}
                    onClick={() => actSub(() => {
                      targetIds.forEach(id => updateTask(id, { entityId: w.id }));
                    })}
                    className={cn(
                      "w-full px-3 py-1.5 rounded-[8px] text-left text-[13px] font-medium flex items-center justify-between cursor-pointer transition-none",
                      commonEntityId === w.id
                        ? "bg-[var(--bone-6)] text-[var(--bone-100)]"
                        : "text-[var(--bone-70)] hover:bg-[var(--bone-5)]"
                    )}
                  >
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <WsIcon className="w-3.5 h-3.5 opacity-60 shrink-0 text-[var(--bone-100)]" />
                      <span className="truncate">{w.title}</span>
                    </div>
                    {commonEntityId === w.id && (
                      <Check className="w-3 h-3 text-[var(--bone-60)] shrink-0 ml-2" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 6. Custom Tag → submenu */}
      <div
        className="relative"
        onMouseEnter={() => handleMenuEnter('tag')}
        onMouseLeave={() => handleMenuLeave('tag')}
      >
        <button 
          className={cn(
            "popup-item gap-2.5 w-full justify-between",
            stuckSubmenu === 'tag' && "bg-[var(--bone-6)] text-[var(--bone-100)]"
          )}
          onClick={(e) => handleMenuClick(e, 'tag')}
        >
          <span className="flex items-center gap-2.5">
            <TagIcon className="w-3.5 h-3.5 shrink-0" />
            <span>Tag</span>
          </span>
          {commonTag && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] text-[10px] font-medium shrink-0 max-w-[80px] bg-[var(--bone-10)] text-[var(--bone-70)] -mr-1.5">
              <span className="truncate max-w-full">{commonTag}</span>
            </span>
          )}
        </button>
        {activeSubmenu === 'tag' && (
          <div className="absolute left-full top-0 -mt-1.5 pl-1.5 z-[9999] min-w-[160px] max-h-[260px] shadow-2xl">
            <div className="popup-glass-small flex flex-col gap-[2px]">
              <input
                type="text"
                placeholder="Tag..."
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                autoFocus
                className="w-full bg-[var(--bone-6)] rounded-[6px] px-2 py-1.5 text-xs text-[var(--bone-90)] placeholder-[var(--bone-30)] border-none outline-none mb-1"
                onKeyDown={e => {
                  if (e.key === 'Enter' && tagInput.trim()) {
                    actSub(() => {
                      targetIds.forEach(id => updateTask(id, { tag: tagInput.trim() || undefined }));
                    });
                    setTagInput('');
                  }
                }}
              />
              <div className="max-h-[180px] overflow-y-auto scrollbar-thin flex flex-col gap-[1px]">
                {tagInput.trim() && !allTaskTags.includes(tagInput.trim()) && (
                  <button
                    onClick={() => {
                      actSub(() => {
                        targetIds.forEach(id => updateTask(id, { tag: tagInput.trim() || undefined }));
                      });
                      setTagInput('');
                    }}
                    className={cn(
                      "w-full px-3 py-1.5 rounded-[8px] text-left text-[13px] font-medium flex items-center justify-between cursor-pointer transition-none",
                      "bg-[var(--bone-6)] text-[var(--bone-100)]"
                    )}
                  >
                    <span className="truncate">"{tagInput.trim()}"</span>
                    {commonTag === tagInput.trim() && <Check className="w-3 h-3 text-[var(--bone-60)] shrink-0" />}
                  </button>
                )}
                <button
                  onClick={() => actSub(() => {
                    targetIds.forEach(id => updateTask(id, { tag: undefined }));
                  })}
                  className={cn(
                    "w-full px-3 py-1.5 rounded-[8px] text-left text-[13px] font-medium flex items-center justify-between cursor-pointer transition-none",
                    !commonTag
                      ? "bg-[var(--bone-6)] text-[var(--bone-100)]"
                      : "text-[var(--bone-70)] hover:bg-[var(--bone-5)]"
                  )}
                >
                  <span>None</span>
                  {!commonTag && <Check className="w-3 h-3 text-[var(--bone-60)] shrink-0" />}
                </button>
                {filteredTags.map(t => (
                  <button
                    key={t}
                    onClick={() => actSub(() => {
                      targetIds.forEach(id => updateTask(id, { tag: commonTag === t ? undefined : t }));
                    })}
                    className={cn(
                      "w-full px-3 py-1.5 rounded-[8px] text-left text-[13px] font-medium flex items-center justify-between cursor-pointer transition-none",
                      commonTag === t
                        ? "bg-[var(--bone-6)] text-[var(--bone-100)]"
                        : "text-[var(--bone-70)] hover:bg-[var(--bone-5)]"
                    )}
                  >
                    <span className="truncate">{t}</span>
                    {commonTag === t && <Check className="w-3 h-3 text-[var(--bone-60)] shrink-0 ml-2" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Color Tag → submenu */}
      <div
        className="relative"
        onMouseEnter={() => handleMenuEnter('colorTag')}
        onMouseLeave={() => handleMenuLeave('colorTag')}
      >
        <button 
          className={cn(
            "popup-item gap-2.5 w-full justify-between",
            stuckSubmenu === 'colorTag' && "bg-[var(--bone-6)] text-[var(--bone-100)]"
          )}
          onClick={(e) => handleMenuClick(e, 'colorTag')}
        >
          <span className="flex items-center gap-2.5">
            <span className="w-3.5 h-3.5 flex items-center justify-center shrink-0">
              {commonColor ? (
                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: commonColor }} />
              ) : (
                <CircleDashed className="w-3.5 h-3.5 shrink-0" />
              )}
            </span>
            <span>Color</span>
          </span>
        </button>
        {activeSubmenu === 'colorTag' && (
          <div className="absolute left-full top-0 -mt-1.5 pl-1.5 z-[9999] shadow-2xl">
            <div className="popup-glass-small flex flex-col gap-2 min-w-[160px]">
              <button
                onClick={() => actSub(() => {
                  targetIds.forEach(id => updateTask(id, { color: '' }));
                })}
                className={cn(
                  "w-full flex items-center gap-2.5 px-2 py-1.5 rounded-[8px] text-[13px] font-medium cursor-pointer transition-none",
                  !commonColor
                    ? "bg-[var(--bone-6)] text-[var(--bone-100)]"
                    : "text-[var(--bone-70)] hover:bg-[var(--bone-5)]"
                )}
              >
                <CircleDashed className="w-3.5 h-3.5 shrink-0 text-[var(--bone-40)]" />
                <span>None</span>
                {!commonColor && <Check className="w-3 h-3 text-[var(--bone-60)] shrink-0 ml-auto" />}
              </button>
              <div className="grid grid-cols-4 gap-2 px-1 pb-0.5 place-items-center">
                {COLORS.slice(0, 4).map(c => (
                  <button
                    key={c}
                    onClick={() => actSub(() => {
                      targetIds.forEach(id => updateTask(id, { color: commonColor === c ? '' : c }));
                    })}
                    className={cn(
                      "w-7 h-7 rounded-full transition-all cursor-pointer flex items-center justify-center",
                      commonColor === c ? "scale-110 ring-1 ring-[var(--bone-70)] ring-offset-2 ring-offset-[var(--color-panel)]" : "opacity-50 hover:opacity-100"
                    )}
                    style={{ backgroundColor: c }}
                    title={c}
                  >
                    {commonColor === c && <Check className="w-3.5 h-3.5 text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]" />}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-4 gap-2 px-1 pb-0 place-items-center">
                {COLORS.slice(4, 8).map(c => (
                  <button
                    key={c}
                    onClick={() => actSub(() => {
                      targetIds.forEach(id => updateTask(id, { color: commonColor === c ? '' : c }));
                    })}
                    className={cn(
                      "w-7 h-7 rounded-full transition-all cursor-pointer flex items-center justify-center",
                      commonColor === c ? "scale-110 ring-1 ring-[var(--bone-70)] ring-offset-2 ring-offset-[var(--color-panel)]" : "opacity-50 hover:opacity-100"
                    )}
                    style={{ backgroundColor: c }}
                    title={c}
                  >
                    {commonColor === c && <Check className="w-3.5 h-3.5 text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 7 / 8. Move up / Move down — only shown when column sorting is manual. */}
      {columnSortMode === 'manual' && (
        <>
          <button
            className="popup-item gap-2.5 disabled:opacity-40 disabled:cursor-default"
            disabled={isGroup}
            onClick={() => act(() => onMoveByOne(menu.taskId, 'up'))}
          >
            <ChevronUp className="w-3.5 h-3.5 shrink-0" />
            <span>Move up</span>
          </button>
          <button
            className="popup-item gap-2.5 disabled:opacity-40 disabled:cursor-default"
            disabled={isGroup}
            onClick={() => act(() => onMoveByOne(menu.taskId, 'down'))}
          >
            <ChevronDown className="w-3.5 h-3.5 shrink-0" />
            <span>Move down</span>
          </button>
        </>
      )}

      <div className="popup-divider" />

      <button className="popup-item gap-2.5 !text-danger hover:!bg-danger/10" onClick={() => act(() => {
        targetIds.forEach(id => deleteTask(id));
        useStore.getState().clearTaskSelection();
      })}>
        <Trash2 className="w-3.5 h-3.5 shrink-0" />
        <span>{isGroup ? `Delete (${targetIds.length})` : 'Delete'}</span>
      </button>
    </div>,
    document.body
  );
}
