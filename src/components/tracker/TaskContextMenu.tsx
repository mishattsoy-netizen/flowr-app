"use client";

import { useStore } from '@/data/store';
import { cn } from '@/lib/utils';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Check, ChevronUp, ChevronDown, Trash2,
  Flag, Calendar as CalendarIcon, Tag as TagIcon, Folder, Loader, CircleDashed
} from 'lucide-react';
import { Calendar as CalendarUI } from '@/components/ui/calendar';
import { getEntityIcon } from '@/data/icons';
import { format } from 'date-fns';

// Columns a task can be moved to via the menu — "Done" (completed) is excluded
// per spec; complete is its own action. Each carries its status colour (matching
// the column dots) so the submenu items read like the status picker in the task
// modal: a coloured dot, coloured text, and a coloured fill on hover. Full class
// strings (not interpolated) so Tailwind doesn't purge them.
const MOVE_TARGETS: { id: string; label: string; dot: string; text: string; hover: string }[] = [
  { id: 'todo', label: 'To Do', dot: 'bg-blue-400', text: 'text-blue-400/70', hover: 'hover:bg-blue-500/15 hover:text-blue-400' },
  { id: 'inProgress', label: 'In progress', dot: 'bg-amber-400', text: 'text-amber-400/70', hover: 'hover:bg-amber-500/15 hover:text-amber-400' },
  { id: 'today', label: 'Today', dot: 'bg-violet-400', text: 'text-violet-400/70', hover: 'hover:bg-violet-500/15 hover:text-violet-400' },
  { id: 'overdue', label: 'Overdue', dot: 'bg-red-400', text: 'text-red-400/70', hover: 'hover:bg-red-500/15 hover:text-red-400' },
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
  // Start at the requested point so the first paint is already near-correct
  // (avoids the top-left → final jump). `ready` gates the entrance animation:
  // the menu is invisible for one frame while we measure + clamp, then fades in.
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [ready, setReady] = useState(false);

  // Which ids this menu acts on: the whole selection when the right-clicked task
  // is part of it, otherwise just that task.
  const targetIds = menu
    ? (selectedTaskIds.includes(menu.taskId) ? selectedTaskIds : [menu.taskId])
    : [];
  const isGroup = targetIds.length > 1;

  const targetTask = tasks.find(t => t.id === menu?.taskId);
  const isCompleted = targetTask?.completed;

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

  const act = (fn: () => void) => { fn(); close(); };

  // Used by both the Calendar and the quick-preset buttons in the date submenu.
  const handleDueDateSelect = (date: Date | undefined) => {
    if (date) {
      targetIds.forEach(id => updateTask(id, { dueDate: format(date, 'yyyy-MM-dd') }));
    } else {
      targetIds.forEach(id => updateTask(id, { dueDate: undefined }));
    }
    close();
  };

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  return createPortal(
    <div
      ref={ref}
      className={cn(
        "fixed popup-glass-small z-[9999] min-w-[180px] p-1.5 flex flex-col gap-[2px] shadow-2xl",
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
      {!isCompleted && (
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
        onMouseEnter={() => setActiveSubmenu('priority')}
        onMouseLeave={() => setActiveSubmenu(prev => prev === 'priority' ? null : prev)}
      >
        <button className="popup-item gap-2.5 w-full justify-between">
          <span className="flex items-center gap-2.5">
            <Flag className="w-3.5 h-3.5 shrink-0" />
            <span>Priority</span>
          </span>
          {targetTask?.priority && (
            <span className={cn(
              "text-[10px] px-1.5 py-0.5 rounded-[4px] capitalize font-medium",
              targetTask.priority === 'high' ? "bg-red-500/15 text-red-400" :
              targetTask.priority === 'medium' ? "bg-amber-500/15 text-amber-400" :
              "bg-blue-500/15 text-blue-400"
            )}>
              {targetTask.priority}
            </span>
          )}
        </button>
        {activeSubmenu === 'priority' && (
          <div className="absolute left-full top-0 -mt-1.5 pl-1.5 z-[9999] shadow-2xl">
            <div className="popup-glass-small p-1.5 flex flex-col gap-[2px] min-w-[140px]">
              {(['high', 'medium', 'low'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => act(() => {
                    targetIds.forEach(id => updateTask(id, {
                      priority: targetTask?.priority === p ? null : p
                    }));
                  })}
                  className={cn(
                    "w-full px-3 py-1.5 rounded-[8px] text-left text-[13px] font-medium flex items-center gap-2.5 cursor-pointer transition-none",
                    targetTask?.priority === p
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
                  {targetTask?.priority === p && <Check className="w-3 h-3 text-[var(--bone-60)] shrink-0 ml-auto" />}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 3. Status → submenu */}
      <div
        className="relative"
        onMouseEnter={() => setActiveSubmenu('moveTo')}
        onMouseLeave={() => setActiveSubmenu(prev => prev === 'moveTo' ? null : prev)}
      >
        <button className="popup-item gap-2.5 w-full justify-between">
          <span className="flex items-center gap-2.5">
            <Loader className="w-3.5 h-3.5 shrink-0" />
            <span>Status</span>
          </span>
        </button>
        {activeSubmenu === 'moveTo' && (
          <div className="absolute left-full top-0 -mt-1.5 pl-1.5 z-[9999] min-w-[150px] shadow-2xl">
            <div className="popup-glass-small p-1.5 flex flex-col gap-[2px]">
              {MOVE_TARGETS.filter(c => c.id !== menu.column).map(c => (
                <button
                  key={c.id}
                  className={cn(
                    "w-full px-3 py-1.5 rounded-[8px] text-left text-[13px] font-medium flex items-center gap-2.5 cursor-pointer transition-none",
                    c.text,
                    c.hover
                  )}
                  onClick={() => act(() => onMoveToColumn(targetIds, c.id))}
                >
                  <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", c.dot)} />
                  <span>{c.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 4. Due Date → submenu with calendar */}
      <div
        className="relative"
        onMouseEnter={() => setActiveSubmenu('dueDate')}
        onMouseLeave={() => setActiveSubmenu(prev => prev === 'dueDate' ? null : prev)}
      >
        <button className="popup-item gap-2.5 w-full justify-between">
          <span className="flex items-center gap-2.5">
            <CalendarIcon className="w-3.5 h-3.5 shrink-0" />
            <span>Due Date</span>
          </span>
          {targetTask?.dueDate && (
            <span className="text-[10px] text-[var(--bone-50)] whitespace-nowrap">
              {(() => {
                try { return format(new Date(targetTask.dueDate), 'MMM d'); }
                catch { return targetTask.dueDate; }
              })()}
            </span>
          )}
        </button>
        {activeSubmenu === 'dueDate' && (
          <div className="absolute left-full top-0 -mt-1.5 pl-1.5 z-[9999] shadow-2xl">
            <div className="popup-glass-small p-1.5">
              <CalendarUI
                mode="single"
                selected={targetTask?.dueDate ? new Date(targetTask.dueDate) : undefined}
                onSelect={handleDueDateSelect}
                className="rounded-[8px]"
                initialFocus
              />
              <div className="flex gap-1 mt-1 px-1 pb-1">
                <button
                  onClick={() => handleDueDateSelect(new Date())}
                  className="flex-1 px-2 py-1 rounded-[6px] text-[11px] font-medium bg-[var(--bone-6)] text-[var(--bone-60)] hover:bg-[var(--bone-10)] hover:text-[var(--bone-100)] transition-none cursor-pointer border-none"
                >
                  Today
                </button>
                <button
                  onClick={() => handleDueDateSelect(tomorrow)}
                  className="flex-1 px-2 py-1 rounded-[6px] text-[11px] font-medium bg-[var(--bone-6)] text-[var(--bone-60)] hover:bg-[var(--bone-10)] hover:text-[var(--bone-100)] transition-none cursor-pointer border-none"
                >
                  Tomorrow
                </button>
                {targetTask?.dueDate && (
                  <button
                    onClick={() => handleDueDateSelect(undefined)}
                    className="px-2 py-1 rounded-[6px] text-[11px] font-medium bg-[var(--bone-6)] text-red-400/70 hover:bg-red-500/15 hover:text-red-400 transition-none cursor-pointer border-none"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 5. Workspace → submenu */}
      <div
        className="relative"
        onMouseEnter={() => setActiveSubmenu('workspace')}
        onMouseLeave={() => setActiveSubmenu(prev => prev === 'workspace' ? null : prev)}
      >
        <button className="popup-item gap-2.5 w-full justify-between">
          <span className="flex items-center gap-2.5">
            <Folder className="w-3.5 h-3.5 shrink-0" />
            <span>Workspace</span>
          </span>
          {(() => {
            if (!targetTask?.entityId) return null;
            const ws = workspaces.find(w => w.id === targetTask.entityId);
            return ws ? (
              <span className="text-[10px] text-[var(--bone-50)] truncate max-w-[80px]">{ws.title}</span>
            ) : null;
          })()}
        </button>
        {activeSubmenu === 'workspace' && (
          <div className="absolute left-full top-0 -mt-1.5 pl-1.5 z-[9999] min-w-[160px] max-h-[260px] shadow-2xl">
            <div className="popup-glass-small p-1.5 flex flex-col gap-[2px] max-h-[240px] overflow-y-auto scrollbar-thin">
              <button
                onClick={() => act(() => {
                  targetIds.forEach(id => updateTask(id, { entityId: null }));
                })}
                className={cn(
                  "w-full px-3 py-1.5 rounded-[8px] text-left text-[13px] font-medium flex items-center justify-between cursor-pointer transition-none",
                  !targetTask?.entityId
                    ? "bg-[var(--bone-6)] text-[var(--bone-100)]"
                    : "text-[var(--bone-70)] hover:bg-[var(--bone-5)]"
                )}
              >
                <span>None</span>
                {!targetTask?.entityId && <Check className="w-3 h-3 text-[var(--bone-60)] shrink-0" />}
              </button>
              {workspaces.map(w => {
                const WsIcon = getEntityIcon(w.icon);
                return (
                  <button
                    key={w.id}
                    onClick={() => act(() => {
                      targetIds.forEach(id => updateTask(id, { entityId: w.id }));
                    })}
                    className={cn(
                      "w-full px-3 py-1.5 rounded-[8px] text-left text-[13px] font-medium flex items-center justify-between cursor-pointer transition-none",
                      targetTask?.entityId === w.id
                        ? "bg-[var(--bone-6)] text-[var(--bone-100)]"
                        : "text-[var(--bone-70)] hover:bg-[var(--bone-5)]"
                    )}
                  >
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <WsIcon className="w-3.5 h-3.5 opacity-60 shrink-0" />
                      <span className="truncate">{w.title}</span>
                    </div>
                    {targetTask?.entityId === w.id && (
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
        onMouseEnter={() => setActiveSubmenu('tag')}
        onMouseLeave={() => setActiveSubmenu(prev => prev === 'tag' ? null : prev)}
      >
        <button className="popup-item gap-2.5 w-full justify-between">
          <span className="flex items-center gap-2.5">
            <TagIcon className="w-3.5 h-3.5 shrink-0" />
            <span>Custom Tag</span>
          </span>
          {targetTask?.tag && (
            <span className="text-[10px] text-[var(--bone-50)] truncate max-w-[80px]">{targetTask.tag}</span>
          )}
        </button>
        {activeSubmenu === 'tag' && (
          <div className="absolute left-full top-0 -mt-1.5 pl-1.5 z-[9999] min-w-[160px] max-h-[260px] shadow-2xl">
            <div className="popup-glass-small p-1.5 flex flex-col gap-[2px]">
              <input
                type="text"
                placeholder="Tag..."
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                autoFocus
                className="w-full bg-[var(--bone-6)] rounded-[6px] px-2 py-1.5 text-xs text-[var(--bone-90)] placeholder-[var(--bone-30)] border-none outline-none mb-1"
                onKeyDown={e => {
                  if (e.key === 'Enter' && tagInput.trim()) {
                    act(() => {
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
                      act(() => {
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
                    {targetTask?.tag === tagInput.trim() && <Check className="w-3 h-3 text-[var(--bone-60)] shrink-0" />}
                  </button>
                )}
                <button
                  onClick={() => act(() => {
                    targetIds.forEach(id => updateTask(id, { tag: undefined }));
                  })}
                  className={cn(
                    "w-full px-3 py-1.5 rounded-[8px] text-left text-[13px] font-medium flex items-center justify-between cursor-pointer transition-none",
                    !targetTask?.tag
                      ? "bg-[var(--bone-6)] text-[var(--bone-100)]"
                      : "text-[var(--bone-70)] hover:bg-[var(--bone-5)]"
                  )}
                >
                  <span>None</span>
                  {!targetTask?.tag && <Check className="w-3 h-3 text-[var(--bone-60)] shrink-0" />}
                </button>
                {filteredTags.map(t => (
                  <button
                    key={t}
                    onClick={() => act(() => {
                      targetIds.forEach(id => updateTask(id, { tag: targetTask?.tag === t ? undefined : t }));
                    })}
                    className={cn(
                      "w-full px-3 py-1.5 rounded-[8px] text-left text-[13px] font-medium flex items-center justify-between cursor-pointer transition-none",
                      targetTask?.tag === t
                        ? "bg-[var(--bone-6)] text-[var(--bone-100)]"
                        : "text-[var(--bone-70)] hover:bg-[var(--bone-5)]"
                    )}
                  >
                    <span className="truncate">{t}</span>
                    {targetTask?.tag === t && <Check className="w-3 h-3 text-[var(--bone-60)] shrink-0 ml-2" />}
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
        onMouseEnter={() => setActiveSubmenu('colorTag')}
        onMouseLeave={() => setActiveSubmenu(prev => prev === 'colorTag' ? null : prev)}
      >
        <button className="popup-item gap-2.5 w-full justify-between">
          <span className="flex items-center gap-2.5">
            {targetTask?.color ? (
              <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: targetTask.color }} />
            ) : (
              <CircleDashed className="w-3.5 h-3.5 shrink-0" />
            )}
            <span>Color Tag</span>
          </span>
          {targetTask?.color && (
            <span className="text-[10px] text-[var(--bone-50)] truncate max-w-[60px]">{targetTask.color}</span>
          )}
        </button>
        {activeSubmenu === 'colorTag' && (
          <div className="absolute left-full top-0 -mt-1.5 pl-1.5 z-[9999] shadow-2xl">
            <div className="popup-glass-small p-2 flex flex-col gap-2 min-w-[160px]">
              <button
                onClick={() => act(() => {
                  targetIds.forEach(id => updateTask(id, { color: '' }));
                })}
                className={cn(
                  "w-full flex items-center gap-2.5 px-2 py-1.5 rounded-[8px] text-[13px] font-medium cursor-pointer transition-none",
                  !targetTask?.color
                    ? "bg-[var(--bone-6)] text-[var(--bone-100)]"
                    : "text-[var(--bone-70)] hover:bg-[var(--bone-5)]"
                )}
              >
                <CircleDashed className="w-3.5 h-3.5 shrink-0 text-[var(--bone-40)]" />
                <span>None</span>
                {!targetTask?.color && <Check className="w-3 h-3 text-[var(--bone-60)] shrink-0 ml-auto" />}
              </button>
              <div className="flex flex-wrap gap-2 px-1 pb-1">
                {COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => act(() => {
                      targetIds.forEach(id => updateTask(id, { color: targetTask?.color === c ? '' : c }));
                    })}
                    className={cn(
                      "w-8 h-8 rounded-full transition-all cursor-pointer shrink-0 flex items-center justify-center",
                      targetTask?.color === c ? "scale-110 ring-1 ring-[var(--bone-70)] ring-offset-2 ring-offset-[var(--color-panel)]" : "opacity-50 hover:opacity-100"
                    )}
                    style={{ backgroundColor: c }}
                    title={c}
                  >
                    {targetTask?.color === c && <Check className="w-3.5 h-3.5 text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]" />}
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

      <button className="popup-item-danger gap-2.5" onClick={() => act(() => {
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
