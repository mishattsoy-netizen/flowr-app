"use client";

import { useState, useMemo, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Search, FileText, Folder } from 'lucide-react';
import { useStore } from '@/data/store';

interface Props {
  onAddEntity: (refId: string, type: 'entity' | 'workspace') => void;
  onClose: () => void;
}

export function AddExistingEntityPopover({ onAddEntity, onClose }: Props) {
  const entities = useStore(s => s.entities);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const candidates = useMemo(() => {
    const q = query.toLowerCase().trim();
    return entities
      .filter(e => (e.type === 'note' || e.type === 'workspace'))
      .filter(e => !q || e.title?.toLowerCase().includes(q))
      .slice(0, 50);
  }, [entities, query]);

  return (
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-72 p-2 rounded-xl bg-panel border border-[var(--bone-10)] shadow-lg">
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[var(--app-dark)] border border-[var(--bone-10)] mb-2">
        <Search className="w-3.5 h-3.5 text-[var(--bone-30)]" strokeWidth={2} />
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search notes & spaces…"
          className="flex-1 bg-transparent border-none outline-none text-[12px] text-foreground placeholder:text-[var(--bone-30)]"
        />
      </div>
      <div className="flex flex-col gap-[1px] max-h-48 overflow-y-auto">
        {candidates.map(e => (
          <button
            key={e.id}
            onClick={() => { onAddEntity(e.id, e.type === 'workspace' ? 'workspace' : 'entity'); onClose(); }}
            className="flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] hover:bg-[var(--app-dark)] text-left transition-colors"
          >
            {e.type === 'workspace' ? (
              <Folder className="w-3.5 h-3.5 text-[var(--bone-60)] shrink-0" strokeWidth={2} />
            ) : (
              <FileText className="w-3.5 h-3.5 text-[var(--bone-60)] shrink-0" strokeWidth={2} />
            )}
            <span className="truncate text-foreground">{e.title || 'Untitled'}</span>
          </button>
        ))}
        {candidates.length === 0 && (
          <p className="text-[11px] text-[var(--bone-30)] text-center py-3">No matches</p>
        )}
      </div>
    </div>
  );
}
