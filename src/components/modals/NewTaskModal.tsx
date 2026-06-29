"use client";

import { useStore, generateId, AppTask } from '@/data/store';
import { SubTask } from '@/data/store.types';
import { X, Plus, Calendar, Palette, Trash2, CheckSquare, Circle, AlertCircle, Folder, Check, CircleDot, Tag, FileText, ChevronDown } from 'lucide-react';
import { useState, useEffect, useRef, useMemo } from 'react';
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
  '#EF4444', // Red
  '#F59E0B', // Amber
  '#10B981', // Emerald
  '#3B82F6', // Blue
  '#8B5CF6', // Violet
  '#EC4899', // Pink
];

export function NewTaskModal() {
  const { modal, closeModal, addTask, updateTask, deleteTask, entities, tasks, trackerFilterWorkspace } = useStore();
  const taskId = modal?.kind === 'newTask' ? modal.taskId : undefined;
  const isEditing = !!taskId;

  // Track hydrated task data
  const activeTask = useMemo(() => isEditing ? tasks.find(x => x.id === taskId) : null, [taskId, tasks, isEditing]);

  // Local decoupled states for performance and anti-lag
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

  // Ref for unmount autosave logic (Fix 3.1)
  const saveRef = useRef({
    taskId,
    title,
    description,
    dueDate,
    dueTime,
    priority,
    color,
    workspaceId,
    subtasks,
    completed,
    status,
    isEditing,
  });

  // Update ref on every state change
  useEffect(() => {
    saveRef.current = {
      taskId,
      title,
      description,
      dueDate,
      dueTime,
      priority,
      color,
      workspaceId,
      subtasks,
      completed,
      status,
      isEditing,
    };
  }, [title, description, dueDate, dueTime, priority, color, workspaceId, subtasks, completed, status, taskId, isEditing]);

  // Load initial data on mount or change
  useEffect(() => {
    if (!modal || modal.kind !== 'newTask') return;

    if (activeTask) {
      setTitle(activeTask.title || '');
      setDescription(activeTask.description || activeTask.note || '');
      setDueDate(activeTask.dueDate || '');
      // @ts-ignore
      setDueTime(activeTask.dueTime || '');
      setPriority(activeTask.priority || null);
      setColor(activeTask.color || '');
      setWorkspaceId(activeTask.workspaceId || null);
      setSubtasks(activeTask.subtasks || []);
      setCompleted(activeTask.completed || false);
      setStatus(activeTask.status || 'todo');
    } else {
      // Reset for new task
      setTitle('');
      setDescription('');
      setDueDate('');
      setDueTime('');
      setPriority(null);
      setColor('');
      setWorkspaceId(trackerFilterWorkspace || null);
      setSubtasks([]);
      setCompleted(false);
      setStatus('todo');
    }
  }, [modal, activeTask, trackerFilterWorkspace]);

  // Autosave on Unmount (Fix 3.1)
  useEffect(() => {
    return () => {
      const data = saveRef.current;
      if (!data.title.trim()) return; // Skip empty tasks

      if (data.isEditing && data.taskId) {
        useStore.getState().updateTask(data.taskId, {
          title: data.title.trim(),
          description: data.description.trim(),
          note: data.description.trim(), // Fix 3.11 Concurrent writes
          dueDate: data.dueDate || undefined,
          userDueDate: data.dueDate || undefined,
          // @ts-ignore
          dueTime: data.dueTime || undefined,
          priority: data.priority,
          color: data.color,
          workspaceId: data.workspaceId || undefined,
          subtasks: data.subtasks,
          completed: data.completed,
          status: data.completed ? 'done' : data.status,
        });
      }
      // Note: New tasks are explicit, we only autosave edits to prevent garbage ghosts
    };
  }, []);

  const sourceColumn = modal?.kind === 'newTask' ? modal.sourceColumn : undefined;

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const yesterdayStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  }, []);

  // Derive display status from the current state — "today" and "overdue" are
  // date-derived pseudo-statuses, not actual AppTask status values.
  const displayStatus = useMemo<'todo' | 'in-progress' | 'done' | 'today' | 'overdue'>(() => {
    if (completed) return 'done';
    if (status === 'in-progress') return 'in-progress';
    if (dueDate && dueDate < todayStr) return 'overdue';
    if (dueDate === todayStr) return 'today';
    return 'todo';
  }, [completed, status, dueDate, todayStr]);

  // Pre-fill fields based on which column's "+" button was clicked.
  useEffect(() => {
    if (!modal || modal.kind !== 'newTask') return;
    if (modal.taskId) return; // Only for new tasks, not editing

    switch (modal.sourceColumn) {
      case 'today':
        setDueDate(todayStr);
        break;
      case 'inProgress':
        setDueDate('');
        setStatus('in-progress');
        break;
      case 'overdue':
        setDueDate(yesterdayStr);
        break;
      case 'completed':
        setCompleted(true);
        break;
      case 'todo':
      default:
        // Keep defaults: status 'todo', no dueDate
        break;
    }
  }, [modal, todayStr, yesterdayStr]);

  const workspaces = useMemo(() => {
    return entities.filter(e => e.type === 'workspace' || e.type === 'collection');
  }, [entities]);

  // Subtasks Logic
  const [newSubtaskText, setNewSubtaskText] = useState('');

  if (!modal || modal.kind !== 'newTask') return null;

  // Manual Save handler
  const handleSaveAndClose = () => {
    const t = title.trim();
    if (!t) {
      closeModal();
      return;
    }

    let finalSubtasks = subtasks;
    if (newSubtaskText.trim()) {
      finalSubtasks = [...subtasks, { id: generateId(), text: newSubtaskText.trim(), completed: false }];
    }

    if (isEditing && taskId) {
      updateTask(taskId, {
        title: t,
        description: description.trim(),
        note: description.trim(), // Fix 3.11
        dueDate: dueDate || undefined,
        userDueDate: dueDate || undefined,
        // @ts-ignore
        dueTime: dueTime || undefined,
        priority: priority,
        color: color,
        workspaceId: workspaceId || undefined,
        subtasks: finalSubtasks,
        completed: completed,
        status: completed ? 'done' : status,
      });
    } else {
      addTask({
        id: generateId(),
        title: t,
        completed: completed,
        status: completed ? 'done' : status,
        description: description.trim(),
        note: description.trim(),
        dueDate: dueDate || undefined,
        userDueDate: dueDate || undefined,
        // @ts-ignore
        dueTime: dueTime || undefined,
        priority: priority,
        color: color,
        workspaceId: workspaceId || undefined,
        subtasks: finalSubtasks,
        createdAt: Date.now(),
      });
    }
    // Clear title in ref to prevent unmount autosave overwriting with old data
    saveRef.current.title = '';
    closeModal();
  };

  const handleDelete = () => {
    if (isEditing && taskId) {
      deleteTask(taskId);
      // Clear ref to prevent autosave on unmount rewriting deleted entity
      saveRef.current.title = ''; 
      closeModal();
    }
  };

  // Priority Toggle logic (Fix 3.4)
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
    <div 
      className="fixed inset-0 z-[200] bg-black/25 transition-opacity duration-300" 
      onClick={handleSaveAndClose}
    >
      <div
        className="fixed top-0 right-0 bottom-0 h-full w-full sm:w-[500px] bg-panel border-l border-[var(--bone-12)] shadow-2xl overflow-hidden flex flex-col z-[201] animate-drawer-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Thin top color stripe */}
        <div className="absolute top-0 left-0 right-0 h-[3px] opacity-90 z-10" style={{ backgroundColor: color }} />

        {/* HEADER SECTION */}
        <div className="flex items-center justify-between py-2 px-4 border-b border-[var(--bone-6)] relative shrink-0">
          {/* Close button on the left (matching the reference image) */}
          <button 
            onClick={closeModal}
            className="w-6 h-6 flex items-center justify-center rounded-[6px] border border-[var(--bone-6)] bg-[var(--bone-2)] text-[var(--bone-40)] hover:text-[var(--bone-100)] hover:bg-[var(--bone-10)] transition-all shrink-0 cursor-pointer"
          >
            <X className="w-3 h-3" />
          </button>

          {/* Quick actions on the right */}
          <div className="flex items-center gap-2">
            {isEditing && (
              <button
                onClick={handleDelete}
                className="w-6 h-6 flex items-center justify-center rounded-[6px] border border-red-500/20 bg-red-500/5 text-red-500/60 hover:text-red-500 hover:bg-red-500/10 transition-all cursor-pointer"
                title="Delete Task"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* SCROLLABLE BODY */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 scrollbar-thin">
          
          {/* Title Input */}
          <div className="space-y-1">
            <input
              type="text"
              placeholder="Task Title..."
              value={title}
              onChange={e => setTitle(e.target.value)}
              className={cn(
                "w-full bg-transparent text-2xl font-bold tracking-tight text-[var(--bone-100)] placeholder-[var(--bone-30)] border-none outline-none",
                completed && "line-through text-[var(--bone-40)]"
              )}
              autoFocus
            />
          </div>

          {/* Metadata Properties Grid */}
          <div className="border-b border-[var(--bone-6)] pb-4 grid grid-cols-[120px_1fr] gap-y-4 text-xs items-center shrink-0">
            {/* Property 1: Status */}
            <div className="text-[var(--bone-40)] font-semibold text-xs flex items-center gap-2">
              <CircleDot className="w-3.5 h-3.5 opacity-60" />
              Status
            </div>
            <div className="w-[180px]">
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className={cn(
                      "w-full flex items-center justify-between border-none rounded-[6px] px-3 py-1.5 text-xs font-semibold cursor-pointer transition-none",
                      displayStatus === 'done' ? "bg-emerald-500/15 text-emerald-400" :
                      displayStatus === 'in-progress' ? "bg-amber-500/15 text-amber-400" :
                      displayStatus === 'today' ? "bg-violet-500/15 text-violet-400" :
                      displayStatus === 'overdue' ? "bg-red-500/15 text-red-400" :
                      "bg-blue-500/15 text-blue-400"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "w-1.5 h-1.5 rounded-full shrink-0",
                        displayStatus === 'done' ? "bg-emerald-400" :
                        displayStatus === 'in-progress' ? "bg-amber-400" :
                        displayStatus === 'today' ? "bg-violet-400" :
                        displayStatus === 'overdue' ? "bg-red-400" :
                        "bg-blue-400"
                      )} />
                      <span>
                        {displayStatus === 'done' ? 'Completed' :
                         displayStatus === 'in-progress' ? 'In Progress' :
                         displayStatus === 'today' ? 'Today' :
                         displayStatus === 'overdue' ? 'Overdue' :
                         'To Do'}
                      </span>
                    </div>
                    <ChevronDown className={cn(
                      "w-3.5 h-3.5 opacity-60 shrink-0 transition-none",
                      displayStatus === 'done' ? "text-emerald-400" :
                      displayStatus === 'in-progress' ? "text-amber-400" :
                      displayStatus === 'today' ? "text-violet-400" :
                      displayStatus === 'overdue' ? "text-red-400" :
                      "text-blue-400"
                    )} />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-[180px] p-1 bg-panel border border-[var(--bone-6)] shadow-2xl rounded-[12px] backdrop-blur-3xl z-[202]" align="start">
                  <button
                    onClick={() => {
                      setCompleted(false);
                      setStatus('todo');
                      setDueDate('');
                    }}
                    className={cn(
                      "w-full px-3 py-2 text-left text-xs rounded-[8px] flex items-center justify-between cursor-pointer transition-none",
                      displayStatus === 'todo'
                        ? "bg-blue-500/15 text-blue-400 font-semibold"
                        : "text-blue-400/70 hover:bg-blue-500/10 hover:text-blue-400"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                      <span>To Do</span>
                    </div>
                    {displayStatus === 'todo' && <Check className="w-3.5 h-3.5 text-blue-400" />}
                  </button>
                  <button
                    onClick={() => {
                      setCompleted(false);
                      setStatus('in-progress');
                    }}
                    className={cn(
                      "w-full px-3 py-2 text-left text-xs rounded-[8px] flex items-center justify-between mt-0.5 cursor-pointer transition-none",
                      displayStatus === 'in-progress'
                        ? "bg-amber-500/15 text-amber-400 font-semibold"
                        : "text-amber-400/70 hover:bg-amber-500/10 hover:text-amber-400"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                      <span>In Progress</span>
                    </div>
                    {displayStatus === 'in-progress' && <Check className="w-3.5 h-3.5 text-amber-400" />}
                  </button>
                  <button
                    onClick={() => {
                      setCompleted(false);
                      setStatus('todo');
                      setDueDate(todayStr);
                    }}
                    className={cn(
                      "w-full px-3 py-2 text-left text-xs rounded-[8px] flex items-center justify-between mt-0.5 cursor-pointer transition-none",
                      (displayStatus === 'today' && !completed)
                        ? "bg-violet-500/15 text-violet-400 font-semibold"
                        : "text-violet-400/70 hover:bg-violet-500/10 hover:text-violet-400"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />
                      <span>Today</span>
                    </div>
                    {displayStatus === 'today' && !completed && <Check className="w-3.5 h-3.5 text-violet-400" />}
                  </button>
                  <button
                    onClick={() => {
                      setCompleted(false);
                      setStatus('todo');
                      setDueDate(yesterdayStr);
                    }}
                    className={cn(
                      "w-full px-3 py-2 text-left text-xs rounded-[8px] flex items-center justify-between mt-0.5 cursor-pointer transition-none",
                      (displayStatus === 'overdue' && !completed)
                        ? "bg-red-500/15 text-red-400 font-semibold"
                        : "text-red-400/70 hover:bg-red-500/10 hover:text-red-400"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                      <span>Overdue</span>
                    </div>
                    {displayStatus === 'overdue' && !completed && <Check className="w-3.5 h-3.5 text-red-400" />}
                  </button>
                  <button
                    onClick={() => {
                      setCompleted(true);
                    }}
                    className={cn(
                      "w-full px-3 py-2 text-left text-xs rounded-[8px] flex items-center justify-between mt-0.5 cursor-pointer transition-none",
                      displayStatus === 'done'
                        ? "bg-emerald-500/15 text-emerald-400 font-semibold"
                        : "text-emerald-400/70 hover:bg-emerald-500/10 hover:text-emerald-400"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                      <span>Completed</span>
                    </div>
                    {displayStatus === 'done' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                  </button>
                </PopoverContent>
              </Popover>
            </div>

            {/* Property 2: Priority */}
            <div className="text-[var(--bone-40)] font-semibold text-xs flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 opacity-60" />
              Priority
            </div>
            <div className="flex gap-1.5">
              {(['low', 'medium', 'high'] as const).map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => togglePriority(p)}
                  className={cn(
                    "px-3 py-1.5 rounded-[6px] text-xs font-medium transition-all cursor-pointer capitalize border-none",
                    priority === p 
                      ? p === 'high' ? "bg-red-500/15 text-red-400" :
                        p === 'medium' ? "bg-amber-500/15 text-amber-400" :
                        "bg-blue-500/15 text-blue-400"
                      : "bg-[var(--bone-6)] text-[var(--bone-40)] hover:bg-[var(--bone-10)]"
                  )}
                >
                  {p}
                </button>
              ))}
            </div>

            {/* Property 3: Due Date */}
            <div className="text-[var(--bone-40)] font-semibold text-xs flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 opacity-60" />
              Due Date
            </div>
            <div className="w-[180px]">
              <DatePickerTime 
                date={dueDate ? parseLocalDate(dueDate) : undefined} 
                setDate={(d) => setDueDate(d ? formatLocalDate(d) : '')}
                time={dueTime}
                setTime={setDueTime}
                hideLabels
                hideTime
              />
            </div>

            {/* Property 4: Workspace */}
            <div className="text-[var(--bone-40)] font-semibold text-xs flex items-center gap-2">
              <Folder className="w-3.5 h-3.5 opacity-60" />
              Workspace
            </div>
            <div className="w-[180px]">
              <div className="relative w-full">
              <Popover>
                <PopoverTrigger asChild>
                  {workspaceId ? (() => {
                    const ws = workspaces.find(w => w.id === workspaceId);
                    const WorkspaceIcon = ws ? getEntityIcon(ws.icon) : Folder;
                    return (
                      <button className="w-full flex items-center bg-[var(--bone-6)] data-[state=open]:bg-[var(--bone-10)] data-[state=open]:text-[var(--bone-100)] border border-transparent rounded-[6px] pl-3 pr-8 py-1.5 text-xs text-[var(--bone-90)] hover:bg-[var(--bone-10)] transition-none cursor-pointer">
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          <WorkspaceIcon className="w-3.5 h-3.5 opacity-60 shrink-0 text-[var(--bone-70)]" />
                          <span className="truncate font-semibold text-[var(--bone-90)]">{ws?.title || "Assigned"}</span>
                        </div>
                      </button>
                    );
                  })() : (
                    <button className="w-full flex items-center justify-start bg-[var(--bone-6)] border border-transparent hover:bg-[var(--bone-10)] rounded-[6px] px-3 py-1.5 text-xs text-[var(--bone-30)] transition-none cursor-pointer">
                      <span className="font-medium">None</span>
                    </button>
                  )}
                </PopoverTrigger>
                <PopoverContent className="w-[220px] p-1.5 bg-panel border border-[var(--bone-6)] shadow-2xl rounded-[12px] backdrop-blur-3xl z-[202]" align="start">
                  <button
                    onClick={() => setWorkspaceId(null)}
                    className={cn(
                      "w-full px-3 py-1.5 text-left text-xs rounded-[8px] transition-none cursor-pointer",
                      !workspaceId ? "bg-[var(--bone-10)] text-[var(--bone-100)] font-semibold" : "text-[var(--bone-70)] hover:bg-[var(--bone-5)]"
                    )}
                  >
                    None
                  </button>
                  {workspaces.map(w => {
                    const WsIcon = getEntityIcon(w.icon);
                    return (
                      <button
                        key={w.id}
                        onClick={() => setWorkspaceId(w.id)}
                        className={cn(
                          "w-full px-3 py-1.5 text-left text-xs rounded-[8px] transition-none mt-0.5 cursor-pointer",
                          workspaceId === w.id ? "bg-[var(--bone-10)] text-[var(--bone-100)] font-semibold" : "text-[var(--bone-70)] hover:bg-[var(--bone-5)]"
                        )}
                      >
                        <div className="flex items-center gap-1.5 w-full">
                          <WsIcon className="w-3.5 h-3.5 opacity-60 text-[var(--bone-70)]" />
                          <span className="truncate">{w.title}</span>
                        </div>
                      </button>
                    );
                  })}
                </PopoverContent>
              </Popover>
              {workspaceId && (
                <span
                  onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
                  onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setWorkspaceId(null);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center rounded-[4px] text-[var(--bone-40)] hover:text-[var(--bone-100)] hover:bg-[var(--bone-15)] transition-none shrink-0 cursor-pointer z-20"
                >
                  <X className="w-2.5 h-2.5" />
                </span>
              )}
              </div>
            </div>

            {/* Property 5: Color Tag */}
            <div className="text-[var(--bone-40)] font-semibold text-xs flex items-center gap-2">
              <Tag className="w-3.5 h-3.5 opacity-60" />
              Color Tag
            </div>
            <div className="flex items-center gap-2.5 h-6">
              {/* Default (No Color) Option */}
              <button
                type="button"
                onClick={() => setColor('')}
                className={cn(
                  "w-4 h-4 rounded-full transition-all duration-300 flex items-center justify-center relative cursor-pointer border border-dashed",
                  !color ? "border-[var(--bone-70)] scale-110" : "border-[var(--bone-25)] opacity-40 hover:opacity-100"
                )}
                title="Default (No Color)"
              >
                {!color && (
                  <div className="absolute -inset-1 rounded-full border border-[var(--bone-70)]" />
                )}
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--bone-40)]" />
              </button>

              {COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    "w-4 h-4 rounded-full transition-all duration-300 flex items-center justify-center relative cursor-pointer",
                    color === c ? "scale-110" : "opacity-40 hover:opacity-100"
                  )}
                  style={{ backgroundColor: c }}
                >
                  {color === c && (
                    <div className="absolute -inset-1 rounded-full border border-[var(--bone-70)]" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Description Section */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--bone-40)]">
              <FileText className="w-3.5 h-3.5 opacity-60" />
              Description
            </div>
            <div className="bg-[var(--bone-6)] rounded-[10px] p-3.5 min-h-[120px] transition-colors">
              <textarea
                placeholder="Write description or notes..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="w-full bg-transparent text-[var(--bone-80)] placeholder-[var(--bone-30)] border-none outline-none resize-none text-sm leading-relaxed min-h-[100px] scrollbar-thin"
              />
            </div>
          </div>

          {/* Subtasks Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--bone-40)]">
              <CheckSquare className="w-3.5 h-3.5 opacity-40" />
              Subtasks
            </div>
            
            {/* Subtask Items */}
            {subtasks.length > 0 && (
              <div className="space-y-2.5 max-h-[180px] overflow-y-auto pr-1 scrollbar-thin">
                {subtasks.map(sub => (
                  <div
                    key={sub.id}
                    className="flex items-center gap-3 group"
                  >
                    <button 
                      onClick={() => toggleSubtask(sub.id)}
                      className="w-4 h-4 rounded-[4px] border flex items-center justify-center shrink-0 cursor-pointer border-[var(--bone-30)] hover:border-[var(--bone-70)] bg-[var(--bone-6)] hover:bg-[var(--app-dark)] transition-colors"
                    >
                      {sub.completed && <Check className="w-[10px] h-[10px] text-[var(--bone-100)] stroke-[3px]" />}
                    </button>
                    <span className={cn(
                      "text-sm flex-1",
                      sub.completed ? "text-[var(--bone-40)] line-through" : "text-[var(--bone-90)]"
                    )}>
                      {sub.text}
                    </span>
                    <button 
                      onClick={() => removeSubtask(sub.id)}
                      className="p-1 text-[var(--bone-30)] hover:text-red-400 transition-colors cursor-pointer opacity-0 group-hover:opacity-100 invisible group-hover:visible"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add Subtask Composer */}
            <div className="flex gap-2">
              <div className="flex-1 bg-[var(--bone-6)] rounded-[8px] px-3 py-2 transition-colors">
                <input
                  type="text"
                  placeholder="Add new subtask..."
                  value={newSubtaskText}
                  onChange={e => setNewSubtaskText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddSubtask()}
                  className="w-full bg-transparent text-xs text-[var(--bone-90)] placeholder-[var(--bone-30)] outline-none"
                />
              </div>
              <button
                onClick={handleAddSubtask}
                className="w-8 h-8 flex items-center justify-center bg-[var(--bone-6)] rounded-[8px] text-[var(--bone-70)] hover:text-[var(--bone-100)] hover:bg-[var(--bone-10)] transition-all cursor-pointer shrink-0 border-none"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

        </div>

        {/* STATIC FOOTER BAR */}
        <div className="shrink-0 px-6 py-4 border-t border-[var(--bone-6)] flex items-center justify-end bg-panel">
          <button
            onClick={handleSaveAndClose}
            disabled={!title.trim()}
            className="px-5 py-2 flex items-center justify-center rounded-[8px] bg-[var(--accent)] text-white text-sm font-semibold hover:opacity-90 active:scale-95 transition-all disabled:opacity-20 cursor-pointer"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
}
