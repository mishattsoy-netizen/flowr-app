"use client";

import { useStore, generateId } from '@/data/store';
import { useAuth } from '@/components/AuthProvider';
import type { EntityType, Entity, SidebarSectionId } from '@/data/store';
import { getDescendantIds } from '@/data/store.helpers';
import { getEntityIcon } from '@/data/icons';

import { Search, LayoutDashboard, Star, ChevronRight, ChevronDown, Moon, Plus, ChevronLeft, Folder, Sun, X, FileText, Frame, Layers, MoreHorizontal, Settings, Columns, GripVertical, Activity, ListTodo, ChevronsUpDown, MessageSquare, Calendar, Clock, Trash2, Pencil, ExternalLink, PanelLeft } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import { Toggle } from '../ui/Toggle';
import { cn } from '@/lib/utils';
import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useDeferredLoading } from '@/hooks/use-deferred-loading';
import { TreeItem } from './TreeItem';
import { ScrollArea } from './ScrollArea';
import { Tooltip } from './Tooltip';
import { useTooltipSuppression } from './TooltipOverlayContext';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import InstallButton from '@/components/pwa/InstallButton';
import { SidebarSkeleton } from './SidebarSkeleton';
import { ChatHistorySkeleton } from '../chat/ChatSkeleton';
import React from 'react';
import { stripHtml } from '@/lib/utils';
import { monitorForElements, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';

function arrayMove<T>(array: T[], from: number, to: number): T[] {
  const newArray = array.slice();
  newArray.splice(to < 0 ? newArray.length + to : to, 0, newArray.splice(from, 1)[0]);
  return newArray;
}

function DroppableZone({ id, children, className }: { id: string, children: React.ReactNode, className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return dropTargetForElements({
      element: el,
      getData: () => ({ id }),
    });
  }, [id]);
  return <div ref={ref} className={className}>{children}</div>;
}

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
  const isTabsHeaderVisible = useStore(state => state.isTabsHeaderVisible);
  const { theme: currentTheme, setTheme, resolvedTheme } = useTheme();
  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  }, [resolvedTheme, setTheme]);
  const toggleFavorite = useStore(state => state.toggleFavorite);
  const storeWorkspaces = useStore(state => state.workspaces);
  const allTasks = useStore(state => state.tasks);
  const activeWorkspaceId = useStore(state => state.activeWorkspaceId);
  const trackerFilterWorkspace = useStore(state => state.trackerFilterWorkspace);
  const setTrackerFilterWorkspace = useStore(state => state.setTrackerFilterWorkspace);
  const reorderEntities = useStore(state => state.reorderEntities);
  const sidebarSectionSettings = useStore(state => state.sidebarSectionSettings);
  const hiddenEntityIds = useStore(state => state.hiddenEntityIds);
  const setSectionSortMode = useStore(state => state.setSectionSortMode);
  const contextMenu = useStore(state => state.contextMenu);
  const selectedSidebarIds = useStore(state => state.selectedSidebarIds);
  const setSelectedSidebarIds = useStore(state => state.setSelectedSidebarIds);
  const clearSelectedSidebarIds = useStore(state => state.clearSelectedSidebarIds);
  const addEntity = useStore(state => state.addEntity);

  const { user } = useAuth();
  const sidebarDisplayName = user?.user_metadata?.display_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Guest';
  const sidebarInitial = sidebarDisplayName.charAt(0).toUpperCase();
  const sidebarAvatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture || '';

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
  const [newPagePopupPos, setNewPagePopupPos] = useState<{ x: number, y: number } | null>(null);
  const [chatCollapsed, setChatCollapsed] = useState<Record<string, boolean>>({});
  const chatEditInputRef = useRef<HTMLInputElement>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [storeHydrated, setStoreHydrated] = useState(false);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  // Suppress tooltips while any sidebar item is being dragged
  useTooltipSuppression(activeDragId !== null);
  const lastClickedRef = useRef<string | null>(null);
  const theme = isMounted ? resolvedTheme : currentTheme;

  const sidebarRef = useRef<HTMLElement>(null);
  const mainScrollRef = React.useRef<HTMLDivElement>(null);
  const pinnedScrollRef = React.useRef<HTMLDivElement>(null);
  const chatScrollRef = React.useRef<HTMLDivElement>(null);

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
    const groups: Record<string, typeof convs> = { Today: [], 'Last 7 days': [], 'Last 30 days': [], Older: [] };
    for (const c of convs) {
      const age = now - new Date(c.updated_at).getTime();
      if (age < oneDayMs) groups['Today'].push(c);
      else if (age < oneDayMs * 7) groups['Last 7 days'].push(c);
      else if (age < oneDayMs * 30) groups['Last 30 days'].push(c);
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

  const displayWorkspaces = workspacesBase;
  const displayFavorites = favoriteEntitiesBase;
  const displayUnsorted = unsortedEntitiesBase;

  // Build a flat list of all selectable entity IDs (pinned + unsorted — NOT workspaces)
  const selectableIds = useMemo(() => {
    const ids: string[] = [];
    favoriteEntitiesBase.forEach(e => ids.push(e.id));
    unsortedEntitiesBase.forEach(e => ids.push(e.id));
    return ids;
  }, [favoriteEntitiesBase, unsortedEntitiesBase]);

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

  // True while a pinned item is being dragged OUTSIDE the pinned section — the
  // overlay clone then shows an "unpin" hint, since dropping there only unpins.
  const [showUnpinHint, setShowUnpinHint] = useState(false);

  useEffect(() => {
    return monitorForElements({
      canMonitor: ({ source }) => source.data.type === 'tree-item',
      onDragStart: ({ source }) => {
        setActiveDragId(source.data.id as string);
        setShowUnpinHint(false);
        document.body.style.cursor = 'grabbing';
      },
      onDropTargetChange: ({ source, location }) => {
        const activeId = source.data.id as string;
        if (!activeId || !activeId.startsWith('pinned-')) {
          setShowUnpinHint(false);
          return;
        }
        const target = location.current.dropTargets[0];
        if (!target) {
          setShowUnpinHint(true);
          return;
        }
        const overId = target.data.id as string;
        const inPinned = overId === 'pinned-container' || overId.startsWith('pinned-');
        setShowUnpinHint(!inPinned);
      },
      onDrop: ({ source, location }) => {
        setActiveDragId(null);
        setShowUnpinHint(false);
        document.body.style.cursor = '';
        try {
          const target = location.current.dropTargets[0];
          if (!target) return;

          const activeId = source.data.id as string;
          let overId = target.data.id as string;
          if (!activeId || !overId) return;

          const isPinnedDrag = source.data.isPinned as boolean;
          const entityId = isPinnedDrag ? activeId.replace('pinned-', '') : activeId;
          const entity = entities.find(e => e.id === entityId);
          if (!entity) return;

          const isDraggingWorkspace = entity.type === 'workspace' || entity.type === 'collection';

          // Look up overEntity early so the edge calculation can check the target type.
          let overEntity = entities.find(e => e.id === overId);

          // Helper to get visually sorted siblings matching the target entity's section sort mode
          const getSortedSiblings = (targetEntity: Entity) => {
            const freshEntities = useStore.getState().entities;
            const hiddenEntityIds = useStore.getState().hiddenEntityIds;
            const isWorkspaceOrCollection = (type: EntityType) => type === 'workspace' || type === 'collection';
            
            const getSectionId = (): 'workspaces' | 'unsorted' | null => {
              if (targetEntity.parentId && freshEntities.some(p => p.id === targetEntity.parentId)) return null;
              return isWorkspaceOrCollection(targetEntity.type) ? 'workspaces' : 'unsorted';
            };

            const getSectionSiblings = () => {
              const sectionId = getSectionId();
              if (sectionId === 'workspaces') {
                return freshEntities.filter(e => 
                  (e.type === 'workspace' || e.type === 'collection') && 
                  (!e.parentId || !freshEntities.some(p => p.id === e.parentId)) &&
                  (e.workspaceId || 'ws-personal') === (targetEntity.workspaceId || 'ws-personal') &&
                  !hiddenEntityIds.includes(e.id)
                );
              }
              if (sectionId === 'unsorted') {
                return freshEntities.filter(e => 
                  (e.type === 'note' || e.type === 'canvas' || e.type === 'mixed') && 
                  (!e.parentId || !freshEntities.some(p => p.id === e.parentId)) &&
                  (e.workspaceId || 'ws-personal') === (targetEntity.workspaceId || 'ws-personal') &&
                  !hiddenEntityIds.includes(e.id)
                );
              }
              return freshEntities.filter(e => e.parentId === targetEntity.parentId && !hiddenEntityIds.includes(e.id));
            };

            const sortSiblings = (items: Entity[]) => {
              const sectionId = getSectionId();
              if (!sectionId) {
                return [...items].sort((a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999));
              }
              const settings = useStore.getState().sidebarSectionSettings;
              const mode = settings?.[sectionId]?.sortMode || 'lastModified';
              if (mode === 'alphabetical') {
                return [...items].sort((a, b) => a.title.localeCompare(b.title));
              }
              if (mode === 'lastModified') {
                return [...items].sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0));
              }
              return [...items].sort((a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999));
            };

            return sortSiblings(getSectionSiblings());
          };

          // Retrieve edge directly from target data to ensure it aligns with the
          // visual indicator zone, bypassing coordinate retrieval which can be
          // missing/stale on final drop.
          let edge = target.data.edge as string | null | undefined;
          let isInsertInsideBottom = target.data.isInsertInsideBottom === true;
          if (target.data.isAfterFolder === true) {
            if (entity.parentId === overId) {
              // Dragged item is already inside this folder — reorder to last
              // position within the folder instead of moving outside.
              edge = null;
              isInsertInsideBottom = true;
            } else {
              edge = 'bottom';
            }
          }
          if (isInsertInsideBottom) {
            edge = null;
          }
          if (edge === undefined) {
            edge = null;
          }

          // Bottom-edge redirect: if the target is an expanded folder, redirect bottom edge
          // to top edge of its first child (if it has children) to match visual insertion line.
          const collapsedIds = useStore.getState().collapsedIds;
          const isOverFolder = overEntity && (overEntity.type === 'folder' || overEntity.type === 'collection' || overEntity.type === 'workspace');
          const isOverExpanded = isOverFolder && !collapsedIds.includes(overId);
          if (edge === 'bottom' && isOverExpanded) {
            const folderChildren = entities
              .filter(e => e.parentId === overId && !hiddenEntityIds.includes(e.id))
              .sort((a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999));
            if (folderChildren.length > 0) {
              overId = folderChildren[0].id;
              overEntity = folderChildren[0];
              edge = 'top';
            } else {
              edge = null;
            }
          }

          // Top-edge redirect: if the sibling above (at the same parent level) has
          // expanded children, redirect the top edge to "nest inside that sibling"
          // (at the end of its children) — same visual logic as the gap after its
          // expanded children.
          if (edge === 'top' && overEntity && !isDraggingWorkspace) {
            const siblings = getSortedSiblings(overEntity);
            const idx = siblings.findIndex(e => e.id === overEntity!.id);
            if (idx > 0) {
              const prev = siblings[idx - 1];
              const hasChildren = entities.some(e => e.parentId === prev.id);
              if (hasChildren && !collapsedIds.includes(prev.id)) {
                overId = prev.id;
                overEntity = prev;
                edge = null;
              }
            }
          }

          // Early return on no-op drops (dragging on itself or adjacent no-op edges)
          if (activeId === overId) return;

          if (edge !== null && overEntity) {
            if ((entity.parentId || null) === (overEntity.parentId || null) && (entity.workspaceId || null) === (overEntity.workspaceId || null)) {
              const isWorkspaceOrCollection = (type: EntityType) => type === 'workspace' || type === 'collection';
              const isDragWS = isWorkspaceOrCollection(entity.type);
              const isTargetWS = isWorkspaceOrCollection(overEntity.type);

              if (isDragWS === isTargetWS) {
                const siblings = getSortedSiblings(overEntity);
                const dragIdx = siblings.findIndex(e => e.id === entityId);
                const targetIdx = siblings.findIndex(e => e.id === overEntity.id);
                if (dragIdx !== -1 && targetIdx !== -1) {
                  if (targetIdx === dragIdx - 1 && edge === 'bottom') {
                    return; // No-op drop
                  }
                  if (targetIdx === dragIdx + 1 && edge === 'top') {
                    return; // No-op drop
                  }
                }
              }
            }
          }

          // Dropping in pinned section
          if (overId === 'pinned-container' || overId.startsWith('pinned-')) {
            const overEntityId = overId.startsWith('pinned-') ? overId.replace('pinned-', '') : overId;
            const oldIndex = favoriteEntitiesBase.findIndex(e => e.id === entityId);
            let newIndex = favoriteEntitiesBase.findIndex(e => e.id === overEntityId);
            if (edge === 'bottom') newIndex += 1;

            // Early return on adjacent no-op pinned drops
            if (oldIndex !== -1 && newIndex !== -1) {
              if (newIndex === oldIndex || newIndex === oldIndex + 1) {
                return;
              }
            }

            if (!favoriteIds.includes(entityId)) {
              toggleFavorite(entityId);
            }

            if (oldIndex !== -1 && newIndex !== -1) {
              const insertAt = oldIndex < newIndex ? newIndex - 1 : newIndex;
              if (oldIndex !== insertAt) {
                const reordered = arrayMove(favoriteEntitiesBase, oldIndex, insertAt);
                reorderEntities(reordered.map(e => e.id));
                setSectionSortMode('pinned', 'manual');
              }
            }
            return;
          }

          // A pinned item is just a shortcut to the real entity. Dragging it OUT of
          // the pinned section unpins it only — it must never move or reorder the
          // underlying entity in workspaces/unsorted.
          if (isPinnedDrag) {
            toggleFavorite(entityId);
            return;
          }

          const moveEntityAction = useStore.getState().moveEntity;

          let newParentId: string | null = entity.parentId;
          let newWorkspaceId = entity.workspaceId;

          if (overId === 'unsorted-container') {
            newParentId = null;
            newWorkspaceId = 'ws-personal';
          } else if (overId === 'workspaces-container') {
            newParentId = null;
            newWorkspaceId = activeWorkspaceId;
          } else if (overEntity) {
            if (overEntity.type === 'folder' || overEntity.type === 'collection' || overEntity.type === 'workspace') {
              if (edge === null) {
                newParentId = overEntity.id;
                newWorkspaceId = overEntity.workspaceId;
              } else {
                newParentId = overEntity.parentId;
                newWorkspaceId = overEntity.workspaceId;
              }
            } else {
              newParentId = overEntity.parentId;
              newWorkspaceId = overEntity.workspaceId;
            }
          }

          // Enforce depth constraint: only allow outdenting by at most 1 level per drag within the same workspace and same folder tree
          if (newWorkspaceId === entity.workspaceId && newParentId) {
            const getRootAncestorId = (id: string): string => {
              let cur = entities.find(e => e.id === id);
              while (cur && cur.parentId) {
                const pId = cur.parentId;
                const parent = entities.find(p => p.id === pId);
                if (!parent) break;
                cur = parent;
              }
              return cur ? cur.id : id;
            };

            const dragRootId = getRootAncestorId(entityId);
            const targetRootId = getRootAncestorId(newParentId);

            if (dragRootId === targetRootId) {
              const getEntityDepth = (entId: string | null): number => {
                if (!entId) return 0;
                let d = 0;
                let cur = entities.find(e => e.id === entId);
                while (cur && cur.parentId) {
                  d++;
                  const pId = cur.parentId;
                  cur = entities.find(e => e.id === pId);
                }
                return d;
              };

              const dragDepth = getEntityDepth(entity.parentId) + 1;
              const newDepth = getEntityDepth(newParentId) + 1;

              if (newDepth < dragDepth - 1) {
                const getAncestorAtDepth = (entId: string, targetD: number): string => {
                  let cur = entities.find(e => e.id === entId);
                  const path: string[] = [];
                  while (cur) {
                    path.unshift(cur.id);
                    const pId = cur.parentId;
                    cur = pId ? entities.find(e => e.id === pId) : undefined;
                  }
                  return path[targetD] || entId;
                };
                newParentId = getAncestorAtDepth(entityId, dragDepth - 2);
              }
            }
          }

          const normParent = (id: string | null | undefined) => id || null;
          const normWS = (id: string | null | undefined) => id || 'ws-personal';
          if (normParent(newParentId) === normParent(entity.parentId) && normWS(newWorkspaceId) === normWS(entity.workspaceId) && edge === null && !isInsertInsideBottom) {
            return; // No-op: dropped inside its current parent container
          }

          if (newParentId === entityId) return;
          const descendantIds = getDescendantIds(entities, entityId);
          if (newParentId && descendantIds.includes(newParentId)) return;

          // Guard: folders must always have a parent — a folder with parentId: null
          // is invisible in the sidebar (it matches neither the workspaces section
          // nor the unsorted section). Block the move entirely.
          const isRootOnlyType = entity.type === 'workspace' || entity.type === 'collection';
          if (!newParentId && !isRootOnlyType && entity.type === 'folder') return;

          if (newParentId !== entity.parentId || newWorkspaceId !== entity.workspaceId) {
            moveEntityAction(entityId, newParentId, newWorkspaceId);
          }

          const freshEntities = useStore.getState().entities;
          const movedEntity = freshEntities.find(e => e.id === entityId);
          
          // Retrieve visual siblings sorted according to current section/active settings
          const visualSiblings = getSortedSiblings(movedEntity || entity);

          const fromIdx = visualSiblings.findIndex(e => e.id === entityId);
          let toIdx = visualSiblings.findIndex(e => e.id === overId);
          if (toIdx === -1) {
            toIdx = visualSiblings.length;
          } else if (edge === 'bottom') {
            toIdx += 1;
          }

          if (fromIdx !== -1 && toIdx !== -1 && fromIdx !== toIdx) {
            // When dragging downwards, removing the source shifts elements left by 1
            const insertAt = fromIdx < toIdx ? toIdx - 1 : toIdx;
            if (fromIdx !== insertAt) {
              const reordered = arrayMove(visualSiblings, fromIdx, insertAt);
              reorderEntities(reordered.map(e => e.id));

              if (favoriteIds.includes(entityId)) {
                setSectionSortMode('pinned', 'manual');
              } else if (entity.type === 'workspace' || entity.type === 'collection') {
                setSectionSortMode('workspaces', 'manual');
              } else {
                setSectionSortMode('unsorted', 'manual');
              }
            }
          }
        } finally {
          // Safari latches :hover onto whichever element lands under the stationary
          // cursor after a drop reorders the DOM — clear it by briefly disabling
          // pointer-events so the browser recalculates. (No-op in Chrome.)
          const sb = sidebarRef.current;
          if (sb) {
            sb.style.pointerEvents = 'none';
            requestAnimationFrame(() => {
              requestAnimationFrame(() => { sb.style.pointerEvents = ''; });
            });
          }
        }
      }
    });
  }, [entities, favoriteIds, favoriteEntitiesBase, activeWorkspaceId, toggleFavorite, reorderEntities, setSectionSortMode]);

  const navItemClass = (isActive: boolean) => cn(
    "sidebar-item-row flex items-center w-full cursor-pointer select-none text-sm group",
    "px-3 py-[3px] rounded-[var(--radius-small)] ",
    isActive
      ? "bg-[var(--app-dark)] text-[var(--bone-100)] hover:bg-[var(--app-dark)]"
      : "bg-transparent text-[var(--bone-70)] hover:text-[var(--bone-100)] hover:bg-[var(--app-dark)]"
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
      ref={sidebarRef}
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
        className={cn(
          "flex items-center px-[10px] pt-4 pb-2",
          effectiveCollapsed ? "justify-center border-b border-[var(--bone-6)]" : "justify-between"
        )}
      >
        {effectiveCollapsed ? null : (
          <span className="font-serif font-normal text-[24px] text-bone-100 tracking-tight leading-none select-none pl-[8px]">
            Flowr
          </span>
        )}

        <div className={cn("flex items-center", effectiveCollapsed ? "" : "gap-0.5 mr-[3px]")}>
          {!isTabsHeaderVisible && (
            <Tooltip content="Toggle Sidebar">
              <button
                onClick={toggleSidebar}
                className={cn(
                  "flex items-center justify-center text-[var(--bone-70)] hover:text-[var(--bone-100)] transition-colors border border-transparent",
                  effectiveCollapsed
                    ? "w-10 h-10 rounded-[var(--radius-8)] hover:bg-[var(--app-dark)]"
                    : "w-[26px] h-[26px] rounded-[var(--radius-small)] hover:bg-[var(--app-dark)]"
                )}
              >
                <PanelLeft strokeWidth={2} className="w-4 h-4" />
              </button>
            </Tooltip>
          )}
          {!effectiveCollapsed && (
            <Tooltip content="Search">
              <button
                onClick={toggleCommandPalette}
                className="w-[26px] h-[26px] flex items-center justify-center rounded-[var(--radius-small)] text-[var(--bone-70)] hover:bg-[var(--app-dark)] hover:text-[var(--bone-100)]"
              >
                <Search strokeWidth={2} className="w-4 h-4" />
              </button>
            </Tooltip>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">

        {effectiveCollapsed ? (
          <div className="flex flex-col items-center gap-[1px] w-full px-[10px] mt-2 mb-0.5 flex-none">
            <Tooltip content="Dashboard">
              <button
                onClick={() => {
                  setActiveEntityId('dashboard');
                  clearSelectedSidebarIds();
                }}
                className={cn(
                  "sidebar-item-row p-2 rounded-[var(--radius-8)] w-10 h-10 flex items-center justify-center border ",
                  ((storeHydrated ? activeEntityId : inferredEntityId) === 'dashboard')
                    ? "bg-[var(--app-dark)] text-[var(--bone-100)] border-transparent"
                    : "bg-transparent text-[var(--bone-70)] border-transparent hover:bg-[var(--app-dark)] hover:text-[var(--bone-100)]"
                )}
              >
                <LayoutDashboard strokeWidth={2} className="w-4 h-4" />
              </button>
            </Tooltip>
            <Tooltip content="Tasks">
              <button
                onClick={() => {
                  setActiveEntityId('tracker');
                  clearSelectedSidebarIds();
                }}
                className={cn(
                  "sidebar-item-row p-2 rounded-[var(--radius-8)] w-10 h-10 flex items-center justify-center border ",
                  ((storeHydrated ? activeEntityId : inferredEntityId) === 'tracker')
                    ? "bg-[var(--app-dark)] text-[var(--bone-100)] border-transparent"
                    : "bg-transparent text-[var(--bone-70)] border-transparent hover:bg-[var(--app-dark)] hover:text-[var(--bone-100)]"
                )}
              >
                <ListTodo strokeWidth={2} className="w-4 h-4" />
              </button>
            </Tooltip>
            <Tooltip content="Chat">
              <button
                onClick={() => {
                  setActiveEntityId('chat');
                  clearSelectedSidebarIds();
                }}
                className={cn(
                  "sidebar-item-row p-2 rounded-[var(--radius-8)] w-10 h-10 flex items-center justify-center border ",
                  ((storeHydrated ? activeEntityId : inferredEntityId) === 'chat')
                    ? "bg-[var(--app-dark)] text-[var(--bone-100)] border-transparent"
                    : "bg-transparent text-[var(--bone-70)] border-transparent hover:bg-[var(--app-dark)] hover:text-[var(--bone-100)]"
                )}
              >
                <MessageSquare strokeWidth={2} className="w-4 h-4" />
              </button>
            </Tooltip>
          </div>
        ) : (
          <div className="px-[10px] pt-1 mb-0 flex-none">
            <div className="relative flex items-center p-[4px] rounded-[10px] no-drag w-full" style={{ background: 'var(--slider-track)' }}>
              {/* Sliding Pill */}
              <div
                className="absolute top-[4px] bottom-[4px] rounded-[7px] bg-[var(--slider-pill)] transition-all duration-300 ease-out"
                style={{
                  width: 'calc((100% - 8px) / 3)',
                  left: `calc(4px + (${(activeEntityId === 'tracker' ? 1 : activeEntityId === 'chat' ? 2 : 0)
                    } * (100% - 8px) / 3))`,
                  boxShadow: 'var(--slider-pill-shadow)'
                }}
              />
              {[
                { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
                { id: 'tracker', label: 'Tasks', icon: ListTodo },
                { id: 'chat', label: 'Chat', icon: MessageSquare }
              ].map(tab => {
                const isActive = (tab.id === 'dashboard')
                  ? (activeEntityId !== 'tracker' && activeEntityId !== 'chat')
                  : (activeEntityId === tab.id);
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveEntityId(tab.id as any);
                      clearSelectedSidebarIds();
                    }}
                    className={cn(
                      "relative z-10 flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-[7px] transition-colors duration-300 font-semibold text-[11px] tracking-wide",
                      isActive
                        ? "text-[var(--bone-100)]"
                        : "text-[var(--bone-60)] hover:text-[var(--bone-100)]"
                    )}
                  >
                    <tab.icon className="w-3.5 h-3.5" strokeWidth={2} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {(!isMounted || !storeHydrated) ? (
            (inferredEntityId === 'chat' && !effectiveCollapsed)
              ? <ChatHistorySkeleton />
              : <SidebarSkeleton collapsed={effectiveCollapsed} />
          ) : effectiveCollapsed ? (
            <div className="flex-1 min-h-0 overflow-y-auto px-[10px] pb-1 flex flex-col items-center gap-[1px] w-full scrollbar-none">
              <Tooltip content="Pinned items">
                <button
                  onClick={toggleSidebar}
                  className="sidebar-item-row p-2 rounded-[var(--radius-8)] text-[var(--bone-70)] hover:bg-[var(--app-dark)] hover:text-[var(--bone-100)] w-10 h-10 flex items-center justify-center border border-transparent group"
                >
                  <Star strokeWidth={2} className="w-4 h-4" />
                </button>
              </Tooltip>
            </div>
          ) : (
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              {activeEntityId === 'chat' ? (
                <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                  <div className="flex flex-col gap-[1px] px-[10px] pt-1.5 pb-0 shrink-0">
                    <button
                      onClick={() => {
                        clearSelectedSidebarIds();
                        startNewChat();
                      }}
                      className="sidebar-item-row flex items-center w-full cursor-pointer select-none rounded-[var(--radius-small)] pl-[8px] pr-[3px] h-7 group border border-transparent  text-[var(--bone-70)] hover:bg-[var(--app-dark)] hover:text-[var(--bone-100)]"
                    >
                      <div className="w-[14px] shrink-0 flex items-center justify-center">
                        <Plus strokeWidth={2} className="w-3.5 h-3.5" />
                      </div>
                      <span className="ml-[6px] flex-1 text-left text-[14px] tracking-wide">New Chat</span>
                    </button>
                    <button
                      onClick={() => {
                        clearSelectedSidebarIds();
                        startTempChat();
                      }}
                      className={cn(
                        "sidebar-item-row flex items-center w-full cursor-pointer select-none rounded-[var(--radius-small)] pl-[8px] pr-[3px] h-7 group border border-transparent ",
                        isTempChat ? "bg-dark text-[var(--bone-100)] font-normal" : "text-[var(--bone-70)] hover:bg-[var(--app-dark)] hover:text-[var(--bone-100)]"
                      )}
                    >
                      <div className="w-[14px] shrink-0 flex items-center justify-center">
                        <Clock strokeWidth={2} className="w-3.5 h-3.5" />
                      </div>
                      <span className="ml-[6px] flex-1 text-left text-[14px] tracking-wide">Temp Chat</span>
                    </button>
                    <div className="h-px bg-[var(--bone-6)] -mx-[10px] mt-[10px] mb-0" />
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

                  <ScrollArea innerRef={chatScrollRef} onScroll={onScroll} className="px-[10px] pt-3 pb-4 flex flex-col gap-[1px]">
                    <div
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest('.sidebar-item-row') === null && selectedSidebarIds.length > 0) {
                          clearSelectedSidebarIds();
                        }
                      }}
                      className="flex-1 flex flex-col gap-[1px]"
                    >
                      {Object.entries(groupChatsByDate(chatConversations)).map(([label, convs]) => {
                        if (convs.length === 0) return null;
                        const isCollapsed = chatCollapsed[label] ?? false;
                        return (
                          <div key={label} className="flex flex-col gap-[1px]">
                            <div
                              onClick={() => setChatCollapsed(prev => ({ ...prev, [label]: !prev[label] }))}
                              className="pl-[8px] pr-[3px] py-0 flex items-center justify-between group cursor-pointer select-none rounded-[var(--radius-small)] h-7 text-[var(--bone-30)]"
                            >
                              <div className="flex items-center gap-1 group/header-label">
                                <span className="text-[11px] font-ui-label font-medium tracking-wide text-[var(--bone-30)] group-hover/header-label:text-[var(--bone-100)] transition-colors duration-75">{label}</span>
                                <ChevronDown
                                  strokeWidth={2}
                                  className={cn(
                                    "w-3.5 h-3.5 text-[var(--bone-30)] group-hover/header-label:text-[var(--bone-100)] opacity-0 group-hover:opacity-100 transition-opacity duration-75",
                                    isCollapsed ? "-rotate-90" : "rotate-0"
                                  )}
                                />
                              </div>
                            </div>
                            <div className={cn("grid transition-all duration-100 ease-out", !isCollapsed ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
                              <div className="overflow-hidden flex flex-col gap-[1px]">
                                {convs.map(conv => {
                                  const isSelected = selectedSidebarIds.includes(conv.id);
                                  return (
                                    <div
                                      key={conv.id}
                                      className={cn(
                                        "sidebar-item-row group flex items-center w-full cursor-pointer select-none rounded-[var(--radius-small)] pl-[8px] pr-[3px] h-7 border border-transparent",
                                        isSelected
                                          ? "bg-[var(--app-dark)] text-[var(--bone-70)] hover:text-[var(--bone-100)]"
                                          : activeChatId === conv.id
                                            ? "bg-dark text-[var(--bone-100)] font-normal"
                                            : "text-[var(--bone-70)] hover:text-[var(--bone-100)]"
                                      )}
                                      onClick={(e) => {
                                        if (e.shiftKey || e.metaKey || e.ctrlKey) {
                                          e.preventDefault();
                                          handleShiftClick(conv.id);
                                          return;
                                        }
                                        clearSelectedSidebarIds();
                                        loadConversation(conv.id);
                                      }}
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
                                          className="flex-1 bg-transparent text-[14px] tracking-wide outline-none border-b border-white/30"
                                        />
                                      ) : (
                                        <span className="flex-1 text-[14px] tracking-wide truncate">{stripHtml(conv.title)}</span>
                                      )}
                                      <div className={cn(
                                        "sidebar-actions flex items-center gap-[1px] shrink-0",
                                        chatMenuOpenId === conv.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                                      )}>
                                        <button
                                          onClick={e => {
                                            e.stopPropagation();
                                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                            setChatMenuPos({ x: rect.right + 4, y: rect.top });
                                            setChatMenuOpenId(chatMenuOpenId === conv.id ? null : conv.id);
                                          }}
                                          className={cn(
                                            "btn-sidebar-utility",
                                            chatMenuOpenId === conv.id && "!bg-dark !text-[var(--bone-100)]"
                                          )}
                                        >
                                          <MoreHorizontal strokeWidth={2} className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {chatConversations.length === 0 && (
                        <p className="text-xs text-muted-foreground/60 text-center pt-8">No conversations yet</p>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              ) : activeEntityId === 'tracker' ? (
                <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                  <div className="flex flex-col gap-[1px] px-[10px] pt-1.5 pb-0 shrink-0">
                    <button
                      onClick={() => openModal({ kind: 'newTask' })}
                      className="sidebar-item-row flex items-center w-full cursor-pointer select-none rounded-[var(--radius-small)] pl-[8px] pr-[3px] h-7 group border border-transparent text-[var(--bone-70)] hover:bg-[var(--app-dark)] hover:text-[var(--bone-100)]"
                    >
                      <div className="w-[14px] shrink-0 flex items-center justify-center">
                        <Plus strokeWidth={2} className="w-3.5 h-3.5" />
                      </div>
                      <span className="ml-[6px] flex-1 text-left text-[14px] tracking-wide">New Task</span>
                    </button>
                    <button
                      onClick={() => setTrackerFilterWorkspace(null)}
                      className={cn(
                        "sidebar-item-row flex items-center w-full cursor-pointer select-none rounded-[var(--radius-small)] pl-[8px] pr-[3px] h-7 group border border-transparent text-[var(--bone-70)] hover:bg-[var(--app-dark)] hover:text-[var(--bone-100)]",
                        trackerFilterWorkspace === null && "!bg-dark !text-[var(--bone-100)]"
                      )}
                    >
                      <div className="w-[14px] shrink-0 flex items-center justify-center">
                        <ListTodo strokeWidth={2} className="w-3.5 h-3.5" />
                      </div>
                      <span className="ml-[6px] flex-1 text-left text-[14px] tracking-wide">All tasks</span>
                      {allTasks.filter(t => !t.completed).length > 0 && (
                        <span className="shrink-0 w-[22px] h-[22px] flex items-center justify-center rounded-[4px] bg-[var(--bone-6)] text-[12px] font-ui font-medium text-[var(--bone-70)]">
                          {allTasks.filter(t => !t.completed).length}
                        </span>
                      )}
                    </button>
                    <div className="h-px bg-[var(--bone-6)] -mx-[10px] mt-[10px] mb-0" />
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin px-[10px] py-2">
                    <div className="flex flex-col gap-[1px]">
                      {workspacesBase.map(ws => {
                        const count = allTasks.filter(t => t.workspaceId === ws.id && !t.completed).length;
                        return (
                          <button
                            key={ws.id}
                            onClick={() => setTrackerFilterWorkspace(ws.id)}
                            className={cn(
                              "sidebar-item-row flex items-center w-full cursor-pointer select-none rounded-[var(--radius-small)] pl-[8px] pr-[3px] h-7 group border border-transparent text-[var(--bone-70)] hover:bg-[var(--app-dark)] hover:text-[var(--bone-100)]",
                              trackerFilterWorkspace === ws.id && "!bg-dark !text-[var(--bone-100)]"
                            )}
                          >
                            <div className={cn(
                              "w-[14px] shrink-0 flex items-center justify-center text-[var(--bone-100)] opacity-30 group-hover:opacity-100 transition-opacity duration-200",
                              trackerFilterWorkspace === ws.id && "!opacity-100"
                            )}>
                              {(() => {
                                const WorkspaceIcon = getEntityIcon(ws.icon);
                                return <WorkspaceIcon strokeWidth={2} className="w-3.5 h-3.5" />;
                              })()}
                            </div>
                            <span className="ml-[6px] flex-1 text-left text-[14px] tracking-wide truncate">{ws.title}</span>
                            {count > 0 && (
                              <span className="shrink-0 w-[22px] h-[22px] flex items-center justify-center rounded-[4px] bg-[var(--bone-6)] text-[12px] font-ui font-medium text-[var(--bone-70)]">
                                {count}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                  <div className="flex flex-col gap-[1px] px-[10px] pt-1.5 pb-0 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const rect = e.currentTarget.getBoundingClientRect();
                        setNewPagePopupPos({ x: rect.right + 4, y: rect.top });
                      }}
                      className={cn(
                        "sidebar-item-row flex items-center w-full cursor-pointer select-none rounded-[var(--radius-small)] pl-[8px] pr-[3px] h-7 group border border-transparent",
                        newPagePopupPos
                          ? "bg-[var(--app-dark)] text-[var(--bone-100)] font-normal"
                          : "text-[var(--bone-70)] hover:bg-[var(--app-dark)] hover:text-[var(--bone-100)]"
                      )}
                    >
                      <div className="w-[14px] shrink-0 flex items-center justify-center">
                        <Plus strokeWidth={2} className="w-3.5 h-3.5" />
                      </div>
                      <span className="ml-[6px] flex-1 text-left text-[14px] tracking-wide">New Page</span>
                    </button>
                    <button
                      onClick={() => {
                        setActiveEntityId('dashboard');
                        clearSelectedSidebarIds();
                      }}
                      className={cn(
                        "sidebar-item-row flex items-center w-full cursor-pointer select-none rounded-[var(--radius-small)] pl-[8px] pr-[3px] h-7 group border border-transparent text-[var(--bone-70)] hover:bg-[var(--app-dark)] hover:text-[var(--bone-100)]",
                        activeEntityId === 'dashboard' && "!bg-dark !text-[var(--bone-100)]"
                      )}
                    >
                      <div className="w-[14px] shrink-0 flex items-center justify-center">
                        <LayoutDashboard strokeWidth={2} className="w-3.5 h-3.5" />
                      </div>
                      <span className="ml-[6px] flex-1 text-left text-[14px] tracking-wide">Dashboard</span>
                    </button>
                    <div className="h-px bg-[var(--bone-6)] -mx-[10px] mt-[10px] mb-0" />
                  </div>

                  <ScrollArea
                    innerRef={mainScrollRef}
                    onScroll={onScroll}
                    className="pl-[10px] pr-[10px] pt-3"
                  >
                    <div onClick={(e) => {
                      if ((e.target as HTMLElement).closest('.sidebar-item-row') === null && selectedSidebarIds.length > 0) {
                        clearSelectedSidebarIds();
                      }
                    }}>
                      <>
                        {sectionOrder.map((sectionId) => {
                          if (sectionId === 'favorites') {
                            if (displayFavorites.length === 0) return null;
                            return (
                              <div key="favorites" className="flex flex-col gap-[1px]">
                                <div
                                  onClick={() => setIsFavoritesCollapsed(!isFavoritesCollapsed)}
                                  className={cn(
                                    "pl-[8px] pr-[3px] py-0 flex items-center justify-between group cursor-pointer select-none rounded-[var(--radius-small)] h-7",
                                    contextMenu?.entityId === 'pinned'
                                      ? "!bg-[var(--bone-10)] text-[var(--bone-100)]"
                                      : "text-[var(--bone-30)]"
                                  )}
                                >
                                  <div className="flex items-center gap-1 group/header-label">
                                    <span className="text-[11px] font-ui-label font-medium tracking-wide text-[var(--bone-30)] group-hover/header-label:text-[var(--bone-100)] transition-colors duration-75">Pinned</span>
                                    <ChevronDown
                                      strokeWidth={2}
                                      className={cn(
                                        "w-3.5 h-3.5 text-[var(--bone-30)] group-hover/header-label:text-[var(--bone-100)] opacity-0 group-hover:opacity-100 transition-opacity duration-75",
                                        isFavoritesCollapsed ? "-rotate-90" : "rotate-0"
                                      )}
                                    />
                                  </div>
                                  <div className="flex items-center gap-0.5">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        openContextMenu('pinned', rect.right, rect.top, 'sidebar-section');
                                      }}
                                      className={cn(
                                        "btn-sidebar-utility opacity-0 group-hover:opacity-100 text-[var(--bone-30)] hover:text-[var(--bone-100)]",
                                        contextMenu?.entityId === 'pinned' && "!bg-dark !text-[var(--bone-100)] !opacity-100"
                                      )}
                                    >
                                      <MoreHorizontal strokeWidth={2} className="w-3.5 h-3.5" />
                                    </button>
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
                                      className=""
                                    >
                                      <DroppableZone id="pinned-container" className="flex flex-col mt-[1px] sidebar-list mb-2">
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
                              <div key="unsorted" className="flex flex-col gap-[1px]">
                                <div
                                  onClick={() => setIsUnsortedCollapsed(!isUnsortedCollapsed)}
                                  className={cn(
                                    "pl-[8px] pr-[3px] h-7 flex items-center justify-between group cursor-pointer select-none rounded-[var(--radius-small)] ",
                                    contextMenu?.entityId === 'unsorted'
                                      ? "!bg-[var(--bone-10)] text-[var(--bone-100)]"
                                      : "text-[var(--bone-30)]"
                                  )}
                                >
                                  <div className="flex items-center gap-1 group/header-label">
                                    <span className="text-[11px] font-ui-label font-medium tracking-wide text-[var(--bone-30)] group-hover/header-label:text-[var(--bone-100)] transition-colors duration-75">Unsorted</span>
                                    <ChevronDown
                                      strokeWidth={2}
                                      className={cn(
                                        "w-3.5 h-3.5 text-[var(--bone-30)] group-hover/header-label:text-[var(--bone-100)] opacity-0 group-hover:opacity-100 transition-opacity duration-75",
                                        isUnsortedCollapsed ? "-rotate-90" : "rotate-0"
                                      )}
                                    />
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        openContextMenu('unsorted', rect.right, rect.top, 'sidebar-section');
                                      }}
                                      className={cn(
                                        "btn-sidebar-utility opacity-0 group-hover:opacity-100 text-[var(--bone-30)] hover:text-[var(--bone-100)]",
                                        contextMenu?.entityId === 'unsorted' && "!bg-dark !text-[var(--bone-100)] !opacity-100"
                                      )}
                                    >
                                      <MoreHorizontal strokeWidth={2} className="w-3.5 h-3.5" />
                                    </button>
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
                                      className=""
                                    >
                                      <DroppableZone id="unsorted-container" className="flex flex-col mt-[1px] sidebar-list mb-2">
                                          {displayUnsorted.map(entity => (
                                            <TreeItem key={entity.id} entity={entity} depth={0} disableNesting={true} isMultiSelected={selectedSidebarIds.includes(entity.id)} onShiftClick={handleShiftClick} />
                                          ))}
                                      </DroppableZone>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          }

                          if (sectionId === 'workspaces') {
                            return (
                              <div key="workspaces" className="flex flex-col gap-[1px]">
                                <div
                                  className={cn(
                                    "pl-[8px] pr-[3px] h-7 flex items-center justify-between group cursor-pointer select-none rounded-[var(--radius-small)] ",
                                    contextMenu?.entityId === 'workspaces'
                                      ? "!bg-[var(--bone-10)] text-[var(--bone-100)]"
                                      : "text-[var(--bone-30)]"
                                  )}
                                  onClick={() => setIsWorkspacesCollapsed(!isWorkspacesCollapsed)}
                                >
                                  <div className="flex items-center gap-1 group/header-label">
                                    <span className="text-[11px] font-ui-label font-medium tracking-wide text-[var(--bone-30)] group-hover/header-label:text-[var(--bone-100)] transition-colors duration-75">Workspaces</span>
                                    <ChevronDown
                                      strokeWidth={2}
                                      className={cn(
                                        "w-3.5 h-3.5 text-[var(--bone-30)] group-hover/header-label:text-[var(--bone-100)] opacity-0 group-hover:opacity-100 transition-opacity duration-75",
                                        isWorkspacesCollapsed ? "-rotate-90" : "rotate-0"
                                      )}
                                    />
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        openContextMenu('workspaces', rect.right, rect.top, 'sidebar-section');
                                      }}
                                      className={cn(
                                        "btn-sidebar-utility opacity-0 group-hover:opacity-100 text-[var(--bone-30)] hover:text-[var(--bone-100)]",
                                        contextMenu?.entityId === 'workspaces' && "!bg-dark !text-[var(--bone-100)] !opacity-100"
                                      )}
                                    >
                                      <MoreHorizontal strokeWidth={2} className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openModal({ kind: 'newCollection' });
                                      }}
                                      className="btn-sidebar-utility opacity-0 group-hover:opacity-100 text-[var(--bone-30)] hover:text-[var(--bone-100)]"
                                    >
                                      <Plus strokeWidth={2} className="w-3.5 h-3.5" />
                                    </button>
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
                                      className=""
                                    >
                                      <DroppableZone id="workspaces-container" className="flex flex-col mt-[1px] mb-2">
                                          {displayWorkspaces.map(workspace => (
                                            <TreeItem key={workspace.id} entity={workspace} depth={0} isMultiSelected={selectedSidebarIds.includes(workspace.id)} onShiftClick={handleShiftClick} />
                                          ))}
                                      </DroppableZone>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        })}
                      </>
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <div 
        className={cn(
          "border-t border-[var(--bone-6)] flex items-center mt-auto h-[60px] select-none transition-all duration-200 justify-between",
          effectiveCollapsed 
            ? "flex-col items-center py-4 h-auto gap-4 px-0" 
            : "px-4 hover:bg-[var(--app-dark)]",
          ((contextMenu?.source === 'spaces' || activeEntityId === 'settings') && !effectiveCollapsed) && "bg-[var(--app-dark)]"
        )}
      >
        <Tooltip content="Settings" disabled={!effectiveCollapsed}>
          <button
            onClick={() => {
              setActiveEntityId('settings');
              clearSelectedSidebarIds();
            }}
            className={cn(
              "flex items-center text-left transition-all no-drag group/profile outline-none h-full",
              effectiveCollapsed
                ? cn("w-10 h-10 justify-center rounded-full hover:bg-[var(--app-dark)]", activeEntityId === 'settings' && "bg-[var(--app-dark)] text-[var(--bone-100)]")
                : "flex-1 min-w-0 gap-3"
            )}
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--bone-15)] to-[var(--bone-6)] flex items-center justify-center shrink-0 overflow-hidden relative">
              <span className="text-[11px] font-bold text-[var(--bone-70)] tracking-wide group-hover/profile:text-[var(--bone-100)] transition-colors">{sidebarInitial}</span>
              {sidebarAvatarUrl && (
                <img 
                  src={sidebarAvatarUrl} 
                  alt="" 
                  className="absolute inset-0 w-full h-full object-cover" 
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} 
                />
              )}
            </div>
            {!effectiveCollapsed && (
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-sm font-semibold text-[var(--bone-100)] truncate tracking-wide flex items-center gap-1 group-hover/profile:text-[var(--bone-100)]">
                  <span className="truncate">{sidebarDisplayName}</span>
                </span>
                <span className="text-xs text-[var(--bone-70)] truncate tracking-wide">
                  {activeWorkspace?.name || 'Personal'}
                </span>
              </div>
            )}
          </button>
        </Tooltip>
        <div className={cn("flex items-center gap-1 shrink-0", effectiveCollapsed && "flex-col gap-2 py-4 h-auto")}>
          <InstallButton collapsed={effectiveCollapsed} />
          <Tooltip content="Spaces">
            <button
              onClick={(e) => {
                e.stopPropagation();
                const rect = e.currentTarget.getBoundingClientRect();
                openContextMenu(null, rect.left, rect.top, 'spaces');
              }}
              className={cn(
                contextMenu?.source === 'spaces' && "!bg-dark !text-[var(--bone-100)] !opacity-100",
                effectiveCollapsed
                  ? "w-10 h-10 flex items-center justify-center rounded-[var(--radius-8)] text-[var(--bone-100)] opacity-70 hover:opacity-100 hover:bg-[var(--app-dark)] transition-colors border border-transparent"
                  : "btn-sidebar-utility hover:!bg-[var(--app-dark)]"
              )}
            >
              <ChevronsUpDown strokeWidth={2} className="w-4 h-4" />
            </button>
          </Tooltip>
          <Tooltip content="Toggle Theme">
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleTheme();
              }}
              className={effectiveCollapsed
                ? "w-10 h-10 flex items-center justify-center rounded-[var(--radius-8)] text-[var(--bone-100)] opacity-70 hover:opacity-100 hover:bg-[var(--app-dark)] transition-colors border border-transparent"
                : "btn-sidebar-utility hover:!bg-[var(--app-dark)]"
              }
            >
              {theme === 'dark' ? <Sun strokeWidth={2} className="w-4 h-4" /> : <Moon strokeWidth={2} className="w-4 h-4" />}
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
            {selectedSidebarIds.length > 1 && selectedSidebarIds.includes(chatMenuOpenId) && (
              <button
                onClick={() => {
                  openModal({ kind: 'deleteConfirm', entityIds: [...selectedSidebarIds], isChat: true });
                  setChatMenuOpenId(null);
                }}
                className="popup-item-danger"
              >
                <Trash2 strokeWidth={2} className="w-4 h-4 shrink-0" />
                Delete All ({selectedSidebarIds.length})
              </button>
            )}
          </div>
        </>
      )}
      {newPagePopupPos && (
        <>
          <div className="fixed inset-0 z-[299]" onClick={() => setNewPagePopupPos(null)} />
          <div
            className="fixed z-[300] popup-glass-small min-w-[160px] p-1.5 flex flex-col gap-[3px]"
            style={{ left: newPagePopupPos.x, top: newPagePopupPos.y }}
          >
            {[
              { type: 'note' as const, label: 'Note', icon: FileText },
              { type: 'canvas' as const, label: 'Canvas', icon: Frame },
              { type: 'mixed' as const, label: 'Mixed', icon: Layers }
            ].map(opt => (
              <button
                key={opt.type}
                onClick={() => {
                  const newId = generateId();
                  addEntity({
                    id: newId,
                    title: `Untitled ${opt.label}`,
                    type: opt.type,
                    parentId: null,
                    lastModified: Date.now()
                  });
                  setActiveEntityId(newId);
                  setNewPagePopupPos(null);
                }}
                className="popup-item group w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-none"
              >
                <opt.icon strokeWidth={2} className="w-4 h-4 shrink-0 text-[var(--bone-70)] group-hover:text-[var(--bone-100)]" />
                <span className="flex-1 text-left font-medium tracking-wide">{opt.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </aside>
  );
});
