"use client";

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { ChevronRight, FileText, Link2 } from 'lucide-react';
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
 *  floating panels stacked in a transparent column, per the approved mockup. */
const cardChrome = cn(
  "canvas-floating-panel bg-[var(--app-panel)] backdrop-blur-xl",
  "outline outline-1 outline-[rgba(255,255,255,0.12)] -outline-offset-1",
  "shadow-[0_12px_40px_rgba(0,0,0,0.35)]"
);

/** One other-selected node as its own floating card. When unconnected, the
 *  blue connect button lies UNDERNEATH the row at full height/corners, always
 *  present but covered; hovering shrinks the row from its right edge to
 *  reveal it. */
function SelectedNodeCard({
  id,
  display,
  isLinked,
  onFocus,
  onConnect,
}: {
  id: string;
  display: DetailsNodeDisplay;
  isLinked: boolean;
  onFocus: (id: string) => void;
  onConnect: (id: string) => void;
}) {
  return (
    <div
      className={cn(cardChrome, "group shrink-0 rounded-[14px] relative h-12 overflow-hidden")}
      onPointerDown={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
    >
      {!isLinked && (
        <button
          type="button"
          title="Connect"
          onClick={() => onConnect(id)}
          className={cn(
            "absolute inset-0 flex items-center justify-end pr-3.5 rounded-[14px]",
            "bg-[var(--brand-blue)] text-white border-none outline-none"
          )}
        >
          <Link2 className="w-4 h-4" strokeWidth={2} />
        </button>
      )}
      <div
        className={cn(
          "relative flex items-center h-12 px-3.5 rounded-[14px] bg-[var(--app-panel)]",
          !isLinked && "transition-[width] duration-150 ease-out w-full group-hover:w-[calc(100%-44px)]"
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
        <span className="text-[var(--bone-30)]">
          {isLinked
            ? <Link2 className="w-4 h-4" strokeWidth={2} />
            : <ChevronRight className="w-4 h-4" strokeWidth={2} />}
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
  const connectedIds = useMemo(() => {
    const set = new Set<string>();
    for (const e of edges) {
      if (e.from_node === focusedNodeId) set.add(e.to_node);
      if (e.to_node === focusedNodeId) set.add(e.from_node);
    }
    return set;
  }, [edges, focusedNodeId]);

  // Details mode: every other selected node, connected-to-focused first.
  // Connections mode: only the not-yet-connected ones (connected nodes are
  // already in the chain inside the panel).
  const otherCards = useMemo(() => {
    const others = selectedNodeIds.filter(id => id !== focusedNodeId);
    if (mode === 'connections') return others.filter(id => !connectedIds.has(id));
    return [
      ...others.filter(id => connectedIds.has(id)),
      ...others.filter(id => !connectedIds.has(id)),
    ];
  }, [selectedNodeIds, focusedNodeId, connectedIds, mode]);

  return (
    <div
      className={cn(
        "w-[320px] max-h-[min(720px,calc(100vh-96px))] overflow-y-auto select-none",
        "flex flex-col gap-3",
        className
      )}
    >
      {/* Main panel — its own card */}
      <div
        className={cn(cardChrome, "shrink-0 rounded-[16px]")}
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
        return (
          <SelectedNodeCard
            key={id}
            id={id}
            display={d}
            isLinked={connectedIds.has(id)}
            onFocus={onFocusNode}
            onConnect={toId => onConnect(focusedNodeId, toId)}
          />
        );
      })}
    </div>
  );
}
