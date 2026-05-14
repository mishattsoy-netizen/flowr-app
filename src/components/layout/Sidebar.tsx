"use client";

import { useStore } from '@/data/store';
import type { EntityType, Entity, SidebarSectionId } from '@/data/store';
import { getDescendantIds } from '@/data/store.helpers';
import { getEntityIcon } from '@/data/icons';

import { Search, LayoutDashboard, Star, ChevronRight, ChevronDown, Moon, Plus, ChevronLeft, Folder, Sun, X, FileText, Frame, Layers, MoreHorizontal, Settings, Columns, GripVertical, Activity, ListTodo, ChevronsUpDown, MessageSquare, Calendar, Clock, Trash2, Pencil, ExternalLink } from 'lucide-react';
import { Toggle } from '../ui/Toggle';
import { cn } from '@/lib/utils';
import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useDeferredLoading } from '@/hooks/use-deferred-loading';
import { TreeItem } from './TreeItem';
import { Tooltip } from './Tooltip';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import { SidebarSkeleton } from './SidebarSkeleton';
import { ChatHistorySkeleton } from '../chat/ChatSkeleton';
import React from 'react';
import { stripHtml } from '@/lib/utils';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  rectIntersection,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';
import { useDroppable } from '@dnd-kit/core';

function DroppableZone({ id, children, className }: { id: string, children: React.ReactNode, className?: string }) {
  const { setNodeRef } = useDroppable({ id });
  return <div ref={setNodeRef} className={className}>{children}</div>;
}

const LogoSimple = ({ className }: { className?: string }) => (
  <svg width="39" height="39" viewBox="0 0 39 39" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path fillRule="evenodd" clipRule="evenodd" d="M29.9302 39H9.06977L8.9525 38.9993C4.03648 38.937 0.063001 34.9635 0.000708576 30.0475L0 29.9302V9.06977C0 4.06067 4.06067 1.38779e-07 9.06977 0H29.9302C34.9393 0 39 4.06067 39 9.06977V29.9302C39 34.9002 35.0026 38.9365 30.0475 38.9993L29.9302 39ZM24.1066 15.9808L23.7628 23.7174C23.7628 26.3798 22.6382 28.9779 20.5522 31.064L14.9561 36.2791H29.9302C33.4366 36.2791 36.2791 33.4366 36.2791 29.9302V9.06977C36.2791 8.08478 36.0548 7.15218 35.6544 6.32027L35.5436 6.35738C33.2742 7.11717 30.99 7.88195 28.8924 8.89124C25.9704 10.2972 24.2398 13.0277 24.1066 15.9808ZM16.3045 18.0338L16.7254 13.687C17.0538 10.2965 19.4868 7.35444 23.0273 6.06642L32.4536 3.24217C31.6802 2.90682 30.8269 2.72093 29.9302 2.72093H9.06977C5.5634 2.72093 2.72093 5.5634 2.72093 9.06977V27.2509L8.39919 26.1046C12.7272 25.2308 15.9235 21.9676 16.3045 18.0338Z" fill="#E09952" />
  </svg>
);

