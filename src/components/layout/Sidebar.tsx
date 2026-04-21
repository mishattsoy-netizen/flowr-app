"use client";

import { useStore, EntityType, Entity } from '@/data/store';
import { getDescendantIds } from '@/data/store.helpers';
import { getEntityIcon } from '@/data/icons';

import { Search, LayoutDashboard, Star, ChevronRight, ChevronDown, Moon, Plus, ChevronLeft, Folder, Sun, X, FileText, Frame, Layers, MoreHorizontal, Settings, Columns, GripVertical } from 'lucide-react';
import { Toggle } from '../ui/Toggle';
import clsx from 'clsx';
import { useState, useMemo, useCallback } from 'react';
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
  const theme = useStore(state => state.theme);
  const toggleTheme = useStore(state => state.toggleTheme);
  const toggleFavorite = useStore(state => state.toggleFavorite);
  const storeWorkspaces = useStore(state => state.workspaces);
  const activeWorkspaceId = useStore(state => state.activeWorkspaceId);
  const reorderEntities = useStore(state => state.reorderEntities);

  const activeWorkspace = useMemo(
    () => storeWorkspaces.find(w => w.id === activeWorkspaceId),
    [storeWorkspaces, activeWorkspaceId]
  );

  const isEntityVisible = useMemo(() => (e: Entity) => {
    return (e.workspaceId || 'ws-personal') === activeWorkspaceId;
  }, [activeWorkspaceId]);

  const workspacesBase = useMemo(
    () => entities
      .filter(e => (e.type === 'collection' || e.type === 'workspace') && isEntityVisible(e))
      .sort((a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999)),
    [entities, isEntityVisible]
  );
  const favoriteEntitiesBase = useMemo(
    () => entities
      .filter(e => favoriteIds.includes(e.id) && isEntityVisible(e))
      .sort((a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999)),
    [entities, favoriteIds, isEntityVisible]
  );
  const unsortedEntitiesBase = useMemo(
    () => entities
      .filter(e => (e.type === 'note' || e.type === 'canvas' || e.type === 'mixed') && !e.parentId && isEntityVisible(e))
      .sort((a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999)),
    [entities, isEntityVisible]
  );

  // Local state for optimistic DnD ordering
  const [workspaces, setWorkspaces] = useState<Entity[]>([]);
  const [favoriteEntities, setFavoriteEntities] = useState<Entity[]>([]);
  const [unsortedEntities, setUnsortedEntities] = useState<Entity[]>([]);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  // Sync local state when store changes (but not during a drag)
  React.useEffect(() => { if (!activeDragId) setWorkspaces(workspacesBase); }, [workspacesBase, activeDragId]);
  React.useEffect(() => { if (!activeDragId) setFavoriteEntities(favoriteEntitiesBase); }, [favoriteEntitiesBase, activeDragId]);
  React.useEffect(() => { if (!activeDragId) setUnsortedEntities(unsortedEntitiesBase); }, [unsortedEntitiesBase, activeDragId]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  }, []);

