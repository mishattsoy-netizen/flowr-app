"use client";

import { useState, useMemo, useRef, useEffect, useCallback, type ReactNode } from 'react';
import { Search, FileText, Folder, Brain, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip } from '@/components/layout/Tooltip';
import type { NodeDisplayInfo } from './BrainNodeCard';

export interface BrainSearchItem {
  id: string;
  title: string;
  typeLabel: string;
  preview?: string;
  isMemory?: boolean;
  isWorkspace?: boolean;
  typeIcon?: ReactNode;
}

interface Props {
  nodes: BrainSearchItem[];
  onSelect: (nodeId: string) => void;
  onClose: () => void;
}

export function BrainNodeSearchPopover({ nodes, onSelect, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  // Only keyboard ↑↓ should scroll the list — hover must not call scrollIntoView
  // or partially visible top/bottom rows jump the list under the cursor.
  const scrollHighlightIntoView = useCallback((idx: number) => {
    const root = listRef.current;
    if (!root) return;
    const row = root.querySelector<HTMLElement>(`[data-idx="${idx}"]`);
    row?.scrollIntoView({ block: 'nearest' });
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const matches = useMemo(() => {
    const q = query.toLowerCase().trim();
    const list = !q
      ? nodes
      : nodes.filter(n => {
          const hay = [
            n.title,
            n.typeLabel,
            n.preview ?? '',
          ].join(' ').toLowerCase();
          return hay.includes(q);
        });
    // Stable sort: title match first when querying, else alpha by title.
    return list
      .slice()
      .sort((a, b) => {
        if (q) {
          const aTitle = (a.title || '').toLowerCase().startsWith(q) ? 0 : 1;
          const bTitle = (b.title || '').toLowerCase().startsWith(q) ? 0 : 1;
          if (aTitle !== bTitle) return aTitle - bTitle;
        }
        return (a.title || '').localeCompare(b.title || '');
      })
      .slice(0, 50);
  }, [nodes, query]);

  // Keep highlight in range when the list changes.
  useEffect(() => {
    setHighlight(h => (matches.length === 0 ? 0 : Math.min(h, matches.length - 1)));
  }, [matches.length]);

  useEffect(() => {
    setHighlight(0);
  }, [query]);

  const pick = useCallback((id: string) => {
    onSelect(id);
    onClose();
  }, [onSelect, onClose]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (matches.length === 0) return;
      setHighlight(h => {
        const next = (h + 1) % matches.length;
        // Defer so the row exists with the new highlight class if needed.
        requestAnimationFrame(() => scrollHighlightIntoView(next));
        return next;
      });
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (matches.length === 0) return;
      setHighlight(h => {
        const next = (h - 1 + matches.length) % matches.length;
        requestAnimationFrame(() => scrollHighlightIntoView(next));
        return next;
      });
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const item = matches[highlight];
      if (item) pick(item.id);
    }
  };

  return (
    <div
      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-80 p-2 rounded-xl bg-panel border border-[var(--bone-10)] shadow-lg pointer-events-auto canvas-floating-panel"
      onPointerDown={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
      onKeyDown={onKeyDown}
    >
      {/* Match Settings modal search field chrome. */}
      <div className="relative mb-2">
        <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
          <Search className="w-[14px] h-[14px] text-[var(--bone-100)] opacity-70" strokeWidth={2} />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search nodes in this brain…"
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
      <div
        ref={listRef}
        className="flex flex-col gap-[1px] max-h-56 overflow-y-auto"
        // Track pointer over rows even if enter is missed (e.g. after scroll).
        onPointerMove={e => {
          const row = (e.target as HTMLElement).closest<HTMLElement>('[data-idx]');
          if (!row) return;
          const idx = Number(row.dataset.idx);
          if (!Number.isFinite(idx) || idx === highlight) return;
          setHighlight(idx);
        }}
      >
        {matches.map((n, idx) => {
          const Icon = n.isMemory
            ? Brain
            : n.isWorkspace
              ? Folder
              : FileText;
          const active = idx === highlight;
          return (
            <button
              key={n.id}
              type="button"
              data-idx={idx}
              onPointerEnter={() => setHighlight(idx)}
              onClick={() => pick(n.id)}
              className={
                active
                  ? 'flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] text-left bg-[var(--app-dark)] text-foreground cursor-pointer'
                  : 'flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] text-left hover:bg-[var(--app-dark)] text-foreground cursor-pointer'
              }
            >
              {n.typeIcon ? (
                <span className="w-3.5 h-3.5 shrink-0 text-[var(--bone-100)] opacity-60 pointer-events-none [&>svg]:w-3.5 [&>svg]:h-3.5 flex items-center justify-center">
                  {n.typeIcon}
                </span>
              ) : (
                <Icon className="w-3.5 h-3.5 text-[var(--bone-100)] opacity-60 shrink-0 pointer-events-none" strokeWidth={2} />
              )}
              <span className="min-w-0 flex-1 pointer-events-none">
                <span className="block truncate font-medium">{n.title || 'Untitled'}</span>
                <span className="block truncate text-[10px] text-[var(--bone-60)]">
                  {n.typeLabel}
                  {n.preview ? ` · ${n.preview}` : ''}
                </span>
              </span>
            </button>
          );
        })}
        {matches.length === 0 && (
          <p className="text-[11px] text-[var(--bone-30)] text-center py-3">
            {nodes.length === 0 ? 'No nodes in this brain' : 'No matches'}
          </p>
        )}
      </div>
      <p className="text-[10px] text-[var(--bone-30)] px-1 pt-1.5">
        ↑↓ navigate · Enter select · Esc close
      </p>
    </div>
  );
}

/** Map canvas node display info into search rows. */
export function toSearchItems(
  activeNodes: { id: string; type: string }[],
  nodeInfos: Map<string, NodeDisplayInfo>,
): BrainSearchItem[] {
  return activeNodes.map(n => {
    const info = nodeInfos.get(n.id);
    return {
      id: n.id,
      title: info?.title ?? 'Untitled',
      typeLabel: info?.isMemory
        ? 'Memory'
        : info?.variant === 'workspace'
          ? 'Workspace'
          : (info?.typeLabel ?? 'Note'),
      preview: info?.preview,
      isMemory: info?.isMemory,
      isWorkspace: info?.variant === 'workspace' || n.type === 'workspace',
      typeIcon: info?.typeIcon,
    };
  });
}
