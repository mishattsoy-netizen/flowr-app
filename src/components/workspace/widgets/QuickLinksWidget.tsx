"use client";

import { useState } from 'react';
import { Plus, ExternalLink, X } from 'lucide-react';

interface QuickLink {
  id: string;
  label: string;
  url: string;
}

export function QuickLinksWidget({ data, onUpdateData }: { data?: any; onUpdateData: (newData: any) => void }) {
  const links = (data?.links || []) as QuickLink[];
  const [isAdding, setIsAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newUrl, setNewUrl] = useState('');

  const handleAdd = () => {
    if (!newLabel.trim() || !newUrl.trim()) return;
    const newLinks = [...links, { id: `ql-${Date.now()}`, label: newLabel.trim(), url: newUrl.trim() }];
    onUpdateData({ links: newLinks });
    setNewLabel('');
    setNewUrl('');
    setIsAdding(false);
  };

  const handleRemove = (id: string) => {
    const newLinks = links.filter(l => l.id !== id);
    onUpdateData({ links: newLinks });
  };

  return (
    <section className="bg-sidebar border border-[var(--bone-10)] group/widget px-5 pb-5 pt-4 rounded-[var(--radius-big)] widget-shadow h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[15px] font-widget-header font-semibold text-muted-foreground group-hover/widget:text-foreground mb-4">
          Quick Links
        </h2>
        <button
          onClick={() => setIsAdding(true)}
          className="w-6 h-6 flex items-center justify-center rounded-[var(--radius-small)] text-[var(--bone-30)] hover:text-[var(--bone-100)] hover:bg-[var(--bone-6)]"
        >
          <Plus strokeWidth={2} className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin space-y-1">
        {links.map(link => (
          <div key={link.id} className="group/link flex items-center gap-2 px-2 py-1.5 rounded-[var(--radius-medium)] hover:bg-[var(--bone-6)] ">
            <ExternalLink className="w-3.5 h-3.5 text-[var(--bone-30)] shrink-0" />
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-foreground hover:underline truncate flex-1"
            >
              {link.label}
            </a>
            <button
              onClick={() => handleRemove(link.id)}
              className="opacity-0 group-hover/link:opacity-100 w-6 h-6 flex items-center justify-center rounded-[var(--radius-small)] text-[var(--bone-30)] group-hover/link:text-[var(--bone-60)] hover:text-[var(--bone-100)] hover:bg-[var(--bone-6)]"
            >
              <X strokeWidth={2} className="w-3 h-3" />
            </button>
          </div>
        ))}

        {links.length === 0 && !isAdding && (
          <div className="h-full flex items-center justify-center">
            <p className="text-sm text-muted-foreground">No links added.</p>
          </div>
        )}

        {isAdding && (
          <div className="space-y-2 p-2 border border-[var(--bone-10)] rounded-[var(--radius-medium)]">
            <input
              autoFocus
              placeholder="Label"
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              className="w-full bg-transparent border border-[var(--bone-5)] rounded-[var(--radius-medium)] px-2.5 py-1.5 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-[var(--bone-30)]"
            />
            <input
              placeholder="https://..."
              value={newUrl}
              onChange={e => setNewUrl(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setIsAdding(false); }}
              className="w-full bg-transparent border border-[var(--bone-5)] rounded-[var(--radius-medium)] px-2.5 py-1.5 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-[var(--bone-30)]"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setIsAdding(false)} className="text-xs text-muted-foreground hover:text-foreground ">Cancel</button>
              <button onClick={handleAdd} className="text-xs text-accent font-medium hover:opacity-80 ">Add</button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

