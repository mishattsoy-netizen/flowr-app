"use client";

import { useStore } from '@/data/store';
import { ChevronDown, Plus, Check } from 'lucide-react';
import clsx from 'clsx';
import { useState, useRef, useEffect } from 'react';

export function WorkspaceSwitcher() {
  const workspaces = useStore(s => s.workspaces);
  const activeWorkspaceId = useStore(s => s.activeWorkspaceId);
  const setActiveWorkspaceId = useStore(s => s.setActiveWorkspaceId);
  const openModal = useStore(s => s.openModal);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const active = workspaces.find(w => w.id === activeWorkspaceId) ?? workspaces[0];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative px-3 mb-1">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center w-full px-3 py-2 rounded-[var(--radius-medium)] hover:bg-[var(--bone-6)] group"
      >
        <span className="flex-1 text-left text-sm font-semibold text-foreground text-fade">
          {active?.name ?? 'Personal'}
        </span>
        <ChevronDown
          strokeWidth={2}
          className={clsx('w-3.5 h-3.5 text-[var(--bone-60)]', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div className="absolute left-3 right-3 top-full mt-1 z-50 bg-panel border border-border rounded-[var(--radius-medium)] shadow-lg py-1 overflow-hidden">
          {workspaces.map(ws => (
            <button
              key={ws.id}
              onClick={() => { setActiveWorkspaceId(ws.id); setOpen(false); }}
              className={clsx(
                "flex items-center w-full px-3 py-2 text-sm text-left gap-2 transition-all duration-0",
                ws.id === activeWorkspaceId
                  ? "bg-[var(--bone-15)] text-foreground"
                  : "hover:bg-[var(--bone-6)] text-foreground/80 hover:text-foreground"
              )}
            >
              <span className="flex-1 text-fade">{ws.name}</span>
              {ws.id === activeWorkspaceId && (
                <Check strokeWidth={2} className="w-3.5 h-3.5 text-accent shrink-0" />
              )}
            </button>
          ))}
          <div className="h-px bg-border mx-3 my-1" />
          <button
            onClick={() => { openModal({ kind: 'newWorkspace' }); setOpen(false); }}
            className="flex items-center w-full px-3 py-2 text-sm hover:bg-[var(--bone-6)] text-[var(--bone-60)] hover:text-[var(--bone-100)] gap-2"
          >
            <Plus strokeWidth={2} className="w-3.5 h-3.5 shrink-0" />
            New space
          </button>
        </div>
      )}
    </div>
  );
}
