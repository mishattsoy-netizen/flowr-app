"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useStore } from '@/data/store';
import { useCanvasViewport } from '@/hooks/useCanvasViewport';
import { cn } from '@/lib/utils';
import { useBrainData, type BrainCanvasNode, type BrainCanvasEdge } from './useBrainData';
import { useBrainDrag } from './useBrainDrag';
import { BrainNodeCard, CARD_W, CARD_H, type NodeDisplayInfo } from './BrainNodeCard';
import { BrainCanvasConnections } from './BrainCanvasConnections';
import { BrainToolbar } from './BrainToolbar';
import { BrainPresetPicker } from './BrainPresetPicker';
import { BrainStatsPanel } from './BrainStatsPanel';
import { AddExistingEntityPopover } from './AddExistingEntityPopover';
import type { ConnectorSide } from './connectorGeometry';
import { logger } from '@/lib/logger';
import { formatAge } from '@/lib/brain/formatAge';

/** Derive display info for a brain node from brain state + entity store. */
function computeDisplayInfo(
  node: BrainCanvasNode,
  entities: Array<{ id: string; type: string; title?: string; parentId?: string | null; lastModified?: number }>,
): NodeDisplayInfo {
  if (node.type === 'section') {
    return {
      typeIcon: <span className="text-[10px]">📂</span>,
      parentLabel: 'Section',
      ageLabel: formatAge(node.created_at),
      title: node.label || 'Untitled Section',
      preview: undefined,
      priority: node.priority,
    };
  }

  const entity = node.ref_id ? entities.find(e => e.id === node.ref_id) : null;
  const parentEntity = entity?.parentId ? entities.find(e => e.id === entity.parentId) : null;

  const typeIcons: Record<string, React.ReactNode> = {
    note: <span className="text-[10px]">📝</span>,
    workspace: <span className="text-[10px]">📁</span>,
    memory: <span className="text-[10px]">🧠</span>,
  };

  return {
    typeIcon: entity ? (typeIcons[entity.type] ?? <span className="text-[10px]">📄</span>) : <span className="text-[10px]">🧠</span>,
    parentLabel: parentEntity?.title || entity?.type === 'workspace' ? 'Workspace' : 'Unsorted',
    ageLabel: entity?.lastModified ? formatAge(new Date(entity.lastModified).toISOString()) : formatAge(node.created_at),
    title: node.label || entity?.title || node.content?.slice(0, 60) || 'Untitled',
    preview: node.type === 'memory' ? (node.content?.slice(0, 120) ?? undefined) : undefined,
    priority: node.priority,
  };
}

// Default positions for nodes that lack them — spread in a cascading grid.
function ensurePosition(
  node: BrainCanvasNode,
  index: number,
  existing: Record<string, { x: number; y: number }>,
): { x: number; y: number } {
  if (existing[node.id]) return existing[node.id];
  if (node.position) return node.position;
  // Cascade: place new nodes in a grid starting from (40, 40)
  const cols = Math.floor((typeof window !== 'undefined' ? window.innerWidth : 1200) / (CARD_W + 40));
  const col = index % Math.max(cols, 3);
  const row = Math.floor(index / Math.max(cols, 3));
  return { x: 40 + col * (CARD_W + 40), y: 40 + row * (CARD_H + 40) };
}

