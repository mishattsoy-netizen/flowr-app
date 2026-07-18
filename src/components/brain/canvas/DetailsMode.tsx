"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  ChevronRight,
  Droplet,
  FileText,
  Flag,
  Folder,
  Link2,
  MoreHorizontal,
  X,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { BrainCanvasEdge, BrainCanvasNode } from './useBrainData';

export interface DetailsNodeDisplay {
  title: string;
  preview?: string;
  priority: number;
  workspaceLabel: string;
  typeIcon?: React.ReactNode;
}

export interface DetailsModeProps {
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
  onConnect: (fromId: string, toId: string) => void;
  onUpdateTitle: (nodeId: string, title: string) => void;
  onUpdatePriority: (nodeId: string, priority: number) => void;
  onMoveToWorkspace: (nodeId: string, workspaceId: string | null) => void;
}

function priorityMeta(p: number): { label: string; className: string } {
  if (p <= 1) return { label: 'High', className: 'bg-red-500/15 text-red-400' };
  if (p <= 2) return { label: 'Medium', className: 'bg-amber-500/15 text-amber-400' };
  return { label: 'Low', className: 'bg-[var(--bone-10)] text-[var(--bone-60)]' };
}

export function DetailsMode({
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
  onConnect,
  onUpdateTitle,
  onUpdatePriority,
  onMoveToWorkspace,
}: DetailsModeProps) {
  const node = nodes.find(n => n.id === focusedNodeId);
  const display = getDisplay(focusedNodeId);
  const used = perNodeTokens[focusedNodeId] ?? 0;
  const cap = perNodeCap > 0 ? perNodeCap : 2000;
  const pct = Math.min(100, Math.round((used / cap) * 100));

  const edgeCount = useMemo(
    () => edges.filter(e => e.from_node === focusedNodeId || e.to_node === focusedNodeId).length,
    [edges, focusedNodeId],
  );

  const connectedIds = useMemo(() => {
    const set = new Set<string>();
    for (const e of edges) {
      if (e.from_node === focusedNodeId) set.add(e.to_node);
      if (e.to_node === focusedNodeId) set.add(e.from_node);
    }
    return set;
  }, [edges, focusedNodeId]);

  const otherSelected = useMemo(() => {
    const others = selectedNodeIds.filter(id => id !== focusedNodeId);
    const connected = others.filter(id => connectedIds.has(id));
    const unconnected = others.filter(id => !connectedIds.has(id));
    return [...connected, ...unconnected];
  }, [selectedNodeIds, focusedNodeId, connectedIds]);

  const [titleDraft, setTitleDraft] = useState(display?.title ?? '');
  const [editingTitle, setEditingTitle] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTitleDraft(display?.title ?? '');
    setEditingTitle(false);
  }, [focusedNodeId, display?.title]);

  useEffect(() => {
    if (editingTitle) {
      requestAnimationFrame(() => {
        titleRef.current?.focus();
        titleRef.current?.select();
      });
    }
  }, [editingTitle]);

  const commitTitle = useCallback(() => {
    setEditingTitle(false);
    const next = titleDraft.trim() || 'Untitled';
    if (next !== (display?.title ?? '')) onUpdateTitle(focusedNodeId, next);
  }, [titleDraft, display?.title, focusedNodeId, onUpdateTitle]);

  if (!node || !display) {
    return (
      <div className="p-4 text-[13px] text-[var(--bone-40)]">
        Node not found
        <button type="button" onClick={onClose} className="ml-2 text-[var(--bone-70)] underline">
          Close
        </button>
      </div>
    );
  }

  const prio = priorityMeta(display.priority);

  return (
    <div
      className="flex flex-col gap-0"
      onPointerDown={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
    >
      {/* Usage bar + chrome */}
      <div className="flex items-center gap-2 px-3.5 pt-3 pb-2">
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className="text-[10px] font-semibold tabular-nums text-[var(--bone-70)] shrink-0">
            {pct}%
          </span>
          <div className="flex-1 h-[4px] rounded-full bg-[rgba(217,217,217,0.10)] overflow-hidden">
            <div
              className="h-full rounded-full bg-[#2A78D6] transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        <button
          type="button"
          className="w-7 h-7 flex items-center justify-center rounded-[8px] text-[var(--bone-40)] hover:text-[var(--bone-100)] hover:bg-[var(--bone-6)] border-none outline-none"
          title="More"
          aria-label="More"
        >
          <MoreHorizontal className="w-4 h-4" strokeWidth={2} />
        </button>
        <button
          type="button"
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded-[8px] text-[var(--bone-40)] hover:text-[var(--bone-100)] hover:bg-[var(--bone-6)] border-none outline-none"
          title="Close"
          aria-label="Close"
        >
          <X className="w-4 h-4" strokeWidth={2} />
        </button>
      </div>

      {/* Title */}
      <div className="px-3.5 pb-2">
        {editingTitle ? (
          <input
            ref={titleRef}
            value={titleDraft}
            onChange={e => setTitleDraft(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); commitTitle(); }
              if (e.key === 'Escape') {
                setTitleDraft(display.title);
                setEditingTitle(false);
              }
            }}
            className="w-full bg-transparent border-none outline-none font-serif text-[22px] leading-[1.2] text-[var(--bone-100)] p-0"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditingTitle(true)}
            className="w-full text-left font-serif text-[22px] leading-[1.2] text-[var(--bone-100)] border-none outline-none bg-transparent p-0 hover:opacity-90"
          >
            {display.title || 'Untitled'}
          </button>
        )}
      </div>

      {/* Preview */}
      {display.preview && (
        <p className="px-3.5 pb-3 text-[13px] leading-[1.45] text-[var(--bone-40)] line-clamp-5 whitespace-pre-wrap">
          {display.preview}
        </p>
      )}

      <div className="mx-3.5 h-px bg-[var(--bone-8)]" />

      {/* Field rows */}
      <div className="flex flex-col gap-0 px-3.5 py-2">
        {/* Priority */}
        <div className="flex items-center gap-2.5 h-9">
          <Flag className="w-3.5 h-3.5 text-[var(--bone-40)] shrink-0" strokeWidth={2} />
          <span className="flex-1 text-[13px] text-[var(--bone-70)]">Priority</span>
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  "px-2 py-0.5 rounded-full text-[11px] font-medium border-none outline-none",
                  prio.className
                )}
              >
                {prio.label}
              </button>
            </PopoverTrigger>
            <PopoverContent
              className="w-36 p-1 bg-[var(--app-panel)] border border-[var(--bone-12)] rounded-[12px] z-[320]"
              align="end"
              sideOffset={4}
            >
              {([
                { p: 1, label: 'High' },
                { p: 2, label: 'Medium' },
                { p: 3, label: 'Low' },
              ] as const).map(opt => (
                <button
                  key={opt.p}
                  type="button"
                  onClick={() => onUpdatePriority(focusedNodeId, opt.p)}
                  className={cn(
                    "w-full text-left px-2.5 py-1.5 rounded-[8px] text-[12px] border-none outline-none",
                    display.priority === opt.p
                      ? "bg-[var(--app-dark)] text-[var(--bone-100)]"
                      : "text-[var(--bone-70)] hover:bg-[var(--app-dark)] hover:text-[var(--bone-100)]"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </PopoverContent>
          </Popover>
        </div>

        {/* PART-C-FIELDS: Type / Custom tag / Lifecycle rows inserted here */}

        {/* Color — visual stub until Part C tag color */}
        <div className="flex items-center gap-2.5 h-9">
          <Droplet className="w-3.5 h-3.5 text-[var(--bone-40)] shrink-0" strokeWidth={2} />
          <span className="flex-1 text-[13px] text-[var(--bone-70)]">Color</span>
          <span className="w-4 h-4 rounded-full bg-[var(--bone-15)] border border-[var(--bone-12)]" />
        </div>

        {/* Workspace */}
        <div className="flex items-center gap-2.5 h-9">
          <Folder className="w-3.5 h-3.5 text-[var(--bone-40)] shrink-0" strokeWidth={2} />
          <span className="flex-1 text-[13px] text-[var(--bone-70)]">Workspace</span>
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--bone-10)] text-[var(--bone-70)] border-none outline-none hover:text-[var(--bone-100)]"
              >
                {display.workspaceLabel || 'Unsorted'}
              </button>
            </PopoverTrigger>
            <PopoverContent
              className="w-48 p-1 max-h-56 overflow-y-auto bg-[var(--app-panel)] border border-[var(--bone-12)] rounded-[12px] z-[320]"
              align="end"
              sideOffset={4}
            >
              <button
                type="button"
                onClick={() => onMoveToWorkspace(focusedNodeId, null)}
                className="w-full text-left px-2.5 py-1.5 rounded-[8px] text-[12px] text-[var(--bone-70)] hover:bg-[var(--app-dark)] hover:text-[var(--bone-100)] border-none outline-none"
              >
                Unsorted
              </button>
              {workspaceOptions.map(ws => (
                <button
                  key={ws.id}
                  type="button"
                  onClick={() => onMoveToWorkspace(focusedNodeId, ws.id)}
                  className="w-full text-left px-2.5 py-1.5 rounded-[8px] text-[12px] text-[var(--bone-70)] hover:bg-[var(--app-dark)] hover:text-[var(--bone-100)] border-none outline-none truncate"
                >
                  {ws.title}
                </button>
              ))}
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 px-3.5 pb-3 pt-1">
        <button
          type="button"
          onClick={() => onSetMode('connections')}
          className="h-9 px-3 rounded-[12px] bg-[var(--brand-blue)] text-white text-[13px] font-medium inline-flex items-center gap-1.5 border-none outline-none hover:brightness-110"
        >
          <Link2 className="w-4 h-4" strokeWidth={2} />
          {edgeCount}
        </button>
        <button
          type="button"
          onClick={() => {
            if (node.ref_id && node.type === 'entity') onOpenEditor(node.ref_id);
          }}
          disabled={!(node.type === 'entity' && node.ref_id)}
          className={cn(
            "flex-1 h-9 rounded-[12px] bg-[var(--bone-10)] text-[13px] font-medium text-[var(--bone-90)]",
            "inline-flex items-center justify-center gap-2 border-none outline-none",
            "hover:bg-[var(--bone-12)] disabled:opacity-40 disabled:pointer-events-none"
          )}
        >
          Open editor
          <FileText className="w-3.5 h-3.5 text-[var(--bone-50)]" strokeWidth={2} />
        </button>
      </div>

      {/* Other selected rows */}
      {otherSelected.length > 0 && (
        <div className="flex flex-col gap-1.5 px-3.5 pb-3.5 border-t border-[var(--bone-8)] pt-3">
          {otherSelected.map(id => {
            const d = getDisplay(id);
            if (!d) return null;
            const isLinked = connectedIds.has(id);
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
                {isLinked ? (
                  <span className="pr-3 text-[var(--bone-30)]">
                    <Link2 className="w-4 h-4" strokeWidth={2} />
                  </span>
                ) : (
                  <>
                    <span className="pr-3 text-[var(--bone-30)] group-hover:opacity-0 transition-opacity">
                      <ChevronRight className="w-4 h-4" strokeWidth={2} />
                    </span>
                    <button
                      type="button"
                      title="Connect"
                      onClick={() => onConnect(focusedNodeId, id)}
                      className={cn(
                        "absolute right-0 top-0 bottom-0 w-10 flex items-center justify-center",
                        "bg-[var(--brand-blue)] text-white border-none outline-none",
                        "opacity-0 group-hover:opacity-100 transition-opacity rounded-r-[12px]"
                      )}
                    >
                      <Link2 className="w-4 h-4" strokeWidth={2} />
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
