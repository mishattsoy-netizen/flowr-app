"use client";

import { useEffect, useState, useCallback } from 'react';
import { X, Pin, Eye, EyeOff, Trash2, Plus, Brain, AlertTriangle, RefreshCw, ChevronUp, ChevronDown, Undo2 } from 'lucide-react';
import { supabase, isSupabaseEnabled } from '@/lib/supabase';
import { cn } from '@/lib/utils';

interface BrainNode {
  id: string; type: string; label: string | null; ref_id: string | null;
  content: string | null; section_id: string | null; priority: number;
  pinned: boolean; enabled: boolean;
}
interface BrainEdge { id: string; from_node: string; to_node: string; label: string }
interface BrainMeta { id: string; title: string; description: string | null; is_default: boolean }
interface BrainState {
  brainId: string;
  nodes: BrainNode[]; edges: BrainEdge[]; compiledPreview: string;
  deletedNodes: BrainNode[];
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

export function BrainPanel({ onClose }: { onClose: () => void }) {
  const [state, setState] = useState<BrainState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [newMemory, setNewMemory] = useState('');
  const [busy, setBusy] = useState(false);

  const [selectedBrainId, setSelectedBrainId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const qs = selectedBrainId ? `?brain_id=${selectedBrainId}` : '';
    const res = await fetch(`/api/ai/user-brain${qs}`, { headers: await authHeaders() });
    if (res.ok) {
      const data = await res.json();
      setState(data);
      setLoadError(null);
      if (!selectedBrainId) setSelectedBrainId(data.brainId);
    } else {
      // Surface real failures (401/500) distinctly from "brain has zero
      // nodes" — the two states look identical if you only check state's
      // presence, and that ambiguity is exactly what made a real auth bug
      // read as "the brain is just empty" during live testing.
      const body = await res.json().catch(() => ({}));
      setLoadError(body?.error || `Failed to load brain (${res.status})`);
    }
  }, [selectedBrainId]);

  useEffect(() => { load(); }, [load]);

  const mutate = async (body: object) => {
    setBusy(true);
    try {
      await fetch('/api/ai/user-brain', {
        method: 'POST', headers: await authHeaders(),
        body: JSON.stringify({ brain_id: selectedBrainId, ...body }),
      });
      await load();
    } finally { setBusy(false); }
  };

  const sections = state?.nodes.filter(n => n.type === 'section') ?? [];
  const nodesOf = (sectionId: string | null) =>
    state?.nodes.filter(n => n.type !== 'section' && n.section_id === sectionId) ?? [];
  const pct = state ? Math.min(100, Math.round((state.budget.used / state.budget.limit) * 100)) : 0;

