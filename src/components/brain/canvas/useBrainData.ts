"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, isSupabaseEnabled } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { useStore } from '@/data/store';

// ---- Types matching the route response ----
export interface BrainCanvasNode {
  id: string;
  type: 'workspace' | 'entity' | 'memory' | 'section';
  ref_id: string | null;
  content: string | null;
  label: string | null;
  section_id: string | null;
  priority: number;
  pinned: boolean;
  enabled: boolean;
  position: { x: number; y: number } | null;
  created_by: 'user' | 'bot';
  created_at: string;
  updated_at: string;
  tag_color?: string | null;
  tag_name?: string | null;
  active_from?: string | null;
  active_until?: string | null;
}

export type BrainConnectorSide = 'top' | 'right' | 'bottom' | 'left';

export interface BrainCanvasEdge {
  id: string;
  from_node: string;
  to_node: string;
  label: string;
  /** Pinned port; null/undefined = auto closestSides at render time. */
  from_side?: BrainConnectorSide | null;
  to_side?: BrainConnectorSide | null;
}

interface BrainMeta {
  id: string;
  title: string;
  description: string | null;
  is_default: boolean;
  icon?: string | null;
}

export interface BrainCanvasState {
  brainId: string;
  nodes: BrainCanvasNode[];
  edges: BrainCanvasEdge[];
  compiledPreview: string;
  deletedNodes: BrainCanvasNode[];
  availableWorkspaces: { id: string; title: string }[];
  budget: { used: number; limit: number; dropped: string[]; broken: string[] };
  brains: BrainMeta[];
  perNodeTokens: Record<string, number>;
  perNodeCap: number;
  expiredNodeIds?: string[];
}

export async function authHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (isSupabaseEnabled) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
  }
  return headers;
}

