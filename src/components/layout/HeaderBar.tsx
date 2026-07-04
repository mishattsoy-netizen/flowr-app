"use client";

import { useStore, generateId } from '@/data/store';
import { getEntityIcon } from '@/data/icons';
import {
  ArrowLeft, ArrowRight, RotateCw, LayoutDashboard, MessageSquare,
  ListTodo, Menu, X, ChevronRight, ChevronLeft, Plus, PanelLeft, Columns2,
  FileText, Frame, Search
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip } from './Tooltip';
import { Portal } from './Portal';
import { stripHtml } from '@/lib/utils';
import { isDesktop } from '@/lib/env';
import React, { memo, useState, useRef, useLayoutEffect } from 'react';

// ─── Concave corner SVG ──────────────────────────────────────────────────────
function ConcaveCorner({ side, r = 8 }: { side: 'left' | 'right'; r?: number }) {
  const w = r + 1, h = r + 1;
  const fill   = side === 'left'
    ? `M${w},0 Q${w},${h} 0,${h} L${w},${h} Z`
    : `M0,0 Q0,${h} ${w},${h} L0,${h} Z`;
  const stroke = side === 'left'
    ? `M${w},0 Q${w},${h} 0,${h}`
    : `M0,0 Q0,${h} ${w},${h}`;
  return (
    <svg
      width={w} height={h} viewBox={`0 0 ${w} ${h}`}
      style={{
        position: 'absolute', bottom: 0,
        [side === 'left' ? 'left' : 'right']: -w,
        pointerEvents: 'none', zIndex: 11,
      }}
    >
      <path d={fill}   fill="var(--app-background)" />
      <path d={stroke} stroke="var(--bone-10)" strokeWidth="1" fill="none" />
    </svg>
  );
}

const POPUP_LEAVE_DELAY = 100;

