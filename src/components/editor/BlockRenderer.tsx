"use client";

import {
  GripVertical, Plus, ChevronRight, ChevronDown, Copy, Link as LinkIcon, ExternalLink
} from 'lucide-react';
import { Tooltip } from '@/components/layout/Tooltip';
import { cn } from '@/lib/utils';
import { EditorBlock, BlockStyle, BlockType, Entity, generateId } from '@/data/store';
import { ListBlock } from './ListBlock';
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useStore } from '@/data/store';
import { DatabaseBlock } from './DatabaseBlock';
import { TableBlock } from './TableBlock';
import { draggable, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { attachClosestEdge, type Edge, extractClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';

interface BlockViewProps {
  block: EditorBlock;
  index: number;
  onUpdate: (id: string, updates: Partial<EditorBlock>) => void;
  onDelete: (id: string) => void;
  onInsertAfter: (afterId: string, forceType?: BlockType, openSlash?: boolean) => void;
  onSlash: (blockId: string, rect: DOMRect) => void;
  listNumber?: number;
  slashMenuOpen?: boolean;
  menuOpen?: boolean;
  onOpenMenu: (id: string, position: { x: number; y: number }, shiftKey?: boolean) => void;
  onFocus?: (id: string) => void;
  isSelected?: boolean;
  isInsideColumn?: boolean;
  isDragging?: boolean;
  style?: React.CSSProperties;
  onDragStart?: (id: string, e: React.DragEvent) => void;
  depth?: number;
}

// Consolidated BlockRenderer logic below.

export function BlockRenderer({
  block,
  index,
  onUpdate,
  onDelete,
  onInsertAfter,
  onSlash,
  listNumber,
  slashMenuOpen,
  menuOpen,
  onOpenMenu,
  onFocus,
  onIndent,
  onUnindent,
  isSelected = false,
  isInsideColumn = false,
  onDragStart,
  isDragOverlay = false,
  depth = 0,
}: any) {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const dragHandleRef = useRef<HTMLDivElement | null>(null);
  const [isDraggingLocal, setIsDraggingLocal] = useState(false);
  const [closestEdge, setClosestEdge] = useState<Edge | null>(null);

  useEffect(() => {
    const el = elementRef.current;
    const dragHandle = dragHandleRef.current;
    if (!el || !dragHandle || isDragOverlay) return;

    return draggable({
      element: el,
      dragHandle: dragHandle,
      getInitialData: () => ({ type: 'note-block', blockId: block.id }),
      onDragStart: () => setIsDraggingLocal(true),
      onDrop: () => setIsDraggingLocal(false),
    });
  }, [block.id, isDragOverlay]);

  useEffect(() => {
    const el = elementRef.current;
    if (!el || isDragOverlay) return;

    return dropTargetForElements({
      element: el,
      canDrop: ({ source }) => source.data.type === 'note-block' && source.data.blockId !== block.id,
      getData: ({ input, element }) => attachClosestEdge(
        { type: 'note-block', blockId: block.id },
        { input, element, allowedEdges: ['top', 'bottom'] }
      ),
      onDragEnter: ({ self }) => setClosestEdge(extractClosestEdge(self.data)),
      onDrag: ({ self }) => setClosestEdge(extractClosestEdge(self.data)),
      onDragLeave: () => setClosestEdge(null),
      onDrop: () => setClosestEdge(null),
    });
  }, [block.id, isDragOverlay]);

  const isDragging = isDraggingLocal;

  const style = {
    position: 'relative' as const,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.4 : undefined,
  };

  const contentRef = useRef<HTMLDivElement>(null);
  const lastTypedContent = useRef<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const entities = useStore(s => s.entities);
  const setActiveEntityId = useStore(s => s.setActiveEntityId);

  const colorStyle = getBlockColorStyle(block);

  const isList = ['bulletList', 'dashedList', 'numberedList'].includes(block.type);
  const isChecklist = block.type === 'checklist';

  const handleInput = useCallback(() => {
    if (contentRef.current) {
      const newContent = contentRef.current.innerHTML;
      lastTypedContent.current = newContent;
      onUpdate(block.id, { content: newContent });
    }
  }, [block.id, onUpdate]);

  useEffect(() => {
    if (contentRef.current) {
      const shouldUpdate = lastTypedContent.current === null ||
        (contentRef.current.innerHTML !== block.content && block.content !== lastTypedContent.current);
      if (shouldUpdate) {
        contentRef.current.innerHTML = block.content;
      }
    }
    lastTypedContent.current = block.content;
  }, [block.content]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (slashMenuOpen && (e.key === 'Enter' || e.key === 'ArrowUp' || e.key === 'ArrowDown')) return;
    if (e.key === 'Enter') {
      // Shift+Enter = soft line break within block (browser default <br>)
      if (e.shiftKey) return;

      // Plain Enter = new item / new block below
      e.preventDefault();
      const isListLike = isList || isChecklist;
      const contentText = contentRef.current?.textContent ?? '';

      // Empty list item → escape list (convert to plain text, no new block)
      if (isListLike && !contentText.trim()) {
        onUpdate(block.id, { type: 'text', content: '' });
        return;
      }

      // List item with children → insert new item as first child
      const hasChildren = !!(block.children && block.children.length > 0);
      if (isListLike && hasChildren) {
        onInsertAfter(block.id, block.type, false, true);
        return;
      }

      // New block: same list type if on a list, else plain text
      onInsertAfter(block.id, isListLike ? block.type : 'text');
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        onUnindent(block.id);
      } else {
        onIndent(block.id);
      }
      return;
    }

    if (e.key === 'Backspace') {
      const domText = contentRef.current?.textContent ?? '';
      const isEmpty = !domText.trim();
      const isListLikeForBackspace = isList || isChecklist;

      if (isEmpty) {
        e.preventDefault();
        if (isListLikeForBackspace && depth > 0) {
          // Nested empty list item: unindent back to parent level
          onUnindent(block.id);
        } else if (isListLikeForBackspace) {
          // Top-level empty list item: convert to plain text
          onUpdate(block.id, { type: 'text', content: '' });
        } else if (index > 0) {
          onDelete(block.id);
        }
        return;
      }
    }


    if (e.key === ' ' && contentRef.current) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        const node = range.startContainer;
        const offset = range.startOffset;
        if (node.nodeType === Node.TEXT_NODE) {
          const txt = node.textContent || "";
          const before = txt.substring(0, offset);
          const shortcuts: Record<string, string> = {
            '-->': '⟶', '->': '→', '==>': '⇒',
            '<--': '⟵', '<-': '←', '<==': '⇐',
            '<->': '↔', '/arrowdown': '↓', '/arrowup': '↑',
            '/arrowright': '→', '/arrowleft': '←'
          };
          for (const [trig, repl] of Object.entries(shortcuts)) {
            if (before.endsWith(trig)) {
              e.preventDefault();
              range.setStart(node, offset - trig.length);
              range.setEnd(node, offset);
              sel.removeAllRanges();
              sel.addRange(range);
              document.execCommand('insertText', false, repl + ' ');
              return;
            }
          }
        }
      }

      const text = contentRef.current.textContent ?? '';

      const transform = (updates: Partial<EditorBlock>) => {
        e.preventDefault();
        if (contentRef.current) contentRef.current.innerHTML = '';
        onUpdate(block.id, { content: '', ...updates });
      };

      if (text === '#') return transform({ type: 'text', style: 'title' });
      if (text === '##') return transform({ type: 'text', style: 'heading' });
      if (text === '###') return transform({ type: 'text', style: 'subheading' });
      if (text === '-') return transform({ type: 'bulletList' });
      if (text === '1.') return transform({ type: 'numberedList' });
      if (text === '[]') return transform({ type: 'checklist', checked: false });
      if (text === '"' || text === '>') return transform({ type: 'quote' });
      if (text === '```') return transform({ type: 'text', style: 'mono' });
      if (text === '---') return transform({ type: 'divider' });
      if (text === '/table' || text === '|') return transform({ type: 'table', tableData: [['', '', ''], ['', '', ''], ['', '', '']] });
    }

    if (e.key === '/' && contentRef.current) {
      const text = contentRef.current.textContent ?? '';
      if (text === '' || text === '/') {
        setTimeout(() => {
          const rect = contentRef.current?.getBoundingClientRect();
          if (rect) onSlash(block.id, rect);
        }, 10);
      }
    }
  }, [block.id, block.type, block.children, index, depth, isList, isChecklist, onInsertAfter, onDelete, onUpdate, onSlash, onIndent, onUnindent, slashMenuOpen]);

  const handleContentClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const anchor = target.closest('a');
    if (anchor) {
      e.preventDefault();
      e.stopPropagation();
      window.open(anchor.href, '_blank', 'noopener,noreferrer');
    }
  }, []);

  const isQuote = block.type === 'quote';
  const effectiveStyle = (isList || isChecklist) ? 'body' : block.style;
  const controlsProps = {
    blockId: block.id,
    menuOpen: menuOpen,
    onInsertAfter: onInsertAfter,
    onOpenMenu: onOpenMenu,
    onDragStart: onDragStart,
    isDragging: isDragOverlay,
    blockStyle: effectiveStyle,
    hasBgColor: !!block.bgColor,
    isFocused,
    isSelected,
    dragHandleRef
  };

  // ─── Divider ──────────────────────────────────────────
  if (block.type === 'divider') {
    return (
      <div
        ref={elementRef}
        data-block-id={block.id}
        style={style}
        className={cn("editor-block group flex flex-col items-start relative px-1 before:absolute before:right-full before:top-0 before:bottom-0 before:w-16 before:content-['']")}
      >
        <BlockControls {...controlsProps} topOffset="2px" />
        <div className={cn(
          "flex items-center w-full py-4 relative group rounded-[var(--radius-medium)] transition-colors duration-0",
          isSelected && "bg-[var(--app-dark)]",
          isDragging && "bg-sidebar/80 rounded-[var(--radius-medium)]"
        )}>
          <div className="flex-1 h-px bg-[var(--bone-12)]" />
        </div>
        {closestEdge && (
          <div
            className={cn(
              "absolute left-0 right-0 h-[2px] bg-[var(--bone-35)] rounded-full pointer-events-none z-50",
              closestEdge === 'top' ? 'top-0' : 'bottom-0'
            )}
          />
        )}
      </div>
    );
  }

  // ─── Database ─────────────────────────────────────────
  if (block.type === 'database') {
    return (
      <div
        ref={elementRef}
        data-block-id={block.id}
        style={{ ...style, ...colorStyle }}
        className={cn("editor-block group py-2 relative flex flex-col items-stretch before:absolute before:right-full before:top-0 before:bottom-0 before:w-16 before:content-['']")}
      >
        <BlockControls {...controlsProps} topOffset="8px" />
        <div className={cn(
          "relative w-full rounded-3xl transition-colors duration-0",
          isSelected && "bg-[var(--app-dark)]"
        )}>
          <DatabaseBlock block={block} onUpdate={onUpdate} />
        </div>
        {closestEdge && (
          <div
            className={cn(
              "absolute left-0 right-0 h-[2px] bg-[var(--bone-35)] rounded-full pointer-events-none z-50",
              closestEdge === 'top' ? 'top-0' : 'bottom-0'
            )}
          />
        )}
      </div>
    );
  }

  // ─── Table ────────────────────────────────────────────
  if (block.type === 'table') {
    return (
      <div
        ref={elementRef}
        data-block-id={block.id}
        style={{ ...style, ...colorStyle }}
        className={cn("editor-block group py-2 relative flex flex-col items-stretch before:absolute before:right-full before:top-0 before:bottom-0 before:w-16 before:content-['']")}
      >
        <BlockControls {...controlsProps} topOffset="8px" />
        <div className={cn(
          "relative w-full rounded-3xl transition-colors duration-0 group/table",
          isSelected && "bg-[var(--app-dark)]"
        )}>
          <TableBlock block={block} onUpdate={onUpdate} />
        </div>
        {closestEdge && (
          <div
            className={cn(
              "absolute left-0 right-0 h-[2px] bg-[var(--bone-35)] rounded-full pointer-events-none z-50",
              closestEdge === 'top' ? 'top-0' : 'bottom-0'
            )}
          />
        )}
      </div>
    );
  }

  // ─── Image / Video ────────────────────────────────────
  if (block.type === 'image' || block.type === 'video') {
    const isImage = block.type === 'image';
    const widthClass = block.mediaWidth === 1 ? 'w-1/4' : block.mediaWidth === 2 ? 'w-1/2' : block.mediaWidth === 3 ? 'short-w-3/4' : 'w-full';
    let videoUrl = block.mediaUrl || '';
    let isEmbed = false;
    if (!isImage) {
      if (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) {
        isEmbed = true;
        const vid = videoUrl.includes('v=') ? videoUrl.split('v=')[1].split('&')[0] : videoUrl.split('/').pop();
        videoUrl = `https://www.youtube.com/embed/${vid}`;
      } else if (videoUrl.includes('vimeo.com')) {
        isEmbed = true;
        const vid = videoUrl.split('/').pop();
        videoUrl = `https://player.vimeo.com/embed/${vid}`;
      }
    }
    const alignVariant = block.align || 'left';

    return (
      <div
        ref={elementRef}
        data-block-id={block.id}
        className={cn(
          "editor-block group py-2 relative flex flex-col items-stretch before:absolute before:right-full before:top-0 before:bottom-0 before:w-16 before:content-['']",
          alignVariant === 'center' && "items-center",
          alignVariant === 'right' && "items-end",
          alignVariant === 'left' && "items-start"
        )}
        style={{ ...style }}
      >
        <BlockControls {...controlsProps} topOffset="8px" />
        <div className={cn(
          "relative w-full transition-colors duration-0",
          isSelected && "bg-[var(--app-dark)] rounded-3xl"
        )}>
          <div className={cn("relative group/media border border-white/5 bg-white/5", widthClass, "rounded-3xl ")}>
            <MediaControls blockId={block.id} currentWidth={block.mediaWidth || 4} onWidthChange={(w) => onUpdate(block.id, { mediaWidth: w as any })} />
            <div className="overflow-hidden rounded-3xl">
              {isImage ? (
                <img src={block.mediaUrl} alt={block.mediaCaption || 'Image'} className="w-full h-auto object-cover select-none" onError={(e) => (e.currentTarget.src = 'https://images.unsplash.com/photo-1544391496-1ca7c97651a2?q=80&w=2000&auto=format&fit=crop')} />
              ) : (
                <div className="aspect-video bg-black/40 flex items-center justify-center">
                  {isEmbed ? <iframe src={videoUrl} className="w-full h-full border-none" allowFullScreen /> : <video src={videoUrl} controls className="w-full h-full" />}
                </div>
              )}
              <input type="text" placeholder="Add a caption..." value={block.mediaCaption || ''} onChange={(e) => onUpdate(block.id, { mediaCaption: e.target.value })} className="w-full bg-white/[0.03] backdrop-blur-md px-5 py-3 text-[11px] font-medium text-muted-foreground/40 outline-none opacity-0 group-hover/media:opacity-100 focus:opacity-100 border-t border-white/5 focus:text-foreground/80 placeholder:opacity-20" />
            </div>
          </div>
        </div>
        {closestEdge && (
          <div
            className={cn(
              "absolute left-0 right-0 h-[2px] bg-[var(--bone-35)] rounded-full pointer-events-none z-50",
              closestEdge === 'top' ? 'top-0' : 'bottom-0'
            )}
          />
        )}
      </div>
    );
  }

  // ─── Embed ──────────────────────────────────────────
  if (block.type === 'embed') {
    const linked = entities.find((e: Entity) => e.id === block.embedEntityId);
    return (
      <div
        ref={elementRef}
        data-block-id={block.id}
        style={{ ...style, ...colorStyle }}
        className={cn("editor-block group py-2 relative before:absolute before:right-full before:top-0 before:bottom-0 before:w-16 before:content-['']")}
      >
        <BlockControls {...controlsProps} topOffset="8px" />
        <div className={cn(
          "relative w-full transition-colors duration-0 rounded-3xl",
          isSelected && "bg-[var(--app-dark)]"
        )}>
          <div onClick={() => linked && setActiveEntityId(linked.id)} className="border border-white/5 rounded-3xl px-5 py-4 group-hover:bg-white/5 flex items-center gap-4 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent text-lg font-bold border border-accent/20 group-hover/embed:bg-accent/20">{linked?.title?.charAt(0) ?? '?'}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground tracking-tight truncate">{linked?.title ?? 'Untitled Page'}</p>
              <p className="text-[10px] font-bold text-muted-foreground/40   pt-0.5">{linked?.type ?? 'page'}</p>
            </div>
            <ExternalLink strokeWidth={2} className="w-4 h-4 text-muted-foreground/20 group-hover/embed:text-accent " />
          </div>
        </div>
        {closestEdge && (
          <div
            className={cn(
              "absolute left-0 right-0 h-[2px] bg-[var(--bone-35)] rounded-full pointer-events-none z-50",
              closestEdge === 'top' ? 'top-0' : 'bottom-0'
            )}
          />
        )}
      </div>
    );
  }

  // ─── Link Block ───────────────────────────────────────
  if (block.type === 'link') {
    let faviconUrl = '';
    try {
      if (block.linkUrl) faviconUrl = `https://www.google.com/s2/favicons?domain=${new URL(block.linkUrl).hostname}&sz=32`;
    } catch (e) { }

    return (
      <div
        ref={elementRef}
        data-block-id={block.id}
        style={{ ...style, ...colorStyle }}
        className={cn("editor-block group py-1.5 relative flex flex-col items-start before:absolute before:right-full before:top-0 before:bottom-0 before:w-16 before:content-['']")}
      >
        <BlockControls {...controlsProps} topOffset="6px" />
        <div className="flex items-center gap-3 group/link ml-4 relative z-10">
          <a
            href={block.linkUrl || '#'}
            onClick={(e) => { if (!block.linkUrl) e.preventDefault(); }}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-accent/10 hover:bg-accent/20 rounded-lg text-[14px] font-medium text-accent border border-accent/20 transition-all duration-200 select-none"
          >
            {faviconUrl ? (
              <img src={faviconUrl} className="w-3.5 h-3.5 object-contain rounded-sm shrink-0" alt="" />
            ) : (
              <LinkIcon className="w-3.5 h-3.5 shrink-0" />
            )}
            <span
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) => onUpdate(block.id, { content: e.currentTarget.textContent || '' })}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }}
              className="min-w-[40px] outline-none border-b border-transparent focus:border-accent/40"
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
            >
              {block.content || 'Link Label'}
            </span>
            <ExternalLink className="w-3 h-3 opacity-50 shrink-0" />
          </a>

          <div className="opacity-0 group-hover/link:opacity-100 transition-opacity duration-200 flex items-center bg-[#151515]/80 backdrop-blur border border-white/5 rounded-md px-2 py-1 relative z-20">
            <input
              type="text"
              placeholder="Paste URL here..."
              className="bg-transparent border-none outline-none text-[11px] w-[180px] text-bone-70 focus:text-bone-90 font-sans"
              defaultValue={block.linkUrl || ''}
              onBlur={(e) => onUpdate(block.id, { linkUrl: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
            />
          </div>
        </div>
        {closestEdge && (
          <div
            className={cn(
              "absolute left-0 right-0 h-[2px] bg-[var(--bone-35)] rounded-full pointer-events-none z-50",
              closestEdge === 'top' ? 'top-0' : 'bottom-0'
            )}
          />
        )}
      </div>
    );
  }

  // ─── Column / Columns ────────────────────────────────
  if (block.type === 'column') {
    return (
      <div
        ref={elementRef}
        data-block-id={block.id}
        style={style}
        className={cn(
          "flex-1 basis-0 min-w-0 break-words rounded-[var(--radius-medium)] pl-14 pr-4 column-container relative group/column group-hover:bg-hover/10 group-focus-within:bg-hover/10 transition-colors duration-0",
          isSelected && "bg-[var(--app-dark)]",
          !block.children?.length && "empty"
        )}
      >
        <BlockControls variant="column" blockId={block.id} menuOpen={menuOpen} onInsertAfter={onInsertAfter} onOpenMenu={onOpenMenu} onDragStart={onDragStart} isSelected={isSelected} isFocused={false} topOffset="6px" />
        <div className={cn("flex flex-col gap-2 relative z-10")}>
          {(block.children || []).map((subBlock: EditorBlock, sIdx: number) => (
            <BlockRenderer key={subBlock.id} block={subBlock} index={sIdx} onUpdate={onUpdate} onDelete={onDelete} onIndent={onIndent} onUnindent={onUnindent} onInsertAfter={onInsertAfter} onSlash={onSlash} onOpenMenu={onOpenMenu} onFocus={onFocus} isInsideColumn={true} onDragStart={onDragStart} />
          ))}
        </div>
        {closestEdge && (
          <div
            className={cn(
              "absolute left-0 right-0 h-[2px] bg-[var(--bone-35)] rounded-full pointer-events-none z-50",
              closestEdge === 'top' ? 'top-0' : 'bottom-0'
            )}
          />
        )}
      </div>
    );
  }

  if (block.type === 'columns') {
    return (
      <div
        ref={elementRef}
        data-block-id={block.id}
        style={{ ...style, ...colorStyle }}
        className={cn("editor-block py-2 relative flex flex-col transition-colors duration-0 before:absolute before:right-full before:top-0 before:bottom-0 before:w-16 before:content-['']")}
      >
        <BlockControls {...controlsProps} topOffset="8px" />
        <div className={cn("flex gap-4 w-full h-full relative z-10 group")}>
          <div className="flex gap-4 w-full h-full">
            {(block.children || []).map((colBlock: EditorBlock, cIdx: number) => (
              <div key={colBlock.id} className="relative flex-1 basis-0 min-w-0 flex flex-col">
                <BlockRenderer block={colBlock} index={cIdx} onUpdate={onUpdate} onDelete={onDelete} onIndent={onIndent} onUnindent={onUnindent} onInsertAfter={onInsertAfter} onSlash={onSlash} onOpenMenu={onOpenMenu} onFocus={onFocus} isInsideColumn={true} onDragStart={onDragStart} />
              </div>
            ))}
          </div>
        </div>
        {closestEdge && (
          <div
            className={cn(
              "absolute left-0 right-0 h-[2px] bg-[var(--bone-35)] rounded-full pointer-events-none z-50",
              closestEdge === 'top' ? 'top-0' : 'bottom-0'
            )}
          />
        )}
      </div>
    );
  }

  if (isList || isChecklist) {
    return (
      <div
        ref={elementRef}
        data-block-id={block.id}
        className={cn(
          "editor-block group flex flex-col relative overflow-visible transition-all duration-0 py-0.5",
          "before:absolute before:right-full before:top-0 before:bottom-0 before:w-16 before:content-['']",
          isFocused && "focused",
          isSelected && "selected-block",
        )}
        style={{ ...style, fontFamily: '"Literata"', letterSpacing: '-0.01em' }}
      >
        <BlockControls {...controlsProps} topOffset="8px" />
        <div className={cn(
          "flex-1 flex items-start w-full relative rounded-[var(--radius-medium)] pl-3 pr-1 py-1 transition-all duration-0",
          isSelected ? "bg-[var(--app-dark)]" : "group-hover:bg-white/[0.01]"
        )}>
          <ListBlock
            block={block}
            listNumber={listNumber}
            onUpdate={onUpdate}
            onFocus={onFocus}
            onExitBottom={() => onInsertAfter(block.id, 'text')}
            onExitTop={() => {
              if (index > 0) {
                onUpdate(block.id, { type: 'text', content: '', children: undefined });
              } else {
                onUpdate(block.id, { type: 'text', content: '', children: undefined });
              }
            }}
          />
        </div>
        {closestEdge && (
          <div
            className={cn(
              "absolute left-0 right-0 h-[2px] bg-[var(--bone-35)] rounded-full pointer-events-none z-50",
              closestEdge === 'top' ? 'top-0' : 'bottom-0'
            )}
          />
        )}
      </div>
    );
  }

  const textTopOffset = effectiveStyle === 'mono' ? '20px' : (block.bgColor ? '10px' : '6px');

  return (
    <div
      ref={elementRef}
      data-block-id={block.id}
      className={cn(
        "editor-block group flex flex-col relative overflow-visible transition-all duration-0",
        effectiveStyle === 'mono' ? "py-2" : "py-0.5",
        "before:absolute before:right-full before:top-0 before:bottom-0 before:w-16 before:content-['']",
        isFocused && "focused",
        isSelected && "selected-block",
        isInsideColumn && "rounded-[var(--radius-medium)] break-words min-h-[100px] column-container hover:bg-hover/10",
        isInsideColumn && !block.content && "empty"
      )}
      style={{ ...style, fontFamily: '"Literata"', letterSpacing: '-0.01em' }}
      onMouseDown={() => onFocus?.(block.id)}
    >
      <BlockControls {...controlsProps} topOffset={textTopOffset} />
      <div
        className={cn(
          effectiveStyle === 'mono'
            ? "relative w-full rounded-3xl transition-colors duration-0"
            : "flex-1 flex items-start w-full relative min-h-[1.5em] transition-all duration-0 rounded-[var(--radius-medium)] pl-3 pr-1 py-1",
          (!isSelected && effectiveStyle !== 'mono') && (isFocused ? "bg-white/[0.01]" : "group-hover:bg-white/[0.01]"),
          block.bgColor && "border px-[16px] py-[8px]"
        )}
        style={{ ... (block.bgColor ? colorStyle : {}) }}
      >
        <div className="flex-1 flex items-start w-full min-h-[1.5em] h-full relative">
          {block.foldingEnabled && (
            <div
              className={cn(
                "mr-1.5 shrink-0 flex items-center justify-center cursor-pointer hover:bg-white/10 rounded transition-colors text-muted-foreground/40 hover:text-foreground",
                getLineHeightClass(effectiveStyle)
              )}
              style={{ width: '20px' }}
              onClick={(e) => {
                e.stopPropagation();
                onUpdate(block.id, { isFolded: !block.isFolded });
              }}
            >
              {block.isFolded ? <ChevronRight strokeWidth={2} className="w-4 h-4" /> : <ChevronDown strokeWidth={2} className="w-4 h-4" />}
            </div>
          )}
          <div
            ref={contentRef}
            contentEditable
            suppressContentEditableWarning
            spellCheck={effectiveStyle === 'mono' ? "false" : "true"}
            onFocus={() => { setIsFocused(true); onFocus?.(block.id); }}
            onBlur={() => setIsFocused(false)}
            data-placeholder={getPlaceholder(effectiveStyle, block.type, isFocused)}
            className={cn(
              "flex-1 outline-none min-h-[1.5em] leading-[1.6]",
              !block.textColor && "text-bone-100",
              getStyleClasses(effectiveStyle),
              isQuote && "italic text-muted-foreground",
              block.checked && "text-muted-foreground",
            )}
            dir="ltr"
            style={{
              textAlign: block.align ?? 'left',
              direction: 'ltr',
              ...(block.checked ? {
                color: 'var(--bone-30)',
                textDecoration: 'line-through',
                textDecorationThickness: '1px',
                textDecorationColor: 'var(--bone-70)',
              } : {}),
            }}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            onClick={handleContentClick}
            onPaste={(e) => {
              // Clean paste for mono code blocks always, and enforce text only for normal blocks to strip external styling
              e.preventDefault();
              const text = e.clipboardData.getData('text/plain');
              document.execCommand('insertText', false, text);
            }}
          />
          {effectiveStyle === 'mono' && (
            <button
              contentEditable={false}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                const text = contentRef.current?.textContent || '';
                navigator.clipboard.writeText(text);
              }}
              className="absolute top-2.5 right-3 px-2 py-1.5 rounded-md bg-white/[0.05] text-white/40 hover:bg-white/[0.1] hover:text-white border border-[var(--bone-6)] transition-all opacity-0 group-hover:opacity-100 select-none cursor-pointer z-20 flex items-center gap-1.5"

            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
      {closestEdge && (
        <div
          className={cn(
            "absolute left-0 right-0 h-[2px] bg-[var(--bone-35)] rounded-full pointer-events-none z-50",
            closestEdge === 'top' ? 'top-0' : 'bottom-0'
          )}
        />
      )}
    </div>
  );
}

