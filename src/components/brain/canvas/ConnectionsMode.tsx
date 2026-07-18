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

      {/* Chain. Rows are indented; the spine hugs the left: it leaves the
          focused row's left edge, turns down through a rounded corner, and
          runs to the last card's center. A dot marks each connected row. */}
      <div className="px-3.5 pb-3 flex flex-col">
        <div className="relative pl-[18px]">
          {connected.length > 0 && (
            <div
              className={cn(
                "absolute left-1 top-[22px] bottom-[22px] w-[14px] pointer-events-none",
                "border-l border-t border-[var(--bone-30)] rounded-tl-[10px]"
              )}
            />
          )}

          {/* Focused row: dim blue, hover highlights + shows arrow, click →
              back to this node's details. */}
          <button
            type="button"
            onClick={() => onSetMode('details')}
            className={cn(
              "group/focused w-full flex items-center gap-2 h-11 px-3 rounded-[14px] text-left",
              "bg-[rgba(42,120,214,0.12)] hover:bg-[rgba(42,120,214,0.22)]",
              "border border-[var(--brand-blue)] outline-none transition-colors"
            )}
          >
            <span className="w-4 h-4 shrink-0 text-[var(--bone-70)] flex items-center justify-center [&_svg]:w-4 [&_svg]:h-4">
              {focusedDisplay.typeIcon ?? <FileText className="w-4 h-4" strokeWidth={1.75} />}
            </span>
            <span className="font-serif text-[15px] text-[var(--bone-100)] truncate flex-1">
              {focusedDisplay.title}
            </span>
            <span className="text-[var(--bone-60)] opacity-0 group-hover/focused:opacity-100 transition-opacity">
              <ChevronRight className="w-4 h-4" strokeWidth={2} />
            </span>
          </button>

          {connected.map(row => {
            const d = getDisplay(row.otherId);
            return (
              <div key={row.edge.id} className="relative">
                {/* Spine junction dot, level with this card's center — outside
                    the card's overflow-hidden box or it would be clipped. */}
                <div className="absolute -left-[17px] bottom-[19px] w-[7px] h-[7px] rounded-full bg-[var(--bone-90)] z-30 pointer-events-none" />
                {/* Label row: full width, dark, dim while idle; click to edit. */}
                <div className="my-2">
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
                      className="w-full h-9 px-3 rounded-[10px] text-[12px] bg-[var(--app-dark)] text-[var(--bone-90)] border border-[var(--bone-12)] outline-none"
                      placeholder="Label"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => startEditLabel(row.edge)}
                      className={cn(
                        "w-full h-9 px-3 rounded-[10px] text-[12px] text-left truncate",
                        "bg-[var(--app-dark)] border-none outline-none transition-colors",
                        row.edge.label
                          ? "text-[var(--bone-60)] hover:text-[var(--bone-90)]"
                          : "text-[var(--bone-30)] hover:text-[var(--bone-60)]"
                      )}
                      title="Edit connection label"
                    >
                      {row.edge.label || 'Add label'}
                    </button>
                  )}
                </div>

                {/* Connected card: idle-node styling (card-bg + bone-10 border),
                    bone-6 overlay + arrow on hover, red detach revealed by
                    hovering the right zone. Dot marks it on the spine. */}
                <div className="group relative h-11 rounded-[14px] overflow-hidden border border-[var(--bone-10)]">
                  <button
                    type="button"
                    title="Break connection"
                    onClick={() => onBreakEdge(row.edge.id)}
                    className="peer/zone absolute right-0 top-0 bottom-0 w-11 z-20 bg-transparent border-none outline-none cursor-pointer"
                    aria-label="Break connection"
                  />
                  <div
                    aria-hidden
                    className={cn(
                      "absolute inset-0 flex items-center justify-end pr-3 bg-[#E85A5A]",
                      "opacity-0 peer-hover/zone:opacity-100 transition-opacity duration-100"
                    )}
                  >
                    <Unlink className="w-4 h-4 text-white" strokeWidth={2} />
                  </div>
                  <div
                    className={cn(
                      "relative z-10 flex items-center h-full rounded-[13px] bg-[var(--card-bg)]",
                      "transition-[width] duration-150 ease-out w-full peer-hover/zone:w-[calc(100%-44px)]"
                    )}
                  >
                    <div className="absolute inset-0 bg-[var(--bone-6)] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                    <button
                      type="button"
                      onClick={() => onFocusNode(row.otherId)}
                      className="relative flex-1 min-w-0 h-full flex items-center gap-2 px-3 text-left border-none outline-none bg-transparent"
                    >
                      <span className="w-4 h-4 shrink-0 text-[var(--bone-60)] flex items-center justify-center [&_svg]:w-4 [&_svg]:h-4">
                        {d?.typeIcon ?? <FileText className="w-4 h-4" strokeWidth={1.75} />}
                      </span>
                      <span className="font-serif text-[15px] text-[var(--bone-90)] truncate">
                        {d?.title ?? 'Untitled'}
                      </span>
                    </button>
                    <span className="relative pr-3 text-[var(--bone-30)] opacity-0 group-hover:opacity-100 transition-opacity">
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
