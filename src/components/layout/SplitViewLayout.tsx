"use client";

import { useRef, useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useStore } from '@/data/store';
import { EntityPageRenderer } from '@/components/EntityPageRenderer';
import { ColumnHeader } from './ColumnHeader';
import { ColumnPlaceholder } from './ColumnPlaceholder';
import { dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';

const COLLAPSE_THRESHOLD_PX = 180;
const MIN_COLUMN_PCT = 15;
const MAX_COLUMN_PCT = 85;

export function SplitViewLayout() {
  const splitViewLeftId = useStore(s => s.splitViewLeftId);
  const splitViewRightId = useStore(s => s.splitViewRightId);
  const splitViewPosition = useStore(s => s.splitViewPosition);
  const setSplitViewPosition = useStore(s => s.setSplitViewPosition);
  const setColumnEntity = useStore(s => s.setColumnEntity);
  const toggleSplitView = useStore(s => s.toggleSplitView);

  const containerRef = useRef<HTMLDivElement>(null);
  const leftColRef = useRef<HTMLDivElement>(null);
  const rightColRef = useRef<HTMLDivElement>(null);
  const isResizingRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const [isResizing, setIsResizing] = useState(false);

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
        return entityType === 'note' || entityType === 'canvas';
      },
      onDrop: ({ source }) => {
        const entityId = source.data.id as string;
        if (entityId) setColumnEntity('left', entityId);
      },
    });

    const cleanupRight = dropTargetForElements({
      element: rightEl,
      getData: () => ({ column: 'right' as const }),
      canDrop: ({ source }) => {
        const entityType = source.data.entityType as string | undefined;
        return entityType === 'note' || entityType === 'canvas';
      },
      onDrop: ({ source }) => {
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
        "flex-1 flex flex-row overflow-hidden relative min-h-0",
        isResizing && "select-none"
      )}
    >
      {/* ── Left Column ── */}
      <div
        ref={leftColRef}
        className="flex flex-col h-full min-h-0 bg-[var(--app-background)]"
        style={{
          width: `${clampedPosition}%`,
          transition: isResizing ? 'none' : undefined,
        }}
      >
        <ColumnHeader column="left" entityId={splitViewLeftId} />
        {splitViewLeftId ? (
          <div className="flex-1 overflow-y-auto min-h-0">
            <EntityPageRenderer entityId={splitViewLeftId} />
          </div>
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
        className={cn(
          "w-[6px] h-full cursor-col-resize shrink-0 z-50 flex items-center justify-center transition-colors duration-200 group",
          isResizing ? "bg-[var(--bone-15)]" : "bg-transparent hover:bg-[var(--bone-6)]"
        )}
      >
        <div
          className={cn(
            "h-full w-[2px] rounded-full transition-all duration-200",
            isResizing
              ? "bg-[var(--bone-70)]"
              : "bg-[var(--bone-30)] group-hover:bg-[var(--bone-50)] group-hover:w-[3px]"
          )}
        />
      </div>

      {/* ── Right Column ── */}
      <div
        ref={rightColRef}
        className="flex flex-col h-full min-h-0 flex-1"
        style={{ background: 'var(--app-background)' }}
      >
        <ColumnHeader column="right" entityId={splitViewRightId} />
        {splitViewRightId ? (
          <div className="flex-1 overflow-y-auto min-h-0">
            <EntityPageRenderer entityId={splitViewRightId} />
          </div>
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
