"use client";

import { useState, useRef, useEffect, useMemo } from 'react';
import {
  ArrowRightFromLine, Paintbrush, Pin, Copy, FolderInput, Trash2,
  Type, Heading1, Heading2, FileText, Code,
  List, Minus, ListOrdered, CheckSquare, Quote,
  Columns2, Columns3, Columns4, SeparatorHorizontal,
  FileInput, Table, Kanban, GalleryHorizontalEnd, ListFilter,
  ChevronRight, ChevronLeft, Search, Plus, ImageIcon, Video, ClipboardPaste
, Check} from 'lucide-react';
import clsx from 'clsx';
import { useStore } from '@/data/store';
import { Toggle } from '@/components/ui/Toggle';
import type { EditorBlock, BlockType, DatabaseViewType } from '@/data/store';

/* ────────────────────────────────────────────────── */
/*  Color palette                                     */
/* ────────────────────────────────────────────────── */

const BLOCK_COLORS = [
  { id: 'default', label: 'Default', hex: undefined },
  { id: 'accent', label: 'Accent', hex: 'var(--accent)' },
  { id: 'red', label: 'Red', hex: 'var(--color-danger)' },
  { id: 'yellow', label: 'Yellow', hex: '#ffbc42' },
  { id: 'blue', label: 'Blue', hex: '#1d4e89' },
  { id: 'purple', label: 'Purple', hex: '#54478c' },
  { id: 'green', label: 'Green', hex: '#1b998b' },
  { id: 'grey', label: 'Grey', hex: '#888888' },
] as const;

function hexToRgba(hex: string, alpha: number): string {
  if (hex.startsWith('var(')) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

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
}