function getStyleClasses(style?: BlockStyle): string {
  switch (style) {
    case 'title': return 'text-[28px] font-semibold tracking-[-0.02em] font-display leading-snug text-bone-100';
    case 'heading': return 'text-[24px] font-semibold tracking-[-0.02em] font-display leading-snug text-bone-100';
    case 'subheading': return 'text-[20px] font-semibold tracking-[-0.02em] font-display text-bone-100 leading-snug';
    case 'mono': return 'font-mono text-[15px] bg-panel border border-[var(--bone-6)] rounded-3xl px-4 py-3 leading-[1.6] overflow-x-auto whitespace-pre text-[var(--bone-100)] w-full';
    case 'body':
    default: return 'text-[16px] font-normal font-display leading-[1.6] tracking-[-0.02em] text-bone-100';
  }
}

function getLineHeightClass(style?: BlockStyle): string {
  switch (style) {
    case 'title':
    case 'heading':
    case 'subheading': return 'h-[1.3em]';
    case 'body':
    default: return 'h-[1.7em]';
  }
}

function getPlaceholder(style?: BlockStyle, type?: string, isFocused?: boolean): string {
  const isDefaultRow = (type === 'text' || !type) && (style === 'body' || !style);
  if (isDefaultRow) return isFocused ? "Type '/' for commands..." : "";
  if (type === 'checklist') return 'To-do...';
  if (type === 'quote') return 'Type a quote...';
  if (type === 'bulletList' || type === 'dashedList' || type === 'numberedList') return 'List item...';

  switch (style) {
    case 'title': return 'Title';
    case 'heading': return 'Heading';
    case 'subheading': return 'Subheading';
    case 'mono': return 'Code...';
    default: return "Type '/' for commands...";
  }
}

