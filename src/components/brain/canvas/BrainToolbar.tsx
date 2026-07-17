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
}

export function BrainToolbar({
  connectMode,
  onToggleConnect,
  onNewNode,
  newNodeActive,
  addExistingOpen,
  onToggleAddExisting,
}: BrainToolbarProps) {
  const btnClass = (active?: boolean) => cn(
    "flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-medium transition-colors border",
    active
      ? "bg-[var(--accent)] text-white border-[var(--accent)]"
      : "bg-[var(--app-dark)] text-[var(--bone-70)] border-[var(--bone-10)] hover:border-[var(--bone-20)] hover:text-foreground"
  );

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-panel border border-[var(--bone-10)] shadow-md">
      <button
        onClick={() => {}}
        className={btnClass(false)}
        title="Select / Pan (default)"
      >
        <MousePointer2 className="w-3.5 h-3.5" strokeWidth={2} />
        <span>Select</span>
      </button>
      <div className="w-px h-5 bg-[var(--bone-8)]" />
      <button
        onClick={onNewNode}
        className={btnClass(newNodeActive)}
        title="Create a new note and add it to the brain"
      >
        <StickyNote className="w-3.5 h-3.5" strokeWidth={2} />
        <span>New node</span>
      </button>
      <button
        onClick={onToggleAddExisting}
        className={btnClass(addExistingOpen)}
        title="Add an existing note or workspace to the brain"
      >
        <Search className="w-3.5 h-3.5" strokeWidth={2} />
        <span>Add existing</span>
      </button>
      <div className="w-px h-5 bg-[var(--bone-8)]" />
      <button
        onClick={onToggleConnect}
        className={btnClass(connectMode)}
        title="Connect nodes — click a connector dot, then another"
      >
        <Link2 className="w-3.5 h-3.5" strokeWidth={2} />
        <span>Connect</span>
      </button>
    </div>
  );
}
