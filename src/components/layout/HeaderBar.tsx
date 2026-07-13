"use client";

import { useStore, generateId } from '@/data/store';
import { getEntityIcon } from '@/data/icons';
import {
  ArrowLeft, ArrowRight, RotateCw, RotateCcw, Home, MessageCircle,
  ListTodo, Menu, X, ChevronRight, ChevronLeft, Plus, PanelLeft, Columns2,
  File, Frame, Folder, Search, Pin, ArrowLeftRight,
  MoreVertical, BookOpen, Pencil
} from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/utils';
import { Tooltip } from './Tooltip';
import { Portal } from './Portal';
import { stripHtml } from '@/lib/utils';
import { isDesktop } from '@/lib/env';
import { useAppReady } from '@/hooks/useAppReady';
import React, { memo, useState, useRef, useLayoutEffect, useEffect } from 'react';

// â”€â”€â”€ Concave corner SVG â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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




const EntityHeaderControls = ({ entityId }: { entityId: string | null }) => {
  const isReadMode = useStore(s => !!s.readModeStates[entityId || '']);
  const setReadMode = useStore(s => s.setReadMode);
  const entities = useStore(s => s.entities);
  const openContextMenu = useStore(s => s.openContextMenu);
  const contextMenu = useStore(s => s.contextMenu);

  const isDesktopEnv = isDesktop();

  if (!entityId || entityId === 'dashboard' || entityId === 'chat' || entityId === 'tracker') return null;

  const isNote = entities.find(e => e.id === entityId)?.type === 'note';
  const isOptionsOpen = contextMenu?.entityId === entityId && contextMenu?.source === 'tab';

  const btnClasses = `flex items-center justify-center rounded-[var(--radius-medium)] text-[var(--bone-100)] cursor-pointer transition-opacity ${isDesktopEnv ? 'w-8 h-8' : 'w-7 h-7'}`;

  return (
    <div className="flex items-center gap-1 h-full shrink-0 [-webkit-app-region:no-drag]">
      <Tooltip content="Options">
        <button
          onClick={(e) => {
            e.stopPropagation();
            const rect = e.currentTarget.getBoundingClientRect();
            openContextMenu(entityId, rect.left, rect.bottom + 6, 'tab');
          }}
          className={cn(
            btnClasses,
            isOptionsOpen ? "opacity-100 bg-[var(--bone-10)]" : "opacity-70 hover:opacity-100 hover:bg-[var(--bone-6)]"
          )}
        >
          <MoreVertical className="w-4 h-4" />
        </button>
      </Tooltip>
      {isNote && (
        <Tooltip content={isReadMode ? "Switch to Edit mode" : "Switch to Read mode"}>
          <button
            onClick={e => { e.stopPropagation(); setReadMode(entityId, !isReadMode); }}
            className={cn(
              btnClasses,
              "opacity-70 hover:opacity-100 hover:bg-[var(--bone-6)]"
            )}
          >
            {isReadMode ? <BookOpen className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
          </button>
        </Tooltip>
      )}
    </div>
  );
};

const StaticTabPill = ({ tabId, isDesktopEnv, R_INACTIVE, R_ACTIVE, BAR_H }: any) => {
  const entities = useStore(s => s.entities);
  const chatConversations = useStore(s => s.chatConversations);
  const activeChatId = useStore(s => s.activeChatId);
  const isTempChat = useStore(s => s.isTempChat);
  const removeTab = useStore(s => s.removeTab);

  const getTabMeta = (id: string) => {
    if (id === 'dashboard') return { title: 'Home', Icon: Home };
    if (id === 'chat') {
      const ac = chatConversations.find(c => c.id === activeChatId);
      return { title: isTempChat ? 'Temporary Chat' : (ac?.title || 'Chat'), Icon: MessageCircle };
    }
    if (id === 'tracker') return { title: 'Tasks', Icon: ListTodo };
    const entity = entities.find(e => e.id === id);
    if (entity) {
      const Icon = entity.icon ? getEntityIcon(entity.icon) : entity.type === 'canvas' ? Frame : entity.type === 'folder' ? Folder : File;
      return { title: entity.title, Icon };
    }
    return { title: null, Icon: null };
  };

  const { title, Icon } = getTabMeta(tabId);
  if (!title && tabId !== 'dashboard' && tabId !== 'chat' && tabId !== 'tracker') return null;

  return (
    <Tooltip content={stripHtml(title || '')} position="bottom">
      <div
        className="relative flex-shrink min-w-0 max-w-[250px] [-webkit-app-region:no-drag] select-none"
        style={{ height: BAR_H, zIndex: 20 }}
      >
        <div
          className={`absolute inset-x-0 top-[6px] ${isDesktopEnv ? 'bottom-[-1px]' : 'bottom-0'}`}
        >
          {/* Tab Background */}
          <div 
            className="absolute inset-0 bg-[var(--app-background)]"
            style={{ borderRadius: `${R_INACTIVE}px ${R_INACTIVE}px 0 0` }}
          />
          {/* Tab Border (masked to stop exactly at curve tangent) */}
          <div 
            className="absolute inset-0 border-t border-l border-r border-[var(--bone-10)] pointer-events-none"
            style={{ 
              borderRadius: `${R_INACTIVE}px ${R_INACTIVE}px 0 0`,
              WebkitMaskImage: `linear-gradient(to bottom, black calc(100% - ${R_ACTIVE + 1}px), transparent calc(100% - ${R_ACTIVE + 1}px))`,
              maskImage: `linear-gradient(to bottom, black calc(100% - ${R_ACTIVE + 1}px), transparent calc(100% - ${R_ACTIVE + 1}px))`
            }}
          />
          <ConcaveCorner side="left"  r={R_ACTIVE} />
          <ConcaveCorner side="right" r={R_ACTIVE} />
        </div>
        <div
          className="relative z-10 w-full h-full flex items-center gap-[5px]"
          style={{ paddingLeft: 12, paddingRight: 28 }}
        >
          {Icon && <Icon strokeWidth={2} style={{ width: 14, height: 14, flexShrink: 0 }} className="text-[var(--bone-100)] opacity-90" />}
          <span
            className="flex-1 min-w-0 font-medium text-[var(--bone-100)]"
            style={{ fontSize: 13, lineHeight: 1, overflow: 'hidden', whiteSpace: 'nowrap' }}
            ref={(el) => {
              if (!el) return;
              if (el.scrollWidth > el.clientWidth) {
                el.style.maskImage = 'linear-gradient(to right, black calc(100% - 16px), transparent 100%)';
                el.style.webkitMaskImage = 'linear-gradient(to right, black calc(100% - 16px), transparent 100%)';
              } else {
                el.style.maskImage = '';
                el.style.webkitMaskImage = '';
              }
            }}
          >
            {stripHtml(title || '')}
          </span>
          <button
            onClick={e => { e.stopPropagation(); removeTab(tabId); }}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 hover:bg-[var(--bone-12)] rounded-[3px] flex items-center justify-center shrink-0 opacity-50 hover:opacity-100"
            style={{ width: 18, height: 18 }}
          >
            <X strokeWidth={2.5} className="w-3 h-3"/>
          </button>
        </div>
      </div>
    </Tooltip>
  );
};

export const HeaderBar = memo(function HeaderBar({ leftWidth, rightWidth }: { leftWidth?: number, rightWidth?: number }) {
  const activeEntityId       = useStore(s => s.activeEntityId);
  const entities             = useStore(s => s.entities);
  const goBack               = useStore(s => s.goBack);
  const goForward            = useStore(s => s.goForward);
  const setActiveEntityId    = useStore(s => s.setActiveEntityId);
  const toggleSidebar        = useStore(s => s.toggleSidebar);
  const toggleCommandPalette = useStore(s => s.toggleCommandPalette);
  const openContextMenu      = useStore(s => s.openContextMenu);
  const isTabsHeaderVisible  = useStore(s => s.isTabsHeaderVisible);
  const openTabIds           = useStore(s => s.openTabIds);
  const activeTabId          = useStore(s => s.activeTabId);
  const setActiveTab         = useStore(s => s.setActiveTab);
  const removeTab            = useStore(s => s.removeTab);
  const addEntity            = useStore(s => s.addEntity);
  const setOpenTabs          = useStore(s => s.setOpenTabs);
  const isTempChat           = useStore(s => s.isTempChat);
  const isSidebarCollapsed   = useStore(s => s.isSidebarCollapsed);
  const toggleSplitView      = useStore(s => s.toggleSplitView);
  const selectedSidebarIds   = useStore(s => s.selectedSidebarIds);
  const splitViewActive      = useStore(s => s.splitViewActive);
  const splitViewLeftId      = useStore(s => s.splitViewLeftId);
  const splitViewRightId     = useStore(s => s.splitViewRightId);
  const splitViewPosition    = useStore(s => s.splitViewPosition);
  const setSplitViewPosition = useStore(s => s.setSplitViewPosition);

  const [isMounted, setIsMounted] = useState(false);
  const [storeHydrated, setStoreHydrated] = useState(false);

  const { isReady: hasHydrated } = useAppReady();

  const splitViewPinned      = useStore(s => s.splitViewPinned);
  const togglePin            = useStore(s => s.togglePin);
  const swapColumns          = useStore(s => s.swapColumns);

  const isDesktopEnv = isDesktop();
  const isMac = typeof window !== 'undefined' && window.navigator.userAgent.indexOf('Mac') !== -1;

  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    if (!isMac || typeof window === 'undefined') return;
    const checkFullscreen = () => {
      setIsFullscreen(window.innerHeight === window.screen.height);
    };
    checkFullscreen();
    window.addEventListener('resize', checkFullscreen);
    return () => window.removeEventListener('resize', checkFullscreen);
  }, [isMac]);

  // â”€â”€â”€ Sizing â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const BAR_H     = isDesktopEnv ? 50 : 42; // fixed header height
  const M         = 6;                    // uniform tab spacing: hover container top/bottom margins + strip gap (px)
  const R_ACTIVE   = 12;                  // concave bridge under selected tab
  const R_INACTIVE = 8;                    // selected top corners + unselected hover container

  const [newItemPopup, setNewItemPopup] = useState<{ x: number; y: number } | null>(null);

  // â”€â”€â”€ Drag-to-reorder (push-aside model) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // The array order is FIXED during drag. The dragged tab is translated to follow
  // the pointer (instant). Static tabs between the dragged slot and the *target*
  // slot are translated aside by exactly the dragged tab's footprint (width + gap)
  // and that translate runs through a CSS transition â†’ they slide, never teleport.
  // Nothing reorders mid-drag, so there is no commit-time reflow â†’ no bounce.
  // On release we commit the reorder once and settle the released tab from its
  // pointer position into its new slot via a one-shot FLIP (measured in a layout
  // effect, so it never snaps).
  const tabsRef = useRef<HTMLDivElement>(null);

  // render-facing drag state
  const [drag, setDrag] = useState<{ id: string; origIndex: number; targetIndex: number; width: number } | null>(null);
  const [dragOffsetX, setDragOffsetX] = useState<number>(0);
  const [release, setRelease] = useState<{ id: string; dx: number } | null>(null);
  const [releasePlay, setReleasePlay] = useState<boolean>(false);
  const [releaseTick, setReleaseTick] = useState<number>(0);

  // handler-side drag state (mutable, avoids stale closures / re-renders)
  const dragStartX = useRef<number>(0);
  const hasMoved = useRef<boolean>(false);
  const latestOffsetRef = useRef<number>(0);
  const releasePendingRef = useRef<{ id: string; naturalLeft: number; latestOffset: number } | null>(null);
  const releaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const releaseRafRef = useRef<{ outer: number | null; inner: number | null; cancelled: boolean }>({ outer: null, inner: null, cancelled: false });

  type DragInfo = {
    id: string;  origIndex: number;
    targetIndex: number;
    width: number;
    grabOffset: number;
    containerLeft: number;
    containerWidth: number;
    naturalLefts: number[];
    screenCenters: number[];
  };
  const dragInfoRef = useRef<DragInfo | null>(null);

  // Push-aside translate for a static tab, in px. Tabs strictly between the
  // dragged origin (d) and the target slot (t) shift by exactly ±(width+gap).
  const pushShift = (i: number, d: number, t: number, width: number) => {
    if (d === t) return 0;
    const mag = width + M;
    if (t > d) return i > d && i <= t ? -mag : 0;   // dragged moves right → in-between slide left
    return i < d && i >= t ? mag : 0;               // dragged moves left  → in-between slide right
  };

  const onTabMouseDown = (e: React.MouseEvent, tabId: string) => {
    if (e.button !== 0) return;
    if (splitViewActive) return; // Disable drag in split view
    if ((e.target as HTMLElement).closest('[data-close]')) return;

    const container = tabsRef.current;
    if (!container) return;
    const order = useStore.getState().openTabIds;
    const origIndex = order.indexOf(tabId);
    if (origIndex === -1) return;

    const els = Array.from(container.querySelectorAll('[data-tab-id]')) as HTMLElement[];
    const draggedEl = els.find(el => el.getAttribute('data-tab-id') === tabId);
    if (!draggedEl) return;

    const naturalLefts   = els.map(el => el.offsetLeft);
    const containerLeft  = container.getBoundingClientRect().left;
    const grabOffset     = e.clientX - (containerLeft + draggedEl.offsetLeft);
    // screen-level centers (match clientX in onMove) — must use the tab's
    // *natural* screen position so thresholds never drift with push transforms.
    const screenCenters = els.map(el => {
      const r = el.getBoundingClientRect(); // already excludes transform
      return r.left + r.width / 2;
    });

    dragInfoRef.current = {
      id: tabId, origIndex, targetIndex: origIndex,
      width: draggedEl.offsetWidth, grabOffset, containerLeft,
      containerWidth: container.offsetWidth,
      naturalLefts, screenCenters,
    };
    dragStartX.current = e.clientX;
    hasMoved.current = false;
    latestOffsetRef.current = 0;

    const onMove = (ev: MouseEvent) => {
      const di = dragInfoRef.current;
      if (!di) return;
      const pointerX = ev.clientX;

      if (!hasMoved.current) {
        if (Math.abs(pointerX - dragStartX.current) <= 4) return;
        hasMoved.current = true;
        setDrag({ id: tabId, origIndex, targetIndex: origIndex, width: di.width });
      }

      // dragged tab follows the pointer instantly (its natural slot never moves,
      // because the array is fixed during drag → no glue recalculation needed)
      const rawOffset = pointerX - di.containerLeft - di.naturalLefts[origIndex] - di.grabOffset;
      const minOffset = di.naturalLefts[0] - di.naturalLefts[origIndex];
      const maxOffset = di.containerWidth - 8 - di.width - di.naturalLefts[origIndex];
      const offset = Math.max(minOffset, Math.min(rawOffset, maxOffset));
      latestOffsetRef.current = offset;
      setDragOffsetX(offset);

      // target slot from STABLE screen-level centers (measured once at mousedown),
      // so detection never lags behind a mid-drag reflow or a transition.
      const draggedTabCenter = pointerX - di.grabOffset + (di.width / 2);
      const centers = di.screenCenters;
      const dc = centers[origIndex];
      let t = origIndex;
      if (draggedTabCenter > dc) {
        while (t + 1 < centers.length && draggedTabCenter > centers[t + 1]) t++;
      } else if (draggedTabCenter < dc) {
        while (t - 1 >= 0 && draggedTabCenter < centers[t - 1]) t--;
      }
      if (t !== di.targetIndex) {
        di.targetIndex = t;
        setDrag(d => (d ? { ...d, targetIndex: t } : d));
      }
    };

    const onUp = (ev: MouseEvent) => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);

      const di = dragInfoRef.current;
      dragInfoRef.current = null;

      if (!hasMoved.current) {
        const state = useStore.getState();
        if (ev.shiftKey && tabId !== state.activeEntityId) {
          if (state.activeEntityId === 'chat' || tabId === 'chat') {
            useStore.setState({
              isAIAssistantOpen: true,
              splitViewActive: false
            });
            if (state.activeEntityId === 'chat') {
              setActiveTab(tabId);
            }
          } else {
            useStore.setState({
              splitViewActive: true,
              splitViewLeftId: state.activeEntityId || 'dashboard',
              splitViewRightId: tabId
            });
          }
        } else {
          setActiveTab(tabId);
        }
        setDrag(null);
        setDragOffsetX(0);
        return;
      }

      const targetIndex = di ? di.targetIndex : origIndex;
      const naturalLeftD = di ? di.naturalLefts[origIndex] : 0;
      releasePendingRef.current = {
        id: tabId,
        naturalLeft: naturalLeftD,
        latestOffset: latestOffsetRef.current,
      };

      // commit the reorder exactly once, on release
      if (targetIndex !== origIndex) {
        const cur = useStore.getState().openTabIds;
        const next = [...cur];
        next.splice(origIndex, 1);
        next.splice(targetIndex, 0, tabId);
        setOpenTabs(next); // openTabIds change triggers the release-FLIP layout effect
      } else {
        setReleaseTick(x => x + 1); // no reorder â€” just settle the dragged tab back
      }
      setDrag(null);
      setDragOffsetX(0);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  // Release-FLIP: settle the released tab from its pointer position into its slot.
  // Runs synchronously before paint, so the first painted frame already shows it
  // at the pointer and it animates to 0 â€” never snaps forward, never snaps back.
  useLayoutEffect(() => {
    const pending = releasePendingRef.current;
    if (!pending) return;
    releasePendingRef.current = null;

    const container = tabsRef.current;
    const el = container?.querySelector(`[data-tab-id="${pending.id}"]`) as HTMLElement | null;
    if (!el) return;

    const visualLeft = pending.naturalLeft + pending.latestOffset; // where it was under the pointer
    const newNatural  = el.offsetLeft;                            // its slot now (post-commit), excludes transforms
    const dx = visualLeft - newNatural;

    // INVERT (before paint, transition none): paint the tab exactly where it was
    // under the pointer, so the settle never "from"-animates off the pointer.
    setRelease({ id: pending.id, dx });
    setReleasePlay(false);

    // Double rAF: the INVERT frame must PAINT before we switch to PLAY, otherwise
    // the transition anchors to the stale drag transform and the tab jumps on release.
    const handle = releaseRafRef.current;
    handle.cancelled = false;
    handle.outer = requestAnimationFrame(() => {
      handle.inner = requestAnimationFrame(() => {
        if (handle.cancelled) return;
        // PLAY: turn the transition on and animate dx â†’ 0 into the slot.
        setRelease({ id: pending.id, dx: 0 });
        setReleasePlay(true);
      });
    });
    if (releaseTimerRef.current) clearTimeout(releaseTimerRef.current);
    releaseTimerRef.current = setTimeout(() => { setRelease(null); setReleasePlay(false); }, 320);

    return () => {
      handle.cancelled = true;
      if (handle.outer != null) cancelAnimationFrame(handle.outer);
      if (handle.inner != null) cancelAnimationFrame(handle.inner);
      if (releaseTimerRef.current) { clearTimeout(releaseTimerRef.current); releaseTimerRef.current = null; }
    };
  }, [openTabIds, releaseTick]);

  // â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const isDashboard = activeEntityId === 'dashboard' || !activeEntityId;

  const getPath = (id: string | null): any[] => {
    if (!id || id === 'dashboard') return [];
    if (id === 'chat')    return [{ id: 'chat',    title: 'Chat',  icon: 'MessageCircle' }];
    if (id === 'tracker') return [{ id: 'tracker', title: 'Tasks', icon: 'ListTodo' }];
    const entity = entities.find(e => e.id === id);
    if (!entity) return [];
    const parts: any[] = [{ id: entity.id, title: entity.title, icon: entity.icon }];
    let cur = entity;
    while (cur.parentId) {
      const p = entities.find(e => e.id === cur.parentId);
      if (p) { parts.unshift({ id: p.id, title: p.title, icon: p.icon }); cur = p; } else break;
    }
    return parts;
  };

  const getTabMeta = (tabId: string) => {
    const entity = entities.find(e => e.id === tabId);
    let title = entity?.title;
    let Icon: any = null;
    if      (tabId === 'dashboard') { title = 'Home'; Icon = Home; }
    else if (tabId === 'chat')      { title = isTempChat ? 'Temporary Chat' : 'Chat'; Icon = MessageCircle; }
    else if (tabId === 'tracker')   { title = 'Tasks'; Icon = ListTodo; }
    else if (entity)                { Icon = entity.icon ? getEntityIcon(entity.icon) : entity.type === 'canvas' ? Frame : entity.type === 'folder' ? Folder : File; }
    return { title, Icon };
  };

  const btnCls = (ok: boolean) =>
    `flex items-center justify-center rounded-[var(--radius-medium)] [-webkit-app-region:no-drag] ${isDesktopEnv ? 'w-8 h-8' : 'w-7 h-7'} ${ok ? 'text-[var(--bone-100)] opacity-70 hover:opacity-100 hover:bg-[var(--bone-6)] cursor-pointer transition-opacity' : 'text-border opacity-30 cursor-default'}`;

  if (!isTabsHeaderVisible && !isDesktopEnv) return null;

  return (
    <div
      className={cn(
        "w-full flex items-center shrink-0 relative z-30 [-webkit-app-region:drag] group/header",
        isDesktopEnv ? "px-2 gap-2 bg-[var(--app-dark)]" : "pl-2 pr-3 bg-sidebar"
      )}
      style={{ height: BAR_H }}
    >
      {/* — Visual bottom border line — */}
      {!isDesktopEnv && <div className="absolute inset-x-0 bottom-0 h-[1px] bg-[var(--bone-10)] z-0" />}

      {/* Web: collapsed sidebar buttons */}
      {!isDesktopEnv && isSidebarCollapsed && (
        <div className="flex items-center gap-1 shrink-0 mr-2 z-10">
          <button
            onClick={toggleCommandPalette}
            className="flex items-center justify-center w-7 h-7 rounded-[var(--radius-medium)] text-[var(--bone-100)] shrink-0 transition-opacity opacity-70 hover:opacity-100 hover:bg-[var(--bone-6)] [-webkit-app-region:no-drag]"
          >
            <Search strokeWidth={2} className="w-4 h-4"/>
          </button>
          <button
            onClick={toggleSidebar}
            className="flex items-center justify-center w-7 h-7 rounded-[var(--radius-medium)] text-[var(--bone-100)] shrink-0 transition-opacity opacity-70 hover:opacity-100 hover:bg-[var(--bone-6)] [-webkit-app-region:no-drag]"
          >
            <PanelLeft strokeWidth={2} className="w-4 h-4"/>
          </button>
          <div className="w-[1px] h-4 bg-[var(--bone-10)] ml-1 mr-0" />
        </div>
      )}

      {/* Desktop nav */}
      {isDesktopEnv && (
        <div className={`flex items-center gap-1 shrink-0 z-10 ${isMac && !isFullscreen ? 'pl-[72px]' : 'pl-[20px]'}`} style={{ width: isSidebarCollapsed ? undefined : `calc(${leftWidth}px - 8px)` }}>
          <Tooltip content="Go Back">   <button onClick={goBack}               className={btnCls(true)}><ArrowLeft  strokeWidth={2} className="w-4 h-4"/></button></Tooltip>
          <Tooltip content="Go Forward"><button onClick={goForward}             className={btnCls(true)}><ArrowRight strokeWidth={2} className="w-4 h-4"/></button></Tooltip>
          <Tooltip content="Refresh">    <button onClick={() => window.location.reload()}              className={btnCls(true)}><RotateCw   strokeWidth={2} className="w-4 h-4"/></button></Tooltip>
          <Tooltip content="Search">     <button onClick={toggleCommandPalette}            className={btnCls(true)}><Search     strokeWidth={2} className="w-4 h-4"/></button></Tooltip>
          <Tooltip content="Toggle Sidebar"><button onClick={toggleSidebar}                 className={btnCls(true)}><PanelLeft  strokeWidth={2} className="w-4 h-4"/></button></Tooltip>
        </div>
      )}

      {/* Mobile title */}
      <div className="flex md:hidden flex-1 items-center px-1 min-w-0 font-semibold text-sm text-[var(--bone-100)] truncate z-10">
        {isDashboard ? 'Home' : activeEntityId === 'tracker' ? 'Tasks' : activeEntityId === 'chat' ? 'Chat' :
          stripHtml(entities.find(e => e.id === activeEntityId)?.title || '')}
      </div>

      {/* ——————————————————————————————————————————————————————————————————————————————————————————————————
          items-end: tab layout boxes sit at the bottom edge
      ———————————————————————————————————————————————————————————————————————————————————————————————————— */}
      <div
        ref={tabsRef}
        className="hidden md:flex flex-1 items-end min-w-0 z-10 relative"
        style={{ height: BAR_H, gap: M, paddingLeft: splitViewActive ? 0 : 20, paddingRight: splitViewActive ? 0 : 8 }}
      >
        {!hasHydrated && !splitViewActive && (
          <div className="flex gap-[6px] items-end h-full">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-[5px] h-[calc(100%-6px)] px-3 rounded-t-[8px]" style={{ backgroundColor: 'var(--bone-5)' }}>
                <Skeleton className="w-3.5 h-3.5 rounded-sm bg-[var(--bone-10)]" />
                <Skeleton className="w-20 h-3 rounded-sm bg-[var(--bone-10)]" />
              </div>
            ))}
          </div>
        )}

        {hasHydrated && !splitViewActive && openTabIds.map((tabId, idx) => {
          const isActive = activeTabId === tabId;
          const activeIdx = openTabIds.indexOf(activeTabId || '');
          const isLeftAdjacent = idx === activeIdx - 1;
          const isRightAdjacent = idx === activeIdx + 1;
          const isDragged = drag?.id === tabId;
          const isReleased = release?.id === tabId;
          const { title, Icon } = getTabMeta(tabId);
          const path = getPath(tabId);
          if (!title && tabId !== 'dashboard' && tabId !== 'chat' && tabId !== 'tracker') return null;

          // Per-tab motion — all transform-based (no flex reflow during drag), so all of it
          // can be transitioned. Static tabs slide aside via pushShift; the dragged tab
          // tracks the pointer with no transition (instant glue); the released tab settles
          // into its slot through a one-shot FLIP.
          let transform: string | undefined = undefined;
          let transition = 'none';
          let zIndex = isActive ? 20 : 10;
          if (isReleased) {
            transform  = `translateX(${release!.dx}px)`;
            transition = releasePlay ? 'transform 160ms cubic-bezier(0.2, 0, 0, 1)' : 'none';
            zIndex     = 40;
          } else if (isDragged) {
            transform  = `translateX(${dragOffsetX}px)`;
            transition = 'none'; // pointer follows instantly
            zIndex     = 40;     // stays on top of the tabs it pushes aside
          } else if (drag) {
            const s = pushShift(idx, drag.origIndex, drag.targetIndex, drag.width);
            transform  = s ? `translateX(${s}px)` : undefined;
            transition = 'transform 160ms cubic-bezier(0.2, 0, 0, 1)'; // pushed tabs slide
          }

          return (
            <Tooltip key={tabId} content={stripHtml(title || '')} position="bottom">
              <div
                data-tab-id={tabId}
                onMouseDown={e => onTabMouseDown(e, tabId)}
                className="relative flex-shrink min-w-0 max-w-[250px] [-webkit-app-region:no-drag] cursor-pointer select-none group"
                style={{
                  height:     BAR_H,
                  zIndex,
                  transform,
                  transition
                }}
              >
              {/* ——— Visual tab background (swaps per state; content layer never moves) ——— */}
              {isActive ? (
                <div
                  className={`absolute inset-x-0 top-[6px] ${isDesktopEnv ? 'bottom-[-1px]' : 'bottom-0'}`}
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
              ) : (
                <>
                  <div
                    className="absolute inset-x-0 top-[6px] bottom-[6px] group-hover:bg-[var(--bone-6)] group-hover:backdrop-blur-sm"
                    style={{ borderRadius: R_INACTIVE }}
                  />
                  {!isDesktopEnv && (
                    <div 
                      className="absolute bottom-0 inset-x-0 h-[1px] pointer-events-none"
                      style={{
                        backgroundColor: 'color-mix(in srgb, var(--bone-100) 10%, var(--app-background))',
                        maskImage: isLeftAdjacent ? `linear-gradient(to right, black calc(100% - ${R_ACTIVE - 1}px), transparent calc(100% - ${R_ACTIVE - 1}px))` : 
                                   isRightAdjacent ? `linear-gradient(to right, transparent ${R_ACTIVE - 1}px, black ${R_ACTIVE - 1}px)` : 'none',
                        WebkitMaskImage: isLeftAdjacent ? `linear-gradient(to right, black calc(100% - ${R_ACTIVE - 1}px), transparent calc(100% - ${R_ACTIVE - 1}px))` : 
                                         isRightAdjacent ? `linear-gradient(to right, transparent ${R_ACTIVE - 1}px, black ${R_ACTIVE - 1}px)` : 'none'
                      }}
                    />
                  )}
                </>
              )}

              {/* ——— Content container (Vertically centered inside BAR_H across all tabs) ——— */}
              <div
                className="relative z-10 w-full h-full flex items-center gap-[5px]"
                style={{
                  paddingLeft: 12,
                  paddingRight: openTabIds.length > 1 ? 28 : 14
                }}
              >
                {Icon && (
                  <Icon strokeWidth={2} style={{ width: 14, height: 14, flexShrink: 0 }}
                    className={cn("text-[var(--bone-100)]", isActive ? "opacity-90" : "opacity-50")}
                  />
                )}

                <span
                  className={cn(
                    "flex-1 min-w-0 font-medium",
                    isActive ? "text-[var(--bone-100)]" : "text-[var(--bone-60)]"
                  )}
                  style={{
                    fontSize: 13, lineHeight: 1, overflow: 'hidden', whiteSpace: 'nowrap',
                  }}
                  ref={(el) => {
                    if (!el) return;
                    if (el.scrollWidth > el.clientWidth) {
                      el.style.maskImage = 'linear-gradient(to right, black calc(100% - 16px), transparent 100%)';
                      el.style.webkitMaskImage = 'linear-gradient(to right, black calc(100% - 16px), transparent 100%)';
                    } else {
                      el.style.maskImage = '';
                      el.style.webkitMaskImage = '';
                    }
                  }}
                >
                  {stripHtml(title || '')}
                </span>

                {openTabIds.length > 1 && (
                  <button
                    data-close="true"
                    onMouseDown={e => e.stopPropagation()}
                    onClick={e => { e.stopPropagation(); removeTab(tabId); }}
                    className={cn(
                      "absolute right-1.5 top-1/2 -translate-y-1/2 hover:bg-[var(--bone-12)] rounded-[3px] flex items-center justify-center shrink-0",
                      isActive
                        ? "opacity-50 hover:opacity-100"
                        : "opacity-0 group-hover:opacity-60 hover:!opacity-100"
                    )}
                    style={{ width: 18, height: 18 }}
                  >
                    <X strokeWidth={2.5} className="w-3 h-3"/>
                  </button>
                )}
              </div>
            </div>
          </Tooltip>
          );
        })}

        {/* + New Tab (matches inactive hover container height for uniform spacing) */}
        {!splitViewActive && (
          <div
            className="flex items-center justify-center shrink-0 ml-[3px]"
            style={{ height: BAR_H }}
          >
            <button
              onClick={e => { e.stopPropagation(); if (newItemPopup) { setNewItemPopup(null); return; } const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setNewItemPopup({ x: r.right + 4, y: r.top }); }}
              className={cn(
                `flex items-center justify-center rounded-[var(--radius-medium)] text-[var(--bone-100)] transition-opacity shrink-0 [-webkit-app-region:no-drag] ${isDesktopEnv ? 'w-8 h-8' : 'w-7 h-7'}`,
                newItemPopup ? "opacity-100 bg-[var(--bone-6)]" : "opacity-70 hover:opacity-100 hover:bg-[var(--bone-6)]"
              )}
            >
              <Plus strokeWidth={2} className="w-4 h-4"/>
            </button>
          </div>
        )}

        {splitViewActive && (
          <div className="flex flex-1 h-full relative" style={{ gap: '8px' }}>
            {/* Mirrors SplitViewLayout: content area = 100vw - px-2(16) - sidebar - gap(8) - [right panel + gap(8)]; left column = pos% - 4px */}
            <div className="flex items-end h-full min-w-0" style={{ width: `calc( (100vw - ${(leftWidth || 0) + 24 + (rightWidth ? rightWidth + 8 : 0)}px) * ${splitViewPosition / 100} - 4px )`, paddingLeft: (splitViewLeftId && ['dashboard', 'tracker', 'chat'].includes(splitViewLeftId)) ? 20 : 10 }}>
               <div className="flex items-end h-full min-w-0 gap-[6px]">
                 <div className="h-full flex items-center mr-[3px]">
                   <EntityHeaderControls entityId={splitViewLeftId} />
                 </div>
                 {splitViewLeftId && <StaticTabPill tabId={splitViewLeftId} isDesktopEnv={isDesktopEnv} R_INACTIVE={R_INACTIVE} R_ACTIVE={R_ACTIVE} BAR_H={BAR_H} />}
                 <div className="flex items-center h-full shrink-0 [-webkit-app-region:no-drag] ml-[3px]">
                   <Tooltip content="New Entity">
                     <button
                       onClick={(e) => {
                         e.stopPropagation();
                         const rect = e.currentTarget.getBoundingClientRect();
                         setNewItemPopup({ x: rect.left, y: rect.bottom + 6 });
                       }}
                       className={cn(
                         `flex items-center justify-center rounded-[var(--radius-medium)] text-[var(--bone-100)] opacity-70 hover:opacity-100 hover:bg-[var(--bone-6)] cursor-pointer transition-opacity ${isDesktopEnv ? 'w-8 h-8' : 'w-7 h-7'}`
                       )}
                     >
                       <Plus className="w-4 h-4" />
                     </button>
                   </Tooltip>
                 </div>
               </div>
            </div>
            <div className="flex items-end h-full justify-between min-w-0 flex-1 group/split-header" style={{ paddingLeft: (splitViewRightId && ['dashboard', 'tracker', 'chat'].includes(splitViewRightId)) ? 20 : 10 }}>
               <div className="flex items-end h-full min-w-0 gap-[6px]">
                 <div className="h-full flex items-center mr-[3px]">
                   <EntityHeaderControls entityId={splitViewRightId} />
                 </div>
                 {splitViewRightId && <StaticTabPill tabId={splitViewRightId} isDesktopEnv={isDesktopEnv} R_INACTIVE={R_INACTIVE} R_ACTIVE={R_ACTIVE} BAR_H={BAR_H} />}
                 <div className="flex items-center h-full shrink-0 [-webkit-app-region:no-drag] ml-[3px]">
                   <Tooltip content="New Entity">
                     <button
                       onClick={(e) => {
                         e.stopPropagation();
                         const rect = e.currentTarget.getBoundingClientRect();
                         setNewItemPopup({ x: rect.left, y: rect.bottom + 6 });
                       }}
                       className={cn(
                         `flex items-center justify-center rounded-[var(--radius-medium)] text-[var(--bone-100)] opacity-70 hover:opacity-100 hover:bg-[var(--bone-6)] cursor-pointer transition-opacity ${isDesktopEnv ? 'w-8 h-8' : 'w-7 h-7'}`
                       )}
                     >
                       <Plus className="w-4 h-4" />
                     </button>
                   </Tooltip>
                 </div>
               </div>
            </div>
          </div>
        )}
      </div>

      {/* Split View Toggle and Controls */}
      {splitViewActive ? (
        <div className={cn("flex items-center gap-1 shrink-0 z-10 [-webkit-app-region:no-drag] pr-0 group/splitctrls", isDesktopEnv ? `absolute top-0 ${isMac ? 'right-[20px]' : 'right-[140px]'}` : "")} style={{ height: BAR_H }}>
          <div className="flex items-center opacity-0 group-hover/splitctrls:opacity-100 transition-opacity">
            <Tooltip content="Reset ratio">
              <button onClick={() => setSplitViewPosition(50)} className={`flex items-center justify-center text-[var(--bone-100)] rounded-[var(--radius-medium)] shrink-0 opacity-70 hover:opacity-100 hover:bg-[var(--bone-6)] transition-opacity ${isDesktopEnv ? 'w-8 h-8' : 'w-7 h-7'}`}>
                 <RotateCcw strokeWidth={2} className="w-4 h-4" />
              </button>
            </Tooltip>
          </div>
          {splitViewLeftId && splitViewRightId && (
            <Tooltip content={splitViewPinned ? "Unpin pair" : "Pin pair"}>
              <button onClick={togglePin} className={cn(`flex items-center justify-center text-[var(--bone-100)] rounded-[var(--radius-medium)] shrink-0 transition-opacity ${isDesktopEnv ? 'w-8 h-8' : 'w-7 h-7'}`, splitViewPinned ? "bg-[var(--bone-10)] opacity-100 hover:bg-[var(--bone-12)]" : "opacity-70 hover:opacity-100 hover:bg-[var(--bone-6)]")}>
                 <Pin strokeWidth={2} className="w-4 h-4" fill={splitViewPinned ? "currentColor" : "none"} />
              </button>
            </Tooltip>
          )}
          <Tooltip content="Swap columns">
            <button onClick={swapColumns} className={`flex items-center justify-center text-[var(--bone-100)] rounded-[var(--radius-medium)] shrink-0 opacity-70 hover:opacity-100 hover:bg-[var(--bone-6)] transition-opacity ${isDesktopEnv ? 'w-8 h-8' : 'w-7 h-7'}`}>
               <ArrowLeftRight strokeWidth={2} className="w-4 h-4" />
            </button>
          </Tooltip>
          <Tooltip content="Exit split view">
            <button onClick={toggleSplitView} className={`flex items-center justify-center text-[var(--bone-100)] rounded-[var(--radius-medium)] shrink-0 bg-[var(--bone-10)] opacity-100 hover:bg-[var(--bone-12)] transition-opacity ${isDesktopEnv ? 'w-8 h-8' : 'w-7 h-7'}`}>
               <Columns2 strokeWidth={2} className="w-4 h-4" />
            </button>
          </Tooltip>
        </div>
      ) : activeTabId !== 'chat' ? (
        <div
          className={cn("flex items-center justify-center gap-1 shrink-0 pr-0 z-10 [-webkit-app-region:no-drag]", isDesktopEnv ? `absolute top-0 ${isMac ? 'right-[20px]' : 'right-[140px]'}` : "")}
          style={{ height: BAR_H }}
        >
          <Tooltip content="Split view">
            <button
              onClick={e => { e.stopPropagation(); toggleSplitView(); }}
              className={cn(
                `flex items-center justify-center text-[var(--bone-100)] rounded-[var(--radius-medium)] shrink-0 transition-opacity ${isDesktopEnv ? 'w-8 h-8' : 'w-7 h-7'}`,
                "opacity-70 hover:opacity-100 hover:bg-[var(--bone-6)]"
              )}
            >
              <Columns2 strokeWidth={2} className="w-4 h-4"/>
            </button>
          </Tooltip>
        </div>
      ) : null}

      {/* Right Window Controls Reserve */}
      {isDesktopEnv && (
        <div className="flex shrink-0 items-center justify-end" style={{ width: isMac ? (rightWidth || 0) : Math.max(rightWidth || 0, 140) }}>
        </div>
      )}

      {/* New-item popup (mimics sidebar "New Page" dropdown) */}
      {newItemPopup && (
        <Portal>
          <div className="fixed inset-0 z-[9998]" onClick={() => setNewItemPopup(null)} />
          <div
            className="fixed z-[9999] popup-glass-small min-w-[160px] p-1 flex flex-col gap-[2px] [-webkit-app-region:no-drag]"
            style={{ left: newItemPopup.x, top: newItemPopup.y }}
          >
            {([
              { type: 'note' as const, label: 'Note', icon: File },
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
                  setActiveEntityId(newId);
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
});
