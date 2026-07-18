"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Link2,
  Plus,
  Unlink,
  X,
} from 'lucide-react';
import type { BrainCanvasEdge, BrainCanvasNode } from './useBrainData';
import type { DetailsNodeDisplay } from './DetailsMode';

export interface ConnectionsModeProps {
  focusedNodeId: string;
  selectedNodeIds: string[];
  nodes: BrainCanvasNode[];
  edges: BrainCanvasEdge[];
  getDisplay: (nodeId: string) => DetailsNodeDisplay | null;
  onClose: () => void;
  onFocusNode: (id: string) => void;
  onSetMode: (m: 'details' | 'connections') => void;
  onStartConnectFrom: (nodeId: string) => void;
  onConnect: (fromId: string, toId: string) => void;
  onUpdateEdgeLabel: (edgeId: string, label: string) => void;
  onBreakEdge: (edgeId: string) => void;
}

interface ConnectedRow {
  edge: BrainCanvasEdge;
  otherId: string;
}

export function ConnectionsMode({
  focusedNodeId,
  selectedNodeIds,
  edges,
  getDisplay,
  onClose,
  onFocusNode,
  onSetMode,
  onStartConnectFrom,
  onConnect,
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

  const connectedIdSet = useMemo(
    () => new Set(connected.map(c => c.otherId)),
    [connected],
  );

  const otherSelectedUnconnected = useMemo(
    () => selectedNodeIds.filter(id => id !== focusedNodeId && !connectedIdSet.has(id)),
    [selectedNodeIds, focusedNodeId, connectedIdSet],
  );

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
      <div className="p-4 text-[13px] text-[var(--bone-40)]">
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
          className="flex-1 min-w-0 h-8 flex items-center gap-1 px-1.5 rounded-[8px] text-[13px] text-[var(--bone-50)] hover:text-[var(--bone-90)] hover:bg-[var(--bone-6)] border-none outline-none bg-transparent"
        >
          <ChevronLeft className="w-4 h-4 shrink-0" strokeWidth={2} />
          <span className="truncate">Back to details</span>
        </button>
        <button
          type="button"
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded-[8px] text-[var(--bone-40)] hover:text-[var(--bone-100)] hover:bg-[var(--bone-6)] border-none outline-none"
          aria-label="Close"
        >
          <X className="w-4 h-4" strokeWidth={2} />
        </button>
      </div>

      {/* Chain */}
      <div className="px-3.5 pb-3 flex flex-col">
        {/* Focused node */}
        <div className="relative pl-4">
          <div
            className={cn(
              "flex items-center gap-2 h-11 px-3 rounded-[14px]",
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

          {connected.map((row, i) => {
            const d = getDisplay(row.otherId);
            const isLast = i === connected.length - 1;
            return (
              <div key={row.edge.id} className="relative">
                {/* Vertical spine */}
                <div
                  className="absolute left-[7px] top-0 w-px bg-[var(--bone-20)]"
                  style={{ height: isLast ? 'calc(50% + 8px)' : '100%' }}
                />
                {/* Dot */}
                <div className="absolute left-[4px] top-[calc(50%+10px)] w-[7px] h-[7px] rounded-full bg-[var(--bone-30)] -translate-y-1/2" />

                {/* Label chip */}
                <div className="pl-5 py-1.5">
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
                          : "bg-[var(--bone-6)] text-[var(--bone-30)] hover:text-[var(--bone-60)]"
                      )}
                      title="Edit connection label"
                    >
                      {row.edge.label || 'Add label'}
                    </button>
                  )}
                </div>

                {/* Connected node row */}
                <div className="group relative pl-5 pb-1">
                  <div className="flex items-center h-11 rounded-[14px] bg-[var(--bone-6)] overflow-hidden">
                    <button
                      type="button"
                      onClick={() => onFocusNode(row.otherId)}
                      className="flex-1 min-w-0 h-full flex items-center gap-2 px-3 text-left border-none outline-none bg-transparent"
                    >
                      <span className="w-4 h-4 shrink-0 text-[var(--bone-50)] flex items-center justify-center [&_svg]:w-4 [&_svg]:h-4">
                        {d?.typeIcon ?? <FileText className="w-4 h-4" strokeWidth={1.75} />}
                      </span>
                      <span className="font-serif text-[15px] text-[var(--bone-90)] truncate">
                        {d?.title ?? 'Untitled'}
                      </span>
                    </button>
                    <span className="pr-3 text-[var(--bone-30)] group-hover:opacity-0 transition-opacity">
                      <ChevronRight className="w-4 h-4" strokeWidth={2} />
                    </span>
                    <button
                      type="button"
                      title="Break connection"
                      onClick={() => onBreakEdge(row.edge.id)}
                      className={cn(
                        "absolute right-0 top-0 bottom-0 w-10 flex items-center justify-center",
                        "bg-[#E85A5A] text-white border-none outline-none rounded-r-[14px]",
                        "opacity-0 group-hover:opacity-100 transition-opacity"
                      )}
                    >
                      <Unlink className="w-4 h-4" strokeWidth={2} />
                    </button>
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
            "mt-2 h-11 w-full rounded-[14px] bg-[var(--bone-6)]",
            "flex items-center justify-center text-[var(--bone-40)] hover:text-[var(--bone-90)] hover:bg-[var(--bone-10)]",
            "border-none outline-none transition-colors"
          )}
          title="Connect to another node"
        >
          <Plus className="w-5 h-5" strokeWidth={2} />
        </button>

        {/* Other selected not connected */}
        {otherSelectedUnconnected.length > 0 && (
          <div className="mt-3 flex flex-col gap-1.5">
            <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--bone-40)] px-0.5">
              Other selected
            </p>
            {otherSelectedUnconnected.map(id => {
              const d = getDisplay(id);
              if (!d) return null;
              return (
                <div
                  key={id}
                  className="group relative flex items-center h-10 rounded-[12px] bg-[var(--bone-6)] overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => onFocusNode(id)}
                    className="flex-1 min-w-0 h-full flex items-center gap-2 px-3 text-left border-none outline-none bg-transparent"
                  >
                    <span className="w-4 h-4 shrink-0 text-[var(--bone-50)] flex items-center justify-center [&_svg]:w-4 [&_svg]:h-4">
                      {d.typeIcon ?? <FileText className="w-4 h-4" strokeWidth={1.75} />}
                    </span>
                    <span className="font-serif text-[15px] text-[var(--bone-90)] truncate">
                      {d.title}
                    </span>
                  </button>
                  <span className="pr-3 text-[var(--bone-30)] group-hover:opacity-0 transition-opacity">
                    <ChevronRight className="w-4 h-4" strokeWidth={2} />
                  </span>
                  <button
                    type="button"
                    title="Connect"
                    onClick={() => onConnect(focusedNodeId, id)}
                    className={cn(
                      "absolute right-0 top-0 bottom-0 w-10 flex items-center justify-center",
                      "bg-[var(--brand-blue)] text-white border-none outline-none rounded-r-[12px]",
                      "opacity-0 group-hover:opacity-100 transition-opacity"
                    )}
                  >
                    <Link2 className="w-4 h-4" strokeWidth={2} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
