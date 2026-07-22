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
import { Tooltip } from '@/components/layout/Tooltip';
import { usageBarFillClass } from '@/lib/usageBarColor';
import type { BrainCanvasEdge, BrainCanvasNode } from './useBrainData';
import { useOverflowFade } from './useOverflowFade';

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

// Same palette as TaskInspectorPanel / TaskContextMenu COLORS.
const TAG_SWATCHES = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#F97316', '#06B6D4'];

function priorityMeta(p: number): { label: string; className: string } {
  if (p <= 1) return { label: 'High', className: 'bg-red-500/15 text-red-400' };
  if (p <= 2) return { label: 'Medium', className: 'bg-amber-500/15 text-amber-400' };
  return { label: 'Low', className: 'bg-blue-500/15 text-blue-400' };
}

/**
 * Exact copy of the tasks color picker popup body
 * (TaskInspectorPanel title-dot picker / TaskContextMenu colorTag submenu).
 */
function TagColorGrid({ color, onPick }: { color: string | null; onPick: (c: string | null) => void }) {
  return (
    <div className="popup-glass-small flex flex-col gap-2 min-w-[160px] shadow-2xl">
      <button
        type="button"
        onClick={() => onPick(null)}
        className={cn(
          "w-full flex items-center gap-2.5 px-2 py-1.5 rounded-[8px] text-[13px] font-medium cursor-pointer transition-none",
          !color
            ? "bg-[var(--bone-6)] text-[var(--bone-100)]"
            : "text-[var(--bone-70)] hover:bg-[var(--bone-5)]"
        )}
      >
        <CircleDashed className="w-3.5 h-3.5 shrink-0 text-[var(--bone-100)] opacity-40" />
        <span>None</span>
        {!color && <Check className="w-3 h-3 text-[var(--bone-100)] opacity-60 shrink-0 ml-auto" />}
      </button>
      <div className="grid grid-cols-4 gap-2 px-1 pb-0.5 place-items-center">
        {TAG_SWATCHES.slice(0, 4).map(c => (
          <Tooltip key={c} content={c}>
            <button
              type="button"
              onClick={() => onPick(color === c ? null : c)}
              className={cn(
                "w-7 h-7 rounded-full transition-all cursor-pointer flex items-center justify-center",
                color === c
                  ? "scale-110 ring-1 ring-[var(--bone-70)] ring-offset-2 ring-offset-[var(--color-panel)]"
                  : "opacity-50 hover:opacity-100"
              )}
              style={{ backgroundColor: c }}
            >
              {color === c && <Check className="w-3.5 h-3.5 text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]" />}
            </button>
          </Tooltip>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-2 px-1 pb-0 place-items-center">
        {TAG_SWATCHES.slice(4, 8).map(c => (
          <Tooltip key={c} content={c}>
            <button
              type="button"
              onClick={() => onPick(color === c ? null : c)}
              className={cn(
                "w-7 h-7 rounded-full transition-all cursor-pointer flex items-center justify-center",
                color === c
                  ? "scale-110 ring-1 ring-[var(--bone-70)] ring-offset-2 ring-offset-[var(--color-panel)]"
                  : "opacity-50 hover:opacity-100"
              )}
              style={{ backgroundColor: c }}
            >
              {color === c && <Check className="w-3.5 h-3.5 text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]" />}
            </button>
          </Tooltip>
        ))}
      </div>
    </div>
  );
}

/** Custom tag field: a name input (also filters the known-tags list below it)
 *  + a color dot that opens the task-style swatch grid in its own nested
 *  popover. Every change — typing, or picking a color/existing tag — saves
 *  immediately, debounced for the text field so it doesn't fire per keystroke. */
function TagField({
  node,
  knownTags,
  onUpdateTag,
  focusedNodeId,
}: {
  node: BrainCanvasNode;
  knownTags: BrainTagOption[];
  onUpdateTag?: (nodeId: string, tag: { tag_color: string | null; tag_name: string | null }) => void;
  focusedNodeId: string;
}) {
  const [open, setOpen] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState(node.tag_name ?? '');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reopening on a different node, or an external update (e.g. picking a
  // known tag from the list), resets the draft to the real value.
  useEffect(() => {
    setNameDraft(node.tag_name ?? '');
  }, [focusedNodeId, node.tag_name]);

  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  const scheduleSave = useCallback((name: string, color: string | null) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      onUpdateTag?.(focusedNodeId, { tag_color: color, tag_name: name.trim() || null });
    }, 400);
  }, [focusedNodeId, onUpdateTag]);

  const pickColor = (c: string | null) => {
    setColorOpen(false);
    // A color pick fires immediately — only the text field is debounced.
    if (saveTimer.current) clearTimeout(saveTimer.current);
    onUpdateTag?.(focusedNodeId, { tag_color: c, tag_name: nameDraft.trim() || null });
  };

  const pickKnownTag = (t: BrainTagOption) => {
    setOpen(false);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setNameDraft(t.tag_name ?? '');
    onUpdateTag?.(focusedNodeId, { tag_color: t.tag_color, tag_name: t.tag_name });
  };

  const query = nameDraft.trim().toLowerCase();
  const filteredTags = query
    ? knownTags.filter(t => (t.tag_name ?? '').toLowerCase().includes(query))
    : knownTags;

  return (
    <div className="flex items-center gap-2.5 h-9">
      <Tag className="w-3.5 h-3.5 text-[var(--bone-100)] opacity-35 shrink-0" strokeWidth={2} />
      <span className="flex-1 text-[13px] text-[var(--bone-70)]">Custom tag</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] text-[11px] font-medium border-none outline-none max-w-[150px] cursor-pointer",
              !node.tag_color && "bg-[var(--bone-10)] text-[var(--bone-70)] hover:text-[var(--bone-100)]"
            )}
            style={node.tag_color ? { backgroundColor: `${node.tag_color}26`, color: node.tag_color } : undefined}
          >
            {node.tag_color ? (
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: node.tag_color }} />
            ) : (
              <Droplet className="w-3.5 h-3.5 text-[var(--bone-100)] opacity-40 shrink-0" strokeWidth={2} />
            )}
            <span className="truncate">{node.tag_name || (node.tag_color ? 'Color' : 'None')}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="popup-glass-small !w-auto min-w-[200px] !p-1.5 !rounded-[12px] z-[320]" align="end">
          {/* Name field (search-as-you-type over the list below) + color dot,
              which opens the task-style swatch grid in a nested popover. */}
          <div className="flex items-center gap-1.5 mb-2">
            <input
              type="text"
              autoFocus
              placeholder="Name or search…"
              value={nameDraft}
              onChange={e => {
                const v = e.target.value;
                setNameDraft(v);
                scheduleSave(v, node.tag_color ?? null);
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              }}
              className="flex-1 min-w-0 bg-[var(--bone-6)] rounded-md px-2 py-1.5 text-[12px] text-[var(--bone-100)] border-none outline-none"
            />
            <Popover open={colorOpen} onOpenChange={setColorOpen}>
              <Tooltip content="Color">
                <span className="inline-flex shrink-0">
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center border border-[var(--bone-12)]"
                      style={node.tag_color ? { backgroundColor: node.tag_color } : undefined}
                    >
                      {!node.tag_color && <CircleDashed className="w-3.5 h-3.5 text-[var(--bone-100)] opacity-40" />}
                    </button>
                  </PopoverTrigger>
                </span>
              </Tooltip>
              <PopoverContent
                className="w-[170px] p-0 bg-transparent border-none shadow-none z-[330]"
                align="end"
                sideOffset={6}
              >
                <TagColorGrid color={node.tag_color ?? null} onPick={pickColor} />
              </PopoverContent>
            </Popover>
          </div>

          {/* Existing tags in this brain, filtered by the name field above —
              max 4 rows visible, the rest scroll. */}
          {filteredTags.length > 0 && (
            // Exactly 4 rows: 4 * h-8 (32px) + 3 gaps (0.5 = 2px) = 134px.
            <div className="flex flex-col gap-0.5 max-h-[134px] overflow-y-auto">
              {filteredTags.map(t => (
                <button
                  key={`${t.tag_color}|${t.tag_name ?? ''}`}
                  type="button"
                  onClick={() => pickKnownTag(t)}
                  className="w-full shrink-0 h-8 flex items-center gap-2 px-2 rounded-[8px] text-[12px] text-[var(--bone-70)] hover:bg-[var(--app-dark)] border-none outline-none"
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: t.tag_color }} />
                  <span className="truncate">{t.tag_name || 'Unnamed'}</span>
                </button>
              ))}
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
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
  // Memory notes aren't filed in a workspace — hide that row in details.
  const isMemory = node?.type === 'memory' || !!display?.brainOnly;
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

  // Fade when preview spans 3+ lines (same threshold as node cards).
  const { ref: previewRef, overflowing: previewOverflows } = useOverflowFade([
    display?.preview,
    focusedNodeId,
  ], 3);

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
              className={cn(
                "h-full rounded-full transition-all duration-300",
                usageBarFillClass(pct),
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        <Tooltip content="More">
          <button
            type="button"
            className="w-7 h-7 flex items-center justify-center rounded-[8px] text-[var(--bone-100)] opacity-35 hover:opacity-100 hover:bg-[var(--bone-6)] border-none outline-none"
            aria-label="More"
          >
            <MoreHorizontal className="w-4 h-4" strokeWidth={2} />
          </button>
        </Tooltip>
        <Tooltip content="Close">
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-[8px] text-[var(--bone-100)] opacity-35 hover:opacity-100 hover:bg-[var(--bone-6)] border-none outline-none"
            aria-label="Close"
          >
            <X className="w-4 h-4" strokeWidth={2} />
          </button>
        </Tooltip>
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

      {/* Preview — same treatment as node cards, taller (9 lines). Fade when
          content spans 3+ lines. */}
      {display.preview && (
        <div className="relative px-3.5 pb-3">
          <p
            ref={previewRef}
            className="text-[11px] text-[var(--bone-70)] break-words line-clamp-[9] overflow-hidden"
            style={{ lineHeight: '18px', maxHeight: '162px' }}
          >
            {display.preview}
          </p>
          {previewOverflows && (
            <div className="absolute inset-x-0 bottom-3 h-6 pointer-events-none bg-gradient-to-b from-transparent to-[var(--app-panel)]" />
          )}
        </div>
      )}

      <div className="mx-3.5 h-px bg-[var(--bone-10)]" />

      {/* Field rows — section: title only (no rows). workspace / entity differ. */}
      {!isSection && (
      <div className="flex flex-col gap-0 px-3.5 py-2">
        {/* Priority — entity + workspace */}
        <div className="flex items-center gap-2.5 h-9">
          <Flag className="w-3.5 h-3.5 text-[var(--bone-100)] opacity-35 shrink-0" strokeWidth={2} />
          <span className="flex-1 text-[13px] text-[var(--bone-70)]">Priority</span>
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  "px-2.5 py-1 rounded-[8px] text-[11px] font-medium capitalize border-none outline-none cursor-pointer",
                  prio.className
                )}
              >
                {prio.label}
              </button>
            </PopoverTrigger>
            <PopoverContent
              className="popup-glass-small !p-1 !rounded-[12px] flex flex-col gap-[2px] w-auto min-w-[140px] z-[320]"
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
                    "w-full px-3 py-1.5 rounded-[8px] text-left text-[13px] font-medium flex items-center gap-2.5 cursor-pointer border-none outline-none transition-none",
                    display.priority === opt.p
                      ? opt.p === 1 ? "bg-red-500/15 text-red-400" :
                        opt.p === 2 ? "bg-amber-500/15 text-amber-400" :
                          "bg-blue-500/15 text-blue-400"
                      : "text-[var(--bone-70)] hover:bg-[var(--bone-5)]"
                  )}
                >
                  <span className={cn(
                    "w-1.5 h-1.5 rounded-full shrink-0",
                    opt.p === 1 ? "bg-red-400" :
                    opt.p === 2 ? "bg-amber-400" :
                    "bg-blue-400"
                  )} />
                  <span>{opt.label}</span>
                </button>
              ))}
            </PopoverContent>
          </Popover>
        </div>

        {/* PART-C-FIELDS: Type / Custom tag / Lifecycle */}
        {isEntity && (
          <div className="flex items-center gap-2.5 h-9">
            <Brain className="w-3.5 h-3.5 text-[var(--bone-100)] opacity-35 shrink-0" strokeWidth={2} />
            <span className="flex-1 text-[13px] text-[var(--bone-70)]">Type</span>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] text-[11px] font-medium border-none outline-none cursor-pointer",
                    display.brainOnly
                      ? "bg-[#A78BFA]/15 text-[#C4B5FD]"
                      : "bg-[var(--bone-10)] text-[var(--bone-70)] hover:text-[var(--bone-100)]"
                  )}
                >
                  {display.brainOnly ? (
                    <Brain className="w-3 h-3 text-[#C4B5FD] shrink-0" strokeWidth={2} />
                  ) : (
                    <FileText className="w-3 h-3 opacity-70 shrink-0" strokeWidth={2} />
                  )}
                  <span>{display.brainOnly ? 'Memory' : 'Note'}</span>
                </button>
              </PopoverTrigger>
              <PopoverContent
                className="popup-glass-small !p-1 !rounded-[12px] flex flex-col gap-[2px] w-auto min-w-[140px] z-[320]"
                align="end"
                sideOffset={4}
              >
                <button
                  type="button"
                  onClick={() => onSetBrainOnly?.(focusedNodeId, false)}
                  className={cn(
                    "w-full px-3 py-1.5 rounded-[8px] text-left text-[13px] font-medium flex items-center gap-2.5 cursor-pointer border-none outline-none transition-none",
                    !display.brainOnly
                      ? "bg-[var(--bone-10)] text-[var(--bone-100)]"
                      : "text-[var(--bone-70)] hover:bg-[var(--bone-5)]"
                  )}
                >
                  <FileText className="w-3.5 h-3.5 shrink-0 opacity-70" strokeWidth={2} />
                  <span>Note</span>
                </button>
                <button
                  type="button"
                  onClick={() => onSetBrainOnly?.(focusedNodeId, true)}
                  className={cn(
                    "w-full px-3 py-1.5 rounded-[8px] text-left text-[13px] font-medium flex items-center gap-2.5 cursor-pointer border-none outline-none transition-none",
                    display.brainOnly
                      ? "bg-[#A78BFA]/20 text-[#C4B5FD]"
                      : "text-[var(--bone-70)] hover:bg-[var(--bone-5)]"
                  )}
                >
                  <Brain className="w-3.5 h-3.5 shrink-0 text-[#C4B5FD]" strokeWidth={2} />
                  <span>Memory</span>
                </button>
              </PopoverContent>
            </Popover>
          </div>
        )}

        {/* Custom tag */}
        {(isEntity || isWorkspace) && (
          <TagField
            node={node}
            knownTags={knownTags}
            onUpdateTag={onUpdateTag}
            focusedNodeId={focusedNodeId}
          />
        )}

        {/* Lifecycle */}
        {(isEntity || isWorkspace) && (
          <div className="flex items-center gap-2.5 h-9">
            <Calendar className="w-3.5 h-3.5 text-[var(--bone-100)] opacity-35 shrink-0" strokeWidth={2} />
            <span className="flex-1 text-[13px] text-[var(--bone-70)]">Lifecycle</span>
            {/* Exactly the picker the tasks panel uses (TaskInspectorPanel):
                start → active_from, end → active_until. */}
            <div className="w-[150px]">
              <NotionDateTimePicker
                startDate={node.active_from ?? undefined}
                setStartDate={(d) => {
                  // Picker clear (X) calls setStartDate(undefined) then
                  // setEndDate(undefined). Using stale node.active_* on the
                  // second call re-applied the date — clear both when either
                  // side is cleared so the X is instant.
                  if (d === undefined) {
                    onUpdateLifecycle?.(focusedNodeId, { active_from: null, active_until: null });
                    return;
                  }
                  onUpdateLifecycle?.(focusedNodeId, {
                    active_from: d,
                    active_until: node.active_until ?? null,
                  });
                }}
                endDate={node.active_until ?? undefined}
                setEndDate={(d) => {
                  if (d === undefined) {
                    onUpdateLifecycle?.(focusedNodeId, { active_from: null, active_until: null });
                    return;
                  }
                  onUpdateLifecycle?.(focusedNodeId, {
                    active_from: node.active_from ?? null,
                    active_until: d,
                  });
                }}
                includeTime={false}
                setIncludeTime={() => {}}
                reminder={undefined}
                setReminder={() => {}}
              />
            </div>
          </div>
        )}

        {/* Workspace reassign — notes only (not workspace itself, not memory) */}
        {isEntity && !isMemory && (
          <div className="flex items-center gap-2.5 h-9">
            <Folder className="w-3.5 h-3.5 text-[var(--bone-100)] opacity-35 shrink-0" strokeWidth={2} />
            <span className="flex-1 text-[13px] text-[var(--bone-70)]">Workspace</span>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="px-2.5 py-1 rounded-[8px] text-[11px] font-medium bg-[var(--bone-10)] text-[var(--bone-70)] border-none outline-none hover:text-[var(--bone-100)] cursor-pointer"
                >
                  {display.workspaceLabel || 'Unsorted'}
                </button>
              </PopoverTrigger>
              <PopoverContent
                className="popup-glass-small !p-1 !rounded-[12px] flex flex-col gap-[2px] w-auto min-w-[180px] max-h-[290px] overflow-y-auto scrollbar-thin z-[320]"
                align="end"
                sideOffset={4}
              >
                <button
                  type="button"
                  onClick={() => onMoveToWorkspace(focusedNodeId, null)}
                  className={cn(
                    "w-full px-3 py-1.5 rounded-[8px] text-left text-[13px] font-medium flex items-center justify-between cursor-pointer border-none outline-none transition-none",
                    !display.workspaceLabel ? "bg-[var(--bone-6)] text-[var(--bone-100)]" : "text-[var(--bone-70)] hover:bg-[var(--bone-5)]"
                  )}
                >
                  <span className="truncate">Unsorted</span>
                  {!display.workspaceLabel && <Check className="w-3 h-3 text-[var(--bone-60)] shrink-0 ml-2" />}
                </button>
                {workspaceOptions.map(ws => {
                  const isCurrent = display.workspaceLabel === ws.title;
                  return (
                    <button
                      key={ws.id}
                      type="button"
                      onClick={() => onMoveToWorkspace(focusedNodeId, ws.id)}
                      className={cn(
                        "w-full px-3 py-1.5 rounded-[8px] text-left text-[13px] font-medium flex items-center justify-between cursor-pointer border-none outline-none transition-none",
                        isCurrent ? "bg-[var(--bone-6)] text-[var(--bone-100)]" : "text-[var(--bone-70)] hover:bg-[var(--bone-5)]"
                      )}
                    >
                      <span className="truncate">{ws.title}</span>
                      {isCurrent && <Check className="w-3 h-3 text-[var(--bone-60)] shrink-0 ml-2" />}
                    </button>
                  );
                })}
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
          className="relative overflow-hidden group h-9 px-3 rounded-[12px] bg-[var(--brand-blue)] text-white text-[13px] font-medium border-none outline-none"
        >
          <div className="absolute inset-0 bg-[var(--bone-12)] opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none" />
          <div className="relative z-10 flex items-center gap-1.5 pointer-events-none">
            <Link2 className="w-4 h-4" strokeWidth={2} />
            {edgeCount}
          </div>
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
            "relative overflow-hidden group flex-1 h-9 rounded-[12px] bg-[var(--app-dark)] text-[13px] font-medium text-[var(--bone-90)] border-none outline-none",
            "disabled:opacity-40 disabled:pointer-events-none"
          )}
        >
          <div className="absolute inset-0 bg-[var(--bone-6)] opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none" />
          <div className="relative z-10 flex items-center justify-center gap-2 pointer-events-none">
            {isWorkspace ? 'Edit description' : 'Open editor'}
            <FileText className="w-3.5 h-3.5 text-[var(--bone-100)] opacity-60" strokeWidth={2} />
          </div>
        </button>
      </div>

    </div>
  );
}
