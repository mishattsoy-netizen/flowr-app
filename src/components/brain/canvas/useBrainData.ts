"use client";

import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseEnabled } from '@/lib/supabase';
import { logger } from '@/lib/logger';

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
  const [state, setState] = useState<BrainCanvasState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBrainId, setSelectedBrainId] = useState<string | null>(null);

  const load = useCallback(async (brainId?: string | null) => {
    setLoading(true);
    try {
      const qs = brainId ? `?brain_id=${brainId}` : '';
      const res = await fetch(`/api/ai/user-brain${qs}`, { headers: await authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setState(data);
        setError(null);
        if (!brainId && data.brainId) setSelectedBrainId(data.brainId);
        if (brainId && data.brainId) setSelectedBrainId(data.brainId);
      } else {
        const body = await res.json().catch(() => ({}));
        setError(body?.error || `Failed to load brain (${res.status})`);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load brain data');
      logger.error('useBrainData load failed:', e);
    } finally {
      setLoading(false);
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
