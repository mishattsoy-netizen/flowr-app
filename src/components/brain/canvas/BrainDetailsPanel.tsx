"use client";

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { ChevronRight, FileText, Link2, Unlink } from 'lucide-react';
import type { BrainCanvasEdge, BrainCanvasNode } from './useBrainData';
import { DetailsMode, type DetailsNodeDisplay } from './DetailsMode';
import { ConnectionsMode } from './ConnectionsMode';

export interface BrainDetailsPanelProps {
  mode: 'details' | 'connections';
  focusedNodeId: string;
  selectedNodeIds: string[];
  nodes: BrainCanvasNode[];
  edges: BrainCanvasEdge[];
  perNodeTokens: Record<string, number>;
  perNodeCap: number;
  getDisplay: (nodeId: string) => DetailsNodeDisplay | null;
  workspaceOptions: { id: string; title: string }[];
  onClose: () => void;
  onFocusNode: (id: string) => void;
  onOpenEditor: (refId: string) => void;
  onSetMode: (m: 'details' | 'connections') => void;
  onStartConnectFrom: (nodeId: string) => void;
  onConnect: (fromId: string, toId: string) => void;
  onUpdateEdgeLabel: (edgeId: string, label: string) => void;
  onBreakEdge: (edgeId: string) => void;
  onUpdateTitle: (nodeId: string, title: string) => void;
  onUpdatePriority: (nodeId: string, priority: number) => void;
  onMoveToWorkspace: (nodeId: string, workspaceId: string | null) => void;
  className?: string;
}

/** Shared card chrome: the main panel and each selected-node card are separate
 *  floating panels stacked in a transparent column, per the approved mockup.
 *  Border (not outline): an inset outline gets painted over by opaque child
 *  backgrounds; a real border keeps children inside it. */
const cardChrome = cn(
  "canvas-floating-panel bg-[var(--app-panel)] backdrop-blur-xl",
  "border border-[var(--bone-12)]",
  "shadow-[0_12px_40px_rgba(0,0,0,0.35)]"
);

/** One other-selected node as its own floating card.
 *  - Whole-card hover highlights the row (bg → --card-bg) and shows the chevron.
 *  - The action button (blue connect / red detach) lies underneath at full
 *    height; hovering the card's RIGHT zone shrinks the row to reveal it.
 *  - The underneath button is rectangular and opacity-0 until the zone hover,
 *    so no colored sliver peeks at the rounded corners while covered. */
