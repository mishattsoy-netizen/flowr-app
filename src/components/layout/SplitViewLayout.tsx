"use client";

import { useRef, useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useStore } from '@/data/store';
import { EntityPageRenderer } from '@/components/EntityPageRenderer';
import { ColumnHeader } from './ColumnHeader';
import { ColumnPlaceholder } from './ColumnPlaceholder';
import { OverlayScrollbar } from '@/components/tracker/OverlayScrollbar';
import { dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { isDesktop } from '@/lib/env';

const COLLAPSE_THRESHOLD_PX = 180;
const MIN_COLUMN_PCT = 33.33;
const MAX_COLUMN_PCT = 66.67;

export function SplitViewLayout() {
  const splitViewLeftId = useStore(s => s.splitViewLeftId);
  const splitViewRightId = useStore(s => s.splitViewRightId);
  const splitViewPosition = useStore(s => s.splitViewPosition);
  const setSplitViewPosition = useStore(s => s.setSplitViewPosition);
  const setColumnEntity = useStore(s => s.setColumnEntity);
  const toggleSplitView = useStore(s => s.toggleSplitView);

  const isDesktopEnv = isDesktop();

  const containerRef = useRef<HTMLDivElement>(null);
  const leftColRef = useRef<HTMLDivElement>(null);
  const rightColRef = useRef<HTMLDivElement>(null);
  const isResizingRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [isDividerHovered, setIsDividerHovered] = useState(false);
  const dividerHoverTimer = useRef<NodeJS.Timeout | null>(null);
  
  const columnDragOver = useStore(s => s.columnDragOver);
  const setColumnDragOver = useStore(s => s.setColumnDragOver);

  // ── Drop targets for sidebar drag-and-drop ──
  useEffect(() => {
    const leftEl = leftColRef.current;
    const rightEl = rightColRef.current;
    if (!leftEl || !rightEl) return;

    const cleanupLeft = dropTargetForElements({
      element: leftEl,
      getData: () => ({ column: 'left' as const }),
      canDrop: ({ source }) => {
        const entityType = source.data.entityType as string | undefined;
        const id = source.data.id as string | undefined;
        if (id === 'chat') return false;
        return entityType === 'note' || entityType === 'canvas' || entityType === 'workspace' || entityType === 'folder' || entityType === 'main_page';
      },
      onDragEnter: () => setColumnDragOver('left'),
      onDragLeave: () => setColumnDragOver(null),
      onDrop: ({ source }) => {
        setColumnDragOver(null);
        const entityId = source.data.id as string;
        if (entityId) setColumnEntity('left', entityId);
      },
    });

    const cleanupRight = dropTargetForElements({
      element: rightEl,
      getData: () => ({ column: 'right' as const }),
      canDrop: ({ source }) => {
        const entityType = source.data.entityType as string | undefined;
        const id = source.data.id as string | undefined;
        if (id === 'chat') return false;
        return entityType === 'note' || entityType === 'canvas' || entityType === 'workspace' || entityType === 'folder' || entityType === 'main_page';
      },
      onDragEnter: () => setColumnDragOver('right'),
      onDragLeave: () => setColumnDragOver(null),
      onDrop: ({ source }) => {
        setColumnDragOver(null);
        const entityId = source.data.id as string;
        if (entityId) setColumnEntity('right', entityId);
      },
    });

    return () => {
      cleanupLeft();
      cleanupRight();
    };
  }, [setColumnEntity]);

  // ── Resize logic ──
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    setIsResizing(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return;
      if (!containerRef.current) return;
      if (rafRef.current) return;

      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;

        const rect = containerRef.current!.getBoundingClientRect();
        const pct = ((e.clientX - rect.left) / rect.width) * 100;
        const clamped = Math.max(MIN_COLUMN_PCT, Math.min(MAX_COLUMN_PCT, pct));
        setSplitViewPosition(clamped);
      });
    };

    const stopResize = () => {
      if (!isResizingRef.current) return;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }

      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const leftPx = (rect.width * splitViewPosition) / 100;
        if (leftPx < COLLAPSE_THRESHOLD_PX || (rect.width - leftPx) < COLLAPSE_THRESHOLD_PX) {
          isResizingRef.current = false;
          setIsResizing(false);
          document.body.style.cursor = '';
          document.body.style.userSelect = '';
          toggleSplitView();
          return;
        }
      }

      isResizingRef.current = false;
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', stopResize);
    window.addEventListener('mouseleave', stopResize);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', stopResize);
      window.removeEventListener('mouseleave', stopResize);
    };
  }, [setSplitViewPosition, splitViewPosition, toggleSplitView]);

  const clampedPosition = Math.max(MIN_COLUMN_PCT, Math.min(MAX_COLUMN_PCT, splitViewPosition));

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex-1 flex flex-row relative min-h-0",
        isResizing && "select-none"
      )}
    >
      {/* ── Left Column ── */}
      <div
        ref={leftColRef}
        className={cn(
          "flex flex-col h-full min-h-0 transition-colors duration-150 overflow-hidden relative",
          isDesktopEnv ? cn(
            "bg-[var(--app-background)] border rounded-2xl shadow-sm",
            columnDragOver === 'left' ? "border-[var(--bone-15)]" : "border-[var(--bone-10)]"
          ) : "bg-[var(--app-background)]"
        )}
        style={{
          width: `calc(${clampedPosition}% - ${isDesktopEnv ? '4px' : '0px'})`,
          transition: isResizing ? 'none' : undefined,
        }}
      >
        {columnDragOver === 'left' && (
          <div 
            className="absolute inset-x-0 bottom-0 bg-[var(--bone-5)] pointer-events-none z-50"
            style={{ top: isDesktopEnv ? 0 : 42 }}
          />
        )}
        {!isDesktopEnv && <ColumnHeader column="left" entityId={splitViewLeftId} />}
        {splitViewLeftId ? (
          <OverlayScrollbar className="flex-1 min-h-0" thumbOffsetRight={0} thumbRightClass="right-0">
            <EntityPageRenderer entityId={splitViewLeftId} />
          </OverlayScrollbar>
        ) : (
          <ColumnPlaceholder
            column="left"
            onOpenEntity={(entityId) => setColumnEntity('left', entityId)}
          />
        )}
      </div>

      {/* ── Divider ── */}
      <div
        onMouseDown={handleMouseDown}
        onPointerEnter={() => {
          dividerHoverTimer.current = setTimeout(() => setIsDividerHovered(true), 150);
        }}
        onPointerLeave={() => {
          if (dividerHoverTimer.current) clearTimeout(dividerHoverTimer.current);
          setIsDividerHovered(false);
        }}
        className={cn(
          "z-50 flex items-center justify-center transition-colors duration-200",
          (isDividerHovered || isResizing) && "cursor-col-resize",
          isDesktopEnv 
            ? "relative shrink-0 h-full w-2 bg-transparent" 
            : "absolute h-[calc(100%-42px)] bottom-0 w-[6px] bg-transparent"
        )}
        style={!isDesktopEnv ? { left: `calc(${clampedPosition}% - 3px)` } : undefined}
      >
        <div
          className={cn(
            "h-full rounded-full",
            isResizing 
              ? "w-[3px] bg-[var(--card-bg)] opacity-100"
              : isDesktopEnv 
                ? "w-[1px] opacity-0"
                : "w-[1px] bg-[var(--bone-12)] opacity-100"
          )}
        />
      </div>

      {/* ── Right Column ── */}
      <div
        ref={rightColRef}
        className={cn(
          "flex flex-col h-full min-h-0 flex-1 transition-colors duration-150 overflow-hidden relative",
          isDesktopEnv ? cn(
            "bg-[var(--app-background)] border rounded-2xl shadow-sm",
            columnDragOver === 'right' ? "border-[var(--bone-15)]" : "border-[var(--bone-10)]"
          ) : "bg-[var(--app-background)]"
        )}
      >
        {columnDragOver === 'right' && (
          <div 
            className="absolute inset-x-0 bottom-0 bg-[var(--bone-5)] pointer-events-none z-50"
            style={{ top: isDesktopEnv ? 0 : 42 }}
          />
        )}
        {!isDesktopEnv && <ColumnHeader column="right" entityId={splitViewRightId} />}
        {splitViewRightId ? (
          <OverlayScrollbar className="flex-1 min-h-0" thumbOffsetRight={0} thumbRightClass="right-0">
            <EntityPageRenderer entityId={splitViewRightId} />
          </OverlayScrollbar>
        ) : (
          <ColumnPlaceholder
            column="right"
            onOpenEntity={(entityId) => setColumnEntity('right', entityId)}
          />
        )}
      </div>
    </div>
  );
}

export default SplitViewLayout;
