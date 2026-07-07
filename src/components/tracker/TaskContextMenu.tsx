"use client";

import { useStore } from '@/data/store';
import { cn } from '@/lib/utils';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckSquare, Check, ArrowRight, ChevronUp, ChevronDown, Trash2 } from 'lucide-react';

// Columns a task can be moved to via the menu — "Done" (completed) is excluded
// per spec; complete is its own action. Each carries its status colour (matching
// the column dots) so the submenu items read like the status picker in the task
// modal: a coloured dot, coloured text, and a coloured fill on hover. Full class
// strings (not interpolated) so Tailwind doesn't purge them.
const MOVE_TARGETS: { id: string; label: string; dot: string; text: string; hover: string }[] = [
  { id: 'todo', label: 'To do', dot: 'bg-blue-400', text: 'text-blue-400/70', hover: 'hover:bg-blue-500/15 hover:text-blue-400' },
  { id: 'inProgress', label: 'In progress', dot: 'bg-amber-400', text: 'text-amber-400/70', hover: 'hover:bg-amber-500/15 hover:text-amber-400' },
  { id: 'today', label: 'Today', dot: 'bg-violet-400', text: 'text-violet-400/70', hover: 'hover:bg-violet-500/15 hover:text-violet-400' },
  { id: 'overdue', label: 'Overdue', dot: 'bg-red-400', text: 'text-red-400/70', hover: 'hover:bg-red-500/15 hover:text-red-400' },
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
  const toggleTaskSelection = useStore(s => s.toggleTaskSelection);
  const toggleTask = useStore(s => s.toggleTask);
  const deleteTask = useStore(s => s.deleteTask);

  const ref = useRef<HTMLDivElement>(null);
  const [submenuOpen, setSubmenuOpen] = useState(false);
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

  const tasks = useStore(s => s.tasks);
  const targetTask = tasks.find(t => t.id === menu?.taskId);
  const isCompleted = targetTask?.completed;

  // Measure + clamp on-screen BEFORE paint (layout effect) so the menu never
  // paints at the wrong spot first — that initial jump was the stutter. Then
  // flip `ready` on the next frame so the fade/scale-in actually animates from
  // the hidden state (a same-frame flip wouldn't transition).
  useLayoutEffect(() => {
    if (!menu) { setSubmenuOpen(false); setReady(false); return; }
    const el = ref.current;
    const w = el?.offsetWidth ?? 190;
    const h = el?.offsetHeight ?? 240;
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
      {/* Mark as done — top action, green status-style (matches the modal). Hidden if already completed. */}
      {!isCompleted && (
        <button
          className="w-full px-3 py-1.5 rounded-[8px] text-left text-[13px] font-medium flex items-center gap-2.5 cursor-pointer transition-none bg-emerald-500/8 text-emerald-400/80 hover:bg-emerald-500/15 hover:text-emerald-400"
          onClick={() => act(() => { targetIds.forEach(id => toggleTask(id)); })}
        >
          <Check className="w-3.5 h-3.5 shrink-0" />
          <span>Mark as done</span>
        </button>
      )}

      <button className="popup-item gap-2.5" onClick={() => act(() => {
        // Select: ensure the target(s) are in the selection.
        if (!selectedTaskIds.includes(menu.taskId)) toggleTaskSelection(menu.taskId);
      })}>
        <CheckSquare className="w-3.5 h-3.5 shrink-0" />
        <span>{isGroup ? `Select (${targetIds.length})` : 'Select'}</span>
      </button>

      {/* Move to → submenu */}
      <div
        className="relative"
        onMouseEnter={() => setSubmenuOpen(true)}
        onMouseLeave={() => setSubmenuOpen(false)}
      >
        <button className="popup-item gap-2.5 w-full justify-between">
          <span className="flex items-center gap-2.5">
            <ArrowRight className="w-3.5 h-3.5 shrink-0" />
            <span>Move to</span>
          </span>
          <ArrowRight className="w-3 h-3 shrink-0 opacity-50" />
        </button>
        {submenuOpen && (
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

      {/* Move up / down — single-task only (disabled for a group). */}
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