function SelectedNodeCard({
  id,
  display,
  isLinked,
  onFocus,
  onAction,
}: {
  id: string;
  display: DetailsNodeDisplay;
  isLinked: boolean;
  onFocus: (id: string) => void;
  /** Connect (unlinked) or break (linked), resolved by the parent. */
  onAction: () => void;
}) {
  return (
    <div
      className={cn(cardChrome, "group shrink-0 rounded-[14px] relative h-12 overflow-hidden")}
      onPointerDown={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
    >
      {/* Right hot zone: hovering it reveals the action button; clicking fires it. */}
      <button
        type="button"
        title={isLinked ? 'Break connection' : 'Connect'}
        onClick={onAction}
        className="peer/zone absolute right-0 top-0 bottom-0 w-11 z-20 bg-transparent border-none outline-none cursor-pointer"
        aria-label={isLinked ? 'Break connection' : 'Connect'}
      />
      {/* Action button underneath: rectangular (parent clips the corners),
          invisible until revealed. */}
      <div
        aria-hidden
        className={cn(
          "absolute inset-0 flex items-center justify-end pr-3.5",
          "opacity-0 peer-hover/zone:opacity-100 transition-opacity duration-100",
          isLinked ? "bg-[#E85A5A]" : "bg-[var(--brand-blue)]"
        )}
      >
        {isLinked
          ? <Unlink className="w-4 h-4 text-white" strokeWidth={2} />
          : <Link2 className="w-4 h-4 text-white" strokeWidth={2} />}
      </div>
      {/* Cover row: full width; shrinks from the right on zone hover. */}
      <div
        className={cn(
          "relative z-10 flex items-center h-full px-3.5 rounded-[14px]",
          "bg-[var(--app-panel)] group-hover:bg-[var(--card-bg)]",
          "transition-[width,background-color] duration-150 ease-out w-full peer-hover/zone:w-[calc(100%-44px)]"
        )}
      >
        <button
          type="button"
          onClick={() => onFocus(id)}
          className="flex-1 min-w-0 h-full flex items-center gap-2.5 text-left border-none outline-none bg-transparent"
        >
          <span className="w-4 h-4 shrink-0 text-[var(--bone-60)] flex items-center justify-center [&_svg]:w-4 [&_svg]:h-4">
            {display.typeIcon ?? <FileText className="w-4 h-4" strokeWidth={1.75} />}
          </span>
          <span className="font-serif text-[15px] text-[var(--bone-90)] truncate">
            {display.title}
          </span>
        </button>
        <span className="text-[var(--bone-30)] opacity-0 group-hover:opacity-100 transition-opacity">
          <ChevronRight className="w-4 h-4" strokeWidth={2} />
        </span>
      </div>
    </div>
  );
}

export function BrainDetailsPanel({
  mode,
  focusedNodeId,
  selectedNodeIds,
  nodes,
  edges,
  perNodeTokens,
  perNodeCap,
  getDisplay,
  workspaceOptions,
  onClose,
  onFocusNode,
  onOpenEditor,
  onSetMode,
  onStartConnectFrom,
  onConnect,
  onUpdateEdgeLabel,
  onBreakEdge,
  onUpdateTitle,
  onUpdatePriority,
  onMoveToWorkspace,
  className,
}: BrainDetailsPanelProps) {
  // Edge (if any) between the focused node and each other node, for detach.
  const edgeByOtherId = useMemo(() => {
    const map = new Map<string, BrainCanvasEdge>();
    for (const e of edges) {
      if (e.from_node === focusedNodeId) map.set(e.to_node, e);
      else if (e.to_node === focusedNodeId) map.set(e.from_node, e);
    }
    return map;
  }, [edges, focusedNodeId]);

  // Details mode: every other selected node, connected-to-focused first.
  // Connections mode: only the not-yet-connected ones (connected nodes are
  // already in the chain inside the panel).
  const otherCards = useMemo(() => {
    const others = selectedNodeIds.filter(id => id !== focusedNodeId);
    if (mode === 'connections') return others.filter(id => !edgeByOtherId.has(id));
    return [
      ...others.filter(id => edgeByOtherId.has(id)),
      ...others.filter(id => !edgeByOtherId.has(id)),
    ];
  }, [selectedNodeIds, focusedNodeId, edgeByOtherId, mode]);

  return (
    /* Transparent layout column — no overflow clipping here, so card shadows
       render fully. The main card scrolls its own content instead. */
    <div className={cn("w-[320px] select-none flex flex-col gap-3", className)}>
      {/* Main panel — its own card */}
      <div
        className={cn(
          cardChrome,
          "shrink-0 rounded-[16px] max-h-[min(600px,calc(100vh-160px))] overflow-y-auto"
        )}
        onPointerDown={e => e.stopPropagation()}
        onMouseDown={e => e.stopPropagation()}
        onClick={e => e.stopPropagation()}
      >
        {mode === 'details' ? (
          <DetailsMode
            focusedNodeId={focusedNodeId}
            nodes={nodes}
            edges={edges}
            perNodeTokens={perNodeTokens}
            perNodeCap={perNodeCap}
            getDisplay={getDisplay}
            workspaceOptions={workspaceOptions}
            onClose={onClose}
            onOpenEditor={onOpenEditor}
            onSetMode={onSetMode}
            onUpdateTitle={onUpdateTitle}
            onUpdatePriority={onUpdatePriority}
            onMoveToWorkspace={onMoveToWorkspace}
          />
        ) : (
          <ConnectionsMode
            focusedNodeId={focusedNodeId}
            edges={edges}
            getDisplay={getDisplay}
            onClose={onClose}
            onFocusNode={onFocusNode}
            onSetMode={onSetMode}
            onStartConnectFrom={onStartConnectFrom}
            onUpdateEdgeLabel={onUpdateEdgeLabel}
            onBreakEdge={onBreakEdge}
          />
        )}
      </div>

      {/* Other selected nodes — each a separate floating card below the panel */}
      {otherCards.map(id => {
        const d = getDisplay(id);
        if (!d) return null;
        const edge = edgeByOtherId.get(id);
        return (
          <SelectedNodeCard
            key={id}
            id={id}
            display={d}
            isLinked={!!edge}
            onFocus={onFocusNode}
            onAction={() => {
              if (edge) onBreakEdge(edge.id);
              else onConnect(focusedNodeId, id);
            }}
          />
        );
      })}
    </div>
  );
}
