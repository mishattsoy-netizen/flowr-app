"use client";

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { buildEdgePath, connectorPoint, closestSides, resolveEdgeSides, type ConnectorSide, type NodeBox } from './connectorGeometry';
import { CARD_W, CARD_H } from './BrainNodeCard';
import type { BrainCanvasNode, BrainCanvasEdge } from './useBrainData';

interface BrainCanvasConnectionsProps {
  nodes: BrainCanvasNode[];
  edges: BrainCanvasEdge[];
  /** Map from node id → current position (optimistic during drag) */
  positions: Record<string, { x: number; y: number }>;
  /** Map from node id → measured card height (content-driven, varies with
   *  preview text) — falls back to CARD_H for a card not yet measured. */
  heights: Record<string, number>;
  /** Node currently being dragged, if any — disables the path's CSS
   *  transition so the line tracks the cursor with no lag. */
  draggingNodeId?: string | null;
  onLabelClick?: (edgeId: string) => void;
  /** Click anywhere on the edge path (wide invisible hit stroke). */
  onEdgeClick?: (edgeId: string) => void;
  /** Selected canvas node ids — edges touching these use brand-blue stroke/shimmer. */
  selectedNodeIds?: ReadonlySet<string> | string[];
  /** When set (edge click), only this edge is blue; endpoints still use selectedNodeIds for borders. */
  selectedEdgeId?: string | null;
  /** While the connect tool has a picked source node, draw a live line from
   *  that node to the cursor (canvas space) until a second node is clicked. */
  pendingConnect?: {
    sourceNodeId: string;
    /** When set, rubber-band sticks to this port on the source card. */
    sourceSide?: ConnectorSide | null;
    cursor: { x: number; y: number } | null;
  } | null;
}

const SHIMMER_PERIOD = 64;
const SHIMMER_DUR = '3.2s';

/** Bone (idle) and brand-blue (selected) shimmer — same stops/opacities, different hue. */
function shimmerStops(selected: boolean) {
  const c = selected ? 'var(--brand-blue)' : 'var(--bone-30)';
  const mid = selected ? 'var(--brand-blue)' : 'var(--bone-70)';
  const peak = selected ? 'var(--brand-blue)' : 'var(--bone-90)';
  return (
    <>
      <stop offset="0" stopColor={c} stopOpacity="0.12" />
      <stop offset="0.22" stopColor={c} stopOpacity="0.15" />
      <stop offset="0.38" stopColor={mid} stopOpacity="0.75" />
      <stop offset="0.5" stopColor={peak} stopOpacity="1" />
      <stop offset="0.62" stopColor={mid} stopOpacity="0.75" />
      <stop offset="0.78" stopColor={c} stopOpacity="0.15" />
      <stop offset="1" stopColor={c} stopOpacity="0.12" />
    </>
  );
}

