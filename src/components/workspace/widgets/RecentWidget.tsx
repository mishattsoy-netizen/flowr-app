"use client";
 
import { useStore, Entity } from '@/data/store';
import { getEntityIcon } from '@/data/icons';
import { Clock, ChevronRight, FileText, Frame, Layers, Folder } from 'lucide-react';
import { useMemo, useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import type { EntityType } from '@/data/store.types';
import type { WidgetProps } from './types';
import { stripHtml } from '@/lib/utils';
 
function formatAge(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}
 
type Filter = 'all' | 'note' | 'canvas';
 
const ALL_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'note', label: 'Note' },
  { id: 'canvas', label: 'Canvas' },
] as const;
 
export function RecentWidget({ data, onUpdateData, contextId }: WidgetProps & { data?: { filter?: Filter } }) {
  const recentEntityIds = useStore(s => s.recentEntityIds);
  const entities = useStore(s => s.entities);
  const workspaces = useStore(s => s.workspaces);
  const setActiveEntityId = useStore(s => s.setActiveEntityId);
  const openModal = useStore(s => s.openModal);
  const filter: Filter = data?.filter ?? 'all';
 
  const recentEntities = useMemo(() => {
    let list = recentEntityIds.map(id => entities.find(e => e.id === id)).filter((e): e is Entity => !!e);
    if (contextId && contextId !== 'dashboard') {
      // Exclude workspaces and collections inside a specific workspace dashboard to avoid self-listing
      list = list.filter(e => e.type !== 'workspace' && e.type !== 'collection');
      
      list = list.filter(e => {
        let curr: Entity | undefined = e;
        const visited = new Set<string>();
        while (curr) {
          if (curr.id === contextId) return true;
          if (curr.workspaceId === contextId) return true;
          if (curr.parentId) {
            if (visited.has(curr.parentId)) break;
            visited.add(curr.parentId);
            const parentEntityId: string = curr.parentId;
            curr = entities.find(p => p.id === parentEntityId);
          } else {
            break;
          }
        }
        return false;
      });
    }
    return list.filter(e => filter === 'all' || e.type === filter);
  }, [recentEntityIds, entities, filter, contextId]);
 
  const tabContainerRef = useRef<HTMLDivElement>(null);
  const [pillStyle, setPillStyle] = useState({ left: 3, width: 40 });
 
  useEffect(() => {
    if (!tabContainerRef.current) return;
    const measure = () => {
      const activeEl = tabContainerRef.current?.querySelector('[data-active="true"]') as HTMLElement;
      if (activeEl) {
        const next = { left: activeEl.offsetLeft, width: activeEl.offsetWidth };
        setPillStyle(prev =>
          prev.left === next.left && prev.width === next.width ? prev : next
        );
      }
    };
 
    measure();
    window.addEventListener('resize', measure);
 
    const observer = new ResizeObserver(measure);
    observer.observe(tabContainerRef.current);
 
    return () => {
      window.removeEventListener('resize', measure);
      observer.disconnect();
    };
  }, [filter]);
 
  return (
    <section className="bg-panel group/widget px-5 pb-5 pt-4 widget-shadow h-full flex flex-col">
      <div className="flex items-center justify-between mb-4 h-8 shrink-0 gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-[15px] font-widget-header font-semibold text-muted-foreground">Recent</h2>
        </div>
        {onUpdateData && (
          <div ref={tabContainerRef} className="relative flex items-center p-[3px] rounded-[8px] no-drag overflow-hidden w-fit" style={{ background: 'var(--slider-track)' }}>
            {/* Sliding pill */}
            <div
              className="absolute top-[3px] bottom-[3px] rounded-[6px] bg-[var(--slider-pill)] transition-all duration-300 ease-out"
              style={{
                left: `${pillStyle.left}px`,
                width: `${pillStyle.width}px`,
                boxShadow: 'var(--slider-pill-shadow)'
              }}
            />
            {ALL_FILTERS.map(f => (
              <div
                key={f.id}
                data-active={filter === f.id ? "true" : undefined}
                className="relative z-10 flex items-center justify-center px-3 group/tab shrink-0"
              >
                <button
                  onClick={() => onUpdateData({ ...data, filter: f.id })}
                  className={cn(
                    "flex items-center justify-center py-0.5 transition-colors duration-200 ease-in-out",
                    filter === f.id ? "text-[var(--bone-100)]" : "text-muted-foreground hover:text-[var(--bone-100)]"
                  )}
                >
                  <span className="text-[11px] font-semibold">{f.label}</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
 
      <div className="flex-1 overflow-y-auto no-scrollbar space-y-1">
        {recentEntities.length > 0 ? recentEntities.map(entity => {
          if (!entity) return null;
          const Icon = entity.icon ? getEntityIcon(entity.icon) : (() => {
            if (entity.type === 'note') return FileText;
            if (entity.type === 'canvas') return Frame;
            if (entity.type === 'mixed') return Layers;
            return Folder;
          })();
          const ws = entity.workspaceId ? workspaces.find(w => w.id === entity.workspaceId) : null;
          return (
            <button key={entity.id} onClick={() => setActiveEntityId(entity.id)}
              className="w-full flex items-center gap-2 px-3 py-1.5 rounded-[10px] text-[var(--bone-70)] hover:text-[var(--bone-100)] hover:bg-[var(--app-dark)] transition-all duration-200 ease-in-out group/item text-left text-[14px]">
              <div className="w-4 shrink-0 flex items-center justify-center text-[var(--bone-100)] opacity-30 group-hover/item:opacity-100 transition-opacity duration-200 ease-in-out">
                <Icon strokeWidth={2} className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] leading-snug truncate text-[var(--bone-100)]">{stripHtml(entity.title || '')}</div>
                <div className="text-[10px] text-[var(--bone-30)] flex items-center gap-1">
                  <span>{formatAge(entity.lastModified)} ago</span>
                  {ws && <><span>·</span><span className="truncate max-w-[80px]">{ws.name}</span></>}
                </div>
              </div>
              <ChevronRight strokeWidth={2} className="w-3.5 h-3.5 text-[var(--bone-30)] opacity-0 group-hover/item:opacity-100 group-hover/item:translate-x-0.5 transition-all duration-200 ease-in-out" />
            </button>
          );
        }) : (
          <div className="h-full flex flex-col items-center justify-center gap-3 p-4 bg-white/[0.01] rounded-[12px] min-h-[140px] transition-all duration-300">
            <div className="text-center max-w-[320px]">
              <p className="text-base font-semibold text-bone-100 opacity-40">No recent activities</p>
              <p className="text-xs text-bone-70 opacity-25 mt-1 leading-snug text-balance">Pages you create or edit will show up here for quick access.</p>
            </div>
            <button
              onClick={() => openModal({ kind: 'newItem' })}
              className="mt-2 flex items-center gap-1 px-3.5 py-2 rounded-[8px] bg-[var(--bone-5)] text-[var(--bone-70)] hover:bg-[var(--bone-10)] hover:text-[var(--bone-100)] text-xs font-medium transition-all duration-300"
            >
              + New Item
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
