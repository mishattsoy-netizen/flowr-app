"use client";

import { useState, useRef } from 'react';
import { Plus, ExternalLink, X, GripVertical } from 'lucide-react';
import clsx from 'clsx';

interface QuickLink { id: string; label: string; url: string; }

interface QLData { links?: QuickLink[]; compact?: boolean; }

export function QuickLinksWidget({ data, onUpdateData }: { data?: QLData; onUpdateData: (d: QLData) => void; isEditing?: boolean }) {
  const links = data?.links ?? [];
  const compact = data?.compact ?? false;
  const [isAdding, setIsAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const dragIdx = useRef<number | null>(null);

  const handleAdd = () => {
    if (!newUrl.trim()) return;
    const label = newLabel.trim() || (() => { try { return new URL(newUrl.trim()).hostname; } catch { return newUrl.trim(); } })();
    onUpdateData({ ...data, links: [...links, { id: `ql-${Date.now()}`, label, url: newUrl.trim() }] });
    setNewLabel(''); setNewUrl(''); setIsAdding(false);
  };

  const handleRemove = (id: string) => onUpdateData({ ...data, links: links.filter(l => l.id !== id) });

  const handleDragStart = (idx: number) => { dragIdx.current = idx; };
  const handleDrop = (targetIdx: number) => {
    if (dragIdx.current === null || dragIdx.current === targetIdx) return;
    const reordered = [...links];
    const [moved] = reordered.splice(dragIdx.current, 1);
    reordered.splice(targetIdx, 0, moved);
    onUpdateData({ ...data, links: reordered });
    dragIdx.current = null;
  };

  const faviconUrl = (url: string) => {
    try { return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=32`; } catch { return null; }
  };

  return (
    <section className="bg-sidebar border border-[var(--bone-3)] group/widget px-5 pb-5 pt-4 rounded-[var(--radius-big)] widget-shadow h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[15px] font-widget-header font-semibold text-muted-foreground group-hover/widget:text-foreground">Quick Links</h2>
        <div className="flex items-center gap-1">
          <button onClick={() => onUpdateData({ ...data, compact: !compact })}
            className={clsx("px-2 py-0.5 text-[10px] font-semibold rounded-[4px] transition-colors", compact ? "bg-[var(--bone-15)] text-[var(--bone-100)]" : "text-[var(--bone-30)] hover:text-[var(--bone-100)]")}>
            {compact ? 'Icons' : 'List'}
          </button>
          <button onClick={() => setIsAdding(true)} className="w-6 h-6 flex items-center justify-center rounded-[var(--radius-small)] text-[var(--bone-30)] hover:text-[var(--bone-100)] hover:bg-[var(--bone-6)]">
            <Plus strokeWidth={2} className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin space-y-1">
        {links.map((link, idx) => {
          const favicon = faviconUrl(link.url);
          return (
            <div key={link.id} draggable onDragStart={() => handleDragStart(idx)} onDragOver={e => e.preventDefault()} onDrop={() => handleDrop(idx)}
              className={clsx("group/link flex items-center gap-2 px-2 py-1.5 rounded-[var(--radius-medium)] hover:bg-[var(--bone-6)] cursor-grab", compact && "justify-center")}>
              <GripVertical className="w-3 h-3 text-[var(--bone-15)] shrink-0 opacity-0 group-hover/link:opacity-100" />
              {favicon ? (
                <img src={favicon} alt="" className="w-4 h-4 rounded-sm shrink-0" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              ) : (
                <ExternalLink className="w-3.5 h-3.5 text-[var(--bone-30)] shrink-0" />
              )}
              {!compact && (
                <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-sm text-foreground hover:underline truncate flex-1">{link.label}</a>
              )}
              <button onClick={() => handleRemove(link.id)} className="opacity-0 group-hover/link:opacity-100 w-5 h-5 flex items-center justify-center rounded text-[var(--bone-30)] hover:text-red-400 hover:bg-red-400/10 transition-all">
                <X strokeWidth={2} className="w-3 h-3" />
              </button>
            </div>
          );
        })}

        {links.length === 0 && !isAdding && (
          <div className="h-full flex items-center justify-center"><p className="text-sm text-muted-foreground">No links added.</p></div>
        )}

        {isAdding && (
          <div className="space-y-2 p-2 border border-[var(--bone-3)] rounded-[var(--radius-medium)]">
            <input autoFocus placeholder="Label (auto-detected if empty)" value={newLabel} onChange={e => setNewLabel(e.target.value)}
              className="w-full bg-transparent border border-[var(--bone-5)] rounded-[var(--radius-medium)] px-2.5 py-1.5 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-[var(--bone-30)]" />
            <input placeholder="https://..." value={newUrl} onChange={e => setNewUrl(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setIsAdding(false); }}
              className="w-full bg-transparent border border-[var(--bone-5)] rounded-[var(--radius-medium)] px-2.5 py-1.5 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-[var(--bone-30)]" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setIsAdding(false)} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
              <button onClick={handleAdd} className="text-xs text-accent font-medium hover:opacity-80">Add</button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
