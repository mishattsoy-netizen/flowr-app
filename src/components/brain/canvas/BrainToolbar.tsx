"use client";

import { cn } from '@/lib/utils';
import { Link2, Search, MousePointer2, StickyNote, FolderPlus } from 'lucide-react';
import { Tooltip } from '@/components/layout/Tooltip';

interface BrainToolbarProps {
  connectMode: boolean;
  onToggleConnect: () => void;
  onNewNode: () => void;
  newNodeActive: boolean;
  addExistingOpen: boolean;
  onToggleAddExisting: () => void;
  searchOpen: boolean;
  onToggleSearch: () => void;
  onSelectTool: () => void;
}

export function BrainToolbar({
  connectMode,
  onToggleConnect,
  onNewNode,
  newNodeActive,
  addExistingOpen,
  onToggleAddExisting,
  searchOpen,
  onToggleSearch,
  onSelectTool,
}: BrainToolbarProps) {
  const selectActive = !connectMode && !newNodeActive && !addExistingOpen && !searchOpen;

  const btnClass = (active?: boolean) => cn(
    "group w-[34px] h-[30px] rounded-[var(--radius-small)] flex items-center justify-center transition-all duration-150 ease-in-out",
    active
      ? "bg-[var(--bone-12)] text-[var(--bone-100)] font-semibold"
      : "bg-transparent text-[var(--bone-100)] hover:bg-[var(--app-dark)]"
  );

  return (
    <div
      className="flex items-center bg-panel border border-[var(--bone-12)] shadow-[0_4px_12px_rgba(0,0,0,0.12)] rounded-[11px] p-[5px] gap-[4px] select-none canvas-floating-panel"
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <Tooltip content="Select (V)">
        <button
          type="button"
          onClick={onSelectTool}
          className={btnClass(selectActive)}
        >
          <span className={selectActive ? "" : "opacity-60 group-hover:opacity-100"}>
            <MousePointer2 className="w-4 h-4 text-[var(--bone-100)]" />
          </span>
        </button>
      </Tooltip>

      <Tooltip content="Search nodes in this brain (/)">
        <button
          type="button"
          onClick={onToggleSearch}
          className={btnClass(searchOpen)}
        >
          <span className={searchOpen ? "" : "opacity-60 group-hover:opacity-100"}>
            <Search className="w-4 h-4 text-[var(--bone-100)]" />
          </span>
        </button>
      </Tooltip>

      <div className="w-px h-[18px] bg-border/30 mx-[3px]" />

      <Tooltip content="Create a new note and add it to the brain (N)">
        <button
          type="button"
          onClick={onNewNode}
          className={btnClass(newNodeActive)}
        >
          <span className={newNodeActive ? "" : "opacity-60 group-hover:opacity-100"}>
            <StickyNote className="w-4 h-4 text-[var(--bone-100)]" />
          </span>
        </button>
      </Tooltip>

      <Tooltip content="Add an existing note or workspace to the brain (F)">
        <button
          type="button"
          onClick={onToggleAddExisting}
          className={btnClass(addExistingOpen)}
        >
          <span className={addExistingOpen ? "" : "opacity-60 group-hover:opacity-100"}>
            <FolderPlus className="w-4 h-4 text-[var(--bone-100)]" />
          </span>
        </button>
      </Tooltip>

      <div className="w-px h-[18px] bg-border/30 mx-[3px]" />

      <Tooltip content="Connect nodes (C)">
        <button
          type="button"
          onClick={onToggleConnect}
          className={btnClass(connectMode)}
        >
          <span className={connectMode ? "" : "opacity-60 group-hover:opacity-100"}>
            <Link2 className="w-4 h-4 text-[var(--bone-100)]" />
          </span>
        </button>
      </Tooltip>
    </div>
  );
}
