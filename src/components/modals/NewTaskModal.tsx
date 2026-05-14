"use client";

import { useStore, generateId, AppTask } from '@/data/store';
import { SubTask } from '@/data/store.types';
import { X, Plus, Calendar, Palette, Trash2, CheckSquare, Circle, AlertCircle, Folder } from 'lucide-react';
import { useState, useEffect, useRef, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { DatePickerTime } from '@/components/ui/date-time-picker';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const COLORS = [
  '#EF4444', // Red
  '#F59E0B', // Amber
  '#10B981', // Emerald
  '#3B82F6', // Blue
  '#8B5CF6', // Violet
  '#EC4899', // Pink
];

export function NewTaskModal() {
  const { modal, closeModal, addTask, updateTask, deleteTask, entities, tasks } = useStore();
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
  const [color, setColor] = useState(COLORS[0]);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [subtasks, setSubtasks] = useState<SubTask[]>([]);
  const [completed, setCompleted] = useState(false);

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
      isEditing,
    };
  }, [title, description, dueDate, dueTime, priority, color, workspaceId, subtasks, completed, taskId, isEditing]);

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
      setColor(activeTask.color || COLORS[0]);
      setWorkspaceId(activeTask.workspaceId || null);
      setSubtasks(activeTask.subtasks || []);
      setCompleted(activeTask.completed || false);
    } else {
      // Reset for new task
      setTitle('');
      setDescription('');
      setDueDate('');
      setDueTime('');
      setPriority(null);
      setColor(COLORS[0]);
      setWorkspaceId(null);
      setSubtasks([]);
      setCompleted(false);
    }
  }, [modal, activeTask]);

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
          // @ts-ignore
          dueTime: data.dueTime || undefined,
          priority: data.priority,
          color: data.color,
          workspaceId: data.workspaceId || undefined,
          subtasks: data.subtasks,
          completed: data.completed,
        });
      }
      // Note: New tasks are explicit, we only autosave edits to prevent garbage ghosts
    };
  }, []);


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

    if (isEditing && taskId) {
      updateTask(taskId, {
        title: t,
        description: description.trim(),
        note: description.trim(), // Fix 3.11
        dueDate: dueDate || undefined,
        // @ts-ignore
        dueTime: dueTime || undefined,
        priority: priority,
        color: color,
        workspaceId: workspaceId || undefined,
        subtasks: subtasks,
        completed: completed,
      });
    } else {
      addTask({
        id: generateId(),
        title: t,
        completed: completed,
        description: description.trim(),
        note: description.trim(),
        dueDate: dueDate || undefined,
        // @ts-ignore
        dueTime: dueTime || undefined,
        priority: priority,
        color: color,
        workspaceId: workspaceId || undefined,
        subtasks: subtasks,
        createdAt: Date.now(),
      });
    }
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
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm" 
      onClick={handleSaveAndClose}
    >
      <div
        className="bg-panel border border-[var(--bone-12)] w-full max-w-[480px] rounded-[12px] shadow-2xl overflow-hidden flex flex-col relative"
        onClick={e => e.stopPropagation()}
      >
        {/* Decorative Color Bar Top (Thin & Integrated) */}
        <div className="absolute top-0 left-0 right-0 h-[2px] opacity-80" style={{ backgroundColor: color }} />

        {/* HEADER SECTION */}
        <div className="flex items-center gap-4 p-6 pb-4 relative">
          {/* Circular Completion Toggle */}
          <button 
            onClick={() => setCompleted(!completed)}
            className="hover:scale-105 transition-transform shrink-0"
          >
            {completed ? (
              <div className="w-8 h-8 rounded-full border-2 border-emerald-500/50 flex items-center justify-center bg-emerald-500/10">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-full border-2 border-[var(--bone-20)] hover:border-[var(--bone-40)] transition-colors" />
            )}
          </button>

          {/* Large Title Input */}
          <input
            type="text"
            placeholder="Task Title..."
            value={title}
            onChange={e => setTitle(e.target.value)}
            className={cn(
              "flex-1 bg-transparent text-2xl font-semibold tracking-tight text-[var(--bone-90)] placeholder-[var(--bone-20)] border-none outline-none",
              completed && "line-through text-[var(--bone-30)]"
            )}
            autoFocus
          />

          {/* Square Styled Close Button */}
          <button 
            onClick={closeModal}
            className="w-8 h-8 flex items-center justify-center rounded-[8px] border border-[var(--bone-6)] bg-[var(--bone-8)] text-[var(--bone-40)] hover:text-[var(--bone-100)] hover:bg-[var(--bone-12)] transition-all shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* SCROLLABLE BODY */}
        <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-5 scrollbar-none max-h-[75vh]">
          
          {/* 1. Description Box */}
          <div className="bg-[var(--bone-2)] border border-[var(--bone-6)] rounded-[12px] p-4 min-h-[100px] transition-colors focus-within:border-[var(--bone-20)]">
            <textarea
              placeholder="Write description or notes..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full bg-transparent text-[var(--bone-80)] placeholder-[var(--bone-20)] border-none outline-none resize-none text-base leading-relaxed h-full"
            />
          </div>

          {/* 2. Subtasks Widget */}
          <div className="space-y-4">
            <div className="flex items-center gap-2.5 text-[10.5px] font-bold text-[var(--bone-40)] uppercase tracking-wider">
              <CheckSquare className="w-4 h-4 opacity-40" />
              Subtasks
            </div>
            
            {/* Subtask List */}
            {subtasks.map(sub => (
              <div key={sub.id} className="flex items-center gap-3 group">
                <button 
                  onClick={() => toggleSubtask(sub.id)}
                  className="shrink-0"
                >
                  {sub.completed ? (
                    <div className="w-4 h-4 rounded-full bg-[var(--accent)] flex items-center justify-center">
                      <div className="w-1.5 h-1.5 bg-white rounded-full" />
                    </div>
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-[var(--bone-30)] group-hover:border-[var(--bone-70)] transition-colors" />
                  )}
                </button>
                <span className={cn(
                  "text-sm flex-1",
                  sub.completed ? "text-[var(--bone-40)] line-through" : "text-[var(--bone-90)]"
                )}>
                  {sub.text}
                </span>
                <button 
                  onClick={() => removeSubtask(sub.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-[var(--bone-30)] hover:text-red-400 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}

            {/* Add Subtask Inline Composer */}
            <div className="flex gap-2">
              <div className="flex-1 bg-[var(--bone-5)] border border-[var(--bone-6)] rounded-[12px] px-4 py-3 focus-within:border-[var(--bone-20)] transition-colors">
                <input
                  type="text"
                  placeholder="Add new subtask..."
                  value={newSubtaskText}
                  onChange={e => setNewSubtaskText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddSubtask()}
                  className="w-full bg-transparent text-sm text-[var(--bone-90)] placeholder-[var(--bone-30)] outline-none"
                />
              </div>
              <button
                onClick={handleAddSubtask}
                className="w-12 h-12 flex items-center justify-center bg-[var(--bone-5)] border border-[var(--bone-6)] rounded-[12px] text-[var(--bone-70)] hover:text-[var(--bone-100)] hover:bg-[var(--bone-10)] transition-all"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* 3. Side-by-side row 1: Due Date & Priority */}
          <div className="grid grid-cols-2 gap-6">
            {/* Due Date Column */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-2.5 text-[10.5px] font-bold text-[var(--bone-40)] uppercase tracking-wider">
                <Calendar className="w-4 h-4 opacity-40" />
                Due Date
              </div>
              <DatePickerTime 
                date={dueDate ? new Date(dueDate) : undefined} 
                setDate={(d) => setDueDate(d ? d.toISOString().split('T')[0] : '')}
                time={dueTime}
                setTime={setDueTime}
                hideLabels
                hideTime
              />
            </div>

            {/* Priority Column */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-2.5 text-[10.5px] font-bold text-[var(--bone-40)] uppercase tracking-wider">
                <AlertCircle className="w-4 h-4 opacity-40" />
                Priority
              </div>
              <div className="flex gap-2">
                {(['low', 'medium', 'high'] as const).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => togglePriority(p)}
                    className={cn(
                      "flex-1 py-3 rounded-[12px] text-[10px] font-bold uppercase border transition-all",
                      priority === p 
                        ? "bg-[var(--bone-10)] border-[var(--bone-25)] text-[var(--bone-100)] shadow-sm" 
                        : "bg-[var(--bone-2)] border border-[var(--bone-6)] text-[var(--bone-40)] hover:bg-[var(--bone-5)]"
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 4. Side-by-side row 2: Workspace & Colors */}
          <div className="grid grid-cols-2 gap-6">
            {/* Workspace Column */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-2.5 text-[10.5px] font-bold text-[var(--bone-40)] uppercase tracking-wider">
                <Folder className="w-4 h-4 opacity-40" />
                Workspace
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <button className="w-full flex items-center justify-between bg-[var(--bone-2)] border border-[var(--bone-6)] rounded-[12px] px-4 py-3 text-sm text-[var(--bone-90)] hover:bg-[var(--bone-5)] transition-colors">
                    <span className="truncate">
                      {workspaceId ? workspaces.find(w => w.id === workspaceId)?.title || "Assigned" : "Unsorted"}
                    </span>
                    <Plus className="w-3.5 h-3.5 opacity-30 rotate-45" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-[240px] p-1.5 bg-panel border border-[var(--bone-6)] shadow-2xl rounded-[12px] backdrop-blur-3xl" align="start">
                  <button
                    onClick={() => setWorkspaceId(null)}
                    className={cn(
                      "w-full px-3 py-2 text-left text-sm rounded-[8px] transition-colors",
                      !workspaceId ? "bg-[var(--bone-10)] text-[var(--bone-100)] font-medium" : "text-[var(--bone-70)] hover:bg-[var(--bone-5)]"
                    )}
                  >
                    Unsorted
                  </button>
                  {workspaces.map(w => (
                    <button
                      key={w.id}
                      onClick={() => setWorkspaceId(w.id)}
                      className={cn(
                        "w-full px-3 py-2 text-left text-sm rounded-[8px] transition-colors mt-0.5",
                        workspaceId === w.id ? "bg-[var(--bone-10)] text-[var(--bone-100)] font-medium" : "text-[var(--bone-70)] hover:bg-[var(--bone-5)]"
                      )}
                    >
                      {w.title}
                    </button>
                  ))}
                </PopoverContent>
              </Popover>
            </div>

            {/* Category Color Column */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-2.5 text-[10.5px] font-bold text-[var(--bone-40)] uppercase tracking-wider">
                <div className="w-3 h-3 rounded-full bg-[var(--bone-40)] opacity-60" />
                Category Color
              </div>
              <div className="flex items-center gap-3.5 h-[46px]">
                {COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={cn(
                      "w-6 h-6 rounded-full transition-all duration-300 flex items-center justify-center relative",
                      color === c ? "scale-110" : "opacity-30 hover:opacity-100"
                    )}
                    style={{ backgroundColor: c }}
                  >
                    {color === c && (
                      <div className="absolute -inset-1.5 rounded-full border-2 border-[var(--bone-70)]" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

        </div>

        {/* STATIC FOOTER BAR */}
        <div className="shrink-0 px-7 py-6 flex items-center justify-between mt-auto">
          {isEditing ? (
            <button
              onClick={handleDelete}
              className="flex items-center gap-2.5 text-red-500/70 text-sm font-medium hover:text-red-500 transition-colors"
            >
              <Trash2 className="w-5 h-5 opacity-80" />
              Delete Task
            </button>
          ) : (
            <div /> 
          )}

          <button
            onClick={handleSaveAndClose}
            disabled={!title.trim()}
            className="text-[var(--bone-90)] hover:text-[var(--bone-100)] text-xl font-semibold tracking-tight transition-all disabled:opacity-20"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
}
