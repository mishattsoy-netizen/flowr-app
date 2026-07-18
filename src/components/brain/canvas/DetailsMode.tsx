"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Brain,
  Calendar,
  Check,
  CircleDashed,
  Droplet,
  FileText,
  Flag,
  Folder,
  Link2,
  MoreHorizontal,
  Tag,
  X,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { NotionDateTimePicker } from '@/components/ui/notion-datetime-picker';
import type { BrainCanvasEdge, BrainCanvasNode } from './useBrainData';

export interface DetailsNodeDisplay {
  title: string;
  preview?: string;
  priority: number;
  workspaceLabel: string;
  typeIcon?: React.ReactNode;
  brainOnly?: boolean;
  description?: string | null;
}

export interface BrainTagOption {
  tag_color: string;
  tag_name: string | null;
}

export interface DetailsModeProps {
  focusedNodeId: string;
  nodes: BrainCanvasNode[];
  edges: BrainCanvasEdge[];
  perNodeTokens: Record<string, number>;
  perNodeCap: number;
  getDisplay: (nodeId: string) => DetailsNodeDisplay | null;
  workspaceOptions: { id: string; title: string }[];
  knownTags?: BrainTagOption[];
  onClose: () => void;
  onOpenEditor: (refId: string) => void;
  onSetMode: (m: 'details' | 'connections') => void;
  onUpdateTitle: (nodeId: string, title: string) => void;
  onUpdatePriority: (nodeId: string, priority: number) => void;
  onMoveToWorkspace: (nodeId: string, workspaceId: string | null) => void;
  onSetBrainOnly?: (nodeId: string, brainOnly: boolean) => void;
  onUpdateTag?: (nodeId: string, tag: { tag_color: string | null; tag_name: string | null }) => void;
  onUpdateLifecycle?: (nodeId: string, life: { active_from: string | null; active_until: string | null }) => void;
  onEditWorkspaceDescription?: (nodeId: string) => void;
}

// Identical palette to the tasks color picker (TaskContextMenu's COLORS).
const TAG_SWATCHES = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#F97316', '#06B6D4'];

function priorityMeta(p: number): { label: string; className: string } {
  if (p <= 1) return { label: 'High', className: 'bg-red-500/15 text-red-400' };
  if (p <= 2) return { label: 'Medium', className: 'bg-amber-500/15 text-amber-400' };
  return { label: 'Low', className: 'bg-[var(--bone-10)] text-[var(--bone-60)]' };
}

