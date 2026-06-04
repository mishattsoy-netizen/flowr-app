"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

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
}: {
  children: React.ReactNode;
  className?: string;
  scrollClassName?: string;
  scrollRef?: (node: HTMLDivElement | null) => void;
  scrollProps?: React.HTMLAttributes<HTMLDivElement> & Record<string, unknown>;
}) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const [thumb, setThumb] = useState<{ height: number; top: number } | null>(null);
  const [visible, setVisible] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragState = useRef<{ startY: number; startScroll: number } | null>(null);
  // Coalesce scroll work to one measurement per animation frame: scroll events
  // can fire several times per frame, and each sync() does layout reads + a
  // setState. rafPending guards against scheduling more than one per frame.
  const rafPending = useRef(false);
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
      setThumb(null); // nothing to scroll → no thumb
      setFade(el, false, false);
      return;
    }
    const trackH = clientHeight;
    const minThumb = 24;
    const height = Math.max(minThumb, (clientHeight / scrollHeight) * trackH);
    const maxTop = trackH - height;
    const top = maxTop * (scrollTop / (scrollHeight - clientHeight));
    setThumb(prev =>
      prev && prev.height === height && prev.top === top ? prev : { height, top }
    );
    // Fade the top edge once any content has scrolled under it, and the bottom
    // edge until the end is reached. A few px of slack avoids flicker right at
    // the extremes.
    setFade(el, scrollTop > 1, scrollHeight - clientHeight - scrollTop > 1);
  }, [setFade]);

  const reveal = useCallback(() => {
    setVisible(prev => (prev ? prev : true));
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setVisible(false), 1000);
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
  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    for (const child of Array.from(el.children)) ro.observe(child);
    return () => ro.disconnect();
  }, [sync, children]);

  useEffect(() => () => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
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
    const drag = dragState.current;
    if (!el || !drag || !thumb) return;
    const trackH = el.clientHeight;
    const maxTop = trackH - thumb.height;
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
    <div className={cn('relative min-h-0', className)}>
      <div
        {...scrollProps}
        ref={setRef}
        onScroll={(e) => { handleScroll(); onScrollProp?.(e); }}
        className={cn('h-full overflow-y-auto scrollbar-none scroll-fade', scrollClassName)}
      >
        {children}
      </div>
      {thumb && (
        <div
          className={cn("absolute top-0 bottom-0 w-[20px] bg-transparent z-10", isDragging ? "cursor-grabbing" : "cursor-default")}
          style={{ right: -15 }}
          onMouseEnter={() => { setHovering(true); reveal(); }}
          onMouseLeave={() => setHovering(false)}
        >
          <div
            onPointerDown={onThumbPointerDown}
            onPointerMove={onThumbPointerMove}
            onPointerUp={onThumbPointerUp}
            className={cn(
              'absolute w-[5px] rounded-full bg-[var(--bone-15)] hover:bg-[var(--bone-30)]',
              'transition-opacity duration-300 ease-out',
              isDragging ? 'cursor-grabbing' : 'cursor-pointer',
              (visible || hovering || isDragging) ? 'opacity-100' : 'opacity-0'
            )}
            style={{ height: thumb.height, top: thumb.top, right: 6 }}
          />
        </div>
      )}
    </div>
  );
}
