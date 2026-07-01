"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * A horizontal scroll container with a custom OVERLAY scrollbar.
 * Provides left/right horizontal edge fade effects and auto-hides the scrollbar.
 */
export function HorizontalOverlayScrollbar({
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
  const [thumb, setThumb] = useState<{ width: number; left: number } | null>(null);
  const [visible, setVisible] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragState = useRef<{ startX: number; startScroll: number } | null>(null);
  const rafPending = useRef(false);
  const roPending = useRef(false);
  const fadeState = useRef({ left: false, right: false });

  const setRef = useCallback((node: HTMLDivElement | null) => {
    elRef.current = node;
    scrollRef?.(node);
  }, [scrollRef]);

  const setFade = useCallback((el: HTMLElement, left: boolean, right: boolean) => {
    if (fadeState.current.left !== left) {
      el.dataset.fadeLeft = String(left);
      fadeState.current.left = left;
    }
    if (fadeState.current.right !== right) {
      el.dataset.fadeRight = String(right);
      fadeState.current.right = right;
    }
  }, []);

  const sync = useCallback(() => {
    const el = elRef.current;
    if (!el) return;
    const { scrollWidth, clientWidth, scrollLeft } = el;
    if (scrollWidth <= clientWidth) {
      setThumb(null);
      setFade(el, false, false);
      return;
    }
    const trackW = clientWidth;
    const minThumb = 24;
    const width = Math.max(minThumb, (clientWidth / scrollWidth) * trackW);
    const maxLeft = trackW - width;
    const left = maxLeft * (scrollLeft / (scrollWidth - clientWidth));
    setThumb(prev =>
      prev && prev.width === width && prev.left === left ? prev : { width, left }
    );
    setFade(el, scrollLeft > 1, scrollWidth - clientWidth - scrollLeft > 1);
  }, [setFade]);

  const reveal = useCallback(() => {
    setVisible(prev => (prev ? prev : true));
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setVisible(false), 1000);
  }, []);

  const handleScroll = useCallback(() => {
    reveal();
    if (rafPending.current) return;
    rafPending.current = true;
    requestAnimationFrame(() => {
      rafPending.current = false;
      sync();
    });
  }, [sync, reveal]);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
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
  }, []);

  const onThumbPointerDown = (e: React.PointerEvent) => {
    const el = elRef.current;
    if (!el) return;
    e.preventDefault();
    e.stopPropagation();
    dragState.current = { startX: e.clientX, startScroll: el.scrollLeft };
    setIsDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onThumbPointerMove = (e: React.PointerEvent) => {
    const el = elRef.current;
    const drag = dragState.current;
    if (!el || !drag || !thumb) return;
    const trackW = el.clientWidth;
    const maxLeft = trackW - thumb.width;
    const deltaX = e.clientX - drag.startX;
    const scrollRange = el.scrollWidth - el.clientWidth;
    el.scrollLeft = drag.startScroll + (deltaX / maxLeft) * scrollRange;
    reveal();
  };

  const onThumbPointerUp = (e: React.PointerEvent) => {
    dragState.current = null;
    setIsDragging(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const onScrollProp = scrollProps?.onScroll as ((e: React.UIEvent<HTMLDivElement>) => void) | undefined;

  return (
    <div className={cn('relative min-w-0 min-h-0 flex-1 flex flex-col', className)}>
      <div
        {...scrollProps}
        ref={setRef}
        onScroll={(e) => { handleScroll(); onScrollProp?.(e); }}
        className={cn('w-full flex-grow overflow-x-auto scrollbar-none horizontal-scroll-fade', scrollClassName)}
      >
        {children}
      </div>
      {thumb && (
        <div
          className={cn("absolute left-0 right-0 h-[18px] bg-transparent z-10", isDragging ? "cursor-grabbing" : "cursor-default")}
          style={{ bottom: -10 }}
          onMouseEnter={() => { setHovering(true); reveal(); }}
          onMouseLeave={() => setHovering(false)}
        >
          <div
            onPointerDown={onThumbPointerDown}
            onPointerMove={onThumbPointerMove}
            onPointerUp={onThumbPointerUp}
            className={cn(
              'absolute h-[5px] rounded-full bg-[var(--bone-15)] hover:bg-[var(--bone-30)]',
              'transition-opacity duration-300 ease-out',
              isDragging ? 'cursor-grabbing' : 'cursor-pointer',
              (visible || hovering || isDragging) ? 'opacity-100' : 'opacity-0'
            )}
            style={{ width: thumb.width, left: thumb.left, bottom: 1 }}
          />
        </div>
      )}
    </div>
  );
}
