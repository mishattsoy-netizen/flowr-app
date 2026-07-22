"use client";

import { useState, useRef, useEffect, useMemo } from 'react';
import {
  ArrowRightFromLine, Paintbrush, Pin, Copy, FolderInput, Trash2,
  Type, Heading1, Heading2, FileText, Code,
  List, Minus, ListOrdered, CheckSquare, Quote,
  Columns2, Columns3, Columns4, SeparatorHorizontal,
  FileInput, Table, Kanban, GalleryHorizontalEnd, ListFilter,
  ChevronRight, ChevronLeft, Search, Plus, ImageIcon, Video, ClipboardPaste,
  Check, X, CircleDashed
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStore } from '@/data/store';
import { Toggle } from '@/components/ui/Toggle';
import type { EditorBlock, BlockType } from '@/data/store';

/* ────────────────────────────────────────────────── */
/*  "Turn into" command list                          */
/* ────────────────────────────────────────────────── */

const ICON_CLS = "w-4 h-4";

interface TurnIntoItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  category: string;
  type: BlockType;
  extra?: Record<string, unknown>;
  shortcut?: string;
}

const TURN_INTO_ITEMS: TurnIntoItem[] = [
  { id: 'title', label: 'Title', icon: <Type strokeWidth={2} className={ICON_CLS} />, category: 'Text', type: 'text', extra: { style: 'title' }, shortcut: 'H1' },
  { id: 'heading', label: 'Heading', icon: <Heading1 strokeWidth={2} className={ICON_CLS} />, category: 'Text', type: 'text', extra: { style: 'heading' }, shortcut: '#' },
  { id: 'subheading', label: 'Subheading', icon: <Heading2 strokeWidth={2} className={ICON_CLS} />, category: 'Text', type: 'text', extra: { style: 'subheading' }, shortcut: '##' },
  { id: 'body', label: 'Body', icon: <FileText strokeWidth={2} className={ICON_CLS} />, category: 'Text', type: 'text', extra: { style: 'body' }, shortcut: 'T' },
  { id: 'mono', label: 'Mono', icon: <Code strokeWidth={2} className={ICON_CLS} />, category: 'Text', type: 'text', extra: { style: 'mono' }, shortcut: '`' },
  { id: 'bullet', label: 'Bulleted List', icon: <List strokeWidth={2} className={ICON_CLS} />, category: 'Lists', type: 'bulletList', shortcut: '-' },
  { id: 'dashed', label: 'Dashed List', icon: <Minus strokeWidth={2} className={ICON_CLS} />, category: 'Lists', type: 'dashedList', shortcut: '--' },
  { id: 'numbered', label: 'Numbered List', icon: <ListOrdered strokeWidth={2} className={ICON_CLS} />, category: 'Lists', type: 'numberedList', shortcut: '1.' },
  { id: 'checklist', label: 'Checklist', icon: <CheckSquare strokeWidth={2} className={ICON_CLS} />, category: 'Lists', type: 'checklist', shortcut: '[]' },
  { id: 'quote', label: 'Quote', icon: <Quote strokeWidth={2} className={ICON_CLS} />, category: 'Layout', type: 'quote', shortcut: '>' },
  { id: 'divider', label: 'Divider', icon: <SeparatorHorizontal strokeWidth={2} className={ICON_CLS} />, category: 'Layout', type: 'divider', shortcut: '---' },
  { id: '2col', label: '2 Columns', icon: <Columns2 strokeWidth={2} className={ICON_CLS} />, category: 'Layout', type: 'columns', extra: { columnCount: 2 } },
  { id: '3col', label: '3 Columns', icon: <Columns3 strokeWidth={2} className={ICON_CLS} />, category: 'Layout', type: 'columns', extra: { columnCount: 3 } },
  { id: '4col', label: '4 Columns', icon: <Columns4 strokeWidth={2} className={ICON_CLS} />, category: 'Layout', type: 'columns', extra: { columnCount: 4 } },
  { id: 'table', label: 'Simple Table', icon: <Table strokeWidth={2} className={ICON_CLS} />, category: 'Tables', type: 'table', shortcut: '|' },
  { id: 'image', label: 'Image', icon: <ImageIcon strokeWidth={2} className={ICON_CLS} />, category: 'Media', type: 'image' },
  { id: 'video', label: 'Video', icon: <Video strokeWidth={2} className={ICON_CLS} />, category: 'Media', type: 'video' },
];

