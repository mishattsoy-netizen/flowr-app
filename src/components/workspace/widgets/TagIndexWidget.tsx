import { useStore } from '@/data/store';
import { useMemo } from 'react';

export function TagIndexWidget() {
  const state = useStore();

  const tags = useMemo(() => {
    const tagCounts: Record<string, number> = {};

    state.entities.forEach(e => {
      e.tags?.forEach(t => tagCounts[t] = (tagCounts[t] || 0) + 1);
    });

    return Object.entries(tagCounts)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  }, [state.entities]);

  return (
    <div className="flex flex-col h-full bg-panel group/widget overflow-hidden widget-shadow transition-all">
      <div className="px-5 py-4 border-b border-[var(--bone-5)] flex items-center justify-between bg-[var(--color-panel)]/50 backdrop-blur-sm">
        <h3 className="font-widget-header text-[15px] font-semibold text-[var(--bone-70)]">Tag Index</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
        {tags.length === 0 ? (
          <div className="text-sm text-[var(--bone-70)]">No tags found.</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {tags.map(t => (
              <span
                key={t.tag}
                className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--bone-5)] text-foreground border border-[var(--bone-3)]"
                title={`${t.count} items`}
              >
                #{t.tag} <span className="ml-1 text-[var(--bone-70)]">({t.count})</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
