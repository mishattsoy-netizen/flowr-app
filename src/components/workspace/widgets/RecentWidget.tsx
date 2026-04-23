"use client";

import { useStore } from '@/data/store';
import { getEntityIcon } from '@/data/icons';
import { Clock, ChevronRight } from 'lucide-react';

function formatDistanceToNow(date: number) {
  const diff = Date.now() - date;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

export function RecentWidget() {
  const recentEntityIds = useStore(state => state.recentEntityIds);
  const entities = useStore(state => state.entities);
  const setActiveEntityId = useStore(state => state.setActiveEntityId);

  const recentEntities = recentEntityIds
    .map(id => entities.find(e => e.id === id))
    .filter(Boolean);

  return (
    <section className="bg-sidebar border border-[var(--bone-10)] group/widget px-5 pb-5 pt-4 rounded-[var(--radius-big)] widget-shadow h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground group-hover/widget:text-accent transition-colors" />
          <h2 className="text-[15px] font-widget-header font-semibold text-muted-foreground group-hover/widget:text-foreground">
            Recent Pages
          </h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar space-y-1">
        {recentEntities.length > 0 ? (
          recentEntities.map((entity) => {
            if (!entity) return null;
            const Icon = getEntityIcon(entity.icon);
            
            return (
              <button
                key={entity.id}
                onClick={() => setActiveEntityId(entity.id)}
                className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-[var(--bone-6)] transition-all group/item text-left"
              >
                <div className="w-8 h-8 rounded-lg bg-[var(--bone-10)] border border-[var(--bone-10)] flex items-center justify-center text-[var(--bone-60)] group-hover/item:text-accent group-hover/item:border-accent/30 transition-all shadow-sm">
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-foreground truncate">{entity.title}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(entity.lastModified)} ago
                  </div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-[var(--bone-20)] opacity-0 group-hover/item:opacity-100 group-hover/item:translate-x-0.5 transition-all" />
              </button>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-2 opacity-50">
            <Clock className="w-8 h-8 text-[var(--bone-20)]" />
            <p className="text-[11px] text-muted-foreground">No recent pages yet.</p>
          </div>
        )}
      </div>
    </section>
  );
}
