'use client';

import { useStore, generateId } from '@/data/store';
import type { SubTask } from '@/data/store.types';
import { X, Plus, Trash2, CheckSquare, AlertCircle, Folder, Check, CircleDot, Tag, FileText, ChevronDown, Calendar } from 'lucide-react';
import { useState, useEffect, useMemo, useRef } from 'react';
import { cn } from '@/lib/utils';
import { DatePickerTime } from '@/components/ui/date-time-picker';
import { getEntityIcon } from '@/data/icons';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const parseLocalDate = (dateStr: string) => {
  if (!dateStr) return undefined;
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const formatLocalDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const COLORS = [
  '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899',
];

function TaskPanelContent({ taskId, closePanel }: { taskId: string; closePanel: () => void }) {
  const tasks = useStore(s => s.tasks);
  const entities = useStore(s => s.entities);
  const addTask = useStore(s => s.addTask);
  const updateTask = useStore(s => s.updateTask);
  const deleteTask = useStore(s => s.deleteTask);

  const activeTask = useMemo(() => tasks.find(t => t.id === taskId), [taskId, tasks]);
  const isEditing = !!activeTask;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | null>(null);
  const [color, setColor] = useState('');
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [subtasks, setSubtasks] = useState<SubTask[]>([]);
  const [completed, setCompleted] = useState(false);
  const [status, setStatus] = useState<'todo' | 'in-progress' | 'done'>('todo');
  const [newSubtaskText, setNewSubtaskText] = useState('');

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const yesterdayStr = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  }, []);

  useEffect(() => {
    if (activeTask) {
      setTitle(activeTask.title || '');
      setDescription(activeTask.description || activeTask.note || '');
      setDueDate(activeTask.dueDate || '');
      setDueTime((activeTask as any).dueTime || '');
      setPriority(activeTask.priority || null);
      setColor(activeTask.color || '');
      setWorkspaceId(activeTask.workspaceId || null);
      setSubtasks(activeTask.subtasks || []);
      setCompleted(activeTask.completed || false);
      setStatus(activeTask.status || 'todo');
    } else {
      setTitle(''); setDescription(''); setDueDate(''); setDueTime('');
      setPriority(null); setColor(''); setWorkspaceId(null);
      setSubtasks([]); setCompleted(false); setStatus('todo');
    }
  }, [activeTask, taskId]);

  const displayStatus = useMemo<'todo' | 'in-progress' | 'done' | 'today' | 'overdue'>(() => {
    if (completed) return 'done';
    if (status === 'in-progress') return 'in-progress';
    if (dueDate && dueDate < todayStr) return 'overdue';
    if (dueDate === todayStr) return 'today';
    return 'todo';
  }, [completed, status, dueDate, todayStr]);

  const workspaces = useMemo(() => {
    return entities.filter(e => e.type === 'workspace' || e.type === 'collection');
  }, [entities]);

  const handleSaveAndClose = () => {
    const t = title.trim();
    if (!t) { closePanel(); return; }

    let finalSubtasks = subtasks;
    if (newSubtaskText.trim()) {
      finalSubtasks = [...subtasks, { id: generateId(), text: newSubtaskText.trim(), completed: false }];
    }

    if (isEditing && taskId) {
      updateTask(taskId, {
        title: t,
        description: description.trim(),
        note: description.trim(),
        dueDate: dueDate || undefined,
        userDueDate: dueDate || undefined,
        // @ts-ignore
        dueTime: dueTime || undefined,
        priority: priority || undefined,
        color: color || undefined,
        workspaceId: workspaceId || undefined,
        subtasks: finalSubtasks,
        completed,
        status: completed ? 'done' : status,
      });
    } else {
      addTask({
        id: generateId(),
        title: t,
        completed,
        status: completed ? 'done' : status,
        description: description.trim(),
        note: description.trim(),
        dueDate: dueDate || undefined,
        userDueDate: dueDate || undefined,
        // @ts-ignore
        dueTime: dueTime || undefined,
        priority: priority || undefined,
        color: color || undefined,
        workspaceId: workspaceId || undefined,
        subtasks: finalSubtasks,
        createdAt: Date.now(),
      });
    }
    closePanel();
  };

  const handleDelete = () => {
    if (isEditing && taskId) {
      deleteTask(taskId);
      closePanel();
    }
  };

  const togglePriority = (val: 'low' | 'medium' | 'high') => {
    setPriority(prev => prev === val ? null : val);
  };

  const handleAddSubtask = () => {
    if (!newSubtaskText.trim()) return;
    setSubtasks([...subtasks, { id: generateId(), text: newSubtaskText.trim(), completed: false }]);
    setNewSubtaskText('');
  };

  const toggleSubtask = (id: string) => {
    setSubtasks(subtasks.map(s => s.id === id ? { ...s, completed: !s.completed } : s));
  };

  const removeSubtask = (id: string) => {
    setSubtasks(subtasks.filter(s => s.id !== id));
  };

  return (
    <div className="flex flex-col h-full">
      <div className="h-[3px] shrink-0" style={{ backgroundColor: color || 'transparent' }} />

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 scrollbar-thin">
        {/* Title */}
        <input
          type="text"
          placeholder="Task Title..."
          value={title}
          onChange={e => setTitle(e.target.value)}
          className={cn(
            "w-full bg-transparent text-xl font-bold tracking-tight text-[var(--bone-100)] placeholder-[var(--bone-30)] border-none outline-none",
            completed && "line-through text-[var(--bone-40)]"
          )}
          autoFocus
        />

        {/* Metadata Grid */}
        <div className="border-b border-[var(--bone-6)] pb-4 grid grid-cols-[100px_1fr] gap-y-3 text-xs items-center">
          {/* Status */}
          <div className="text-[var(--bone-40)] font-semibold flex items-center gap-2">
            <CircleDot className="w-3 h-3 opacity-60" />
            Status
          </div>
          <div className="w-[160px]">
            <Popover>
              <PopoverTrigger asChild>
                <button className={cn(
                  "w-full flex items-center justify-between border-none rounded-[6px] px-3 py-1.5 text-xs font-semibold cursor-pointer transition-none",
                  displayStatus === 'done' ? "bg-emerald-500/15 text-emerald-400" :
                  displayStatus === 'in-progress' ? "bg-amber-500/15 text-amber-400" :
                  displayStatus === 'today' ? "bg-violet-500/15 text-violet-400" :
                  displayStatus === 'overdue' ? "bg-red-500/15 text-red-400" :
                  "bg-blue-500/15 text-blue-400"
                )}>
                  <div className="flex items-center gap-2">
                    <span className={cn("w-1.5 h-1.5 rounded-full shrink-0",
                      displayStatus === 'done' ? "bg-emerald-400" :
                      displayStatus === 'in-progress' ? "bg-amber-400" :
                      displayStatus === 'today' ? "bg-violet-400" :
                      displayStatus === 'overdue' ? "bg-red-400" : "bg-blue-400"
                    )} />
                    <span>
                      {displayStatus === 'done' ? 'Completed' :
                       displayStatus === 'in-progress' ? 'In Progress' :
                       displayStatus === 'today' ? 'Today' :
                       displayStatus === 'overdue' ? 'Overdue' : 'To Do'}
                    </span>
                  </div>
                  <ChevronDown className="w-3 h-3 opacity-60 shrink-0 transition-none" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-[160px] p-1 bg-panel border border-[var(--bone-6)] shadow-2xl rounded-[12px] z-[202]" align="start">
                {[
                  { id: 'todo' as const, label: 'To Do', color: 'bg-blue-400', activeColor: 'text-blue-400', bgColor: 'bg-blue-500/15', onClick: () => { setCompleted(false); setStatus('todo'); setDueDate(''); } },
                  { id: 'in-progress' as const, label: 'In Progress', color: 'bg-amber-400', activeColor: 'text-amber-400', bgColor: 'bg-amber-500/15', onClick: () => { setCompleted(false); setStatus('in-progress'); } },
                  { id: 'today' as const, label: 'Today', color: 'bg-violet-400', activeColor: 'text-violet-400', bgColor: 'bg-violet-500/15', onClick: () => { setCompleted(false); setStatus('todo'); setDueDate(todayStr); } },
                  { id: 'overdue' as const, label: 'Overdue', color: 'bg-red-400', activeColor: 'text-red-400', bgColor: 'bg-red-500/15', onClick: () => { setCompleted(false); setStatus('todo'); setDueDate(yesterdayStr); } },
                  { id: 'done' as const, label: 'Completed', color: 'bg-emerald-400', activeColor: 'text-emerald-400', bgColor: 'bg-emerald-500/15', onClick: () => { setCompleted(true); } },
                ].map(opt => {
                  const isActive = (opt.id === 'done' && displayStatus === 'done') || (opt.id !== 'done' && displayStatus === opt.id);
                  return (
                    <button key={opt.id} onClick={opt.onClick}
                      className={cn("w-full px-3 py-2 text-left text-xs rounded-[8px] flex items-center justify-between mt-0.5 cursor-pointer transition-none", isActive ? `${opt.bgColor} ${opt.activeColor} font-semibold` : `${opt.activeColor}/70 hover:${opt.bgColor} hover:${opt.activeColor}`)}>
                      <div className="flex items-center gap-2">
                        <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", opt.color)} />
                        <span>{opt.label}</span>
                      </div>
                      {isActive && <Check className="w-3 h-3" />}
                    </button>
                  );
                })}
              </PopoverContent>
            </Popover>
          </div>

          {/* Priority */}
          <div className="text-[var(--bone-40)] font-semibold flex items-center gap-2">
            <AlertCircle className="w-3 h-3 opacity-60" /> Priority
          </div>
          <div className="flex gap-1.5">
            {(['low', 'medium', 'high'] as const).map(p => (
              <button key={p} onClick={() => togglePriority(p)}
                className={cn("px-2.5 py-1.5 rounded-[6px] text-xs font-medium transition-all cursor-pointer capitalize border-none",
                  priority === p
                    ? p === 'high' ? "bg-red-500/15 text-red-400" :
                      p === 'medium' ? "bg-amber-500/15 text-amber-400" : "bg-blue-500/15 text-blue-400"
                    : "bg-[var(--bone-6)] text-[var(--bone-40)] hover:bg-[var(--bone-10)]"
                )}>{p}</button>
            ))}
          </div>

          {/* Due Date */}
          <div className="text-[var(--bone-40)] font-semibold flex items-center gap-2">
            <Calendar className="w-3 h-3 opacity-60" /> Due Date
          </div>
          <div className="w-[160px]">
            <DatePickerTime
              date={dueDate ? parseLocalDate(dueDate) : undefined}
              setDate={(d) => setDueDate(d ? formatLocalDate(d) : '')}
              time={dueTime} setTime={setDueTime}
              hideLabels hideTime
            />
          </div>

          {/* Workspace */}
          <div className="text-[var(--bone-40)] font-semibold flex items-center gap-2">
            <Folder className="w-3 h-3 opacity-60" /> Workspace
          </div>
          <div className="w-[160px]">
            <Popover>
              <PopoverTrigger asChild>
                {workspaceId ? (() => {
                  const ws = workspaces.find(w => w.id === workspaceId);
                  const WsIcon = ws ? getEntityIcon(ws.icon) : Folder;
                  return (
                    <button className="w-full flex items-center bg-[var(--bone-6)] rounded-[6px] pl-2.5 pr-2 py-1.5 text-xs text-[var(--bone-90)] hover:bg-[var(--bone-10)] cursor-pointer">
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <WsIcon className="w-3 h-3 opacity-60 shrink-0" />
                        <span className="truncate font-semibold">{ws?.title || "Assigned"}</span>
                      </div>
                    </button>
                  );
                })() : (
                  <button className="w-full flex items-center justify-start bg-[var(--bone-6)] rounded-[6px] px-2.5 py-1.5 text-xs text-[var(--bone-30)] hover:bg-[var(--bone-10)] cursor-pointer">
                    <span className="font-medium">None</span>
                  </button>
                )}
              </PopoverTrigger>
              <PopoverContent className="w-[200px] p-1.5 bg-panel border border-[var(--bone-6)] shadow-2xl rounded-[12px] z-[202]" align="start">
                <button onClick={() => setWorkspaceId(null)}
                  className={cn("w-full px-3 py-1.5 text-left text-xs rounded-[8px] transition-none cursor-pointer", !workspaceId ? "bg-[var(--bone-10)] text-[var(--bone-100)] font-semibold" : "text-[var(--bone-70)] hover:bg-[var(--bone-5)]")}>None</button>
                {workspaces.map(w => {
                  const WsIcon = getEntityIcon(w.icon);
                  return (
                    <button key={w.id} onClick={() => setWorkspaceId(w.id)}
                      className={cn("w-full px-3 py-1.5 text-left text-xs rounded-[8px] transition-none mt-0.5 cursor-pointer", workspaceId === w.id ? "bg-[var(--bone-10)] text-[var(--bone-100)] font-semibold" : "text-[var(--bone-70)] hover:bg-[var(--bone-5)]")}>
                      <div className="flex items-center gap-1.5">
                        <WsIcon className="w-3 h-3 opacity-60" />
                        <span className="truncate">{w.title}</span>
                      </div>
                    </button>
                  );
                })}
              </PopoverContent>
            </Popover>
          </div>

          {/* Color Tag */}
          <div className="text-[var(--bone-40)] font-semibold flex items-center gap-2">
            <Tag className="w-3 h-3 opacity-60" /> Color Tag
          </div>
          <div className="flex items-center gap-2.5 h-5">
            <button onClick={() => setColor('')}
              className={cn("w-3.5 h-3.5 rounded-full transition-all flex items-center justify-center cursor-pointer border border-dashed", !color ? "border-[var(--bone-70)] scale-110" : "border-[var(--bone-25)] opacity-40 hover:opacity-100")}>
              <div className="w-1.5 h-1.5 rounded-full bg-[var(--bone-40)]" />
            </button>
            {COLORS.map(c => (
              <button key={c} onClick={() => setColor(c)}
                className={cn("w-3.5 h-3.5 rounded-full transition-all cursor-pointer", color === c ? "scale-110 ring-1 ring-[var(--bone-70)] ring-offset-1 ring-offset-sidebar" : "opacity-40 hover:opacity-100")}
                style={{ backgroundColor: c }} />
            ))}
          </div>
        </div>

        {/* Description */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-[var(--bone-40)]">
            <FileText className="w-3.5 h-3.5 opacity-60" /> Description
          </div>
          <div className="bg-[var(--bone-6)] rounded-[10px] p-3 min-h-[100px]">
            <textarea
              placeholder="Write description or notes..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full bg-transparent text-[var(--bone-80)] placeholder-[var(--bone-30)] border-none outline-none resize-none text-sm leading-relaxed min-h-[80px] scrollbar-thin"
            />
          </div>
        </div>

        {/* Subtasks */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-[var(--bone-40)]">
            <CheckSquare className="w-3.5 h-3.5 opacity-40" /> Subtasks
          </div>
          {subtasks.length > 0 && (
            <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1 scrollbar-thin">
              {subtasks.map(sub => (
                <div key={sub.id} className="flex items-center gap-2.5 group">
                  <button onClick={() => toggleSubtask(sub.id)}
                    className="w-4 h-4 rounded-[4px] border flex items-center justify-center shrink-0 cursor-pointer border-[var(--bone-30)] hover:border-[var(--bone-70)] bg-[var(--bone-6)] transition-colors">
                    {sub.completed && <Check className="w-[10px] h-[10px] text-[var(--bone-100)] stroke-[3px]" />}
                  </button>
                  <span className={cn("text-sm flex-1", sub.completed ? "text-[var(--bone-40)] line-through" : "text-[var(--bone-90)]")}>{sub.text}</span>
                  <button onClick={() => removeSubtask(sub.id)}
                    className="text-[var(--bone-30)] hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <div className="flex-1 bg-[var(--bone-6)] rounded-[8px] px-3 py-2">
              <input type="text" placeholder="Add new subtask..." value={newSubtaskText}
                onChange={e => setNewSubtaskText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddSubtask()}
                className="w-full bg-transparent text-xs text-[var(--bone-90)] placeholder-[var(--bone-30)] outline-none" />
            </div>
            <button onClick={handleAddSubtask}
              className="w-8 h-8 flex items-center justify-center bg-[var(--bone-6)] rounded-[8px] text-[var(--bone-70)] hover:text-[var(--bone-100)] hover:bg-[var(--bone-10)] transition-all cursor-pointer shrink-0">
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="shrink-0 px-5 py-3 border-t border-[var(--bone-6)] flex items-center justify-between bg-sidebar">
        {isEditing ? (
          <button onClick={handleDelete}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-red-400/60 hover:text-red-400 hover:bg-red-500/10 text-xs font-medium transition-all cursor-pointer">
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
        ) : <div />}
        <button onClick={handleSaveAndClose} disabled={!title.trim()}
          className="px-5 py-2 rounded-[8px] bg-[var(--accent)] text-white text-sm font-semibold hover:opacity-90 active:scale-95 transition-all disabled:opacity-20 cursor-pointer">
          Done
        </button>
      </div>
    </div>
  );
}

export function TaskInspectorPanel() {
  const activeTaskId = useStore(s => s.activeTaskId);
  const closeTaskPanel = useStore(s => s.closeTaskPanel);

  // Keep last non-null taskId so TaskPanelContent stays mounted across opens.
  // This turns re-opens into cheap updates instead of expensive full mounts.
  // Never return null — the wrapper must always be in the DOM so the first
  // open doesn't trigger a mount during the transition (that blocks the thread).
  const stableTaskIdRef = useRef<string | null>(null);
  if (activeTaskId) stableTaskIdRef.current = activeTaskId;
  const stableTaskId = stableTaskIdRef.current;

  return (
    <div className="h-full w-full flex flex-col bg-sidebar overflow-hidden">
      {/* Panel Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--bone-6)] shrink-0">
        <span className="text-xs font-semibold text-[var(--bone-40)] tracking-wide uppercase">Task</span>
        <button onClick={closeTaskPanel}
          className="w-6 h-6 flex items-center justify-center rounded-[6px] text-[var(--bone-40)] hover:text-[var(--bone-100)] hover:bg-[var(--bone-10)] transition-all cursor-pointer">
          <X className="w-3.5 h-3.5" strokeWidth={2} />
        </button>
      </div>

      {/* Task Form — always mounted so first open doesn't pay a mount cost mid-transition.
          '__placeholder__' resolves to no task (empty state) until a real id is set. */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <TaskPanelContent taskId={stableTaskId || '__placeholder__'} closePanel={closeTaskPanel} />
      </div>
    </div>
  );
}
