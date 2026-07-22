"use client";

import { useState, useRef, useCallback, useMemo, useEffect, useLayoutEffect } from 'react';
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
import { BrainNodeSearchPopover, toSearchItems } from './BrainNodeSearchPopover';
import { logger } from '@/lib/logger';
import { formatAge } from '@/lib/brain/formatAge';
import { hasEdgeBetween } from '@/lib/bot/services/brainEdgeUtils';
import { closestSides, resolveEdgeSides, type ConnectorSide } from './connectorGeometry';
import { blocksToMarkdown } from '@/lib/editor/markdownBlocks';
import type { EditorBlock } from '@/data/store.types';
import { isDesktop } from '@/lib/env';
import { getEntityIcon } from '@/data/icons';
import { FileText, Folder, Brain, Trash2, PanelRightOpen } from 'lucide-react';
import { Tooltip } from '@/components/layout/Tooltip';

/** Survives BrainCanvasPage remount so edges keep last measured card heights
 *  instead of redrawing at CARD_H and sliding when ResizeObserver fires. */
const brainNodeHeightCache = new Map<string, number>();

/** Soft preview for cards/details: word-boundary truncate (CSS line-clamp does the rest).
 *  Cap is sized for the taller details clamp (~9 lines); cards still line-clamp-4. */
