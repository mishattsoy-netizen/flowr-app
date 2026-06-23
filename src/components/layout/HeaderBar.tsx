"use client";

import { useStore } from '@/data/store';
import { getEntityIcon } from '@/data/icons';
import { 
  ArrowLeft, 
  ArrowRight, 
  RotateCw, 
  Star, 
  Link, 
  FolderInput, 
  Copy, 
  Pencil, 
  Trash2,
  LayoutDashboard,
  MessageSquare,
  Calendar,
  ListTodo,
  Type,
  Menu,
  Minus,
  X,
  ChevronRight,
  ChevronLeft,
  MoreHorizontal,
  Plus,
  Database,
  History,
  PanelLeft,
  FileText,
  Frame,
  Layers
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip } from './Tooltip';
import { Portal } from './Portal';
import { stripHtml } from '@/lib/utils';

// Constants
const POPUP_LEAVE_DELAY = 100; // ms to keep popup open when moving mouse

import { memo, useState, useRef } from 'react';

export const HeaderBar = memo(function HeaderBar() {
  const activeEntityId = useStore(state => state.activeEntityId);
  const entities = useStore(state => state.entities);
  const navigationHistory = useStore(state => state.navigationHistory);
  const historyIndex = useStore(state => state.historyIndex);
  const goBack = useStore(state => state.goBack);
  const goForward = useStore(state => state.goForward);
  const setActiveEntityId = useStore(state => state.setActiveEntityId);
  const favoriteIds = useStore(state => state.favoriteIds);
  const toggleFavorite = useStore(state => state.toggleFavorite);
  const openModal = useStore(state => state.openModal);
  const duplicateEntity = useStore(state => state.duplicateEntity);
  const editingEntity = useStore(state => state.editingEntity);
  const setEditingEntityId = useStore(state => state.setEditingEntityId);
  const renameEntity = useStore(state => state.renameEntity);
  const modal = useStore(state => state.modal);
  const contextMenu = useStore(state => state.contextMenu);
  const toggleToolbar = useStore(state => state.toggleToolbar);
  const isToolbarVisible = useStore(state => state.isToolbarVisible);
  const toggleSidebar = useStore(state => state.toggleSidebar);
  const openContextMenu = useStore(state => state.openContextMenu);
  const isFullWidth = useStore(state => state.isFullWidth);
  const toggleFullWidth = useStore(state => state.toggleFullWidth);
  const isTabsHeaderVisible = useStore(state => state.isTabsHeaderVisible);
  const openTabIds = useStore(state => state.openTabIds);
  const activeTabId = useStore(state => state.activeTabId);
  const setActiveTab = useStore(state => state.setActiveTab);
  const removeTab = useStore(state => state.removeTab);
  const addTab = useStore(state => state.addTab);
  const lastSaved = useStore(state => state.lastSaved);
  const cloudSyncEnabled = useStore(state => state.cloudSyncEnabled);
  const isTempChat = useStore(state => state.isTempChat);
  const chatConversations = useStore(state => state.chatConversations);
  const activeChatId = useStore(state => state.activeChatId);

  const canGoBack = true;
  const canGoForward = true;

  const [hoveredTab, setHoveredTab] = useState<{ id: string, rect: DOMRect, path: any[] } | null>(null);
  const leaveTimer = useRef<NodeJS.Timeout | null>(null);

  const handleTabMouseEnter = (e: React.MouseEvent, id: string, path: any[]) => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setHoveredTab({ id, rect, path });
  };

  const handleTabMouseLeave = () => {
    leaveTimer.current = setTimeout(() => {
      setHoveredTab(null);
    }, POPUP_LEAVE_DELAY);
  };

  const handlePopupMouseEnter = () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
  };

  const handlePopupMouseLeave = () => {
    setHoveredTab(null);
  };

  const isDashboard = activeEntityId === 'dashboard' || !activeEntityId;
  const isFavorite = activeEntityId ? favoriteIds.includes(activeEntityId) : false;

  const ACTIONS = [
    { id: 'favorite', icon: Star, label: isFavorite ? 'Unpin' : 'Pin', color: isFavorite ? 'text-accent fill-accent' : 'text-[var(--bone-100)] opacity-70 hover:opacity-100' },
    { id: 'layout', icon: Minus, label: isFullWidth ? 'Compact Layout' : 'Full Width Layout', color: isFullWidth ? 'text-accent' : 'text-[var(--bone-100)] opacity-70 hover:opacity-100' },
    { id: 'copy', icon: Link, label: 'Copy link', color: 'text-[var(--bone-100)] opacity-70 hover:opacity-100' },
    { id: 'move', icon: FolderInput, label: 'Move to...', color: 'text-[var(--bone-100)] opacity-70 hover:opacity-100' },
    { id: 'duplicate', icon: Copy, label: 'Duplicate', color: 'text-[var(--bone-100)] opacity-70 hover:opacity-100' },
    { id: 'rename', icon: Pencil, label: 'Rename', color: 'text-[var(--bone-100)] opacity-70 hover:opacity-100' },
    { id: 'toolbar', icon: Type, label: isToolbarVisible ? 'Hide Toolbar' : 'Show Toolbar', color: isToolbarVisible ? 'text-accent' : 'text-[var(--bone-100)] opacity-70 hover:opacity-100' },
    { id: 'delete', icon: Trash2, label: 'Delete', color: 'text-danger hover:text-danger' },
  ];

  const handleAction = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDashboard || !activeEntityId) return;

    switch (id) {
      case 'favorite': toggleFavorite(activeEntityId); break;
      case 'layout': toggleFullWidth(); break;
      case 'copy': 
        navigator.clipboard.writeText(`${window.location.origin}/entity/${activeEntityId}`);
        break;
      case 'move': openModal({ kind: 'moveTo', entityId: activeEntityId }); break;
      case 'duplicate': duplicateEntity(activeEntityId); break;
      case 'rename': setEditingEntityId(activeEntityId, 'view'); break;
      case 'toolbar': toggleToolbar(); break;
      case 'delete': openModal({ kind: 'deleteConfirm', entityId: activeEntityId }); break;
    }
  };

  // Build path for any entity
  const getPathForEntity = (id: string | null): { id: string; title: string; icon?: string }[] => {
    if (!id || id === 'dashboard') return [];
    if (id === 'chat') return [{ id: 'chat', title: 'Chat', icon: 'MessageSquare' }];
    if (id === 'tracker') return [{ id: 'tracker', title: 'Tasks', icon: 'ListTodo' }];
    
    const entity = entities.find(e => e.id === id);
    if (!entity) return [];

    const parts: { id: string; title: string; icon?: string }[] = [{ id: entity.id, title: entity.title, icon: entity.icon }];
    let current = entity;
    while (current.parentId) {
      const parent = entities.find(e => e.id === current.parentId);
      if (parent) {
        parts.unshift({ id: parent.id, title: parent.title, icon: parent.icon });
        current = parent;
      } else break;
    }
    return parts;
  };

  const btnClass = (enabled: boolean) =>
    `w-6 h-6 flex items-center justify-center rounded-[var(--radius-small)] transition-opacity duration-0 ${enabled
      ? 'text-[var(--bone-100)] opacity-70 hover:opacity-100 hover:bg-[var(--app-dark)] cursor-pointer'
      : 'text-border opacity-30 cursor-default'
    }`;

  if (!isTabsHeaderVisible) return null;
  if (activeEntityId === 'settings') return null;

  return (
    <div className="h-8 flex items-center px-3 bg-sidebar border-b border-b-[var(--bone-10)] shrink-0 relative z-30">
      <div className="flex items-center gap-1.5 shrink-0">
        <button 
          onClick={toggleSidebar}
          className="md:hidden p-1 rounded-[var(--radius-small)] hover:bg-hover text-[var(--bone-100)] opacity-70 hover:opacity-100"
        >
          {isDashboard ? (
            <Menu strokeWidth={2} className="w-5 h-5" />
          ) : (
            <ChevronLeft strokeWidth={2} className="w-5 h-5" />
          )}
        </button>

        <Tooltip content="Go Back">
          <button onClick={goBack} className={btnClass(true)}>
            <ArrowLeft strokeWidth={2} className="w-4 h-4" />
          </button>
        </Tooltip>
        <Tooltip content="Go Forward">
          <button onClick={goForward} className={btnClass(true)}>
            <ArrowRight strokeWidth={2} className="w-4 h-4" />
          </button>
        </Tooltip>
        <Tooltip content="Reload">
          <button onClick={() => { }} className={btnClass(true)}>
            <RotateCw strokeWidth={2} className="w-3.5 h-3.5" />
          </button>
        </Tooltip>
        <Tooltip content="Toggle Sidebar">
          <button
            onClick={toggleSidebar}
            onContextMenu={(e) => {
              e.preventDefault();
              openContextMenu('sidebar-toggle', e.clientX, e.clientY, 'sidebar-toggle');
            }}
            className={btnClass(true)}
          >
            <PanelLeft strokeWidth={2} className="w-4 h-4" />
          </button>
        </Tooltip>
      </div>

      {/* Divider (only if not dashboard or if we want it always) */}
      <div className="w-px h-5 bg-[var(--bone-6)] mx-2" />

      {/* Mobile Title View */}
      <div className="flex md:hidden flex-1 items-center px-1 min-w-0 font-semibold text-sm text-[var(--bone-100)] truncate">
        {isDashboard ? 'Home' : 
         activeEntityId === 'tracker' ? 'Tasks' :
         activeEntityId === 'chat' ? 'Chat' : 
         stripHtml(entities.find(e => e.id === activeEntityId)?.title || '')}
      </div>

      {/* Tabs */}
      <div className="hidden md:flex flex-1 items-center gap-1 h-full px-2 min-w-0">
        {openTabIds.map((tabId) => {
          const entity = entities.find(e => e.id === tabId);
          const isActive = activeTabId === tabId;
          
          let title = entity?.title;
          let Icon: any = null;

          if (tabId === 'dashboard') {
            title = 'Dashboard';
            Icon = LayoutDashboard;
          } else if (tabId === 'chat') {
            const activeConv = chatConversations.find(c => c.id === activeChatId);
            title = isTempChat ? 'Temporary Chat' : (activeConv?.title || 'Chat');
            Icon = MessageSquare;
          } else if (tabId === 'tracker') {
            title = 'Tasks';
            Icon = ListTodo;
          } else if (entity) {
            if (entity.icon) {
              Icon = getEntityIcon(entity.icon);
            } else {
              // Fallback based on entity type
              switch (entity.type) {
                case 'note': Icon = FileText; break;
                case 'canvas': Icon = Frame; break;
                case 'mixed': Icon = Layers; break;
                default: Icon = FileText;
              }
            }
          }

          if (!title && tabId !== 'dashboard' && tabId !== 'chat' && tabId !== 'tracker') return null;
          
          const path = getPathForEntity(tabId);

          return (
            <div
              key={tabId}
              onMouseEnter={(e) => handleTabMouseEnter(e, tabId, path)}
              onMouseLeave={handleTabMouseLeave}
              className="h-full flex items-center flex-shrink min-w-0"
            >
              <div
                onClick={() => setActiveTab(tabId)}
                className={cn(
                  "flex items-center gap-1 h-6 rounded-[var(--radius-small)] cursor-pointer select-none min-w-0 max-w-[160px] flex-shrink",
                  openTabIds.length > 1 ? "pl-2.5 pr-1" : "px-2.5",
                  isActive 
                    ? "bg-[var(--app-dark)] text-[var(--bone-100)]" 
                    : "text-[var(--bone-70)] hover:text-[var(--bone-100)] hover:bg-[var(--app-dark)]",
                  "group"
                )}
              >
                {Icon && <Icon strokeWidth={2} className={cn("w-3.5 h-3.5 shrink-0 text-[var(--bone-100)]", isActive ? "opacity-100" : "opacity-70 group-hover:opacity-100")} />}
                <span className="text-[13px] font-normal truncate flex-1 min-w-0 overflow-hidden whitespace-nowrap">{stripHtml(title || '')}</span>
                
                {openTabIds.length > 1 && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); removeTab(tabId); }}
                    className={cn(
                      "ml-0 opacity-0 group-hover:opacity-100 hover:bg-[var(--app-dark)] rounded-[4px] p-0.5 shrink-0",
                      isActive && tabId === 'dashboard' && "opacity-100" // Always show for active dashboard if closable
                    )}
                  >
                    <X strokeWidth={2} className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          );
        })}

        <Tooltip content="New Tab">
          <button 
            onClick={(e) => { e.stopPropagation(); addTab('dashboard'); }} 
            className="w-6 h-6 flex items-center justify-center rounded-[var(--radius-small)] text-[var(--bone-70)] hover:text-[var(--bone-100)] hover:bg-[var(--app-dark)] shrink-0 ml-1"
          >
            <Plus strokeWidth={2} className="w-3.5 h-3.5" />
          </button>
        </Tooltip>
      </div>

      {/* Interactive Path Popup */}
      {hoveredTab && hoveredTab.path.length > 0 && (
        <Portal>
          <div 
            onMouseEnter={handlePopupMouseEnter}
            onMouseLeave={handlePopupMouseLeave}
            className="fixed z-[9999] pt-1"
            style={{ 
              top: hoveredTab.rect.bottom,
              left: Math.max(8, hoveredTab.rect.left)
            }}
          >
            <div className="popup-glass-small backdrop-blur-xl p-1.5 min-w-[180px] flex flex-col gap-[3px]">
              <div className="flex flex-col gap-0.5">
                {hoveredTab.path.length > 1 && hoveredTab.path.slice(0, -1).map((p) => (
                  <button 
                    key={p.id} 
                    onClick={() => { setActiveEntityId(p.id); setHoveredTab(null); }}
                    className="popup-item"
                  >
                    {p.icon && (() => { const PIcon = getEntityIcon(p.icon); return <PIcon strokeWidth={2} className="w-4 h-4 shrink-0" />; })()}
                    <span className="text-fade flex-1 text-left">{stripHtml(p.title || '')}</span>
                    <ChevronRight strokeWidth={2} className="w-3.5 h-3.5 ml-auto opacity-30 group-hover:opacity-60" />
                  </button>
                ))}
                
                {hoveredTab.path.length > 1 && <div className="popup-divider" />}

                <div className="flex items-center gap-3 px-3 py-1.5 text-[13.5px] font-semibold text-[var(--bone-100)]">
                  {(() => { 
                    const last = hoveredTab.path[hoveredTab.path.length - 1];
                    let LastIcon: any = FileText;
                    
                    if (last.id === 'tracker') LastIcon = ListTodo;
                    else if (last.id === 'chat') LastIcon = MessageSquare;
                    else if (last.icon) LastIcon = getEntityIcon(last.icon);
                    else {
                      const entity = entities.find(e => e.id === last.id);
                      if (entity?.type === 'canvas') LastIcon = Frame;
                      else if (entity?.type === 'mixed') LastIcon = Layers;
                    }
                    
                    return <LastIcon strokeWidth={2} className="w-4 h-4 shrink-0" />;
                  })()}
                  <span className="text-fade flex-1 text-left">{stripHtml(hoveredTab.path[hoveredTab.path.length - 1].title || '')}</span>
                  {hoveredTab.path.length <= 1 && (
                    <span className="ml-auto text-[10px] font-normal opacity-40 uppercase tracking-widest font-sans">
                      {hoveredTab.id === 'dashboard' ? 'Dashboard' : 'Page'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* Save Status */}
      {(() => {
        const activeEntity = entities.find(e => e.id === activeEntityId);
        const isWorkspaceOrPage = activeEntity && ['workspace', 'folder', 'note', 'canvas', 'mixed'].includes(activeEntity.type);
        if (!isWorkspaceOrPage) return null;

        return (
          <div className="flex items-center gap-3 px-3 border-l border-[var(--bone-10)] h-5 text-[11px]">
            <div className="flex items-center gap-1.5 text-[var(--bone-40)]">
              <History strokeWidth={2} className="w-3 h-3" />
              <span>Last saved: {lastSaved ? new Date(lastSaved).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Never'}</span>
            </div>
          </div>
        );
      })()}

      {/* Right side actions — only for content pages (note / mixed / canvas) */}
      {(() => {
        const activeEntity = activeEntityId ? entities.find(e => e.id === activeEntityId) : null;
        const isContentPage = activeEntity && ['note', 'mixed', 'canvas'].includes(activeEntity.type);
        if (!isContentPage) return null;
        return (
          <>
            {/* Mobile Dropdown Trigger */}
            <div className="ml-auto flex md:hidden items-center">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  openContextMenu(activeEntityId, rect.left - 120, rect.bottom + 4, 'sidebar');
                }}
                className="w-6 h-6 flex items-center justify-center rounded-[var(--radius-small)] text-[var(--bone-70)] hover:text-[var(--bone-100)]"
              >
                <MoreHorizontal strokeWidth={2} className="w-4 h-4" />
              </button>
            </div>

            {/* Desktop Actions */}
            <div className="hidden md:flex ml-auto items-center gap-0.5">
              {ACTIONS.map(action => {
                const isNoteOrMixed = activeEntity.type === 'note' || activeEntity.type === 'mixed';
                if (action.id === 'layout' && !isNoteOrMixed) return null;

                return (
                  <Tooltip 
                    key={action.id} 
                    content={action.label}
                    disabled={!!modal || (contextMenu?.entityId === activeEntityId)}
                  >
                    <button
                      onClick={(e) => handleAction(action.id, e)}
                      className={cn(
                        "w-6 h-6 flex items-center justify-center rounded-[var(--radius-small)]  group",
                        action.color,
                        action.id === 'layout' && isFullWidth && "bg-accent/10"
                      )}
                    >
                        {action.id === 'layout' ? (
                          isFullWidth ? (
                            <div className="flex items-center justify-center -space-x-1.5 ">
                              <Minus strokeWidth={2} className="w-3.5 h-3.5 rotate-90 opacity-60 group-hover:opacity-100 " />
                            <Minus strokeWidth={2} className="w-3.5 h-3.5 rotate-90" />
                            <Minus strokeWidth={2} className="w-3.5 h-3.5 rotate-90 opacity-60 group-hover:opacity-100 " />
                          </div>
                        ) : (
                          <div className="flex items-center justify-center -space-x-0.5 ">
                            <Minus strokeWidth={2} className="w-3.5 h-3.5 rotate-90" />
                            <Minus strokeWidth={2} className="w-3.5 h-3.5 rotate-90" />
                          </div>
                          )
                        ) : (
                          <action.icon strokeWidth={2} className="w-4 h-4" />
                        )}
                    </button>
                  </Tooltip>
                );
              })}
            </div>
          </>
        );
      })()}
    </div>
  );
});


