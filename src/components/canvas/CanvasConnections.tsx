"use client";

import { useStore, EditorBlock } from "@/data/store";
import { useMemo } from "react";
import { SmartArrowEdge } from "./edges/SmartArrowEdge";
import { activeDragOffsets } from "@/lib/canvasDragState";

interface CanvasConnectionsProps {
  canvasId: string;
  selectedIds: Set<string>;
  onSelect: (id: string, addToSelection: boolean) => void;
}

export function CanvasConnections({ canvasId, selectedIds, onSelect }: CanvasConnectionsProps) {
  const allBlocks = useStore(state => state.blocks);
  const blocks = useMemo(() => allBlocks.filter(b => b.canvasId === canvasId), [allBlocks, canvasId]);
  
  // Collect both custom shape arrows and automatic entity-links
  const connections = useMemo(() => 
    blocks.filter(b => b.type === 'connection' || (b.type === 'shape' && (b.shapeKind === 'arrow' || b.shapeKind === 'line'))),
    [blocks]
  );

  // We isolate only active node-links here that utilize SmartArrowEdge dynamic anchors
  const linkedConnections = useMemo(() => 
    blocks.filter(b => b.type === 'connection' && b.fromId && b.toId),
    [blocks]
  );

  const getBlockData = (blockId: string) => {
    const b = blocks.find(x => x.id === blockId);
    if (!b) return null;
    const dragOffset = activeDragOffsets.get(blockId) || { dx: 0, dy: 0 };
    return {
      x: (b.x || 0) + dragOffset.dx,
      y: (b.y || 0) + dragOffset.dy,
      w: b.width || 280,
      h: b.height || 100
    };
  };

  const getPointPosition = (blockId: string, side: string) => {
    const data = getBlockData(blockId);
    if (!data) return { x: 0, y: 0 };
    const { x, y, w, h } = data;
    switch(side) {
      case 'top': return { x: x + w / 2, y: y };
      case 'right': return { x: x + w, y: y + h / 2 };
      case 'bottom': return { x: x + w / 2, y: y + h };
      case 'left': return { x: x, y: y + h / 2 };
      default: return { x: x + w / 2, y: y + h / 2 };
    }
  };

  return (
    <svg className="absolute inset-0 pointer-events-none w-full h-full overflow-visible z-[5]">
      <defs>
        {/* Base fallback marker */}
        <marker id="arrowhead" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path d="M0,0 L0,8 L8,4 z" fill="var(--accent)" />
        </marker>
        {/* Active Highlight Marker */}
        <marker id="arrowhead-selected" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path d="M0,0 L0,8 L8,4 z" fill="var(--brand-blue)" />
        </marker>
        {/* Custom Styled Markers matching presets */}
        <marker id="arrowhead-accent" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path d="M0,0 L0,8 L8,4 z" fill="#d38f36" />
        </marker>
        <marker id="arrowhead-blue" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path d="M0,0 L0,8 L8,4 z" fill="#5b9cf6" />
        </marker>
        <marker id="arrowhead-purple" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path d="M0,0 L0,8 L8,4 z" fill="#a78bfa" />
        </marker>
        <marker id="arrowhead-green" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path d="M0,0 L0,8 L8,4 z" fill="#4ade80" />
        </marker>
        <marker id="arrowhead-red" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path d="M0,0 L0,8 L8,4 z" fill="#f87171" />
        </marker>
        <marker id="arrowhead-bone" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path d="M0,0 L0,8 L8,4 z" fill="#E9E9E2" />
        </marker>
      </defs>

      {linkedConnections.map(conn => {
        const fromSide = conn.fromSide || 'bottom';
        const toSide = conn.toSide || 'top';
        
        const p1 = getPointPosition(conn.fromId!, fromSide);
        const p2 = getPointPosition(conn.toId!, toSide);
        
        // We only map connected nodes, freestanding paths managed by vector layer
        if (!conn.fromId || !conn.toId) return null;

        return (
          <SmartArrowEdge
            key={conn.id}
            id={conn.id}
            source={conn.fromId}
            target={conn.toId}
            sourceX={p1.x}
            sourceY={p1.y}
            targetX={p2.x}
            targetY={p2.y}
            sourcePosition={fromSide}
            targetPosition={toSide}
            pathPoints={conn.points}
            selected={selectedIds.has(conn.id)}
            onSelect={onSelect}
            canvasStyleExt={conn.canvasStyleExt}
          />
        );
      })}
    </svg>
  );
}
