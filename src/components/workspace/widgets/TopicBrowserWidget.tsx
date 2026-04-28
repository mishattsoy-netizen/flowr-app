"use client";

import { useStore } from '@/data/store';
import { getEntityIcon } from '@/data/icons';

export function TopicBrowserWidget() {
  const entities = useStore(state => state.entities);
  const topics = entities.filter(e => e.type === 'folder');
  const setActiveEntityId = useStore(state => state.setActiveEntityId);

  return (
    <div className="w-full h-full p-5 bg-sidebar rounded-[var(--radius-big)] border border-[var(--bone-3)] group/widget flex flex-col">
      <h3 className="text-[15px] font-widget-header font-semibold text-muted-foreground group-hover/widget:text-foreground mb-4">Topic Browser</h3>
      <div className="flex-1 overflow-y-auto min-h-0 -mx-2 px-2 scrollbar-thin">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {topics.map(topic => {
            const Icon = getEntityIcon(topic.icon);
            return (
              <button
                key={topic.id}
                onClick={() => setActiveEntityId(topic.id)}
                className="flex flex-col items-center justify-center p-4 rounded-xl border border-[var(--bone-3)] bg-[var(--bone-5)] hover:bg-[var(--bone-6)] hover:border-accent/30 transition-colors group"
              >
                <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <Icon className="w-6 h-6 text-accent" />
                </div>
                <span className="font-medium text-sm text-center mb-1">{topic.title}</span>
                <span className="text-xs text-muted-foreground">Items</span>
              </button>
            );
          })}
          {topics.length === 0 && (
            <div className="col-span-full text-center text-muted-foreground text-sm py-8">
              No topics created yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