  const nodeRow = (n: BrainNode) => {
    const dropped = state?.budget.dropped.includes(n.id);
    const broken = state?.budget.broken.includes(n.id);
    return (
      <div key={n.id} className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-[10px] border border-[var(--bone-10)] bg-[var(--app-dark)]",
        (!n.enabled || dropped || broken) && "opacity-50"
      )}>
        <span className="text-[10px] uppercase tracking-wide text-[var(--bone-40)] w-16 shrink-0">{n.type}</span>
        <span className="flex-1 text-[13px] text-[var(--bone-90)] truncate">
          {n.label || n.content || n.ref_id || n.id}
        </span>
        {broken && <span title="Referenced item was deleted or is inaccessible" className="text-amber-400 text-[10px] flex items-center gap-1"><AlertTriangle className="w-3 h-3" />broken</span>}
        {dropped && <span title="Over budget — not currently injected" className="text-amber-400 text-[10px]">dropped</span>}
        <button disabled={busy} title="Raise priority (survives budget pressure longer)"
          onClick={() => mutate({ action: 'update_node', node_id: n.id, updates: { priority: n.priority + 1 } })}
          className="p-1 rounded hover:bg-white/10 text-[var(--bone-100)] opacity-40 hover:opacity-100">
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
        <button disabled={busy} title="Lower priority"
          onClick={() => mutate({ action: 'update_node', node_id: n.id, updates: { priority: n.priority - 1 } })}
          className="p-1 rounded hover:bg-white/10 text-[var(--bone-100)] opacity-40 hover:opacity-100">
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
        <button disabled={busy} title={n.pinned ? 'Unpin' : 'Pin (never dropped by budget)'}
          onClick={() => mutate({ action: 'update_node', node_id: n.id, updates: { pinned: !n.pinned } })}
          className={cn("p-1 rounded hover:bg-white/10", n.pinned ? "text-[var(--brand-blue)] opacity-100" : "text-[var(--bone-100)] opacity-40 hover:opacity-100")}>
          <Pin className="w-3.5 h-3.5" />
        </button>
        <button disabled={busy} title={n.enabled ? 'Disable' : 'Enable'}
          onClick={() => mutate({ action: 'update_node', node_id: n.id, updates: { enabled: !n.enabled } })}
          className="p-1 rounded hover:bg-white/10 text-[var(--bone-100)] opacity-40 hover:opacity-100">
          {n.enabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
        </button>
        <button disabled={busy} title="Remove"
          onClick={() => mutate({ action: 'remove_node', node_id: n.id })}
          className="p-1 rounded hover:bg-white/10 text-red-400 opacity-70 hover:opacity-100">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-overlay" onClick={onClose}>
      <div className="bg-panel border border-border/50 rounded-[1.25rem] w-[680px] max-h-[80vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--bone-10)]">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-[var(--brand-blue)]" />
            <select
              value={selectedBrainId ?? ''}
              onChange={e => setSelectedBrainId(e.target.value)}
              className="bg-transparent text-base font-semibold text-foreground outline-none cursor-pointer"
            >
              {(state?.brains ?? []).map(b => (
                <option key={b.id} value={b.id}>{b.title}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                const title = prompt('Name this brain (e.g. "Trading", "Studying"):');
                if (!title?.trim()) return;
                await mutate({ action: 'create_brain', title: title.trim() });
              }}
              className="text-[11px] px-2.5 py-1 rounded-full border border-[var(--bone-10)] text-[var(--bone-60)] hover:text-foreground"
            >
              + New Brain
            </button>
            {state && !state.brains.find(b => b.id === selectedBrainId)?.is_default && (
              <button
                onClick={async () => {
                  if (!confirm('Delete this brain? Its nodes and edges will be removed.')) return;
                  const res = await fetch('/api/ai/user-brain', {
                    method: 'POST', headers: await authHeaders(),
                    body: JSON.stringify({ action: 'delete_brain', brain_id: selectedBrainId }),
                  });
                  if (res.ok) { setSelectedBrainId(null); await load(); }
                }}
                className="text-[11px] px-2.5 py-1 rounded-full border border-[var(--bone-10)] text-red-400/70 hover:text-red-400"
              >
                Delete Brain
              </button>
            )}
            <button onClick={() => setShowPreview(p => !p)} className="text-[11px] px-2.5 py-1 rounded-full border border-[var(--bone-10)] text-[var(--bone-60)] hover:text-foreground">
              {showPreview ? 'Hide' : 'View as bot sees it'}
            </button>
            <button onClick={load} disabled={busy} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-hover"><RefreshCw className="w-3.5 h-3.5" /></button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-hover"><X className="w-4 h-4" /></button>
          </div>
        </div>

        {/* Budget meter */}
        <div className="px-5 pt-4">
          <div className="flex justify-between text-[11px] text-[var(--bone-60)] mb-1">
            <span>Brain budget</span>
            <span>{state ? `${state.budget.used} / ${state.budget.limit} tokens (${pct}%)` : '…'}</span>
          </div>
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div className={cn("h-full transition-all duration-500", pct > 90 ? "bg-amber-400" : "bg-[var(--brand-blue)]")} style={{ width: `${pct}%` }} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4 min-h-0">
          {loadError && (
            <div className="px-3 py-2 rounded-[10px] border border-red-500/30 bg-red-500/10 text-red-400 text-[13px]">
              Failed to load your brain: {loadError}
            </div>
          )}
          {showPreview ? (
            <pre className="text-[11px] leading-relaxed text-[var(--bone-70)] whitespace-pre-wrap bg-[var(--app-dark)] rounded-[10px] p-4 border border-[var(--bone-10)]">
              {state?.compiledPreview || 'Brain is empty — nothing is injected yet.'}
            </pre>
          ) : (
            <>
              {sections.map(s => (
                <div key={s.id}>
                  <div className="text-[10px] font-medium uppercase tracking-wide text-[var(--bone-50)] mb-1.5 px-1">{s.label}</div>
                  <div className="space-y-1.5">{nodesOf(s.id).map(nodeRow)}</div>
                </div>
              ))}
              {nodesOf(null).length > 0 && (
                <div>
                  {sections.length > 0 && <div className="text-[10px] font-medium uppercase tracking-wide text-[var(--bone-50)] mb-1.5 px-1">Unsorted</div>}
                  <div className="space-y-1.5">{nodesOf(null).map(nodeRow)}</div>
                </div>
              )}
              {state && state.nodes.length === 0 && (
                <p className="text-xs text-muted-foreground/60 text-center py-10">
                  Your brain is empty. Add a memory below — or just ask the AI: "build a brain about …"
                </p>
              )}

              {/* Add workspace picker (spec §8: pick workspace/entity or write a memory) */}
              {state && state.availableWorkspaces.length > 0 && (
                <div className="flex items-center gap-2 pt-2">
                  <select
                    defaultValue=""
                    disabled={busy}
                    onChange={async e => {
                      if (e.target.value) {
                        await mutate({ action: 'add_node', type: 'workspace', ref_id: e.target.value });
                        e.target.value = '';
                      }
                    }}
                    className="flex-1 bg-[var(--app-dark)] border border-[var(--bone-10)] rounded-[10px] px-3 py-2 text-[12px] text-[var(--bone-70)] outline-none">
                    <option value="" disabled>Add a workspace to the brain…</option>
                    {state.availableWorkspaces
                      .filter(w => !state.nodes.some(n => n.ref_id === w.id))
                      .map(w => <option key={w.id} value={w.id}>{w.title}</option>)}
                  </select>
                </div>
              )}

              {/* Recently deleted (restore surface, spec §8) */}
              {state && state.deletedNodes.length > 0 && (
                <div className="pt-2">
                  <div className="text-[10px] font-medium uppercase tracking-wide text-[var(--bone-40)] mb-1.5 px-1">Recently deleted</div>
                  <div className="space-y-1.5">
                    {state.deletedNodes.map(n => (
                      <div key={n.id} className="flex items-center gap-2 px-3 py-2 rounded-[10px] border border-dashed border-[var(--bone-10)] opacity-60">
                        <span className="flex-1 text-[12px] text-[var(--bone-60)] truncate">{n.label || n.content || n.ref_id || n.id}</span>
                        <button disabled={busy} title="Restore"
                          onClick={() => mutate({ action: 'restore_node', node_id: n.id })}
                          className="p-1 rounded hover:bg-white/10 text-[var(--bone-100)] opacity-40 hover:opacity-100">
                          <Undo2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Add memory */}
        <div className="border-t border-[var(--bone-10)] p-4 flex gap-2">
          <input
            value={newMemory}
            onChange={e => setNewMemory(e.target.value)}
            onKeyDown={async e => {
              if (e.key === 'Enter' && newMemory.trim()) {
                await mutate({ action: 'add_node', type: 'memory', content: newMemory.trim() });
                setNewMemory('');
              }
            }}
            placeholder="Add a memory the bot should always know…"
            className="flex-1 bg-[var(--app-dark)] border border-[var(--bone-10)] rounded-[10px] px-3 py-2 text-[13px] text-foreground outline-none focus:border-[var(--bone-30)]"
          />
          <button
            disabled={busy || !newMemory.trim()}
            onClick={async () => { await mutate({ action: 'add_node', type: 'memory', content: newMemory.trim() }); setNewMemory(''); }}
            className="px-3 py-2 rounded-[10px] bg-white/10 text-foreground text-[13px] hover:bg-white/20 disabled:opacity-40 flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        </div>
      </div>
    </div>
  );
}
