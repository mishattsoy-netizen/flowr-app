"use client";

import { useStore } from '@/data/store';
import { getEntityIcon } from '@/data/icons';
import { Search, List, GitBranch } from 'lucide-react';
import { useMemo, useState } from 'react';
import clsx from 'clsx';

type SortBy = 'modified' | 'name';
type ViewMode = 'flat' | 'tree';

export function AllFilesWidget({ data, onUpdateData, contextId }: { data?: { sort?: SortBy; view?: ViewMode }; onUpdateData?: (d: any) => void; contextId?: string; isEditing?: boolean }) {
  const entities = useStore(s => s.entities);
  const setActiveEntityId = useStore(s => s.setActiveEntityId);
  const [search, setSearch] = useState('');
  const sort: SortBy = data?.sort ?? 'modified';
  const view: ViewMode = data?.view ?? 'flat';

  const filtered = useMemo(() => {
    const notes = entities.filter(e => ['note', 'canvas', 'collection', 'folder'].includes(e.type));
    const q = search.toLowerCase();
    const searched = q ? notes.filter(e => e.title.toLowerCase().includes(q)) : notes;
    return [...searched].sort((a, b) => sort === 'name' ? a.title.localeCompare(b.title) : b.lastModified - a.lastModified);
  }, [entities, search, sort]);

  const rootItems = useMemo(() => filtered.filter(e => !e.parentId || !filtered.find(p => p.id === e.parentId)), [filtered]);

  const renderItem = (entity: typeof filtered[0], depth = 0): React.ReactNode => {
    const Icon = getEntityIcon(entity.icon);
    const children = view === 'tree' ? filtered.filter(e => e.parentId === entity.id) : [];
    return (
      <div key={entity.id}>
        <button onClick={() => setActiveEntityId(entity.id)} style={{ paddingLeft: `${8 + depth * 16}px` }}
          className="w-full flex items-center gap-2 pr-2 py-1.5 rounded-[var(--radius-medium)] hover:bg-[var(--bone-6)] transition-all group/item text-left">
          <Icon className="w-3.5 h-3.5 text-[var(--bone-40)] group-hover/item:text-accent shrink-0 transition-colors" />
          <span className="text-sm text-foreground truncate flex-1">{entity.title || 'Untitled'}</span>
        </button>
        {children.map(c => renderItem(c, depth + 1))}
      </div>
    );
  };

  return (
    <section className="bg-sidebar border border-[var(--bone-3)] group/widget px-4 pb-4 pt-4 rounded-[var(--radius-big)] widget-shadow h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[15px] font-widget-header font-semibold text-muted-foreground group-hover/widget:text-foreground">All Files</h2>
        {onUpdateData && (
          <div className="flex items-center gap-1">
            <select value={sort} onChange={e => onUpdateData({ ...data, sort: e.target.value as SortBy })}
              className="text-[10px] bg-[var(--bone-6)] border-none rounded-[4px] px-1.5 py-0.5 text-[var(--bone-60)] outline-none">
              <option value="modified">Modified</option>
              <option value="name">Name</option>
            </select>
            <button onClick={() => onUpdateData({ ...data, view: view === 'flat' ? 'tree' : 'flat' })}
              className={clsx("w-6 h-6 flex items-center justify-center rounded-[4px] transition-colors",
                view === 'tree' ? "bg-[var(--bone-15)] text-[var(--bone-100)]" : "text-[var(--bone-30)] hover:text-[var(--bone-100)]")}>
              {view === 'tree' ? <GitBranch className="w-3.5 h-3.5" /> : <List className="w-3.5 h-3.5" />}
            </button>
          </div>
        )}
      </div>
      <div className="relative mb-2">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--bone-30)]" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter..."
          className="w-full pl-7 pr-3 py-1.5 bg-[var(--bone-5)] border border-[var(--bone-3)] rounded-[var(--radius-small)] text-sm text-foreground placeholder-muted-foreground outline-none focus:border-[var(--bone-20)]" />
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {(view === 'flat' ? filtered : rootItems).map(e => renderItem(e))}
        {filtered.length === 0 && <div className="flex items-center justify-center h-16"><p className="text-sm text-muted-foreground">No files found.</p></div>}
      </div>
    </section>
  );
}