function hexToRgba(hex: string, alpha: number): string {
  if (hex.startsWith('var(')) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function getBlockColorStyle(block: EditorBlock): React.CSSProperties {
  const style: React.CSSProperties = {};
  if (block.textColor) {
    style.color = block.textColor;
  }
  if (block.bgColor) {
    style.backgroundColor = block.bgColor.startsWith('var(')
      ? 'color-mix(in srgb, var(--accent) 15%, transparent)'
      : hexToRgba(block.bgColor, 0.15);
    style.borderColor = block.bgColor.startsWith('var(')
      ? 'color-mix(in srgb, var(--accent) 15%, transparent)'
      : hexToRgba(block.bgColor, 0.15);
  }
  return style;
}

interface ControlsProps {
  blockId: string;
  menuOpen?: boolean;
  onInsertAfter: (afterId: string, forceType?: BlockType, openSlash?: boolean, inside?: boolean) => void;
  onOpenMenu: (id: string, position: { x: number; y: number }, shiftKey?: boolean) => void;
  isDragging?: boolean;
  variant?: 'standard' | 'column' | 'section';
  blockStyle?: string;
  hasBgColor?: boolean;
  isFocused?: boolean;
  isSelected?: boolean;
}

interface BlockControlsProps extends ControlsProps {
  onDragStart?: (id: string, e: React.DragEvent) => void;
  topOffset?: string;
  dragHandleRef?: React.RefObject<HTMLDivElement | null>;
}

function BlockControls({
  blockId,
  menuOpen,
  onInsertAfter,
  onOpenMenu,
  isDragging,
  onDragStart,
  blockStyle,
  hasBgColor,
  isFocused,
  isSelected,
  topOffset,
  dragHandleRef
}: BlockControlsProps) {
  const markerBtnClass = "w-7 h-7 flex items-center justify-center rounded-sm hover:bg-white/10 text-muted-foreground/40 hover:text-foreground transition-none";

  const handleGripClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    // User requested left side popup. Setting X to left edge - estimate menu width (approx 210px). 
    // BlockOptionsMenu has internal bounding logic to keep it safe inside screen width.
    onOpenMenu(blockId, { x: rect.left - 218, y: rect.top }, e.shiftKey);
  };

  const heightClass = getLineHeightClass(blockStyle as BlockStyle);

  return (
    <div
      className={cn(
        "absolute right-full pr-[8px] flex items-start justify-center gap-1",
        heightClass,
        (menuOpen || isDragging || isFocused || isSelected) ? "opacity-100 visible" : "opacity-0 invisible group-hover:opacity-100 group-hover:visible has-[:active]:opacity-100 has-[:active]:visible"
      )}
      style={{
        width: 'auto',
        minWidth: '42px',
        top: topOffset ?? (hasBgColor ? '0.5rem' : '0'),
        zIndex: 101,
        height: heightClass ? undefined : '1.5em'
      }}
    >
      <Tooltip content="Add below">
        <button onClick={() => onInsertAfter(blockId)} className={markerBtnClass}>
          <Plus strokeWidth={2} className="w-4 h-4" />
        </button>
      </Tooltip>

      <Tooltip content="Drag / Options">
        <div
          ref={dragHandleRef}
          onClick={handleGripClick}
          className={cn(
            markerBtnClass,
            "cursor-grab active:cursor-grabbing",
            (menuOpen || isDragging) && "bg-[var(--bone-10)] text-[var(--bone-100)] opacity-100"
          )}
        >
          <GripVertical strokeWidth={2} className="w-4 h-4" />
        </div>
      </Tooltip>
    </div>
  );
}

function MediaControls({ blockId, currentWidth, onWidthChange }: { blockId: string, currentWidth: number, onWidthChange: (w: number) => void }) {
  const sizes = [
    { label: '25%', value: 1 },
    { label: '50%', value: 2 },
    { label: '75%', value: 3 },
    { label: '100%', value: 4 },
  ];

  return (
    <div className="absolute top-4 right-4 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 ">
      {sizes.map(size => (
        <button
          key={size.value}
          onClick={(e) => { e.stopPropagation(); onWidthChange(size.value as any); }}
          className={cn(
            "px-2.5 py-1.5 text-[9px] font-bold rounded-lg  ",
            currentWidth === size.value
              ? "bg-accent/10 border border-accent/30 text-accent"
              : "text-muted-foreground/60 hover:bg-white/10 hover:text-foreground"
          )}
        >
          {size.label}
        </button>
      ))}
    </div>
  );
}
