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
}

export interface BrainCanvasEdge {
  id: string;
  from_node: string;
  to_node: string;
  label: string;
}

interface BrainMeta {
  id: string;
  title: string;
  description: string | null;
  is_default: boolean;
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
}

async function authHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (isSupabaseEnabled) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
  }
  return headers;
}

export function useBrainData() {
  // Cached in the Zustand store (persisted to localStorage), so this
  // initializes non-null on first render whenever a previous session already
  // fetched brain data — same "sync persist = hydrated on frame 1" pattern
  // documented in docs/superpowers/LOADING-ARCHITECTURE.md. That alone is
  // what makes both the canvas's full-page loader (gated on `!state`) and the
  // sidebar's blank brains list (`state?.brains ?? []`) skip on refresh: the
  // cached value paints immediately, then load() below quietly replaces it
  // with the fresh fetch once it resolves.
  const cachedBrainState = useStore(s => s.brainCanvasState) as BrainCanvasState | null;
  const setCachedBrainState = useStore(s => s.setBrainCanvasState);
  const [state, setStateLocal] = useState<BrainCanvasState | null>(cachedBrainState);
  const setState = useCallback((next: BrainCanvasState | null) => {
    setStateLocal(next);
    setCachedBrainState(next);
  }, [setCachedBrainState]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBrainId, setSelectedBrainId] = useState<string | null>(null);

  // Requests can resolve out of order (e.g. switching brains fires a new
  // fetch before the previous one settles) — without this guard, an older
  // response can land after a newer one and flip selectedBrainId back,
  // which re-triggers the load effect below and creates a back-and-forth
  // oscillation between brains. Only the most recently issued request is
  // allowed to write state.
  const requestIdRef = useRef(0);

  const load = useCallback(async (brainId?: string | null) => {
    const reqId = ++requestIdRef.current;
    setLoading(true);
    try {
      const qs = brainId ? `?brain_id=${brainId}` : '';
      const res = await fetch(`/api/ai/user-brain${qs}`, { headers: await authHeaders() });
      if (reqId !== requestIdRef.current) return; // a newer request superseded this one
      if (res.ok) {
        const data = await res.json();
        if (reqId !== requestIdRef.current) return;
        setState(data);
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
      if (reqId === requestIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => { load(selectedBrainId); }, [load, selectedBrainId]);

  const mutate = useCallback(async (body: Record<string, unknown>) => {
    setLoading(true);
    try {
      const res = await fetch('/api/ai/user-brain', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ brain_id: selectedBrainId, ...body }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || `Mutation failed (${res.status})`);
      await load(selectedBrainId);
      return result;
    } catch (e: any) {
      logger.error('useBrainData mutate failed:', e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [selectedBrainId, load]);

  return { state, loading, error, selectedBrainId, setSelectedBrainId, load, mutate };
}
