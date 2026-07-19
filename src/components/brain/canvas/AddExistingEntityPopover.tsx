"use client";

import { useState, useMemo, useRef, useEffect } from 'react';
import { Search, FileText, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip } from '@/components/layout/Tooltip';
import { useStore } from '@/data/store';
import { getEntityIcon } from '@/data/icons';

interface Props {
  onAddEntity: (refId: string, type: 'entity' | 'workspace') => void;
  onClose: () => void;
  /** Entity ids already present as active brain nodes (excluded from the list). */
  excludeRefIds?: string[];
}

export function AddExistingEntityPopover({ onAddEntity, onClose, excludeRefIds = [] }: Props) {
  const entities = useStore(s => s.entities);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const excluded = useMemo(() => new Set(excludeRefIds), [excludeRefIds]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const candidates = useMemo(() => {
    const q = query.toLowerCase().trim();
    return entities
      .filter(e => (e.type === 'note' || e.type === 'workspace'))
      .filter(e => !e.brainOnly)
      .filter(e => e.syncMode !== 'local-only')
      .filter(e => !excluded.has(e.id))
      .filter(e => !q || e.title?.toLowerCase().includes(q))
      .slice(0, 50);
  }, [entities, query, excluded]);

  return (
    <div
      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-72 p-2 rounded-xl bg-panel border border-[var(--bone-10)] shadow-lg pointer-events-auto canvas-floating-panel"
      onPointerDown={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
    >
      {/* Same search field as Settings modal / brain node search. */}
      <div className="relative mb-2">
        <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
          <Search className="w-[14px] h-[14px] text-[var(--bone-100)] opacity-70" strokeWidth={2} />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search notes & spaces…"
          className={cn(
            'w-full bg-[var(--bone-6)] border border-transparent hover:border-[var(--bone-12)]',
            'focus:border-[var(--brand-blue)] focus:shadow-[0_0_0_0.5px_var(--brand-blue)]',
            'rounded-md pl-9 py-1.5 text-[13px] text-bone-100 placeholder:text-bone-70/50',
            'outline-none transition-colors',
            query ? 'pr-8' : 'pr-3',
          )}
        />
        {query && (
          <Tooltip content="Clear">
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="absolute inset-y-0 right-0 pr-2 flex items-center text-[var(--bone-100)] opacity-40 hover:opacity-100 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" strokeWidth={2.5} />
            </button>
          </Tooltip>
        )}
      </div>
      <div className="flex flex-col gap-[1px] max-h-48 overflow-y-auto">
        {candidates.map(e => {
          const Icon = e.type === 'workspace' ? getEntityIcon(e.icon) : FileText;
          return (
            <button
              key={e.id}
              type="button"
              onClick={() => { onAddEntity(e.id, e.type === 'workspace' ? 'workspace' : 'entity'); onClose(); }}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] hover:bg-[var(--app-dark)] text-left transition-colors cursor-pointer"
            >
              <Icon className="w-3.5 h-3.5 text-[var(--bone-100)] opacity-60 shrink-0" strokeWidth={2} />
              <span className="truncate text-foreground">{e.title || 'Untitled'}</span>
            </button>
          );
        })}
        {candidates.length === 0 && (
          <p className="text-[11px] text-[var(--bone-30)] text-center py-3">No matches</p>
        )}
      </div>
    </div>
  );
}
