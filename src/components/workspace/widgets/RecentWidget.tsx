"use client";

import { useStore } from '@/data/store';
import { getEntityIcon } from '@/data/icons';
import { Clock, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import clsx from 'clsx';
import type { EntityType } from '@/data/store.types';

function formatAge(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

type Filter = 'all' | 'note' | 'canvas';

export function RecentWidget({ data, onUpdateData }: { data?: { filter?: Filter }; onUpdateData?: (d: any) => void; isEditing?: boolean }) {
  const recentEntityIds = useStore(s => s.recentEntityIds);
  const entities = useStore(s => s.entities);
  const workspaces = useStore(s => s.workspaces);
  const setActiveEntityId = useStore(s => s.setActiveEntityId);
  const filter: Filter = data?.filter ?? 'all';

  const recentEntities = useMemo(() =>
    recentEntityIds.map(id => entities.find(e => e.id === id)).filter(Boolean)
      .filter(e => filter === 'all' || e!.type === filter),
    [recentEntityIds, entities, filter]
  );

  return (
    <section className="bg-sidebar border border-[var(--bone-3)] group/widget px-5 pb-5 pt-4 rounded-[var(--radius-big)] widget-shadow h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground group-hover/widget:text-accent transition-colors" />
          <h2 className="text-[15px] font-widget-header font-semibold text-muted-foreground group-hover/widget:text-foreground">Recent</h2>
        </div>
        {onUpdateData && (
          <div className="flex items-center gap-0.5 bg-[var(--bone-6)] rounded-[4px] p-0.5">
            {(['all', 'note', 'canvas'] as Filter[]).map(f => (
              <button key={f} onClick={() => onUpdateData({ ...data, filter: f })}
                className={clsx("px-2 py-0.5 text-[10px] font-semibold rounded-[3px] capitalize transition-colors",
                  filter === f ? "bg-[var(--bone-15)] text-[var(--bone-100)]" : "text-[var(--bone-30)] hover:text-[var(--bone-100)]")}>
                {f}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar space-y-1">
        {recentEntities.length > 0 ? recentEntities.map(entity => {
          if (!entity) return null;
          const Icon = getEntityIcon(entity.icon);
          const ws = entity.workspaceId ? workspaces.find(w => w.id === entity.workspaceId) : null;
          return (
            <button key={entity.id} onClick={() => setActiveEntityId(entity.id)}
              className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-[var(--bone-6)] transition-all group/item text-left">
              <div className="w-8 h-8 rounded-lg bg-[var(--bone-10)] border border-[var(--bone-3)] flex items-center justify-center text-[var(--bone-60)] group-hover/item:text-accent group-hover/item:border-accent/30 transition-all shadow-sm">
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-foreground truncate">{entity.title}</div>
                <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <span>{formatAge(entity.lastModified)} ago</span>
                  {ws && <><span>·</span><span className="truncate max-w-[80px]">{ws.name}</span></>}
                </div>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-[var(--bone-20)] opacity-0 group-hover/item:opacity-100 group-hover/item:translate-x-0.5 transition-all" />
            </button>
          );
        }) : (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-2 opacity-50">
            <Clock className="w-8 h-8 text-[var(--bone-20)]" />
            <p className="text-[11px] text-muted-foreground">No recent pages.</p>
          </div>
        )}
      </div>
    </section>
  );
}
