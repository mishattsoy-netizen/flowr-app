"use client";

import { useStore } from '@/data/store';
import { ChevronDown, Plus, Check, MoreVertical, Star, Edit2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useRef, useEffect } from 'react';

export function SpaceSwitcher() {
  const spaces = useStore(s => s.spaces);
  const activeSpaceId = useStore(s => s.activeSpaceId);
  const setActiveSpaceId = useStore(s => s.setActiveSpaceId);
  const openModal = useStore(s => s.openModal);
  const updateSpace = useStore(s => s.updateSpace);
  const [open, setOpen] = useState(false);
  const [optionsOpenFor, setOptionsOpenFor] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const active = spaces.find(w => w.id === activeSpaceId) ?? spaces[0];

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
        className={cn("flex items-center w-full px-3 py-2 rounded-[var(--radius-medium)] hover:bg-[var(--app-dark)] group", open && "!bg-dark !text-[var(--bone-100)]")}
      >
        <span className="flex-1 text-left text-sm font-semibold text-foreground text-fade">
          {active?.name ?? 'Personal'}
        </span>
        <ChevronDown
          strokeWidth={2}
          className={cn('w-3.5 h-3.5 text-[var(--bone-70)]', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div className="absolute left-3 right-3 top-full mt-1 z-50 bg-panel border border-border rounded-[var(--radius-medium)] shadow-lg py-1 overflow-hidden">
          {spaces.map(ws => (
            <div key={ws.id} className="relative">
              <div
                onClick={() => { setActiveSpaceId(ws.id); setOpen(false); }}
                role="button"
                tabIndex={0}
                className={cn(
                  "flex items-center w-full px-3 py-2 text-sm text-left gap-2 group",
                  ws.id === activeSpaceId
                    ? "bg-dark text-foreground"
                    : "hover:bg-[var(--app-dark)] text-foreground/80 hover:text-foreground"
                )}
              >
                <span className="flex-1 text-fade">{ws.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setOptionsOpenFor(optionsOpenFor === ws.id ? null : ws.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-[var(--bone-10)]"
                >
                  <MoreVertical strokeWidth={2} className="w-3.5 h-3.5 text-[var(--bone-50)] hover:text-[var(--bone-100)] shrink-0" />
                </button>
                {ws.id === activeSpaceId && (
                  <Check strokeWidth={2} className="w-3.5 h-3.5 text-accent shrink-0" />
                )}
              </div>

              {/* Options popover */}
              {optionsOpenFor === ws.id && (
                <div className="absolute right-0 top-0 z-[60] bg-panel border border-border rounded-[var(--radius-medium)] shadow-lg py-1 min-w-[160px]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => {
                      openModal({ kind: 'rename', entityId: ws.id });
                      setOptionsOpenFor(null);
                      setOpen(false);
                    }}
                    className="flex items-center w-full px-3 py-1.5 text-sm hover:bg-[var(--app-dark)] gap-2"
                  >
                    <Edit2 strokeWidth={2} className="w-3.5 h-3.5 shrink-0 text-[var(--bone-70)]" />
                    <span>Rename</span>
                  </button>

                  <button
                    onClick={() => {
                      updateSpace(ws.id, { isDefault: true });
                      setOptionsOpenFor(null);
                      setOpen(false);
                    }}
                    disabled={ws.isDefault}
                    className={cn(
                      "flex items-center w-full px-3 py-1.5 text-sm gap-2",
                      ws.isDefault
                        ? "opacity-50 cursor-default"
                        : "hover:bg-[var(--app-dark)]"
                    )}
                  >
                    <Star strokeWidth={2} className={cn("w-3.5 h-3.5 shrink-0", ws.isDefault ? "text-accent" : "text-[var(--bone-70)]")} />
                    <span>{ws.isDefault ? '✓ Default' : 'Set as default'}</span>
                  </button>

                  <div className="h-px bg-border mx-3 my-1" />

                  <button
                    onClick={() => {
                      openModal({ kind: 'deleteSpaceConfirm', spaceId: ws.id });
                      setOptionsOpenFor(null);
                      setOpen(false);
                    }}
                    className="flex items-center w-full px-3 py-1.5 text-sm hover:bg-[var(--app-dark)] gap-2 text-red-400"
                  >
                    <Trash2 strokeWidth={2} className="w-3.5 h-3.5 shrink-0" />
                    <span>Delete</span>
                  </button>
                </div>
              )}
            </div>
          ))}
          <div className="h-px bg-border mx-3 my-1" />
          <button
            onClick={() => { openModal({ kind: 'newWorkspace' }); setOpen(false); }}
            className="flex items-center w-full px-3 py-2 text-sm hover:bg-[var(--app-dark)] text-[var(--bone-70)] hover:text-[var(--bone-100)] gap-2"
          >
            <Plus strokeWidth={2} className="w-3.5 h-3.5 shrink-0" />
            New space
          </button>
        </div>
      )}
    </div>
  );
}
