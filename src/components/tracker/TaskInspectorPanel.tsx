'use client';

import { useStore, generateId, TaskAttachment, AppTask } from '@/data/store';
import type { SubTask } from '@/data/store.types';
import { X, Plus, Trash2, CheckSquare, Flag, Folder, Check, Loader, Tag, FileText, ChevronDown, Calendar, Paperclip, File, FileAudio, FileImage, FileVideo, Loader2, CircleDashed, SquarePen, Copy, ExternalLink } from 'lucide-react';
import { useState, useEffect, useMemo, useRef } from 'react';
import { cn } from '@/lib/utils';
import { NotionDateTimePicker } from '@/components/ui/notion-datetime-picker';
import { isTaskOverdue } from '@/lib/task-overdue';
import { getEntityIcon } from '@/data/icons';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tooltip } from '@/components/layout/Tooltip';
import { isDesktop } from '@/lib/env';

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
  '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#F97316', '#06B6D4',
];

function SubtaskTextEditor({ sub, onEdit }: { sub: { id: string; text: string; completed: boolean }; onEdit: (id: string, text: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(sub.text);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    const lineHeight = 20;
    el.style.height = Math.min(el.scrollHeight, lineHeight * 4) + 'px';
  };

  useEffect(() => {
    if (editing && textareaRef.current) {
      const el = textareaRef.current;
      el.focus();
      const len = el.value.length;
      el.setSelectionRange(len, len);
      autoResize(el);
    }
  }, [editing]);

  const commit = () => {
    const trimmed = value.trim();
    if (trimmed) onEdit(sub.id, trimmed);
    else setValue(sub.text);
    setEditing(false);
  };

  const baseClass = cn(
    "text-sm flex-1 min-w-0 bg-transparent outline-none border-none p-0 m-0 resize-none overflow-hidden leading-[1.4] block w-full",
    sub.completed ? "text-[var(--bone-40)] line-through" : "text-[var(--bone-90)]"
  );

  if (editing) {
    return (
      <textarea
        ref={textareaRef}
        value={value}
        rows={1}
        onChange={e => { setValue(e.target.value); autoResize(e.target); }}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit(); }
          if (e.key === 'Escape') { setValue(sub.text); setEditing(false); }
        }}
        className={baseClass}
        style={{ lineHeight: '1.4' }}
      />
    );
  }

  return (
    <span
      onDoubleClick={() => { setValue(sub.text); setEditing(true); }}
      className={cn("text-sm flex-1 min-w-0 cursor-text break-words", sub.completed ? "text-[var(--bone-40)] line-through" : "text-[var(--bone-90)]")}
    >
      {sub.text}
    </span>
  );
}