export const HeaderBar = memo(function HeaderBar() {
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
  const chatConversations    = useStore(s => s.chatConversations);
  const activeChatId         = useStore(s => s.activeChatId);
  const isSidebarCollapsed   = useStore(s => s.isSidebarCollapsed);
  const toggleSplitView      = useStore(s => s.toggleSplitView);

  const isDesktopEnv = isDesktop();

  // ─── Sizing ─────────────────────────────────────────────────────────────
  const BAR_H     = isDesktopEnv ? 38 : 42; // fixed header height
  const M         = 6;                    // uniform tab spacing: hover container top/bottom margins + strip gap (px)
  const R_ACTIVE   = 12;                  // concave bridge under selected tab
  const R_INACTIVE = 8;                    // selected top corners + unselected hover container

  // ─── Hover popup ──────────────────────────────────────────────────────────
  const [hoveredTab, setHoveredTab] = useState<{ id: string; rect: DOMRect; path: any[] } | null>(null);
  const leaveTimer = useRef<NodeJS.Timeout | null>(null);
  const [newItemPopup, setNewItemPopup] = useState<{ x: number; y: number } | null>(null);
  const onTabHover = (e: React.MouseEvent, id: string, path: any[]) => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    setHoveredTab({ id, rect: (e.currentTarget as HTMLElement).getBoundingClientRect(), path });
  };
  const onTabLeave = () => { leaveTimer.current = setTimeout(() => setHoveredTab(null), POPUP_LEAVE_DELAY); };

  // ─── Drag-to-reorder (push-aside model) ───────────────────────────────────
  // The array order is FIXED during drag. The dragged tab is translated to follow
  // the pointer (instant). Static tabs between the dragged slot and the *target*
  // slot are translated aside by exactly the dragged tab's footprint (width + gap)
  // and that translate runs through a CSS transition → they slide, never teleport.
  // Nothing reorders mid-drag, so there is no commit-time reflow → no bounce.
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
    id: string; origIndex: number; targetIndex: number;
    width: number; grabOffset: number; containerLeft: number;
    naturalLefts: number[]; screenCenters: number[];
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
      const offset = pointerX - di.containerLeft - di.naturalLefts[origIndex] - di.grabOffset;
      latestOffsetRef.current = offset;
      setDragOffsetX(offset);

      // target slot from STABLE screen-level centers (measured once at mousedown),
      // so detection never lags behind a mid-drag reflow or a transition.
      const centers = di.screenCenters;
      const dc = centers[origIndex];
      let t = origIndex;
      if (pointerX > dc) {
        while (t + 1 < centers.length && pointerX > centers[t + 1]) t++;
      } else if (pointerX < dc) {
        while (t - 1 >= 0 && pointerX < centers[t - 1]) t--;
      }
      if (t !== di.targetIndex) {
        di.targetIndex = t;
        setDrag(d => (d ? { ...d, targetIndex: t } : d));
      }
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);

      const di = dragInfoRef.current;
      dragInfoRef.current = null;

      if (!hasMoved.current) {
        setActiveTab(tabId);
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
        setReleaseTick(x => x + 1); // no reorder — just settle the dragged tab back
      }
      setDrag(null);
      setDragOffsetX(0);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  // Release-FLIP: settle the released tab from its pointer position into its slot.
  // Runs synchronously before paint, so the first painted frame already shows it
  // at the pointer and it animates to 0 — never snaps forward, never snaps back.
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
        // PLAY: turn the transition on and animate dx → 0 into the slot.
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

  // ─── Helpers ───────────────────────────────────────────────────────────────
  const isDashboard = activeEntityId === 'dashboard' || !activeEntityId;

  const getPath = (id: string | null): any[] => {
    if (!id || id === 'dashboard') return [];
    if (id === 'chat')    return [{ id: 'chat',    title: 'Chat',  icon: 'MessageSquare' }];
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
    if      (tabId === 'dashboard') { title = 'Dashboard'; Icon = LayoutDashboard; }
    else if (tabId === 'chat')      { const ac = chatConversations.find(c => c.id === activeChatId); title = isTempChat ? 'Temporary Chat' : (ac?.title || 'Chat'); Icon = MessageSquare; }
    else if (tabId === 'tracker')   { title = 'Tasks'; Icon = ListTodo; }
    else if (entity)                { Icon = entity.icon ? getEntityIcon(entity.icon) : entity.type === 'canvas' ? Frame : FileText; }
    return { title, Icon };
  };

  const btnCls = (ok: boolean) =>
    `flex items-center justify-center rounded-[var(--radius-small)] [-webkit-app-region:no-drag] ${isDesktopEnv ? 'w-7 h-7' : 'w-6 h-6'} ${ok ? 'text-[var(--bone-100)] opacity-70 hover:opacity-100 hover:bg-[var(--bone-6)] cursor-pointer' : 'text-border opacity-30 cursor-default'}`;

  if (!isTabsHeaderVisible) return null;

  return (
    <div
      className={cn(
        "w-full flex items-center pl-3 shrink-0 relative z-30 [-webkit-app-region:drag] bg-sidebar",
        isDesktopEnv ? "pr-32" : "pr-3" // web: no window-control reserve; desktop: keep it
      )}
      style={{ height: BAR_H }}
    >
      {/* ── Visual bottom border line ── */}
      <div className="absolute inset-x-0 bottom-0 h-[1px] bg-[var(--bone-10)] z-0" />

      {/* Web: collapsed sidebar buttons */}
      {!isDesktopEnv && isSidebarCollapsed && (
        <div className="flex items-center gap-1 shrink-0 mr-2 z-10">
          <button onClick={toggleSidebar}        className={btnCls(true)}><PanelLeft  strokeWidth={2} className="w-4 h-4"/></button>
          <button onClick={toggleCommandPalette} className={btnCls(true)}><Search     strokeWidth={2} className="w-4 h-4"/></button>
          <div className="w-px h-4 bg-[var(--bone-6)] mx-1"/>
        </div>
      )}

      {/* Desktop nav */}
      {isDesktopEnv && (
        <div className="flex items-center gap-1 shrink-0 z-10">
          <button onClick={toggleSidebar} className="md:hidden p-1 rounded-[var(--radius-small)] hover:bg-hover text-[var(--bone-100)] opacity-70 hover:opacity-100 [-webkit-app-region:no-drag]">
            {isDashboard ? <Menu strokeWidth={2} className="w-4 h-4"/> : <ChevronLeft strokeWidth={2} className="w-4 h-4"/>}
          </button>
          <Tooltip content="Go Back">   <button onClick={goBack}               className={btnCls(true)}><ArrowLeft  strokeWidth={2} className="w-4 h-4"/></button></Tooltip>
          <Tooltip content="Go Forward"><button onClick={goForward}             className={btnCls(true)}><ArrowRight strokeWidth={2} className="w-4 h-4"/></button></Tooltip>
          <Tooltip content="Reload">    <button onClick={() => {}}              className={btnCls(true)}><RotateCw   strokeWidth={2} className="w-4 h-4"/></button></Tooltip>
          <Tooltip content="Toggle Sidebar">
            <button onClick={toggleSidebar} onContextMenu={e => { e.preventDefault(); openContextMenu('sidebar-toggle', e.clientX, e.clientY, 'sidebar-toggle'); }} className={btnCls(true)}>
              <PanelLeft strokeWidth={2} className="w-4 h-4"/>
            </button>
          </Tooltip>
          <Tooltip content="Search"><button onClick={toggleCommandPalette} className={btnCls(true)}><Search strokeWidth={2} className="w-4 h-4"/></button></Tooltip>
          <div className="w-px h-4 bg-[var(--bone-6)] mx-2"/>
        </div>
      )}

      {/* Mobile title */}
      <div className="flex md:hidden flex-1 items-center px-1 min-w-0 font-semibold text-sm text-[var(--bone-100)] truncate z-10">
        {isDashboard ? 'Home' : activeEntityId === 'tracker' ? 'Tasks' : activeEntityId === 'chat' ? 'Chat' :
          stripHtml(entities.find(e => e.id === activeEntityId)?.title || '')}
      </div>

      {/* ─── Tab strip ───────────────────────────────────────────────────────
          items-end: tab layout boxes sit at the bottom edge
      ─────────────────────────────────────────────────────────────────────── */}
      <div
        ref={tabsRef}
        className="hidden md:flex flex-1 items-end min-w-0 z-10"
        style={{ height: BAR_H, gap: M, paddingLeft: 4, paddingRight: 4 }}
      >
        {openTabIds.map((tabId, idx) => {
          const isActive = activeTabId === tabId;
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
            <div
                key={tabId}
                data-tab-id={tabId}
                onMouseEnter={e => onTabHover(e, tabId, path)}
                onMouseLeave={onTabLeave}
                onMouseDown={e => onTabMouseDown(e, tabId)}
                className="relative flex-shrink min-w-0 max-w-[250px] [-webkit-app-region:no-drag] cursor-pointer select-none group"
              style={{
                height:     BAR_H, // fixed height → icon/title always vertically centered, never reposition on switch
                zIndex,
                transform,
                transition,
              }}
            >
              {/* ─── Visual tab background (swaps per state; content layer never moves) ─── */}
              <div
                className={cn(
                  "absolute inset-x-0",
                  isActive
                    ? "top-[6px] bottom-0 bg-[var(--app-background)] border-t border-l border-r border-[var(--bone-10)]"
                    : cn(
                        "top-[6px] bottom-[6px]",
                        "group-hover:bg-[var(--bone-6)] group-hover:backdrop-blur-sm",
                        // during any drag, all unselected tabs get a glassy hint
                        drag && !isDragged && "bg-[var(--bone-6)] backdrop-blur-sm"
                      )
                )}
                style={{ borderRadius: isActive ? `${R_INACTIVE}px ${R_INACTIVE}px 0 0` : R_INACTIVE }}
              >
                {/* Concave corners bridge the active tab into the main area below */}
                {isActive && <ConcaveCorner side="left"  r={R_ACTIVE} />}
                {isActive && <ConcaveCorner side="right" r={R_ACTIVE} />}
              </div>

              {/* ─── Content container (Vertically centered inside BAR_H across all tabs) ─── */}
              <div
                className="relative z-10 w-full h-full flex items-center gap-[5px]"
                style={{
                  paddingLeft: 12,
                  paddingRight: openTabIds.length > 1 ? M : 12
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
                      el.style.maskImage = 'linear-gradient(to right, black calc(100% - 28px), transparent 100%)';
                      el.style.webkitMaskImage = 'linear-gradient(to right, black calc(100% - 28px), transparent 100%)';
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
                    "hover:bg-[var(--bone-12)] rounded-[3px] flex items-center justify-center shrink-0",
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
          );
        })}

        {/* + New Tab (matches inactive hover container height for uniform spacing) */}
        <div
          className="flex items-center justify-center shrink-0"
          style={{ height: BAR_H }}
        >
          <button
            onClick={e => { e.stopPropagation(); if (newItemPopup) { setNewItemPopup(null); return; } const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setNewItemPopup({ x: r.right + 4, y: r.top }); }}
            className={cn(
                    "flex items-center justify-center text-[var(--bone-100)] rounded-[8px] shrink-0 [-webkit-app-region:no-drag]",
                    newItemPopup ? "opacity-100 bg-[var(--bone-6)]" : "opacity-50 hover:opacity-100 hover:bg-[var(--bone-6)]"
                  )}
            style={{ width: 22, height: BAR_H - 2 * M }}
          >
            <Plus strokeWidth={2} className="w-3.5 h-3.5"/>
          </button>
        </div>
      </div>

      {/* Split View Toggle — fixed at the right edge of the header */}
      {openTabIds.length > 0 && (() => {
        const entity = entities.find(e => e.id === activeEntityId);
        return entity && (entity.type === 'note' || entity.type === 'canvas');
      })() && (
        <div
          className="flex items-center justify-center shrink-0"
          style={{ height: BAR_H }}
        >
          <button
            onClick={e => { e.stopPropagation(); toggleSplitView(); }}
            className="flex items-center justify-center text-[var(--bone-100)] rounded-[10px] shrink-0 [-webkit-app-region:no-drag] hover:bg-[var(--bone-6)]"
            style={{ width: 28, height: 28 }}
            title="Split view"
          >
            <Columns2 strokeWidth={2} className="w-4 h-4"/>
          </button>
        </div>
      )}

      {/* New-item popup (mimics sidebar "New Page" dropdown) */}
      {newItemPopup && (
        <Portal>
          <div className="fixed inset-0 z-[9998]" onClick={() => setNewItemPopup(null)} />
          <div
            className="fixed z-[9999] popup-glass-small min-w-[160px] p-1 flex flex-col gap-[2px]"
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

      {/* Path popup */}
      {hoveredTab && hoveredTab.path.length > 0 && (
        <Portal>
          <div
            onMouseEnter={() => { if (leaveTimer.current) clearTimeout(leaveTimer.current); }}
            onMouseLeave={() => setHoveredTab(null)}
            className="fixed z-[9999] pt-1"
            style={{ top: hoveredTab.rect.bottom, left: Math.max(8, hoveredTab.rect.left) }}
          >
            <div className="popup-glass-small backdrop-blur-xl p-1 min-w-[180px] flex flex-col gap-[2px]">
              {hoveredTab.path.length > 1 && hoveredTab.path.slice(0, -1).map(p => (
                <button key={p.id} onClick={() => { setActiveEntityId(p.id); setHoveredTab(null); }} className="popup-item">
                  {p.icon && (() => { const I = getEntityIcon(p.icon); return <I strokeWidth={2} className="w-4 h-4 shrink-0"/>; })()}
                  <span className="text-fade flex-1 text-left">{stripHtml(p.title || '')}</span>
                  <ChevronRight strokeWidth={2} className="w-3.5 h-3.5 ml-auto opacity-30"/>
                </button>
              ))}
              {hoveredTab.path.length > 1 && <div className="popup-divider"/>}
              <div className="flex items-center gap-3 px-3 py-[4px] text-[13.5px] font-semibold text-[var(--bone-100)]">
                {(() => {
                  const last = hoveredTab.path[hoveredTab.path.length - 1];
                  let I: any = FileText;
                  if (last.id === 'tracker') I = ListTodo;
                  else if (last.id === 'chat') I = MessageSquare;
                  else if (last.icon) I = getEntityIcon(last.icon);
                  else { const ent = entities.find(e => e.id === last.id); if (ent?.type === 'canvas') I = Frame; }
                  return <I strokeWidth={2} className="w-4 h-4 shrink-0"/>;
                })()}
                <span className="text-fade flex-1 text-left">{stripHtml(hoveredTab.path[hoveredTab.path.length - 1].title || '')}</span>
                {hoveredTab.path.length <= 1 && (
                  <span className="ml-auto text-[10px] font-normal opacity-40 uppercase tracking-widest">
                    {hoveredTab.id === 'dashboard' ? 'Dashboard' : 'Page'}
                  </span>
                )}
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
});
