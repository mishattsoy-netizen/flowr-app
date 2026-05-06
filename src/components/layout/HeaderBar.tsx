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
  Type,
  Menu,
  Minus,
  X,
  ChevronRight,
  Plus,
  Cloud,
  CloudOff,
  Database,
  History
} from 'lucide-react';
import clsx from 'clsx';
import { Tooltip } from './Tooltip';
import { Portal } from './Portal';
import { Toggle } from '@/components/ui/Toggle';

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
  const isFullWidth = useStore(state => state.isFullWidth);
  const toggleFullWidth = useStore(state => state.toggleFullWidth);
  const openTabIds = useStore(state => state.openTabIds);
  const activeTabId = useStore(state => state.activeTabId);
  const setActiveTab = useStore(state => state.setActiveTab);
  const removeTab = useStore(state => state.removeTab);
  const addTab = useStore(state => state.addTab);
  const lastSaved = useStore(state => state.lastSaved);
  const cloudSyncEnabled = useStore(state => state.cloudSyncEnabled);
  const setCloudSyncEnabled = useStore(state => state.setCloudSyncEnabled);

  const canGoBack = historyIndex > 0;
  const canGoForward = historyIndex < navigationHistory.length - 1;

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
    { id: 'favorite', icon: Star, label: isFavorite ? 'Unpin' : 'Pin', color: isFavorite ? 'text-accent fill-accent' : 'text-[var(--bone-60)] hover:text-[var(--bone-100)]' },
    { id: 'layout', icon: Minus, label: isFullWidth ? 'Compact Layout' : 'Full Width Layout', color: isFullWidth ? 'text-accent' : 'text-[var(--bone-60)] hover:text-[var(--bone-100)]' },
    { id: 'copy', icon: Link, label: 'Copy link', color: 'text-[var(--bone-60)] hover:text-[var(--bone-100)]' },
    { id: 'move', icon: FolderInput, label: 'Move to...', color: 'text-[var(--bone-60)] hover:text-[var(--bone-100)]' },
    { id: 'duplicate', icon: Copy, label: 'Duplicate', color: 'text-[var(--bone-60)] hover:text-[var(--bone-100)]' },
    { id: 'rename', icon: Pencil, label: 'Rename', color: 'text-[var(--bone-60)] hover:text-[var(--bone-100)]' },
    { id: 'toolbar', icon: Type, label: isToolbarVisible ? 'Hide Toolbar' : 'Show Toolbar', color: isToolbarVisible ? 'text-accent' : 'text-[var(--bone-60)] hover:text-[var(--bone-100)]' },
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
    if (id === 'tracker') return [{ id: 'tracker', title: 'Tracker', icon: 'Columns' }];
    
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
    `w-6 h-6 flex items-center justify-center rounded-[var(--radius-small)] ${enabled
      ? 'text-[var(--bone-60)] hover:text-[var(--bone-100)] hover:bg-[var(--bone-6)] cursor-pointer'
      : 'text-border cursor-default'
    }`;

  return (
    <div className="h-8 flex items-center px-3 bg-sidebar border-b border-b-[var(--bone-6)] shrink-0 relative z-30">
      {/* Left Nav Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <button 
          onClick={toggleSidebar}
          className="md:hidden p-1.5 rounded-[var(--radius-small)] hover:bg-hover text-muted-foreground hover:text-foreground  mr-1"
        >
          <Menu strokeWidth={2} className="w-5 h-5" />
        </button>

        <Tooltip content="Go Back (Alt+Left)">
          <button onClick={goBack} disabled={!canGoBack} className={btnClass(canGoBack)}>
            <ArrowLeft strokeWidth={2} className="w-4 h-4" />
          </button>
        </Tooltip>
        <Tooltip content="Go Forward">
          <button onClick={goForward} disabled={!canGoForward} className={btnClass(canGoForward)}>
            <ArrowRight strokeWidth={2} className="w-4 h-4" />
          </button>
        </Tooltip>
      </div>

      {/* Reload & Dashboard Controls */}
      <div className="flex items-center gap-1.5 shrink-0 ml-1">
        <Tooltip content="Reload">
          <button onClick={() => { }} className={btnClass(true)}>
            <RotateCw strokeWidth={2} className="w-3.5 h-3.5" />
          </button>
        </Tooltip>

      </div>

      {/* Divider (only if not dashboard or if we want it always) */}
      <div className="w-px h-5 bg-[var(--bone-6)] mx-3" />

      {/* Tabs */}
      <div className="flex-1 flex items-center gap-1 overflow-x-auto scrollbar-none h-full px-2">
        {openTabIds.map((tabId) => {
          const entity = entities.find(e => e.id === tabId);
          if (!entity && tabId !== 'dashboard') return null;
          
          const title = tabId === 'dashboard' ? 'Dashboard' : entity?.title;
          const icon = tabId === 'dashboard' ? 'LayoutDashboard' : entity?.icon;
          const isActive = activeTabId === tabId;
          const Icon = icon ? getEntityIcon(icon) : null;
          const path = getPathForEntity(tabId);

          return (
            <div
              key={tabId}
              onMouseEnter={(e) => handleTabMouseEnter(e, tabId, path)}
              onMouseLeave={handleTabMouseLeave}
              className="h-full flex items-center"
            >
              <div
                onClick={() => setActiveTab(tabId)}
                className={clsx(
                  "flex items-center gap-1.5 h-6 rounded-[var(--radius-small)] cursor-pointer transition-all select-none min-w-0 max-w-[160px] flex-shrink flex-grow-0",
                  openTabIds.length > 1 ? "pl-2.5 pr-1" : "px-2.5",
                  isActive 
                    ? "bg-[var(--bone-6)] text-[var(--bone-100)]" 
                    : "text-[var(--bone-60)] hover:text-[var(--bone-100)] hover:bg-[var(--bone-6)]",
                  "group"
                )}
              >
                {Icon && <Icon strokeWidth={2} className={clsx("w-3.5 h-3.5 shrink-0", isActive ? "text-[var(--bone-100)]" : "text-[var(--bone-60)] group-hover:text-[var(--bone-100)]")} />}
                <span className="text-[13px] font-medium truncate flex-1 min-w-0 overflow-hidden whitespace-nowrap">{title}</span>
                
                {openTabIds.length > 1 && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); removeTab(tabId); }}
                    className={clsx(
                      "ml-0.5 opacity-0 group-hover:opacity-100 hover:bg-[var(--bone-10)] rounded-[4px] p-0.5 transition-all",
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
            className="w-6 h-6 flex items-center justify-center rounded-[var(--radius-small)] text-[var(--bone-60)] hover:text-[var(--bone-100)] hover:bg-[var(--bone-6)] shrink-0 ml-1"
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
            <div className="bg-panel/95 backdrop-blur-xl border border-border/50 rounded-xl shadow-2xl p-1.5 min-w-[180px] animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="flex flex-col gap-0.5">
                {hoveredTab.path.length > 1 && hoveredTab.path.slice(0, -1).map((p) => (
                  <button 
                    key={p.id} 
                    onClick={() => { setActiveEntityId(p.id); setHoveredTab(null); }}
                    className="flex items-center gap-2 text-[11px] text-[var(--bone-60)] hover:text-[var(--bone-100)] hover:bg-[var(--bone-6)] px-2 py-1.5 rounded-md transition-colors group/item"
                  >
                    {p.icon && (() => { const PIcon = getEntityIcon(p.icon); return <PIcon strokeWidth={2} className="w-3.5 h-3.5 opacity-60 group-hover/item:opacity-100" />; })()}
                    <span className="text-fade">{p.title}</span>
                    <ChevronRight strokeWidth={2} className="w-3 h-3 ml-auto opacity-20 group-hover/item:opacity-40" />
                  </button>
                ))}
                
                {hoveredTab.path.length > 1 && <div className="h-px bg-border/50 my-1 mx-1" />}
                
                <div className="flex items-center gap-2 text-[11px] font-semibold text-[var(--bone-100)] px-2 py-1.5">
                  {(() => { 
                    const last = hoveredTab.path[hoveredTab.path.length - 1];
                    const LastIcon = last.id === 'tracker' ? getEntityIcon('Columns') : (last.icon ? getEntityIcon(last.icon) : (entities.find(e => e.id === last.id)?.type === 'canvas' ? getEntityIcon('Frame') : getEntityIcon('FileText')));
                    return <LastIcon strokeWidth={2} className="w-3.5 h-3.5" />;
                  })()}
                  <span className="text-fade">{hoveredTab.path[hoveredTab.path.length - 1].title}</span>
                  {hoveredTab.path.length <= 1 && (
                    <span className="ml-auto text-[10px] font-normal opacity-40">
                      {hoveredTab.id === 'dashboard' ? 'Dashboard' : 'Page'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* Save Status & Cloud Toggle */}
      {(() => {
        const activeEntity = entities.find(e => e.id === activeEntityId);
        const isWorkspaceOrPage = activeEntity && ['workspace', 'folder', 'note', 'canvas', 'mixed'].includes(activeEntity.type);
        if (!isWorkspaceOrPage) return null;

        return (
          <div className="flex items-center gap-3 px-3 border-l border-[var(--bone-6)] h-5 text-[11px]">
            <div className="flex items-center gap-1.5 text-[var(--bone-40)]">
              <History strokeWidth={2} className="w-3 h-3" />
              <span>Last saved: {lastSaved ? new Date(lastSaved).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Never'}</span>
            </div>

            <div className="flex items-center gap-2 pl-3 border-l border-[var(--bone-6)] h-full">
              <button 
                onClick={() => setCloudSyncEnabled(!cloudSyncEnabled)}
                className={clsx(
                  "flex items-center gap-1.5 px-2 py-0.5 rounded-full transition-all border",
                  cloudSyncEnabled 
                    ? "bg-accent/10 border-accent/20 text-accent" 
                    : "bg-[var(--bone-6)] border-[var(--bone-10)] text-[var(--bone-40)] hover:text-[var(--bone-100)]"
                )}
              >
                {cloudSyncEnabled ? <Cloud strokeWidth={2} className="w-3 h-3" /> : <CloudOff strokeWidth={2} className="w-3 h-3" />}
                <span className="font-medium">{cloudSyncEnabled ? 'Cloud Sync' : 'Local Only'}</span>
                <Toggle 
                  size="sm"
                  checked={cloudSyncEnabled}
                  onChange={() => {}}
                  className="pointer-events-none scale-75 origin-right"
                />
              </button>
            </div>
          </div>
        );
      })()}

      {/* Right side actions */}
      {!isDashboard && (
        <div className="ml-auto flex items-center gap-0.5">
          {ACTIONS.map(action => {
            const isNoteOrMixed = entities.find(e => e.id === activeEntityId)?.type === 'note' || entities.find(e => e.id === activeEntityId)?.type === 'mixed';
            if (action.id === 'layout' && !isNoteOrMixed) return null;

            return (
              <Tooltip 
                key={action.id} 
                content={action.label}
                disabled={!!modal || (contextMenu?.entityId === activeEntityId)}
              >
                <button
                  onClick={(e) => handleAction(action.id, e)}
                  className={clsx(
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
                      <action.icon strokeWidth={2} className={`w-4 h-4 ${action.id === 'favorite' && isFavorite ? 'animate-bounce-once' : ''}`} />
                    )}
                </button>
              </Tooltip>
            );
          })}
        </div>
      )}
    </div>
  );
});