function previewSnippet(text: string, max = 480): string | undefined {
  const t = text.replace(/\s+/g, ' ').trim();
  if (!t) return undefined;
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const sp = cut.lastIndexOf(' ');
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut).trimEnd();
}

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
  entities: Array<{ id: string; type: string; title?: string; parentId?: string | null; lastModified?: number; content?: EditorBlock[]; icon?: string; brainOnly?: boolean }>,
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

  // A "memory" is either the retired brain_node type, or a regular note whose
  // entity has been flagged brain_only (§4C.2) — both read as Memory, not Note.
  const isMemory = node.type === 'memory' || (!!entity && entity.type === 'note' && entity.brainOnly === true);

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
    typeIcon: isMemory ? <Brain strokeWidth={2} /> : (entity ? (typeIcons[entity.type] ?? <FileText strokeWidth={2} />) : <Brain strokeWidth={2} />),
    typeLabel: isMemory ? 'Memory' : (entity ? typeLabels[entity.type] : 'Memory'),
    parentLabel: parentEntity?.title || (entity?.type === 'workspace' ? 'Workspace' : 'Unsorted'),
    ageLabel: entity?.lastModified ? formatAge(new Date(entity.lastModified).toISOString()) : formatAge(node.created_at),
    title: node.label || entity?.title || node.content?.slice(0, 60) || 'Untitled',
    preview: node.type === 'memory'
      ? (node.content ? previewSnippet(node.content) : undefined)
      : (entity?.type === 'note' && entity.content?.length
        ? previewSnippet(blocksToMarkdown(entity.content))
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
  // Match ColumnHeader / HeaderBar left inset for dashboard/tracker/chat/brain.
  const headerContentLeft = isDesktop() ? 30 : 20;

  // ── Brain data (fetched via hook, synced to store's activeBrainId) ──
  const { state, loading, error, selectedBrainId, setSelectedBrainId, load, mutate, addLocalEdge, removeLocalEdge, addLocalNode, removeLocalNode, renameLocalNode, patchLocalNode, patchLocalEdge } = useBrainData();
  // True only while the programmatic centering pan (editor-open) is animating.
  // User pan/zoom must stay instant, so this is cleared the moment a gesture
  // starts (see handleBgPointerDown + the wheel handler in useCanvasViewport).
  const [panAnimate, setPanAnimate] = useState(false);
  // Keyed off state.brainId (not selectedBrainId — null during the remount's
  // load window) so viewport survives the editor-open remount, same as the
  // node-position store slice.
  const { viewport, setViewport, viewportRef } = useCanvasViewport(
    containerRef,
    state?.brainId ?? null,
    () => setPanAnimate(false), // ctrl/cmd+wheel zoom cancels the pan animation
  );
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
  const setBrainNodePosition = useStore(s => s.setBrainNodePosition);

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

  // Optimistic node positions (working copy for live drag). Seeded from the
  // store so it survives BrainCanvasPage remounting — closing the split-view
  // editor column collapses two columns to one, which swaps the canvas into a
  // different JSX subtree and unmounts/remounts it. A plain useState({}) here
  // would reset to empty on that remount, and moved nodes would fall back
  // through ensurePosition to their stale cached node.position (visible snap
  // to the pre-drag spot) until the next reconcile refilled them ~2s later.
  //
  // Keyed off state.brainId, NOT selectedBrainId: on a fresh remount
  // selectedBrainId is null (useBrainData starts at null and only sets it
  // after the ~2s load resolves), whereas state.brainId is already populated
  // via the persisted-cache fallback — so seeding hits the store immediately
  // with no null gap that would reopen the snapback.
  const seedBrainId = state?.brainId ?? null;
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>(
    () => (seedBrainId ? useStore.getState().brainNodePositionsByBrain[seedBrainId] ?? {} : {}),
  );
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);

  // On brain switch (or when brainId first resolves), re-seed the working copy
  // from that brain's committed positions in the store. Was previously
  // `setPositions({})`, which threw away committed positions — safe only
  // because they were re-fetched, but that re-fetch is exactly the ~2s
  // snapback window this fix closes.
  useEffect(() => {
    setPositions(seedBrainId ? useStore.getState().brainNodePositionsByBrain[seedBrainId] ?? {} : {});
  }, [seedBrainId]);

  // Cards are content-sized; edges need real heights. Module cache survives
  // remount (leave/reopen Brain) so lines don't redraw at CARD_H then jump.
  const [heights, setHeights] = useState<Record<string, number>>(() => {
    const seed: Record<string, number> = {};
    brainNodeHeightCache.forEach((h, id) => { seed[id] = h; });
    return seed;
  });
  const handleHeightChange = useCallback((nodeId: string, height: number) => {
    brainNodeHeightCache.set(nodeId, height);
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
        // Permanent + confirmed — rare, and the entity itself is being
        // deleted, not just the brain card. Blocking is fine here.
        if (!confirm('This memory is only in your brain — deleting it is permanent.')) return;
        await mutate({
          action: 'delete_memory_node',
          node_id: nodeId,
          entity_id: node.ref_id,
        });
      } else {
        // Optimistic: remove from the canvas immediately instead of waiting
        // on the round trip + a full compile. Restore via a real reload if
        // the delete actually fails server-side.
        removeLocalNode(nodeId);
        try {
          await mutate({ action: 'remove_node', node_id: nodeId }, { backgroundReload: true });
        } catch (e) {
          await load(selectedBrainId);
          throw e;
        }
      }
      setDetailsPanel(prev => (prev?.focusedNodeId === nodeId ? null : prev));
    } catch (e) {
      logger.error('Failed to delete brain node:', e);
    }
  }, [mutate, state?.nodes, entities, removeLocalNode, load, selectedBrainId]);

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
      // Per-node usage bar (share of the per-node cap) — always set so the
      // bar is visible in every mode (incl. lifetime / not-yet-compiled).
      const cap = state.perNodeCap ?? 2000;
      const tok = (state.perNodeTokens ?? {})[node.id] ?? 0;
      info.usageFraction = cap > 0 ? tok / cap : 0;
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
      // Local + cloud entity update (standalone helper — safe if store action missing after HMR)
      const { applyWorkspaceDescription } = await import('@/data/workspaceDescription');
      applyWorkspaceDescription(
        () => useStore.getState().entities,
        (mapEntity, mapSpace) => {
          useStore.setState(s => ({
            entities: s.entities.map(mapEntity),
            spaces: s.spaces.map(mapSpace),
            editingEntity: null,
          }));
        },
        wsDescEdit.entityId,
        title,
        description
      );
      // Server brain API path (owner-checked) when available
      try {
        await mutate({
          action: 'set_workspace_description',
          entity_id: wsDescEdit.entityId,
          title,
          description,
        });
      } catch {
        // Non-fatal if brain API unavailable — store push still persists
      }
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

  // When a node opens into the right editor column (splitViewRightId set), pan
  // the canvas so that node is centered in the now-narrower left column —
  // without changing zoom. Runs in a layout effect after the column has
  // reflowed, so the container width we measure is the post-open (narrow) one
  // (SplitViewLayout doesn't width-transition the open, so the rect is final).
  // Fires on open and when switching which node is open. Not on close.
  useLayoutEffect(() => {
    if (!splitViewRightId) return;
    const container = containerRef.current;
    if (!container) return;
    const node = activeNodes.find(n => n.ref_id === splitViewRightId);
    if (!node) return;
    const pos = nodePositions[node.id];
    if (!pos) return;
    const rect = container.getBoundingClientRect();
    const cx = pos.x + CARD_W / 2;
    const cy = pos.y + (heights[node.id] ?? CARD_H) / 2;
    // Two-frame split so the pan actually animates: enable the CSS transition
    // in THIS layout effect (paints the old transform with transition on),
    // then change the viewport in the next frame so the browser has a prior
    // painted value to interpolate from. Setting both in one commit would
    // snap (no old frame to tween).
    setPanAnimate(true);
    const raf = requestAnimationFrame(() => {
      setViewport(v => ({ ...v, x: rect.width / 2 - cx * v.scale, y: rect.height / 2 - cy * v.scale }));
    });
    return () => cancelAnimationFrame(raf);
    // nodePositions/heights intentionally omitted: we want this to fire on the
    // open transition (splitViewRightId) and node switch, not on every drag or
    // height re-measure, which would fight the user's manual panning.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [splitViewRightId]);

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
      const [fromSide, toSide] = resolveEdgeSides(fromBox, toBox, edge.from_side, edge.to_side);
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

  // Commit position to API (debounced — fires on pointer up). A node still
  // carrying its creation temp id (add_node hasn't resolved yet) can't be
  // committed — the server has never heard of that id and rejects it
  // outright (Postgres uuid parse error), so the drag would silently fail to
  // persist and the position would snap back on the next reconcile. Buffer
  // it instead; flushPendingTempPosition sends it once the real id exists.
  // This can't be fixed by racing the debounce against the add_node
  // round-trip (rekeying an already-fired timer) — the debounce routinely
  // wins that race, so the doomed request is already in flight before a
  // rename could ever intervene.
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const pendingTempPos = useRef<Record<string, { x: number; y: number }>>({});
  const commitOnePosition = useCallback((nodeId: string, pos: { x: number; y: number }) => {
    if (nodeId.startsWith('temp-node-')) {
      pendingTempPos.current[nodeId] = pos;
      return;
    }
    // Mirror into the store immediately (not in the debounced timeout) so the
    // committed position survives a remount that happens before the debounce
    // fires — e.g. moving a node then closing the split-view editor column.
    if (selectedBrainId) setBrainNodePosition(selectedBrainId, nodeId, pos);
    if (debounceTimers.current[nodeId]) clearTimeout(debounceTimers.current[nodeId]);
    debounceTimers.current[nodeId] = setTimeout(async () => {
      delete debounceTimers.current[nodeId];
      try {
        await mutate({ action: 'update_node', node_id: nodeId, updates: { position: pos } });
      } catch (e) {
        logger.error('Failed to save node position:', e);
      }
    }, 300);
  }, [mutate, selectedBrainId, setBrainNodePosition]);

  // Send a temp-id node's buffered drag position (if any) under its real id
  // once add_node resolves and the id is known.
  const flushPendingTempPosition = useCallback((tempId: string, realId: string) => {
    const pos = pendingTempPos.current[tempId];
    delete pendingTempPos.current[tempId];
    if (pos) commitOnePosition(realId, pos);
  }, [commitOnePosition]);

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

  const { onNodePointerDown, consumeDidDrag } = useBrainDrag(viewport, {
    onPositionChange: handlePositionChange,
    onCommit: handleCommit,
  });

  // Tool modes
  const [connectMode, setConnectMode] = useState(false);
  const [connectSource, setConnectSource] = useState<string | null>(null);
  /** Pinned source port when first click was on a specific dot; null = auto. */
  const [connectSourceSide, setConnectSourceSide] = useState<ConnectorSide | null>(null);
  const [addExistingOpen, setAddExistingOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
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
    setSearchOpen(false);
    setConnectSource(nodeId);
    setConnectSourceSide(null);
    setConnectCursor(null);
  }, []);

  /** Select a node from search: pan it into view and open the details panel. */
  const handleSearchSelectNode = useCallback((nodeId: string) => {
    const pos = nodePositions[nodeId] ?? positions[nodeId];
    const container = containerRef.current;
    if (pos && container) {
      const rect = container.getBoundingClientRect();
      const h = heights[nodeId] ?? CARD_H;
      const cx = pos.x + CARD_W / 2;
      const cy = pos.y + h / 2;
      setViewport(v => ({
        ...v,
        x: rect.width / 2 - cx * v.scale,
        y: rect.height / 2 - cy * v.scale,
      }));
    }
    openDetailsForNode(nodeId, 'details', { replaceSelection: true });
    setSearchOpen(false);
    setConnectMode(false);
    setNewNodeMode(false);
    setAddExistingOpen(false);
    setConnectSource(null);
    setConnectSourceSide(null);
  }, [nodePositions, positions, heights, setViewport, openDetailsForNode]);

  const searchItems = useMemo(
    () => toSearchItems(activeNodes, nodeInfos),
    [activeNodes, nodeInfos],
  );
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
    setConnectSourceSide(null);
    setConnectCursor(null);
    setConnectMode(false);
  }, []);

  // Connect tool: click a node (or a specific port) to pick source, click a
  // second node/port to connect. Port click pins that side; body click = auto
  // closestSides (null side). Sides persist on the edge when set.
  const handleNodeConnectClick = useCallback(async (
    nodeId: string,
    side: ConnectorSide | null = null,
  ) => {
    if (!connectSource) {
      setConnectSource(nodeId);
      setConnectSourceSide(side);
      return;
    }
    if (connectSource === nodeId) {
      // Same node again — deselect pending wire.
      setConnectSource(null);
      setConnectSourceSide(null);
      return;
    }
    const from = connectSource;
    const from_side = connectSourceSide;
    const to_side = side;
    // One undirected link per pair — reconnecting must not stack lines.
    if (hasEdgeBetween(state?.edges ?? [], from, nodeId)) {
      setConnectSource(null);
      setConnectSourceSide(null);
      return;
    }
    setConnectSource(null);
    setConnectSourceSide(null);
    // Paint the line immediately with a temp id — don't wait on the POST
    // round-trip (SELECT + INSERT + revision log against Supabase, easily
    // half a second+). The backgrounded reload below replaces `edges`
    // wholesale with server truth once it resolves, so the temp id is only
    // ever visible for that one round trip and never persisted or duplicated.
    const tempId = `temp-${from}-${nodeId}-${Date.now()}`;
    addLocalEdge({
      id: tempId,
      from_node: from,
      to_node: nodeId,
      label: '',
      from_side,
      to_side,
    });
    try {
      await mutate({
        action: 'connect',
        from,
        to: nodeId,
        label: '',
        from_side,
        to_side,
      }, { backgroundReload: true });
    } catch (e) {
      logger.error('Failed to create edge:', e);
      removeLocalEdge(tempId);
    }
  }, [connectSource, connectSourceSide, state?.edges, mutate, addLocalEdge, removeLocalEdge]);

  // New node: click to place on the canvas
  const handleCanvasClick = useCallback(async (e: React.MouseEvent) => {
    // This handler is on the full-size container, so it also receives events
    // that bubble up from children. Ignore clicks on a node card (handled by
    // the card's own onClick) and on floating chrome (toolbar, pickers, left
    // panel, details panel) so they don't place a node behind a panel or clear
    // selection. Background clicks fall through.
    const tgt = e.target as HTMLElement;
    if (tgt.closest?.('[data-brain-node]')) return;
    if (tgt.closest?.('.canvas-floating-panel')) return;
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
    // Center the card on the click point (place its top-left half a card up and
    // left), so the node appears under the cursor rather than starting there.
    // Height is content-driven; CARD_H is the pre-measurement fallback, so
    // vertical centering is approximate — close enough on create.
    const x = (e.clientX - rect.left - viewport.x) / viewport.scale - CARD_W / 2;
    const y = (e.clientY - rect.top - viewport.y) / viewport.scale - CARD_H / 2;

    setNewNodeMode(false);

    // Create a real note entity
    const entityId = addEntity({ type: 'note', title: 'New Note', content: [] });
    if (!entityId) return;

    // Paint the card FIRST, with a temp id (same pattern as addLocalEdge), so
    // placing a new block feels instant. Previously this came after an awaited
    // upsertEntity round trip, so the card didn't appear until that write
    // returned — the "wait, then the card shows up already delayed" lag.
    // Added BEFORE openBrainNode so the temp node is already in canvas state
    // when opening the editor column remounts the canvas and its centering
    // layout effect runs — otherwise the effect can't find the node to center.
    const tempId = `temp-node-${Date.now()}`;
    const nowIso = new Date().toISOString();
    addLocalNode({
      id: tempId, type: 'entity', ref_id: entityId, position: { x, y },
      content: null, label: null, section_id: null,
      priority: 0, pinned: false, enabled: true,
      created_by: 'user', created_at: nowIso, updated_at: nowIso,
      tag_color: null, tag_name: null, active_from: null, active_until: null,
    });

    // Open it immediately in the right column so the click feels instant —
    // don't wait on the brain-node round trip.
    openBrainNode(entityId);
    try {
      // addEntity's own Supabase write is debounced (see debouncedPushEntity),
      // so the entity may not exist server-side yet when add_node's
      // assertOwnedEntity check runs. Push it synchronously first — otherwise
      // add_node 404s silently. This still gates the POST, but no longer gates
      // the optimistic paint above.
      const entity = useStore.getState().entities.find(en => en.id === entityId);
      if (entity) {
        const { upsertEntity } = await import('@/lib/sync');
        await upsertEntity(entity);
      }
      const result = await mutate(
        { action: 'add_node', type: 'entity', ref_id: entityId, position: { x, y } },
        { backgroundReload: true },
      );
      // Swap the temp id for the server's real id now, in the same tick as
      // the drag position remap below — otherwise the background reconcile
      // lands with the real id, finds no `positions[realId]` entry (the
      // drag, if any, was recorded under tempId), and falls back to this
      // stale pre-drag position, snapping the card back.
      if (result?.id) {
        renameLocalNode(tempId, result.id);
        setPositions(prev => {
          if (!(tempId in prev)) return prev;
          const { [tempId]: pos, ...rest } = prev;
          return { ...rest, [result.id]: pos };
        });
        flushPendingTempPosition(tempId, result.id);
      }
    } catch (e) {
      removeLocalNode(tempId);
      logger.error('Failed to add brain node:', e);
    }
  }, [newNodeMode, viewport, addEntity, mutate, openBrainNode, selectedNodeIds, selectedEdgeId, detailsPanel, addLocalNode, removeLocalNode, renameLocalNode, flushPendingTempPosition]);

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
    const tempId = `temp-node-${Date.now()}`;
    const nowIso = new Date().toISOString();
    addLocalNode({
      id: tempId, type, ref_id: refId, position: { x, y },
      content: null, label: null, section_id: null,
      priority: 0, pinned: false, enabled: true,
      created_by: 'user', created_at: nowIso, updated_at: nowIso,
      tag_color: null, tag_name: null, active_from: null, active_until: null,
    });
    try {
      const result = await mutate({ action: 'add_node', type, ref_id: refId, position: { x, y } }, { backgroundReload: true });
      if (result?.id) {
        renameLocalNode(tempId, result.id);
        setPositions(prev => {
          if (!(tempId in prev)) return prev;
          const { [tempId]: pos, ...rest } = prev;
          return { ...rest, [result.id]: pos };
        });
        flushPendingTempPosition(tempId, result.id);
      }
    } catch (e) {
      removeLocalNode(tempId);
      logger.error('Failed to add existing entity:', e);
    }
  }, [activeNodes.length, brainRefIds, mutate, addLocalNode, removeLocalNode, renameLocalNode, flushPendingTempPosition]);

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
      if (tag === 'INPUT' || tag === 'TEXTAREA' || t.isContentEditable) return true;
      // Modals portaled outside the canvas (workspace description, etc.)
      if (t.closest?.('.canvas-floating-panel')) return true;
      return false;
    };
    /** Steal focus from sidebar/chrome so Space doesn't highlight/activate them. */
    const focusCanvas = () => {
      const canvas = containerRef.current;
      if (!canvas) return;
      const active = document.activeElement;
      if (active instanceof HTMLElement && isTypingTarget(active)) return;
      if (active instanceof HTMLElement && active !== canvas && !canvas.contains(active)) {
        active.blur();
      }
      if (document.activeElement !== canvas) {
        canvas.focus({ preventScroll: true });
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || wsDescEdit) return;
      if (e.code === 'Escape' && (connectMode || connectSource)) {
        e.preventDefault();
        resetConnectTool();
        return;
      }
      if (e.code === 'Escape' && searchOpen) {
        e.preventDefault();
        setSearchOpen(false);
        return;
      }
      // / opens node search (Shift+/ is ?, so only plain Slash).
      if (e.code === 'Slash' && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        setSearchOpen(true);
        setConnectMode(false);
        setNewNodeMode(false);
        setAddExistingOpen(false);
        setConnectSource(null);
        setConnectSourceSide(null);
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
      if (isTypingTarget(e.target) || wsDescEdit) return;
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
  }, [connectMode, connectSource, resetConnectTool, searchOpen, wsDescEdit]);

  const handleBgPointerDown = useCallback((e: React.PointerEvent) => {
    // Any user gesture cancels the centering-pan animation so pan/zoom is
    // instant — and covers the edge case where the pan target equaled the
    // current position, so no transitionend ever fired to clear the flag.
    setPanAnimate(false);
    const t = e.target as HTMLElement;
    // Don't pan when interacting with floating chrome (toolbar, pickers, etc.).
    if (t.closest?.('.canvas-floating-panel')) return;
    if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) return;

    // Own keyboard focus so the next Space doesn't target the sidebar.
    if (containerRef.current && document.activeElement !== containerRef.current) {
      const active = document.activeElement;
      if (active instanceof HTMLElement && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable || active.closest?.('.canvas-floating-panel'))) {
        return;
      }
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
      // Click-to-place lives on the full-size container, NOT the transformed
      // layer: with pan/zoom the transformed layer shifts/scales partly out of
      // the viewport, leaving dead zones where a click landed on the container
      // (which had no onClick) and silently did nothing. The handler derives
      // canvas coords from containerRef's rect + viewport, so it's correct here.
      onClick={handleCanvasClick}
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
          // Only the programmatic centering pan animates; user pan/zoom clear
          // panAnimate on gesture-start so they stay instant. Custom
          // deceleration curve (quick start, long soft settle) reads as a
          // deliberate glide rather than a linear/mechanical ease-out.
          transition: panAnimate ? 'transform 450ms cubic-bezier(0.16, 1, 0.3, 1)' : undefined,
        }}
        onTransitionEnd={() => setPanAnimate(false)}
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
          pendingConnect={connectSource ? {
            sourceNodeId: connectSource,
            sourceSide: connectSourceSide,
            cursor: connectCursor,
          } : null}
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
              initialHeight={heights[node.id]}
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
              onConnectPort={(side) => {
                if (spaceHeldRef.current || didPanRef.current) {
                  didPanRef.current = false;
                  return;
                }
                if (connectMode) handleNodeConnectClick(node.id, side);
              }}
              onClick={(e) => {
                if (spaceHeldRef.current || didPanRef.current) {
                  didPanRef.current = false;
                  return;
                }
                // A drop just happened on this node — swallow the click so it
                // doesn't also toggle the details panel / re-select.
                if (consumeDidDrag()) return;
                if (connectMode) {
                  // Card body (not a specific port) → auto sides.
                  handleNodeConnectClick(node.id, null);
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
                // Editor already open: switch it to this node (instead of the
                // details panel) and let the centering effect pan/animate to
                // it — matches "browsing" intent once you're already editing.
                // Falls through to the details panel for nodes with no linked
                // entity (e.g. sections), which can't be opened in the editor.
                if (splitViewRightId && node.ref_id) {
                  setSelectedNodeIds(new Set([node.id]));
                  openBrainNode(node.ref_id);
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
            className="fixed z-[300] popup-glass-small min-w-[180px] flex flex-col gap-[2px]"
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
                      <FileText strokeWidth={2} className="w-4 h-4 shrink-0 text-[var(--bone-100)]" />
                      <span className="flex-1 text-left font-medium tracking-wide">Open in editor</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDeleteNode(nodeContextMenu.nodeId)}
                    className="popup-item w-full flex items-center gap-2 px-3 py-[4px] text-sm !text-danger hover:!bg-danger/10"
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
        <Tooltip content="Back to details" position="left">
          <button
            type="button"
            onClick={handleResumePanel}
            className={cn(
              "absolute top-1/2 -translate-y-1/2 right-0 z-20",
              "h-12 w-8 rounded-l-[10px] bg-[var(--app-panel)] border border-r-0 border-[var(--bone-12)]",
              "flex items-center justify-center text-[var(--bone-100)] opacity-50 hover:opacity-100",
              "shadow-[-4px_0_16px_rgba(0,0,0,0.2)]"
            )}
          >
            <PanelRightOpen className="w-4 h-4" strokeWidth={2} />
          </button>
        </Tooltip>
      )}

      {/* ── Toolbar ── */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20">
        <div className="relative">
        <BrainToolbar
          connectMode={connectMode}
          onToggleConnect={() => {
            setConnectMode(true);
            setNewNodeMode(false);
            setAddExistingOpen(false);
            setSearchOpen(false);
            setConnectSource(null);
            setConnectSourceSide(null);
          }}
          onNewNode={() => {
            setNewNodeMode(true);
            setConnectMode(false);
            setAddExistingOpen(false);
            setSearchOpen(false);
            setConnectSource(null);
            setConnectSourceSide(null);
          }}
          newNodeActive={newNodeMode}
          addExistingOpen={addExistingOpen}
          onToggleAddExisting={() => {
            setAddExistingOpen(v => !v);
            setSearchOpen(false);
            setConnectMode(false);
            setNewNodeMode(false);
            setConnectSource(null);
            setConnectSourceSide(null);
          }}
          searchOpen={searchOpen}
          onToggleSearch={() => {
            setSearchOpen(v => !v);
            setAddExistingOpen(false);
            setConnectMode(false);
            setNewNodeMode(false);
            setConnectSource(null);
            setConnectSourceSide(null);
          }}
          onSelectTool={() => {
            setConnectMode(false);
            setNewNodeMode(false);
            setAddExistingOpen(false);
            setSearchOpen(false);
            setConnectSource(null);
            setConnectSourceSide(null);
          }}
        />
        {searchOpen && (
          <BrainNodeSearchPopover
            nodes={searchItems}
            onSelect={handleSearchSelectNode}
            onClose={() => setSearchOpen(false)}
          />
        )}
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