export function useBrainData() {
  // Cached in the Zustand store (persisted to localStorage), keyed by brain
  // id, so switching to a brain already visited this session (or a previous
  // one) is instant instead of showing the old brain's stale canvas for a
  // beat while the new one fetches. A brain that has never been cached still
  // correctly falls through to `state === null`, which is what makes the
  // canvas's existing full-page loader (gated on `!state`) fire — so a
  // genuinely first-time visit to a brain still shows a brief loader, it's
  // only repeat visits that become instant. Same "sync persist = hydrated on
  // frame 1" pattern documented in docs/superpowers/LOADING-ARCHITECTURE.md.
  //
  // Deliberately NOT caching every brain eagerly: a user can have any number
  // of brains, so eagerly fetching/caching all of them is unbounded. Only
  // brains actually opened get cached, which bounds this by usage, not by
  // total brain count.
  const brainCacheByBrain = useStore(s => s.brainCanvasStateByBrain) as Record<string, BrainCanvasState>;
  const setBrainCacheForBrain = useStore(s => s.setBrainCanvasStateForBrain);
  const [selectedBrainId, setSelectedBrainId] = useState<string | null>(null);

  const state: BrainCanvasState | null = selectedBrainId
    ? (brainCacheByBrain[selectedBrainId] ?? null)
    // No brain selected yet (very first mount, before the initial load's
    // response tells us the default brain's id) — fall back to whichever
    // cached brain was active last session, so a returning user still gets
    // an instant first paint instead of a loader while we find out which
    // brain is the default.
    : (Object.values(brainCacheByBrain)[0] ?? null);

  const setState = useCallback((brainId: string, next: BrainCanvasState) => {
    setBrainCacheForBrain(brainId, next);
  }, [setBrainCacheForBrain]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Requests can resolve out of order (e.g. switching brains fires a new
  // fetch before the previous one settles) — without this guard, an older
  // response can land after a newer one and flip selectedBrainId back,
  // which re-triggers the load effect below and creates a back-and-forth
  // oscillation between brains. Only the most recently issued request is
  // allowed to write state.
  const requestIdRef = useRef(0);

  // Bumped by every optimistic local edit (patchLocalNode/Edge, addLocalEdge,
  // addLocalNode, removeLocalNode...). A silent reload started before a later
  // local edit must not overwrite that edit when it lands — see the guard in
  // `load` below.
  const localEditSeq = useRef(0);

  const load = useCallback(async (brainId?: string | null, opts?: { silent?: boolean }) => {
    const reqId = ++requestIdRef.current;
    const editSeqAtStart = localEditSeq.current;
    logger.info(`[brain-perf-client] load START reqId=${reqId} brainId=${brainId} silent=${!!opts?.silent} editSeq=${editSeqAtStart}`);
    // A silent reload must NOT flip the global loading flag: the page swaps the
    // whole canvas for a progress bar while it's true, which would blow away
    // the optimistic update we just applied and make every edit feel like a
    // multi-second round trip.
    if (!opts?.silent) setLoading(true);
    try {
      const qs = brainId ? `?brain_id=${brainId}` : '';
      const res = await fetch(`/api/ai/user-brain${qs}`, { headers: await authHeaders() });
      if (reqId !== requestIdRef.current) {
        logger.info(`[brain-perf-client] load STALE (superseded) reqId=${reqId}`);
        return; // a newer request superseded this one
      }
      if (res.ok) {
        const data = await res.json();
        if (reqId !== requestIdRef.current) {
          logger.info(`[brain-perf-client] load STALE-after-json reqId=${reqId}`);
          return;
        }
        logger.info(`[brain-perf-client] load LANDING reqId=${reqId} silent=${!!opts?.silent} nodeCount=${data.nodes?.length} editSeqNow=${localEditSeq.current} editSeqAtStart=${editSeqAtStart}`);
        // A newer local edit landed while this silent reload was in flight —
        // applying this response now would revert that edit for a frame.
        // The next scheduled reconcile (fired by that edit) will catch up.
        if (opts?.silent && localEditSeq.current !== editSeqAtStart) {
          logger.info(`[brain-perf-client] load SKIPPED (clobber guard) reqId=${reqId}`);
          return;
        }
        // data.brainId is the server's authoritative id for the brain this
        // response describes — correct even on the very first load (called
        // with no brainId arg), unlike the `brainId` param above which may
        // be undefined in that case.
        // perNodeCap defaults to pro tier (2000) so a stale cached/server
        // response missing the field never divides by zero in token UI.
        if (data.brainId) setState(data.brainId, { ...data, perNodeCap: data.perNodeCap ?? 2000 });
        setError(null);
        // Only adopt the server's brainId when we didn't already know which
        // brain we wanted (initial load) — otherwise this would keep
        // re-confirming the brainId we just requested, which is harmless on
        // its own but unnecessary churn now that stale responses are guarded.
        if (!brainId && data.brainId) setSelectedBrainId(data.brainId);
      } else {
        const body = await res.json().catch(() => ({}));
        if (reqId !== requestIdRef.current) return;
        setError(body?.error || `Failed to load brain (${res.status})`);
      }
    } catch (e: any) {
      if (reqId !== requestIdRef.current) return;
      setError(e?.message || 'Failed to load brain data');
      logger.error('useBrainData load failed:', e);
    } finally {
      if (reqId === requestIdRef.current && !opts?.silent) setLoading(false);
    }
  }, []);

  useEffect(() => { load(selectedBrainId); }, [load, selectedBrainId]);

  // Coalesce background reconciles: rapid edits (e.g. typing in the tag name
  // field, which autosaves per keystroke) would otherwise fire one ~1.5s
  // silent GET per edit, each overwriting state as it lands — visible as lag
  // even though each edit is itself optimistic. Collapse them into a single
  // trailing reconcile after edits settle.
  const reconcileTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleReconcile = useCallback((brainId: string | null) => {
    const wasPending = !!reconcileTimer.current;
    if (reconcileTimer.current) clearTimeout(reconcileTimer.current);
    logger.info(`[brain-perf-client] scheduleReconcile brainId=${brainId} clearedExisting=${wasPending}`);
    reconcileTimer.current = setTimeout(() => {
      reconcileTimer.current = null;
      logger.info(`[brain-perf-client] scheduleReconcile FIRING brainId=${brainId}`);
      void load(brainId, { silent: true });
    }, 600);
  }, [load]);

  useEffect(() => () => {
    if (reconcileTimer.current) clearTimeout(reconcileTimer.current);
  }, []);

  // Append an edge to local state immediately — call BEFORE the connect POST
  // even starts, with a temp id, so the line paints on click instead of
  // waiting on the request round-trip. A background reload (mutate's
  // backgroundReload option) replaces `edges` wholesale with server truth
  // once it resolves, so the temp id is only ever visible for that one
  // round trip and never persisted or duplicated.
  const addLocalEdge = useCallback((edge: BrainCanvasEdge) => {
    if (!state || !selectedBrainId) return;
    setState(selectedBrainId, { ...state, edges: [...state.edges, edge] });
    localEditSeq.current++;
  }, [setState, state, selectedBrainId]);

  // Remove a locally-added edge (e.g. the temp one from addLocalEdge) if its
  // POST ends up failing — otherwise a failed connect would leave a phantom
  // line on screen until the next reload happens to overwrite it.
  const removeLocalEdge = useCallback((edgeId: string) => {
    if (!state || !selectedBrainId) return;
    setState(selectedBrainId, { ...state, edges: state.edges.filter(e => e.id !== edgeId) });
    localEditSeq.current++;
  }, [setState, state, selectedBrainId]);

  // Same pattern as addLocalEdge/removeLocalEdge, for node creation — call
  // BEFORE the add_node POST with a temp id so the card paints on click
  // instead of waiting on the round trip + a full compile.
  const addLocalNode = useCallback((node: BrainCanvasNode) => {
    if (!state || !selectedBrainId) return;
    setState(selectedBrainId, { ...state, nodes: [...state.nodes, node] });
    localEditSeq.current++;
    logger.info(`[brain-perf-client] addLocalNode id=${node.id} editSeq=${localEditSeq.current}`);
  }, [setState, state, selectedBrainId]);

  // Remove a locally-added node (e.g. the temp one from addLocalNode) if its
  // POST fails, or a node the user deleted, immediately (optimistic delete).
  const removeLocalNode = useCallback((nodeId: string) => {
    if (!state || !selectedBrainId) return;
    setState(selectedBrainId, { ...state, nodes: state.nodes.filter(n => n.id !== nodeId) });
    localEditSeq.current++;
    logger.info(`[brain-perf-client] removeLocalNode id=${nodeId} editSeq=${localEditSeq.current}`);
  }, [setState, state, selectedBrainId]);

  /** Patch one node in local state immediately, before the server round trip.
   *  Panel edits (title/priority/tag/lifecycle/workspace) are authoritative on
   *  the client, so waiting for a refetch + recompile just to see your own
   *  edit is pure latency. The background reload still reconciles tokens. */
  const patchLocalNode = useCallback((nodeId: string, patch: Partial<BrainCanvasNode>) => {
    if (!state || !selectedBrainId) return;
    setState(selectedBrainId, {
      ...state,
      nodes: state.nodes.map(n => (n.id === nodeId ? { ...n, ...patch } : n)),
    });
    localEditSeq.current++;
  }, [setState, state, selectedBrainId]);

  /** Same, for an edge's label. */
  const patchLocalEdge = useCallback((edgeId: string, patch: Partial<BrainCanvasEdge>) => {
    if (!state || !selectedBrainId) return;
    setState(selectedBrainId, {
      ...state,
      edges: state.edges.map(e => (e.id === edgeId ? { ...e, ...patch } : e)),
    });
    localEditSeq.current++;
  }, [setState, state, selectedBrainId]);

  const mutate = useCallback(async (body: Record<string, unknown>, opts?: { backgroundReload?: boolean }) => {
    setLoading(!opts?.backgroundReload);
    // body.brain_id wins so callers can mutate a non-selected brain (sidebar rows).
    const brainId = (typeof body.brain_id === 'string' && body.brain_id) || selectedBrainId;
    try {
      const res = await fetch('/api/ai/user-brain', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ brain_id: brainId, ...body }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || `Mutation failed (${res.status})`);
      // Reload refreshes the compiled budget/token count and reconciles any
      // server-side drift, but doesn't need to block the caller — the caller
      // may have already applied the real result locally (e.g. addLocalEdge)
      // for instant feedback.
      if (opts?.backgroundReload) {
        // Coalesced: rapid successive edits share one trailing reconcile
        // instead of each firing its own ~1.5s GET.
        scheduleReconcile(brainId);
      } else {
        await load(brainId);
      }
      return result;
    } catch (e: any) {
      logger.error('useBrainData mutate failed:', e);
      throw e;
    } finally {
      if (!opts?.backgroundReload) setLoading(false);
    }
  }, [selectedBrainId, load, scheduleReconcile]);

  return { state, loading, error, selectedBrainId, setSelectedBrainId, load, mutate, addLocalEdge, removeLocalEdge, addLocalNode, removeLocalNode, patchLocalNode, patchLocalEdge };
}