export function DetailsMode({
  focusedNodeId,
  nodes,
  edges,
  perNodeTokens,
  perNodeCap,
  getDisplay,
  workspaceOptions,
  knownTags = [],
  onClose,
  onOpenEditor,
  onSetMode,
  onUpdateTitle,
  onUpdatePriority,
  onMoveToWorkspace,
  onSetBrainOnly,
  onUpdateTag,
  onUpdateLifecycle,
  onEditWorkspaceDescription,
}: DetailsModeProps) {
  const node = nodes.find(n => n.id === focusedNodeId);
  const display = getDisplay(focusedNodeId);
  const isWorkspace = node?.type === 'workspace';
  const isSection = node?.type === 'section';
  const isEntity = node?.type === 'entity' || node?.type === 'memory';
  const used = isWorkspace
    ? (display?.description?.length ?? 0)
    : (perNodeTokens[focusedNodeId] ?? 0);
  const cap = isWorkspace ? 500 : (perNodeCap > 0 ? perNodeCap : 2000);
  const pct = Math.min(100, Math.round((used / Math.max(cap, 1)) * 100));

  const edgeCount = useMemo(
    () => edges.filter(e => e.from_node === focusedNodeId || e.to_node === focusedNodeId).length,
    [edges, focusedNodeId],
  );

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
      <div className="p-4 text-[13px] text-[var(--bone-35)]">
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
          className="w-7 h-7 flex items-center justify-center rounded-[8px] text-[var(--bone-35)] hover:text-[var(--bone-100)] hover:bg-[var(--bone-6)] border-none outline-none"
          title="More"
          aria-label="More"
        >
          <MoreHorizontal className="w-4 h-4" strokeWidth={2} />
        </button>
        <button
          type="button"
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded-[8px] text-[var(--bone-35)] hover:text-[var(--bone-100)] hover:bg-[var(--bone-6)] border-none outline-none"
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

      {/* Preview — same treatment as node cards (color, size, bottom fade),
          just taller. */}
      {display.preview && (
        <div className="relative px-3.5 pb-3">
          {/* Exact 9-line box (9 × 18px): a fractional height would slice the
              last row in half instead of clamping cleanly. */}
          <p
            className="text-[11px] text-[var(--bone-70)] break-words line-clamp-[9] overflow-hidden"
            style={{ lineHeight: '18px', maxHeight: '162px' }}
          >
            {display.preview}
          </p>
          <div className="absolute inset-x-0 bottom-3 h-6 pointer-events-none bg-gradient-to-b from-transparent to-[var(--app-panel)]" />
        </div>
      )}

      <div className="mx-3.5 h-px bg-[var(--bone-10)]" />

      {/* Field rows — section: title only (no rows). workspace / entity differ. */}
      {!isSection && (
      <div className="flex flex-col gap-0 px-3.5 py-2">
        {/* Priority — entity + workspace */}
        <div className="flex items-center gap-2.5 h-9">
          <Flag className="w-3.5 h-3.5 text-[var(--bone-35)] shrink-0" strokeWidth={2} />
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

        {/* PART-C-FIELDS: Type / Custom tag / Lifecycle */}
        {isEntity && (
          <div className="flex items-center gap-2.5 h-9">
            <Brain className="w-3.5 h-3.5 text-[var(--bone-35)] shrink-0" strokeWidth={2} />
            <span className="flex-1 text-[13px] text-[var(--bone-70)]">Type</span>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--bone-10)] text-[var(--bone-70)] border-none outline-none"
                >
                  {display.brainOnly ? 'Memory' : 'Note'}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-40 p-1 bg-[var(--app-panel)] border border-[var(--bone-12)] rounded-[12px] z-[320]" align="end">
                <button
                  type="button"
                  onClick={() => onSetBrainOnly?.(focusedNodeId, false)}
                  className="w-full text-left px-2.5 py-1.5 rounded-[8px] text-[12px] text-[var(--bone-70)] hover:bg-[var(--app-dark)] border-none outline-none"
                >
                  Note
                </button>
                <button
                  type="button"
                  onClick={() => onSetBrainOnly?.(focusedNodeId, true)}
                  className="w-full text-left px-2.5 py-1.5 rounded-[8px] text-[12px] text-[var(--bone-70)] hover:bg-[var(--app-dark)] border-none outline-none"
                >
                  Memory
                </button>
              </PopoverContent>
            </Popover>
          </div>
        )}

        {/* Custom tag */}
        {(isEntity || isWorkspace) && (
          <div className="flex items-center gap-2.5 h-9">
            <Tag className="w-3.5 h-3.5 text-[var(--bone-35)] shrink-0" strokeWidth={2} />
            <span className="flex-1 text-[13px] text-[var(--bone-70)]">Custom tag</span>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--bone-10)] text-[var(--bone-70)] border-none outline-none max-w-[140px]"
                >
                  {node.tag_color ? (
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: node.tag_color }} />
                  ) : (
                    <Droplet className="w-3 h-3 text-[var(--bone-40)]" strokeWidth={2} />
                  )}
                  <span className="truncate">{node.tag_name || (node.tag_color ? 'Color' : 'None')}</span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="popup-glass-small p-2 min-w-[160px] z-[320]" align="end">
                <p className="text-[10px] uppercase tracking-wide text-[var(--bone-40)] px-1 mb-1.5">Tag</p>
                {/* Same "Clear/None" row + swatch grid as the tasks color picker
                    (TaskContextMenu): CircleDashed icon, ring-scale on the
                    selected swatch, checkmark inside it. */}
                <button
                  type="button"
                  onClick={() => onUpdateTag?.(focusedNodeId, { tag_color: null, tag_name: null })}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-2 py-1.5 rounded-[8px] text-[13px] font-medium cursor-pointer mb-1",
                    !node.tag_color
                      ? "bg-[var(--bone-6)] text-[var(--bone-100)]"
                      : "text-[var(--bone-70)] hover:bg-[var(--bone-5)]"
                  )}
                >
                  <CircleDashed className="w-3.5 h-3.5 shrink-0 text-[var(--bone-40)]" />
                  <span>None</span>
                  {!node.tag_color && <Check className="w-3 h-3 text-[var(--bone-60)] shrink-0 ml-auto" />}
                </button>
                <div className="grid grid-cols-4 gap-2 px-1 pb-0.5 place-items-center">
                  {TAG_SWATCHES.slice(0, 4).map(c => (
                    <button
                      key={c}
                      type="button"
                      title={c}
                      onClick={() => onUpdateTag?.(focusedNodeId, { tag_color: node.tag_color === c ? null : c, tag_name: node.tag_color === c ? null : (node.tag_name ?? null) })}
                      className={cn(
                        "w-7 h-7 rounded-full transition-all cursor-pointer flex items-center justify-center",
                        node.tag_color === c ? "scale-110 ring-1 ring-[var(--bone-70)] ring-offset-2 ring-offset-[var(--color-panel)]" : "opacity-50 hover:opacity-100"
                      )}
                      style={{ backgroundColor: c }}
                    >
                      {node.tag_color === c && <Check className="w-3.5 h-3.5 text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]" />}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-4 gap-2 px-1 pb-2 place-items-center">
                  {TAG_SWATCHES.slice(4, 8).map(c => (
                    <button
                      key={c}
                      type="button"
                      title={c}
                      onClick={() => onUpdateTag?.(focusedNodeId, { tag_color: node.tag_color === c ? null : c, tag_name: node.tag_color === c ? null : (node.tag_name ?? null) })}
                      className={cn(
                        "w-7 h-7 rounded-full transition-all cursor-pointer flex items-center justify-center",
                        node.tag_color === c ? "scale-110 ring-1 ring-[var(--bone-70)] ring-offset-2 ring-offset-[var(--color-panel)]" : "opacity-50 hover:opacity-100"
                      )}
                      style={{ backgroundColor: c }}
                    >
                      {node.tag_color === c && <Check className="w-3.5 h-3.5 text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]" />}
                    </button>
                  ))}
                </div>
                {knownTags.length > 0 && (
                  <div className="flex flex-col gap-0.5 max-h-32 overflow-y-auto">
                    {knownTags.map(t => (
                      <button
                        key={`${t.tag_color}|${t.tag_name ?? ''}`}
                        type="button"
                        onClick={() => onUpdateTag?.(focusedNodeId, { tag_color: t.tag_color, tag_name: t.tag_name })}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-[8px] text-[12px] text-[var(--bone-70)] hover:bg-[var(--app-dark)] border-none outline-none"
                      >
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.tag_color }} />
                        <span className="truncate">{t.tag_name || 'Unnamed'}</span>
                      </button>
                    ))}
                  </div>
                )}
                <input
                  type="text"
                  placeholder="Tag name…"
                  defaultValue={node.tag_name ?? ''}
                  onBlur={e => {
                    const name = e.target.value.trim() || null;
                    onUpdateTag?.(focusedNodeId, {
                      tag_color: node.tag_color ?? TAG_SWATCHES[0],
                      tag_name: name,
                    });
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  }}
                  className="mt-2 w-full bg-[var(--bone-6)] rounded-md px-2 py-1.5 text-[12px] text-[var(--bone-100)] border-none outline-none"
                />
              </PopoverContent>
            </Popover>
          </div>
        )}

        {/* Lifecycle */}
        {(isEntity || isWorkspace) && (
          <div className="flex items-center gap-2.5 h-9">
            <Calendar className="w-3.5 h-3.5 text-[var(--bone-35)] shrink-0" strokeWidth={2} />
            <span className="flex-1 text-[13px] text-[var(--bone-70)]">Lifecycle</span>
            {/* Exactly the picker the tasks panel uses (TaskInspectorPanel):
                start → active_from, end → active_until. */}
            <div className="w-[150px]">
              <NotionDateTimePicker
                startDate={node.active_from ?? undefined}
                setStartDate={(d) => onUpdateLifecycle?.(focusedNodeId, {
                  active_from: d ?? null,
                  active_until: node.active_until ?? null,
                })}
                endDate={node.active_until ?? undefined}
                setEndDate={(d) => onUpdateLifecycle?.(focusedNodeId, {
                  active_from: node.active_from ?? null,
                  active_until: d ?? null,
                })}
                includeTime={false}
                setIncludeTime={() => {}}
                reminder={undefined}
                setReminder={() => {}}
              />
            </div>
          </div>
        )}

        {/* Workspace reassign — entity only (not workspace itself) */}
        {isEntity && (
          <div className="flex items-center gap-2.5 h-9">
            <Folder className="w-3.5 h-3.5 text-[var(--bone-35)] shrink-0" strokeWidth={2} />
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
        )}
      </div>
      )}

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
            if (isWorkspace && node.ref_id) {
              onEditWorkspaceDescription?.(focusedNodeId);
              return;
            }
            if (node.ref_id && (node.type === 'entity' || node.type === 'memory')) {
              onOpenEditor(node.ref_id);
            }
          }}
          disabled={
            isSection
            || !(node.ref_id && (isEntity || isWorkspace))
          }
          className={cn(
            "flex-1 h-9 rounded-[12px] bg-[var(--app-dark)] text-[13px] font-medium text-[var(--bone-90)]",
            "inline-flex items-center justify-center gap-2 border-none outline-none",
            "hover:bg-[var(--card-bg)] disabled:opacity-40 disabled:pointer-events-none"
          )}
        >
          {isWorkspace ? 'Edit description' : 'Open editor'}
          <FileText className="w-3.5 h-3.5 text-[var(--bone-60)]" strokeWidth={2} />
        </button>
      </div>

    </div>
  );
}