const TURN_INTO_ITEMS: TurnIntoItem[] = [
  { id: 'title', label: 'Title', icon: <Type strokeWidth={2} className={ICON_CLS} />, category: 'Text', type: 'text', extra: { style: 'title' } },
  { id: 'heading', label: 'Heading', icon: <Heading1 strokeWidth={2} className={ICON_CLS} />, category: 'Text', type: 'text', extra: { style: 'heading' } },
  { id: 'subheading', label: 'Subheading', icon: <Heading2 strokeWidth={2} className={ICON_CLS} />, category: 'Text', type: 'text', extra: { style: 'subheading' } },
  { id: 'body', label: 'Body', icon: <FileText strokeWidth={2} className={ICON_CLS} />, category: 'Text', type: 'text', extra: { style: 'body' } },
  { id: 'mono', label: 'Mono', icon: <Code strokeWidth={2} className={ICON_CLS} />, category: 'Text', type: 'text', extra: { style: 'mono' } },
  { id: 'bullet', label: 'Bulleted List', icon: <List strokeWidth={2} className={ICON_CLS} />, category: 'Lists', type: 'bulletList' },
  { id: 'dashed', label: 'Dashed List', icon: <Minus strokeWidth={2} className={ICON_CLS} />, category: 'Lists', type: 'dashedList' },
  { id: 'numbered', label: 'Numbered List', icon: <ListOrdered strokeWidth={2} className={ICON_CLS} />, category: 'Lists', type: 'numberedList' },
  { id: 'checklist', label: 'Checklist', icon: <CheckSquare strokeWidth={2} className={ICON_CLS} />, category: 'Lists', type: 'checklist' },
  { id: 'quote', label: 'Quote', icon: <Quote strokeWidth={2} className={ICON_CLS} />, category: 'Layout', type: 'quote' },
  { id: 'divider', label: 'Divider', icon: <SeparatorHorizontal strokeWidth={2} className={ICON_CLS} />, category: 'Layout', type: 'divider' },
  { id: '2col', label: '2 Columns', icon: <Columns2 strokeWidth={2} className={ICON_CLS} />, category: 'Layout', type: 'columns', extra: { columnCount: 2 } },
  { id: '3col', label: '3 Columns', icon: <Columns3 strokeWidth={2} className={ICON_CLS} />, category: 'Layout', type: 'columns', extra: { columnCount: 3 } },
  { id: '4col', label: '4 Columns', icon: <Columns4 strokeWidth={2} className={ICON_CLS} />, category: 'Layout', type: 'columns', extra: { columnCount: 4 } },
  { id: 'embed', label: 'Embed Subpage', icon: <FileInput strokeWidth={2} className={ICON_CLS} />, category: 'Embed', type: 'embed' },
  { id: 'table', label: 'Simple Table', icon: <Table strokeWidth={2} className={ICON_CLS} />, category: 'Embed', type: 'table' },
  { id: 'image', label: 'Image', icon: <ImageIcon strokeWidth={2} className={ICON_CLS} />, category: 'Media', type: 'image' },
  { id: 'video', label: 'Video', icon: <Video strokeWidth={2} className={ICON_CLS} />, category: 'Media', type: 'video' },
  { id: 'db-table', label: 'Table View', icon: <Table strokeWidth={2} className={ICON_CLS} />, category: 'Database', type: 'database', extra: { dbViewType: 'table' as DatabaseViewType } },
  { id: 'db-board', label: 'Board View', icon: <Kanban strokeWidth={2} className={ICON_CLS} />, category: 'Database', type: 'database', extra: { dbViewType: 'board' as DatabaseViewType } },
  { id: 'db-gallery', label: 'Gallery View', icon: <GalleryHorizontalEnd strokeWidth={2} className={ICON_CLS} />, category: 'Database', type: 'database', extra: { dbViewType: 'gallery' as DatabaseViewType } },
  { id: 'db-list', label: 'List View', icon: <ListFilter strokeWidth={2} className={ICON_CLS} />, category: 'Database', type: 'database', extra: { dbViewType: 'list' as DatabaseViewType } },
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

  /* ── Render → Main menu ─────────────────────────── */
  if (subMenu === null) {
    return (
      <div
        ref={menuRef}
        className="fixed z-[200] flex flex-col popup-glass-small overflow-hidden min-w-[200px] p-1.5 gap-[3px]"
        style={{ left: adjustedPos.x, top: adjustedPos.y }}
      >
        <button className={clsx(btnCls, "justify-between")} onClick={() => setSubMenu('turnInto')}>
          <span className="flex items-center gap-3"><ArrowRightFromLine strokeWidth={2} className="w-4 h-4" /> Turn into</span>
          <ChevronRight strokeWidth={2} className="w-3.5 h-3.5 text-muted-foreground/50" />
        </button>
        <button className={clsx(btnCls, "justify-between")} onClick={() => setSubMenu('color')}>
          <span className="flex items-center gap-2.5"><Paintbrush strokeWidth={2} className="w-4 h-4" /> Color</span>
          <ChevronRight strokeWidth={2} className="w-3.5 h-3.5 text-muted-foreground/50" />
        </button>
        {['title', 'heading', 'subheading'].includes(block.style || '') && (
          <>
            <button 
              className={clsx(btnCls, "justify-between")}
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
                onChange={() => {}} 
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
    );
  }

  /* ── Render → Turn into sub-menu ────────────────── */
  if (subMenu === 'turnInto') {
    return (
      <div
        ref={menuRef}
        className="fixed z-[200] flex flex-col popup-glass-small overflow-hidden min-w-[260px] max-h-[400px] pt-1.5 pb-1.5 pl-1.5 pr-0 gap-[3px]"
        style={{ left: adjustedPos.x, top: adjustedPos.y }}
      >
        <button
          className={clsx(btnCls, "mr-1.5")}
          onClick={() => setSubMenu(null)}
        >
          <ChevronLeft strokeWidth={2} className="w-3.5 h-3.5" /> Turn into
        </button>
        <div className="px-2 py-1.5 bg-hover/20 mr-1.5">
          <div className="relative">
            <Search strokeWidth={2} className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
            <input
              ref={turnIntoInputRef}
              type="text"
              placeholder="Search blocks..."
              value={turnIntoSearch}
              onChange={(e) => setTurnIntoSearch(e.target.value)}
              className="w-full bg-hover/50 text-xs pl-8 pr-2.5 py-1.5 rounded-[var(--radius-medium)] outline-none placeholder:text-muted-foreground/30 border border-transparent focus:border-[var(--bone-6)] "
            />
          </div>
        </div>
        <div className="popup-divider mr-1.5" />
        <div className="overflow-y-auto scrollbar-thin flex-1 min-h-[160px] flex flex-col gap-[3px] pr-1.5">
          {groupedTurnInto.length > 0 ? (
            groupedTurnInto.map(group => (
              <div key={group.category} className="pb-1 flex flex-col gap-[3px]">
                <div className="px-3.5 pt-2 pb-1 text-[11px] font-semibold text-muted-foreground/40 uppercase tracking-wider">
                  {group.category}
                </div>
                {group.items.map(item => {
                  const isSelected = block.type === item.type && (item.extra?.style === undefined || block.style === item.extra.style);
                  return (
                    <button
                      key={item.id}
                      className={clsx(
                        "popup-item border-none",
                        isSelected && "bg-hover text-foreground"
                      )}
                      onClick={() => {
                        onTurnInto(block.id, item.type, { ...item.extra, content: block.content });
                        onClose();
                      }}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-accent ml-auto" />}
                    </button>
                  );
                })}
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-xs text-muted-foreground">
              No types found for &ldquo;{turnIntoSearch}&rdquo;
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ── Render → Color sub-menu ────────────────────── */
  if (subMenu === 'color') {
    return (
      <div
        ref={menuRef}
        className="fixed z-[200] flex flex-col popup-glass-small overflow-hidden min-w-[220px] p-1.5 gap-[3px]"
        style={{ left: adjustedPos.x, top: adjustedPos.y }}
      >
        <button className={btnCls} onClick={() => setSubMenu(null)}>
          <ChevronLeft strokeWidth={2} className="w-3.5 h-3.5" /> Color
        </button>
        <div className="popup-divider" />
        <div className="flex flex-col gap-[3px]">
        <div className="px-3.5 pt-2.5 pb-1.5 text-[11px] font-semibold text-muted-foreground/40 uppercase tracking-wider">
          Text color
        </div>
        <div className="flex items-center gap-1.5 px-3.5 pb-2">
          {BLOCK_COLORS.map(c => {
            const isActive = (c.hex ?? undefined) === (block.textColor ?? undefined);
            return (
              <button
                key={c.id}
                title={c.label}
                onClick={() => {
                  onUpdate(block.id, { textColor: c.hex ?? undefined });
                }}
                className={clsx(
                  "w-5 h-5 rounded-[var(--radius-small)] ",
                  isActive ? "border-foreground" : "border-transparent"
                )}
                style={{
                  backgroundColor: c.hex
                    ? (c.hex.startsWith('var(') ? 'var(--accent)' : c.hex)
                    : 'var(--muted-foreground)',
                }}
              >
                {c.id === 'default' && (
                  <span className="text-[9px] font-bold text-white">A</span>
                )}
              </button>
            );
          })}
        </div>
        </div>
        <div className="popup-divider" />
        <div className="flex flex-col gap-[3px]">
        <div className="px-3.5 pt-2.5 pb-1.5 text-[11px] font-semibold text-muted-foreground/40 uppercase tracking-wider">
          Background color
        </div>
        <div className="flex items-center gap-1.5 px-3.5 pb-3">
          {BLOCK_COLORS.map(c => {
            const isActive = (c.hex ?? undefined) === (block.bgColor ?? undefined);
            const bgPreview = c.hex
              ? (c.hex.startsWith('var(')
                ? 'color-mix(in srgb, var(--accent) 20%, transparent)'
                : hexToRgba(c.hex, 0.20))
              : 'var(--hover-background)';
            return (
              <button
                key={c.id}
                title={c.label}
                onClick={() => {
                  onUpdate(block.id, { bgColor: c.hex ?? undefined });
                }}
                className={clsx(
                  "w-5 h-5 rounded-[var(--radius-small)] ",
                  isActive ? "border-foreground" : "border-transparent"
                )}
                style={{ backgroundColor: bgPreview }}
              >
                {c.id === 'default' && (
                  <span className="text-[9px] font-bold text-muted-foreground">–</span>
                )}
              </button>
            );
          })}
        </div>
        </div>
      </div>
    );
  }

  return null;
}

