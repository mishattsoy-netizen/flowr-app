"use client";

import { useRef, useState, useLayoutEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Brain as BrainIcon, CalendarClock } from 'lucide-react';
import { Tooltip } from '@/components/layout/Tooltip';
import { usageBarFillClass } from '@/lib/usageBarColor';
import { CONNECTOR_DOT_R, connectorPoint, type ConnectorSide } from './connectorGeometry';
import { useOverflowFade } from './useOverflowFade';

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
  tagColor?: string | null;
  /** Custom tag name, rendered as a footer pill in the tag's colour. */
  tagName?: string | null;
  /** Brain-only note (Memory) — gets its own card treatment. */
  isMemory?: boolean;
  /** This node's share of the per-node cap, 0..1 — dimmed footer bar. */
  usageFraction?: number;
  activeFrom?: string | null;
  activeUntil?: string | null;
  /** True when past active_until or before active_from (dimmed dead/scheduled). */
  lifecycleInactive?: boolean;
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
  /**
   * Edge-click highlight: both endpoints get dark fill + blue border; only the
   * ports on that edge go blue (via highlightedConnectedSides).
   */
  edgeHighlight?: boolean;
  onPointerDown?: (e: React.PointerEvent) => void;
  onClick?: (e: React.MouseEvent) => void;
  /** Connect tool: click a specific port to pin that side (body click stays auto). */
  onConnectPort?: (side: ConnectorSide, e: React.MouseEvent) => void;
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
  /** Sides whose edge is highlighted (e.g. far end of a selected node's blue edge). */
  highlightedConnectedSides?: ConnectorSide[];
  /** Override card cursor (e.g. connect tool / space-pan from parent). */
  cursorClassName?: string;
  /** Last measured height (from session cache) so connector dots match edges on first paint. */
  initialHeight?: number;
}

