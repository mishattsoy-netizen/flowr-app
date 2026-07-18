"use client";

import { useMemo, useEffect, useRef } from 'react';
import { buildEdgePath, connectorPoint, closestSides, type NodeBox } from './connectorGeometry';
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
  /** While the connect tool has a picked source node, draw a live line from
   *  that node to the cursor (canvas space) until a second node is clicked. */
  pendingConnect?: { sourceNodeId: string; cursor: { x: number; y: number } | null } | null;
}

export function BrainCanvasConnections({
  nodes,
  edges,
  positions,
  heights,
  draggingNodeId,
  pendingConnect,
}: BrainCanvasConnectionsProps) {
  const paths = useMemo(() => {
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    return edges.map(edge => {
      const fromNode = nodeMap.get(edge.from_node);
      const toNode = nodeMap.get(edge.to_node);
      if (!fromNode || !toNode) return null;

      const fromPos = positions[edge.from_node] ?? fromNode.position ?? { x: 0, y: 0 };
      const toPos = positions[edge.to_node] ?? toNode.position ?? { x: 0, y: 0 };

      const fromBox: NodeBox = { x: fromPos.x, y: fromPos.y, width: CARD_W, height: heights[edge.from_node] ?? CARD_H };
      const toBox: NodeBox = { x: toPos.x, y: toPos.y, width: CARD_W, height: heights[edge.to_node] ?? CARD_H };
      const [fromSide, toSide] = closestSides(fromBox, toBox);

      const a = connectorPoint(fromBox, fromSide);
      const b = connectorPoint(toBox, toSide);
      const d = buildEdgePath(fromBox, fromSide, toBox, toSide);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const isDragging = draggingNodeId === edge.from_node || draggingNodeId === edge.to_node;
      // Both endpoints' real heights land asynchronously (ResizeObserver,
      // after first paint) — until then this path is drawn against the
      // CARD_H fallback. Skip the CSS transition for that one correction so
      // it snaps instead of visibly sliding every time the canvas opens.
      const heightsKnown = edge.from_node in heights && edge.to_node in heights;
      return { id: edge.id, d, label: edge.label, mid, a, b, isDragging, heightsKnown };
    }).filter(Boolean);
  }, [nodes, edges, positions, heights, draggingNodeId]);

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
    const [sourceSide] = closestSides(sourceBox, cursorBox);
    const a = connectorPoint(sourceBox, sourceSide);
    const d = buildEdgePath(sourceBox, sourceSide, cursorBox, 'top');
    return { d, a, cursor: pendingConnect.cursor };
  }, [pendingConnect, nodes, positions, heights]);

  // Soft path morph only after an edge has already settled once with real
  // heights. Enabling transition the first time heights land (CARD_H → measured)
  // causes every line to slide on first canvas open.
  const settledHeightsRef = useRef(new Set<string>());
  useEffect(() => {
    for (const p of paths) {
      if (p?.heightsKnown) settledHeightsRef.current.add(p.id);
    }
  }, [paths]);

  // Geometry transition only — never put stroke-dashoffset in React props
  // (that restarts CSS dash animation on every paint).
  const pathMoveClass = (p: { id: string; isDragging: boolean; heightsKnown: boolean }) => {
    if (p.isDragging || !p.heightsKnown) return undefined;
    if (!settledHeightsRef.current.has(p.id)) return undefined;
    return 'transition-[d] duration-100';
  };

  // Paths under cards. H + V shimmers share period/stops/duration, but each
  // edge animates along a→b so bands travel with the connection (not always
  // +X/+Y, which made some edges look reversed).
  const SHIMMER_PERIOD = 64;
  const SHIMMER_DUR = '3.2s';
  const shimmerStops = (
    <>
      <stop offset="0" stopColor="var(--bone-30)" stopOpacity="0.12" />
      <stop offset="0.22" stopColor="var(--bone-30)" stopOpacity="0.15" />
      <stop offset="0.38" stopColor="var(--bone-70)" stopOpacity="0.75" />
      <stop offset="0.5" stopColor="var(--bone-90)" stopOpacity="1" />
      <stop offset="0.62" stopColor="var(--bone-70)" stopOpacity="0.75" />
      <stop offset="0.78" stopColor="var(--bone-30)" stopOpacity="0.15" />
      <stop offset="1" stopColor="var(--bone-30)" stopOpacity="0.12" />
    </>
  );

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
        return (
          <g key={p.id}>
            <defs>
              <linearGradient
                id={gradV}
                gradientUnits="userSpaceOnUse"
                x1="0" y1="0" x2="0" y2={SHIMMER_PERIOD}
                spreadMethod="repeat"
              >
                {shimmerStops}
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
                {shimmerStops}
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
            <path
              d={p.d}
              fill="none"
              stroke="var(--bone-30)"
              strokeWidth={2}
              strokeLinejoin="round"
              className={pathMoveClass(p)}
            />
            <path
              d={p.d}
              fill="none"
              stroke={`url(#${gradV})`}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              className={pathMoveClass(p)}
            />
            <path
              d={p.d}
              fill="none"
              stroke={`url(#${gradH})`}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              className={pathMoveClass(p)}
            />
            {p.label && (
              <text
                x={p.mid.x} y={p.mid.y}
                textAnchor="middle" dominantBaseline="middle"
                className="pointer-events-auto fill-[var(--bone-70)] text-[10px]"
              >
                {p.label}
              </text>
            )}
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
