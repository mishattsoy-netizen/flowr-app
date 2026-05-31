"use client";

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { cn } from '@/lib/utils';

interface ScrollAreaProps {
  children: React.ReactNode;
  className?: string;
  innerRef?: React.RefObject<HTMLDivElement | null>;
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
}

export function ScrollArea({ children, className, innerRef, onScroll }: ScrollAreaProps) {
  const localRef = useRef<HTMLDivElement>(null);
  const scrollRef = (innerRef || localRef) as React.RefObject<HTMLDivElement>;
  const thumbRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [visible, setVisible] = useState(false);
  const isDragging = useRef(false);
  const isHoveringTrack = useRef(false);
  const dragStartY = useRef(0);
  const dragStartScroll = useRef(0);

  const show = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setVisible(true);
  }, []);

  const hide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setVisible(false), 1000);
  }, []);

  const updateThumb = useCallback(() => {
    const el = scrollRef.current;
    const thumb = thumbRef.current;
    if (!el || !thumb) return;
    const ratio = el.clientHeight / el.scrollHeight;
    if (ratio >= 1) { thumb.style.display = 'none'; return; }
    thumb.style.display = 'block';
    const thumbHeight = Math.max(ratio * el.clientHeight, 32);
    const maxScroll = el.scrollHeight - el.clientHeight;
    const thumbTop = (el.scrollTop / maxScroll) * (el.clientHeight - thumbHeight);
    thumb.style.height = `${thumbHeight}px`;
    thumb.style.transform = `translateY(${thumbTop}px)`;
  }, [scrollRef]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    updateThumb();
    show();
    hide();
    onScroll?.(e);
  }, [updateThumb, show, hide, onScroll]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateThumb();
    const ro = new ResizeObserver(updateThumb);
    ro.observe(el);
    return () => {
      ro.disconnect();
    };
  }, [scrollRef, updateThumb]);

  const onThumbMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isDragging.current = true;
    dragStartY.current = e.clientY;
    dragStartScroll.current = scrollRef.current?.scrollTop ?? 0;
    show();

    const onMove = (ev: MouseEvent) => {
      const el = scrollRef.current;
      const thumb = thumbRef.current;
      if (!el || !thumb) return;
      const thumbHeight = thumb.clientHeight;
      const ratio = (el.scrollHeight - el.clientHeight) / (el.clientHeight - thumbHeight);
      el.scrollTop = dragStartScroll.current + (ev.clientY - dragStartY.current) * ratio;
    };
    const onUp = () => {
      isDragging.current = false;
      if (!isHoveringTrack.current) {
        hide();
      }
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [scrollRef, show, hide]);

  return (
    <div className="relative flex-1 min-h-0 flex flex-col overflow-hidden">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className={cn('scrollbar-none overflow-y-auto', className)}
      >
        {children}
      </div>
      {/* Scrollbar Track / Hover Zone */}
      <div
        className="absolute right-0 top-0 bottom-0 w-3 z-50 pointer-events-auto cursor-pointer"
        onMouseEnter={() => { isHoveringTrack.current = true; updateThumb(); show(); }}
        onMouseLeave={() => { isHoveringTrack.current = false; if (!isDragging.current) hide(); }}
      >
        <div
          className="absolute right-[2px] top-0 bottom-0 w-[4px] pointer-events-none"
          style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.3s ease' }}
        >
          <div
            ref={thumbRef}
            onMouseDown={onThumbMouseDown}
            className="absolute w-full rounded-full cursor-pointer pointer-events-auto"
            style={{ background: 'rgba(233,233,226,0.2)' }}
          />
        </div>
      </div>
    </div>
  );
}
