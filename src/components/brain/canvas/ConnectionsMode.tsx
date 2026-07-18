"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Plus,
  Unlink,
  X,
} from 'lucide-react';
import type { BrainCanvasEdge } from './useBrainData';
import type { DetailsNodeDisplay } from './DetailsMode';

export interface ConnectionsModeProps {
  focusedNodeId: string;
  edges: BrainCanvasEdge[];
  getDisplay: (nodeId: string) => DetailsNodeDisplay | null;
  onClose: () => void;
  onFocusNode: (id: string) => void;
  onSetMode: (m: 'details' | 'connections') => void;
  onStartConnectFrom: (nodeId: string) => void;
  onUpdateEdgeLabel: (edgeId: string, label: string) => void;
  onBreakEdge: (edgeId: string) => void;
}

interface ConnectedRow {
  edge: BrainCanvasEdge;
  otherId: string;
}

export function ConnectionsMode({
  focusedNodeId,
  edges,
  getDisplay,
  onClose,
  onFocusNode,
  onSetMode,
  onStartConnectFrom,
  onUpdateEdgeLabel,
  onBreakEdge,
}: ConnectionsModeProps) {
  const focusedDisplay = getDisplay(focusedNodeId);

  const connected: ConnectedRow[] = useMemo(() => {
    const rows: ConnectedRow[] = [];
    for (const edge of edges) {
      if (edge.from_node === focusedNodeId) {
        rows.push({ edge, otherId: edge.to_node });
      } else if (edge.to_node === focusedNodeId) {
        rows.push({ edge, otherId: edge.from_node });
      }
    }
    return rows;
  }, [edges, focusedNodeId]);

  const [editingEdgeId, setEditingEdgeId] = useState<string | null>(null);
  const [labelDraft, setLabelDraft] = useState('');
  const labelInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingEdgeId) {
      requestAnimationFrame(() => {
        labelInputRef.current?.focus();
        labelInputRef.current?.select();
      });
    }
  }, [editingEdgeId]);

  const startEditLabel = (edge: BrainCanvasEdge) => {
    setEditingEdgeId(edge.id);
    setLabelDraft(edge.label || '');
  };

  const commitLabel = () => {
    if (!editingEdgeId) return;
    const id = editingEdgeId;
    const text = labelDraft.trim();
    setEditingEdgeId(null);
    onUpdateEdgeLabel(id, text);
  };

  if (!focusedDisplay) {
    return (
      <div className="p-4 text-[13px] text-[var(--bone-35)]">
        Node not found
        <button type="button" onClick={onClose} className="ml-2 underline">Close</button>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col"
      onPointerDown={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center gap-1 px-2.5 pt-2.5 pb-2">
        <button
          type="button"
          onClick={() => onSetMode('details')}
          className="flex-1 min-w-0 h-8 flex items-center gap-1 px-1.5 rounded-[8px] text-[13px] text-[var(--bone-60)] hover:text-[var(--bone-90)] hover:bg-[var(--bone-6)] border-none outline-none bg-transparent"
        >
          <ChevronLeft className="w-4 h-4 shrink-0" strokeWidth={2} />
          <span className="truncate">Back to details</span>
        </button>
        <button
          type="button"
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded-[8px] text-[var(--bone-35)] hover:text-[var(--bone-100)] hover:bg-[var(--bone-6)] border-none outline-none"
          aria-label="Close"
        >
          <X className="w-4 h-4" strokeWidth={2} />
        </button>
      </div>

      {/* Chain: one continuous spine down the left, from the focused card's
          center to the last connected card's center. Cards and label chips are
          in normal flow; the spine paints behind them and shows through the
          gaps, per the approved mockup. */}
      <div className="px-3.5 pb-3 flex flex-col">
        <div className="relative pl-4">
          {connected.length > 0 && (
            <div className="absolute left-[7px] top-[22px] bottom-[22px] w-px bg-[var(--bone-15)]" />
          )}

          {/* Focused node */}
          <div
            className={cn(
              "relative flex items-center gap-2 h-11 px-3 rounded-[14px]",
              "bg-[var(--app-dark)] border border-[var(--brand-blue)] shadow-[0_0_0_1px_rgba(42,120,214,0.25)]"
            )}
          >
            <span className="w-4 h-4 shrink-0 text-[var(--bone-70)] flex items-center justify-center [&_svg]:w-4 [&_svg]:h-4">
              {focusedDisplay.typeIcon ?? <FileText className="w-4 h-4" strokeWidth={1.75} />}
            </span>
            <span className="font-serif text-[15px] text-[var(--bone-100)] truncate flex-1">
              {focusedDisplay.title}
            </span>
          </div>

          {connected.map(row => {
            const d = getDisplay(row.otherId);
            return (
              <div key={row.edge.id}>
                {/* Label chip: in flow, sitting on the spine between the cards */}
                <div className="my-1.5 flex">
                  {editingEdgeId === row.edge.id ? (
                    <input
                      ref={labelInputRef}
                      value={labelDraft}
                      onChange={e => setLabelDraft(e.target.value)}
                      onBlur={commitLabel}
                      onKeyDown={e => {
                        if (e.key === 'Enter') { e.preventDefault(); commitLabel(); }
                        if (e.key === 'Escape') setEditingEdgeId(null);
                      }}
                      className="h-6 px-2.5 rounded-full text-[11px] bg-[var(--app-dark)] text-[var(--bone-90)] border border-[var(--bone-12)] outline-none max-w-full"
                      placeholder="Label"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => startEditLabel(row.edge)}
                      className={cn(
                        "h-6 px-2.5 rounded-full text-[11px] border-none outline-none max-w-full truncate",
                        row.edge.label
                          ? "bg-[var(--app-dark)] text-[var(--bone-70)] hover:text-[var(--bone-100)]"
                          : "bg-[var(--app-dark)] text-[var(--bone-30)] hover:text-[var(--bone-60)]"
                      )}
                      title="Edit connection label"
                    >
                      {row.edge.label || 'Add label'}
                    </button>
                  )}
                </div>

                {/* Connected node card. The break button lies UNDERNEATH at the
                    same height and corner radius, always present but covered by
                    the card; hovering shrinks the card from its right edge,
                    revealing the button. Card fill must be OPAQUE (--card-bg),
                    or the red bleeds through. */}
                <div className="group relative h-11 rounded-[14px]">
                  {/* Spine junction dot, level with this card's center */}
                  <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-[7px] h-[7px] rounded-full bg-[var(--bone-30)]" />
                  <button
                    type="button"
                    title="Break connection"
                    onClick={() => onBreakEdge(row.edge.id)}
                    className={cn(
                      "absolute inset-0 flex items-center justify-end pr-3 rounded-[14px]",
                      "bg-[#E85A5A] text-white border-none outline-none"
                    )}
                  >
                    <Unlink className="w-4 h-4" strokeWidth={2} />
                  </button>
                  <div
                    className={cn(
                      "relative flex items-center h-11 rounded-[14px] bg-[var(--card-bg)] overflow-hidden",
                      "transition-[width] duration-150 ease-out w-full group-hover:w-[calc(100%-40px)]"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => onFocusNode(row.otherId)}
                      className="flex-1 min-w-0 h-full flex items-center gap-2 px-3 text-left border-none outline-none bg-transparent"
                    >
                      <span className="w-4 h-4 shrink-0 text-[var(--bone-60)] flex items-center justify-center [&_svg]:w-4 [&_svg]:h-4">
                        {d?.typeIcon ?? <FileText className="w-4 h-4" strokeWidth={1.75} />}
                      </span>
                      <span className="font-serif text-[15px] text-[var(--bone-90)] truncate">
                        {d?.title ?? 'Untitled'}
                      </span>
                    </button>
                    <span className="pr-3 text-[var(--bone-30)]">
                      <ChevronRight className="w-4 h-4" strokeWidth={2} />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* + Connect */}
        <button
          type="button"
          onClick={() => onStartConnectFrom(focusedNodeId)}
          className={cn(
            "mt-3 h-11 w-full rounded-[14px] bg-[var(--bone-6)]",
            "flex items-center justify-center text-[var(--bone-35)] hover:text-[var(--bone-90)] hover:bg-[var(--bone-10)]",
            "border-none outline-none transition-colors"
          )}
          title="Connect to another node"
        >
          <Plus className="w-5 h-5" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