/* ────────────────────────────────────────────────── */
/*  Props                                             */
/* ────────────────────────────────────────────────── */

interface BlockOptionsMenuProps {
  block: EditorBlock;
  position: { x: number; y: number };
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<EditorBlock>) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onMoveToTop: (id: string) => void;
  onTurnInto: (id: string, type: BlockType, extra?: Record<string, unknown>) => void;
  onMoveTo?: (id: string) => void;
  onAddColumn?: (id: string) => void;
  entityId: string;
}

type SubMenu = 'turnInto' | 'color' | null;

/* ────────────────────────────────────────────────── */
/*  Component                                         */
/* ────────────────────────────────────────────────── */

export function BlockOptionsMenu({
  block,
  position,
  onClose,
  onUpdate,
  onDelete,
  onDuplicate,
  onMoveToTop,
  onTurnInto,
  onMoveTo,
  onAddColumn,
  entityId,
}: BlockOptionsMenuProps) {
  const [subMenu, setSubMenu] = useState<SubMenu>(null);
  const [turnIntoSearch, setTurnIntoSearch] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const turnIntoInputRef = useRef<HTMLInputElement>(null);
  const [adjustedPos, setAdjustedPos] = useState(position);

  const copiedBlock = useStore(s => s.copiedBlock);
  const copyBlock = useStore(s => s.copyBlock);
  const pasteBlock = useStore(s => s.pasteBlock);


  // Focus search input when subMenu 'turnInto' opens
  useEffect(() => {
    if (subMenu === 'turnInto') {
      setTimeout(() => turnIntoInputRef.current?.focus(), 50);
    } else {
      setTurnIntoSearch('');
    }
  }, [subMenu]);

  // Viewport correction
  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const pad = 12;
      let x = position.x;
      let y = position.y;
      if (x + rect.width > window.innerWidth - pad) x = window.innerWidth - rect.width - pad;
      if (y + rect.height > window.innerHeight - pad) y = window.innerHeight - rect.height - pad;
      x = Math.max(pad, x);
      y = Math.max(pad, y);
      y = Math.max(pad, y);
      setAdjustedPos({ x, y });
    }
  }, [position, subMenu]);

  // Click outside
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [onClose]);

  // Escape
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (subMenu) setSubMenu(null);
        else onClose();
      }
    };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [onClose, subMenu]);

  /* ── Grouped "Turn into" items ──────────────────── */
  const groupedTurnInto = useMemo(() => {
    const q = turnIntoSearch.toLowerCase().trim();
    const isTitleOrHeading = block.type === 'text' && ['title', 'heading', 'subheading'].includes(block.style ?? '');

    const filtered = TURN_INTO_ITEMS.filter(item => {
      const matchesSearch = item.label.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q);

      if (isTitleOrHeading && item.category === 'Lists') return false;

      return matchesSearch;
    });

    const groups: { category: string; items: TurnIntoItem[] }[] = [];
    for (const item of filtered) {
      const g = groups.find(x => x.category === item.category);
      if (g) g.items.push(item);
      else groups.push({ category: item.category, items: [item] });
    }
    return groups;
  }, [turnIntoSearch, block]);

  if (!block) return null;

  const btnCls = "popup-item";
  const dangerBtnCls = "popup-item-danger";
  const COLORS = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#F97316', '#06B6D4'];

  /* ── Render → Main menu & Color sub-menu ─────────────────────────── */
  if (subMenu === null || subMenu === 'color') {
    return (
      <>
        <div
          ref={menuRef}
          className="fixed z-[200] flex flex-col popup-glass-small overflow-hidden min-w-[200px] gap-[3px]"
          style={{ left: adjustedPos.x, top: adjustedPos.y }}
        >
          <button className={cn(btnCls, "justify-between")} onClick={() => setSubMenu('turnInto')}>
            <span className="flex items-center gap-3"><ArrowRightFromLine strokeWidth={2} className="w-4 h-4" /> Turn into</span>
            <ChevronRight strokeWidth={2} className="w-3.5 h-3.5 text-muted-foreground/50" />
          </button>
          {!['database', 'table', 'image', 'video', 'embed'].includes(block.type) && !(block.type === 'text' && block.style === 'mono') && (
            <button className={cn(btnCls, "justify-between", subMenu === 'color' && "bg-[var(--bone-6)]")} onClick={(e) => { e.stopPropagation(); setSubMenu(subMenu === 'color' ? null : 'color'); }}>
              <span className="flex items-center gap-2.5"><Paintbrush strokeWidth={2} className="w-4 h-4" /> Color</span>
              <ChevronRight strokeWidth={2} className="w-3.5 h-3.5 text-muted-foreground/50" />
            </button>
          )}
          {['title', 'heading', 'subheading'].includes(block.style || '') && (
            <>
              <button
                className={cn(btnCls, "justify-between")}
                onClick={() => {
                  const newEnabled = !block.foldingEnabled;
                  onUpdate(block.id, {
                    foldingEnabled: newEnabled,
                    isFolded: newEnabled ? block.isFolded : false
                  });
                }}
              >
                <span className="flex items-center gap-2.5"><SeparatorHorizontal strokeWidth={2} className="w-4 h-4" /> Fold content</span>
                <Toggle
                  size="sm"
                  checked={!!block.foldingEnabled}
                  onChange={() => { }}
                  className="pointer-events-none"
                />
              </button>
              <div className="h-px bg-border/50 my-1 mx-2" />
            </>
          )}
          <button className={btnCls} onClick={() => { onMoveToTop(block.id); onClose(); }}>
            <Pin strokeWidth={2} className="w-4 h-4" /> Pin to top
          </button>
          <button className={btnCls} onClick={() => { copyBlock(block); onClose(); }}>
            <Copy strokeWidth={2} className="w-4 h-4" /> Copy
          </button>
          {copiedBlock && (
            <button className={btnCls} onClick={() => { pasteBlock(entityId, block.id); onClose(); }}>
              <ClipboardPaste strokeWidth={2} className="w-4 h-4" /> Paste after
            </button>
          )}
          <button className={btnCls} onClick={() => { onDuplicate(block.id); onClose(); }}>
            <Copy strokeWidth={2} className="w-4 h-4" /> Duplicate
          </button>
          {onMoveTo && (
            <button className={btnCls} onClick={() => { onMoveTo(block.id); onClose(); }}>
              <FolderInput strokeWidth={2} className="w-4 h-4" /> Move to
            </button>
          )}
          {(block.type === 'column' && onAddColumn) && (
            <button className={btnCls} onClick={() => { onAddColumn(block.id); onClose(); }}>
              <Plus strokeWidth={2} className="w-4 h-4" /> Add Column
            </button>
          )}
          <div className="h-px bg-border/50 my-1 mx-2" />
          <button className={dangerBtnCls} onClick={() => { onDelete(block.id); onClose(); }}>
            <Trash2 strokeWidth={2} className="w-4 h-4" /> Delete
          </button>
        </div>

        {subMenu === 'color' && (
          <div
            className="fixed z-[201] flex flex-col popup-glass-small overflow-hidden min-w-[160px] py-1.5 px-0 gap-2"
            style={{ left: adjustedPos.x + 204, top: adjustedPos.y + 36 }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col gap-2 px-2 pb-1">
              <button
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onUpdate(block.id, { bgColor: undefined });
                  onClose();
                }}
                className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-[8px] text-[13px] font-medium cursor-pointer transition-none text-[var(--bone-70)] hover:bg-[var(--bone-5)]"
              >
                <CircleDashed className="w-3.5 h-3.5 shrink-0 text-[var(--bone-40)]" />
                <span>None</span>
                {!block.bgColor && <Check className="w-3 h-3 text-[var(--bone-60)] shrink-0 ml-auto" />}
              </button>
              <div className="grid grid-cols-4 gap-2 px-1 pb-0.5 place-items-center">
                {COLORS.slice(0, 4).map(c => (
                  <button
                    key={c}
                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onUpdate(block.id, { bgColor: block.bgColor === c ? undefined : c });
                      onClose();
                    }}
                    className={cn(
                      "w-7 h-7 rounded-full transition-all cursor-pointer flex items-center justify-center",
                      block.bgColor === c ? "scale-110 ring-1 ring-[var(--bone-70)] ring-offset-2 ring-offset-[var(--color-panel)]" : "opacity-50 hover:opacity-100"
                    )}
                    style={{ backgroundColor: c }}
                    title={c}
                  >
                    {block.bgColor === c && <Check className="w-3.5 h-3.5 text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]" />}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-4 gap-2 px-1 pb-0 place-items-center">
                {COLORS.slice(4, 8).map(c => (
                  <button
                    key={c}
                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onUpdate(block.id, { bgColor: block.bgColor === c ? undefined : c });
                      onClose();
                    }}
                    className={cn(
                      "w-7 h-7 rounded-full transition-all cursor-pointer flex items-center justify-center",
                      block.bgColor === c ? "scale-110 ring-1 ring-[var(--bone-70)] ring-offset-2 ring-offset-[var(--color-panel)]" : "opacity-50 hover:opacity-100"
                    )}
                    style={{ backgroundColor: c }}
                    title={c}
                  >
                    {block.bgColor === c && <Check className="w-3.5 h-3.5 text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  /* ── Render → Turn into sub-menu ────────────────── */
  if (subMenu === 'turnInto') {
    return (
      <div
        ref={menuRef}
        // popup-glass-small is also the marker NoteEditor's document-level
        // mousedown handler checks (`target.closest('.popup-glass-small')`) to
        // know a click landed inside an active popup rather than empty space.
        // Without it, clicking any "turn into" item closed the whole menu on
        // mousedown — before the button's click/onTurnInto ever fired.
        className="fixed z-[200] flex flex-col w-72 p-2 rounded-xl popup-glass-small bg-panel border border-[var(--bone-10)] shadow-lg overflow-hidden max-h-[400px]"
        style={{ left: adjustedPos.x, top: adjustedPos.y }}
      >
        <button
          type="button"
          className="flex items-center gap-1.5 mb-2 px-2 py-1.5 w-full rounded-md hover:bg-[var(--bone-6)] transition-colors text-[13px] font-medium text-[var(--bone-100)] opacity-60 hover:opacity-100 cursor-pointer text-left"
          onClick={() => setSubMenu(null)}
        >
          <ChevronLeft strokeWidth={2} className="w-4 h-4" />
          Turn into
        </button>
        {/* Search field — matches AddExistingEntityPopover */}
        <div className="relative mb-2">
          <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
            <Search className="w-[14px] h-[14px] text-[var(--bone-100)] opacity-70" strokeWidth={2} />
          </div>
          <input
            ref={turnIntoInputRef}
            type="text"
            placeholder="Search blocks…"
            value={turnIntoSearch}
            onChange={(e) => setTurnIntoSearch(e.target.value)}
            className={cn(
              'w-full bg-[var(--bone-6)] border border-transparent hover:border-[var(--bone-12)]',
              'focus:border-[var(--brand-blue)] focus:shadow-[0_0_0_0.5px_var(--brand-blue)]',
              'rounded-md pl-9 py-1.5 text-[13px] text-bone-100 placeholder:text-bone-70/50',
              'outline-none transition-colors',
              turnIntoSearch ? 'pr-8' : 'pr-3',
            )}
          />
          {turnIntoSearch && (
            <button
              type="button"
              onClick={() => setTurnIntoSearch('')}
              aria-label="Clear search"
              className="absolute inset-y-0 right-0 pr-2 flex items-center text-[var(--bone-100)] opacity-40 hover:opacity-100 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" strokeWidth={2.5} />
            </button>
          )}
        </div>
        {/* Items list */}
        <div className="flex flex-col gap-[1px] max-h-64 overflow-y-auto">
          {groupedTurnInto.length > 0 ? (
            groupedTurnInto.map(group => (
              <div key={group.category}>
                <div className="px-2 pt-2 pb-1 text-[11px] font-semibold text-muted-foreground/40 uppercase tracking-wider">
                  {group.category}
                </div>
                {group.items.map(item => {
                  const isCurrentType = block.type === item.type && (item.extra?.style === undefined || block.style === item.extra.style);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={cn(
                        "flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-[12px] hover:bg-[var(--app-dark)] text-left transition-colors cursor-pointer",
                        isCurrentType && "bg-[var(--bone-6)]"
                      )}
                      onClick={() => {
                        onTurnInto(block.id, item.type, { ...item.extra, content: block.content });
                        onClose();
                      }}
                    >
                      <span className="text-[var(--bone-100)] opacity-60 shrink-0">{item.icon}</span>
                      <span className="truncate text-foreground">{item.label}</span>
                      <div className="ml-auto flex items-center gap-2">
                        {item.shortcut && <span className="text-[10px] text-[var(--bone-100)] opacity-40 font-mono tracking-wider">{item.shortcut}</span>}
                        {isCurrentType && <Check className="w-3.5 h-3.5 text-[var(--brand-blue)]" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            ))
          ) : (
            <p className="text-[11px] text-[var(--bone-30)] text-center py-3">
              No blocks found for &ldquo;{turnIntoSearch}&rdquo;
            </p>
          )}
        </div>
      </div>
    );
  }
  return null;
}