export const Sidebar = React.memo(function Sidebar({ forceFull, initialEntityId }: { forceFull?: boolean, initialEntityId?: string }) {
  const entities = useStore(state => state.entities);
  const activeEntityId = useStore(state => state.activeEntityId);
  const favoriteIds = useStore(state => state.favoriteIds);
  const setActiveEntityId = useStore(state => state.setActiveEntityId);
  const openModal = useStore(state => state.openModal);
  const openContextMenu = useStore(state => state.openContextMenu);
  const isSidebarCollapsed = useStore(state => state.isSidebarCollapsed);
  const isSidebarPinned = useStore(state => state.isSidebarPinned);
  const toggleSidebar = useStore(state => state.toggleSidebar);
  const toggleSidebarPinned = useStore(state => state.toggleSidebarPinned);
  const toggleCommandPalette = useStore(state => state.toggleCommandPalette);
  const theme = useStore(state => state.theme);
  const toggleTheme = useStore(state => state.toggleTheme);
  const toggleFavorite = useStore(state => state.toggleFavorite);
  const storeWorkspaces = useStore(state => state.workspaces);
  const activeWorkspaceId = useStore(state => state.activeWorkspaceId);
  const reorderEntities = useStore(state => state.reorderEntities);
  const sidebarSectionSettings = useStore(state => state.sidebarSectionSettings);
  const hiddenEntityIds = useStore(state => state.hiddenEntityIds);
  const setSectionSortMode = useStore(state => state.setSectionSortMode);
  const contextMenu = useStore(state => state.contextMenu);
  const selectedSidebarIds = useStore(state => state.selectedSidebarIds);
  const setSelectedSidebarIds = useStore(state => state.setSelectedSidebarIds);
  const clearSelectedSidebarIds = useStore(state => state.clearSelectedSidebarIds);
  
  const effectiveCollapsed = forceFull ? false : isSidebarCollapsed;
  const chatConversations = useStore(state => state.chatConversations);
  const loadChatConversations = useStore(state => state.loadChatConversations);
  const activeChatId = useStore(state => state.activeChatId);
  const loadConversation = useStore(state => state.loadConversation);
  const startNewChat = useStore(state => state.startNewChat);
  const startTempChat = useStore(state => state.startTempChat);
  const isTempChat = useStore(state => state.isTempChat);
  const deleteChatConversation = useStore(state => state.deleteChatConversation);
  const renameChatConversation = useStore(state => state.renameChatConversation);
  const addTab = useStore(state => state.addTab);

  const [isFavoritesCollapsed, setIsFavoritesCollapsed] = useState(false);
  const [isWorkspacesCollapsed, setIsWorkspacesCollapsed] = useState(false);
  const [isUnsortedCollapsed, setIsUnsortedCollapsed] = useState(false);
  const [sectionOrder] = useState(['favorites', 'unsorted', 'workspaces']);
  const [chatEditingId, setChatEditingId] = useState<string | null>(null);
  const [chatEditTitle, setChatEditTitle] = useState('');
  const [chatConfirmDeleteId, setChatConfirmDeleteId] = useState<string | null>(null);
  const [chatMenuOpenId, setChatMenuOpenId] = useState<string | null>(null);
  const [chatMenuPos, setChatMenuPos] = useState({ x: 0, y: 0 });
  const chatEditInputRef = useRef<HTMLInputElement>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [storeHydrated, setStoreHydrated] = useState(false);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const lastClickedRef = useRef<string | null>(null);

  const mainScrollRef = React.useRef<HTMLDivElement>(null);
  const pinnedScrollRef = React.useRef<HTMLDivElement>(null);

  const updateScrollFade = useCallback((target: HTMLDivElement | null) => {
    if (!target) return;
    const scrollTop = target.scrollTop;
    const scrollHeight = target.scrollHeight;
    const clientHeight = target.clientHeight;

    if (scrollHeight <= clientHeight) {
      target.style.setProperty('--scroll-top-offset', '0px');
      target.style.setProperty('--scroll-bottom-offset', '0px');
      return;
    }

    const topOffset = Math.min(scrollTop, 20);
    const bottomOffset = Math.min(scrollHeight - clientHeight - scrollTop, 20);

    target.style.setProperty('--scroll-top-offset', `${topOffset}px`);
    target.style.setProperty('--scroll-bottom-offset', `${bottomOffset}px`);
  }, []);

  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    updateScrollFade(e.currentTarget);
  };
  const [inferredEntityId, setInferredEntityId] = useState<string | null>(initialEntityId || null);

  useEffect(() => {
    setIsMounted(true);

    if (!inferredEntityId) {
      const attr = document.documentElement.getAttribute('data-initial-entity');
      if (attr) setInferredEntityId(attr);
    }

    // Zustand hydration check
    if (useStore.persist.hasHydrated()) {
      setStoreHydrated(true);
    } else {
      const unsub = useStore.persist.onFinishHydration(() => {
        setStoreHydrated(true);
        unsub();
      });
      return unsub;
    }
  }, []);

  React.useEffect(() => {
    if (activeEntityId === 'chat') loadChatConversations();
  }, [activeEntityId]);

  React.useEffect(() => {
    if (chatEditingId && chatEditInputRef.current) {
      chatEditInputRef.current.focus();
      chatEditInputRef.current.select();
    }
  }, [chatEditingId]);

  const groupChatsByDate = (convs: typeof chatConversations) => {
    const now = Date.now();
    const oneDayMs = 86400000;
    const groups: Record<string, typeof convs> = { Today: [], Yesterday: [], 'Last 7 days': [], Older: [] };
    for (const c of convs) {
      const age = now - new Date(c.updated_at).getTime();
      if (age < oneDayMs) groups['Today'].push(c);
      else if (age < oneDayMs * 2) groups['Yesterday'].push(c);
      else if (age < oneDayMs * 7) groups['Last 7 days'].push(c);
      else groups['Older'].push(c);
    }
    return groups;
  };

  const handleChatRenameSubmit = (id: string) => {
    if (chatEditTitle.trim()) renameChatConversation(id, chatEditTitle.trim());
    setChatEditingId(null);
  };

  React.useEffect(() => {
    if (!isMounted) return;

    // Update fades when mounted or when favoriteIds change
    const updateFades = () => {
      updateScrollFade(mainScrollRef.current);
      updateScrollFade(pinnedScrollRef.current);
    };

    requestAnimationFrame(updateFades);
  }, [isMounted, updateScrollFade, favoriteIds]);

  const activeWorkspace = useMemo(
    () => storeWorkspaces.find(w => w.id === activeWorkspaceId),
    [storeWorkspaces, activeWorkspaceId]
  );

  const isEntityVisible = useMemo(() => (e: Entity) => {
    return (e.workspaceId || 'ws-personal') === activeWorkspaceId && !hiddenEntityIds.includes(e.id);
  }, [activeWorkspaceId, hiddenEntityIds]);

  const sortEntities = (entities: Entity[], sectionId: SidebarSectionId) => {
    const mode = (sidebarSectionSettings as any)[sectionId]?.sortMode || 'lastModified';
    if (mode === 'alphabetical') return [...entities].sort((a, b) => a.title.localeCompare(b.title));
    if (mode === 'lastModified') return [...entities].sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0));
    return [...entities].sort((a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999));
  };

  const workspacesBase = useMemo(
    () => sortEntities(entities.filter(e => (e.type === 'collection' || e.type === 'workspace') && isEntityVisible(e)), 'workspaces'),
    [entities, isEntityVisible, sidebarSectionSettings]
  );
  const favoriteEntitiesBase = useMemo(
    () => sortEntities(entities.filter(e => favoriteIds.includes(e.id) && isEntityVisible(e)), 'pinned'),
    [entities, favoriteIds, isEntityVisible, sidebarSectionSettings]
  );
  const unsortedEntitiesBase = useMemo(
    () => sortEntities(
      entities.filter(e => 
        (e.type === 'note' || e.type === 'canvas' || e.type === 'mixed') && 
        (!e.parentId || !entities.some(p => p.id === e.parentId)) && 
        isEntityVisible(e)
      ),
      'unsorted'
    ),
    [entities, isEntityVisible, sidebarSectionSettings]
  );

  // Local state for optimistic DnD ordering
  const [workspaces, setWorkspaces] = useState<Entity[]>([]);
  const [favoriteEntities, setFavoriteEntities] = useState<Entity[]>([]);
  const [unsortedEntities, setUnsortedEntities] = useState<Entity[]>([]);

  // Effective display lists: use local state only during drag, otherwise use stable store-derived memos
  const displayWorkspaces = activeDragId ? workspaces : workspacesBase;
  const displayFavorites = activeDragId ? favoriteEntities : favoriteEntitiesBase;
  const displayUnsorted = activeDragId ? unsortedEntities : unsortedEntitiesBase;

  // Sync local state ONLY at the start of a drag to ensure we have a stable snapshot to reorder
  React.useEffect(() => {
    if (activeDragId) {
      setWorkspaces(workspacesBase);
      setFavoriteEntities(favoriteEntitiesBase);
      setUnsortedEntities(unsortedEntitiesBase);
    }
  }, [activeDragId]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  // Build a flat list of all selectable entity IDs (pinned + unsorted — NOT workspaces)
  const selectableIds = useMemo(() => {
    const ids: string[] = [];
    favoriteEntities.forEach(e => ids.push(e.id));
    unsortedEntities.forEach(e => ids.push(e.id));
    return ids;
  }, [favoriteEntities, unsortedEntities]);

  const handleShiftClick = useCallback((entityId: string) => {
    const current = [...selectedSidebarIds];
    if (current.includes(entityId)) {
      // Deselect
      setSelectedSidebarIds(current.filter(id => id !== entityId));
    } else {
      // Select
      setSelectedSidebarIds([...current, entityId]);
    }
    lastClickedRef.current = entityId;
  }, [selectedSidebarIds, setSelectedSidebarIds]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const isPinnedDrag = activeId.startsWith('pinned-');
    const entityId = isPinnedDrag ? activeId.replace('pinned-', '') : activeId;
    const entity = entities.find(e => e.id === entityId);
    if (!entity) return;

    const overData = over.data.current;
    const containerId = overData?.sortable?.containerId || overId;

    if (containerId === 'pinned-container' || overId === 'pinned-container' || overId.startsWith('pinned-')) {
      if (!favoriteIds.includes(entityId)) {
        toggleFavorite(entityId);
      }
      const oldIndex = favoriteEntities.findIndex(e => e.id === entityId);
      const overEntityId = overId.startsWith('pinned-') ? overId.replace('pinned-', '') : overId;
      const newIndex = favoriteEntities.findIndex(e => e.id === overEntityId);

      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        const reordered = arrayMove(favoriteEntities, oldIndex, newIndex);
        reorderEntities(reordered.map(e => e.id));
        setSectionSortMode('pinned', 'manual');
      }
      return;
    }

    if (isPinnedDrag) {
      toggleFavorite(entityId);
    }

    const overEntity = entities.find(e => e.id === overId);
    const moveEntityAction = useStore.getState().moveEntity;

    let newParentId: string | null = entity.parentId;
    let newWorkspaceId = entity.workspaceId;

    if (containerId === 'unsorted-container' || overId === 'unsorted-container') {
      newParentId = null;
      newWorkspaceId = 'ws-personal';
    } else if (containerId === 'workspaces-container' || overId === 'workspaces-container') {
      newParentId = null;
      newWorkspaceId = activeWorkspaceId;
    } else if (overEntity) {
      if (overEntity.type === 'folder' || overEntity.type === 'collection' || overEntity.type === 'workspace') {
        newParentId = overEntity.id;
        newWorkspaceId = overEntity.workspaceId;
      } else {
        newParentId = overEntity.parentId;
        newWorkspaceId = overEntity.workspaceId;
      }
    }

    if (newParentId === entityId) return;
    const descendantIds = getDescendantIds(entities, entityId);
    if (newParentId && descendantIds.includes(newParentId)) return;

    if (newParentId !== entity.parentId || newWorkspaceId !== entity.workspaceId) {
      moveEntityAction(entityId, newParentId, newWorkspaceId);
    }

    const currentSiblings = entities
      .filter(e => e.id === entityId || (e.parentId === newParentId && (e.workspaceId || 'ws-personal') === (newWorkspaceId || 'ws-personal')))
      .sort((a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999));

    const fromIdx = currentSiblings.findIndex(e => e.id === entityId);
    let toIdx = currentSiblings.findIndex(e => e.id === overId);
    if (toIdx === -1) toIdx = currentSiblings.length - 1;

    if (fromIdx !== -1 && toIdx !== -1 && fromIdx !== toIdx) {
      const reordered = arrayMove(currentSiblings, fromIdx, toIdx);
      reorderEntities(reordered.map(e => e.id));

      if (favoriteIds.includes(entityId)) {
        setSectionSortMode('pinned', 'manual');
      } else if (entity.type === 'workspace' || entity.type === 'collection') {
        setSectionSortMode('workspaces', 'manual');
      } else {
        setSectionSortMode('unsorted', 'manual');
      }
    }
  }, [entities, favoriteIds, favoriteEntities, activeWorkspaceId, toggleFavorite, reorderEntities, setSectionSortMode]);

  const navItemClass = (isActive: boolean) => cn(
    "sidebar-item-row flex items-center w-full cursor-pointer select-none text-sm group",
    "px-3 py-[3px] rounded-[var(--radius-small)] ",
    isActive
      ? "bg-[var(--bone-6)] text-[var(--bone-100)] hover:bg-[var(--bone-10)]"
      : "bg-transparent text-[var(--bone-70)] hover:text-[var(--bone-100)] hover:bg-[var(--bone-6)]"
  );

  const getSmallIcon = (type: EntityType, entity?: Entity, noMargin: boolean = false) => {
    const isDashboard = activeEntityId === 'dashboard';
    const isActive = activeEntityId === entity?.id && !isDashboard;
    const cls = cn("w-4 h-4 shrink-0 ", isActive ? "text-[var(--bone-100)]" : "text-[var(--bone-70)] group-hover:text-[var(--bone-100)]");

    const renderIcon = () => {
      if ((type === 'collection' || type === 'folder' || type === 'workspace') && entity?.icon) {
        const CustomIcon = getEntityIcon(entity.icon);
        return <CustomIcon strokeWidth={2} className={cls} />;
      }
      switch (type) {
        case 'canvas': return <Frame strokeWidth={2} className={cls} />;
        case 'note': return <FileText strokeWidth={2} className={cls} />;
        case 'mixed': return <Layers strokeWidth={2} className={cls} />;
        case 'folder': return <Folder strokeWidth={2} className={cls} />;
        case 'collection':
        case 'workspace': return <Folder strokeWidth={2} className={cls} />;
        default: return <Frame strokeWidth={2} className={cls} />;
      }
    };

    if (noMargin) return renderIcon();
    return <div className="flex items-center justify-center w-[14px] shrink-0">{renderIcon()}</div>;
  };

  return (
    <aside
      onMouseEnter={() => {
        if (!isSidebarPinned && effectiveCollapsed) toggleSidebar();
      }}
      onMouseLeave={() => {
        if (!isSidebarPinned && !effectiveCollapsed) toggleSidebar();
      }}
      className={cn(
        "h-full bg-sidebar flex flex-col overflow-hidden flex-shrink-0 w-full",
        activeDragId && "is-dragging"
      )}
    >
      <div
        onClick={toggleSidebar}
        className={cn(
          "flex items-center px-3 py-3 border-b border-[var(--bone-6)] group cursor-pointer ",
          effectiveCollapsed ? "justify-center" : "justify-between"
        )}
      >
        {!effectiveCollapsed ? (
          <img
            src={theme === 'dark' ? "/logo dark mode.svg" : "/logo light mode.svg"}
            className="h-7 object-contain"
            alt="Flowr"
          />
        ) : (
          <LogoSimple className="w-6 h-6 text-[var(--bone-70)] group-hover:text-[var(--bone-100)]" />
        )}

        <div className="flex items-center gap-1 shrink-0">
          {!effectiveCollapsed && (
            <div className="flex items-center gap-2 mr-1" onClick={(e) => e.stopPropagation()}>
              <Tooltip content={isSidebarPinned ? "Sidebar Pinned" : "Auto-collapse Sidebar"}>
                <Toggle
                  checked={isSidebarPinned}
                  onChange={toggleSidebarPinned}
                  className="scale-[0.6] origin-right"
                />
              </Tooltip>
            </div>
          )}
          {!effectiveCollapsed && (
            <div className="p-1 text-[var(--bone-70)] group-hover:text-[var(--bone-100)] shrink-0">
              <ChevronLeft strokeWidth={2} className={cn("w-5 h-5", effectiveCollapsed && "rotate-180")} />
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">


        <div className="px-3 pt-3 pb-[6px]">
          {effectiveCollapsed ? (
            <Tooltip content="Search">
              <button
                onClick={toggleCommandPalette}
                className="w-10 h-10 mx-auto flex items-center justify-center rounded-[var(--radius-8)] text-[var(--bone-70)] hover:bg-[var(--bone-6)] hover:text-[var(--bone-100)] "
              >
                <Search strokeWidth={2} className="w-5 h-5" />
              </button>
            </Tooltip>
          ) : (
            <button
              onClick={toggleCommandPalette}
              className="flex items-center w-full px-3 py-1.5 bg-[var(--bone-6)] border border-transparent hover:border-[var(--bone-10)] rounded-[var(--radius-small)] group relative cursor-pointer text-left"
            >
              <div className="w-4 shrink-0 flex items-center justify-center">
                <Search strokeWidth={2} className="w-4 h-4 text-[var(--bone-70)] group-hover:text-[var(--bone-100)] shrink-0" />
              </div>
              <span className="text-[var(--bone-70)] group-hover:text-[var(--bone-100)] w-full text-[13px] ml-[6px] truncate tracking-wide">
                Search or command
              </span>
              <kbd className="absolute right-2 px-1.5 py-0.5 bg-[var(--bone-10)] rounded-[var(--radius-small)] text-[9px] font-bold text-[var(--bone-70)] tracking-wider">
                ⇧ Z
              </kbd>
            </button>
          )}
        </div>

        {effectiveCollapsed ? (
          <div className="flex flex-col items-center gap-3 w-full px-3 mb-2 flex-none">
            <Tooltip content="Dashboard">
              <button
                onClick={() => setActiveEntityId('dashboard')}
                className={cn(
                  "sidebar-item-row p-2 rounded-[var(--radius-8)] w-10 h-10 flex items-center justify-center border ",
                  ((storeHydrated ? activeEntityId : inferredEntityId) === 'dashboard')
                    ? "bg-[var(--bone-6)] text-[var(--bone-100)] border-transparent"
                    : "bg-transparent text-[var(--bone-70)] border-transparent hover:bg-[var(--bone-6)] hover:text-[var(--bone-100)]"
                )}
              >
                <LayoutDashboard strokeWidth={2} className="w-4 h-4" />
              </button>
            </Tooltip>
            <Tooltip content="Tracker">
              <button
                onClick={() => setActiveEntityId('tracker')}
                className={cn(
                  "sidebar-item-row p-2 rounded-[var(--radius-8)] w-10 h-10 flex items-center justify-center border ",
                  ((storeHydrated ? activeEntityId : inferredEntityId) === 'tracker')
                    ? "bg-[var(--bone-6)] text-[var(--bone-100)] border-transparent"
                    : "bg-transparent text-[var(--bone-70)] border-transparent hover:bg-[var(--bone-6)] hover:text(--bone-100)]"
                )}
              >
                <Calendar strokeWidth={2} className="w-4 h-4" />
              </button>
            </Tooltip>
            <Tooltip content="Chat">
              <button
                onClick={() => setActiveEntityId('chat')}
                className={cn(
                  "sidebar-item-row p-2 rounded-[var(--radius-8)] w-10 h-10 flex items-center justify-center border ",
                  ((storeHydrated ? activeEntityId : inferredEntityId) === 'chat')
                    ? "bg-[var(--bone-6)] text-[var(--bone-100)] border-transparent"
                    : "bg-transparent text-[var(--bone-70)] border-transparent hover:bg-[var(--bone-6)] hover:text-[var(--bone-100)]"
                )}
              >
                <MessageSquare strokeWidth={2} className="w-4 h-4" />
              </button>
            </Tooltip>
            <div className="w-8 h-px bg-border/20 my-1" />
          </div>
        ) : (
          <div className="px-3 flex flex-col gap-[3px] pt-0 mb-2 flex-none">
            <button
              onClick={() => setActiveEntityId('dashboard')}
              onContextMenu={(e) => {
                e.preventDefault();
                openContextMenu('dashboard', e.clientX, e.clientY, 'sidebar');
              }}
              className={cn(
                "sidebar-item-row flex items-center w-full cursor-pointer select-none rounded-[var(--radius-small)] pl-[10px] pr-1.5 h-7 group border border-transparent ",
                ((storeHydrated ? activeEntityId : inferredEntityId) === 'dashboard')
                  ? "bg-[var(--bone-15)] text-[var(--bone-100)] font-normal tracking-wide"
                  : "bg-transparent text-[var(--bone-70)] hover:bg-[var(--bone-6)] hover:text-[var(--bone-100)]"
              )}
            >
              <div className="w-[14px] shrink-0 flex items-center justify-center">
                <LayoutDashboard strokeWidth={2} className="w-3.5 h-3.5" />
              </div>
              <span className="ml-[6px] flex-1 text-left text-[13px] tracking-wide">Home</span>
            </button>
            <button
              onClick={() => setActiveEntityId('tracker')}
              onContextMenu={(e) => {
                e.preventDefault();
                openContextMenu('tracker', e.clientX, e.clientY, 'sidebar');
              }}
              className={cn(
                "sidebar-item-row flex items-center w-full cursor-pointer select-none rounded-[var(--radius-small)] pl-[10px] pr-1.5 h-7 group border border-transparent ",
                ((storeHydrated ? activeEntityId : inferredEntityId) === 'tracker')
                  ? "bg-[var(--bone-15)] text-[var(--bone-100)] font-normal tracking-wide"
                  : "bg-transparent text-[var(--bone-70)] hover:bg-[var(--bone-6)] hover:text-[var(--bone-100)]"
              )}
            >
              <div className="w-[14px] shrink-0 flex items-center justify-center">
                <Calendar strokeWidth={2} className="w-3.5 h-3.5" />
              </div>
              <span className="ml-[6px] flex-1 text-left text-[13px] tracking-wide">Calendar</span>
            </button>
            <button
              onClick={() => setActiveEntityId('chat')}
              onContextMenu={(e) => {
                e.preventDefault();
                openContextMenu('chat', e.clientX, e.clientY, 'sidebar');
              }}
              className={cn(
                "sidebar-item-row flex items-center w-full cursor-pointer select-none rounded-[var(--radius-small)] pl-[10px] pr-1.5 h-7 group border border-transparent ",
                ((storeHydrated ? activeEntityId : inferredEntityId) === 'chat')
                  ? "bg-[var(--bone-15)] text-[var(--bone-100)] font-normal tracking-wide"
                  : "bg-transparent text-[var(--bone-70)] hover:bg-[var(--bone-6)] hover:text-[var(--bone-100)]"
              )}
            >
              <div className="w-[14px] shrink-0 flex items-center justify-center">
                <MessageSquare strokeWidth={2} className="w-3.5 h-3.5" />
              </div>
              <span className="ml-[6px] flex-1 text-left text-[13px] tracking-wide">Chat</span>
            </button>
            <div className="h-px bg-border/20 -mx-3 mt-2 mb-0" />
          </div>
        )}

        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {(!isMounted || !storeHydrated) ? (
            (inferredEntityId === 'chat' && !effectiveCollapsed) 
              ? <ChatHistorySkeleton /> 
              : <SidebarSkeleton collapsed={effectiveCollapsed} />
          ) : effectiveCollapsed ? (
            <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-4 flex flex-col items-center gap-3 w-full scrollbar-none">
              <Tooltip content="Pinned items">
                <button
                  onClick={toggleSidebar}
                  className="p-2 rounded-[var(--radius-8)] text-[var(--bone-70)] hover:bg-[var(--bone-6)] hover:text-[var(--bone-100)] w-10 h-10 flex items-center justify-center group "
                >
                  <Star strokeWidth={2} className="w-5 h-5" />
                </button>
              </Tooltip>
            </div>
          ) : (
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              {activeEntityId === 'chat' ? (
                <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                  <div className="flex flex-col pl-[10px] pr-1.5 pt-3 pb-1 shrink-0">
                    <button
                      onClick={startNewChat}
                      className="sidebar-item-row flex items-center w-full cursor-pointer select-none rounded-[var(--radius-small)] pl-[10px] pr-1.5 h-7 group border border-transparent  text-[var(--bone-70)] hover:bg-[var(--bone-6)] hover:text-[var(--bone-100)]"
                    >
                      <div className="w-[14px] shrink-0 flex items-center justify-center">
                        <Plus strokeWidth={2} className="w-3.5 h-3.5" />
                      </div>
                      <span className="ml-[6px] flex-1 text-left text-[13px] tracking-wide">New Chat</span>
                    </button>
                    <button
                      onClick={startTempChat}
                      className={cn(
                        "sidebar-item-row flex items-center w-full cursor-pointer select-none rounded-[var(--radius-small)] pl-[10px] pr-1.5 h-7 group border border-transparent ",
                        isTempChat ? "bg-[var(--bone-15)] text-[var(--bone-100)] font-normal" : "text-[var(--bone-70)] hover:bg-[var(--bone-6)] hover:text-[var(--bone-100)]"
                      )}
                    >
                      <div className="w-[14px] shrink-0 flex items-center justify-center">
                        <Clock strokeWidth={2} className="w-3.5 h-3.5" />
                      </div>
                      <span className="ml-[6px] flex-1 text-left text-[13px] tracking-wide">Temp Chat</span>
                    </button>
                  </div>

                  {chatConfirmDeleteId && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-overlay" onClick={() => setChatConfirmDeleteId(null)}>
                      <div className="bg-panel border border-border/50 rounded-[1.25rem] p-5 w-[360px]" onClick={e => e.stopPropagation()}>
                        <h2 className="text-lg font-semibold text-foreground mb-3">Delete conversation?</h2>
                        <p className="text-sm text-muted-foreground mb-6">This will permanently delete this conversation and all its messages.</p>
                        <div className="flex items-center justify-end gap-3">
                          <button onClick={() => setChatConfirmDeleteId(null)} className="px-4 py-2 border border-border/50 text-sm rounded-full text-muted-foreground hover:text-foreground hover:bg-hover">Cancel</button>
                          <button onClick={() => { deleteChatConversation(chatConfirmDeleteId); setChatConfirmDeleteId(null); }} className="px-4 py-2 text-sm rounded-full bg-danger hover:bg-danger/80 text-white font-medium">Delete</button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin px-3 pb-4 space-y-1">
                    {Object.entries(groupChatsByDate(chatConversations)).map(([label, convs]) => {
                      if (convs.length === 0) return null;
                      return (
                        <div key={label}>
                          <div className="pl-[10px] pr-1.5 h-7 flex items-center text-[10px] font-ui-label font-medium uppercase tracking-wide text-[var(--bone-70)]">
                            <div className="w-[14px] shrink-0" />
                            <span className="ml-[6px]">{label}</span>
                          </div>
                          {convs.map(conv => (
                            <div
                              key={conv.id}
                              className={cn(
                                "sidebar-item-row group flex items-center w-full cursor-pointer select-none rounded-[var(--radius-small)] pl-[10px] pr-1.5 h-7 border border-transparent ",
                                activeChatId === conv.id ? "bg-[var(--bone-15)] text-[var(--bone-100)] font-normal tracking-wide" : "text-[var(--bone-70)] hover:bg-[var(--bone-6)] hover:text-[var(--bone-100)]"
                              )}
                              onClick={() => loadConversation(conv.id)}
                            >
                              {chatEditingId === conv.id ? (
                                <input
                                  ref={chatEditInputRef}
                                  value={chatEditTitle}
                                  onChange={e => setChatEditTitle(e.target.value)}
                                  onBlur={() => handleChatRenameSubmit(conv.id)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') handleChatRenameSubmit(conv.id);
                                    if (e.key === 'Escape') setChatEditingId(null);
                                  }}
                                  onClick={e => e.stopPropagation()}
                                  className="flex-1 bg-transparent text-[13px] tracking-wide outline-none border-b border-white/30"
                                />
                              ) : (
                                <span className="flex-1 text-[13px] tracking-wide truncate">{stripHtml(conv.title)}</span>
                              )}
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                  setChatMenuPos({ x: rect.right + 4, y: rect.top });
                                  setChatMenuOpenId(chatMenuOpenId === conv.id ? null : conv.id);
                                }}
                                className={cn(
                                  "btn-sidebar-utility opacity-0 group-hover:opacity-100",
                                  chatMenuOpenId === conv.id && "!opacity-100 !bg-[var(--bone-15)] !text-[var(--bone-100)]"
                                )}
                              >
                                <MoreHorizontal strokeWidth={2} className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                    {chatConversations.length === 0 && (
                      <p className="text-xs text-muted-foreground/60 text-center pt-8">No conversations yet</p>
                    )}
                  </div>
                </div>
              ) : activeEntityId === 'tracker' ? (
                <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-6 text-center gap-2">
                  <Calendar className="w-8 h-8 text-muted-foreground/30" />
                  <p className="text-xs text-muted-foreground/50">Calendar coming soon</p>
                </div>
              ) : (
              <div
                ref={mainScrollRef}
                onScroll={onScroll}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest('.sidebar-item-row') === null && selectedSidebarIds.length > 0) {
                    clearSelectedSidebarIds();
                  }
                }}
                className="flex-1 min-h-0 overflow-y-auto scrollbar-thin [scrollbar-gutter:stable] pl-3 pr-[4px] pt-3 mr-[2px]"
              >
                <DndContext
                  sensors={sensors}
                  collisionDetection={rectIntersection}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  modifiers={[restrictToVerticalAxis]}
                >
                  {sectionOrder.map((sectionId) => {
                    if (sectionId === 'favorites') {
                      if (displayFavorites.length === 0) return null;
                      return (
                        <div key="favorites" className="flex flex-col">
                          <div
                            onClick={() => setIsFavoritesCollapsed(!isFavoritesCollapsed)}
                            className={cn(
                              "ml-0 mr-[2px] pl-[10px] pr-1.5 py-0 flex items-center justify-between group cursor-pointer select-none rounded-[var(--radius-small)] h-7",
                              contextMenu?.entityId === 'pinned'
                                ? "!bg-[var(--bone-10)] text-[var(--bone-100)]"
                                : "text-[var(--bone-70)] hover:text-[var(--bone-100)] hover:bg-[var(--bone-6)]"
                            )}
                          >
                            <div className="flex items-center">
                              <div className="w-[14px] shrink-0" />
                              <span className="ml-[6px] text-[10px] font-ui-label font-medium uppercase tracking-wide">Pinned</span>
                            </div>
                            <div className="flex items-center gap-0.5">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  openContextMenu('pinned', rect.right, rect.top, 'sidebar-section');
                                }}
                                className={cn(
                                  "btn-sidebar-utility",
                                  contextMenu?.entityId === 'pinned' && "!bg-[var(--bone-15)] !text-[var(--bone-100)] !opacity-100"
                                )}
                              >
                                <MoreHorizontal strokeWidth={2} className="w-3.5 h-3.5" />
                              </button>
                              <ChevronDown strokeWidth={2} className={cn("w-3.5 h-3.5", isFavoritesCollapsed ? "-rotate-90" : "rotate-0")} />
                            </div>
                          </div>
                          <div
                            className={cn(
                              "grid transition-all duration-100 ease-out",
                              !isFavoritesCollapsed ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                            )}
                          >
                            <div className="overflow-hidden">
                              <div
                                ref={pinnedScrollRef}
                                className="pr-[4px] mr-[2px]"
                              >
                                <DroppableZone id="pinned-container" className="flex flex-col gap-[3px] mt-[3px] sidebar-list mb-2">
                                  <SortableContext items={displayFavorites.map(e => `pinned-${e.id}`)} strategy={verticalListSortingStrategy}>
                                    {displayFavorites.map(entity => (
                                      <TreeItem
                                        key={`pinned-${entity.id}`}
                                        entity={entity}
                                        depth={0}
                                        idOverride={`pinned-${entity.id}`}
                                        disableNesting={true}
                                        isMultiSelected={selectedSidebarIds.includes(entity.id)}
                                        onShiftClick={handleShiftClick}
                                      />
                                    ))}
                                  </SortableContext>
                                </DroppableZone>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    if (sectionId === 'unsorted') {
                      if (displayUnsorted.length === 0) return null;
                      return (
                        <div key="unsorted" className="flex flex-col">
                          <div
                            onClick={() => setIsUnsortedCollapsed(!isUnsortedCollapsed)}
                            className={cn(
                              "ml-0 mr-[2px] pl-[10px] pr-1.5 h-7 flex items-center justify-between group cursor-pointer select-none rounded-[var(--radius-small)] ",
                              contextMenu?.entityId === 'unsorted'
                                ? "!bg-[var(--bone-10)] text-[var(--bone-100)]"
                                : "text-[var(--bone-70)] hover:text-[var(--bone-100)] hover:bg-[var(--bone-6)]"
                            )}
                          >
                            <div className="flex items-center">
                              <div className="w-[14px] shrink-0" />
                              <span className="ml-[6px] text-[10px] font-ui-label font-medium uppercase tracking-wide">Unsorted</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  openContextMenu('unsorted', rect.right, rect.top, 'sidebar-section');
                                }}
                                className={cn(
                                  "btn-sidebar-utility",
                                  contextMenu?.entityId === 'unsorted' && "!bg-[var(--bone-15)] !text-[var(--bone-100)] !opacity-100"
                                )}
                              >
                                <MoreHorizontal strokeWidth={2} className="w-3.5 h-3.5" />
                              </button>
                              <ChevronDown strokeWidth={2} className={cn("w-3.5 h-3.5", isUnsortedCollapsed ? "-rotate-90" : "rotate-0")} />
                            </div>
                          </div>
                          <div
                            className={cn(
                              "grid transition-all duration-100 ease-out",
                              !isUnsortedCollapsed ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                            )}
                          >
                            <div className="overflow-hidden">
                              <div
                                className="pr-[4px] mr-[2px]"
                              >
                                <DroppableZone id="unsorted-container" className="flex flex-col gap-[3px] mt-[3px] sidebar-list mb-2">
                                  <SortableContext items={displayUnsorted.map(e => e.id)} strategy={verticalListSortingStrategy}>
                                    {displayUnsorted.map(entity => (
                                      <TreeItem key={entity.id} entity={entity} depth={0} disableNesting={true} isMultiSelected={selectedSidebarIds.includes(entity.id)} onShiftClick={handleShiftClick} />
                                    ))}
                                  </SortableContext>
                                </DroppableZone>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    if (sectionId === 'workspaces') {
                      return (
                        <div key="workspaces" className="flex flex-col">
                          <div
                            className={cn(
                              "ml-0 mr-[2px] pl-[10px] pr-1.5 h-7 flex items-center justify-between group cursor-pointer select-none rounded-[var(--radius-small)] ",
                              contextMenu?.entityId === 'workspaces'
                                ? "!bg-[var(--bone-10)] text-[var(--bone-100)]"
                                : "text-[var(--bone-70)] hover:text-[var(--bone-100)] hover:bg-[var(--bone-6)]"
                            )}
                            onClick={() => setIsWorkspacesCollapsed(!isWorkspacesCollapsed)}
                          >
                            <div className="flex items-center">
                              <div className="w-[14px] shrink-0" />
                              <span className="ml-[6px] text-[10px] font-ui-label font-medium uppercase tracking-wide">Workspaces</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  openContextMenu('workspaces', rect.right, rect.top, 'sidebar-section');
                                }}
                                className={cn(
                                  "btn-sidebar-utility",
                                  contextMenu?.entityId === 'workspaces' && "!bg-[var(--bone-15)] !text-[var(--bone-100)] !opacity-100"
                                )}
                              >
                                <MoreHorizontal strokeWidth={2} className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openModal({ kind: 'newCollection' });
                                }}
                                className="btn-sidebar-utility"
                              >
                                <Plus strokeWidth={2} className="w-3.5 h-3.5" />
                              </button>
                              <ChevronDown strokeWidth={2} className={cn("w-3.5 h-3.5", isWorkspacesCollapsed ? "-rotate-90" : "rotate-0")} />
                            </div>
                          </div>
                          <div
                            className={cn(
                              "grid transition-all duration-100 ease-out",
                              !isWorkspacesCollapsed ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                            )}
                          >
                            <div className="overflow-hidden">
                              <div
                                className="pr-[4px] mr-[2px]"
                              >
                                <DroppableZone id="workspaces-container" className="flex flex-col gap-[3px] mt-[3px] mb-2">
                                  <SortableContext items={displayWorkspaces.map(e => e.id)} strategy={verticalListSortingStrategy}>
                                    {displayWorkspaces.map(workspace => (
                                      <TreeItem key={workspace.id} entity={workspace} depth={0} isMultiSelected={selectedSidebarIds.includes(workspace.id)} onShiftClick={handleShiftClick} />
                                    ))}
                                  </SortableContext>
                                </DroppableZone>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })}
                  <DragOverlay dropAnimation={null} />
                </DndContext>
              </div>
            )}
          </div>
        )}
      </div>
    </div>

      <div className={cn("p-3 border-t border-[var(--bone-6)] flex items-center mt-auto", effectiveCollapsed ? "flex-col gap-5 py-4" : "justify-between")}>
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--bone-15)] to-[var(--bone-6)] border border-[var(--bone-10)] flex items-center justify-center shrink-0 overflow-hidden">
            <span className="text-[10px] font-bold text-[var(--bone-70)] tracking-wide">M</span>
          </div>
          {!effectiveCollapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-[var(--bone-100)] truncate tracking-wide">Misha</span>
              <span className="text-[10px] text-[var(--bone-70)] truncate tracking-wide">
                {activeWorkspace?.name || 'Personal'}
              </span>
            </div>
          )}
        </div>
        <div className={cn("flex items-center gap-1 shrink-0", effectiveCollapsed && "flex-col gap-2")}>
          <Tooltip content="Spaces">
            <button
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                openContextMenu(null, rect.left, rect.top, 'spaces');
              }}
              className={cn("btn-sidebar-utility", contextMenu?.source === 'spaces' && "!bg-[var(--bone-15)] !text-[var(--bone-100)] !opacity-100")}
            >
              <ChevronsUpDown strokeWidth={2} className="w-4 h-4" />
            </button>
          </Tooltip>
          <Tooltip content="Toggle Theme">
            <button onClick={toggleTheme} className="btn-sidebar-utility">
              {theme === 'dark' ? <Moon strokeWidth={2} className="w-4 h-4" /> : <Sun strokeWidth={2} className="w-4 h-4" />}
            </button>
          </Tooltip>
          <Tooltip content="Settings">
            <button
              onClick={() => openModal({ kind: 'settings' })}
              className="btn-sidebar-utility"
            >
              <Settings strokeWidth={2} className="w-4 h-4" />
            </button>
          </Tooltip>
        </div>
      </div>

      {chatMenuOpenId && (
        <>
          <div className="fixed inset-0 z-[299]" onClick={() => setChatMenuOpenId(null)} />
          <div
            className="fixed z-[300] popup-glass-small min-w-[160px] p-1.5 flex flex-col gap-[3px]"
            style={{ left: chatMenuPos.x, top: chatMenuPos.y }}
          >
            <button
              onClick={() => { 
                if (chatMenuOpenId) {
                  loadConversation(chatMenuOpenId);
                  addTab('chat');
                }
                setChatMenuOpenId(null); 
              }}
              className="popup-item"
            >
              <ExternalLink strokeWidth={2} className="w-4 h-4 shrink-0" />
              Open in new tab
            </button>
            <button
              onClick={() => { setChatEditingId(chatMenuOpenId); setChatEditTitle(chatConversations.find(c => c.id === chatMenuOpenId)?.title ?? ''); setChatMenuOpenId(null); }}
              className="popup-item"
            >
              <Pencil strokeWidth={2} className="w-4 h-4 shrink-0" />
              Rename
            </button>
            <button
              onClick={() => { setChatConfirmDeleteId(chatMenuOpenId); setChatMenuOpenId(null); }}
              className="popup-item-danger"
            >
              <Trash2 strokeWidth={2} className="w-4 h-4 shrink-0" />
              Delete
            </button>
          </div>
        </>
      )}
    </aside>
  );
});
