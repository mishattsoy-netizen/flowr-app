"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useStore } from '@/data/store';
import { useCanvasViewport, MIN_ZOOM, MAX_ZOOM, ZOOM_STEP } from '@/hooks/useCanvasViewport';
import { cn } from '@/lib/utils';
import { useBrainData, authHeaders, type BrainCanvasNode, type BrainCanvasEdge } from './useBrainData';
import { useBrainDrag } from './useBrainDrag';
import { BrainNodeCard, CARD_W, CARD_H, type NodeDisplayInfo } from './BrainNodeCard';
import { BrainCanvasConnections } from './BrainCanvasConnections';
import { BrainToolbar } from './BrainToolbar';
import { BrainLeftPanel } from './BrainLeftPanel';
import { BrainDetailsPanel } from './BrainDetailsPanel';
import type { DetailsNodeDisplay } from './DetailsMode';
import { WorkspaceDescriptionPopup } from './WorkspaceDescriptionPopup';
import { BrainZoomControls } from './BrainZoomControls';
import { AddExistingEntityPopover } from './AddExistingEntityPopover';
import { logger } from '@/lib/logger';
import { formatAge } from '@/lib/brain/formatAge';
import { hasEdgeBetween } from '@/lib/bot/services/brainEdgeUtils';
import { closestSides, type ConnectorSide } from './connectorGeometry';
import { blocksToMarkdown } from '@/lib/editor/markdownBlocks';
import type { EditorBlock } from '@/data/store.types';
import { isDesktop } from '@/lib/env';
import { getEntityIcon } from '@/data/icons';
import { FileText, Folder, Brain, Trash2, PanelRightOpen } from 'lucide-react';

/** Count direct children of a workspace for footer pills. */
function workspaceChildPills(
  workspaceId: string,
  entities: Array<{ id: string; type: string; parentId?: string | null }>,
): { count: number; label: string }[] {
  const children = entities.filter(e => e.parentId === workspaceId);
  const notes = children.filter(e => e.type === 'note').length;
  const canvases = children.filter(e => e.type === 'canvas').length;
  const folders = children.filter(e => e.type === 'folder').length;
  const spaces = children.filter(e => e.type === 'workspace').length;
  const pills: { count: number; label: string }[] = [];
  // Labels match the user's examples ("3 Canvas", "30 Notes").
  if (canvases > 0) pills.push({ count: canvases, label: 'Canvas' });
  if (notes > 0) pills.push({ count: notes, label: notes === 1 ? 'Note' : 'Notes' });
  if (folders > 0) pills.push({ count: folders, label: folders === 1 ? 'Folder' : 'Folders' });
  if (spaces > 0) pills.push({ count: spaces, label: spaces === 1 ? 'Space' : 'Spaces' });
  return pills;
}

