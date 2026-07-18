"use client";

import { useRef, useState, useLayoutEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { CONNECTOR_DOT_R, connectorPoint, type ConnectorSide } from './connectorGeometry';

export const CARD_W = 280;
// Fallback height used before a card's real (content-driven) height has been
// measured — e.g. for connector-line geometry on the very first render.
export const CARD_H = 160;

/** Derived info about a brain node for display. */
export interface NodeDisplayInfo {
  typeIcon: React.ReactNode;
  parentLabel: string;
  ageLabel: string;
  title: string;
  preview?: string;
  priority: number;
  typeLabel?: string;
  /** Budget token cost for this node; undefined for sections/broken refs. */
  tokenCount?: number;
  /** Workspace cards use a compact layout: icon + large title, no meta header. */
  variant?: 'default' | 'workspace';
  /** Child counts for workspace cards, e.g. { count: 3, label: 'Canvas' }. */
  childPills?: { count: number; label: string }[];
}

interface BrainNodeCardProps {
  id: string;
  display: NodeDisplayInfo;
  position: { x: number; y: number };
  selected?: boolean;
  dragging?: boolean;
  connectMode?: boolean;
  /** True while this card is the already-picked source of a pending connection. */
  connectSelected?: boolean;
  /** True while this card is part of a multi-select group. */
  multiSelected?: boolean;
  onPointerDown?: (e: React.PointerEvent) => void;
  onClick?: (e: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  /** Reports this card's actual rendered height (content-driven, varies with
   *  preview text length) so connector-line geometry can target the real
   *  bottom edge instead of assuming a fixed CARD_H for every card. */
  onHeightChange?: (id: string, height: number) => void;
  /** Cursor position in canvas space (same coord system as `position`),
   *  supplied while the connect tool is active so this card can fade in its
   *  nearest connector dot as the cursor approaches — even from outside the
   *  card's own bounds. Null when not in connect mode. */
  connectCursor?: { x: number; y: number } | null;
  /** Sides that already have an edge (same side pick as line geometry). */
  connectedSides?: ConnectorSide[];
  /** Override card cursor (e.g. connect tool / space-pan from parent). */
  cursorClassName?: string;
}

const CONNECTED_DOT_FILL = '#B5B5B0';

const SIDES: ConnectorSide[] = ['top', 'right', 'bottom', 'left'];

// Hit target size around each connector (click/tap), not used for fade-in.
const DOT_HIT = 36;

export function BrainNodeCard({
  id,
  display,
  position,
  selected,
  dragging,
  connectMode,
  connectSelected,
  multiSelected,
  onPointerDown,
  onClick,
  onContextMenu,
  onHeightChange,
  connectCursor,
  connectedSides = [],
  cursorClassName,
}: BrainNodeCardProps) {
  const priorityLabel = display.priority <= 1 ? 'high' : display.priority <= 2 ? 'medium' : 'low';
  const connectedSet = useMemo(() => new Set(connectedSides), [connectedSides]);
  // Connect tool: all 4 dots fade in together on card hover.
  const [connectHover, setConnectHover] = useState(false);
  useLayoutEffect(() => {
    if (!connectMode) setConnectHover(false);
  }, [connectMode]);

  // The card's height is now content-driven (grows/shrinks with preview
  // text) instead of a fixed constant, so it's measured after each render
  // and reported up for connector-line geometry. cardHeight starts at
  // CARD_H so the connector dots have a sane position before the first
  // measurement lands. Re-measure when selection changes border width
  // (1px ↔ 2px) so side midpoints stay on the true edge center.
  const [cardHeight, setCardHeight] = useState(CARD_H);
  const cardRef = useRef<HTMLDivElement>(null);
  // 2px ring only for multi/select highlight — connect-source stays 1px like idle.
  const thickBorder = !!(multiSelected || selected);
  const highlighted = !!(connectSelected || thickBorder);

  const isWorkspace = display.variant === 'workspace';

  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const report = () => {
      const h = el.offsetHeight;
      setCardHeight(h);
      onHeightChange?.(id, h);
    };
    report();
    const observer = new ResizeObserver(report);
    observer.observe(el);
    return () => observer.disconnect();
  }, [id, onHeightChange, display.preview, display.title, display.childPills, highlighted, isWorkspace]);

  return (
    <div
      data-brain-node={id}
      className={cn("absolute z-10", dragging && "z-20")}
      style={{
        left: position.x,
        top: position.y,
        width: CARD_W,
      }}
      onMouseEnter={() => { if (connectMode) setConnectHover(true); }}
      onMouseLeave={() => setConnectHover(false)}
    >
    <div
      ref={cardRef}
      data-drag-handle="true"
      className={cn(
        "relative w-full group flex-shrink-0 bg-[var(--card-bg)] rounded-xl text-left flex flex-col overflow-hidden",
        dragging ? "transition-none" : "transition-colors duration-200",
        cursorClassName
          ? cursorClassName
          : connectMode
            ? "cursor-pointer"
            : "cursor-grab active:cursor-grabbing",
        // Connect-source: 1px blue (same weight as idle). Multi/select: 2px blue.
        connectSelected
          ? "bg-[var(--app-dark)] border border-[var(--brand-blue)]"
          : thickBorder
            ? "bg-[var(--app-dark)] border-2 border-[var(--brand-blue)]"
            : "border border-[var(--bone-10)] hover:bg-[var(--app-dark)]"
      )}
      style={{
        transform: 'translateZ(0)',  // GPU layer
      }}
      onPointerDown={onPointerDown}
      onClick={(e) => { e.stopPropagation(); onClick?.(e); }}
      onContextMenu={(e) => {
        if (!onContextMenu) return;
        e.preventDefault();
        e.stopPropagation();
        onContextMenu(e);
      }}
    >
      {isWorkspace ? (
        /* Workspace: no meta header — large icon + title, then child pills */
        <div className="shrink-0 pt-4 px-4 pb-1">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-9 h-9 shrink-0 text-[var(--bone-100)] opacity-90 [&>svg]:w-9 [&>svg]:h-9 flex items-center justify-center">
              {display.typeIcon}
            </span>
            <h3 className="font-display font-medium text-[22px] text-[var(--bone-100)] line-clamp-2 leading-tight min-w-0 tracking-[-0.01em]">
              {display.title || 'Untitled'}
            </h3>
          </div>
        </div>
      ) : (
        <>
          {/* Header + title: fixed at top, padded */}
          <div className="shrink-0 pt-3.5 px-4">
            <div className="flex items-center justify-between text-[11px] text-[var(--bone-30)] font-medium mb-1.5">
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 text-[var(--bone-100)] opacity-30 [&>svg]:w-3.5 [&>svg]:h-3.5 flex items-center justify-center">
                  {display.typeIcon}
                </span>
                <span>{display.typeLabel || 'Note'}</span>
                <span>·</span>
                <span className="truncate max-w-[85px]">{display.parentLabel || 'Unsorted'}</span>
              </div>
              <span>{display.ageLabel}</span>
            </div>

            <h3 className="font-display font-medium text-base text-[var(--bone-100)] line-clamp-1">
              {display.title || 'Untitled'}
            </h3>
          </div>

          {/* Text area: flex-fill between title and footer. Collapses to zero
              when there's no preview text, so the card shrinks to just
              header+title+footer instead of leaving dead space. */}
          {display.preview && (
            <div className="relative flex-1 min-h-0 px-4">
              <p className="text-[11px] text-[var(--bone-70)] leading-relaxed break-words line-clamp-4 mt-1.5">
                {display.preview}
              </p>
              <div className={cn(
                "absolute inset-x-0 bottom-0 h-6 pointer-events-none bg-gradient-to-b from-transparent transition-colors duration-200",
                (connectSelected || multiSelected || selected) ? "to-[var(--app-dark)]" : "to-[var(--card-bg)] group-hover:to-[var(--app-dark)]"
              )} />
            </div>
          )}
        </>
      )}

      {/* Footer: priority + workspace child counts + tokens */}
      <div className={cn(
        "relative shrink-0 flex flex-wrap items-center gap-1.5 w-full px-4 py-2.5 rounded-b-xl transition-colors duration-200",
        (connectSelected || multiSelected || selected) ? "bg-[var(--app-dark)]" : "bg-[var(--card-bg)] group-hover:bg-[var(--app-dark)]"
      )}>
        <span className={cn(
          "inline-flex items-center px-2 py-0.5 rounded-[6px] text-[10px] font-medium capitalize shrink-0",
          priorityLabel === 'high' ? "bg-red-500/15 text-red-400" :
            priorityLabel === 'medium' ? "bg-amber-500/15 text-amber-400" :
              "bg-blue-500/15 text-blue-400"
        )}>
          {priorityLabel}
        </span>
        {display.childPills?.map(pill => (
          <span
            key={pill.label}
            className="inline-flex items-center px-2 py-0.5 rounded-[6px] text-[10px] font-medium shrink-0 bg-[var(--bone-5)] text-[var(--bone-60)]"
          >
            {pill.count} {pill.label}
          </span>
        ))}
        {display.tokenCount != null && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-[6px] text-[10px] font-medium shrink-0 bg-[var(--bone-5)] text-[var(--bone-60)]">
            {display.tokenCount} tok
          </span>
        )}
      </div>
    </div>

      {/* Endpoint discs: all 4 blue dots fade in together on card hover
          while the connect tool is active (not staggered per-dot proximity). */}
      {SIDES.map(side => {
        const borderW = thickBorder ? 2 : 1;
        const local = connectorPoint(
          { x: 0, y: 0, width: CARD_W, height: cardHeight },
          side,
          borderW,
        );
        const hit = DOT_HIT;
        const r = CONNECTOR_DOT_R;
        const connected = connectedSet.has(side);

        const show = connected || connectMode || connectSelected;
        if (!show) return null;

        // All four sides share the same opacity so they appear as one unit.
        const blueOpacity = connectSelected || (connectMode && connectHover) ? 1 : 0;
        const disc = {
          left: hit / 2 - r,
          top: hit / 2 - r,
          width: r * 2,
          height: r * 2,
        } as const;

        return (
          <div
            key={side}
            onClick={connectMode ? (e) => { e.stopPropagation(); onClick?.(e); } : undefined}
            className={cn(
              "absolute z-20",
              connectMode && "pointer-events-auto cursor-pointer"
            )}
            style={{
              left: local.x - hit / 2,
              top: local.y - hit / 2,
              width: hit,
              height: hit,
            }}
          >
            {connected && (
              <div
                className="absolute rounded-full pointer-events-none"
                style={{ ...disc, backgroundColor: CONNECTED_DOT_FILL }}
              />
            )}
            <div
              className="absolute rounded-full pointer-events-none transition-opacity duration-150 ease-out"
              style={{
                ...disc,
                backgroundColor: 'var(--brand-blue)',
                opacity: blueOpacity,
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
