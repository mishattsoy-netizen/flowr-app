"use client";

import { useStore } from '@/data/store';
import type { EntityType, Entity, SidebarSectionId } from '@/data/store';
import { getDescendantIds } from '@/data/store.helpers';
import { getEntityIcon } from '@/data/icons';

import { Search, LayoutDashboard, Star, ChevronRight, ChevronDown, Moon, Plus, ChevronLeft, Folder, Sun, X, FileText, Frame, Layers, MoreHorizontal, Settings, Columns, GripVertical, Activity, ListTodo, ChevronsUpDown } from 'lucide-react';
import { Toggle } from '../ui/Toggle';
import clsx from 'clsx';
import { useState, useMemo, useCallback, useRef } from 'react';
import { TreeItem } from './TreeItem';
import { Tooltip } from './Tooltip';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import React from 'react';
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

export const Sidebar = React.memo(function Sidebar() {
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

  const [isFavoritesCollapsed, setIsFavoritesCollapsed] = useState(false);
  const [isWorkspacesCollapsed, setIsWorkspacesCollapsed] = useState(false);
  const [isUnsortedCollapsed, setIsUnsortedCollapsed] = useState(false);
  const [sectionOrder] = useState(['favorites', 'unsorted', 'workspaces']);
  const [isMounted, setIsMounted] = useState(false);
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

  React.useEffect(() => {
    setIsMounted(true);
    // Initialize fades
    requestAnimationFrame(() => {
      updateScrollFade(mainScrollRef.current);
      updateScrollFade(pinnedScrollRef.current);
    });
  }, [updateScrollFade, favoriteIds, entities]); // Re-init on items change

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
    () => sortEntities(entities.filter(e => (e.type === 'note' || e.type === 'canvas' || e.type === 'mixed') && !e.parentId && isEntityVisible(e)), 'unsorted'),
    [entities, isEntityVisible, sidebarSectionSettings]
  );

  // Local state for optimistic DnD ordering
  const [workspaces, setWorkspaces] = useState<Entity[]>([]);
  const [favoriteEntities, setFavoriteEntities] = useState<Entity[]>([]);
  const [unsortedEntities, setUnsortedEntities] = useState<Entity[]>([]);

  // Sync local state when store changes (but not during a drag)
  React.useEffect(() => { if (!activeDragId) setWorkspaces(workspacesBase); }, [workspacesBase, activeDragId]);
  React.useEffect(() => { if (!activeDragId) setFavoriteEntities(favoriteEntitiesBase); }, [favoriteEntitiesBase, activeDragId]);
  React.useEffect(() => { if (!activeDragId) setUnsortedEntities(unsortedEntitiesBase); }, [unsortedEntitiesBase, activeDragId]);

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

  const navItemClass = (isActive: boolean) => clsx(
    "sidebar-item-row flex items-center w-full cursor-pointer select-none text-sm group",
    "px-3 py-[3px] rounded-[var(--radius-8)] transition-colors duration-0",
    isActive
      ? "bg-[var(--bone-6)] text-[var(--bone-100)] hover:bg-[var(--bone-10)]"
      : "bg-transparent text-[var(--bone-60)] hover:text-[var(--bone-100)] hover:bg-[var(--bone-6)]"
  );

  const getSmallIcon = (type: EntityType, entity?: Entity, noMargin: boolean = false) => {
    const isDashboard = activeEntityId === 'dashboard';
    const isActive = activeEntityId === entity?.id && !isDashboard;
    const cls = clsx("w-4 h-4 shrink-0 ", isActive ? "text-[var(--bone-100)]" : "text-[var(--bone-60)] group-hover:text-[var(--bone-100)]");

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
    return <div className="flex items-center justify-center w-4 mr-2 shrink-0">{renderIcon()}</div>;
  };

  return (
    <aside
      onMouseEnter={() => {
        if (!isSidebarPinned && isSidebarCollapsed) toggleSidebar();
      }}
      onMouseLeave={() => {
        if (!isSidebarPinned && !isSidebarCollapsed) toggleSidebar();
      }}
      className={clsx(
        "h-full bg-sidebar flex flex-col overflow-hidden flex-shrink-0 w-full",
        activeDragId && "is-dragging"
      )}
    >
      <div 
        onClick={toggleSidebar}
        className={clsx(
          "flex items-center px-3 py-3 border-b border-border group cursor-pointer transition-all duration-0", 
          isSidebarCollapsed ? "justify-center" : "justify-between"
        )}
      >
        {!isSidebarCollapsed ? (
          <img
            src={theme === 'dark' ? "/logo dark mode.svg" : "/logo light mode.svg"}
            className="h-7 object-contain"
            alt="Flowr"
          />
        ) : (
          <LogoSimple className="w-6 h-6 text-[var(--bone-60)] group-hover:text-[var(--bone-100)]" />
        )}
        
        <div className="flex items-center gap-1 shrink-0">
          {!isSidebarCollapsed && (
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
          {!isSidebarCollapsed && (
            <div className="p-1 text-[var(--bone-60)] group-hover:text-[var(--bone-100)] shrink-0">
              <ChevronLeft strokeWidth={2} className={clsx("w-5 h-5 transition-transform duration-200", isSidebarCollapsed && "rotate-180")} />
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">


         <div className="px-3 pt-3 pb-[6px]">
          {isSidebarCollapsed ? (
            <Tooltip content="Search">
              <button
                onClick={toggleCommandPalette}
                className="w-10 h-10 mx-auto flex items-center justify-center rounded-[var(--radius-8)] text-[var(--bone-60)] hover:bg-[var(--bone-6)] hover:text-[var(--bone-100)] transition-colors duration-0"
              >
                <Search className="w-5 h-5" />
              </button>
            </Tooltip>
          ) : (
            <button
              onClick={toggleCommandPalette}
              className="flex items-center w-full px-3 py-1.5 bg-[var(--bone-6)] border border-transparent hover:border-[var(--bone-10)] rounded-[var(--radius-8)] group relative cursor-pointer text-left transition-colors"
            >
              <div className="w-5 shrink-0 flex items-center justify-center">
                <Search strokeWidth={2} className="w-4 h-4 text-[var(--bone-60)] group-hover:text-[var(--bone-100)] shrink-0 transition-colors" />
              </div>
              <span className="text-[var(--bone-60)] group-hover:text-[var(--bone-100)] w-full text-sm ml-[8px] truncate transition-colors tracking-wide">
                Search or command...
              </span>
              <kbd className="absolute right-2 px-1.5 py-0.5 bg-[var(--bone-10)] rounded-[var(--radius-small)] text-[9px] font-bold text-[var(--bone-60)] tracking-wider">
                ⇧ Z
              </kbd>
            </button>
          )}
        </div>

        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {!isMounted ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-accent/20 border-t-accent rounded-[var(--radius-8)] animate-spin" />
            </div>
          ) : isSidebarCollapsed ? (
            <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-4 flex flex-col items-center gap-3 w-full scrollbar-none">
              <Tooltip content="Dashboard">
                <button
                  onClick={() => setActiveEntityId('dashboard')}
                  className={clsx(
                    "sidebar-item-row p-2 rounded-[var(--radius-8)] w-10 h-10 flex items-center justify-center border transition-all duration-0",
                    activeEntityId === 'dashboard'
                      ? "bg-[var(--bone-6)] text-[var(--bone-100)] border-transparent"
                      : "bg-transparent text-[var(--bone-60)] border-transparent hover:bg-[var(--bone-6)] hover:text-[var(--bone-100)]"
                  )}
                >
                  <LayoutDashboard strokeWidth={2} className="w-4 h-4" />
                </button>
              </Tooltip>
              <Tooltip content="Tracker">
                <button
                  onClick={() => setActiveEntityId('tracker')}
                  className={clsx(
                    "sidebar-item-row p-2 rounded-[var(--radius-8)] w-10 h-10 flex items-center justify-center border transition-all duration-0",
                    activeEntityId === 'tracker'
                      ? "bg-[var(--bone-6)] text-[var(--bone-100)] border-transparent"
                      : "bg-transparent text-[var(--bone-60)] border-transparent hover:bg-[var(--bone-6)] hover:text-[var(--bone-100)]"
                  )}
                >
                  <ListTodo strokeWidth={2} className="w-4 h-4" />
                </button>
              </Tooltip>
               <div className="w-8 h-px bg-border my-0" />
              <Tooltip content="Pinned items">
                <button
                  onClick={toggleSidebar}
                  className="p-2 rounded-[var(--radius-8)] text-[var(--bone-60)] hover:bg-[var(--bone-6)] hover:text-[var(--bone-100)] w-10 h-10 flex items-center justify-center group transition-colors duration-0"
                >
                  <Star strokeWidth={2} className="w-5 h-5" />
                </button>
              </Tooltip>
            </div>
          ) : (
            <>
              <div className="px-3 flex flex-col gap-[3px] pt-0 mb-0 flex-none">
                    <button
                      onClick={() => setActiveEntityId('dashboard')}
                      className={clsx(
                        "sidebar-item-row flex items-center w-full cursor-pointer select-none rounded-[var(--radius-8)] px-3 h-7 group border border-transparent transition-all duration-0",
                        activeEntityId === 'dashboard'
                          ? "bg-[var(--bone-15)] text-[var(--bone-100)] font-medium tracking-wide"
                          : "bg-transparent text-[var(--bone-60)] hover:bg-[var(--bone-6)] hover:text-[var(--bone-100)]"
                      )}
                    >
                      <div className="w-7 shrink-0 flex items-center justify-center">
                        <LayoutDashboard strokeWidth={2} className="w-3.5 h-3.5" />
                      </div>
                      <span className="ml-0 flex-1 text-left text-[14px] tracking-wide">Dashboard</span>
                    </button>
                    <button
                      onClick={() => setActiveEntityId('tracker')}
                      className={clsx(
                        "sidebar-item-row flex items-center w-full cursor-pointer select-none rounded-[var(--radius-8)] px-3 h-7 group border border-transparent transition-all duration-0",
                        activeEntityId === 'tracker'
                          ? "bg-[var(--bone-15)] text-[var(--bone-100)] font-medium tracking-wide"
                          : "bg-transparent text-[var(--bone-60)] hover:bg-[var(--bone-6)] hover:text-[var(--bone-100)]"
                      )}
                    >
                      <div className="w-7 shrink-0 flex items-center justify-center">
                        <ListTodo strokeWidth={2} className="w-3.5 h-3.5" />
                      </div>
                      <span className="ml-0 flex-1 text-left text-[14px] tracking-wide">Tracker</span>
                    </button>
                     <div className="h-px bg-border/30 -mx-3 mt-[9px] mb-0" />
                  </div>

                  <div 
                    ref={mainScrollRef}
                    onScroll={onScroll}
                    onClick={(e) => {
                      // Clear multi-select when clicking on empty space (not on a sidebar item)
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
                          if (favoriteEntities.length === 0) return null;
                          return (
                            <div key="favorites" className="flex flex-col">
<div
                                  onClick={() => setIsFavoritesCollapsed(!isFavoritesCollapsed)}
                                  className={clsx(
                                    "ml-0 mr-[2px] px-3 py-[3px] flex items-center justify-between group cursor-pointer select-none rounded-[var(--radius-8)] transition-colors duration-0",
                                    contextMenu?.entityId === 'pinned'
                                      ? "!bg-[var(--bone-10)] text-[var(--bone-100)]"
                                      : "text-[var(--bone-60)] hover:text-[var(--bone-100)] hover:bg-[var(--bone-6)]"
                                  )}
                                >
                                  <span className="text-[10px] font-ui-label font-medium uppercase tracking-wide">Pinned</span>
                                  <div className="flex items-center gap-0.5">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        openContextMenu('pinned', rect.right, rect.top, 'sidebar-section');
                                      }}
                                      className={clsx(
                                        "btn-sidebar-utility",
                                        contextMenu?.entityId === 'pinned' && "!bg-[var(--bone-15)] !text-[var(--bone-100)] !opacity-100"
                                      )}
                                    >
                                      <MoreHorizontal strokeWidth={2} className="w-3.5 h-3.5" />
                                    </button>
                                    <ChevronDown strokeWidth={2} className={clsx("w-3.5 h-3.5", isFavoritesCollapsed ? "-rotate-90" : "rotate-0")} />
                                  </div>
                                </div>
                                <div 
                                  className={clsx(
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
                                       <SortableContext items={favoriteEntities.map(e => `pinned-${e.id}`)} strategy={verticalListSortingStrategy}>
                                         {favoriteEntities.map(entity => (
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
                          if (unsortedEntities.length === 0) return null;
                          return (
<div key="unsorted" className="flex flex-col">
                               <div
                                  onClick={() => setIsUnsortedCollapsed(!isUnsortedCollapsed)}
                                  className={clsx(
                                    "ml-0 mr-[2px] px-3 h-7 flex items-center justify-between group cursor-pointer select-none rounded-[var(--radius-8)] transition-colors duration-0",
                                    contextMenu?.entityId === 'unsorted'
                                      ? "!bg-[var(--bone-10)] text-[var(--bone-100)]"
                                      : "text-[var(--bone-60)] hover:text-[var(--bone-100)] hover:bg-[var(--bone-6)]"
                                  )}
                                >
                                  <span className="text-[10px] font-ui-label font-medium uppercase tracking-wide">Unsorted</span>
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        openContextMenu('unsorted', rect.right, rect.top, 'sidebar-section');
                                      }}
                                      className={clsx(
                                        "btn-sidebar-utility",
                                        contextMenu?.entityId === 'unsorted' && "!bg-[var(--bone-15)] !text-[var(--bone-100)] !opacity-100"
                                      )}
                                    >
                                      <MoreHorizontal strokeWidth={2} className="w-3.5 h-3.5" />
                                    </button>
                                    <ChevronDown strokeWidth={2} className={clsx("w-3.5 h-3.5", isUnsortedCollapsed ? "-rotate-90" : "rotate-0")} />
                                  </div>
                                </div>
                                <div 
                                  className={clsx(
                                    "grid transition-all duration-100 ease-out",
                                    !isUnsortedCollapsed ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                                  )}
                                >
                                  <div className="overflow-hidden">
                                    <div 
                                      className="pr-[4px] mr-[2px]" 
                                    >
                                      <DroppableZone id="unsorted-container" className="flex flex-col gap-[3px] mt-[3px] sidebar-list mb-2">
                                        <SortableContext items={unsortedEntities.map(e => e.id)} strategy={verticalListSortingStrategy}>
                                          {unsortedEntities.map(entity => (
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
                                  className={clsx(
                                    "ml-0 mr-[2px] px-3 h-7 flex items-center justify-between group cursor-pointer select-none rounded-[var(--radius-8)] transition-colors duration-0",
                                    contextMenu?.entityId === 'workspaces'
                                      ? "!bg-[var(--bone-10)] text-[var(--bone-100)]"
                                      : "text-[var(--bone-60)] hover:text-[var(--bone-100)] hover:bg-[var(--bone-6)]"
                                  )}
                                  onClick={() => setIsWorkspacesCollapsed(!isWorkspacesCollapsed)}
                                >
                                  <span className="text-[10px] font-ui-label font-medium uppercase tracking-wide">Workspaces</span>
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        openContextMenu('workspaces', rect.right, rect.top, 'sidebar-section');
                                      }}
                                      className={clsx(
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
                                    <ChevronDown strokeWidth={2} className={clsx("w-3.5 h-3.5", isWorkspacesCollapsed ? "-rotate-90" : "rotate-0")} />
                                  </div>
                                </div>
                                <div 
                                  className={clsx(
                                    "grid transition-all duration-100 ease-out",
                                    !isWorkspacesCollapsed ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                                  )}
                                >
                                  <div className="overflow-hidden">
                                    <div 
                                      className="pr-[4px] mr-[2px]" 
                                    >
                                      <DroppableZone id="workspaces-container" className="flex flex-col gap-[3px] mt-[3px] mb-2">
                                        <SortableContext items={workspaces.map(e => e.id)} strategy={verticalListSortingStrategy}>
                                          {workspaces.map(workspace => (
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
                </>
              )}
        </div>
      </div>

      <div className={clsx("p-3 border-t border-border flex items-center mt-auto", isSidebarCollapsed ? "flex-col gap-5 py-4" : "justify-between")}>
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--bone-15)] to-[var(--bone-6)] border border-[var(--bone-10)] flex items-center justify-center shrink-0 overflow-hidden">
            <span className="text-[10px] font-bold text-[var(--bone-60)] tracking-wide">M</span>
          </div>
          {!isSidebarCollapsed && (
             <div className="flex flex-col min-w-0">
<span className="text-xs font-semibold text-[var(--bone-100)] truncate tracking-wide">Misha</span>
                <span className="text-[10px] text-[var(--bone-60)] truncate tracking-wide">
                 {activeWorkspace?.name || 'Personal'}
               </span>
             </div>
          )}
        </div>
        <div className={clsx("flex items-center gap-1 shrink-0", isSidebarCollapsed && "flex-col gap-2")}>
          <Tooltip content="Spaces">
            <button 
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                openContextMenu(null, rect.left, rect.top, 'spaces');
              }}
              className={clsx("btn-sidebar-utility", contextMenu?.source === 'spaces' && "!bg-[var(--bone-15)] !text-[var(--bone-100)] !opacity-100")}
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
    </aside>
  );
});
