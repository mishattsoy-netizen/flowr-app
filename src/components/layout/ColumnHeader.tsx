"use client";

import { useStore } from '@/data/store';
import { getEntityIcon } from '@/data/icons';
import { X, Columns2, Pin, FileText, Frame, LayoutDashboard, MessageSquare, ListTodo } from 'lucide-react';
import { cn } from '@/lib/utils';
import { stripHtml } from '@/lib/utils';
import { isDesktop } from '@/lib/env';

// ─── Concave corner SVG (same as HeaderBar) ──────────────────────────────────
function ConcaveCorner({ side, r = 8 }: { side: 'left' | 'right'; r?: number }) {
  const w = r + 1, h = r + 1;
  const fill   = side === 'left'
    ? `M${w},0 Q${w},${h} 0,${h} L${w},${h} Z`
    : `M0,0 Q0,${h} ${w},${h} L0,${h} Z`;
  const stroke = side === 'left'
    ? `M${w},0 Q${w},${h} 0,${h}`
    : `M0,0 Q0,${h} ${w},${h}`;
  return (
    <svg
      width={w} height={h} viewBox={`0 0 ${w} ${h}`}
      style={{
        position: 'absolute', bottom: 0,
        [side === 'left' ? 'left' : 'right']: -w,
        pointerEvents: 'none', zIndex: 11,
      }}
    >
      <path d={fill}   fill="var(--app-background)" />
      <path d={stroke} stroke="var(--bone-10)" strokeWidth="1" fill="none" />
    </svg>
  );
}

interface ColumnHeaderProps {
  column: 'left' | 'right';
  entityId: string | null; // null = empty column
}

function getTitleAndIcon(
  entityId: string | null,
  entities: ReturnType<typeof useStore.getState>['entities'],
  chatConversations: ReturnType<typeof useStore.getState>['chatConversations'],
  activeChatId: string | null,
  isTempChat: boolean,
) {
  if (!entityId || entityId === 'dashboard') return { title: 'Dashboard', Icon: LayoutDashboard };
  if (entityId === 'chat') {
    const ac = chatConversations.find(c => c.id === activeChatId);
    return { title: isTempChat ? 'Temporary Chat' : (ac?.title || 'Chat'), Icon: MessageSquare };
  }
  if (entityId === 'tracker') return { title: 'Tasks', Icon: ListTodo };
  const entity = entities.find(e => e.id === entityId);
  if (entity) {
    const Icon = entity.icon ? getEntityIcon(entity.icon) : entity.type === 'canvas' ? Frame : FileText;
    return { title: entity.title, Icon };
  }
  return { title: null, Icon: null };
}

export function ColumnHeader({ column, entityId }: ColumnHeaderProps) {
  const entities = useStore(s => s.entities);
  const chatConversations = useStore(s => s.chatConversations);
  const activeChatId = useStore(s => s.activeChatId);
  const isTempChat = useStore(s => s.isTempChat);
  const removeTab = useStore(s => s.removeTab);
  const toggleSplitView = useStore(s => s.toggleSplitView);
  const splitViewPinned = useStore(s => s.splitViewPinned);
  const togglePin = useStore(s => s.togglePin);

  const isDesktopEnv = isDesktop();
  const BAR_H = isDesktopEnv ? 38 : 42;
  const M = 6;
  const R_ACTIVE = 12;
  const R_INACTIVE = 8;

  const { title, Icon } = getTitleAndIcon(entityId, entities, chatConversations, activeChatId, isTempChat);

  return (
    <div
      className="w-full flex items-center shrink-0 relative z-10 bg-sidebar"
      style={{ height: BAR_H, paddingLeft: 8, paddingRight: 8 }}
    >
      {/* Bottom border line */}
      <div className="absolute inset-x-0 bottom-0 h-[1px] bg-[var(--bone-10)] z-0" />

      {entityId ? (
        <>
          {/* ── Tab pill — same visual style as HeaderBar active tab ── */}
          <div
            className="relative flex-shrink min-w-0 max-w-[200px]"
            style={{ height: BAR_H, zIndex: 20 }}
          >
            {/* Tab background */}
            <div
              className="absolute inset-x-0 top-[6px] bottom-0 bg-[var(--app-background)] border-t border-l border-r border-[var(--bone-10)]"
              style={{ borderRadius: `${R_INACTIVE}px ${R_INACTIVE}px 0 0` }}
            >
              <ConcaveCorner side="left" r={R_ACTIVE} />
              <ConcaveCorner side="right" r={R_ACTIVE} />
            </div>

            {/* Content */}
            <div
              className="relative z-10 w-full h-full flex items-center gap-[5px]"
              style={{ paddingLeft: 12, paddingRight: 28 }}
            >
              {Icon && (
                <Icon strokeWidth={2} style={{ width: 14, height: 14, flexShrink: 0 }}
                  className="text-[var(--bone-100)] opacity-90"
                />
              )}
              <span
                className="flex-1 min-w-0 font-medium text-[var(--bone-100)] truncate"
                style={{ fontSize: 13, lineHeight: 1 }}
              >
                {stripHtml(title || '')}
              </span>
              {/* X close button — inside the tab, same as HeaderBar */}
              <button
                onClick={e => { e.stopPropagation(); removeTab(entityId); }}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 hover:bg-[var(--bone-12)] rounded-[3px] flex items-center justify-center shrink-0 opacity-50 hover:opacity-100"
                style={{ width: 18, height: 18 }}
              >
                <X strokeWidth={2.5} className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Spacer */}
          <div className="flex-1 min-w-0" />

          {/* ── Right-side controls ── */}
          <div className="flex items-center gap-1 shrink-0 z-10" style={{ height: BAR_H }}>
            {column === 'right' && (
              <button
                onClick={e => { e.stopPropagation(); togglePin(); }}
                className={cn(
                  "flex items-center justify-center text-[var(--bone-100)] rounded-[10px] shrink-0",
                  splitViewPinned
                    ? "bg-[var(--bone-10)]"
                    : "hover:bg-[var(--bone-6)]"
                )}
                style={{ width: 28, height: 28 }}
                title={splitViewPinned ? "Unpin pair" : "Pin pair"}
              >
                <Pin
                  strokeWidth={2}
                  className="w-4 h-4"
                  fill={splitViewPinned ? "currentColor" : "none"}
                />
              </button>
            )}
            {column === 'right' && (
              <button
                onClick={e => { e.stopPropagation(); toggleSplitView(); }}
                className="flex items-center justify-center text-[var(--bone-100)] rounded-[10px] shrink-0 bg-[var(--bone-6)] hover:bg-[var(--bone-12)]"
                style={{ width: 28, height: 28 }}
                title="Exit split view"
              >
                <Columns2 strokeWidth={2} className="w-4 h-4" />
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          {/* Empty column — just right-side exit button */}
          {column === 'right' && (
            <div className="flex items-center gap-1 shrink-0 ml-auto z-10" style={{ height: BAR_H }}>
              <button
                onClick={e => { e.stopPropagation(); toggleSplitView(); }}
                className="flex items-center justify-center text-[var(--bone-100)] rounded-[10px] shrink-0 bg-[var(--bone-6)] hover:bg-[var(--bone-12)]"
                style={{ width: 28, height: 28 }}
                title="Exit split view"
              >
                <Columns2 strokeWidth={2} className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default ColumnHeader;
