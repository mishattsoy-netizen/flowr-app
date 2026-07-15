"use client";

import { useStore, generateId } from '@/data/store';
import { useAuth } from '@/components/AuthProvider';
import type { EntityType, Entity, SidebarSectionId, AppTask } from '@/data/store';
import { getDescendantIds } from '@/data/store.helpers';
import { getEntityIcon } from '@/data/icons';

import { Search, Home, LayoutDashboard, Star, ChevronRight, ChevronDown, Moon, Plus, ChevronLeft, Folder, Sun, X, FileText, Frame, MoreHorizontal, Settings, Columns, GripVertical, Activity, ListTodo, ChevronsUpDown, MessageCircle, Calendar, Clock, Trash2, RefreshCw, Pencil, ExternalLink, PanelLeft, MessageCircleDashed, Pen, CheckSquare, Settings2, LogOut, Tag, Inbox } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import { Toggle } from '../ui/Toggle';
import { cn } from '@/lib/utils';
import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { isDesktop } from '@/lib/env';
import { useDeferredLoading } from '@/hooks/use-deferred-loading';
import { TreeItem, AfterFolderSpacer } from './TreeItem';
import { ScrollArea } from './ScrollArea';
import { Tooltip } from './Tooltip';
import { Skeleton } from '@/components/ui/Skeleton';
import { useTooltipSuppression } from './TooltipOverlayContext';
import { SpaceSwitcher } from './SpaceSwitcher';
import InstallButton from '@/components/pwa/InstallButton';
import UpdateBanner from './UpdateBanner';
import { SidebarSkeleton } from './SidebarSkeleton';
import { ChatHistorySkeleton } from '../chat/ChatSkeleton';
import React from 'react';
import { stripHtml } from '@/lib/utils';
import { createPortal } from 'react-dom';
import { draggable, monitorForElements, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { disableNativeDragPreview } from '@atlaskit/pragmatic-drag-and-drop/element/disable-native-drag-preview';

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

function SidebarMainTab({ tab, isActive, onClick }: { tab: any, isActive: boolean, onClick: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return draggable({
      element: el,
      getInitialData: () => ({ id: tab.id, entityType: 'main_page' }),
    });
  }, [tab.id]);

  return (
    <button
      ref={ref}
      onClick={onClick}
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
}

function TrackerWorkspaceItem({
  ws,
  allTasks,
  activeSpaceId,
  collapsedTrackerWorkspaces,
  setCollapsedTrackerWorkspaces,
  trackerFilterEntityIds,
  trackerFilterTags,
  toggleTrackerFilterEntityId,
  toggleTrackerFilterTag,
  clearTrackerFilterEntityIds,
  clearTrackerFilterTags,
  setTrackerFilterEntityIds,
  setTrackerFilterTags,
}: {
  ws: Entity;
  allTasks: AppTask[];
  activeSpaceId: string | null;
  collapsedTrackerWorkspaces: Record<string, boolean>;
  setCollapsedTrackerWorkspaces: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  trackerFilterEntityIds: string[];
  trackerFilterTags: string[];
  toggleTrackerFilterEntityId: (id: string) => void;
  toggleTrackerFilterTag: (tag: string) => void;
  clearTrackerFilterEntityIds: () => void;
  clearTrackerFilterTags: () => void;
  setTrackerFilterEntityIds: (ids: string[]) => void;
  setTrackerFilterTags: (tags: string[]) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [closestEdge, setClosestEdge] = useState<'top' | 'bottom' | null>(null);
  const [preview, setPreview] = useState<boolean>(false);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;

    const handleDragStart = (e: DragEvent) => {
      e.dataTransfer!.effectAllowed = 'move';
      e.dataTransfer!.dropEffect = 'move';
      document.body.style.cursor = 'grabbing';
    };
    el.addEventListener('dragstart', handleDragStart, { capture: true });

    const cleanup = draggable({
      element: el,
      getInitialData: () => ({ id: ws.id, entityType: 'workspace', type: 'tree-item' }),
      onGenerateDragPreview: ({ nativeSetDragImage }) => {
        disableNativeDragPreview({ nativeSetDragImage });
        setPreview(true);
      },
      onDrag: ({ location }) => {
        const node = previewRef.current;
        if (!node) return;
        node.style.transform = `translate(${location.current.input.clientX}px, ${location.current.input.clientY}px)`;
      },
      onDragStart: () => {
        setIsDragging(true);
        setPreview(true);
      },
      onDrop: () => {
        setIsDragging(false);
        setPreview(false);
      },
    });

    return () => {
      el.removeEventListener('dragstart', handleDragStart, { capture: true } as EventListenerOptions);
      cleanup();
    };
  }, [ws.id]);

  useEffect(() => {
    const el = ref.current;
    if (!el || isDragging) return;
    return dropTargetForElements({
      element: el,
      canDrop: ({ source }) => {
        if (source.data.type !== 'tree-item') return false;
        if (source.data.entityType !== 'workspace') return false;
        if (source.data.id === ws.id) return false;
        return true;
      },
      getData: ({ input, element }) => {
        const rect = element.getBoundingClientRect();
        // Fallback for missing input.clientY if pragmatic-dnd is acting up
        const clientY = input?.clientY || (typeof window !== 'undefined' ? (window as any)._dragCursorY || 0 : 0);
        const edge = clientY < rect.top + rect.height / 2 ? 'top' : 'bottom';
        return {
          type: 'tree-item',
          id: ws.id,
          edge,
          isAfterFolder: false,
          isInsertInsideBottom: false,
          visualEdge: edge,
          visualDepth: 0
        };
      },
      onDragEnter: ({ self }) => setClosestEdge(self.data.visualEdge as 'top' | 'bottom'),
      onDrag: ({ self }) => setClosestEdge(self.data.visualEdge as 'top' | 'bottom'),
      onDragLeave: () => setClosestEdge(null),
      onDrop: () => setClosestEdge(null),
    });
  }, [ws.id, isDragging]);

  const count = allTasks.filter(t => t.entityId === ws.id && !t.completed && t.spaceId === activeSpaceId).length;
  const wsTags = Array.from(new Set(
    allTasks
      .filter(t => t.entityId === ws.id && t.tag && t.tag.trim() && t.spaceId === activeSpaceId)
      .map(t => t.tag!.trim())
  )).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  const hasTags = wsTags.length > 0;
  const isCollapsed = collapsedTrackerWorkspaces[ws.id] ?? false;
  const isActive = trackerFilterEntityIds.includes(ws.id) && trackerFilterTags.length === 0;

  return (
    <div ref={ref} className={cn("relative group/treeitem flex flex-col gap-[1px]", isDragging && "opacity-50")}>
      {/* Space Row */}
      <div
        ref={rowRef}
        onClick={(e) => {
          if (e.shiftKey) {
            e.preventDefault();
            toggleTrackerFilterEntityId(ws.id);
          } else {
            clearTrackerFilterEntityIds();
            clearTrackerFilterTags();
            setTrackerFilterEntityIds([ws.id]);
          }
        }}
        className={cn(
          "sidebar-item-row group relative flex w-full select-none items-center h-7 px-3 rounded-[var(--radius-small)] border border-transparent cursor-pointer",
          isActive
            ? "!bg-dark text-[var(--bone-100)] font-normal"
            : "text-[var(--bone-70)] hover:text-[var(--bone-100)] [&:hover:not(:has(.sidebar-actions:hover))]:bg-[var(--app-dark)]",
          "text-[14px]"
        )}
        style={{ paddingLeft: '8px', paddingRight: '3px' }}
      >
        {/* Icon & Hover Chevron Overlay */}
        <div className="relative flex items-center justify-center w-3.5 h-3.5 shrink-0 text-[var(--bone-100)]">
          <div className={cn(
            "flex items-center justify-center w-full h-full",
            hasTags && "group-hover:opacity-0"
          )}>
            {(() => {
              const WorkspaceIcon = getEntityIcon(ws.icon);
              return <WorkspaceIcon strokeWidth={2} className="w-3.5 h-3.5" />;
            })()}
          </div>

          {hasTags && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setCollapsedTrackerWorkspaces(prev => ({ ...prev, [ws.id]: !isCollapsed }));
              }}
              onPointerDown={(e) => e.stopPropagation()}
              className="sidebar-actions absolute btn-sidebar-utility opacity-0 group-hover:opacity-100"
              style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
            >
              {isCollapsed ? (
                <ChevronRight strokeWidth={2} className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown strokeWidth={2} className="w-3.5 h-3.5" />
              )}
            </button>
          )}
        </div>

        <span className="ml-[6px] flex-1 text-left text-[14px] tracking-wide truncate">{ws.title}</span>
        {count > 0 && (
          <span className="shrink-0 w-[22px] h-[22px] flex items-center justify-center rounded-[4px] bg-[var(--bone-6)] text-[12px] font-ui font-medium text-[var(--bone-70)]">
            {count}
          </span>
        )}

      </div>

      {closestEdge && (
        <div
          className={cn(
            "absolute h-px bg-[var(--bone-30)] pointer-events-none z-10",
            closestEdge === 'top' ? '-top-px' : '-bottom-px'
          )}
          style={{ left: '8px', right: '3px' }}
        />
      )}

      {/* Tags list (depth 1) */}
      {hasTags && (
        <div
          className={cn(
            "grid transition-all duration-100 ease-out",
            !isCollapsed ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
          )}
        >
          <div className="overflow-hidden relative">
            <div className="absolute top-0 bottom-0 w-[1px] bg-[var(--bone-6)] pointer-events-none" style={{ left: '14px' }} />
            <div className="flex flex-col gap-[1px]">
              {wsTags.map(tag => {
                const isTagActive = trackerFilterEntityIds.includes(ws.id) && trackerFilterTags.includes(tag);
                const tagCount = allTasks.filter(t => t.entityId === ws.id && t.tag?.trim() === tag && !t.completed && (t.spaceId || activeSpaceId) === activeSpaceId).length;
                return (
                  <div
                    key={tag}
                    onClick={(e) => {
                      if (e.shiftKey) {
                        e.preventDefault();
                        if (trackerFilterEntityIds.includes(ws.id)) {
                          toggleTrackerFilterTag(tag);
                        } else {
                          clearTrackerFilterEntityIds();
                          clearTrackerFilterTags();
                          setTrackerFilterEntityIds([ws.id]);
                          setTrackerFilterTags([tag]);
                        }
                      } else {
                        clearTrackerFilterEntityIds();
                        clearTrackerFilterTags();
                        setTrackerFilterEntityIds([ws.id]);
                        setTrackerFilterTags([tag]);
                      }
                    }}
                    className={cn(
                      "sidebar-item-row group relative flex w-full select-none items-center h-7 px-3 rounded-[var(--radius-small)] border border-transparent cursor-pointer",
                      isTagActive
                        ? "!bg-dark text-[var(--bone-100)] font-normal"
                        : "text-[var(--bone-70)] hover:text-[var(--bone-100)] [&:hover:not(:has(.sidebar-actions:hover))]:bg-[var(--app-dark)]",
                      "text-[14px]"
                    )}
                    style={{ paddingLeft: '26px', paddingRight: '3px' }}
                  >
                    <div className={cn(
                      "w-[14px] shrink-0 flex items-center justify-center text-[var(--bone-100)]",
                      isTagActive ? "opacity-100" : "opacity-70 group-hover:opacity-100"
                    )}>
                      <Tag strokeWidth={2} className="w-3.5 h-3.5" />
                    </div>
                    <span className="ml-[6px] flex-1 text-left text-[14px] tracking-wide truncate">{tag}</span>
                    {tagCount > 0 && (
                      <span className="shrink-0 w-[22px] h-[22px] flex items-center justify-center rounded-[4px] bg-[var(--bone-6)] text-[12px] font-ui font-medium text-[var(--bone-70)]">
                        {tagCount}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {preview &&
        createPortal(
          <div
            ref={previewRef}
            className="fixed top-0 left-0 z-[10000] pointer-events-none"
            style={{ transform: 'translate(-9999px, -9999px)' }}
          >
            <div className="-translate-x-1/2 -translate-y-1/2">
              <div className="w-[240px] bg-sidebar rounded-[var(--radius-small)] opacity-85 shadow-lg border border-[var(--bone-10)]">
                <TreeItem
                  entity={ws}
                  depth={0}
                  isDragOverlay
                  disableNesting
                />
              </div>
            </div>
          </div>,
          document.body
        )
      }
    </div>
  );
}

export const Sidebar = React.memo(function Sidebar({ forceFull, initialEntityId }: { forceFull?: boolean, initialEntityId?: string }) {
  const entities = useStore(state => state.entities);
  const collapsedIds = useStore(state => state.collapsedIds);
  const [collapsedTrackerWorkspaces, setCollapsedTrackerWorkspaces] = useState<Record<string, boolean>>({});
  const trackerFilterTags = useStore(state => state.trackerFilterTags);
  const setTrackerFilterTags = useStore(state => state.setTrackerFilterTags);
  const toggleTrackerFilterTag = useStore(state => state.toggleTrackerFilterTag);
  const trackerFilterEntityIds = useStore(state => state.trackerFilterEntityIds);
  const setTrackerFilterEntityIds = useStore(state => state.setTrackerFilterEntityIds);
  const toggleTrackerFilterEntityId = useStore(state => state.toggleTrackerFilterEntityId);
  const clearTrackerFilterTags = useStore(state => state.clearTrackerFilterTags);
  const clearTrackerFilterEntityIds = useStore(state => state.clearTrackerFilterEntityIds);
  const activeEntityId = useStore(state => state.activeEntityId);
  const favoriteIds = useStore(state => state.favoriteIds);
  const setActiveEntityId = useStore(state => state.setActiveEntityId);
  const openModal = useStore(state => state.openModal);
  const openTaskPanel = useStore(state => state.openTaskPanel);
  const openContextMenu = useStore(state => state.openContextMenu);
  const isSidebarCollapsed = useStore(state => state.isSidebarCollapsed);
  const isSidebarPinned = useStore(state => state.isSidebarPinned);
  const sidebarWidth = useStore(state => state.sidebarWidth);
  const isDesktopEnv = isDesktop();
  const splitViewActive = useStore(state => state.splitViewActive);
  const splitViewLeftId = useStore(state => state.splitViewLeftId);
  const splitViewRightId = useStore(state => state.splitViewRightId);
  const toggleSidebar = useStore(state => state.toggleSidebar);
  const toggleSidebarPinned = useStore(state => state.toggleSidebarPinned);
  const toggleCommandPalette = useStore(state => state.toggleCommandPalette);
  const isTabsHeaderVisible = useStore(state => state.isTabsHeaderVisible);
  const { theme: currentTheme, setTheme, resolvedTheme } = useTheme();
  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  }, [resolvedTheme, setTheme]);
  const toggleFavorite = useStore(state => state.toggleFavorite);
  const storeWorkspaces = useStore(state => state.spaces);
  const allTasks = useStore(state => state.tasks);
  const activeSpaceId = useStore(state => state.activeSpaceId);
  const isChatHistoryLoading = useStore(state => state.isChatHistoryLoading);
  const reorderEntities = useStore(state => state.reorderEntities);
  const sidebarSectionSettings = useStore(state => state.sidebarSectionSettings);
  const hiddenEntityIds = useStore(state => state.hiddenEntityIds);
  const setSectionSortMode = useStore(state => state.setSectionSortMode);
  const contextMenu = useStore(state => state.contextMenu);
  const selectedSidebarIds = useStore(state => state.selectedSidebarIds);
  const setSelectedSidebarIds = useStore(state => state.setSelectedSidebarIds);
  const clearSelectedSidebarIds = useStore(state => state.clearSelectedSidebarIds);
  const addEntity = useStore(state => state.addEntity);

  const { user, signOut } = useAuth();
  const cachedDisplayName = useStore(state => state.cachedDisplayName);
  const setCachedDisplayName = useStore(state => state.setCachedDisplayName);
  const sidebarDisplayName = user?.user_metadata?.display_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || cachedDisplayName || 'Guest';

  useEffect(() => {
    if (user) {
      const name = user.user_metadata?.display_name || user.user_metadata?.full_name || user.email?.split('@')[0] || '';
      if (name && name !== cachedDisplayName) {
        setCachedDisplayName(name);
      }
    }
  }, [user, cachedDisplayName, setCachedDisplayName]);

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
  const pendingNewChat = useStore(state => state.pendingNewChat);
  const deleteChatConversation = useStore(state => state.deleteChatConversation);
  const renameChatConversation = useStore(state => state.renameChatConversation);
  const toggleFavoriteChatConversation = useStore(state => state.toggleFavoriteChatConversation);
  const addTab = useStore(state => state.addTab);

  const [isFavoritesCollapsed, setIsFavoritesCollapsed] = useState(false);
  const [isWorkspacesCollapsed, setIsWorkspacesCollapsed] = useState(false);
  const [isUnsortedCollapsed, setIsUnsortedCollapsed] = useState(false);
  const [sectionOrder] = useState(['favorites', 'unsorted', 'spaces']);
  const [chatEditingId, setChatEditingId] = useState<string | null>(null);
  const [chatEditTitle, setChatEditTitle] = useState('');
  const [chatConfirmDeleteId, setChatConfirmDeleteId] = useState<string | null>(null);
  const [chatMenuOpenId, setChatMenuOpenId] = useState<string | null>(null);
  const [chatMenuPos, setChatMenuPos] = useState({ x: 0, y: 0 });
  const [newPagePopupPos, setNewPagePopupPos] = useState<{ x: number, y: number } | null>(null);
  const [profilePopupPos, setProfilePopupPos] = useState<{ x: number, y?: number, bottom?: number, width: number } | null>(null);
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
    () => storeWorkspaces.find(w => w.id === activeSpaceId),
    [storeWorkspaces, activeSpaceId]
  );

  const isEntityVisible = useMemo(() => (e: Entity) => {
    const effectiveSpaceId = activeSpaceId || 'ws-personal';
    const entitySpaceId = e.spaceId || 'ws-personal';
    // Legacy entities with 'ws-personal' spaceId are visible in the default space
    if (entitySpaceId === 'ws-personal') {
      const defaultSpace = storeWorkspaces.find(s => s.isDefault);
      if (defaultSpace) return effectiveSpaceId === defaultSpace.id && !hiddenEntityIds.includes(e.id);
      return !hiddenEntityIds.includes(e.id); // no spaces configured — show it
    }
    return entitySpaceId === effectiveSpaceId && !hiddenEntityIds.includes(e.id);
  }, [activeSpaceId, hiddenEntityIds, storeWorkspaces]);

  const sortEntities = (entities: Entity[], sectionId: SidebarSectionId) => {
    const mode = (sidebarSectionSettings as any)[sectionId]?.sortMode || 'lastModified';
    if (mode === 'alphabetical') return [...entities].sort((a, b) => a.title.localeCompare(b.title));
    if (mode === 'lastModified') return [...entities].sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0));
    return [...entities].sort((a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999));
  };

  const spacesBase = useMemo(
    () => sortEntities(entities.filter(e => e.type === 'workspace' && isEntityVisible(e)), 'spaces'),
    [entities, isEntityVisible, sidebarSectionSettings]
  );
  const favoriteEntitiesBase = useMemo(
    () => sortEntities(entities.filter(e => favoriteIds.includes(e.id) && isEntityVisible(e)), 'pinned'),
    [entities, favoriteIds, isEntityVisible, sidebarSectionSettings]
  );
  const unsortedEntitiesBase = useMemo(
    () => sortEntities(
      entities.filter(e =>
        (e.type === 'note' || e.type === 'canvas' || e.type === 'folder') &&
        (!e.parentId || !entities.some(p => p.id === e.parentId)) &&
        isEntityVisible(e)
      ),
      'unsorted'
    ),
    [entities, isEntityVisible, sidebarSectionSettings]
  );

  const displayWorkspaces = spacesBase;
  const displayFavorites = favoriteEntitiesBase;
  const displayUnsorted = unsortedEntitiesBase;

  // Build a flat list of all selectable entity IDs (pinned + unsorted — NOT spaces)
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

          const isDraggingWorkspace = entity.type === 'workspace';

          // Look up overEntity early so the edge calculation can check the target type.
          let overEntity = entities.find(e => e.id === overId);

          // Helper to get visually sorted siblings matching the target entity's section sort mode
          const getSortedSiblings = (targetEntity: Entity) => {
            const freshEntities = useStore.getState().entities;
            const hiddenEntityIds = useStore.getState().hiddenEntityIds;
            const isWorkspace = (type: EntityType) => type === 'workspace';

            const getSectionId = (): 'spaces' | 'unsorted' | null => {
              if (targetEntity.parentId && freshEntities.some(p => p.id === targetEntity.parentId)) return null;
              return isWorkspace(targetEntity.type) ? 'spaces' : 'unsorted';
            };

            const getSectionSiblings = () => {
              const sectionId = getSectionId();
              if (sectionId === 'spaces') {
                return freshEntities.filter(e =>
                  e.type === 'workspace' &&
                  (!e.parentId || !freshEntities.some(p => p.id === e.parentId)) &&
                  (e.spaceId || 'ws-personal') === (targetEntity.spaceId || 'ws-personal') &&
                  !hiddenEntityIds.includes(e.id)
                );
              }
              if (sectionId === 'unsorted') {
                return freshEntities.filter(e =>
                  (e.type === 'note' || e.type === 'canvas') &&
                  (!e.parentId || !freshEntities.some(p => p.id === e.parentId)) &&
                  (e.spaceId || 'ws-personal') === (targetEntity.spaceId || 'ws-personal') &&
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
          const isOverFolder = overEntity && (overEntity.type === 'folder' || overEntity.type === 'workspace');
          const isOverExpanded = isOverFolder && !collapsedIds.includes(overId);
          if (edge === 'bottom' && isOverExpanded && !isDraggingWorkspace) {
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
              const prevChildren = entities
                .filter(e => e.parentId === prev.id && !hiddenEntityIds.includes(e.id))
                .sort((a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999));
              const prevLastChild = prevChildren[prevChildren.length - 1];
              const isPrevLastChildExpandedFolder = prevLastChild
                && (prevLastChild.type === 'folder' || prevLastChild.type === 'workspace')
                && !collapsedIds.includes(prevLastChild.id);
              if (prevChildren.length > 0 && !collapsedIds.includes(prev.id) && isPrevLastChildExpandedFolder) {
                overId = prev.id;
                overEntity = prev;
                edge = null;
              }
            }
          }

          // Early return on no-op drops (dragging on itself or adjacent no-op edges)
          if (activeId === overId) return;

          if (edge !== null && overEntity) {
            if ((entity.parentId || null) === (overEntity.parentId || null) && (entity.spaceId || null) === (overEntity.spaceId || null)) {
              const isWorkspace = (type: EntityType) => type === 'workspace';
              const isDragWS = isWorkspace(entity.type);
              const isTargetWS = isWorkspace(overEntity.type);

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
          // underlying entity in spaces/unsorted.
          if (isPinnedDrag) {
            toggleFavorite(entityId);
            return;
          }

          const moveEntityAction = useStore.getState().moveEntity;

          let newParentId: string | null = entity.parentId;
          let newSpaceId = entity.spaceId;

          if (overId === 'unsorted-container') {
            newParentId = null;
            newSpaceId = 'ws-personal';
          } else if (overId === 'spaces-container') {
            newParentId = null;
            newSpaceId = activeSpaceId;
          } else if (overEntity) {
            if (overEntity.type === 'folder' || overEntity.type === 'workspace') {
              if (edge === null) {
                newParentId = overEntity.id;
                newSpaceId = overEntity.spaceId;
              } else {
                newParentId = overEntity.parentId;
                newSpaceId = overEntity.spaceId;
              }
            } else {
              newParentId = overEntity.parentId;
              newSpaceId = overEntity.spaceId;
            }
          }

          // Enforce depth constraint: only allow outdenting by at most 1 level per drag within the same workspace and same folder tree
          if (newSpaceId === entity.spaceId && newParentId) {
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
          if (normParent(newParentId) === normParent(entity.parentId) && normWS(newSpaceId) === normWS(entity.spaceId) && edge === null && !isInsertInsideBottom) {
            return; // No-op: dropped inside its current parent container
          }

          if (newParentId === entityId) return;
          const descendantIds = getDescendantIds(entities, entityId);
          if (newParentId && descendantIds.includes(newParentId)) return;

          // Guard: folders must always have a parent — a folder with parentId: null
          // is invisible in the sidebar (it matches neither the spaces section
          // nor the unsorted section). Block the move entirely.
          const isRootOnlyType = entity.type === 'workspace';
          if (!newParentId && !isRootOnlyType && entity.type === 'folder') return;

          if (newParentId !== entity.parentId || newSpaceId !== entity.spaceId) {
            moveEntityAction(entityId, newParentId, newSpaceId);
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
              } else if (entity.type === 'workspace') {
                setSectionSortMode('spaces', 'manual');
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
  }, [entities, favoriteIds, favoriteEntitiesBase, activeSpaceId, toggleFavorite, reorderEntities, setSectionSortMode]);

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
      if ((type === 'folder' || type === 'workspace') && entity?.icon) {
        const CustomIcon = getEntityIcon(entity.icon);
        return <CustomIcon strokeWidth={2} className={cls} />;
      }
      switch (type) {
        case 'canvas': return <Frame strokeWidth={2} className={cls} />;
        case 'note': return <FileText strokeWidth={2} className={cls} />;
        case 'folder': return <Folder strokeWidth={2} className={cls} />;
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
        {isDesktopEnv && <div className="shrink-0 [-webkit-app-region:drag]" style={{ height: 12 }} />}
        
        {!isDesktopEnv && (
          <div
            className={cn(
              "flex items-center px-[10px] pt-4 pb-2 shrink-0",
              effectiveCollapsed ? "justify-center border-b border-[var(--bone-6)]" : "justify-between"
            )}
          >
          {effectiveCollapsed ? null : (
            <>
              <span className="font-serif font-normal text-[24px] text-bone-100 tracking-tight leading-none select-none pl-[8px]">
                Flowr
              </span>
              {!isDesktopEnv && (
                <div className="flex items-center gap-1 pr-[2px]">
                  <button
                    onClick={() => toggleCommandPalette()}
                    className="w-7 h-7 flex items-center justify-center rounded-[var(--radius-small)] text-[var(--bone-100)] opacity-70 hover:opacity-100 hover:bg-[var(--app-dark)] transition-all"
                  >
                    <Search className="w-4 h-4" />
                  </button>
                  <button
                    onClick={toggleSidebar}
                    className="w-7 h-7 flex items-center justify-center rounded-[var(--radius-small)] text-[var(--bone-100)] opacity-70 hover:opacity-100 hover:bg-[var(--app-dark)] transition-all"
                  >
                    <PanelLeft className="w-4 h-4" />
                  </button>
                </div>
              )}
            </>
          )}
          </div>
        )}

      <div className="flex-1 flex flex-col overflow-hidden min-h-0">

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
                <Home strokeWidth={2} className="w-4 h-4" />
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
                <MessageCircle strokeWidth={2} className="w-4 h-4" />
              </button>
            </Tooltip>
          </div>
        ) : (
          <div className={cn("px-[10px] mb-0 flex-none", isDesktopEnv ? "pt-0" : (isTabsHeaderVisible ? "pt-3" : "pt-1"))}>
            <div className="relative flex items-center p-[4px] rounded-[10px] no-drag w-full" style={{ background: 'var(--slider-track)' }}>
              {/* Sliding Pill */}
              {(() => {
                const getTabForId = (id: string | null) => id === 'tracker' ? 1 : id === 'chat' ? 2 : 0;
                
                const effectiveEntityId = storeHydrated ? activeEntityId : inferredEntityId;
                const activeTabs = new Set<number>();
                
                if (splitViewActive) {
                  activeTabs.add(getTabForId(splitViewLeftId));
                  activeTabs.add(getTabForId(splitViewRightId));
                } else {
                  activeTabs.add(getTabForId(effectiveEntityId));
                }
                
                const tabsArray = Array.from(activeTabs).sort();
                
                if (tabsArray.length === 2 && tabsArray[1] - tabsArray[0] === 1) {
                  // Neighbors: unify in one wide background tab, and slide active pill inside
                  return (
                    <>
                      {/* Wide background container */}
                      <div
                        className="absolute top-[4px] bottom-[4px] rounded-[7px] bg-[var(--bone-6)] transition-all duration-300 ease-out"
                        style={{
                          width: 'calc((100% - 8px) * 2 / 3)',
                          left: `calc(4px + (${tabsArray[0]} * (100% - 8px) / 3))`,
                        }}
                      />
                      {/* Active sliding pill */}
                      <div
                        className="absolute top-[4px] bottom-[4px] rounded-[7px] bg-[var(--slider-pill)] transition-all duration-300 ease-out"
                        style={{
                          width: 'calc((100% - 8px) / 3)',
                          left: `calc(4px + (${getTabForId(effectiveEntityId)} * (100% - 8px) / 3))`,
                          boxShadow: 'var(--slider-pill-shadow)'
                        }}
                      />
                    </>
                  );
                } else {
                  // Single or not neighbors: individual pills
                  return (
                    <>
                      {/* Background pills for all open tabs if there is more than 1 open (non-neighbor) */}
                      {tabsArray.length > 1 && tabsArray.map(tabIndex => (
                        <div
                          key={`bg-${tabIndex}`}
                          className="absolute top-[4px] bottom-[4px] rounded-[7px] bg-[var(--bone-6)] transition-all duration-300 ease-out"
                          style={{
                            width: 'calc((100% - 8px) / 3)',
                            left: `calc(4px + (${tabIndex} * (100% - 8px) / 3))`,
                          }}
                        />
                      ))}
                      {/* Active sliding pill */}
                      <div
                        className="absolute top-[4px] bottom-[4px] rounded-[7px] bg-[var(--slider-pill)] transition-all duration-300 ease-out"
                        style={{
                          width: 'calc((100% - 8px) / 3)',
                          left: `calc(4px + (${getTabForId(effectiveEntityId)} * (100% - 8px) / 3))`,
                          boxShadow: 'var(--slider-pill-shadow)'
                        }}
                      />
                    </>
                  );
                }
              })()}
              {[
                { id: 'dashboard', label: 'Home', icon: Home },
                { id: 'tracker', label: 'Tasks', icon: ListTodo },
                { id: 'chat', label: 'Chat', icon: MessageCircle }
              ].map(tab => {
                const isActive = (() => {
                  const tabIndex = tab.id === 'tracker' ? 1 : tab.id === 'chat' ? 2 : 0;
                  const effectiveEntityId = storeHydrated ? activeEntityId : inferredEntityId;
                  
                  if (splitViewActive) {
                     return (splitViewLeftId === 'tracker' ? 1 : splitViewLeftId === 'chat' ? 2 : 0) === tabIndex ||
                            (splitViewRightId === 'tracker' ? 1 : splitViewRightId === 'chat' ? 2 : 0) === tabIndex;
                  }
                  
                  const activeIndex = effectiveEntityId === 'tracker' ? 1 : effectiveEntityId === 'chat' ? 2 : 0;
                  return activeIndex === tabIndex;
                })();
                return (
                  <SidebarMainTab
                    key={tab.id}
                    tab={tab}
                    isActive={isActive}
                    onClick={() => {
                      setActiveEntityId(tab.id as any);
                      clearSelectedSidebarIds();
                    }}
                  />
                );
              })}
            </div>
          </div>
        )}

        <div className="flex-1 min-h-0 relative flex flex-col">
          {(!isMounted || !storeHydrated) ? (
            (inferredEntityId === 'chat' && !effectiveCollapsed)
              ? <ChatHistorySkeleton />
              : <SidebarSkeleton collapsed={effectiveCollapsed} inferredEntityId={inferredEntityId} />
          ) : effectiveCollapsed ? (
            <div 
              className="flex-1 min-h-0 overflow-y-auto px-[10px] pb-1 flex flex-col items-center gap-[1px] w-full scrollbar-none"
              style={{
                maskImage: 'linear-gradient(to bottom, transparent, black 16px, black calc(100% - 16px), transparent)',
                WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 16px, black calc(100% - 16px), transparent)'
              }}
            >
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
                      className={cn(
                        "sidebar-item-row flex items-center w-full cursor-pointer select-none rounded-[var(--radius-small)] pl-[8px] pr-[3px] h-7 group border border-transparent",
                        pendingNewChat
                          ? "bg-dark text-[var(--bone-100)] font-normal"
                          : "text-[var(--bone-70)] hover:bg-[var(--app-dark)] hover:text-[var(--bone-100)]"
                      )}
                    >
                      <div className="w-[14px] shrink-0 flex items-center justify-center">
                        <Pen strokeWidth={2} className="w-3.5 h-3.5" />
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
                      <MessageCircleDashed strokeWidth={2} className="w-3.5 h-3.5" />
                      <span className="ml-[6px] flex-1 text-left text-[14px] tracking-wide">Temp Chat</span>
                    </button>
                    <div className="h-px bg-transparent -mx-[10px] mt-[10px] mb-0" />
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

                  <ScrollArea innerRef={chatScrollRef} onScroll={onScroll} className="px-[10px] pt-2 pb-4 flex flex-col gap-[1px]">
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
                                            : "text-[var(--bone-70)] hover:text-[var(--bone-100)] [&:hover:not(:has(.sidebar-actions:hover))]:bg-[var(--app-dark)]"
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
                                        <span className="flex-1 text-[14px] tracking-wide truncate flex items-center gap-[6px]">
                                          {conv.is_favorite && <Star className="w-[10px] h-[10px] fill-[var(--accent)] text-[var(--accent)] shrink-0" />}
                                          <span className="truncate">{stripHtml(conv.title)}</span>
                                        </span>
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
                      {isChatHistoryLoading ? (
                        <div className="space-y-2 mt-2">
                          <Skeleton className="h-2 w-12 rounded-sm bg-[var(--bone-5)] mb-4 ml-3" />
                          {[1, 2, 3, 4, 5].map(i => (
                            <div key={i} className="flex items-center gap-3 py-1 px-2">
                              <Skeleton className="h-4 flex-1 rounded-md bg-[var(--bone-5)]" />
                              <Skeleton className="w-4 h-4 rounded-md bg-[var(--bone-5)] shrink-0" />
                            </div>
                          ))}
                        </div>
                      ) : chatConversations.length === 0 && (
                        <p className="text-xs text-muted-foreground/60 text-center pt-8">No conversations yet</p>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              ) : activeEntityId === 'tracker' ? (
                <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                  <div className="flex flex-col gap-[1px] px-[10px] pt-1.5 pb-0 shrink-0">
                    <button
                      onClick={() => openTaskPanel(generateId(), { entityId: trackerFilterEntityIds[0] || undefined })}
                      className="sidebar-item-row flex items-center w-full cursor-pointer select-none rounded-[var(--radius-small)] pl-[8px] pr-[3px] h-7 group border border-transparent text-[var(--bone-70)] hover:bg-[var(--app-dark)] hover:text-[var(--bone-100)]"
                    >
                      <div className="w-[14px] shrink-0 flex items-center justify-center">
                        <CheckSquare strokeWidth={2} className="w-3.5 h-3.5" />
                      </div>
                      <span className="ml-[6px] flex-1 text-left text-[14px] tracking-wide">New Task</span>
                    </button>
                    <button
onClick={() => {
                          clearTrackerFilterEntityIds();
                          clearTrackerFilterTags();
                        }}
                        className={cn(
                          "sidebar-item-row flex items-center w-full cursor-pointer select-none rounded-[var(--radius-small)] pl-[8px] pr-[3px] h-7 group border border-transparent text-[var(--bone-70)] hover:bg-[var(--app-dark)] hover:text-[var(--bone-100)]",
                          trackerFilterEntityIds.length === 0 && trackerFilterTags.length === 0 && "!bg-dark !text-[var(--bone-100)]"
                        )}
                    >
                      <div className="w-[14px] shrink-0 flex items-center justify-center">
                        <ListTodo strokeWidth={2} className="w-3.5 h-3.5" />
                      </div>
                      <span className="ml-[6px] flex-1 text-left text-[14px] tracking-wide">All tasks</span>
                      {allTasks.filter(t => !t.completed && t.spaceId === activeSpaceId).length > 0 && (
                        <span className="shrink-0 w-[22px] h-[22px] flex items-center justify-center rounded-[4px] bg-[var(--bone-6)] text-[12px] font-ui font-medium text-[var(--bone-70)]">
                          {allTasks.filter(t => !t.completed && t.spaceId === activeSpaceId).length}
                        </span>
                      )}
                    </button>
                    {(() => {
                      const unsortedTasks = allTasks.filter(t => !t.completed && (t.spaceId || 'ws-personal') === activeSpaceId && (!t.entityId || !spacesBase.some(ws => ws.id === t.entityId)));
                      const unsortedCount = unsortedTasks.length;
                      if (unsortedCount === 0) return null;
                      return (
                        <button
                          onClick={() => {
                            clearTrackerFilterEntityIds();
                            clearTrackerFilterTags();
                            setTrackerFilterEntityIds(['__unsorted__']);
                          }}
                          className={cn(
                            "sidebar-item-row flex items-center w-full cursor-pointer select-none rounded-[var(--radius-small)] pl-[8px] pr-[3px] h-7 group border border-transparent text-[var(--bone-70)] hover:bg-[var(--app-dark)] hover:text-[var(--bone-100)]",
                            trackerFilterEntityIds[0] === '__unsorted__' && trackerFilterTags.length === 0 && "!bg-dark !text-[var(--bone-100)]"
                          )}
                        >
                          <div className="w-[14px] shrink-0 flex items-center justify-center">
                            <Inbox strokeWidth={2} className="w-3.5 h-3.5" />
                          </div>
                          <span className="ml-[6px] flex-1 text-left text-[14px] tracking-wide">Unsorted</span>
                          {unsortedCount > 0 && (
                            <span className="shrink-0 w-[22px] h-[22px] flex items-center justify-center rounded-[4px] bg-[var(--bone-6)] text-[12px] font-ui font-medium text-[var(--bone-70)]">
                              {unsortedCount}
                            </span>
                          )}
                        </button>
                      );
                    })()}
                    <div className="h-px bg-transparent -mx-[10px] mt-[10px] mb-0" />
                  </div>
                  <div 
                    className="flex-1 min-h-0 overflow-y-auto scrollbar-thin px-[10px] pt-2 pb-4"
                    style={{
                      maskImage: 'linear-gradient(to bottom, transparent, black 16px, black calc(100% - 16px), transparent)',
                      WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 16px, black calc(100% - 16px), transparent)'
                    }}
                  >
                    <div className="flex flex-col gap-[1px]">
                      {(() => {
                        const unsortedTasks = allTasks.filter(t => !t.completed && (t.spaceId || 'ws-personal') === activeSpaceId && (!t.entityId || !spacesBase.some(ws => ws.id === t.entityId)));
                        const unsortedTags = Array.from(new Set(unsortedTasks.filter(t => t.tag && t.tag.trim()).map(t => t.tag!.trim()))).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
                        const hasUnsortedTags = unsortedTags.length > 0;
                        if (!hasUnsortedTags) return null;
                        
                        return (
                          <div className="mb-4 flex flex-col gap-[1px]">
                            <div className="pl-[8px] pr-[3px] h-7 flex items-center justify-between group cursor-default select-none rounded-[var(--radius-small)] text-[var(--bone-30)]">
                              <div className="flex items-center gap-1 group/header-label">
                                <span className="text-[11px] font-ui-label font-medium tracking-wide text-[var(--bone-30)] group-hover/header-label:text-[var(--bone-100)] transition-colors duration-75">Unsorted</span>
                              </div>
                            </div>
                            
                            <div className="relative">
                              <div className="flex flex-col gap-[1px]">
                                {unsortedTags.map((tag: string) => {
                                  const isTagActive = trackerFilterEntityIds.includes('__unsorted__') && trackerFilterTags.includes(tag);
                                  const tagCount = unsortedTasks.filter(t => t.tag?.trim() === tag).length;
                                  return (
                                    <div
                                      key={tag}
                                      onClick={(e) => {
                                        if (e.shiftKey) {
                                          e.preventDefault();
                                          if (trackerFilterEntityIds.includes('__unsorted__')) {
                                            toggleTrackerFilterTag(tag);
                                          } else {
                                            clearTrackerFilterEntityIds();
                                            clearTrackerFilterTags();
                                            setTrackerFilterEntityIds(['__unsorted__']);
                                            setTrackerFilterTags([tag]);
                                          }
                                        } else {
                                          clearTrackerFilterEntityIds();
                                          clearTrackerFilterTags();
                                          setTrackerFilterEntityIds(['__unsorted__']);
                                          setTrackerFilterTags([tag]);
                                        }
                                      }}
                                      className={cn(
                                        "sidebar-item-row group relative flex w-full select-none items-center h-7 px-3 rounded-[var(--radius-small)] border border-transparent cursor-pointer",
                                        isTagActive
                                          ? "!bg-dark text-[var(--bone-100)] font-normal"
                                          : "text-[var(--bone-70)] hover:text-[var(--bone-100)] [&:hover:not(:has(.sidebar-actions:hover))]:bg-[var(--app-dark)]",
                                        "text-[14px]"
                                      )}
                                      style={{ paddingLeft: '8px', paddingRight: '3px' }}
                                    >
                                      <div className={cn(
                                        "w-[14px] shrink-0 flex items-center justify-center text-[var(--bone-100)]",
                                        isTagActive ? "opacity-100" : "opacity-70 group-hover:opacity-100"
                                      )}>
                                        <Tag strokeWidth={2} className="w-3.5 h-3.5" />
                                      </div>
                                      <span className="ml-[6px] flex-1 text-left text-[14px] tracking-wide truncate">{tag}</span>
                                      {tagCount > 0 && (
                                        <span className="shrink-0 w-[22px] h-[22px] flex items-center justify-center rounded-[4px] bg-[var(--bone-6)] text-[12px] font-ui font-medium text-[var(--bone-70)]">
                                          {tagCount}
                                        </span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                      <div
                        className={cn(
                          "pl-[8px] pr-[3px] h-7 flex items-center justify-between group cursor-default select-none rounded-[var(--radius-small)] ",
                          contextMenu?.entityId === 'spaces'
                            ? "text-[var(--bone-100)]"
                            : "text-[var(--bone-30)]"
                        )}
                      >
                        <div className="flex items-center gap-1 group/header-label">
                          <span className="text-[11px] font-ui-label font-medium tracking-wide text-[var(--bone-30)] group-hover/header-label:text-[var(--bone-100)] transition-colors duration-75">Workspaces</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const rect = e.currentTarget.getBoundingClientRect();
                              openContextMenu('spaces', rect.right, rect.top, 'sidebar-section');
                            }}
                            className={cn(
                              "btn-sidebar-utility opacity-30 hover:opacity-100",
                              contextMenu?.entityId === 'spaces' && "!bg-dark !text-[var(--bone-100)] !opacity-100"
                            )}
                          >
                            <Settings2 strokeWidth={2} className="w-3.5 h-3.5 rotate-90" />
                          </button>
                        </div>
                      </div>
                      <DroppableZone id="tracker-spaces-container" className="flex flex-col gap-[1px]">
                        {spacesBase.map(ws => (
                          <TrackerWorkspaceItem
                            key={ws.id}
                            ws={ws}
                            allTasks={allTasks}
                            activeSpaceId={activeSpaceId}
                            collapsedTrackerWorkspaces={collapsedTrackerWorkspaces}
                            setCollapsedTrackerWorkspaces={setCollapsedTrackerWorkspaces}
                            trackerFilterEntityIds={trackerFilterEntityIds}
                            trackerFilterTags={trackerFilterTags}
                            toggleTrackerFilterEntityId={toggleTrackerFilterEntityId}
                            toggleTrackerFilterTag={toggleTrackerFilterTag}
                            clearTrackerFilterEntityIds={clearTrackerFilterEntityIds}
                            clearTrackerFilterTags={clearTrackerFilterTags}
                            setTrackerFilterEntityIds={setTrackerFilterEntityIds}
                            setTrackerFilterTags={setTrackerFilterTags}
                          />
                        ))}
                      </DroppableZone>
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
                    <div className="h-px bg-transparent -mx-[10px] mt-[10px] mb-0" />
                  </div>

                  <ScrollArea
                    innerRef={mainScrollRef}
                    onScroll={onScroll}
                    className="px-[10px] pt-2 pb-4"
                  >
                    <div
                      className="flex flex-col min-h-full"
                      onClick={(e) => {
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
                                      ? "text-[var(--bone-100)]"
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
                                        "btn-sidebar-utility text-[var(--bone-100)] opacity-30 hover:opacity-100",
                                        contextMenu?.entityId === 'pinned' && "!bg-dark !opacity-100"
                                      )}
                                    >
                                      <Settings2 strokeWidth={2} className="w-3.5 h-3.5 rotate-90" />
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
                                      <DroppableZone id="pinned-container" className="flex flex-col gap-[1px] mt-[1px] sidebar-list mb-2">
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
                                      ? "text-[var(--bone-100)]"
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
                                        "btn-sidebar-utility opacity-30 hover:opacity-100",
                                        contextMenu?.entityId === 'unsorted' && "!bg-dark !text-[var(--bone-100)] !opacity-100"
                                      )}
                                    >
                                      <Settings2 strokeWidth={2} className="w-3.5 h-3.5 rotate-90" />
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
                                      <DroppableZone id="unsorted-container" className="flex flex-col gap-[1px] mt-[1px] sidebar-list mb-2">
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

                          if (sectionId === 'spaces') {
                            return (
                              <div key="spaces" className="flex flex-col gap-[1px]">
                                <div
                                  className={cn(
                                    "pl-[8px] pr-[3px] h-7 flex items-center justify-between group cursor-pointer select-none rounded-[var(--radius-small)] ",
                                    contextMenu?.entityId === 'spaces'
                                      ? "text-[var(--bone-100)]"
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
                                        openModal({ kind: 'newWorkspace' });
                                      }}
                                      className="btn-sidebar-utility opacity-30 hover:opacity-100"
                                    >
                                      <Plus strokeWidth={2} className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        openContextMenu('spaces', rect.right, rect.top, 'sidebar-section');
                                      }}
                                      className={cn(
                                        "btn-sidebar-utility opacity-30 hover:opacity-100",
                                        contextMenu?.entityId === 'spaces' && "!bg-dark !text-[var(--bone-100)] !opacity-100"
                                      )}
                                    >
                                      <Settings2 strokeWidth={2} className="w-3.5 h-3.5 rotate-90" />
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
                                      <DroppableZone id="spaces-container" className="flex flex-col gap-[1px] mt-[1px] mb-2">
                                        {displayWorkspaces.map(workspace => (
                                          <TreeItem key={workspace.id} entity={workspace} depth={0} isMultiSelected={selectedSidebarIds.includes(workspace.id)} onShiftClick={handleShiftClick} />
                                        ))}
                                        {(() => {
                                          const lastWorkspace = displayWorkspaces[displayWorkspaces.length - 1];
                                          if (!lastWorkspace) return null;
                                          const hasChildren = entities.some(e => e.parentId === lastWorkspace.id);
                                          const isExpanded = !collapsedIds.includes(lastWorkspace.id);
                                          if (!hasChildren || !isExpanded) return null;
                                          return <AfterFolderSpacer folderId={lastWorkspace.id} depth={0} spaceId={lastWorkspace.spaceId} />;
                                        })()}
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
                      {(() => {
                        const lastWorkspace = displayWorkspaces[displayWorkspaces.length - 1];
                        if (!lastWorkspace) return null;
                        return <AfterFolderSpacer folderId={lastWorkspace.id} depth={0} spaceId={lastWorkspace.spaceId} fillRemainingSpace />;
                      })()}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {!effectiveCollapsed && <UpdateBanner />}
      <div
        onClick={(e) => {
          if (effectiveCollapsed) {
            openModal({ kind: 'settings' });
            clearSelectedSidebarIds();
            return;
          }
          const rect = e.currentTarget.getBoundingClientRect();
          setProfilePopupPos({ x: rect.left, bottom: window.innerHeight - rect.top + 8, width: rect.width });
        }}
        className={cn(
          "select-none transition-all duration-200 flex items-center mt-auto",
          effectiveCollapsed
            ? "border-t border-[var(--bone-6)] flex-col items-center py-4 h-auto gap-4 px-0 w-full cursor-pointer"
            : "mx-[10px] mb-3 rounded-[10px] bg-[var(--slider-track)] p-[4px] pr-2 justify-between cursor-pointer hover:bg-[var(--slider-pill)] border border-[var(--bone-3)] hover:border-[var(--bone-15)]",
          (!effectiveCollapsed && profilePopupPos) && "bg-[var(--slider-pill)]"
        )}
      >
        <div
          className={cn(
            "flex items-center text-left transition-all no-drag group/profile outline-none",
            effectiveCollapsed
              ? cn("w-10 h-10 justify-center rounded-full hover:bg-[var(--app-dark)]", activeEntityId === 'settings' && "bg-[var(--app-dark)] text-[var(--bone-100)]")
              : "flex-1 min-w-0 gap-2.5 pl-2 pr-1.5 py-1"
          )}
        >
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[var(--bone-15)] to-[var(--bone-6)] flex items-center justify-center shrink-0 overflow-hidden relative">
            <span className="text-[10px] font-bold text-[var(--bone-70)] tracking-wide group-hover/profile:text-[var(--bone-100)] transition-colors">{sidebarInitial}</span>
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
              <span className="text-[12px] font-semibold text-[var(--bone-100)] truncate tracking-wide leading-tight">
                {sidebarDisplayName}
              </span>
              <span className="text-[10px] text-[var(--bone-30)] truncate tracking-wide leading-tight">
                {activeWorkspace?.name || 'Personal'}
              </span>
            </div>
          )}
        </div>
        <div className={cn("flex items-center gap-0.5 shrink-0", effectiveCollapsed && "flex-col gap-2 py-4 h-auto")}>
          <InstallButton collapsed={effectiveCollapsed} />
          <Tooltip content="Spaces">
            <button
              onClick={(e) => {
                e.stopPropagation();
                const rect = e.currentTarget.getBoundingClientRect();
                openContextMenu(null, rect.left, rect.top, 'spaces');
              }}
              className={cn(
                effectiveCollapsed
                  ? "w-10 h-10 flex items-center justify-center rounded-[var(--radius-8)] text-[var(--bone-100)] opacity-70 hover:opacity-100 hover:bg-[var(--app-dark)] transition-colors border border-transparent"
                  : cn(
                    "btn-sidebar-utility rounded-[7px] w-7 h-7 flex items-center justify-center hover:!bg-[var(--slider-pill)] hover:text-[var(--bone-100)] transition-colors duration-200 text-[var(--bone-70)]",
                    contextMenu?.source === 'spaces' && "!bg-[var(--slider-pill)] !text-[var(--bone-100)] opacity-100"
                  )
              )}
            >
              <ChevronsUpDown strokeWidth={2} className="w-3.5 h-3.5" />
            </button>
          </Tooltip>
        </div>
      </div>

      {chatMenuOpenId && (
        <>
          <div className="fixed inset-0 z-[299]" onClick={() => setChatMenuOpenId(null)} />
          <div
            className="fixed z-[300] popup-glass-small min-w-[160px] p-1 flex flex-col gap-[2px]"
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
              onClick={() => {
                if (chatMenuOpenId) {
                  const conv = chatConversations.find(c => c.id === chatMenuOpenId);
                  if (conv) {
                    toggleFavoriteChatConversation(chatMenuOpenId, !conv.is_favorite);
                  }
                }
                setChatMenuOpenId(null);
              }}
              className="popup-item"
            >
              <Star strokeWidth={2} className="w-4 h-4 shrink-0" />
              {chatConversations.find(c => c.id === chatMenuOpenId)?.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
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
            className="fixed z-[300] popup-glass-small min-w-[160px] p-1 flex flex-col gap-[2px]"
            style={{ left: newPagePopupPos.x, top: newPagePopupPos.y }}
          >
            {[
              { type: 'note' as const, label: 'Note', icon: FileText },
              { type: 'canvas' as const, label: 'Canvas', icon: Frame },
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
                className="popup-item group w-full flex items-center gap-2 px-3 text-sm transition-none"
              >
                <opt.icon strokeWidth={2} className="w-4 h-4 shrink-0 text-[var(--bone-100)] opacity-70 group-hover:opacity-100" />
                <span className="flex-1 text-left font-medium tracking-wide">{opt.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
      {profilePopupPos && (
        <>
          <div className="fixed inset-0 z-[299]" onClick={() => setProfilePopupPos(null)} />
          <div
            className="fixed z-[300] popup-glass-small p-1 flex flex-col gap-[2px]"
            style={{ left: profilePopupPos.x, bottom: profilePopupPos.bottom, width: profilePopupPos.width }}
          >
            {user?.email && (
              <div className="px-3 pt-1 pb-1 text-[11px] font-medium text-[var(--bone-30)] select-none truncate">
                {user.email}
              </div>
            )}

            <button
              onClick={() => {
                openModal({ kind: 'settings' });
                clearSelectedSidebarIds();
                setProfilePopupPos(null);
              }}
              className="popup-item !py-1 group w-full flex items-center gap-2 px-3 text-sm transition-none"
            >
              <Settings strokeWidth={2} className="w-4 h-4 shrink-0 text-[var(--bone-100)] opacity-70 group-hover:opacity-100" />
              <span className="flex-1 text-left font-medium tracking-wide">Settings</span>
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleTheme();
              }}
              className="popup-item !py-1 group w-full flex items-center gap-2 px-3 text-sm transition-none"
            >
              {theme === 'dark' ? (
                <>
                  <Sun strokeWidth={2} className="w-4 h-4 shrink-0 text-[var(--bone-100)] opacity-70 group-hover:opacity-100" />
                  <span className="flex-1 text-left font-medium tracking-wide">Light Mode</span>
                </>
              ) : (
                <>
                  <Moon strokeWidth={2} className="w-4 h-4 shrink-0 text-[var(--bone-100)] opacity-70 group-hover:opacity-100" />
                  <span className="flex-1 text-left font-medium tracking-wide">Dark Mode</span>
                </>
              )}
            </button>

            <div className="h-px bg-[var(--bone-6)] my-[3px]" />

            {isDesktop() && (
              <>
                <button
                  onClick={() => {
                    setProfilePopupPos(null);
                    window.dispatchEvent(new CustomEvent('flowr:check-updates'));
                  }}
                  className="popup-item !py-1 group w-full flex items-center gap-2 px-3 text-sm transition-none"
                >
                  <RefreshCw strokeWidth={2} className="w-4 h-4 shrink-0 text-[var(--bone-100)] opacity-70 group-hover:opacity-100" />
                  <span className="flex-1 text-left font-medium tracking-wide">Check for Updates</span>
                </button>
                <div className="h-px bg-[var(--bone-6)] my-[3px]" />
              </>
            )}

            <button
              onClick={() => {
                signOut();
                setProfilePopupPos(null);
              }}
              className="popup-item-danger !py-1 group w-full flex items-center gap-2 px-3 text-sm transition-none"
            >
              <LogOut strokeWidth={2} className="w-4 h-4 shrink-0 text-red-400 group-hover:text-red-300" />
              <span className="flex-1 text-left font-medium tracking-wide">Log out</span>
            </button>
          </div>
        </>
      )}
    </aside>
  );
});
