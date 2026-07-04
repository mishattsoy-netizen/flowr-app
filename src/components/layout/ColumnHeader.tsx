"use client";

import { useStore } from '@/data/store';
import { getEntityIcon } from '@/data/icons';
import { X, Columns2, Pin, FileText, Frame, LayoutDashboard, MessageSquare, ListTodo } from 'lucide-react';
import { cn } from '@/lib/utils';
import { stripHtml } from '@/lib/utils';
import { isDesktop } from '@/lib/env';

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

  const { title, Icon } = getTitleAndIcon(entityId, entities, chatConversations, activeChatId, isTempChat);

  // Empty column — minimal header with just border
  if (!entityId) {
    return (
      <div
        className="w-full flex items-center shrink-0 relative z-10 bg-sidebar"
        style={{ height: BAR_H, paddingLeft: 8, paddingRight: 8 }}
      >
        <div className="absolute inset-x-0 bottom-0 h-[1px] bg-[var(--bone-10)] z-0" />
        {/* Right-side controls */}
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
      </div>
    );
  }

  return (
    <div
      className="w-full flex items-center shrink-0 relative z-10 bg-sidebar"
      style={{ height: BAR_H, paddingLeft: 8, paddingRight: 8 }}
    >
      {/* Bottom border line */}
      <div className="absolute inset-x-0 bottom-0 h-[1px] bg-[var(--bone-10)] z-0" />

      {/* Entity icon + title */}
      <div className="flex items-center gap-[5px] min-w-0 z-10" style={{ paddingLeft: 10 }}>
        {Icon && (
          <Icon strokeWidth={2} className="w-3.5 h-3.5 shrink-0 text-[var(--bone-100)] opacity-90" />
        )}
        <span
          className="font-medium text-[var(--bone-100)] truncate"
          style={{ fontSize: 13, lineHeight: 1 }}
        >
          {stripHtml(title || '')}
        </span>
      </div>

      {/* Right-side controls */}
      <div className="flex items-center gap-1 shrink-0 ml-auto z-10" style={{ height: BAR_H }}>
        {/* Close entity button */}
        <button
          onClick={() => { removeTab(entityId); }}
          className="flex items-center justify-center text-[var(--bone-100)] rounded-[6px] shrink-0 opacity-60 hover:opacity-100 hover:bg-[var(--bone-12)]"
          style={{ width: 24, height: 24 }}
          title="Close"
        >
          <X strokeWidth={2.5} className="w-3.5 h-3.5" />
        </button>

        {/* Pin button — only on right column header */}
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

        {/* Exit split view — only on right column header */}
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
    </div>
  );
}

export default ColumnHeader;