export function BrainCanvasConnections({
  nodes,
  edges,
  positions,
  heights,
  draggingNodeId,
  onEdgeClick,
  selectedNodeIds,
  selectedEdgeId,
  pendingConnect,
}: BrainCanvasConnectionsProps) {
  const selectedSet = useMemo(() => {
    if (!selectedNodeIds) return null;
    return selectedNodeIds instanceof Set ? selectedNodeIds : new Set(selectedNodeIds);
  }, [selectedNodeIds]);

  const paths = useMemo(() => {
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    return edges.map(edge => {
      const fromNode = nodeMap.get(edge.from_node);
      const toNode = nodeMap.get(edge.to_node);
      if (!fromNode || !toNode) return null;

      const fromPos = positions[edge.from_node] ?? fromNode.position ?? { x: 0, y: 0 };
      const toPos = positions[edge.to_node] ?? toNode.position ?? { x: 0, y: 0 };

      // Wait for measured heights — never draw with CARD_H then jump (that
      // made every edge shift on each Brain open). Cache in the page seeds
      // heights on remount so this is usually ready on first paint.
      const fromH = heights[edge.from_node];
      const toH = heights[edge.to_node];
      if (fromH == null || toH == null) return null;

      const fromBox: NodeBox = { x: fromPos.x, y: fromPos.y, width: CARD_W, height: fromH };
      const toBox: NodeBox = { x: toPos.x, y: toPos.y, width: CARD_W, height: toH };
      const [fromSide, toSide] = resolveEdgeSides(fromBox, toBox, edge.from_side, edge.to_side);

      const a = connectorPoint(fromBox, fromSide);
      const b = connectorPoint(toBox, toSide);
      const d = buildEdgePath(fromBox, fromSide, toBox, toSide);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const isDragging = draggingNodeId === edge.from_node || draggingNodeId === edge.to_node;
      const heightsKnown = true;
      // Edge click: only that edge is blue. Node select: all edges on selected nodes.
      const highlighted = selectedEdgeId
        ? edge.id === selectedEdgeId
        : !!(selectedSet && (selectedSet.has(edge.from_node) || selectedSet.has(edge.to_node)));
      return { id: edge.id, d, label: edge.label, mid, a, b, isDragging, heightsKnown, highlighted };
    }).filter(Boolean);
  }, [nodes, edges, positions, heights, draggingNodeId, selectedSet, selectedEdgeId]);

  // Live line from the connect tool's picked source node to the cursor,
  // while a second node hasn't been clicked yet. Uses the same elbow-routing
  // path builder as committed edges, treating the cursor as a zero-size box
  // so closestSides still picks a sensible facing side on the source card.
  const pendingPath = useMemo(() => {
    if (!pendingConnect?.cursor) return null;
    const sourceNode = nodes.find(n => n.id === pendingConnect.sourceNodeId);
    if (!sourceNode) return null;
    const sourcePos = positions[pendingConnect.sourceNodeId] ?? sourceNode.position ?? { x: 0, y: 0 };
    const sourceBox: NodeBox = { x: sourcePos.x, y: sourcePos.y, width: CARD_W, height: heights[pendingConnect.sourceNodeId] ?? CARD_H };
    const cursorBox: NodeBox = { x: pendingConnect.cursor.x, y: pendingConnect.cursor.y, width: 0, height: 0 };
    const [autoSide] = closestSides(sourceBox, cursorBox);
    const sourceSide = pendingConnect.sourceSide ?? autoSide;
    const a = connectorPoint(sourceBox, sourceSide);
    const d = buildEdgePath(sourceBox, sourceSide, cursorBox, 'top');
    return { d, a, cursor: pendingConnect.cursor };
  }, [pendingConnect, nodes, positions, heights]);

  // No transition-[d] on open/height settle — morphing made every edge look
  // like it shifted when reopening Brain. Drag still updates path live without
  // a CSS transition (isDragging used only for caller context if needed).
  const pathMoveClass = (_p: { id: string; isDragging: boolean; heightsKnown: boolean }) =>
    undefined;

  // Paths under cards. H + V shimmers share period/stops/duration, but each
  // edge animates along a→b so bands travel with the connection (not always
  // +X/+Y, which made some edges look reversed). Selected endpoints → brand-blue
  // base + shimmer (same opacities as bone idle).

  return (
    <svg
      className="absolute inset-0 pointer-events-none z-0 overflow-visible"
    >
      {paths.map(p => {
        if (!p) return null;
        // Travel with the edge: right/down when b is right/below a, else left/up.
        const dx = p.b.x - p.a.x;
        const dy = p.b.y - p.a.y;
        const hx = (dx === 0 ? 1 : Math.sign(dx)) * SHIMMER_PERIOD;
        const vy = (dy === 0 ? 1 : Math.sign(dy)) * SHIMMER_PERIOD;
        const gradH = `brain-edge-shimmer-h-${p.id}`;
        const gradV = `brain-edge-shimmer-v-${p.id}`;
        const baseStroke = p.highlighted ? 'var(--brand-blue)' : 'var(--bone-30)';
        // Match idle bone-30 base opacity on blue so the line doesn't jump brightness.
        const baseOpacity = p.highlighted ? 0.45 : 1;
        const stops = shimmerStops(p.highlighted);
        return (
          <g key={p.id}>
            <defs>
              <linearGradient
                id={gradV}
                gradientUnits="userSpaceOnUse"
                x1="0" y1="0" x2="0" y2={SHIMMER_PERIOD}
                spreadMethod="repeat"
              >
                {stops}
                <animateTransform
                  attributeName="gradientTransform"
                  type="translate"
                  from="0 0"
                  to={`0 ${vy}`}
                  dur={SHIMMER_DUR}
                  repeatCount="indefinite"
                />
              </linearGradient>
              <linearGradient
                id={gradH}
                gradientUnits="userSpaceOnUse"
                x1="0" y1="0" x2={SHIMMER_PERIOD} y2="0"
                spreadMethod="repeat"
              >
                {stops}
                <animateTransform
                  attributeName="gradientTransform"
                  type="translate"
                  from="0 0"
                  to={`${hx} 0`}
                  dur={SHIMMER_DUR}
                  repeatCount="indefinite"
                />
              </linearGradient>
            </defs>
            {/* Wide invisible hit target — svg is pointer-events-none; child overrides */}
            <path
              d={p.d}
              fill="none"
              stroke="transparent"
              strokeWidth={16}
              strokeLinejoin="round"
              style={{ pointerEvents: 'stroke', cursor: onEdgeClick ? 'pointer' : undefined }}
              onClick={(e) => {
                e.stopPropagation();
                onEdgeClick?.(p.id);
              }}
            />
            <path
              d={p.d}
              fill="none"
              stroke={baseStroke}
              strokeOpacity={baseOpacity}
              strokeWidth={2}
              strokeLinejoin="round"
              className={pathMoveClass(p)}
              style={{ pointerEvents: 'none' }}
            />
            <path
              d={p.d}
              fill="none"
              stroke={`url(#${gradV})`}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              className={pathMoveClass(p)}
              style={{ pointerEvents: 'none' }}
            />
            <path
              d={p.d}
              fill="none"
              stroke={`url(#${gradH})`}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              className={pathMoveClass(p)}
              style={{ pointerEvents: 'none' }}
            />
            {/* p.label && (
              <text
                x={p.mid.x} y={p.mid.y}
                textAnchor="middle" dominantBaseline="middle"
                className={cn(
                  "pointer-events-auto text-[10px] cursor-pointer",
                  p.highlighted ? "fill-[var(--brand-blue)]" : "fill-[var(--bone-70)]"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  onEdgeClick?.(p.id);
                }}
              >
                {p.label}
              </text>
            ) */}
          </g>
        );
      })}
      {pendingPath && (
        <path
          d={pendingPath.d}
          fill="none"
          stroke="var(--brand-blue)"
          strokeWidth={2}
          strokeDasharray="5 4"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}