const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // 1. Identify what we are dragging
    const isPinnedDrag = activeId.startsWith('pinned-');
    const entityId = isPinnedDrag ? activeId.replace('pinned-', '') : activeId;
    const entity = entities.find(e => e.id === entityId);
    if (!entity) return;

    // Workspaces and Collections are root-level only — never allow nesting inside another entity
    if (entity.type === 'workspace' || entity.type === 'collection') return;

    // 2. Identify where we are dropping (container or item)
    const overData = over.data.current;
    const containerId = overData?.sortable?.containerId || overId; 

    // 3. Logic: Dropped in "Pinned" section
    if (containerId === 'pinned-container' || overId === 'pinned-container' || overId.startsWith('pinned-')) {
      if (!favoriteIds.includes(entityId)) {
        toggleFavorite(entityId);
      }
      // Reorder logic within pinned
      const oldIndex = favoriteEntities.findIndex(e => e.id === entityId);
      const overEntityId = overId.startsWith('pinned-') ? overId.replace('pinned-', '') : overId;
      const newIndex = favoriteEntities.findIndex(e => e.id === overEntityId);
      
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        const reordered = arrayMove(favoriteEntities, oldIndex, newIndex);
        reorderEntities(reordered.map(e => e.id));
      }
      return;
    }

    // 4. Logic: Dropped in "Unsorted" or "Workspaces" (moving/unpinning)
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
      if (overEntity.type === 'folder' || overEntity.type === 'collection') {
        newParentId = overEntity.id;
        newWorkspaceId = overEntity.workspaceId;
      } else {
        newParentId = overEntity.parentId;
        newWorkspaceId = overEntity.workspaceId;
      }
    }

    // Guard: prevent self-parenting or dropping into own subtree (causes infinite recursion)
    if (newParentId === entityId) return;
    const descendantIds = getDescendantIds(entities, entityId);
    if (newParentId && descendantIds.includes(newParentId)) return;

    // Apply move if parent/workspace changed
    if (newParentId !== entity.parentId || newWorkspaceId !== entity.workspaceId) {
      moveEntityAction(entityId, newParentId, newWorkspaceId);
    }

    // 6. Handle Reordering
    // We need to find the new siblings and update their sortOrder
    const siblings = entities
      .filter(e => e.parentId === newParentId && (e.workspaceId || 'ws-personal') === (newWorkspaceId || 'ws-personal'))
      .sort((a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999));

    const oldIndex = siblings.findIndex(e => e.id === entityId);
    let newIndex = siblings.findIndex(e => e.id === overId);
    
    // If we dropped on a container, usually it means add to the end
    if (newIndex === -1) newIndex = siblings.length;

    if (oldIndex !== -1 || newIndex !== -1) {
      // Re-calculate siblings after move (entityId might have just been added to this list)
      const currentSiblings = entities
        .filter(e => e.id === entityId || (e.parentId === newParentId && (e.workspaceId || 'ws-personal') === (newWorkspaceId || 'ws-personal')))
        .sort((a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999));
      
      const fromIdx = currentSiblings.findIndex(e => e.id === entityId);
      let toIdx = currentSiblings.findIndex(e => e.id === overId);
      if (toIdx === -1) toIdx = currentSiblings.length - 1;

      if (fromIdx !== -1 && toIdx !== -1 && fromIdx !== toIdx) {
        const reordered = arrayMove(currentSiblings, fromIdx, toIdx);
        reorderEntities(reordered.map(e => e.id));
      }
    }
  }, [entities, favoriteIds, favoriteEntities, toggleFavorite, reorderEntities, activeWorkspaceId]);

  const [searchTerm, setSearchTerm] = useState('');
  const [isFavoritesCollapsed, setIsFavoritesCollapsed] = useState(false);
  const [isWorkspacesCollapsed, setIsWorkspacesCollapsed] = useState(false);
  const [isUnsortedCollapsed, setIsUnsortedCollapsed] = useState(false);
  const [sectionOrder] = useState(['favorites', 'unsorted', 'workspaces']);
  const [isMounted, setIsMounted] = useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  const searchResults = searchTerm.trim()
    ? entities.filter(e =>
      e.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (e.tags ?? []).some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
    )
    : [];

  const navItemClass = (isActive: boolean) => clsx(
    "sidebar-item-row flex items-center w-full cursor-pointer select-none text-sm group",
    "px-3 py-[3px] rounded-[var(--radius-8)]",
    isActive
      ? "bg-[var(--bone-6)] text-[var(--bone-100)] hover:bg-[var(--bone-10)]"
      : "bg-transparent text-[var(--bone-60)] hover:text-[var(--bone-100)] hover:bg-[var(--bone-6)]"
  );

  const iconHoverClass = () => clsx(
    "w-6 h-6 flex items-center justify-center rounded-[var(--radius-small)]",
    "text-[var(--bone-60)] group-hover:text-[var(--bone-60)] hover:!text-[var(--bone-100)] hover:bg-[var(--bone-6)]"
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

  // --- RENDER ---
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
      {/* Header */}
      <div className={clsx("flex items-center p-4 border-b border-border mb-4 group", isSidebarCollapsed ? "justify-center" : "justify-between")}>
        {!isSidebarCollapsed && (
          <img
            src={theme === 'dark' ? "/logo dark mode.svg" : "/logo light mode.svg"}
            className="h-7 object-contain "
            alt="Flowr"
          />
        )}
        <div className="flex items-center gap-3 shrink-0">
          {!isSidebarCollapsed && (
            <div className="flex items-center gap-2 mr-1 group-hover:opacity-100">
              <Tooltip content={isSidebarPinned ? "Sidebar Pinned" : "Auto-collapse Sidebar"}>
                <Toggle 
                  checked={isSidebarPinned} 
                  onChange={toggleSidebarPinned}
                  className="scale-[0.6] origin-right"
                />
              </Tooltip>
            </div>
          )}
          <Tooltip content={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}>
            <button
              onClick={toggleSidebar}
              className="p-1 rounded-[var(--radius-8)] hover:bg-[var(--bone-6)] text-[var(--bone-60)] hover:text-[var(--bone-100)] shrink-0"
            >
              {isSidebarCollapsed ? <LogoSimple className="w-6 h-6" /> : <ChevronLeft strokeWidth={2} className="w-6 h-6" />}
            </button>
          </Tooltip>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Workspace Switcher */}
        {!isSidebarCollapsed && <WorkspaceSwitcher />}

        {/* Search */}
        <div className="px-3 pt-1 pb-1.5">
          {isSidebarCollapsed ? (
            <Tooltip content="Search">
              <button
                onClick={toggleSidebar}
                className="w-10 h-10 mx-auto flex items-center justify-center rounded-[var(--radius-8)] text-[var(--bone-60)] hover:bg-[var(--bone-6)] hover:text-[var(--bone-100)] "
              >
                <Search className="w-5 h-5" />
              </button>
            </Tooltip>
          ) : (
            <div className="flex items-center w-full px-4 py-2 bg-[var(--bone-6)] border border-[var(--bone-6)] rounded-[var(--radius-8)] focus-within:border-accent/30 group relative">
              <div className="w-5 shrink-0 flex items-center justify-center">
                <Search strokeWidth={2} className="w-4.5 h-4.5 text-[var(--bone-60)] group-focus-within:text-accent shrink-0" />
              </div>
              <input
                type="text"
                placeholder="Search pages..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="bg-transparent outline-none text-foreground placeholder:text-[var(--icon-default)] w-full text-sm ml-[10px] px-0 m-0 truncate"
              />
              {searchTerm && (
                <Tooltip content="Clear Search">
                  <button onClick={() => setSearchTerm('')} className="absolute right-2 p-1 text-[var(--bone-30)] group-hover:text-[var(--bone-60)] hover:text-[var(--bone-100)] rounded-[var(--radius-8)] ">
                    <X strokeWidth={2} className="w-3.5 h-3.5" />
                  </button>
                </Tooltip>
              )}
            </div>
          )}
        </div>



        {/* Scrollable Area */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {!isMounted ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-accent/20 border-t-accent rounded-[var(--radius-8)] animate-spin" />
            </div>
          ) : isSidebarCollapsed ? (
            <div className="flex-1 overflow-y-auto px-3 pb-4 flex flex-col items-center gap-3 w-full scrollbar-none">
              <Tooltip content="Dashboard">
                <button
                  onClick={() => setActiveEntityId('dashboard')}
                  className={clsx(
                    "p-2 rounded-[var(--radius-8)]  w-10 h-10 flex items-center justify-center border hover:bg-[var(--bone-6)]",
                    activeEntityId === 'dashboard'
                      ? "bg-[var(--bone-6)] border-transparent text-[var(--bone-100)]"
                      : "border-transparent text-[var(--bone-60)] hover:text-[var(--bone-100)]"
                  )}
                >
                  <LayoutDashboard 
                    strokeWidth={2}
                    className={clsx(
                      "w-4 h-4 ",
                      activeEntityId === 'dashboard' ? "text-[var(--bone-100)]" : "text-[var(--bone-60)] group-hover:text-[var(--bone-100)]"
                    )} 
                  />
                </button>
              </Tooltip>
              <Tooltip content="Tracker">
                <button
                  onClick={() => setActiveEntityId('tracker')}
                  className={clsx(
                    "p-2 rounded-[var(--radius-8)]  w-10 h-10 flex items-center justify-center border hover:bg-[var(--bone-6)]",
                    activeEntityId === 'tracker'
                      ? "bg-[var(--bone-6)] border-transparent text-[var(--bone-100)]"
                      : "border-transparent text-[var(--bone-60)] hover:text-[var(--bone-100)]"
                  )}
                >
                  <Columns 
                    strokeWidth={2}
                    className={clsx(
                      "w-4 h-4 ",
                      activeEntityId === 'tracker' ? "text-[var(--bone-100)]" : "text-[var(--bone-60)] group-hover:text-[var(--bone-100)]"
                    )} 
                  />
                </button>
              </Tooltip>



              <div className="w-8 h-px bg-border my-1" />

              <Tooltip content="Pinned items">
                <button
                  onClick={toggleSidebar}
                  className="p-2 rounded-[var(--radius-8)] text-[var(--bone-60)] hover:bg-[var(--bone-6)] hover:text-[var(--bone-100)]  w-10 h-10 flex items-center justify-center group"
                >
                  <Star strokeWidth={2} className="w-5 h-5 text-[var(--bone-60)] group-hover:text-[var(--bone-100)] " />
                </button>
              </Tooltip>

              {workspaces.map(workspace => {
                const isActive = activeEntityId === workspace.id;
                return (
                  <div key={workspace.id} className={navItemClass(isActive)} onClick={() => setActiveEntityId(workspace.id)}>
                    {getSmallIcon('collection', workspace)}
                    <span className="flex-1 truncate text-left">{workspace.title}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <>
              {searchTerm.trim() ? (
                <div className="flex-1 overflow-y-auto px-3 pb-4 scrollbar-thin pt-4">
                  <div className="px-3 mb-1 flex-none">
                    <span className="text-[10px] font-medium text-[var(--icon-default)]">Search Results</span>
                  </div>
                  {searchResults.length > 0 ? (
                    <div className="flex flex-col border border-border/50 rounded-xl overflow-hidden sidebar-list">
                      {searchResults.map(entity => {
                        const isItemActive = activeEntityId === entity.id;
                        return (
                          <div key={entity.id} className="sidebar-item-wrapper" data-selected={isItemActive || undefined}>
                            <button
                              onClick={() => {
                                setActiveEntityId(entity.id);
                                setSearchTerm('');
                              }}
                              className={clsx(
                                navItemClass(isItemActive),
                                entity.type === 'collection' ? "text-sm" : "text-sm"
                              )}
                              style={{ paddingLeft: '12px', paddingRight: '12px', paddingTop: '6px', paddingBottom: '6px' }}
                            >
                              <div className="w-4 shrink-0 flex items-center justify-center" />
                              <div className="ml-2 flex items-center justify-center w-4 shrink-0">
                                {getSmallIcon(entity.type, entity, true)}
                              </div>
                              <span className="truncate ml-[10px] flex-1 text-left">{entity.title}</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="px-3 py-2 text-sm text-[var(--icon-default)] italic">No results found.</div>
                  )}
                </div>
              ) : (
                <>
                  {/* Dashboard Section - Always Static */}
                  <div className="px-3 space-y-0.5 pt-0 mb-0 flex-none">
                    {/* Dashboard */}
                      <button
                        onClick={() => setActiveEntityId('dashboard')}
                        data-selected={activeEntityId === 'dashboard' || undefined}
                        className={clsx(
                          "flex items-center w-full cursor-pointer select-none text-sm rounded-[var(--radius-8)] group border border-transparent",
                          activeEntityId === 'dashboard'
                            ? "bg-[var(--bone-6)] text-[var(--bone-100)] hover:bg-[var(--bone-10)]"
                            : "bg-transparent text-[var(--bone-60)] hover:bg-[var(--bone-6)] hover:text-[var(--bone-100)]"
                        )}
                        style={{ paddingLeft: '6px', paddingRight: '6px', paddingTop: '5px', paddingBottom: '5px' }}
                      >
                        <div className="w-5 shrink-0 flex items-center justify-center">
                          <LayoutDashboard strokeWidth={2} className={clsx("w-4.5 h-4.5 shrink-0", activeEntityId === 'dashboard' ? "text-[var(--bone-100)]" : "text-[var(--bone-60)] group-hover:text-[var(--bone-100)]")} />
                        </div>
                        <span className={clsx("ml-[10px] flex-1 truncate text-left text-[14px] font-medium", activeEntityId === 'dashboard' ? "text-[var(--bone-100)]" : "text-[var(--bone-60)] group-hover:text-[var(--bone-100)]")}>Dashboard</span>
                      </button>
                      {/* Tracker */}
                      <button
                        onClick={() => setActiveEntityId('tracker')}
                        data-selected={activeEntityId === 'tracker' || undefined}
                        className={clsx(
                          "flex items-center w-full cursor-pointer select-none text-sm rounded-[var(--radius-8)] group border border-transparent",
                          activeEntityId === 'tracker'
                            ? "bg-[var(--bone-6)] text-[var(--bone-100)] hover:bg-[var(--bone-10)]"
                            : "bg-transparent text-[var(--bone-60)] hover:bg-[var(--bone-6)] hover:text-[var(--bone-100)]"
                        )}
                        style={{ paddingLeft: '6px', paddingRight: '6px', paddingTop: '5px', paddingBottom: '5px' }}
                      >
                        <div className="w-5 shrink-0 flex items-center justify-center">
                          <Columns strokeWidth={2} className={clsx("w-4.5 h-4.5 shrink-0", activeEntityId === 'tracker' ? "text-[var(--bone-100)]" : "text-[var(--bone-60)] group-hover:text-[var(--bone-100)]")} />
                        </div>
                        <span className={clsx("ml-[10px] flex-1 truncate text-left text-[14px] font-medium", activeEntityId === 'tracker' ? "text-[var(--bone-100)]" : "text-[var(--bone-60)] group-hover:text-[var(--bone-100)]")}>Tracker</span>
                      </button>





                    <div className="h-px bg-border/30 -mx-3 mt-0.5 mb-0.5" />
                  </div>

                  <div className="flex-1 overflow-y-auto scrollbar-none pb-4 [scrollbar-gutter:stable] -mx-3 px-3">
                    <DndContext
                      sensors={sensors}
                      collisionDetection={rectIntersection}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      modifiers={[restrictToVerticalAxis]}
                    >
                      {/* Favorites Section */}
                      {sectionOrder.map((sectionId) => {
                        if (sectionId === 'favorites') {
                          if (favoriteEntities.length === 0) return null;
                          return (
                            <div key="favorites" className="flex flex-col">
                              <div
                                onClick={() => setIsFavoritesCollapsed(!isFavoritesCollapsed)}
                                className="px-4 pt-1.5 pb-0.5 flex items-center justify-between group cursor-pointer select-none text-[var(--bone-30)] hover:text-[var(--bone-100)]"
                              >
                                <div className="flex items-center">
                                  <span className="text-[10px] font-ui-label font-medium">Pinned</span>
                                </div>
                                <div className="flex items-center mt-[1px]">
                                  <Tooltip content={isFavoritesCollapsed ? "Expand Pinned" : "Collapse Pinned"}>
                                    <div className="w-6 h-6 flex items-center justify-center rounded-[var(--radius-small)] text-[var(--bone-30)] hover:text-[var(--bone-100)] hover:bg-[var(--bone-6)]">
                                      <ChevronDown strokeWidth={2} className={clsx("w-3.5 h-3.5", isFavoritesCollapsed ? "-rotate-90" : "rotate-0")} />
                                    </div>
                                  </Tooltip>
                                </div>
                              </div>

                              <div className={clsx(
                                "grid transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
                                isFavoritesCollapsed ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"
                              )}>
                                <div className="overflow-hidden">
                                  <DroppableZone id="pinned-container" className="flex flex-col gap-0.5 mt-0.5 sidebar-list mb-2 px-3">
                                    <SortableContext items={favoriteEntities.map(e => `pinned-${e.id}`)} strategy={verticalListSortingStrategy}>
                                      {favoriteEntities.map(entity => (
                                        <TreeItem 
                                          key={`pinned-${entity.id}`} 
                                          entity={entity} 
                                          depth={0} 
                                          idOverride={`pinned-${entity.id}`} 
                                        />
                                      ))}
                                    </SortableContext>
                                  </DroppableZone>
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
                                className="px-4 pt-1.5 pb-0.5 flex items-center justify-between group cursor-pointer select-none text-[var(--bone-30)] hover:text-[var(--bone-100)]"
                              >
                                <div className="flex items-center">
                                  <span className="text-[10px] font-ui-label font-medium">Unsorted</span>
                                </div>
                                <div className="flex items-center mt-[1px]">
                                  <Tooltip content={isUnsortedCollapsed ? "Expand Unsorted" : "Collapse Unsorted"}>
                                    <div className="w-6 h-6 flex items-center justify-center rounded-[var(--radius-small)] text-[var(--bone-30)] hover:text-[var(--bone-100)] hover:bg-[var(--bone-6)]">
                                      <ChevronDown strokeWidth={2} className={clsx("w-3.5 h-3.5", isUnsortedCollapsed ? "-rotate-90" : "rotate-0")} />
                                    </div>
                                  </Tooltip>
                                </div>
                              </div>

                              <div className={clsx(
                                "grid transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
                                isUnsortedCollapsed ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"
                              )}>
                                <div className="overflow-hidden">
                                  <DroppableZone id="unsorted-container" className="flex flex-col gap-0.5 mt-0.5 sidebar-list mb-2 px-3">
                                    <SortableContext items={unsortedEntities.map(e => e.id)} strategy={verticalListSortingStrategy}>
                                      {unsortedEntities.map(entity => (
                                        <TreeItem key={entity.id} entity={entity} depth={0} />
                                      ))}
                                    </SortableContext>
                                  </DroppableZone>
                                </div>
                              </div>
                            </div>
                          );
                        }

                        if (sectionId === 'workspaces') {
                          return (
                            <div key="workspaces" className="flex flex-col">
                              <div
                                className="px-4 pt-1.5 pb-0.5 flex items-center justify-between group cursor-pointer select-none text-[var(--bone-30)] hover:text-[var(--bone-100)]"
                                onClick={() => setIsWorkspacesCollapsed(!isWorkspacesCollapsed)}
                              >
                                <div className="flex items-center">
                                  <span className="text-[10px] font-ui-label font-medium">Workspaces</span>
                                </div>
                                <div className="flex items-center gap-0.5">
                                  <Tooltip content="New workspace">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openModal({ kind: 'newCollection' });
                                      }}
                                      className="p-1 hover:bg-[var(--bone-6)] rounded-[var(--radius-small)] text-[var(--bone-30)] hover:text-[var(--bone-100)]"
                                    >
                                      <Plus strokeWidth={2} className="w-3.5 h-3.5" />
                                    </button>
                                  </Tooltip>
                                  <Tooltip content={isWorkspacesCollapsed ? "Expand" : "Collapse"}>
                                    <div className="w-6 h-6 flex items-center justify-center rounded-[var(--radius-small)] text-[var(--bone-30)] hover:text-[var(--bone-100)] hover:bg-[var(--bone-6)]">
                                      <ChevronDown strokeWidth={2} className={clsx("w-3.5 h-3.5", isWorkspacesCollapsed ? "-rotate-90" : "rotate-0")} />
                                    </div>
                                  </Tooltip>
                                </div>
                              </div>

                              <div className={clsx(
                                "grid transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
                                isWorkspacesCollapsed ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"
                              )}>
                                <div className="overflow-hidden">
                                  <DroppableZone id="workspaces-container" className="space-y-0.5 px-3 mb-2">
                                    <SortableContext items={workspaces.map(e => e.id)} strategy={verticalListSortingStrategy}>
                                      {workspaces.map(workspace => (
                                        <TreeItem key={workspace.id} entity={workspace} depth={0} />
                                      ))}
                                    </SortableContext>
                                  </DroppableZone>
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
            </>
          )}
        </div>
      </div>

      {/* Account Footer */}
      <div className={clsx("p-3 border-t border-border flex items-center mt-auto", isSidebarCollapsed ? "flex-col gap-4" : "justify-between")}>
        {isSidebarCollapsed ? (
          <>
            <Tooltip content="Toggle Theme">
              <button onClick={toggleTheme} className="p-1.5 rounded-[var(--radius-medium)] hover:bg-[var(--bone-6)] text-[var(--bone-60)] hover:text-[var(--bone-100)] shrink-0">
                {theme === 'dark' ? <Moon strokeWidth={2} className="w-5 h-5" /> : <Sun strokeWidth={2} className="w-5 h-5" />}
              </button>
            </Tooltip>
            <Tooltip content="Settings">
              <button onClick={() => openModal({ kind: 'settings' })} className="p-1.5 rounded-[var(--radius-medium)] hover:bg-[var(--bone-6)] text-[var(--bone-60)] hover:text-[var(--bone-100)] shrink-0">
                <Settings strokeWidth={2} className="w-5 h-5" />
              </button>
            </Tooltip>
            <div className="w-8 h-8 rounded-[var(--radius-medium)] bg-panel border border-border flex items-center justify-center text-xs font-medium text-[var(--icon-default)]">
              M
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-[var(--radius-medium)] bg-panel border border-border flex items-center justify-center text-xs font-medium text-[var(--icon-default)] ">
                M
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-foreground leading-tight">Account Name</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Tooltip content={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}>
                <button onClick={toggleTheme} className="p-1.5 rounded-[var(--radius-medium)] hover:bg-[var(--bone-6)] text-[var(--bone-60)] hover:text-[var(--bone-100)] shrink-0">
                  {theme === 'dark' ? <Moon strokeWidth={2} className="w-5 h-5" /> : <Sun strokeWidth={2} className="w-5 h-5" />}
                </button>
              </Tooltip>
              <Tooltip content="Settings">
                <button onClick={() => openModal({ kind: 'settings' })} className="p-1.5 rounded-[var(--radius-medium)] hover:bg-[var(--bone-6)] text-[var(--bone-60)] hover:text-[var(--bone-100)] shrink-0">
                  <Settings strokeWidth={2} className="w-5 h-5" />
                </button>
              </Tooltip>
            </div>
          </>
        )}
      </div>
    </aside>
  );
});