/** Endpoint discs that already have an edge (idle). Selected → brand blue. */
const CONNECTED_DOT_FILL = '#B5B5B0';
const CONNECTED_DOT_SELECTED = 'var(--brand-blue)';

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
  edgeHighlight,
  onPointerDown,
  onClick,
  onConnectPort,
  onContextMenu,
  onHeightChange,
  connectCursor,
  connectedSides = [],
  highlightedConnectedSides = [],
  cursorClassName,
  initialHeight,
}: BrainNodeCardProps) {
  const priorityLabel = display.priority <= 1 ? 'high' : display.priority <= 2 ? 'medium' : 'low';
  const connectedSet = useMemo(() => new Set(connectedSides), [connectedSides]);
  const highlightedSideSet = useMemo(
    () => new Set(highlightedConnectedSides),
    [highlightedConnectedSides],
  );
  // Connect tool: all 4 dots fade in together on card hover.
  const [connectHover, setConnectHover] = useState(false);
  const [cardHover, setCardHover] = useState(false);
  /** Port under the pointer — scales that disc only (connect mode). */
  const [hoveredPort, setHoveredPort] = useState<ConnectorSide | null>(null);
  useLayoutEffect(() => {
    if (!connectMode) {
      setConnectHover(false);
      setHoveredPort(null);
    }
  }, [connectMode]);

  // Content-driven height, measured after render. Prefer session cache
  // (initialHeight) so dots/edges don't start at CARD_H and jump on open.
  const [cardHeight, setCardHeight] = useState(initialHeight ?? CARD_H);
  const cardRef = useRef<HTMLDivElement>(null);
  // Select / edge-select: dark fill + blue border. Edge still uses edgeHighlight
  // for port-only blue dots (not every connected port).
  const selectedBorder = !!(multiSelected || selected || edgeHighlight);
  const darkSelectFill = !!(connectSelected || multiSelected || selected || edgeHighlight);
  const highlighted = !!(connectSelected || selectedBorder);

  const isWorkspace = display.variant === 'workspace';
  const tagColor = display.tagColor;
  const isMemory = !!display.isMemory;
  const isDead = !!(display.lifecycleInactive && display.activeUntil
    && Date.parse(display.activeUntil) < Date.now());
  // Rest: soft tag tint (or plain card). Hover/select: dark only (no tag wash).
  // Same value drives card fill + preview fade so they stay consistent.
  const useDarkSurface = darkSelectFill || cardHover;
  const nodeSurface = useDarkSurface
    ? 'var(--app-dark)'
    : tagColor
      ? `color-mix(in srgb, ${tagColor} 11%, var(--card-bg))`
      : 'var(--card-bg)';

  // Preview fade when text spans 3+ lines (not only when clamp overflows).
  const { ref: previewRef, overflowing: previewOverflows } = useOverflowFade([
    display.preview,
  ], 3);

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
      onMouseEnter={() => {
        setCardHover(true);
        if (connectMode) setConnectHover(true);
      }}
      onMouseLeave={() => {
        setCardHover(false);
        setConnectHover(false);
      }}
    >
    <div
      ref={cardRef}
      data-drag-handle="true"
      className={cn(
        "relative w-full flex-shrink-0 rounded-xl text-left flex flex-col overflow-hidden",
        cursorClassName
          ? cursorClassName
          : connectMode
            ? "cursor-pointer"
            : "cursor-grab active:cursor-grabbing",
        darkSelectFill || selectedBorder
          ? "border border-[var(--brand-blue)]"
          : tagColor
            ? "border"
            : "border border-[var(--bone-10)]",
        isDead && "opacity-50 grayscale",
      )}
      style={{
        transform: 'translateZ(0)',
        backgroundColor: nodeSurface,
        // Smooth hover + select (same duration as preview fade layer).
        transition: dragging
          ? 'none'
          : 'background-color 200ms ease-out, border-color 200ms ease-out',
        ...(!darkSelectFill && !selectedBorder && tagColor
          ? { borderColor: tagColor }
          : {}),
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
        <div className="relative z-[1] shrink-0 pt-4 px-4 pb-1">
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
          <div className="relative z-[1] shrink-0 pt-2.5 px-4">
            <div className="flex items-center justify-between text-[11px] text-[var(--bone-30)] font-medium mb-3">
              {isMemory ? (
                // Memory notes aren't filed anywhere — the Memory pill IS the
                // identity line, replacing the type/workspace label entirely.
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[6px] text-[9px] font-semibold uppercase tracking-wide bg-[#A78BFA]/15 text-[#C4B5FD]">
                  <BrainIcon className="w-2.5 h-2.5" strokeWidth={2.5} />
                  <span className="relative top-px">Memory</span>
                </span>
              ) : (
                <div className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 text-[var(--bone-100)] opacity-30 [&>svg]:w-3.5 [&>svg]:h-3.5 flex items-center justify-center">
                    {display.typeIcon}
                  </span>
                  <span>{display.typeLabel || 'Note'}</span>
                </div>
              )}
              <span>{display.ageLabel}</span>
            </div>

            {/* Lifecycle state reads from the footer date pill — no chips
                crowding the title. */}
            <h3 className="font-display font-medium text-base text-[var(--bone-100)] line-clamp-2 leading-tight min-w-0">
              {display.title || 'Untitled'}
            </h3>
          </div>

          {/* maxHeight (not fixed height) so short previews shrink the card.
              line-clamp-4 keeps whole lines only (4 × 18px = 72px). Bottom fade
              when preview is 3+ lines. */}
          {display.preview && (
            <div className="relative z-[1] shrink-0 px-4 mt-1.5 overflow-hidden max-h-[72px]">
              <p
                ref={previewRef}
                className="text-[11px] text-[var(--bone-70)] break-words line-clamp-4"
                style={{ lineHeight: '18px' }}
              >
                {display.preview}
              </p>
              {previewOverflows && (
                <div
                  className="absolute inset-x-0 bottom-0 h-7 pointer-events-none"
                  style={{
                    backgroundColor: nodeSurface,
                    transition: dragging ? 'none' : 'background-color 200ms ease-out',
                    maskImage: 'linear-gradient(to bottom, transparent 0%, black 100%)',
                    WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 100%)',
                  }}
                />
              )}
            </div>
          )}
        </>
      )}

      {/* Footer: no own fill — same card background shows through. */}
      <div className="relative z-[1] shrink-0 w-full px-4 pt-2.5 pb-3 rounded-b-xl">
        <div className="flex flex-wrap items-center gap-1.5 w-full">
          <span className={cn(
            "inline-flex items-center px-2 py-0.5 rounded-[6px] text-[10px] font-medium capitalize shrink-0",
            priorityLabel === 'high' ? "bg-red-500/15 text-red-400" :
              priorityLabel === 'medium' ? "bg-amber-500/15 text-amber-400" :
                "bg-blue-500/15 text-blue-400"
          )}>
            {priorityLabel}
          </span>
          {/* Memory identity already shown once, in the header pill — no
              need to repeat it in the footer too. */}
          {/* Custom tag pill, in the tag's own colour. */}
          {display.tagName && tagColor && (
            <Tooltip content={display.tagName}>
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[6px] text-[10px] font-medium shrink-0 max-w-[110px]"
                style={{ backgroundColor: `${tagColor}26`, color: tagColor }}
              >
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: tagColor }} />
                <span className="truncate">{display.tagName}</span>
              </span>
            </Tooltip>
          )}
          {/* Workspace pill, matching TaskCard's workspace chip. */}
          {display.parentLabel && !isWorkspace && (
            <Tooltip content={display.parentLabel}>
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-[6px] text-[10px] font-medium shrink-0 max-w-[90px] bg-[var(--bone-10)] text-[var(--bone-70)]"
              >
                <span className="truncate">{display.parentLabel}</span>
              </span>
            </Tooltip>
          )}
          {/* Lifecycle end date, TaskCard's due-date treatment. */}
          {display.activeUntil && (
            <span className={cn(
              "inline-flex items-center gap-1 px-2 py-0.5 rounded-[6px] text-[10px] font-medium shrink-0",
              isDead ? "bg-[var(--bone-10)] text-[var(--bone-35)]" : "bg-amber-400/15 text-amber-300"
            )}>
              <CalendarClock className="w-2.5 h-2.5" strokeWidth={2.5} />
              {new Date(display.activeUntil).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </span>
          )}
          {display.childPills?.map(pill => (
            <span
              key={pill.label}
              className="inline-flex items-center px-2 py-0.5 rounded-[6px] text-[10px] font-medium shrink-0 bg-[var(--bone-10)] text-[var(--bone-70)]"
            >
              {pill.count} {pill.label}
            </span>
          ))}
        </div>

        {/* Usage bar — always shown (incl. lifetime / empty). */}
        {(() => {
          const frac = display.usageFraction ?? 0;
          const barPct = Math.min(100, Math.max(0, frac * 100));
          return (
            <div className="flex items-center gap-2 w-full mt-2.5">
              <span className="text-[10px] font-semibold tabular-nums text-[var(--bone-60)] shrink-0">
                {barPct >= 1
                  ? Math.round(barPct)
                  : barPct > 0
                    ? Math.max(0.1, Math.round(barPct * 10) / 10)
                    : 0}%
              </span>
              <div className="flex-1 h-[4px] rounded-full bg-[rgba(217,217,217,0.10)] overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-[width,background-color] duration-300",
                    usageBarFillClass(barPct),
                  )}
                  style={{ width: `${barPct}%` }}
                />
              </div>
            </div>
          );
        })()}
      </div>
    </div>

      {/* Endpoint discs: all 4 blue dots fade in together on card hover
          while the connect tool is active. Hovering a specific port scales it;
          clicking a port pins that side (body click stays auto). */}
      {SIDES.map(side => {
        const borderW = 1;
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
        const portHot = connectMode && hoveredPort === side;
        const scale = portHot ? 1.35 : 1;
        const disc = {
          left: hit / 2 - r,
          top: hit / 2 - r,
          width: r * 2,
          height: r * 2,
          transform: `scale(${scale})`,
          transformOrigin: 'center',
          transition: 'transform 120ms ease-out, opacity 150ms ease-out, background-color 150ms ease-out',
        } as const;

        return (
          <div
            key={side}
            onPointerEnter={connectMode ? () => setHoveredPort(side) : undefined}
            onPointerLeave={connectMode ? () => setHoveredPort(prev => (prev === side ? null : prev)) : undefined}
            onClick={connectMode ? (e) => {
              e.stopPropagation();
              e.preventDefault();
              onConnectPort?.(side, e);
            } : undefined}
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
                style={{
                  ...disc,
                  // Edge select: only the port(s) on that edge turn blue.
                  // Node select: all connected ports on the selected node, plus
                  // the far-end port on neighbors (highlightedConnectedSides).
                  backgroundColor: (
                    edgeHighlight
                      ? highlightedSideSet.has(side)
                      : (selectedBorder || highlightedSideSet.has(side))
                  )
                    ? CONNECTED_DOT_SELECTED
                    : CONNECTED_DOT_FILL,
                }}
              />
            )}
            <div
              className="absolute rounded-full pointer-events-none"
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