/** Derive display info for a brain node from brain state + entity store. */
function computeDisplayInfo(
  node: BrainCanvasNode,
  entities: Array<{ id: string; type: string; title?: string; parentId?: string | null; lastModified?: number; content?: EditorBlock[]; icon?: string }>,
  perNodeTokens: Record<string, number>,
): NodeDisplayInfo {
  if (node.type === 'section') {
    return {
      typeIcon: <Folder strokeWidth={2} />,
      typeLabel: 'Section',
      parentLabel: 'Section',
      ageLabel: formatAge(node.created_at),
      title: node.label || 'Untitled Section',
      preview: undefined,
      priority: node.priority,
      tokenCount: undefined,
    };
  }

  const entity = node.ref_id ? entities.find(e => e.id === node.ref_id) : null;
  const parentEntity = entity?.parentId ? entities.find(e => e.id === entity.parentId) : null;
  const isWorkspace = node.type === 'workspace' || entity?.type === 'workspace';

  if (isWorkspace) {
    const Icon = getEntityIcon(entity?.icon);
    return {
      typeIcon: <Icon strokeWidth={2} />,
      typeLabel: 'Workspace',
      parentLabel: 'Workspace',
      ageLabel: entity?.lastModified
        ? formatAge(new Date(entity.lastModified).toISOString())
        : formatAge(node.created_at),
      title: node.label || entity?.title || 'Untitled',
      preview: undefined,
      priority: node.priority,
      tokenCount: perNodeTokens[node.id],
      variant: 'workspace',
      childPills: entity ? workspaceChildPills(entity.id, entities) : [],
    };
  }

  const typeIcons: Record<string, React.ReactNode> = {
    note: <FileText strokeWidth={2} />,
    workspace: <Folder strokeWidth={2} />,
    memory: <Brain strokeWidth={2} />,
  };

  const typeLabels: Record<string, string> = {
    note: 'Note',
    workspace: 'Workspace',
    memory: 'Memory',
  };

  return {
    typeIcon: entity ? (typeIcons[entity.type] ?? <FileText strokeWidth={2} />) : <Brain strokeWidth={2} />,
    typeLabel: entity ? typeLabels[entity.type] : 'Memory',
    parentLabel: parentEntity?.title || (entity?.type === 'workspace' ? 'Workspace' : 'Unsorted'),
    ageLabel: entity?.lastModified ? formatAge(new Date(entity.lastModified).toISOString()) : formatAge(node.created_at),
    title: node.label || entity?.title || node.content?.slice(0, 60) || 'Untitled',
    preview: node.type === 'memory'
      ? (node.content?.slice(0, 120) ?? undefined)
      : (entity?.type === 'note' && entity.content?.length
        ? blocksToMarkdown(entity.content).slice(0, 120)
        : undefined),
    priority: node.priority,
    tokenCount: perNodeTokens[node.id],
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
  // Match ColumnHeader / HeaderBar left inset for dashboard/tracker/chat/brain.
  const headerContentLeft = isDesktop() ? 30 : 20;

  // ── Brain data (fetched via hook, synced to store's activeBrainId) ──
  const { state, loading, error, selectedBrainId, setSelectedBrainId, load, mutate, addLocalEdge, removeLocalEdge, patchLocalNode, patchLocalEdge } = useBrainData();
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

  // Compact usage stats for BrainLeftPanel (full calendar loads on expand inside the panel)
  const [usageStats, setUsageStats] = useState({ requests: 0, activeDays: 0 });
  useEffect(() => {
    if (!selectedBrainId) return;
    let cancelled = false;
    setUsageStats({ requests: 0, activeDays: 0 });
    (async () => {
      try {
        const res = await fetch('/api/ai/user-brain', {
          method: 'POST',
          headers: await authHeaders(),
          body: JSON.stringify({ action: 'brain_usage_stats', brain_id: selectedBrainId }),
        });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled) {
          setUsageStats({ requests: data.requests ?? 0, activeDays: data.activeDays ?? 0 });
        }
      } catch (e) {
        if (!cancelled) logger.error('Failed to load brain usage stats:', e);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedBrainId]);

  const handleRenameBrain = useCallback(async (brainId: string, title: string) => {
    try {
      // mutate reloads body.brain_id's cache; the panel reads state.brains from
      // the selected brain, so refresh selected when renaming another row.
      await mutate({ action: 'update_brain', brain_id: brainId, title });
      if (selectedBrainId && brainId !== selectedBrainId) {
        await load(selectedBrainId);
      }
    } catch (e) {
      logger.error('Failed to rename brain:', e);
    }
  }, [mutate, load, selectedBrainId]);

  const handleSetDefaultBrain = useCallback(async (brainId: string) => {
    try {
      // mutate reloads body.brain_id's cache; always refresh selected so is_default
      // badges update across the list shown from the selected brain cache.
      await mutate({ action: 'set_default_brain', brain_id: brainId });
      if (selectedBrainId && brainId !== selectedBrainId) {
        await load(selectedBrainId);
      }
    } catch (e) {
      logger.error('Failed to set default brain:', e);
    }
  }, [mutate, load, selectedBrainId]);

  const handleSetBrainIcon = useCallback(async (brainId: string, icon: string) => {
    try {
      await mutate({ action: 'update_brain', brain_id: brainId, icon });
      if (selectedBrainId && brainId !== selectedBrainId) {
        await load(selectedBrainId);
      }
    } catch (e) {
      logger.error('Failed to set brain icon:', e);
    }
  }, [mutate, load, selectedBrainId]);

  const handleResetUsage = useCallback(async () => {
    if (!selectedBrainId) return;
    try {
      const res = await fetch('/api/ai/user-brain', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ action: 'brain_usage_stats', brain_id: selectedBrainId }),
      });
      if (!res.ok) return;
      const data = await res.json();
      setUsageStats({ requests: data.requests ?? 0, activeDays: data.activeDays ?? 0 });
    } catch (e) {
      logger.error('Failed to refresh brain usage stats:', e);
    }
  }, [selectedBrainId]);

  const entities = useStore(s => s.entities);
  const openBrainNode = useStore(s => s.openBrainNode);
  const addEntity = useStore(s => s.addEntity);
  const setColumnEntity = useStore(s => s.setColumnEntity);
  const moveEntity = useStore(s => s.moveEntity);
  const renameEntity = useStore(s => s.renameEntity);
  const splitViewRightId = useStore(s => s.splitViewRightId);

  // Details panel: single-click opens panel; editor is mutually exclusive.
  const [detailsPanel, setDetailsPanel] = useState<{
    focusedNodeId: string;
    mode: 'details' | 'connections';
    /** Set when the panel was opened by clicking an edge line: connections
     *  mode shows just that edge's two endpoints as a pair. */
    edgeId?: string;
  } | null>(null);
  /** After "Open editor", remember which node to restore the panel for. */
  const [panelResumeNodeId, setPanelResumeNodeId] = useState<string | null>(null);

  // When loading a new brain, reset positions
  useEffect(() => {
    setPositions({});
  }, [selectedBrainId]);

  // Optimistic positions (synced on drag commit)
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);

  // Cards are now content-sized (height varies with preview text), so
  // connector-line geometry needs each card's actual rendered height rather
  // than the CARD_H constant — reported up by BrainNodeCard after it measures
  // itself.
  const [heights, setHeights] = useState<Record<string, number>>({});
  const handleHeightChange = useCallback((nodeId: string, height: number) => {
    setHeights(prev => (prev[nodeId] === height ? prev : { ...prev, [nodeId]: height }));
  }, []);

  // Multi-select: shift/ctrl-click accumulates node ids; dragging any
  // selected card moves the whole set together (delta-based, no bounding
  // box — the dragged card's own delta is applied to every other selected
  // card's own starting position, captured at drag start).
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  /** When set, only this edge is force-blue (edge click); endpoints also selected for borders. */
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const groupDragOriginRef = useRef<Record<string, { x: number; y: number }> | null>(null);

  const handleNodeClick = useCallback((nodeId: string, e: React.MouseEvent) => {
    if (e.shiftKey || e.metaKey || e.ctrlKey) {
      setSelectedEdgeId(null);
      setSelectedNodeIds(prev => {
        const next = new Set(prev);
        if (next.has(nodeId)) next.delete(nodeId); else next.add(nodeId);
        return next;
      });
      return true; // handled as a selection toggle, caller should stop here
    }
    return false;
  }, []);

  // Right-click menu — Open in editor + Delete
  const [nodeContextMenu, setNodeContextMenu] = useState<{ nodeId: string; x: number; y: number } | null>(null);
  const handleDeleteNode = useCallback(async (nodeId: string) => {
    setNodeContextMenu(null);
    const node = state?.nodes.find(n => n.id === nodeId);
    const ent = node?.ref_id ? entities.find(e => e.id === node.ref_id) : null;
    try {
      if (ent?.brainOnly && node?.ref_id) {
        if (!confirm('This memory is only in your brain — deleting it is permanent.')) return;
        await mutate({
          action: 'delete_memory_node',
          node_id: nodeId,
          entity_id: node.ref_id,
        });
      } else {
        await mutate({ action: 'remove_node', node_id: nodeId });
      }
      setDetailsPanel(prev => (prev?.focusedNodeId === nodeId ? null : prev));
    } catch (e) {
      logger.error('Failed to delete brain node:', e);
    }
  }, [mutate, state?.nodes, entities]);

  const openDetailsForNode = useCallback((
    nodeId: string,
    mode: 'details' | 'connections' = 'details',
    opts?: { replaceSelection?: boolean },
  ) => {
    setPanelResumeNodeId(null);
    setSelectedEdgeId(null);
    // Close editor column if open (panel + editor are mutually exclusive)
    if (useStore.getState().splitViewRightId) {
      setColumnEntity('right', null);
    }
    if (opts?.replaceSelection !== false) {
      setSelectedNodeIds(new Set([nodeId]));
    }
    setDetailsPanel({ focusedNodeId: nodeId, mode });
  }, [setColumnEntity]);

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
  const expiredSet = useMemo(
    () => new Set(state?.expiredNodeIds ?? []),
    [state?.expiredNodeIds],
  );
  const nodeInfos = useMemo(() => {
    if (!state) return new Map<string, NodeDisplayInfo>();
    const map = new Map<string, NodeDisplayInfo>();
    for (const node of state.nodes) {
      if (!node.enabled) continue;
      const info = computeDisplayInfo(node, entities, state.perNodeTokens ?? {});
      info.tagColor = node.tag_color ?? null;
      info.tagName = node.tag_name ?? null;
      info.activeFrom = node.active_from ?? null;
      info.activeUntil = node.active_until ?? null;
      info.lifecycleInactive = expiredSet.has(node.id);
      // Memory = a brain-only note; distinct card treatment from a plain Note.
      info.isMemory = node.type === 'memory'
        || (!!node.ref_id && !!entities.find(e => e.id === node.ref_id)?.brainOnly);
      // Per-node usage bar (share of the per-node cap), footer bottom edge.
      const cap = state.perNodeCap ?? 2000;
      const tok = (state.perNodeTokens ?? {})[node.id];
      info.usageFraction = tok != null && cap > 0 ? tok / cap : undefined;
      map.set(node.id, info);
    }
    return map;
  }, [state, entities, expiredSet]);

  // Active nodes (enabled only, positioned)
  const activeNodes = useMemo(() => {
    if (!state) return [];
    return state.nodes.filter(n => n.enabled);
  }, [state]);

  // Compact node list for BrainLeftPanel (title + priority for budget breakdown)
  const leftPanelNodes = useMemo(() => {
    return activeNodes.map(n => ({
      id: n.id,
      title: nodeInfos.get(n.id)?.title ?? n.label ?? 'Untitled',
      priority: n.priority,
    }));
  }, [activeNodes, nodeInfos]);

  const getDetailsDisplay = useCallback((nodeId: string): DetailsNodeDisplay | null => {
    const info = nodeInfos.get(nodeId);
    const node = state?.nodes.find(n => n.id === nodeId);
    if (!info) return null;
    const ent = node?.ref_id ? entities.find(e => e.id === node.ref_id) : null;
    return {
      title: info.title,
      preview: info.preview ?? (ent?.description ?? undefined),
      priority: info.priority,
      workspaceLabel: info.parentLabel,
      typeIcon: info.typeIcon,
      brainOnly: ent?.brainOnly === true,
      description: ent?.description ?? null,
    };
  }, [nodeInfos, state?.nodes, entities]);

  const workspaceOptions = useMemo(
    () => entities.filter(e => e.type === 'workspace').map(e => ({ id: e.id, title: e.title })),
    [entities],
  );

  const [knownTags, setKnownTags] = useState<{ tag_color: string; tag_name: string | null }[]>([]);
  useEffect(() => {
    if (!detailsPanel) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/ai/user-brain', {
          method: 'POST',
          headers: await authHeaders(),
          body: JSON.stringify({ action: 'brain_tags' }),
        });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled) setKnownTags(Array.isArray(data.tags) ? data.tags : []);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [detailsPanel?.focusedNodeId]);

  const handlePanelOpenEditor = useCallback((refId: string) => {
    if (detailsPanel) setPanelResumeNodeId(detailsPanel.focusedNodeId);
    setDetailsPanel(null);
    openBrainNode(refId);
  }, [detailsPanel, openBrainNode]);

  const handleResumePanel = useCallback(() => {
    if (!panelResumeNodeId) return;
    setColumnEntity('right', null);
    setDetailsPanel({ focusedNodeId: panelResumeNodeId, mode: 'details' });
    setPanelResumeNodeId(null);
  }, [panelResumeNodeId, setColumnEntity]);

  const handleUpdateTitle = useCallback(async (nodeId: string, title: string) => {
    const node = state?.nodes.find(n => n.id === nodeId);
    try {
      patchLocalNode(nodeId, { label: title });
      await mutate({ action: 'update_node', node_id: nodeId, updates: { label: title } }, { backgroundReload: true });
      if (node?.type === 'entity' && node.ref_id) {
        renameEntity(node.ref_id, title);
      }
    } catch (e) {
      logger.error('Failed to update node title:', e);
    }
  }, [state?.nodes, mutate, renameEntity, patchLocalNode]);

  const handleUpdatePriority = useCallback(async (nodeId: string, priority: number) => {
    try {
      patchLocalNode(nodeId, { priority });
      await mutate({ action: 'update_node', node_id: nodeId, updates: { priority } }, { backgroundReload: true });
    } catch (e) {
      logger.error('Failed to update priority:', e);
    }
  }, [mutate, patchLocalNode]);

  const handleSetBrainOnly = useCallback(async (nodeId: string, brainOnly: boolean) => {
    const node = state?.nodes.find(n => n.id === nodeId);
    if (!node?.ref_id) return;
    try {
      await mutate({ action: 'set_brain_only', entity_id: node.ref_id, brain_only: brainOnly }, { backgroundReload: true });
      // Optimistic local store so Type pill updates without full entity refetch.
      useStore.setState(s => ({
        entities: s.entities.map(e => e.id === node.ref_id ? { ...e, brainOnly } : e),
      }));
    } catch (e) {
      logger.error('Failed to set brain_only:', e);
    }
  }, [state?.nodes, mutate]);

  const handleUpdateTag = useCallback(async (
    nodeId: string,
    tag: { tag_color: string | null; tag_name: string | null },
  ) => {
    try {
      patchLocalNode(nodeId, { tag_color: tag.tag_color, tag_name: tag.tag_name });
      await mutate({
        action: 'update_node',
        node_id: nodeId,
        updates: { tag_color: tag.tag_color, tag_name: tag.tag_name },
      }, { backgroundReload: true });
    } catch (e) {
      logger.error('Failed to update tag:', e);
    }
  }, [mutate, patchLocalNode]);

  const handleUpdateLifecycle = useCallback(async (
    nodeId: string,
    life: { active_from: string | null; active_until: string | null },
  ) => {
    try {
      patchLocalNode(nodeId, { active_from: life.active_from, active_until: life.active_until });
      await mutate({
        action: 'update_node',
        node_id: nodeId,
        updates: { active_from: life.active_from, active_until: life.active_until },
      }, { backgroundReload: true });
    } catch (e) {
      logger.error('Failed to update lifecycle:', e);
    }
  }, [mutate, patchLocalNode]);

  const [wsDescEdit, setWsDescEdit] = useState<{
    nodeId: string; entityId: string; title: string; description: string;
  } | null>(null);

  const handleEditWorkspaceDescription = useCallback((nodeId: string) => {
    const node = state?.nodes.find(n => n.id === nodeId);
    if (!node?.ref_id) return;
    const ent = entities.find(e => e.id === node.ref_id);
    setWsDescEdit({
      nodeId,
      entityId: node.ref_id,
      title: ent?.title ?? node.label ?? 'Workspace',
      description: ent?.description ?? '',
    });
  }, [state?.nodes, entities]);

  const handleSaveWorkspaceDescription = useCallback(async (title: string, description: string) => {
    if (!wsDescEdit) return;
    try {
      await mutate({
        action: 'set_workspace_description',
        entity_id: wsDescEdit.entityId,
        title,
        description,
      });
      useStore.setState(s => ({
        entities: s.entities.map(e =>
          e.id === wsDescEdit.entityId ? { ...e, title, description } : e
        ),
      }));
      await mutate({
        action: 'update_node',
        node_id: wsDescEdit.nodeId,
        updates: { label: title },
      });
      setWsDescEdit(null);
    } catch (e) {
      logger.error('Failed to save workspace description:', e);
    }
  }, [wsDescEdit, mutate]);

  const handleMoveToWorkspace = useCallback(async (nodeId: string, workspaceId: string | null) => {
    const node = state?.nodes.find(n => n.id === nodeId);
    if (!node?.ref_id || node.type !== 'entity') return;
    try {
      moveEntity(node.ref_id, workspaceId);
    } catch (e) {
      logger.error('Failed to move entity to workspace:', e);
    }
  }, [state?.nodes, moveEntity]);

  const handlePanelConnect = useCallback(async (fromId: string, toId: string) => {
    if (fromId === toId) return;
    if (hasEdgeBetween(state?.edges ?? [], fromId, toId)) return;
    const tempId = `temp-${fromId}-${toId}-${Date.now()}`;
    addLocalEdge({ id: tempId, from_node: fromId, to_node: toId, label: '' });
    try {
      await mutate({ action: 'connect', from: fromId, to: toId, label: '' }, { backgroundReload: true });
    } catch (e) {
      logger.error('Failed to create edge:', e);
      removeLocalEdge(tempId);
    }
  }, [state?.edges, mutate, addLocalEdge, removeLocalEdge]);

  const handleUpdateEdgeLabel = useCallback(async (edgeId: string, label: string) => {
    try {
      patchLocalEdge(edgeId, { label });
      await mutate({ action: 'update_edge', edge_id: edgeId, label }, { backgroundReload: true });
    } catch (e) {
      logger.error('Failed to update edge label:', e);
    }
  }, [mutate, patchLocalEdge]);

  const handleBreakEdge = useCallback(async (edgeId: string) => {
    try {
      removeLocalEdge(edgeId);
      await mutate({ action: 'disconnect', edge_id: edgeId }, { backgroundReload: true });
    } catch (e) {
      logger.error('Failed to disconnect edge:', e);
    }
  }, [mutate, removeLocalEdge]);

  const handleEdgeClick = useCallback((edgeId: string) => {
    const edge = state?.edges.find(e => e.id === edgeId);
    if (!edge) return;
    // Edge click → that edge blue + both endpoints blue-border (no dark fill).
    setPanelResumeNodeId(null);
    if (useStore.getState().splitViewRightId) {
      setColumnEntity('right', null);
    }
    setSelectedNodeIds(new Set([edge.from_node, edge.to_node]));
    setSelectedEdgeId(edgeId);
    setDetailsPanel({ focusedNodeId: edge.from_node, mode: 'connections', edgeId });
  }, [state?.edges, setColumnEntity]);

  const nodePositions = useMemo(() => {
    const map: Record<string, { x: number; y: number }> = {};
    for (let i = 0; i < activeNodes.length; i++) {
      map[activeNodes[i].id] = ensurePosition(activeNodes[i], i, positions);
    }
    return map;
  }, [activeNodes, positions]);

  // Which sides already have an edge — same box + closestSides as line geometry
  // so card dots mark the ports the paths actually use.
  // Also: sides on the far end of edges that touch a selected node (blue dots
  // on the unselected neighbor).
  const { connectedSidesByNode, highlightedSidesByNode } = useMemo(() => {
    const map: Record<string, ConnectorSide[]> = {};
    const hi: Record<string, ConnectorSide[]> = {};
    const add = (target: Record<string, ConnectorSide[]>, nodeId: string, side: ConnectorSide) => {
      const list = target[nodeId] ?? (target[nodeId] = []);
      if (!list.includes(side)) list.push(side);
    };
    if (!state) return { connectedSidesByNode: map, highlightedSidesByNode: hi };
    for (const edge of state.edges) {
      const fromPos = nodePositions[edge.from_node];
      const toPos = nodePositions[edge.to_node];
      if (!fromPos || !toPos) continue;
      const fromBox = {
        x: fromPos.x, y: fromPos.y, width: CARD_W,
        height: heights[edge.from_node] ?? CARD_H,
      };
      const toBox = {
        x: toPos.x, y: toPos.y, width: CARD_W,
        height: heights[edge.to_node] ?? CARD_H,
      };
      const [fromSide, toSide] = closestSides(fromBox, toBox);
      add(map, edge.from_node, fromSide);
      add(map, edge.to_node, toSide);
      const edgeSelected = selectedEdgeId
        ? edge.id === selectedEdgeId
        : (selectedNodeIds.has(edge.from_node) || selectedNodeIds.has(edge.to_node));
      if (edgeSelected) {
        // Far-end (and near-end) ports on a blue edge light up, even if the
        // neighbor itself is not in the selection.
        add(hi, edge.from_node, fromSide);
        add(hi, edge.to_node, toSide);
      }
    }
    return { connectedSidesByNode: map, highlightedSidesByNode: hi };
  }, [state, nodePositions, heights, selectedNodeIds, selectedEdgeId]);

  // Update position for a single node during drag — if it's part of a
  // multi-selection, fan the same delta out to every other selected node.
  const handlePositionChange = useCallback((nodeId: string, pos: { x: number; y: number }) => {
    setDraggingNodeId(nodeId);
    if (selectedNodeIds.has(nodeId) && selectedNodeIds.size > 1) {
      if (!groupDragOriginRef.current) {
        // Snapshot every selected node's position at the start of this drag
        // gesture so deltas compound off a fixed origin, not each other.
        const origin: Record<string, { x: number; y: number }> = {};
        for (const id of selectedNodeIds) origin[id] = nodePositions[id] ?? { x: 0, y: 0 };
        groupDragOriginRef.current = origin;
      }
      const origin = groupDragOriginRef.current;
      const dx = pos.x - origin[nodeId].x;
      const dy = pos.y - origin[nodeId].y;
      setPositions(prev => {
        const next = { ...prev };
        for (const id of selectedNodeIds) {
          next[id] = { x: origin[id].x + dx, y: origin[id].y + dy };
        }
        return next;
      });
    } else {
      setPositions(prev => ({ ...prev, [nodeId]: pos }));
    }
  }, [selectedNodeIds, nodePositions]);

  // Commit position to API (debounced — fires on pointer up)
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const commitOnePosition = useCallback((nodeId: string, pos: { x: number; y: number }) => {
    if (debounceTimers.current[nodeId]) clearTimeout(debounceTimers.current[nodeId]);
    debounceTimers.current[nodeId] = setTimeout(async () => {
      try {
        await mutate({ action: 'update_node', node_id: nodeId, updates: { position: pos } });
      } catch (e) {
        logger.error('Failed to save node position:', e);
      }
    }, 300);
  }, [mutate]);

  const handleCommit = useCallback((nodeId: string, pos: { x: number; y: number }) => {
    setDraggingNodeId(null);
    if (groupDragOriginRef.current && selectedNodeIds.has(nodeId)) {
      // Commit every selected node's final position, not just the one the
      // pointer was actually on.
      for (const id of selectedNodeIds) {
        const finalPos = positions[id];
        if (finalPos) commitOnePosition(id, finalPos);
      }
      groupDragOriginRef.current = null;
    } else {
      commitOnePosition(nodeId, pos);
    }
  }, [selectedNodeIds, positions, commitOnePosition]);

  const { onNodePointerDown } = useBrainDrag(viewport, {
    onPositionChange: handlePositionChange,
    onCommit: handleCommit,
  });

  // Tool modes
  const [connectMode, setConnectMode] = useState(false);
  const [connectSource, setConnectSource] = useState<string | null>(null);
  const [addExistingOpen, setAddExistingOpen] = useState(false);
  const [newNodeMode, setNewNodeMode] = useState(false);
  // Cursor position in canvas space, tracked only while the connect tool is
  // active. Passed to every card so a card can light up its nearest connector
  // dot as the cursor *approaches* it — including from outside the card, which
  // a card-local onMouseMove can't detect (it only fires over the card).
  const [connectCursor, setConnectCursor] = useState<{ x: number; y: number } | null>(null);

  const handleStartConnectFrom = useCallback((nodeId: string) => {
    setConnectMode(true);
    setNewNodeMode(false);
    setAddExistingOpen(false);
    setConnectSource(nodeId);
    setConnectCursor(null);
  }, []);
  const handleConnectMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setConnectCursor({
      x: (e.clientX - rect.left - viewport.x) / viewport.scale,
      y: (e.clientY - rect.top - viewport.y) / viewport.scale,
    });
  }, [viewport]);

  // Clear pending wire and leave connect tool (Esc / right-click).
  const resetConnectTool = useCallback(() => {
    setConnectSource(null);
    setConnectCursor(null);
    setConnectMode(false);
  }, []);

  // Connect tool: click a node to pick it as the source, click a second node
  // to connect them instantly (closest facing sides, no label required —
  // the connection alone tells the AI the nodes are related; see
  // brainCompiler's fallback line for unlabeled edges).
  const handleNodeConnectClick = useCallback(async (nodeId: string) => {
    if (!connectSource) {
      setConnectSource(nodeId);
      return;
    }
    if (connectSource === nodeId) {
      setConnectSource(null); // clicked the same node again — deselect
      return;
    }
    const from = connectSource;
    // One undirected link per pair — reconnecting must not stack lines.
    if (hasEdgeBetween(state?.edges ?? [], from, nodeId)) {
      setConnectSource(null);
      return;
    }
    setConnectSource(null);
    // Paint the line immediately with a temp id — don't wait on the POST
    // round-trip (SELECT + INSERT + revision log against Supabase, easily
    // half a second+). The backgrounded reload below replaces `edges`
    // wholesale with server truth once it resolves, so the temp id is only
    // ever visible for that one round trip and never persisted or duplicated.
    const tempId = `temp-${from}-${nodeId}-${Date.now()}`;
    addLocalEdge({ id: tempId, from_node: from, to_node: nodeId, label: '' });
    try {
      await mutate({ action: 'connect', from, to: nodeId, label: '' }, { backgroundReload: true });
    } catch (e) {
      logger.error('Failed to create edge:', e);
      removeLocalEdge(tempId);
    }
  }, [connectSource, state?.edges, mutate, addLocalEdge, removeLocalEdge]);

  // New node: click to place on the canvas
  const handleCanvasClick = useCallback(async (e: React.MouseEvent) => {
    // Space-pan must never place nodes or clear selection.
    if (spaceHeldRef.current || didPanRef.current) {
      didPanRef.current = false;
      return;
    }
    if (!newNodeMode) {
      // Plain click on empty canvas clears multi-selection and closes details.
      if (selectedNodeIds.size > 0) setSelectedNodeIds(new Set());
      if (selectedEdgeId) setSelectedEdgeId(null);
      if (detailsPanel) setDetailsPanel(null);
      return;
    }
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (e.clientX - rect.left - viewport.x) / viewport.scale;
    const y = (e.clientY - rect.top - viewport.y) / viewport.scale;

    setNewNodeMode(false);

    // Create a real note entity
    const entityId = addEntity({ type: 'note', title: 'New Note', content: [] });
    if (!entityId) return;

    // Open it immediately in the right column so the click feels instant —
    // don't wait on the brain-node round trip.
    openBrainNode(entityId);

    // addEntity's own Supabase write is debounced (see debouncedPushEntity),
    // so the entity may not exist server-side yet when add_node's
    // assertOwnedEntity check runs. Push it synchronously here first —
    // otherwise add_node 404s silently and the card never appears.
    const entity = useStore.getState().entities.find(en => en.id === entityId);
    if (entity) {
      const { upsertEntity } = await import('@/lib/sync');
      await upsertEntity(entity);
    }

    // Add it as a brain node
    try {
      await mutate({ action: 'add_node', type: 'entity', ref_id: entityId, position: { x, y } });
    } catch (e) {
      logger.error('Failed to add brain node:', e);
    }
  }, [newNodeMode, viewport, addEntity, mutate, openBrainNode, selectedNodeIds, selectedEdgeId, detailsPanel]);

  // Ref ids already on this brain — block duplicate cards of the same entity.
  const brainRefIds = useMemo(
    () => activeNodes.map(n => n.ref_id).filter((id): id is string => !!id),
    [activeNodes],
  );

  // Add existing entity as brain node
  const handleAddExisting = useCallback(async (refId: string, type: 'entity' | 'workspace') => {
    if (brainRefIds.includes(refId)) {
      logger.error('Failed to add existing entity:', 'This item is already in this brain.');
      return;
    }
    const x = 40 + (activeNodes.length % 5) * (CARD_W + 40);
    const y = 40 + Math.floor(activeNodes.length / 5) * (CARD_H + 40);
    try {
      await mutate({ action: 'add_node', type, ref_id: refId, position: { x, y } });
    } catch (e) {
      logger.error('Failed to add existing entity:', e);
    }
  }, [activeNodes.length, brainRefIds, mutate]);

  // Space / middle-click pan — always navigation, even over nodes and with
  // connect/new-node tools active. State (not only refs) so cursors re-render.
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0, vx: 0, vy: 0 });
  const spaceHeldRef = useRef(false);
  const didPanRef = useRef(false);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [isPanning, setIsPanning] = useState(false);

  useEffect(() => {
    const isTypingTarget = (t: EventTarget | null) => {
      if (!(t instanceof HTMLElement)) return false;
      const tag = t.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || t.isContentEditable;
    };
    /** Steal focus from sidebar/chrome so Space doesn't highlight/activate them. */
    const focusCanvas = () => {
      const canvas = containerRef.current;
      if (!canvas) return;
      const active = document.activeElement;
      if (active instanceof HTMLElement && active !== canvas && !canvas.contains(active)) {
        active.blur();
      }
      if (document.activeElement !== canvas) {
        canvas.focus({ preventScroll: true });
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      if (e.code === 'Escape' && (connectMode || connectSource)) {
        e.preventDefault();
        resetConnectTool();
        return;
      }
      if (e.code !== 'Space') return;
      // Prevent page scroll + button activation; keep held across key-repeat.
      e.preventDefault();
      focusCanvas();
      if (spaceHeldRef.current) return;
      spaceHeldRef.current = true;
      setSpaceHeld(true);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      // Stop focused <button>s from firing click on Space keyup.
      e.preventDefault();
      spaceHeldRef.current = false;
      setSpaceHeld(false);
    };
    const onBlur = () => {
      spaceHeldRef.current = false;
      setSpaceHeld(false);
      isPanningRef.current = false;
      setIsPanning(false);
    };
    window.addEventListener('keydown', onKeyDown, { passive: false });
    window.addEventListener('keyup', onKeyUp, { passive: false });
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [connectMode, connectSource, resetConnectTool]);

  const handleBgPointerDown = useCallback((e: React.PointerEvent) => {
    const t = e.target as HTMLElement;
    // Don't pan when interacting with floating chrome (toolbar, pickers, etc.).
    if (t.closest?.('.canvas-floating-panel')) return;

    // Own keyboard focus so the next Space doesn't target the sidebar.
    if (containerRef.current && document.activeElement !== containerRef.current) {
      const active = document.activeElement;
      if (active instanceof HTMLElement && !containerRef.current.contains(active)) {
        active.blur();
      }
      containerRef.current.focus({ preventScroll: true });
    }

    // Right-click cancels connect tool (pending wire + mode).
    if (e.button === 2 && (connectMode || connectSource)) {
      e.preventDefault();
      e.stopPropagation();
      resetConnectTool();
      return;
    }

    const onNode = !!t.closest?.('[data-brain-node]');
    // Middle-click: always pan.
    // Space+left: pan anywhere (including over nodes) — tools must not steal it.
    // Select tool (no connect / new-node): left-drag empty canvas pans; nodes stay draggable.
    const emptyCanvasPan =
      e.button === 0
      && !spaceHeldRef.current
      && !connectMode
      && !newNodeMode
      && !onNode;

    if (e.button === 1 || (e.button === 0 && spaceHeldRef.current) || emptyCanvasPan) {
      e.preventDefault();
      e.stopPropagation();
      isPanningRef.current = true;
      didPanRef.current = false;
      setIsPanning(true);
      panStartRef.current = { x: e.clientX, y: e.clientY, vx: viewport.x, vy: viewport.y };
    }
  }, [viewport, connectMode, newNodeMode, connectSource, resetConnectTool]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!isPanningRef.current) return;
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) didPanRef.current = true;
      setViewport(prev => ({
        ...prev,
        x: panStartRef.current.vx + dx,
        y: panStartRef.current.vy + dy,
      }));
    };
    const onUp = () => {
      isPanningRef.current = false;
      setIsPanning(false);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [setViewport]);

  // Default = system arrow. Hand only while actively panning or holding Space
  // (open hand). Connect stays crosshair for both pick steps — no alias cursor.
  const canvasCursor = isPanning
    ? 'cursor-grabbing'
    : spaceHeld
      ? 'cursor-grab'
      : (connectMode || newNodeMode)
        ? 'cursor-crosshair'
        : undefined;

  if (!state) {
    if (error) {
      return (
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          {`Error: ${error}`}
        </div>
      );
    }
    return (
      <div className="flex-1 h-full flex items-center justify-center bg-[var(--app-background)]">
        <div className="w-[200px] h-1.5 bg-[var(--bone-3)] rounded-full overflow-hidden">
          <div className="h-full bg-[var(--brand-blue)] rounded-full w-[70px] brain-loading-progress-bar" />
        </div>
        <style dangerouslySetInnerHTML={{
          __html: `
          .brain-loading-progress-bar {
            animation: brain-indeterminate 1.5s infinite ease-in-out;
          }
          @keyframes brain-indeterminate {
            0% { transform: translateX(-70px); }
            100% { transform: translateX(200px); }
          }
        `}} />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      className={cn(
        "relative flex-1 h-full overflow-hidden bg-[var(--app-background)] select-none outline-none",
        canvasCursor,
        // Force hand over nodes while space / pan (child cursor-* otherwise wins).
        spaceHeld && !isPanning && "[&_*]:!cursor-grab",
        isPanning && "[&_*]:!cursor-grabbing",
      )}
      data-bg="true"
      onPointerDown={handleBgPointerDown}
      onContextMenu={(e) => {
        // Suppress browser menu while connect tool is active; reset is handled
        // on pointerdown button===2 (works over nodes and empty canvas).
        if (connectMode || connectSource) {
          e.preventDefault();
        }
      }}
    >
      {/* ── Top-left: brain switcher + compact/expanded stats (left inset matches tab header) ── */}
      <div
        className="absolute top-4 z-20"
        style={{ left: headerContentLeft }}
      >
        <BrainLeftPanel
          brains={state.brains}
          selectedBrainId={selectedBrainId}
          onSelect={(id) => { setSelectedBrainId(id); setActiveBrainId(id); }}
          budget={{ used: state.budget.used, limit: state.budget.limit }}
          nodeCount={leftPanelNodes.length}
          edgeCount={state.edges.length}
          stats={usageStats}
          nodes={leftPanelNodes}
          perNodeTokens={state.perNodeTokens ?? {}}
          onRenameBrain={handleRenameBrain}
          onSetDefaultBrain={handleSetDefaultBrain}
          onSetBrainIcon={handleSetBrainIcon}
          onResetUsage={handleResetUsage}
        />
      </div>

      {/* ── Transformed layer (viewport) ── */}
      <div
        className="absolute inset-0"
        data-bg="true"
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`,
          transformOrigin: '0 0',
        }}
        onClick={handleCanvasClick}
        onMouseMove={connectMode ? handleConnectMouseMove : undefined}
        onMouseLeave={connectMode ? () => setConnectCursor(null) : undefined}
      >
        {/* Connections */}
        <BrainCanvasConnections
          nodes={activeNodes}
          edges={state.edges}
          positions={nodePositions}
          heights={heights}
          draggingNodeId={draggingNodeId}
          onEdgeClick={handleEdgeClick}
          selectedNodeIds={selectedNodeIds}
          selectedEdgeId={selectedEdgeId}
          pendingConnect={connectSource ? { sourceNodeId: connectSource, cursor: connectCursor } : null}
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
              onHeightChange={handleHeightChange}
              connectCursor={connectMode ? connectCursor : null}
              connectedSides={connectedSidesByNode[node.id]}
              highlightedConnectedSides={highlightedSidesByNode[node.id]}
              dragging={draggingNodeId === node.id}
              connectMode={connectMode}
              connectSelected={connectSource === node.id}
              multiSelected={selectedNodeIds.has(node.id) && !selectedEdgeId}
              edgeHighlight={!!selectedEdgeId && selectedNodeIds.has(node.id)}
              cursorClassName={
                spaceHeld || isPanning
                  ? undefined // parent forces grab via [&_*]
                  : connectMode
                    ? 'cursor-crosshair'
                    : undefined
              }
              onPointerDown={(e) => {
                // Space/middle-click = pan only (handled on container). Never drag nodes.
                if (spaceHeldRef.current || e.button === 1) return;
                if (!connectMode) onNodePointerDown(e, node.id, pos);
              }}
              onClick={(e) => {
                if (spaceHeldRef.current || didPanRef.current) {
                  didPanRef.current = false;
                  return;
                }
                if (connectMode) {
                  handleNodeConnectClick(node.id);
                  return;
                }
                if (handleNodeClick(node.id, e)) {
                  // Multi-select: keep accumulated set, focus last-clicked
                  openDetailsForNode(node.id, 'details', { replaceSelection: false });
                  return;
                }
                // Clicking the already-focused node again resets the selection
                // and closes the panel (toggle behavior).
                if (detailsPanel?.focusedNodeId === node.id) {
                  setDetailsPanel(null);
                  setSelectedNodeIds(new Set());
                  setSelectedEdgeId(null);
                  return;
                }
                // Single-click → details panel (no longer opens editor)
                openDetailsForNode(node.id, 'details', { replaceSelection: true });
              }}
              onContextMenu={connectMode ? undefined : (e) => {
                setNodeContextMenu({ nodeId: node.id, x: e.clientX, y: e.clientY });
              }}
            />
          );
        })}
      </div>

      {/* Right-click node menu */}
      {nodeContextMenu && (
        <>
          <div className="fixed inset-0 z-[299]" onClick={() => setNodeContextMenu(null)} onContextMenu={(e) => { e.preventDefault(); setNodeContextMenu(null); }} />
          <div
            className="fixed z-[300] popup-glass-small min-w-[180px] p-1 flex flex-col gap-[2px]"
            style={{ left: nodeContextMenu.x, top: nodeContextMenu.y }}
          >
            {(() => {
              const n = state.nodes.find(x => x.id === nodeContextMenu.nodeId);
              const canOpen = n?.type === 'entity' && !!n.ref_id;
              return (
                <>
                  {canOpen && (
                    <button
                      type="button"
                      onClick={() => {
                        const refId = n!.ref_id!;
                        setNodeContextMenu(null);
                        setPanelResumeNodeId(nodeContextMenu.nodeId);
                        setDetailsPanel(null);
                        openBrainNode(refId);
                      }}
                      className="popup-item w-full flex items-center gap-2 px-3 py-[4px] text-sm"
                    >
                      <FileText strokeWidth={2} className="w-4 h-4 shrink-0" />
                      <span className="flex-1 text-left font-medium tracking-wide">Open in editor</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDeleteNode(nodeContextMenu.nodeId)}
                    className="popup-item popup-item-danger w-full flex items-center gap-2 px-3 py-[4px] text-sm"
                  >
                    <Trash2 strokeWidth={2} className="w-4 h-4 shrink-0" />
                    <span className="flex-1 text-left font-medium tracking-wide">Delete</span>
                  </button>
                </>
              );
            })()}
          </div>
        </>
      )}

      {/* ── Right: details panel (mutually exclusive with editor column) ── */}
      {detailsPanel && !splitViewRightId && (
        <div className="absolute top-4 right-4 z-20">
          <BrainDetailsPanel
            mode={detailsPanel.mode}
            focusedNodeId={detailsPanel.focusedNodeId}
            pairEdge={detailsPanel.edgeId ? (state.edges.find(e => e.id === detailsPanel.edgeId) ?? null) : null}
            selectedNodeIds={Array.from(selectedNodeIds)}
            nodes={state.nodes}
            edges={state.edges}
            perNodeTokens={state.perNodeTokens ?? {}}
            perNodeCap={state.perNodeCap ?? 2000}
            getDisplay={getDetailsDisplay}
            workspaceOptions={workspaceOptions}
            onClose={() => setDetailsPanel(null)}
            onFocusNode={(id) => setDetailsPanel(prev => prev ? { ...prev, focusedNodeId: id, edgeId: undefined } : prev)}
            onOpenEditor={handlePanelOpenEditor}
            onSetMode={(m) => setDetailsPanel(prev => prev ? { ...prev, mode: m, edgeId: undefined } : prev)}
            onStartConnectFrom={handleStartConnectFrom}
            onConnect={handlePanelConnect}
            onUpdateEdgeLabel={handleUpdateEdgeLabel}
            onBreakEdge={handleBreakEdge}
            onUpdateTitle={handleUpdateTitle}
            onUpdatePriority={handleUpdatePriority}
            onMoveToWorkspace={handleMoveToWorkspace}
            knownTags={knownTags}
            onSetBrainOnly={handleSetBrainOnly}
            onUpdateTag={handleUpdateTag}
            onUpdateLifecycle={handleUpdateLifecycle}
            onEditWorkspaceDescription={handleEditWorkspaceDescription}
          />
        </div>
      )}

      {wsDescEdit && (
        <WorkspaceDescriptionPopup
          initialTitle={wsDescEdit.title}
          initialDescription={wsDescEdit.description}
          onSave={handleSaveWorkspaceDescription}
          onCancel={() => setWsDescEdit(null)}
        />
      )}

      {/* Resume details after editor open */}
      {panelResumeNodeId && splitViewRightId && !detailsPanel && (
        <button
          type="button"
          onClick={handleResumePanel}
          title="Back to details"
          className={cn(
            "absolute top-1/2 -translate-y-1/2 right-0 z-20",
            "h-12 w-8 rounded-l-[10px] bg-[var(--app-panel)] border border-r-0 border-[var(--bone-12)]",
            "flex items-center justify-center text-[var(--bone-50)] hover:text-[var(--bone-100)]",
            "shadow-[-4px_0_16px_rgba(0,0,0,0.2)]"
          )}
        >
          <PanelRightOpen className="w-4 h-4" strokeWidth={2} />
        </button>
      )}

      {/* ── Toolbar ── */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20">
        <div className="relative">
        <BrainToolbar
          connectMode={connectMode}
          onToggleConnect={() => { setConnectMode(true); setNewNodeMode(false); setAddExistingOpen(false); setConnectSource(null); }}
          onNewNode={() => { setNewNodeMode(true); setConnectMode(false); setAddExistingOpen(false); setConnectSource(null); }}
          newNodeActive={newNodeMode}
          addExistingOpen={addExistingOpen}
          onToggleAddExisting={() => setAddExistingOpen(!addExistingOpen)}
          onSelectTool={() => { setConnectMode(false); setNewNodeMode(false); setAddExistingOpen(false); setConnectSource(null); }}
        />
        {addExistingOpen && (
          <AddExistingEntityPopover
            onAddEntity={handleAddExisting}
            onClose={() => setAddExistingOpen(false)}
            excludeRefIds={brainRefIds}
          />
        )}
        </div>
      </div>

      {/* ── Zoom controls ── */}
      <BrainZoomControls
        viewportScale={viewport.scale}
        onZoomOut={() => setViewport(p => ({ ...p, scale: Math.max(MIN_ZOOM, p.scale - ZOOM_STEP) }))}
        onZoomReset={() => setViewport(p => ({ ...p, scale: 1.0 }))}
        onZoomIn={() => setViewport(p => ({ ...p, scale: Math.min(MAX_ZOOM, p.scale + ZOOM_STEP) }))}
      />
    </div>
  );
}