function TaskPanelContent({ taskId, closePanel, isActive, setSyncState }: { taskId: string; closePanel: () => void; isActive: boolean; setSyncState: (s: 'idle' | 'saving' | 'saved' | 'error') => void }) {
  const tasks = useStore(s => s.tasks);
  const entities = useStore(s => s.entities);
  const addTask = useStore(s => s.addTask);
  const updateTask = useStore(s => s.updateTask);
  const deleteTask = useStore(s => s.deleteTask);
  const openModal = useStore(s => s.openModal);
  const taskPanelPresets = useStore(s => s.taskPanelPresets);

  const activeTask = useMemo(() => tasks.find(t => t.id === taskId), [taskId, tasks]);
  const isEditing = !!activeTask;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState<string | undefined>(undefined);
  const [endDate, setEndDate] = useState<string | undefined>(undefined);
  const [includeTime, setIncludeTime] = useState(false);
  const [reminder, setReminder] = useState<string | undefined>(undefined);
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | null>(null);
  const [color, setColor] = useState('');
  const [entityId, setEntityId] = useState<string | null>(null);
  const [subtasks, setSubtasks] = useState<SubTask[]>([]);
  const [completed, setCompleted] = useState(false);
  const [status, setStatus] = useState<'todo' | 'in-progress' | 'done'>('todo');
  const [newSubtaskText, setNewSubtaskText] = useState('');
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [tag, setTag] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false);

  const allTags = useMemo(() => {
    return Array.from(new Set(
      tasks
        .filter(t => t.tag && t.tag.trim() && t.tag.toLowerCase() !== 'none')
        .map(t => t.tag!.trim())
    ));
  }, [tasks]);

  const filteredTags = useMemo(() => {
    const query = tag.trim().toLowerCase();
    if (!query) return allTags;
    return allTags.filter(t => t.toLowerCase().includes(query));
  }, [tag, allTags]);

  const [isDragActive, setIsDragActive] = useState(false);
  const dragCounterRef = useRef(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const yesterdayStr = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  }, []);

  const lastActiveTaskRef = useRef<any>(null);
  const prevTaskIdRef = useRef<string | null>(null);

  // Auto-focus title input when a new task is created
  useEffect(() => {
    if (!activeTask) {
      const timer = setTimeout(() => {
        titleInputRef.current?.focus();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [taskId, activeTask]);

  // Synchronously update states during render if the active task changes or we switch tasks
  if (taskId !== prevTaskIdRef.current) {
    prevTaskIdRef.current = taskId;
    lastActiveTaskRef.current = activeTask;
    
    if (activeTask) {
      setTitle(activeTask.title || '');
      setDescription(activeTask.description || activeTask.note || '');
      setDueDate(activeTask.dueDate);
      setEndDate(activeTask.endDate);
      setIncludeTime(activeTask.includeTime || false);
      setReminder(activeTask.reminder);
      setPriority(activeTask.priority || null);
      setColor(activeTask.color || '');
      setEntityId(activeTask.entityId || null);
      setSubtasks(activeTask.subtasks || []);
      setCompleted(activeTask.completed || false);
      setStatus(activeTask.status || 'todo');
      setAttachments(activeTask.attachments || []);
      setTag(activeTask.tag || '');
    } else {
      setTitle('');
      setDescription('');
      setDueDate(taskPanelPresets?.dueDate);
      setEndDate(taskPanelPresets?.endDate);
      setIncludeTime(taskPanelPresets?.includeTime || false);
      setReminder(taskPanelPresets?.reminder);
      setPriority(taskPanelPresets?.priority || null);
      setColor(taskPanelPresets?.color || '');
      setEntityId(taskPanelPresets?.entityId || null);
      setSubtasks(taskPanelPresets?.subtasks || []);
      setCompleted(taskPanelPresets?.completed || false);
      setStatus(taskPanelPresets?.status || 'todo');
      setAttachments([]);
      setTag(taskPanelPresets?.tag || '');
    }
  } else if (activeTask && activeTask !== lastActiveTaskRef.current) {
    lastActiveTaskRef.current = activeTask;
    
    if (activeTask.title !== title) setTitle(activeTask.title || '');
    const desc = activeTask.description || activeTask.note || '';
    if (desc !== description) setDescription(desc);
    if (activeTask.dueDate !== dueDate) setDueDate(activeTask.dueDate);
    if (activeTask.endDate !== endDate) setEndDate(activeTask.endDate);
    if ((activeTask.includeTime || false) !== includeTime) setIncludeTime(activeTask.includeTime || false);
    if (activeTask.reminder !== reminder) setReminder(activeTask.reminder);
    if (activeTask.priority !== priority) setPriority(activeTask.priority || null);
    if ((activeTask.color || '') !== color) setColor(activeTask.color || '');
    if ((activeTask.entityId || null) !== entityId) setEntityId(activeTask.entityId || null);
    if (JSON.stringify(activeTask.subtasks || []) !== JSON.stringify(subtasks)) setSubtasks(activeTask.subtasks || []);
    if ((activeTask.completed || false) !== completed) setCompleted(activeTask.completed || false);
    if ((activeTask.status || 'todo') !== status) setStatus(activeTask.status || 'todo');
    if (JSON.stringify(activeTask.attachments || []) !== JSON.stringify(attachments)) setAttachments(activeTask.attachments || []);
    if ((activeTask.tag || '') !== tag) setTag(activeTask.tag || '');
  } else if (!activeTask && lastActiveTaskRef.current !== null) {
    lastActiveTaskRef.current = null;
    setTitle('');
    setDescription('');
    setDueDate(taskPanelPresets?.dueDate);
    setEndDate(taskPanelPresets?.endDate);
    setIncludeTime(taskPanelPresets?.includeTime || false);
    setReminder(taskPanelPresets?.reminder);
    setPriority(taskPanelPresets?.priority || null);
    setColor(taskPanelPresets?.color || '');
    setEntityId(taskPanelPresets?.entityId || null);
    setSubtasks(taskPanelPresets?.subtasks || []);
    setCompleted(taskPanelPresets?.completed || false);
    setStatus(taskPanelPresets?.status || 'todo');
    setAttachments([]);
    setTag(taskPanelPresets?.tag || '');
  }

  // Automatically update status and completed when dueDate changes to todayStr
  const prevDueDateRef = useRef<string | undefined>(dueDate);
  useEffect(() => {
    if (dueDate !== prevDueDateRef.current) {
      if (dueDate === todayStr) {
        setCompleted(false);
        setStatus('todo');
      }
      prevDueDateRef.current = dueDate;
    }
  }, [dueDate, todayStr]);

  const displayStatus = useMemo<'todo' | 'in-progress' | 'done' | 'today' | 'overdue'>(() => {
    if (completed) return 'done';
    if (status === 'in-progress') return 'in-progress';
    if (dueDate && dueDate < todayStr) return 'overdue';
    if (dueDate === todayStr) return 'today';
    return 'todo';
  }, [completed, status, dueDate, todayStr]);

  const spaces = useMemo(() => {
    return entities.filter(e => e.type === 'workspace');
  }, [entities]);

  const processFiles = async (files: FileList | File[]) => {
    setIsUploading(true);
    for (const file of Array.from(files)) {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const base64Url = ev.target?.result as string;
        let type: 'image' | 'audio' | 'video' | 'file' | 'pdf' = 'file';
        if (file.type.startsWith('image/')) type = 'image';
        if (file.type.startsWith('audio/')) type = 'audio';
        if (file.type.startsWith('video/')) type = 'video';
        if (file.type === 'application/pdf' || file.type === 'application/x-pdf' || file.name.toLowerCase().endsWith('.pdf')) type = 'pdf';

        const tempId = Math.random().toString(36).slice(2);
        
        let name = file.name;
        if (name === 'image.png') {
          name = `pasted-image-${Date.now()}.png`;
        }

        // Add a temporary uploading object
        setAttachments(prev => [...prev, { type, url: base64Url, name, uploading: true, tempId }]);

        try {
          const res = await fetch('/api/ai/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, type, dataUrl: base64Url }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.url) {
              setAttachments(prev => prev.map(att =>
                att.tempId === tempId
                  ? { type, url: data.url, name }
                  : att
              ));
            }
          } else {
            const errText = await res.text();
            console.error('Failed to upload attachment:', res.status, errText);
            setAttachments(prev => prev.filter(att => att.tempId !== tempId));
          }
        } catch (err) {
          console.error('Attachment upload error:', err);
          setAttachments(prev => prev.filter(att => att.tempId !== tempId));
        }
      };
      reader.readAsDataURL(file);
    }
    setIsUploading(false);
  };

  const processFilesRef = useRef(processFiles);
  useEffect(() => {
    processFilesRef.current = processFiles;
  }, [processFiles]);

  useEffect(() => {
    if (!isActive || taskId === '__placeholder__') {
      setIsDragActive(false);
      dragCounterRef.current = 0;
      return;
    }

    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const files: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) {
            files.push(file);
          }
        }
      }

      if (files.length > 0) {
        e.preventDefault();
        await processFilesRef.current(files);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, [isActive, taskId]);

  const handleDrag = (e: React.DragEvent) => {
    if (!isActive || taskId === '__placeholder__') return;
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      if (e.type === "dragenter") {
        dragCounterRef.current++;
      }
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      dragCounterRef.current--;
      if (dragCounterRef.current === 0) {
        setIsDragActive(false);
      }
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    if (!isActive || taskId === '__placeholder__') return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    dragCounterRef.current = 0;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processFilesRef.current(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) await processFiles(e.target.files);
  };

  const handleRemoveAttachment = (url: string) => {
    setAttachments(prev => prev.filter(att => att.url !== url));
  };

  const handleViewAttachment = (att: TaskAttachment) => {
    if (att.uploading) return;
    openModal({
      kind: 'mediaViewer',
      url: att.url,
      mediaType: att.type,
      title: att.name
    });
  };

  useEffect(() => {
    if (taskId === '__placeholder__') return;
    const t = title.trim();
    if (!t) return;

    const existing = tasks.find(x => x.id === taskId);
    if (existing) {
      const hasChanged = 
        existing.title !== t ||
        (existing.description || existing.note || '') !== description.trim() ||
        (existing.dueDate || '') !== (dueDate || '') ||
        (existing.endDate || '') !== (endDate || '') ||
        (existing.includeTime || false) !== includeTime ||
        (existing.reminder || '') !== (reminder || '') ||
        (existing.priority || null) !== priority ||
        (existing.color || '') !== color ||
        (existing.entityId || null) !== entityId ||
        JSON.stringify(existing.subtasks || []) !== JSON.stringify(subtasks) ||
        existing.completed !== completed ||
        existing.status !== (completed ? 'done' : status) ||
        JSON.stringify(existing.attachments || []) !== JSON.stringify(attachments) ||
        (existing.tag || '') !== tag.trim();

      if (hasChanged) {
        setSyncState('saving');
        updateTask(taskId, {
          title: t,
          description: description.trim(),
          note: description.trim(),
          dueDate: dueDate || undefined,
          endDate: endDate || undefined,
          includeTime,
          reminder: reminder || undefined,
          priority: priority || undefined,
          color: color || undefined,
          entityId: entityId || undefined,
          subtasks,
          completed,
          status: completed ? 'done' : status,
          attachments,
          tag: tag.trim() || undefined,
        })
          .then(({ error }) => setSyncState(error ? 'error' : 'saved'))
          .catch(() => setSyncState('error'));
      }
    } else {
      setSyncState('saving');
      addTask({
        id: taskId,
        title: t,
        completed,
        status: completed ? 'done' : status,
        description: description.trim(),
        note: description.trim(),
        dueDate: dueDate || undefined,
        endDate: endDate || undefined,
        includeTime,
        reminder: reminder || undefined,
        priority: priority || undefined,
        color: color || undefined,
        entityId: entityId || undefined,
        subtasks,
        createdAt: Date.now(),
        attachments,
        tag: tag.trim() || undefined,
      })
        .then(({ error }) => setSyncState(error ? 'error' : 'saved'))
        .catch(() => setSyncState('error'));
    }
  }, [
    taskId,
    title,
    description,
    dueDate,
    endDate,
    includeTime,
    reminder,
    priority,
    color,
    entityId,
    subtasks,
    completed,
    status,
    attachments,
    tag,
    tasks,
    updateTask,
    addTask,
    setSyncState
  ]);

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
    <div 
      className="flex flex-col h-full relative"
      onDragEnter={handleDrag}
      onDragOver={handleDrag}
      onDragLeave={handleDrag}
      onDrop={handleDrop}
    >
      {isDragActive && (
        <div className="absolute inset-0 bg-[var(--app-background)]/80 backdrop-blur-[8px] border-2 border-dashed border-[var(--accent)] rounded-[12px] m-2 z-[999] flex flex-col items-center justify-center gap-3 pointer-events-none animate-in fade-in zoom-in duration-200">
          <div className="w-16 h-16 rounded-full bg-[var(--accent)]/10 border border-[var(--accent)]/30 flex items-center justify-center shadow-xl shadow-[var(--accent)]/15">
            <Paperclip className="w-8 h-8 text-[var(--accent)] animate-bounce" />
          </div>
          <div className="text-sm font-semibold text-[var(--bone-100)]">Drop to attach files</div>
          <div className="text-[10px] text-[var(--bone-40)] uppercase tracking-wider">Images, audio, video, PDF or files</div>
        </div>
      )}
      <div className="flex-1 overflow-y-auto px-7 pt-6 pb-4 space-y-5 scrollbar-thin">
        {/* Title & Color Dot Picker */}
        <div className="flex items-start gap-3">
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="shrink-0 w-4 h-4 rounded-full flex items-center justify-center focus:outline-none cursor-pointer mt-1.5 hover:opacity-85 text-[var(--bone-30)] transition-opacity duration-150"
                style={{
                  backgroundColor: color || 'transparent',
                }}
              >
                {!color && <CircleDashed className="w-4 h-4 shrink-0" />}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-[170px] p-0 bg-transparent border-none shadow-none z-[202]" align="start">
              <div className="popup-glass-small p-2 flex flex-col gap-2 min-w-[160px] shadow-2xl">
                <button
                  onClick={() => setColor('')}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-2 py-1.5 rounded-[8px] text-[13px] font-medium cursor-pointer transition-none",
                    !color
                      ? "bg-[var(--bone-6)] text-[var(--bone-100)]"
                      : "text-[var(--bone-70)] hover:bg-[var(--bone-5)]"
                  )}
                >
                  <CircleDashed className="w-3.5 h-3.5 shrink-0 text-[var(--bone-40)]" />
                  <span>None</span>
                  {!color && <Check className="w-3 h-3 text-[var(--bone-60)] shrink-0 ml-auto" />}
                </button>
                <div className="grid grid-cols-4 gap-2 px-1 pb-0.5 place-items-center">
                  {COLORS.slice(0, 4).map(c => (
                    <button
                      key={c}
                      onClick={() => setColor(color === c ? '' : c)}
                      className={cn(
                        "w-7 h-7 rounded-full transition-all cursor-pointer flex items-center justify-center",
                        color === c ? "scale-110 ring-1 ring-[var(--bone-70)] ring-offset-2 ring-offset-[var(--color-panel)]" : "opacity-50 hover:opacity-100"
                      )}
                      style={{ backgroundColor: c }}
                      title={c}
                    >
                      {color === c && <Check className="w-3.5 h-3.5 text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]" />}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-4 gap-2 px-1 pb-0 place-items-center">
                  {COLORS.slice(4, 8).map(c => (
                    <button
                      key={c}
                      onClick={() => setColor(color === c ? '' : c)}
                      className={cn(
                        "w-7 h-7 rounded-full transition-all cursor-pointer flex items-center justify-center",
                        color === c ? "scale-110 ring-1 ring-[var(--bone-70)] ring-offset-2 ring-offset-[var(--color-panel)]" : "opacity-50 hover:opacity-100"
                      )}
                      style={{ backgroundColor: c }}
                      title={c}
                    >
                      {color === c && <Check className="w-3.5 h-3.5 text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]" />}
                    </button>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <input
            ref={titleInputRef}
            type="text"
            placeholder="Task Title..."
            value={title}
            onChange={e => setTitle(e.target.value)}
            className={cn(
              "flex-1 bg-transparent text-xl font-bold tracking-tight text-[var(--bone-100)] placeholder-[var(--bone-30)] border-none outline-none",
              completed && "line-through text-[var(--bone-40)]"
            )}
            autoFocus
          />
        </div>

        {/* Metadata Grid */}
        <div className="border-b border-[var(--bone-6)] pb-4 grid grid-cols-[100px_1fr] gap-y-3 text-xs items-center">
          {/* Status */}
          <div className="text-[var(--bone-40)] font-semibold flex items-center gap-2">
            <Loader className="w-3 h-3 opacity-60" />
            Status
          </div>
          <div className="w-[180px]">
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
                    <span className={cn("w-2 h-2 rounded-full shrink-0",
                      displayStatus === 'done' ? "bg-emerald-500" :
                      displayStatus === 'in-progress' ? "bg-amber-500" :
                      displayStatus === 'today' ? "bg-violet-500" :
                      displayStatus === 'overdue' ? "bg-red-500" : "bg-blue-500"
                    )} />
                    <span>
                      {displayStatus === 'done' ? 'Done' :
                       displayStatus === 'in-progress' ? 'In Progress' :
                       displayStatus === 'today' ? 'Today' :
                       displayStatus === 'overdue' ? 'Overdue' : 'To Do'}
                    </span>
                  </div>
                  <ChevronDown className="w-3 h-3 opacity-60 shrink-0 transition-none" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-[150px] p-1.5 flex flex-col gap-[2px] bg-[var(--background-secondary)] bg-panel border border-[var(--bone-6)] shadow-2xl rounded-[12px] z-[202]" align="start">
                {[
                  { id: 'todo' as const, label: 'To Do', color: 'bg-blue-500', activeClass: 'bg-blue-500/15 text-blue-400', onClick: () => { setCompleted(false); setStatus('todo'); setDueDate(''); } },
                  { id: 'in-progress' as const, label: 'In progress', color: 'bg-amber-500', activeClass: 'bg-amber-500/15 text-amber-400', onClick: () => { setCompleted(false); setStatus('in-progress'); } },
                  { id: 'today' as const, label: 'Today', color: 'bg-violet-500', activeClass: 'bg-violet-500/15 text-violet-400', onClick: () => { setCompleted(false); setStatus('todo'); setDueDate(todayStr); } },
                  { id: 'overdue' as const, label: 'Overdue', color: 'bg-red-500', activeClass: 'bg-red-500/15 text-red-400', onClick: () => { setCompleted(false); setStatus('todo'); setDueDate(yesterdayStr); } },
                  { id: 'done' as const, label: 'Done', color: 'bg-emerald-500', activeClass: 'bg-emerald-500/15 text-emerald-400', onClick: () => { setCompleted(true); } },
                ].map(opt => {
                  const isActive = (opt.id === 'done' && displayStatus === 'done') || (opt.id !== 'done' && displayStatus === opt.id);
                  return (
                    <button key={opt.id} onClick={opt.onClick}
                      className={cn(
                        "w-full px-3 py-1.5 rounded-[8px] text-left text-[13px] font-medium flex items-center justify-between cursor-pointer transition-none",
                        isActive
                          ? opt.activeClass
                          : "text-[var(--bone-70)] hover:bg-[var(--bone-5)]"
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className={cn("w-2 h-2 rounded-full shrink-0", opt.color)} />
                        <span>{opt.label}</span>
                      </div>
                      {isActive && <Check className="w-3.5 h-3.5 shrink-0 ml-2" />}
                    </button>
                  );
                })}
              </PopoverContent>
            </Popover>
          </div>

          {/* Priority */}
          <div className="text-[var(--bone-40)] font-semibold flex items-center gap-2">
            <Flag className="w-3 h-3 opacity-60" /> Priority
          </div>
          <div className="flex gap-1.5 w-[180px]">
            {(['low', 'medium', 'high'] as const).map(p => (
              <button key={p} onClick={() => togglePriority(p)}
                className={cn("flex-auto px-1 py-1.5 rounded-[6px] text-[11px] font-medium transition-all cursor-pointer capitalize border-none focus:outline-none text-center",
                  priority === p
                    ? p === 'high' ? "bg-red-500/15 text-red-400" :
                      p === 'medium' ? "bg-amber-500/15 text-amber-400" : "bg-blue-500/15 text-blue-400"
                    : "bg-[var(--bone-6)] text-[var(--bone-40)] hover:bg-[var(--bone-10)] focus:bg-[var(--bone-10)] focus:text-[var(--bone-100)]"
                )}>{p}</button>
            ))}
          </div>

          {/* Due Date */}
          <div className="text-[var(--bone-40)] font-semibold flex items-center gap-2">
            <Calendar className="w-3 h-3 opacity-60" /> Due Date
          </div>
          <div className="w-[180px]">
            <NotionDateTimePicker
              startDate={dueDate}
              setStartDate={setDueDate}
              endDate={endDate}
              setEndDate={setEndDate}
              includeTime={includeTime}
              setIncludeTime={setIncludeTime}
              reminder={reminder}
              setReminder={setReminder}
              isOverdue={isTaskOverdue({ completed, dueDate, endDate })}
            />
          </div>

          {/* Workspace Assignment */}
          <div className="text-[var(--bone-40)] font-semibold flex items-center gap-2">
            <Folder className="w-3 h-3 opacity-60" /> Workspace
          </div>
          <div className="w-[180px] relative">
            <Popover>
              <PopoverTrigger asChild>
                {(() => {
                  const ws = entityId ? entities.find(w => w.id === entityId) : null;
                  if (ws) {
                    const WsIcon = getEntityIcon(ws.icon);
                    return (
                      <button className="w-full flex items-center bg-[var(--bone-6)] rounded-[6px] pl-2.5 pr-8 py-1.5 text-xs text-[var(--bone-90)] hover:bg-[var(--bone-10)] focus:bg-[var(--bone-10)] outline-none transition-all cursor-pointer text-left">
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          <WsIcon className="w-3 h-3 opacity-60 shrink-0 text-[var(--bone-100)]" />
                          <span className="truncate font-medium">{ws.title}</span>
                        </div>
                      </button>
                    );
                  }
                  return (
                    <button className="w-full flex items-center justify-start bg-[var(--bone-6)] rounded-[6px] px-2.5 py-1.5 text-xs text-[var(--bone-30)] hover:bg-[var(--bone-10)] focus:bg-[var(--bone-10)] outline-none transition-all cursor-pointer">
                      <span className="font-medium">None</span>
                    </button>
                  );
                })()}
              </PopoverTrigger>
              <PopoverContent className="w-[200px] p-1.5 bg-panel border border-[var(--bone-6)] shadow-2xl rounded-[12px] z-[202]" align="start">
                <button onClick={() => { setEntityId(null); }}
                  className={cn("w-full px-3 py-1.5 text-left text-xs rounded-[8px] transition-none cursor-pointer", !entityId ? "bg-[var(--bone-10)] text-[var(--bone-100)] font-semibold" : "text-[var(--bone-70)] hover:bg-[var(--bone-5)]")}>None</button>
                {spaces.map(w => {
                  const WsIcon = getEntityIcon(w.icon);
                  return (
                    <button key={w.id} onClick={() => { setEntityId(w.id); }}
                      className={cn("w-full px-3 py-1.5 text-left text-xs rounded-[8px] transition-none mt-0.5 cursor-pointer", entityId === w.id ? "bg-[var(--bone-10)] text-[var(--bone-100)] font-semibold" : "text-[var(--bone-70)] hover:bg-[var(--bone-5)]")}>
                      <div className="flex items-center gap-1.5">
                        <WsIcon className="w-3 h-3 opacity-60 text-[var(--bone-100)]" />
                        <span className="truncate">{w.title}</span>
                      </div>
                    </button>
                  );
                })}
              </PopoverContent>
            </Popover>
            {entityId && entities.some(w => w.id === entityId) && (
              <span
                onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
                onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setEntityId(null);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center rounded-[4px] text-[var(--bone-40)] hover:text-[var(--bone-100)] hover:bg-[var(--bone-15)] transition-none shrink-0 cursor-pointer z-20"
              >
                <X className="w-2.5 h-2.5" />
              </span>
            )}
          </div>

          {/* Custom Tag */}
          <div className="text-[var(--bone-40)] font-semibold flex items-center gap-2">
            <Tag className="w-3 h-3 opacity-60" /> Custom Tag
          </div>
          <div className="w-[180px] relative">
            <input
              type="text"
              placeholder="Tag..."
              value={tag}
              onChange={e => {
                setTag(e.target.value);
                setIsTagDropdownOpen(true);
              }}
              onFocus={() => setIsTagDropdownOpen(true)}
              onBlur={() => {
                // Short delay so dropdown option click triggers before it closes
                setTimeout(() => setIsTagDropdownOpen(false), 150);
              }}
              className="w-full bg-[var(--bone-6)] rounded-[6px] pl-2.5 pr-8 py-1.5 text-xs text-[var(--bone-90)] placeholder-[var(--bone-30)] border-none outline-none hover:bg-[var(--bone-10)] focus:bg-[var(--bone-10)] transition-all"
            />
            {tag && (
              <span
                onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
                onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setTag('');
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center rounded-[4px] text-[var(--bone-40)] hover:text-[var(--bone-100)] hover:bg-[var(--bone-15)] transition-none shrink-0 cursor-pointer z-20"
              >
                <X className="w-2.5 h-2.5" />
              </span>
            )}
            {isTagDropdownOpen && filteredTags.length > 0 && (
              <div className="absolute left-0 right-0 mt-1 max-h-[140px] overflow-y-auto scrollbar-thin bg-panel border border-[var(--bone-6)] shadow-2xl rounded-[8px] z-[300] p-1 flex flex-col gap-[1px]">
                {filteredTags.map(t => (
                  <button
                    key={t}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                    }}
                    onClick={() => {
                      setTag(t);
                      setIsTagDropdownOpen(false);
                    }}
                    className="w-full px-2.5 py-1.5 text-left text-xs rounded-[6px] hover:bg-[var(--bone-5)] text-[var(--bone-80)] hover:text-[var(--bone-100)] cursor-pointer truncate transition-none border-none outline-none bg-transparent shrink-0"
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-[var(--bone-40)]">
            <FileText className="w-3.5 h-3.5 opacity-60" /> Description
          </div>
          <div className="bg-[var(--bone-6)] hover:bg-[var(--bone-10)] focus-within:bg-[var(--bone-10)] transition-all rounded-[10px] p-3 min-h-[100px]">
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
                <div key={sub.id} className="flex items-start gap-2.5 group">
                  <button onClick={() => toggleSubtask(sub.id)}
                    className="w-4 h-4 mt-[3px] rounded-[4px] border flex items-center justify-center shrink-0 cursor-pointer border-[var(--bone-30)] hover:border-[var(--bone-70)] bg-[var(--bone-6)] transition-colors">
                    {sub.completed && <Check className="w-[10px] h-[10px] text-[var(--bone-100)] stroke-[3px]" />}
                  </button>
                  <SubtaskTextEditor
                    sub={sub}
                    onEdit={(id, newText) => setSubtasks(prev => prev.map(s => s.id === id ? { ...s, text: newText } : s))}
                  />
                  <button onClick={() => removeSubtask(sub.id)}
                    className="mt-[3px] text-[var(--bone-30)] hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer shrink-0">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2 items-stretch">
            <div className="flex-1 bg-[var(--bone-6)] hover:bg-[var(--bone-10)] focus-within:bg-[var(--bone-10)] transition-all rounded-[8px] px-3 flex items-center" style={{ minHeight: '32px' }}>
              <input type="text" placeholder="Add new subtask..." value={newSubtaskText}
                onChange={e => setNewSubtaskText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddSubtask()}
                className="w-full bg-transparent text-xs text-[var(--bone-90)] placeholder-[var(--bone-30)] outline-none" />
            </div>
            <button onClick={handleAddSubtask}
              className="w-8 flex items-center justify-center bg-[var(--bone-6)] rounded-[8px] text-[var(--bone-70)] hover:text-[var(--bone-100)] hover:bg-[var(--bone-10)] focus:bg-[var(--bone-10)] focus:text-[var(--bone-100)] outline-none transition-all cursor-pointer shrink-0"
              style={{ minHeight: '32px' }}>
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Attachments Section */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs font-semibold text-[var(--bone-40)]">
            <div className="flex items-center gap-2">
              <Paperclip className="w-3.5 h-3.5 opacity-60" /> Attachments
            </div>
            {attachments.length > 0 && (
              <span className="text-[10px] text-[var(--bone-30)] font-medium">
                {attachments.length} file{attachments.length === 1 ? '' : 's'}
              </span>
            )}
          </div>

          {/* List of attachments */}
          {attachments.length > 0 && (
            <div className="grid grid-cols-2 gap-2 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin">
              {attachments.map((att, idx) => {
                const isImage = att.type === 'image';
                const AttachmentIcon = att.type === 'pdf' ? FileText :
                                       att.type === 'audio' ? FileAudio :
                                       att.type === 'video' ? FileVideo :
                                       att.type === 'image' ? FileImage : File;
                return (
                  <div key={idx} className="group relative flex items-center gap-2.5 p-2 rounded-[8px] bg-[var(--bone-6)] hover:bg-[var(--bone-10)] border border-[var(--bone-6)] transition-all cursor-pointer overflow-hidden h-14"
                    onClick={() => handleViewAttachment(att)}>
                    {isImage && !att.uploading ? (
                      <div className="w-10 h-10 rounded-[6px] overflow-hidden bg-black shrink-0 relative">
                        <img src={att.url} alt={att.name} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-[6px] bg-[var(--bone-10)] flex items-center justify-center shrink-0">
                        {att.uploading ? (
                          <Loader2 className="w-4 h-4 text-[var(--bone-50)] animate-spin" />
                        ) : (
                          <AttachmentIcon className="w-4 h-4 text-[var(--bone-60)]" />
                        )}
                      </div>
                    )}
                    
                    <div className="flex-1 min-w-0 pr-6">
                      <div className="text-xs text-[var(--bone-90)] font-medium truncate leading-tight">{att.name}</div>
                      <div className="text-[10px] text-[var(--bone-40)] capitalize leading-normal">
                        {att.uploading ? 'Uploading...' : att.type}
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveAttachment(att.url);
                      }}
                      className="absolute top-1/2 -translate-y-1/2 right-2 w-6 h-6 flex items-center justify-center rounded-[6px] text-[var(--bone-100)] hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-30 hover:opacity-100 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Upload Button Box */}
          <div className="relative">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              multiple
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="w-full flex items-center justify-center gap-2 p-3 rounded-[10px] border border-dashed border-[var(--bone-15)] hover:border-[var(--bone-40)] hover:bg-[var(--bone-5)] active:scale-[0.99] transition-all text-xs font-semibold text-[var(--bone-50)] hover:text-[var(--bone-80)] cursor-pointer"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Uploading files...</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>Attach media or files</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="shrink-0 px-5 py-3 border-t border-[var(--bone-6)] flex items-center justify-between bg-sidebar">
        {isEditing ? (
          <button onClick={handleDelete}
            className="px-4 py-2 rounded-[8px] bg-red-500/8 text-red-400/80 hover:bg-red-500/15 hover:text-red-400 flex items-center gap-1.5 text-sm font-semibold transition-all cursor-pointer">
            <Trash2 strokeWidth={2.5} className="w-4 h-4 shrink-0" />
            <span>Delete</span>
          </button>
        ) : <div />}
        <div className="flex items-center gap-2">
          {!completed && (
            <button onClick={() => { setCompleted(true); setStatus('done'); }}
              className="px-4 py-2 rounded-[8px] bg-emerald-500/8 text-emerald-400/80 hover:bg-emerald-500/15 hover:text-emerald-400 flex items-center gap-1.5 text-sm font-semibold transition-all cursor-pointer">
              <Check strokeWidth={2.5} className="w-4 h-4 shrink-0" />
              <span>Complete</span>
            </button>
          )}
          <button onClick={closePanel}
            className="px-5 py-2 rounded-[8px] bg-[var(--bone-12)] text-[var(--bone-100)] hover:bg-[var(--app-dark)] hover:text-[var(--bone-100)] text-sm font-semibold transition-all cursor-pointer">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

export function TaskInspectorPanel() {
  const activeTaskId = useStore(s => s.activeTaskId);
  const closeTaskPanel = useStore(s => s.closeTaskPanel);
  const activeEntityId = useStore(s => s.activeEntityId);
  const openTaskPanel = useStore(s => s.openTaskPanel);
  const tasks = useStore(s => s.tasks);
  const activeTabId = useStore(s => s.activeTabId);
  const addTab = useStore(s => s.addTab);

  const activeTask = useMemo(() => tasks.find(t => t.id === activeTaskId), [activeTaskId, tasks]);

  const [syncState, setSyncState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const lastEntityIdRef = useRef(activeEntityId);
  const isTransitioningToTrackerRef = useRef(false);

  useEffect(() => {
    if (activeEntityId !== lastEntityIdRef.current) {
      lastEntityIdRef.current = activeEntityId;
      if (isTransitioningToTrackerRef.current) {
        isTransitioningToTrackerRef.current = false;
        return;
      }
      if (activeTaskId) {
        closeTaskPanel();
      }
    }
  }, [activeEntityId, activeTaskId, closeTaskPanel]);

  useEffect(() => {
    setSyncState('idle');
  }, [activeTaskId]);

  const formattedCreatedAt = useMemo(() => {
    if (!activeTask || !activeTask.createdAt) return '';
    const date = new Date(activeTask.createdAt);
    return `Created ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }, [activeTask]);

  const handleDuplicate = () => {
    if (!activeTask) return;
    const newTaskId = generateId();
    const presets: Partial<AppTask> = {
      dueDate: activeTask.dueDate,
      userDueDate: activeTask.userDueDate,
      // @ts-ignore
      dueTime: (activeTask as any).dueTime,
      priority: activeTask.priority,
      color: activeTask.color,
      spaceId: activeTask.spaceId,
      tag: activeTask.tag,
      status: activeTask.status,
      completed: false,
      subtasks: activeTask.subtasks?.map(s => ({ ...s, id: generateId(), completed: false })),
    };
    openTaskPanel(newTaskId, presets);
  };

  // Keep last non-null taskId so TaskPanelContent stays mounted across opens.
  // This turns re-opens into cheap updates instead of expensive full mounts.
  // Never return null — the wrapper must always be in the DOM so the first
  // open doesn't trigger a mount during the transition (that blocks the thread).
  const stableTaskIdRef = useRef<string | null>(null);
  if (activeTaskId) stableTaskIdRef.current = activeTaskId;
  const stableTaskId = stableTaskIdRef.current;

  const isDesktopEnv = isDesktop();
  const headerHeight = isDesktopEnv ? 38 : 42;

  return (
    <div className="h-full w-full flex flex-col bg-sidebar overflow-hidden tracking-wider">
      {/* Panel Header */}
      <div 
        className="flex items-center justify-between px-3 border-b border-[var(--bone-6)] shrink-0"
        style={{ height: headerHeight }}
      >
        {/* Left side: Creation timestamp & Sync status */}
        <div className="flex items-center gap-2.5 select-none pl-1 opacity-40 tracking-wider">
          {formattedCreatedAt && (
            <span className="text-xs font-semibold text-[var(--bone-40)]">{formattedCreatedAt}</span>
          )}
          {syncState === 'saving' && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--bone-6)] text-[var(--bone-40)] text-[10px] font-semibold animate-pulse">
              <Loader2 className="w-2.5 h-2.5 animate-spin shrink-0" />
              <span>Saving</span>
            </div>
          )}
          {syncState === 'saved' && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--bone-6)] text-[var(--bone-40)] text-[10px] font-semibold">
              <Check className="w-2.5 h-2.5 shrink-0" />
              <span>Saved</span>
            </div>
          )}
          {syncState === 'error' && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/8 text-red-400 text-[10px] font-semibold">
              <X className="w-2.5 h-2.5 shrink-0" />
              <span>Error</span>
            </div>
          )}
        </div>

        {/* Right side: Actions */}
        <div className="flex items-center gap-1">
          {activeTabId !== 'tracker' && (
            <Tooltip content="Open in tracker" position="bottom" delay={400}>
              <button 
                onClick={() => {
                  isTransitioningToTrackerRef.current = true;
                  addTab('tracker');
                }}
                className="w-6 h-6 flex items-center justify-center rounded-[6px] text-[var(--bone-40)] hover:text-[var(--bone-100)] hover:bg-[var(--bone-10)] transition-all cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" strokeWidth={2} />
              </button>
            </Tooltip>
          )}
          {activeTask && (
            <Tooltip content="Duplicate task" position="bottom" delay={400}>
              <button 
                onClick={handleDuplicate}
                className="w-6 h-6 flex items-center justify-center rounded-[6px] text-[var(--bone-40)] hover:text-[var(--bone-100)] hover:bg-[var(--bone-10)] transition-all cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" strokeWidth={2} />
              </button>
            </Tooltip>
          )}
          <Tooltip content="New task" position="bottom" delay={400}>
            <button 
              onClick={() => {
                const newTaskId = generateId();
                openTaskPanel(newTaskId);
              }}
              className="w-6 h-6 flex items-center justify-center rounded-[6px] text-[var(--bone-40)] hover:text-[var(--bone-100)] hover:bg-[var(--bone-10)] transition-all cursor-pointer"
            >
              <SquarePen className="w-3.5 h-3.5" strokeWidth={2} />
            </button>
          </Tooltip>
          <Tooltip content="Close panel" position="bottom" delay={400}>
            <button onClick={closeTaskPanel}
              className="w-6 h-6 flex items-center justify-center rounded-[6px] text-[var(--bone-40)] hover:text-[var(--bone-100)] hover:bg-[var(--bone-10)] transition-all cursor-pointer">
              <X className="w-3.5 h-3.5" strokeWidth={2} />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Task Form — always mounted so first open doesn't pay a mount cost mid-transition.
          '__placeholder__' resolves to no task (empty state) until a real id is set. */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <TaskPanelContent 
          taskId={stableTaskId || '__placeholder__'} 
          closePanel={closeTaskPanel} 
          isActive={!!activeTaskId}
          setSyncState={setSyncState}
        />
      </div>
    </div>
  );
}