export function BrainCanvasPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { viewport, setViewport, viewportRef } = useCanvasViewport(containerRef);

  // ── Brain data (fetched via hook, synced to store's activeBrainId) ──
  const { state, loading, error, selectedBrainId, setSelectedBrainId, load, mutate } = useBrainData();
  const activeBrainId = useStore(s => s.activeBrainId);
  const setActiveBrainId = useStore(s => s.setActiveBrainId);

  // Sync the hook's selectedBrainId with the global activeBrainId.
  // This ensures the canvas re-fetches when the user clicks a different brain
  // in the sidebar (BrainSidebarContent sets activeBrainId store).
  useEffect(() => {
    if (activeBrainId && activeBrainId !== selectedBrainId) {
      setSelectedBrainId(activeBrainId);
    }
  }, [activeBrainId, selectedBrainId, setSelectedBrainId]);

  // Initial load (no brainId yet — loads the default brain)
  useEffect(() => {
    if (!selectedBrainId) load();
  }, [load, selectedBrainId]);

  const entities = useStore(s => s.entities);
  const openBrainNode = useStore(s => s.openBrainNode);
  const addEntity = useStore(s => s.addEntity);
  const setColumnEntity = useStore(s => s.setColumnEntity);

  // When loading a new brain, reset positions
  useEffect(() => {
    setPositions({});
  }, [selectedBrainId]);

  // Optimistic positions (synced on drag commit)
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});

  // Update position for a single node during drag
  const handlePositionChange = useCallback((nodeId: string, pos: { x: number; y: number }) => {
    setPositions(prev => ({ ...prev, [nodeId]: pos }));
  }, []);

  // Commit position to API (debounced — fires on pointer up)
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const handleCommit = useCallback((nodeId: string, pos: { x: number; y: number }) => {
    if (debounceTimers.current[nodeId]) clearTimeout(debounceTimers.current[nodeId]);
    debounceTimers.current[nodeId] = setTimeout(async () => {
      try {
        await mutate({ action: 'update_node', node_id: nodeId, updates: { position: pos } });
      } catch (e) {
        logger.error('Failed to save node position:', e);
      }
    }, 300);
  }, [mutate]);

  const { onNodePointerDown } = useBrainDrag(viewport, {
    onPositionChange: handlePositionChange,
    onCommit: handleCommit,
  });

  // Reset positions when data loads (fresh from API)
  useEffect(() => {
    if (state?.nodes) {
      setPositions(prev => {
        const next = { ...prev };
        for (const n of state.nodes) {
          if (!next[n.id] && n.position) next[n.id] = n.position;
        }
        return next;
      });
    }
  }, [state?.nodes]);

  // Node display info derived from entities + brain data
  const nodeInfos = useMemo(() => {
    if (!state) return new Map<string, NodeDisplayInfo>();
    const map = new Map<string, NodeDisplayInfo>();
    for (const node of state.nodes) {
      if (!node.enabled) continue;
      map.set(node.id, computeDisplayInfo(node, entities));
    }
    return map;
  }, [state, entities]);

  // Active nodes (enabled only, positioned)
  const activeNodes = useMemo(() => {
    if (!state) return [];
    return state.nodes.filter(n => n.enabled);
  }, [state]);

  const nodePositions = useMemo(() => {
    const map: Record<string, { x: number; y: number }> = {};
    for (let i = 0; i < activeNodes.length; i++) {
      map[activeNodes[i].id] = ensurePosition(activeNodes[i], i, positions);
    }
    return map;
  }, [activeNodes, positions]);

  // Tool modes
  const [connectMode, setConnectMode] = useState(false);
  const [fromDot, setFromDot] = useState<{ nodeId: string; side: ConnectorSide } | null>(null);
  const [connectorHover, setConnectorHover] = useState<ConnectorSide | null>(null);
  const [addExistingOpen, setAddExistingOpen] = useState(false);
  const [newNodeMode, setNewNodeMode] = useState(false);
  const [edgeLabelInput, setEdgeLabelInput] = useState<{ nodeId: string; toNodeId?: string } | null>(null);

  // Connect tool: handle clicking a connector dot
  const handleConnectorClick = useCallback((nodeId: string, side: ConnectorSide) => {
    if (!fromDot) {
      setFromDot({ nodeId, side });
    } else if (fromDot.nodeId !== nodeId) {
      // Second dot clicked — open inline label input
      setEdgeLabelInput({ nodeId: fromDot.nodeId, toNodeId: nodeId });
    } else {
      setFromDot(null); // deselect
    }
  }, [fromDot]);

  const commitEdge = useCallback(async (label: string) => {
    if (!edgeLabelInput) return;
    try {
      await mutate({ action: 'connect', from: edgeLabelInput.nodeId, to: edgeLabelInput.toNodeId, label });
    } catch (e) {
      logger.error('Failed to create edge:', e);
    }
    setEdgeLabelInput(null);
    setFromDot(null);
  }, [edgeLabelInput, mutate]);

  // New node: click to place on the canvas
  const handleCanvasClick = useCallback(async (e: React.MouseEvent) => {
    if (!newNodeMode) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (e.clientX - rect.left - viewport.x) / viewport.scale;
    const y = (e.clientY - rect.top - viewport.y) / viewport.scale;

    // Create a real note entity
    const entityId = addEntity({ type: 'note', title: 'New Note', content: [] });
    if (!entityId) return;

    // Add it as a brain node
    try {
      await mutate({ action: 'add_node', type: 'entity', ref_id: entityId, position: { x, y } });
    } catch (e) {
      logger.error('Failed to add brain node:', e);
    }
    // Open it in the right column
    openBrainNode(entityId);
    setNewNodeMode(false);
  }, [newNodeMode, viewport, addEntity, mutate, openBrainNode]);

  // Add existing entity as brain node
  const handleAddExisting = useCallback(async (refId: string, type: 'entity' | 'workspace') => {
    const x = 40 + (activeNodes.length % 5) * (CARD_W + 40);
    const y = 40 + Math.floor(activeNodes.length / 5) * (CARD_H + 40);
    try {
      await mutate({ action: 'add_node', type, ref_id: refId, position: { x, y } });
    } catch (e) {
      logger.error('Failed to add existing entity:', e);
    }
  }, [activeNodes.length, mutate]);

  // Background pan: space-drag / middle-click
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0, vx: 0, vy: 0 });

  const handleBgPointerDown = useCallback((e: React.PointerEvent) => {
    // Only handle events directly on the background, not on cards
    if (e.button === 1 || (e.button === 0 && (e.target as HTMLElement).dataset.bg === 'true')) {
      isPanningRef.current = true;
      panStartRef.current = { x: e.clientX, y: e.clientY, vx: viewport.x, vy: viewport.y };
    }
  }, [viewport]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!isPanningRef.current) return;
      setViewport(prev => ({
        ...prev,
        x: panStartRef.current.vx + (e.clientX - panStartRef.current.x),
        y: panStartRef.current.vy + (e.clientY - panStartRef.current.y),
      }));
    };
    const onUp = () => { isPanningRef.current = false; };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
  }, [setViewport]);

  if (!state) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        {error ? `Error: ${error}` : 'Loading brain…'}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative flex-1 h-full overflow-hidden bg-[var(--app-background)] select-none"
      onPointerDown={handleBgPointerDown}
    >
      {/* ── Top bar: presets + stats ── */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-3">
        <BrainPresetPicker
          brains={state.brains}
          selectedBrainId={selectedBrainId}
          onSelect={(id) => { setSelectedBrainId(id); setActiveBrainId(id); }}
        />
      </div>
      <div className="absolute top-4 right-4 z-20">
        <BrainStatsPanel
          used={state.budget.used}
          limit={state.budget.limit}
          nodeCount={state.nodes.filter(n => n.enabled).length}
          edgeCount={state.edges.length}
        />
      </div>

      {/* ── Transformed layer (viewport) ── */}
      <div
        className="absolute inset-0"
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`,
          transformOrigin: '0 0',
        }}
        onClick={handleCanvasClick}
      >
        {/* Background grid dots */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ minWidth: 4000, minHeight: 4000, left: -2000, top: -2000 }}>
          <defs>
            <pattern id="brain-grid" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="0.5" fill="var(--bone-8)" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#brain-grid)" />
        </svg>

        {/* Connections */}
        <BrainCanvasConnections
          nodes={activeNodes}
          edges={state.edges}
          positions={nodePositions}
        />

        {/* Nodes */}
        {activeNodes.map((node, index) => {
          const pos = nodePositions[node.id];
          const info = nodeInfos.get(node.id);
          if (!info) return null;

          return (
            <BrainNodeCard
              key={node.id}
              id={node.id}
              display={info}
              position={pos}
              connectMode={connectMode}
              connectorHover={fromDot?.nodeId === node.id ? fromDot.side : undefined}
              onPointerDown={(e) => onNodePointerDown(e, node.id, pos)}
              onConnectorClick={(side) => handleConnectorClick(node.id, side)}
              onClick={() => {
                if (node.ref_id) openBrainNode(node.ref_id);
              }}
            />
          );
        })}
      </div>

      {/* ── Inline edge label input ── */}
      {edgeLabelInput && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-overlay/20" onClick={() => setEdgeLabelInput(null)}>
          <div className="bg-panel border border-[var(--bone-10)] rounded-xl p-4 shadow-lg" onClick={e => e.stopPropagation()}>
            <input
              autoFocus
              placeholder="Edge label…"
              className="w-60 px-3 py-2 rounded-lg bg-[var(--app-dark)] border border-[var(--bone-10)] text-[13px] outline-none"
              onKeyDown={e => {
                if (e.key === 'Enter') commitEdge((e.target as HTMLInputElement).value);
                if (e.key === 'Escape') setEdgeLabelInput(null);
              }}
            />
          </div>
        </div>
      )}

      {/* ── Toolbar ── */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20">
        <BrainToolbar
          connectMode={connectMode}
          onToggleConnect={() => { setConnectMode(!connectMode); setFromDot(null); }}
          onNewNode={() => { setNewNodeMode(!newNodeMode); setConnectMode(false); }}
          newNodeActive={newNodeMode}
          addExistingOpen={addExistingOpen}
          onToggleAddExisting={() => setAddExistingOpen(!addExistingOpen)}
        />
        {addExistingOpen && (
          <div className="relative">
            <AddExistingEntityPopover
              onAddEntity={handleAddExisting}
              onClose={() => setAddExistingOpen(false)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
