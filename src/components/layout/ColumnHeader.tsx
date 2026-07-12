"use client";

import { useState } from 'react';
import { useStore, generateId } from '@/data/store';
import { getEntityIcon } from '@/data/icons';
import { X, Columns2, Pin, ArrowLeftRight, FileText, Frame, Folder, Home, MessageCircle, ListTodo, BookOpen, Pencil, MoreVertical, Plus, Search, PanelLeft } from 'lucide-react';
import { cn, stripHtml } from '@/lib/utils';
import { isDesktop } from '@/lib/env';
import { Tooltip } from '@/components/layout/Tooltip';
import { Portal } from '@/components/layout/Portal';

// ─── Concave corner SVG (same as HeaderBar) ──────────────────────────────────
function ConcaveCorner({ side, r = 12 }: { side: 'left' | 'right'; r?: number }) {
  const overlap = 1;
  const size = r + overlap;
  
  return (
    <div
      className="absolute z-10 pointer-events-none overflow-hidden"
      style={{
        bottom: 0,
        [side === 'left' ? 'left' : 'right']: -r,
        width: size,
        height: size,
      }}
    >
      <div
        className="absolute w-[200%] h-[200%]"
        style={{
          bottom: 0,
          [side === 'left' ? 'right' : 'left']: 0,
          [side === 'left' ? 'borderBottomRightRadius' : 'borderBottomLeftRadius']: size,
          borderBottom: '1px solid color-mix(in srgb, var(--bone-100) 10%, var(--app-background))',
          [side === 'left' ? 'borderRight' : 'borderLeft']: '1px solid color-mix(in srgb, var(--bone-100) 10%, var(--app-background))',
          boxShadow: `0 0 0 100px var(--app-background)`,
        }}
      />
    </div>
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
  if (!entityId || entityId === 'dashboard') return { title: 'Home', Icon: Home };
  if (entityId === 'chat') {
    const ac = chatConversations.find(c => c.id === activeChatId);
    return { title: isTempChat ? 'Temporary Chat' : (ac?.title || 'Chat'), Icon: MessageCircle };
  }
  if (entityId === 'tracker') return { title: 'Tasks', Icon: ListTodo };
  const entity = entities.find(e => e.id === entityId);
  if (entity) {
    const Icon = entity.icon ? getEntityIcon(entity.icon) : entity.type === 'canvas' ? Frame : entity.type === 'folder' ? Folder : FileText;
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
  const swapColumns = useStore(s => s.swapColumns);
  const splitViewLeftId = useStore(s => s.splitViewLeftId);
  const splitViewRightId = useStore(s => s.splitViewRightId);
  const setColumnEntity = useStore(s => s.setColumnEntity);
  const addEntity = useStore(s => s.addEntity);

  const isReadMode = useStore(s => !!s.readModeStates[entityId || '']);
  const setReadMode = useStore(s => s.setReadMode);
  
  const isSidebarCollapsed = useStore(s => s.isSidebarCollapsed);
  const toggleCommandPalette = useStore(s => s.toggleCommandPalette);
  const toggleSidebar = useStore(s => s.toggleSidebar);

  const [newItemPopup, setNewItemPopup] = useState<{ x: number; y: number } | null>(null);

  const isDesktopEnv = isDesktop();

  const BAR_H = 42;
  const M = 6;
  const R_ACTIVE = 12;
  const R_INACTIVE = 8;

  const { title, Icon } = getTitleAndIcon(entityId, entities, chatConversations, activeChatId, isTempChat);

  return (
    <div
      className="w-full flex items-center shrink-0 relative z-10 bg-sidebar"
      style={{ height: BAR_H, paddingLeft: (entityId === 'dashboard' || entityId === 'tracker') ? 16 : 8, paddingRight: 12 }}
    >
      {/* Single continuous bottom border across the ENTIRE header (matches
          HeaderBar's approach). The active tab's app-background fill + concave
          corners paint over it, cutting the line cleanly under the tab. */}
      <div
        className="absolute inset-x-0 bottom-0 h-[1px] pointer-events-none z-0"
        style={{ backgroundColor: 'color-mix(in srgb, var(--bone-100) 10%, var(--app-background))' }}
      />

      {/* Row content — items-center so buttons + tab text share the bar's
          vertical center (y = BAR_H/2), identical to HeaderBar. */}
      <div className="flex items-center w-full relative z-10" style={{ height: BAR_H, gap: M }}>
        {!isDesktopEnv && column === 'left' && isSidebarCollapsed && (
          <>
            <button
              onClick={() => toggleCommandPalette()}
              className="flex items-center justify-center w-7 h-7 rounded-[var(--radius-medium)] text-[var(--bone-100)] opacity-70 hover:opacity-100 hover:bg-[var(--bone-6)] transition-colors cursor-pointer z-20 shrink-0"
            >
              <Search className="w-4 h-4" />
            </button>
            <button
              onClick={toggleSidebar}
              className="flex items-center justify-center w-7 h-7 rounded-[var(--radius-medium)] text-[var(--bone-100)] opacity-70 hover:opacity-100 hover:bg-[var(--bone-6)] transition-colors cursor-pointer z-20 shrink-0"
            >
              <PanelLeft className="w-4 h-4" />
            </button>
            <div className="w-[1px] h-4 bg-[var(--bone-10)] shrink-0" />
          </>
        )}
      {entityId ? (
        <>
          {/* Options Menu Button */}
          {entityId !== 'dashboard' && entityId !== 'chat' && entityId !== 'tracker' && (
            <Tooltip content="More Options">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  useStore.getState().openContextMenu(entityId, rect.left, rect.bottom + 6, 'tab');
                }}
                className="flex items-center justify-center w-7 h-7 rounded-[var(--radius-medium)] text-[var(--bone-100)] opacity-70 hover:opacity-100 hover:bg-[var(--bone-6)] transition-colors cursor-pointer z-20 shrink-0"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
            </Tooltip>
          )}

          {/* Read/Edit toggle inside ColumnHeader */}
          {entities.find(e => e.id === entityId)?.type === 'note' && (
            <Tooltip content={isReadMode ? "Switch to Edit Mode" : "Switch to Reading Mode"}>
              <button
                onClick={e => { e.stopPropagation(); setReadMode(entityId, !isReadMode); }}
                className="flex items-center justify-center w-7 h-7 rounded-[var(--radius-medium)] text-[var(--bone-100)] opacity-70 hover:opacity-100 hover:bg-[var(--bone-6)] transition-colors cursor-pointer z-20 shrink-0"
              >
                {isReadMode ? (
                  <BookOpen className="w-4 h-4" />
                ) : (
                  <Pencil className="w-4 h-4" />
                )}
              </button>
            </Tooltip>
          )}

          {/* ── Tab pill — identical to HeaderBar's StaticTabPill ── */}
          <Tooltip content={stripHtml(title || '')} position="bottom">
            <div
              className="relative flex-shrink min-w-0 max-w-[200px]"
              style={{ height: BAR_H, zIndex: 20 }}
            >
            {/* Tab background */}
            <div
              className="absolute inset-x-0 top-[6px] bottom-0"
            >
              <div
                className="absolute inset-0 bg-[var(--app-background)]"
                style={{ borderRadius: `${R_INACTIVE}px ${R_INACTIVE}px 0 0` }}
              />
              <div
                className="absolute inset-0 border-t border-l border-r pointer-events-none"
                style={{
                  borderColor: 'color-mix(in srgb, var(--bone-100) 10%, var(--app-background))',
                  borderRadius: `${R_INACTIVE}px ${R_INACTIVE}px 0 0`,
                  WebkitMaskImage: `linear-gradient(to bottom, black calc(100% - ${R_ACTIVE + 1}px), transparent calc(100% - ${R_ACTIVE + 1}px))`,
                  maskImage: `linear-gradient(to bottom, black calc(100% - ${R_ACTIVE + 1}px), transparent calc(100% - ${R_ACTIVE + 1}px))`
                }}
              />
              <ConcaveCorner side="left"  r={R_ACTIVE} />
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
                onClick={e => {
                  e.stopPropagation();
                  if ((column === 'left' && !splitViewRightId) || (column === 'right' && !splitViewLeftId)) {
                    toggleSplitView();
                  } else {
                    removeTab(entityId);
                  }
                }}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 hover:bg-[var(--bone-12)] rounded-[3px] flex items-center justify-center shrink-0 opacity-50 hover:opacity-100"
                style={{ width: 18, height: 18 }}
              >
                <X strokeWidth={2.5} className="w-3 h-3" />
              </button>
            </div>
          </div>
          </Tooltip>

          {/* New Entity Button (next to active tab) */}
          <Tooltip content="New Entity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (newItemPopup) {
                  setNewItemPopup(null);
                  return;
                }
                const rect = e.currentTarget.getBoundingClientRect();
                setNewItemPopup({ x: rect.left, y: rect.bottom + 6 });
              }}
              className={cn(
                "flex items-center justify-center w-7 h-7 ml-[6px] rounded-[var(--radius-medium)] text-[var(--bone-100)] transition-colors shrink-0",
                newItemPopup ? "opacity-100 bg-[var(--bone-6)]" : "opacity-50 hover:opacity-100 hover:bg-[var(--bone-6)]"
              )}
            >
              <Plus strokeWidth={2.5} className="w-4 h-4" />
            </button>
          </Tooltip>

          {/* Spacer */}
          <div className="flex-1 min-w-0" />

          {/* ── Right-side controls ── */}
          <div className="flex items-center gap-1 shrink-0 z-10">
            {column === 'right' && !['dashboard', 'chat', 'tracker'].includes(splitViewLeftId || '') && !['dashboard', 'chat', 'tracker'].includes(splitViewRightId || '') && (
              <Tooltip content={splitViewPinned ? "Unpin pair" : "Pin pair"}>
                <button
                  onClick={e => { e.stopPropagation(); togglePin(); }}
                  className={cn(
                    "flex items-center justify-center text-[var(--bone-100)] rounded-[6px] shrink-0 z-10",
                    splitViewPinned
                      ? "bg-[var(--bone-10)]"
                      : "hover:bg-[var(--bone-6)]"
                  )}
                  style={{ width: 28, height: 28 }}
                >
                  <Pin
                    strokeWidth={2}
                    className="w-4 h-4"
                    fill={splitViewPinned ? "currentColor" : "none"}
                  />
                </button>
              </Tooltip>
            )}
            {column === 'right' && (
              <Tooltip content="Swap columns">
                <button
                  onClick={e => { e.stopPropagation(); swapColumns(); }}
                  className="flex items-center justify-center text-[var(--bone-100)] rounded-[6px] shrink-0 hover:bg-[var(--bone-6)] z-10"
                  style={{ width: 28, height: 28 }}
                >
                  <ArrowLeftRight strokeWidth={2} className="w-4 h-4" />
                </button>
              </Tooltip>
            )}
            {column === 'right' && (
              <Tooltip content="Exit split view">
                <button
                  onClick={e => { e.stopPropagation(); toggleSplitView(); }}
                  className="flex items-center justify-center text-[var(--bone-100)] rounded-[6px] shrink-0 bg-[var(--bone-6)] hover:bg-[var(--bone-12)] z-10"
                  style={{ width: 28, height: 28 }}
                >
                  <Columns2 strokeWidth={2} className="w-4 h-4" />
                </button>
              </Tooltip>
            )}
          </div>
        </>
      ) : (
        <>
          {/* Empty column controls - Left side */}
          <Tooltip content="New Entity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (newItemPopup) {
                  setNewItemPopup(null);
                  return;
                }
                const rect = e.currentTarget.getBoundingClientRect();
                setNewItemPopup({ x: rect.left, y: rect.bottom + 6 });
              }}
              className={cn(
                "flex items-center justify-center w-7 h-7 ml-[6px] rounded-[var(--radius-medium)] text-[var(--bone-100)] transition-colors shrink-0",
                newItemPopup ? "opacity-100 bg-[var(--bone-6)]" : "opacity-50 hover:opacity-100 hover:bg-[var(--bone-6)]"
              )}
            >
              <Plus strokeWidth={2.5} className="w-4 h-4" />
            </button>
          </Tooltip>

          {/* Spacer */}
          <div className="flex-1 min-w-0" />

          {/* Right side controls */}
          <div className="flex items-center gap-1 shrink-0 ml-auto z-10">
            {column === 'right' && (
              <Tooltip content="Exit split view">
                <button
                  onClick={e => { e.stopPropagation(); toggleSplitView(); }}
                  className="flex items-center justify-center text-[var(--bone-100)] rounded-[6px] shrink-0 bg-[var(--bone-6)] hover:bg-[var(--bone-12)]"
                  style={{ width: 28, height: 28 }}
                >
                  <Columns2 strokeWidth={2} className="w-4 h-4" />
                </button>
              </Tooltip>
            )}
          </div>
        </>
      )}
      </div>


      {/* New-item popup */}
      {newItemPopup && (
        <Portal>
          <div className="fixed inset-0 z-[9998]" onClick={() => setNewItemPopup(null)} />
          <div
            className="fixed z-[9999] popup-glass-small min-w-[160px] p-1 flex flex-col gap-[2px] [-webkit-app-region:no-drag]"
            style={{ left: newItemPopup.x, top: newItemPopup.y }}
          >
            {([
              { type: 'note' as const, label: 'Note', icon: FileText },
              { type: 'canvas' as const, label: 'Canvas', icon: Frame },
            ] as const).map(opt => (
              <button
                key={opt.type}
                onClick={() => {
                  const newId = generateId();
                  addEntity({
                    id: newId,
                    title: `Untitled ${opt.label}`,
                    type: opt.type,
                    parentId: null,
                    lastModified: Date.now(),
                  });
                  setColumnEntity(column, newId);
                  setNewItemPopup(null);
                }}
                className="popup-item group w-full flex items-center gap-2 px-3 text-sm transition-none"
              >
                <opt.icon strokeWidth={2} className="w-4 h-4 shrink-0 text-[var(--bone-100)] opacity-70 group-hover:opacity-100" />
                <span className="flex-1 text-left font-medium tracking-wide">{opt.label}</span>
              </button>
            ))}
          </div>
        </Portal>
      )}
    </div>
  );
}

export default ColumnHeader;
