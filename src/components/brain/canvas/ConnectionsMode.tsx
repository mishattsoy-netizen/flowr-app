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
import { Tooltip } from '@/components/layout/Tooltip';
import type { BrainCanvasEdge } from './useBrainData';
import type { DetailsNodeDisplay } from './DetailsMode';

export interface ConnectionsModeProps {
  focusedNodeId: string;
  /** When set (panel opened from an edge line click), render just this edge's
   *  two endpoints as an equal pair — both blue, one label between them. */
  pairEdge?: BrainCanvasEdge | null;
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

/** One endpoint row of the edge-pair view: blue like the focused row (solid,
 *  opaque blends of brand-blue over app-panel so the red detach underneath
 *  can never tint through), arrow on hover, red detach revealed by the right
 *  hot zone, click → that node's details. */
function PairNodeRow({
  display,
  onOpen,
  onDetach,
}: {
  display: DetailsNodeDisplay;
  onOpen: () => void;
  onDetach: () => void;
}) {
  return (
    <div className="group relative h-11 rounded-[14px] overflow-hidden border border-[var(--brand-blue)]">
      <Tooltip content="Break connection">
        <button
          type="button"
          onClick={onDetach}
          className="peer/zone absolute right-0 top-0 bottom-0 w-11 z-20 bg-transparent border-none outline-none cursor-pointer"
          aria-label="Break connection"
        />
      </Tooltip>
      <div
        aria-hidden
        className={cn(
          "absolute top-0 bottom-0 right-0 w-14 flex items-center justify-end pr-3 bg-[#E85A5A]",
          "opacity-0 peer-hover/zone:opacity-100 transition-opacity duration-100"
        )}
      >
        <Unlink className="w-4 h-4 text-white" strokeWidth={2} />
      </div>
      <div
        className={cn(
          "relative z-10 flex items-center h-full rounded-[12px]",
          "bg-[#2A333D] group-hover:bg-[#2A3B4E]",
          "transition-[width,background-color] duration-150 ease-out w-full peer-hover/zone:w-[calc(100%-44px)]"
        )}
      >
        <button
          type="button"
          onClick={onOpen}
          className="flex-1 min-w-0 h-full flex items-center gap-2 px-3 text-left border-none outline-none bg-transparent"
        >
          <span className="w-4 h-4 shrink-0 text-[var(--bone-100)] opacity-70 flex items-center justify-center [&_svg]:w-4 [&_svg]:h-4">
            {display.typeIcon ?? <FileText className="w-4 h-4" strokeWidth={1.75} />}
          </span>
          <span className="font-serif text-[15px] text-[var(--bone-100)] truncate">
            {display.title}
          </span>
        </button>
        <span className="pr-3 text-[var(--bone-100)] opacity-0 group-hover:opacity-60 transition-opacity">
          <ChevronRight className="w-4 h-4" strokeWidth={2} />
        </span>
      </div>
    </div>
  );
}

export function ConnectionsMode({
  focusedNodeId,
  pairEdge = null,
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
          className="flex-1 min-w-0 h-8 flex items-center gap-1 px-1.5 rounded-[8px] text-[13px] text-[var(--bone-100)] opacity-60 hover:opacity-90 hover:bg-[var(--bone-6)] border-none outline-none bg-transparent"
        >
          <ChevronLeft className="w-4 h-4 shrink-0" strokeWidth={2} />
          <span className="truncate">Back to details</span>
        </button>
        <button
          type="button"
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded-[8px] text-[var(--bone-100)] opacity-35 hover:opacity-100 hover:bg-[var(--bone-6)] border-none outline-none"
          aria-label="Close"
        >
          <X className="w-4 h-4" strokeWidth={2} />
        </button>
      </div>

      {/* Pair view (opened from an edge line): the edge's two endpoints as
          equals — both blue, one label between them, a bracket whose rounded
          corners physically meet each row's left edge. */}
      {pairEdge && (
        <div className="px-3.5 pb-3">
          <div className="relative pl-[18px]">
            {/* Bracket: vertical spine + rounded turns into both rows. */}
            <div
              className={cn(
                "absolute left-0 top-[22px] bottom-[22px] w-[18px] pointer-events-none",
                "border-l-2 border-t-2 border-b-2 border-[#B5B5B0]",
                "rounded-tl-[10px] rounded-bl-[10px]"
              )}
            />
            <PairNodeRow
              display={getDisplay(pairEdge.from_node) ?? { title: 'Untitled', priority: 3, workspaceLabel: '' }}
              onOpen={() => { onFocusNode(pairEdge.from_node); onSetMode('details'); }}
              onDetach={() => onBreakEdge(pairEdge.id)}
            />
            <div className="my-2 w-full h-9 relative group">
              {editingEdgeId === pairEdge.id ? (
                <input
                  ref={labelInputRef}
                  value={labelDraft}
                  onChange={e => setLabelDraft(e.target.value)}
                  onBlur={commitLabel}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); commitLabel(); }
                    if (e.key === 'Escape') setEditingEdgeId(null);
                  }}
                  className="absolute inset-0 w-full min-w-0 h-9 px-3 rounded-[10px] text-[12px] bg-[var(--app-dark)] text-[var(--bone-90)] border border-[var(--bone-12)] outline-none m-0"
                  placeholder="Label"
                />
              ) : (
                <>
                  <Tooltip content="Edit connection label">
                    <button
                      type="button"
                      onClick={() => startEditLabel(pairEdge)}
                      className={cn(
                        "absolute inset-0 w-full min-w-0 h-9 px-3 pr-9 rounded-[10px] text-[12px] text-left truncate m-0",
                        "border border-transparent outline-none transition-opacity",
                        "bg-[var(--app-dark)] opacity-50 group-hover:opacity-100 focus:opacity-100",
                        pairEdge.label
                          ? "text-[var(--bone-90)]"
                          : "text-[var(--bone-60)]"
                      )}
                    >
                      {pairEdge.label || 'Add label'}
                    </button>
                  </Tooltip>
                  <Tooltip content="Break connection">
                    <button
                      type="button"
                      onClick={() => onBreakEdge(pairEdge.id)}
                      className="absolute right-1 top-1 w-7 h-7 flex items-center justify-center rounded-[8px] bg-transparent hover:bg-[#E85A5A] text-[var(--bone-60)] hover:text-white opacity-30 hover:opacity-100 transition-all border-none outline-none cursor-pointer group/btn"
                    >
                      <Link2 className="w-3.5 h-3.5 block group-hover/btn:hidden" strokeWidth={2} />
                      <Unlink className="w-3.5 h-3.5 hidden group-hover/btn:block" strokeWidth={2} />
                    </button>
                  </Tooltip>
                </>
              )}
            </div>
            <PairNodeRow
              display={getDisplay(pairEdge.to_node) ?? { title: 'Untitled', priority: 3, workspaceLabel: '' }}
              onOpen={() => { onFocusNode(pairEdge.to_node); onSetMode('details'); }}
              onDetach={() => onBreakEdge(pairEdge.id)}
            />
          </div>
        </div>
      )}

      {/* Chain. Rows are indented; the spine hugs the left: it leaves the
          focused row's left edge, turns down through a rounded corner, and
          runs to the last card's center. A dot marks each connected row. */}
      {!pairEdge && (
      <div className="px-3.5 pb-3 flex flex-col">
        <div className="relative pl-[18px]">
          {/* Spine: drops from the focused row's bottom-left and stops where
              the LAST row's elbow begins its curve (32px = the row's 22px
              centre + the elbow's 10px corner radius) — running it to the
              centre would leave a straight stub past the turn. Each row draws
              its own rounded elbow INTO its left edge, so the line attaches. */}
          {connected.length > 0 && (
            <div
              className={cn(
                "absolute left-0 top-[22px] bottom-[32px] w-[18px] pointer-events-none",
                "border-l-2 border-t-2 border-[#B5B5B0] rounded-tl-[10px]"
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
            <span className="w-4 h-4 shrink-0 text-[var(--bone-100)] opacity-70 flex items-center justify-center [&_svg]:w-4 [&_svg]:h-4">
              {focusedDisplay.typeIcon ?? <FileText className="w-4 h-4" strokeWidth={1.75} />}
            </span>
            <span className="font-serif text-[15px] text-[var(--bone-100)] truncate flex-1">
              {focusedDisplay.title}
            </span>
            <span className="text-[var(--bone-100)] opacity-0 group-hover/focused:opacity-60 transition-opacity">
              <ChevronRight className="w-4 h-4" strokeWidth={2} />
            </span>
          </button>

          {connected.map(row => {
            const d = getDisplay(row.otherId);
            return (
              <div key={row.edge.id} className="relative">
                {/* Connector elbow: turns off the spine and runs INTO this
                    row's left edge, with a rounded corner. Bottom-anchored to
                    the row (h-11 → center is 22px up). */}
                <div
                  className={cn(
                    "absolute -left-[18px] bottom-[22px] w-[18px] h-[18px] pointer-events-none",
                    "border-l-2 border-b-2 border-[#B5B5B0] rounded-bl-[10px]"
                  )}
                />
                {/* Label row: full width, dark, dim while idle; click to edit. */}
                <div className="my-2 w-full h-9 relative group">
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
                      className="absolute inset-0 w-full min-w-0 h-9 px-3 rounded-[10px] text-[12px] bg-[var(--app-dark)] text-[var(--bone-90)] border border-[var(--bone-12)] outline-none m-0"
                      placeholder="Label"
                    />
                  ) : (
                    <>
                      <Tooltip content="Edit connection label">
                        <button
                          type="button"
                          onClick={() => startEditLabel(row.edge)}
                          className={cn(
                            "absolute inset-0 w-full min-w-0 h-9 px-3 pr-9 rounded-[10px] text-[12px] text-left truncate m-0",
                            "border border-transparent outline-none transition-opacity",
                            "bg-[var(--app-dark)] opacity-50 group-hover:opacity-100 focus:opacity-100",
                            row.edge.label
                              ? "text-[var(--bone-90)]"
                              : "text-[var(--bone-60)]"
                          )}
                        >
                          {row.edge.label || 'Add label'}
                        </button>
                      </Tooltip>
                      <Tooltip content="Break connection">
                        <button
                          type="button"
                          onClick={() => onBreakEdge(row.edge.id)}
                          className="absolute right-1 top-1 w-7 h-7 flex items-center justify-center rounded-[8px] bg-transparent hover:bg-[#E85A5A] text-[var(--bone-60)] hover:text-white opacity-30 hover:opacity-100 transition-all border-none outline-none cursor-pointer group/btn"
                        >
                          <Link2 className="w-3.5 h-3.5 block group-hover/btn:hidden" strokeWidth={2} />
                          <Unlink className="w-3.5 h-3.5 hidden group-hover/btn:block" strokeWidth={2} />
                        </button>
                      </Tooltip>
                    </>
                  )}
                </div>

                {/* Connected card: idle-node styling (card-bg + bone-10 border),
                    bone-6 overlay + arrow on hover, red detach revealed by
                    hovering the right zone. Dot marks it on the spine. */}
                <div className="group relative h-11 rounded-[14px] overflow-hidden border border-[var(--bone-10)]">
                  <Tooltip content="Break connection">
                    <button
                      type="button"
                      onClick={() => onBreakEdge(row.edge.id)}
                      className="peer/zone absolute right-0 top-0 bottom-0 w-11 z-20 bg-transparent border-none outline-none cursor-pointer"
                      aria-label="Break connection"
                    />
                  </Tooltip>
                  <div
                    aria-hidden
                    className={cn(
                      "absolute top-0 bottom-0 right-0 w-14 flex items-center justify-end pr-3 bg-[#E85A5A]",
                      "opacity-0 peer-hover/zone:opacity-100 transition-opacity duration-100"
                    )}
                  >
                    <Unlink className="w-4 h-4 text-white" strokeWidth={2} />
                  </div>
                  <div
                    className={cn(
                      "relative z-10 flex items-center h-full rounded-[12px] bg-[var(--card-bg)]",
                      "transition-[width] duration-150 ease-out w-full peer-hover/zone:w-[calc(100%-44px)]"
                    )}
                  >
                    <div className="absolute inset-0 bg-[var(--bone-6)] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                    <button
                      type="button"
                      onClick={() => onFocusNode(row.otherId)}
                      className="relative flex-1 min-w-0 h-full flex items-center gap-2 px-3 text-left border-none outline-none bg-transparent"
                    >
                      <span className="w-4 h-4 shrink-0 text-[var(--bone-100)] opacity-60 flex items-center justify-center [&_svg]:w-4 [&_svg]:h-4">
                        {d?.typeIcon ?? <FileText className="w-4 h-4" strokeWidth={1.75} />}
                      </span>
                      <span className="font-serif text-[15px] text-[var(--bone-90)] truncate">
                        {d?.title ?? 'Untitled'}
                      </span>
                    </button>
                    <span className="relative pr-3 text-[var(--bone-100)] opacity-0 group-hover:opacity-30 transition-opacity">
                      <ChevronRight className="w-4 h-4" strokeWidth={2} />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* + Connect */}
        <Tooltip content="Connect to another node">
          <button
            type="button"
            onClick={() => onStartConnectFrom(focusedNodeId)}
            className={cn(
              "mt-3 h-11 w-full rounded-[14px] bg-[var(--bone-6)]",
              "flex items-center justify-center text-[var(--bone-100)] opacity-35 hover:opacity-90 hover:bg-[var(--bone-10)]",
              "border-none outline-none transition-colors"
            )}
          >
            <Plus className="w-5 h-5" strokeWidth={2} />
          </button>
        </Tooltip>
      </div>
      )}
    </div>
  );
}
