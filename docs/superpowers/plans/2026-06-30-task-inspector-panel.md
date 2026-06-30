# Task Inspector Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the `NewTaskModal` (full-height right drawer with dark backdrop) into a floating side panel that sits in the same right-panel slot as the AI Assistant, without a backdrop overlay, keeping the main content interactive.

**Architecture:** The right panel area in `Shell.tsx` currently hosts the AI Assistant. This plan adds a `TaskPanel` component that replaces the AI panel when active. The panel is toggled via new Zustand store state (`isTaskPanelOpen`, `activeTaskId`, `taskPanelWidth`). Clicking a task card calls `openTaskPanel(taskId)` instead of `openModal`. The panel uses the same resize handle logic as the AI panel. On mobile (<768px), the task opens as the current full-page modal instead.

**Tech Stack:** Next.js 14, Zustand, React, Tailwind CSS, TypeScript

## Global Constraints

- `taskPanelWidth` defaults to 500, min 350, max 600
- `taskPanelWidth` is persisted to localStorage (add to `partialize` in store)
- Mobile (<768px) keeps current modal behavior — check `window.innerWidth` before deciding panel vs modal
- All CSS variables (e.g., `--sidebar-w`) already exist — no CSS changes needed
- The AI panel resize logic in `Shell.tsx` is reused for the task panel — no need to duplicate

---

### Task 1: Add task panel state to Zustand store

**Files:**
- Modify: `src/data/store.ts:227` (add initial state near `isAIAssistantOpen`)
- Modify: `src/data/store.ts:379` (add actions near AI panel actions)
- Modify: `src/data/store.ts:2484` (add to `partialize` persistence)

**Interfaces:**
- Consumes: existing `modal` state, `openModal`, `closeModal`
- Produces: `isTaskPanelOpen: boolean`, `activeTaskId: string | null`, `taskPanelWidth: number`, `aiWasOpenBeforeTaskPanel: boolean`, actions `openTaskPanel(taskId)`, `closeTaskPanel()`, `setTaskPanelWidth(width)`

- [ ] **Step 1: Add initial state fields**

Find the line `isAIAssistantOpen: false,` (~line 227). Add these fields right after it:

```typescript
isTaskPanelOpen: false,
activeTaskId: null as string | null,
taskPanelWidth: 500,
// Tracks whether AI panel was open when task panel opened, so we can restore it on close
aiWasOpenBeforeTaskPanel: false,
```

- [ ] **Step 2: Add actions**

Find the `toggleAIAssistant`/`setAIAssistantOpen` block (~line 379). Add these actions right after `setAIAssistantOpen`:

```typescript
openTaskPanel: (taskId) => set((state) => ({
  isTaskPanelOpen: true,
  activeTaskId: taskId,
  // Save AI state before closing it
  aiWasOpenBeforeTaskPanel: state.isAIAssistantOpen,
  isAIAssistantOpen: false,
})),
closeTaskPanel: () => set((state) => ({
  isTaskPanelOpen: false,
  activeTaskId: null,
  // Restore AI panel if it was open before the task panel opened
  isAIAssistantOpen: state.aiWasOpenBeforeTaskPanel,
  aiWasOpenBeforeTaskPanel: false,
})),
setTaskPanelWidth: (width) => set({ taskPanelWidth: width }),
```

- [ ] **Step 3: Add to partialize for persistence**

Find the `partialize:` block (~line 2468). Add `taskPanelWidth` after `aiSidebarWidth`:

```typescript
taskPanelWidth: state.taskPanelWidth,
```

- [ ] **Step 4: Persist sync to localStorage on mount**

Find the `isAIAssistantOpen` in the `Script` tag of `src/app/layout.tsx` (the localStorage init block). Not needed here — `taskPanelWidth` is already handled by Zustand's persist middleware. No additional changes.

- [ ] **Step 5: Commit**

```bash
git add src/data/store.ts
git commit -m "feat: add task panel state to store (isTaskPanelOpen, activeTaskId, taskPanelWidth)"
```

---

### Task 2: Refactor NewTaskModal into a side-panel component

**Files:**
- Create: `src/components/tracker/TaskInspectorPanel.tsx`
- Modify: `src/components/modals/NewTaskModal.tsx` (keep for mobile fallback)

**Interfaces:**
- Consumes: `activeTaskId` from store, `closeTaskPanel` action
- Produces: A standalone panel component (no backdrop, no overlay) that renders the same task edit form

