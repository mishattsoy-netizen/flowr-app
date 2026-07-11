"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { isDesktop } from '@/lib/env';

/**
 * A scroll container with a custom OVERLAY scrollbar rendered as a real DOM
 * element — so it can opacity-fade in/out and auto-hide reliably (which native
 * `::-webkit-scrollbar` pseudo-elements cannot, especially in Safari).
 *
 * The thumb sits just inside the right edge with a small gap, is invisible by
 * default, fades in while scrolling or when the container is hovered, and fades
 * out 2s after scrolling stops. The native scrollbar is hidden; the inner
 * element is the real scroller and receives `scrollProps` (e.g. data attrs the
 * drag system needs) and `scrollRef`.
 */
export function OverlayScrollbar({
  children,
  className,
  scrollClassName,
  scrollRef,
  scrollProps,
  thumbOffsetRight,
  thumbRightClass,
}: {
  children: React.ReactNode;
  className?: string;
  scrollClassName?: string;
  scrollRef?: (node: HTMLDivElement | null) => void;
  scrollProps?: React.HTMLAttributes<HTMLDivElement> & Record<string, unknown>;
  thumbOffsetRight?: number;
  thumbRightClass?: string;
}) {
  const isDesktopEnv = isDesktop();
  const elRef = useRef<HTMLDivElement | null>(null);
  const thumbRef = useRef<HTMLDivElement | null>(null);
  const [hasThumb, setHasThumb] = useState(false);
  const [debugData, setDebugData] = useState({ clientX: 0, right: 0, isHovered: false });
  const [visible, setVisible] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const hoverTimer = useRef<NodeJS.Timeout | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragState = useRef<{ startY: number; startScroll: number } | null>(null);
  // Coalesce scroll work to one measurement per animation frame: scroll events
  // can fire several times per frame, and each sync() does layout reads + a
  // setState. rafPending guards against scheduling more than one per frame.
  const rafPending = useRef(false);
  // Same one-per-frame guard for ResizeObserver-driven syncs (content/viewport
  // size changes), which fire in bursts during a card drag's moving gap.
  const roPending = useRef(false);
  // Last applied edge-fade flags, so we only touch the DOM attribute when an
  // edge actually crosses its threshold (not on every scroll tick).
  const fadeState = useRef({ top: false, bottom: false });

  const setRef = useCallback((node: HTMLDivElement | null) => {
    elRef.current = node;
    scrollRef?.(node);
  }, [scrollRef]);

  // Toggle an edge-fade attribute only when it actually changes, so the static
  // mask switches at the threshold instead of being recomputed each scroll.
  const setFade = useCallback((el: HTMLElement, top: boolean, bottom: boolean) => {
    if (fadeState.current.top !== top) {
      el.dataset.fadeTop = String(top);
      fadeState.current.top = top;
    }
    if (fadeState.current.bottom !== bottom) {
      el.dataset.fadeBottom = String(bottom);
      fadeState.current.bottom = bottom;
    }
  }, []);

  // Recompute thumb geometry from the scroll element's metrics.
  const sync = useCallback(() => {
    const el = elRef.current;
    if (!el) return;
    const { scrollHeight, clientHeight, scrollTop } = el;
    if (scrollHeight <= clientHeight) {
      setHasThumb(prev => (prev ? false : prev)); // nothing to scroll → no thumb
      setFade(el, false, false);
      return;
    }
    const trackH = clientHeight;
    const minThumb = 24;
    const height = Math.max(minThumb, (clientHeight / scrollHeight) * trackH);
    const maxTop = trackH - height;
    const top = maxTop * (scrollTop / (scrollHeight - clientHeight));
    
    if (thumbRef.current) {
      thumbRef.current.style.height = `${height}px`;
      thumbRef.current.style.transform = `translateY(${top}px)`;
    }
    setHasThumb(prev => (!prev ? true : prev));
    
    // Fade the top edge once any content has scrolled under it, and the bottom
    // edge until the end is reached. A few px of slack avoids flicker right at
    // the extremes.
    setFade(el, scrollTop > 1, scrollHeight - clientHeight - scrollTop > 1);
  }, [setFade]);

  const reveal = useCallback(() => {
    setVisible(prev => (prev ? prev : true));
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setVisible(false), 500);
  }, []);

  // Scroll events can fire multiple times per frame; do the layout read +
  // setState at most once per animation frame.
  const handleScroll = useCallback(() => {
    reveal();
    if (rafPending.current) return;
    rafPending.current = true;
    requestAnimationFrame(() => {
      rafPending.current = false;
      sync();
    });
  }, [sync, reveal]);

  // Keep the thumb in sync when content size or viewport changes.
  // sync() reads layout (scrollHeight/clientHeight), so coalesce ResizeObserver
  // bursts to one read per frame. During a Kanban card drag the moving gap
  // changes this column's children every slot move; without coalescing that
  // fired a synchronous layout read (reflow) per move — re-introducing drag
  // stutter. One rAF-batched read per frame keeps the thumb correct without the
  // per-move reflow.
  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    // Frame-coalesced sync: the effect re-runs on every `children` change (the
    // moving gap during a card drag), and the observer fires in bursts. Batch
    // both to one layout read per frame instead of a synchronous read per move.
    const scheduleSync = () => {
      if (roPending.current) return;
      roPending.current = true;
      requestAnimationFrame(() => {
        roPending.current = false;
        sync();
      });
    };
    scheduleSync();
    const ro = new ResizeObserver(scheduleSync);
    ro.observe(el);
    for (const child of Array.from(el.children)) ro.observe(child);
    return () => ro.disconnect();
  }, [sync, children]);

  useEffect(() => () => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
  }, []);

  // Drag the thumb to scroll.
  const onThumbPointerDown = (e: React.PointerEvent) => {
    const el = elRef.current;
    if (!el) return;
    e.preventDefault();
    e.stopPropagation();
    dragState.current = { startY: e.clientY, startScroll: el.scrollTop };
    setIsDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onThumbPointerMove = (e: React.PointerEvent) => {
    const el = elRef.current;
    const thumbEl = thumbRef.current;
    const drag = dragState.current;
    if (!el || !thumbEl || !drag) return;
    const trackH = el.clientHeight;
    const maxTop = trackH - thumbEl.clientHeight;
    const deltaY = e.clientY - drag.startY;
    const scrollRange = el.scrollHeight - el.clientHeight;
    el.scrollTop = drag.startScroll + (deltaY / maxTop) * scrollRange;
    reveal();
  };
  const onThumbPointerUp = (e: React.PointerEvent) => {
    dragState.current = null;
    setIsDragging(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const onScrollProp = scrollProps?.onScroll as ((e: React.UIEvent<HTMLDivElement>) => void) | undefined;

  return (
    <div 
      className={cn('relative min-h-0 overflow-hidden', className)}
      onPointerMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const isNearEdge = e.clientX >= rect.right - 30;
        if (isNearEdge && !isHovered) {
          if (!hoverTimer.current) {
            hoverTimer.current = setTimeout(() => {
              setIsHovered(true);
            }, 150);
          }
        } else if (!isNearEdge) {
          if (hoverTimer.current) {
            clearTimeout(hoverTimer.current);
            hoverTimer.current = null;
          }
          if (isHovered) setIsHovered(false);
        }
      }}
      onPointerLeave={() => {
        if (hoverTimer.current) {
          clearTimeout(hoverTimer.current);
          hoverTimer.current = null;
        }
        setIsHovered(false);
      }}
    >
      <div
        {...scrollProps}
        ref={setRef}
        onScroll={(e) => { handleScroll(); onScrollProp?.(e); }}
        className={cn('h-full overflow-y-auto scrollbar-none scroll-fade', scrollClassName)}
      >
        {children}
      </div>
      {hasThumb && (
        <div
          ref={thumbRef}
          onPointerDown={onThumbPointerDown}
          onPointerMove={onThumbPointerMove}
          onPointerUp={onThumbPointerUp}
          className={cn(
            'absolute rounded-full z-10',
            'before:absolute before:-inset-x-3 before:inset-y-0 before:content-[""]',
            thumbRightClass ?? 'right-1.5',
            isDragging 
              ? 'cursor-grabbing bg-[var(--bone-30)] w-[5px]'
              : 'cursor-default w-[5px] bg-[var(--bone-15)] hover:bg-[var(--bone-30)]'
          )}
          style={{ 
            top: 0,
            opacity: (visible || isDragging || isHovered) ? 1 : 0,
            transitionProperty: 'opacity, background-color',
            transitionDuration: '100ms',
            transitionTimingFunction: 'ease-out'
          }}
        />
      )}
    </div>
  );
}
