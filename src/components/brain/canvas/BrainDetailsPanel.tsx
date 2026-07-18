"use client";

import { cn } from '@/lib/utils';
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
  return (
    <div
      className={cn(
        "w-[320px] max-h-[min(720px,calc(100vh-96px))] overflow-y-auto select-none canvas-floating-panel",
        "bg-[var(--app-panel)] backdrop-blur-xl rounded-[16px]",
        "outline outline-1 outline-[rgba(255,255,255,0.12)] -outline-offset-1",
        "shadow-[0_12px_40px_rgba(0,0,0,0.35)]",
        className
      )}
      onPointerDown={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
    >
      {mode === 'details' ? (
        <DetailsMode
          focusedNodeId={focusedNodeId}
          selectedNodeIds={selectedNodeIds}
          nodes={nodes}
          edges={edges}
          perNodeTokens={perNodeTokens}
          perNodeCap={perNodeCap}
          getDisplay={getDisplay}
          workspaceOptions={workspaceOptions}
          onClose={onClose}
          onFocusNode={onFocusNode}
          onOpenEditor={onOpenEditor}
          onSetMode={onSetMode}
          onConnect={onConnect}
          onUpdateTitle={onUpdateTitle}
          onUpdatePriority={onUpdatePriority}
          onMoveToWorkspace={onMoveToWorkspace}
        />
      ) : (
        <ConnectionsMode
          focusedNodeId={focusedNodeId}
          selectedNodeIds={selectedNodeIds}
          nodes={nodes}
          edges={edges}
          getDisplay={getDisplay}
          onClose={onClose}
          onFocusNode={onFocusNode}
          onSetMode={onSetMode}
          onStartConnectFrom={onStartConnectFrom}
          onConnect={onConnect}
          onUpdateEdgeLabel={onUpdateEdgeLabel}
          onBreakEdge={onBreakEdge}
        />
      )}
    </div>
  );
}