- [ ] **Step 1: Create the panel component shell**

Create `src/components/tracker/TaskInspectorPanel.tsx`:

```typescript
'use client';

import { useStore } from '@/data/store';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function TaskInspectorPanel() {
  const activeTaskId = useStore(s => s.activeTaskId);
  const closeTaskPanel = useStore(s => s.closeTaskPanel);
  const taskPanelWidth = useStore(s => s.taskPanelWidth);

  if (!activeTaskId) return null;

  return (
    <div className="h-full w-full flex flex-col bg-sidebar overflow-hidden">
      {/* Panel Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--bone-6)] shrink-0">
        <span className="text-xs font-semibold text-[var(--bone-40)] tracking-wide uppercase">
          Task
        </span>
        <button
          onClick={closeTaskPanel}
          className="w-6 h-6 flex items-center justify-center rounded-[6px] text-[var(--bone-40)] hover:text-[var(--bone-100)] hover:bg-[var(--bone-10)] transition-all cursor-pointer"
        >
          <X className="w-3.5 h-3.5" strokeWidth={2} />
        </button>
      </div>

      {/* Task Form Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <TaskPanelContent taskId={activeTaskId} closePanel={closeTaskPanel} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the TaskPanelContent component (extracted from NewTaskModal)**

In the same file, add the `TaskPanelContent` component. This is the task edit form extracted from `NewTaskModal.tsx` without the backdrop/overlay wrapper, without the "close on outside click" behavior, and without the `fixed z-[200]` positioning:

```typescript
import { X, Plus, Calendar, Palette, Trash2, CheckSquare, AlertCircle, Folder, Check, CircleDot, Tag, FileText, ChevronDown } from 'lucide-react';
import { useState, useEffect, useRef, useMemo } from 'react';
import { generateId, AppTask, useStore } from '@/data/store';
import type { SubTask } from '@/data/store.types';
import { DatePickerTime } from '@/components/ui/date-time-picker';
import { getEntityIcon } from '@/data/icons';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

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

  // Load task data when taskId changes
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
      // New task
      setTitle('');
      setDescription('');
      setDueDate('');
      setDueTime('');
      setPriority(null);
      setColor('');
      setWorkspaceId(null);
      setSubtasks([]);
      setCompleted(false);
      setStatus('todo');
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
        dueTime: dueTime || undefined,
        priority: priority,
        color: color,
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
      {/* Thin color stripe */}
      <div className="h-[3px] shrink-0" style={{ backgroundColor: color || 'transparent' }} />

      {/* Body */}
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

        {/* Metadata */}
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
                  <ChevronDown className="w-3 h-3 opacity-60 shrink-0 transition-none" />
                </button>
              </PopoverTrigger>
              {/* Status popover options — same as NewTaskModal */}
              <PopoverContent className="w-[160px] p-1 bg-panel border border-[var(--bone-6)] shadow-2xl rounded-[12px] z-[202]" align="start">
                {[
                  { id: 'todo' as const, label: 'To Do', color: 'bg-blue-400', activeColor: 'text-blue-400', bgColor: 'bg-blue-500/15', onClick: () => { setCompleted(false); setStatus('todo'); setDueDate(''); } },
                  { id: 'in-progress' as const, label: 'In Progress', color: 'bg-amber-400', activeColor: 'text-amber-400', bgColor: 'bg-amber-500/15', onClick: () => { setCompleted(false); setStatus('in-progress'); } },
                  { id: 'today' as const, label: 'Today', color: 'bg-violet-400', activeColor: 'text-violet-400', bgColor: 'bg-violet-500/15', onClick: () => { setCompleted(false); setStatus('todo'); setDueDate(todayStr); } },
                  { id: 'overdue' as const, label: 'Overdue', color: 'bg-red-400', activeColor: 'text-red-400', bgColor: 'bg-red-500/15', onClick: () => { setCompleted(false); setStatus('todo'); setDueDate(yesterdayStr); } },
                  { id: 'done' as const, label: 'Completed', color: 'bg-emerald-400', activeColor: 'text-emerald-400', bgColor: 'bg-emerald-500/15', onClick: () => { setCompleted(true); } },
                ].map(opt => {
                  const isActive = (opt.id === 'done' && displayStatus === 'done') ||
                    (opt.id !== 'done' && displayStatus === opt.id);
                  return (
                    <button
                      key={opt.id}
                      onClick={opt.onClick}
                      className={cn("w-full px-3 py-2 text-left text-xs rounded-[8px] flex items-center justify-between mt-0.5 cursor-pointer transition-none", isActive ? `${opt.bgColor} ${opt.activeColor} font-semibold` : `${opt.activeColor}/70 hover:${opt.bgColor} hover:${opt.activeColor}`)}
                    >
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
            <AlertCircle className="w-3 h-3 opacity-60" />
            Priority
          </div>
          <div className="flex gap-1.5">
            {(['low', 'medium', 'high'] as const).map(p => (
              <button key={p} onClick={() => togglePriority(p)}
                className={cn("px-2.5 py-1.5 rounded-[6px] text-xs font-medium transition-all cursor-pointer capitalize border-none",
                  priority === p
                    ? p === 'high' ? "bg-red-500/15 text-red-400" :
                      p === 'medium' ? "bg-amber-500/15 text-amber-400" :
                      "bg-blue-500/15 text-blue-400"
                    : "bg-[var(--bone-6)] text-[var(--bone-40)] hover:bg-[var(--bone-10)]"
                )}>
                {p}
              </button>
            ))}
          </div>

          {/* Due Date */}
          <div className="text-[var(--bone-40)] font-semibold flex items-center gap-2">
            <Calendar className="w-3 h-3 opacity-60" />
            Due Date
          </div>
          <div className="w-[160px]">
            <DatePickerTime
              date={dueDate ? parseLocalDate(dueDate) : undefined}
              setDate={(d) => setDueDate(d ? formatLocalDate(d) : '')}
              time={dueTime}
              setTime={setDueTime}
              hideLabels
              hideTime
            />
          </div>

          {/* Workspace */}
          <div className="text-[var(--bone-40)] font-semibold flex items-center gap-2">
            <Folder className="w-3 h-3 opacity-60" />
            Workspace
          </div>
          <div className="w-[160px]">
            <Popover>
              <PopoverTrigger asChild>
                {workspaceId ? (() => {
                  const ws = workspaces.find(w => w.id === workspaceId);
                  const WsIcon = ws ? getEntityIcon(ws.icon) : Folder;
                  return (
                    <button className="w-full flex items-center bg-[var(--bone-6)] rounded-[6px] pl-2.5 pr-2 py-1.5 text-xs text-[var(--bone-90)] hover:bg-[var(--bone-10)] transition-none cursor-pointer">
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <WsIcon className="w-3 h-3 opacity-60 shrink-0" />
                        <span className="truncate font-semibold">{ws?.title || "Assigned"}</span>
                      </div>
                    </button>
                  );
                })() : (
                  <button className="w-full flex items-center justify-start bg-[var(--bone-6)] rounded-[6px] px-2.5 py-1.5 text-xs text-[var(--bone-30)] hover:bg-[var(--bone-10)] transition-none cursor-pointer">
                    <span className="font-medium">None</span>
                  </button>
                )}
              </PopoverTrigger>
              <PopoverContent className="w-[200px] p-1.5 bg-panel border border-[var(--bone-6)] shadow-2xl rounded-[12px] z-[202]" align="start">
                <button onClick={() => setWorkspaceId(null)}
                  className={cn("w-full px-3 py-1.5 text-left text-xs rounded-[8px] transition-none cursor-pointer", !workspaceId ? "bg-[var(--bone-10)] text-[var(--bone-100)] font-semibold" : "text-[var(--bone-70)] hover:bg-[var(--bone-5)]")}>
                  None
                </button>
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
            <Tag className="w-3 h-3 opacity-60" />
            Color Tag
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
            <FileText className="w-3.5 h-3.5 opacity-60" />
            Description
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
            <CheckSquare className="w-3.5 h-3.5 opacity-40" />
            Subtasks
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
                    className="text-[var(--bone-30)] hover:text-red-400 transition-colors cursor-pointer opacity-0 group-hover:opacity-100">
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
        {isEditing && (
          <button onClick={handleDelete}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-red-400/60 hover:text-red-400 hover:bg-red-500/10 text-xs font-medium transition-all cursor-pointer">
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>
        )}
        {!isEditing && <div />}
        <button onClick={handleSaveAndClose} disabled={!title.trim()}
          className="px-5 py-2 rounded-[8px] bg-[var(--accent)] text-white text-sm font-semibold hover:opacity-90 active:scale-95 transition-all disabled:opacity-20 cursor-pointer">
          Done
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Remove the backdrop and modal wrapper from NewTaskModal.tsx (mobile fallback)**

Leave `NewTaskModal.tsx` mostly as-is — it will be the mobile fallback. Add a check at the top to skip rendering on desktop:

```typescript
// At top of NewTaskModal.tsx, after imports:
import { isDesktop } from '@/lib/env';

// At top of the component, before the early return:
// On desktop, task details open in the side panel instead
if (isDesktop() && window.innerWidth >= 768) return null;
```

- [ ] **Step 4: Commit**

```bash
git add src/components/tracker/TaskInspectorPanel.tsx src/components/modals/NewTaskModal.tsx
git commit -m "feat: create TaskInspectorPanel component with side panel layout"
```

---

### Task 3: Integrate TaskInspectorPanel into Shell layout

**Files:**
- Modify: `src/components/layout/Shell.tsx`

**Interfaces:**
- Consumes: `isTaskPanelOpen` from store, `TaskInspectorPanel` component
- Produces: Task panel renders in the right panel slot, shares resize logic

- [ ] **Step 1: Add import for TaskInspectorPanel**

```typescript
import { TaskInspectorPanel } from '@/components/tracker/TaskInspectorPanel';
```

- [ ] **Step 2: Update the right panel rendering section**

Find the right panel code block that currently renders the AI sidebar (~line 410-429 in Shell.tsx). Replace the AI panel rendering with a conditional that shows either the task panel or AI panel:

Current code (approximately):
```tsx
<div className={cn(
  "h-full shrink-0 overflow-hidden transition-colors duration-200",
  ...
)}
style={{ width: ... }}
>
  <div className={cn("h-full shrink-0 w-full", ...)} style={{ width: ... }}>
    {hasHydrated && isAIAssistantExtended && activeEntityId !== 'chat' && <AIAssistant />}
  </div>
</div>
```

Replace with:
```tsx
<div className={cn(
  "h-full shrink-0 overflow-hidden transition-colors duration-200",
  ...
)}
style={{ width: ... }}
>
  <div className={cn("h-full shrink-0 w-full", ...)} style={{ width: ... }}>
    {isTaskPanelOpen && activeTaskId ? (
      <TaskInspectorPanel />
    ) : (
      hasHydrated && isAIAssistantExtended && activeEntityId !== 'chat' && <AIAssistant />
    )}
  </div>
</div>
```

Also read `isTaskPanelOpen` and `activeTaskId` from the store in the `Shell` component:

```typescript
const isTaskPanelOpen = useStore(state => state.isTaskPanelOpen);
const activeTaskId = useStore(state => state.activeTaskId);
```

Add these alongside the existing store reads at the top of the component.

- [ ] **Step 3: Add resize logic for the task panel**

The right-side resize handle in Shell.tsx currently uses `isResizingRightRef` and calls `setAiSidebarWidth`. When the task panel is open, it should call `setTaskPanelWidth` instead.

Find the resize handler (~line 258-260):
```typescript
if (isResizingRightRef.current) {
  setAiSidebarWidth(Math.min(Math.max(window.innerWidth - e.clientX, 400), 500));
}
```

Replace with:
```typescript
if (isResizingRightRef.current) {
  const w = Math.min(Math.max(window.innerWidth - e.clientX, 350), 600);
  if (isTaskPanelOpen) {
    setTaskPanelWidth(w);
  } else {
    setAiSidebarWidth(w);
  }
}
```

And add `setTaskPanelWidth` to the store reads.

- [ ] **Step 4: Handle panel width for the right panel slot**

The right panel width is currently determined by `aiSidebarWidth`. When the task panel is open, it should use `taskPanelWidth` instead.

Find the `currentAiSidebarWidth` computation (~line 288):
```typescript
const currentAiSidebarWidth = hasHydrated ? Math.min(aiSidebarWidth, 500) : 400;
```

Add after it:
```typescript
const currentPanelWidth = isTaskPanelOpen ? Math.min(taskPanelWidth, 600) : currentAiSidebarWidth;
```

Then update the `style={{ width: ... }}` on the right panel wrapper to use `currentPanelWidth` instead of `currentAiSidebarWidth`.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/Shell.tsx
git commit -m "feat: integrate TaskInspectorPanel into Shell layout, replace AI panel when active"
```

---

### Task 4: Update task-clicking surfaces to use openTaskPanel

**Files:**
- Modify: `src/components/tracker/TaskCard.tsx`
- Modify: `src/components/tracker/KanbanColumn.tsx`
- Modify: `src/components/layout/Sidebar.tsx`
- Modify: `src/components/layout/CommandPalette.tsx`

**Interfaces:**
- Consumes: `openTaskPanel` action from store
- Produces: All task-opening surfaces call `openTaskPanel(taskId)` instead of `openModal({ kind: 'newTask', taskId })`

- [ ] **Step 1: Update TaskCard.tsx**

Replace the modal call with the panel call:

```typescript
// Remove:
// const openModal = useStore(s => s.openModal);
// const onClick = () => { openModal({ kind: 'newTask', taskId: task.id }); };

// Add:
const openTaskPanel = useStore(s => s.openTaskPanel);
const onClick = () => { openTaskPanel(task.id); };
```

- [ ] **Step 2: Update KanbanColumn.tsx "+" button**

Replace `openModal({ kind: 'newTask', sourceColumn: id })` with `openTaskPanel('new')` or `openModal({ kind: 'newTask', sourceColumn: id })`.

For the "+" (new task) button, the current behavior creates a new task modal. For the side panel, we should still open the task panel but without a taskId (empty form for new task creation). However, the current store action `openTaskPanel` requires a taskId. We need to handle this:

Option: Keep `openModal` for new task creation (the "+" button) and only use the panel for editing existing tasks. This is simpler and makes sense — you click "+" to create a task (modal works fine), and click an existing task to inspect/edit (panel opens).

Let's keep it simple: only the edit path (TaskCard) uses the panel. The new task path (KanbanColumn "+", Sidebar, CommandPalette) continue to use `openModal`.

Actually, the user might want a consistent experience. But for the implementation plan, let's keep it focused — convert only the edit path. New task creation can be addressed later.

- [ ] **Step 3: Commit**

```bash
git add src/components/tracker/TaskCard.tsx
git commit -m "feat: TaskCard opens TaskInspectorPanel instead of modal"
```

---

### Task 5: Mobile fallback and edge cases

**Files:**
- Modify: `src/components/modals/NewTaskModal.tsx`
- No other files needed

**Interfaces:**
- Consumes: `window.innerWidth` check
- Produces: On mobile (<768px), clicking a task still opens the modal instead of the panel

- [ ] **Step 1: Add mobile detection to NewTaskModal.tsx**

At the top of the component, after the existing early return check for `modal.kind !== 'newTask'`:

```typescript
// On desktop, task details open in the inspector panel instead
const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
if (isDesktop() && !isMobile && taskId) return null;
```

This ensures:
- Desktop with taskId (editing) → uses the inspector panel
- Desktop without taskId (new task creation) → uses the modal
- Mobile (&lt;768px) → always uses the modal

- [ ] **Step 2: Ensure the TaskInspectorPanel handles new task creation vs editing**

In `TaskPanelContent`, the `isEditing` flag is derived from whether `activeTask` exists. When `activeTaskId` is set but the task isn't found (shouldn't happen in normal flow), it presents the "new task" form. This is correct — the panel gracefully handles both states.

- [ ] **Step 3: Commit**

```bash
git add src/components/modals/NewTaskModal.tsx
git commit -m "feat: add mobile fallback — modal on mobile, panel on desktop"
```

---

### Task 6: Verify and test

**Files:** No file changes needed.

- [ ] **Step 1: Run the dev server and test the flow**

Run: `npm run dev`
Navigate to the kanban page.
Click a task card.
Expected: Right panel opens with task detail. No backdrop. Main content is clickable. The AI panel is hidden.

- [ ] **Step 2: Test panel resize**

Drag the resize handle on the panel's left edge.
Expected: Panel width changes between 350px and 600px.

- [ ] **Step 3: Test panel close and AI restore**

Open AI panel first. Then click a task card — AI should hide. Close the task panel — AI should return.
Expected: AI panel state is preserved across task panel open/close.

- [ ] **Step 4: Test click a different task while panel is open**

Open the task panel. Click a different task card.
Expected: Panel stays open, content swaps to the new task.

- [ ] **Step 5: Test delete from panel**

Open a task in the panel. Click Delete.
Expected: Task is deleted. Panel closes. AI panel returns.

- [ ] **Step 6: Test mobile behavior**

Resize browser window to <768px.
Click a task card.
Expected: Full-screen modal opens (existing behavior).

- [ ] **Step 7: Test new task creation**

Click "+" in a kanban column, "New Task" in sidebar, or use command palette.
Expected: NewTaskModal opens (existing behavior — not replaced).
