"use client";

import { cn } from '@/lib/utils';
import { Plus, Link2, Search, MousePointer2, StickyNote } from 'lucide-react';

interface BrainToolbarProps {
  connectMode: boolean;
  onToggleConnect: () => void;
  onNewNode: () => void;
  newNodeActive: boolean;
  addExistingOpen: boolean;
  onToggleAddExisting: () => void;
  onSelectTool: () => void;
}

export function BrainToolbar({
  connectMode,
  onToggleConnect,
  onNewNode,
  newNodeActive,
  addExistingOpen,
  onToggleAddExisting,
  onSelectTool,
}: BrainToolbarProps) {
  const btnClass = (active?: boolean) => cn(
    "group w-[34px] h-[30px] rounded-[var(--radius-small)] flex items-center justify-center transition-all duration-150 ease-in-out",
    active
      ? "bg-[var(--bone-12)] text-[var(--bone-100)] font-semibold"
      : "bg-transparent text-[var(--bone-60)] hover:bg-[var(--app-dark)] hover:text-[var(--bone-100)]"
  );

  return (
    <div 
      className="flex items-center bg-panel border border-[var(--bone-12)] shadow-[0_4px_12px_rgba(0,0,0,0.12)] rounded-[11px] p-[5px] gap-[4px] select-none canvas-floating-panel"
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button
        onClick={onSelectTool}
        className={btnClass(!connectMode && !newNodeActive && !addExistingOpen)}
        title="Select (V)"
      >
        <span className={(!connectMode && !newNodeActive && !addExistingOpen) ? "" : "opacity-60 group-hover:opacity-100"}>
          <MousePointer2 className="w-4 h-4 text-[var(--bone-100)]" />
        </span>
      </button>

      <div className="w-px h-[18px] bg-border/30 mx-[3px]" />

      <button
        onClick={onNewNode}
        className={btnClass(newNodeActive)}
        title="Create a new note and add it to the brain (N)"
      >
        <span className={newNodeActive ? "" : "opacity-60 group-hover:opacity-100"}>
          <StickyNote className="w-4 h-4 text-[var(--bone-100)]" />
        </span>
      </button>

      <button
        onClick={onToggleAddExisting}
        className={btnClass(addExistingOpen)}
        title="Add an existing note or workspace to the brain (F)"
      >
        <span className={addExistingOpen ? "" : "opacity-60 group-hover:opacity-100"}>
          <Search className="w-4 h-4 text-[var(--bone-100)]" />
        </span>
      </button>

      <div className="w-px h-[18px] bg-border/30 mx-[3px]" />

      <button
        onClick={onToggleConnect}
        className={btnClass(connectMode)}
        title="Connect nodes (C)"
      >
        <span className={connectMode ? "" : "opacity-60 group-hover:opacity-100"}>
          <Link2 className="w-4 h-4 text-[var(--bone-100)]" />
        </span>
      </button>
    </div>
  );
}
