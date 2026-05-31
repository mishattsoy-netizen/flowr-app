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
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragState = useRef<{ startY: number; startScroll: number } | null>(null);

  const setRef = useCallback((node: HTMLDivElement | null) => {
    elRef.current = node;
    scrollRef?.(node);
  }, [scrollRef]);

  // Recompute thumb geometry from the scroll element's metrics.
  const sync = useCallback(() => {
    const el = elRef.current;
    if (!el) return;
    const { scrollHeight, clientHeight, scrollTop } = el;
    if (scrollHeight <= clientHeight) {
      setThumb(null); // nothing to scroll → no thumb
      el.style.setProperty('--scroll-top-offset', '0px');
      el.style.setProperty('--scroll-bottom-offset', '0px');
      return;
    }
    const trackH = clientHeight;
    const minThumb = 24;
    const height = Math.max(minThumb, (clientHeight / scrollHeight) * trackH);
    const maxTop = trackH - height;
    const top = maxTop * (scrollTop / (scrollHeight - clientHeight));
    setThumb({ height, top });
    // Edge fade mask: grow the top fade as content scrolls under the top edge,
    // shrink the bottom fade as the end is reached (matches the sidebar).
    el.style.setProperty('--scroll-top-offset', `${Math.min(scrollTop, 20)}px`);
    el.style.setProperty('--scroll-bottom-offset', `${Math.min(scrollHeight - clientHeight - scrollTop, 20)}px`);
  }, []);

  const reveal = useCallback(() => {
    setVisible(true);
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setVisible(false), 1000);
  }, []);

  const handleScroll = useCallback(() => {
    sync();
    reveal();
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
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const onScrollProp = scrollProps?.onScroll as ((e: React.UIEvent<HTMLDivElement>) => void) | undefined;

  return (
    <div
      className={cn('relative min-h-0', className)}
      onMouseEnter={() => { setHovering(true); reveal(); }}
      onMouseLeave={() => setHovering(false)}
    >
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
          onPointerDown={onThumbPointerDown}
          onPointerMove={onThumbPointerMove}
          onPointerUp={onThumbPointerUp}
          className={cn(
            'absolute w-[5px] rounded-full bg-[var(--bone-15)] hover:bg-[var(--bone-30)]',
            'transition-opacity duration-300 ease-out cursor-default',
            (visible || hovering) ? 'opacity-100' : 'opacity-0'
          )}
          style={{ height: thumb.height, top: thumb.top, right: -4 }}
        />
      )}
    </div>
  );
}
