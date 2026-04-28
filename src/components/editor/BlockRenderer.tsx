"use client";

import { GripVertical, Plus, Check, ImageIcon, Video, Maximize2, Minimize2, ExternalLink, Play, FileText, Link as LinkIcon, Quote, List, ListOrdered, CheckSquare, Pencil } from 'lucide-react';
import { Tooltip } from '@/components/layout/Tooltip';
import clsx from 'clsx';
import { EditorBlock, BlockStyle, BlockType, Entity, generateId } from '@/data/store';
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useStore } from '@/data/store';
import { DatabaseBlock } from './DatabaseBlock';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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
  onOpenMenu: (id: string, position: { x: number; y: number }) => void;
  onFocus?: (id: string) => void;
  isSelected?: boolean;
  isInsideColumn?: boolean;
  isDragging?: boolean;
  listeners?: any;
  attributes?: any;
  setNodeRef?: (el: HTMLElement | null) => void;
  style?: React.CSSProperties;
}

function BlockView({
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
  isSelected = false,
  isInsideColumn = false,
  isDragging = false,
  listeners,
  attributes,
  setNodeRef,
  style,
  isDragOverlay = false,
}: BlockViewProps & { isDragOverlay?: boolean }) {
  const contentRef = useRef<HTMLDivElement>(null);
  const lastTypedContent = useRef(block.content);
  const [isFocused, setIsFocused] = useState(false);
  const entities = useStore(s => s.entities);
  const setActiveEntityId = useStore(s => s.setActiveEntityId);

  const colorStyle = getBlockColorStyle(block);

  const handleInput = useCallback(() => {
    if (contentRef.current) {
      const newContent = contentRef.current.innerHTML;
      lastTypedContent.current = newContent;
      onUpdate(block.id, { content: newContent });
    }
  }, [block.id, onUpdate]);

  useEffect(() => {
    if (contentRef.current && contentRef.current.innerHTML !== block.content) {
      if (block.content !== lastTypedContent.current) {
        contentRef.current.innerHTML = block.content;
      }
    }
    lastTypedContent.current = block.content;
  }, [block.content]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (slashMenuOpen && (e.key === 'Enter' || e.key === 'ArrowUp' || e.key === 'ArrowDown')) return;
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      onInsertAfter(block.id, 'text');
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      if (['bulletList', 'dashedList', 'numberedList', 'checklist'].includes(block.type)) {
        e.preventDefault();
        onInsertAfter(block.id);
        return;
      }
    }
    if (e.key === 'Backspace' && contentRef.current) {
      const text = contentRef.current.textContent ?? '';
      if (text === '' && index > 0) {
        e.preventDefault();
        onDelete(block.id);
      }
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
  }, [block.id, block.type, index, onInsertAfter, onDelete, onSlash, slashMenuOpen]);

  const handleContentClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const anchor = target.closest('a');
    if (anchor) {
      e.preventDefault();
      e.stopPropagation();
      window.open(anchor.href, '_blank', 'noopener,noreferrer');
    }
  }, []);

  const isList = ['bulletList', 'dashedList', 'numberedList'].includes(block.type);
  const isChecklist = block.type === 'checklist';
  const isQuote = block.type === 'quote';
  const effectiveStyle = (isList || isChecklist) ? 'body' : block.style;

  const controlsProps = {
    blockId: block.id,
    menuOpen: menuOpen,
    onInsertAfter: onInsertAfter,
    onOpenMenu: onOpenMenu,
    isDragging: isDragOverlay,
    blockStyle: effectiveStyle,
    hasBgColor: !!block.bgColor,
    listeners,
    attributes
  };

  if (block.type === 'divider') {
    return (
      <div 
        ref={isDragOverlay ? undefined : setNodeRef}
        data-block-id={block.id}
        style={style}
        className={clsx("editor-block group flex flex-col items-start relative px-1", isDragging && "z-50")}
      >
        <BlockControls {...controlsProps} listeners={listeners} attributes={attributes} />
        <div className={clsx(
          "flex items-center w-full py-4 relative group rounded-[var(--radius-medium)] transition-colors", 
          isSelected && "bg-white/[0.01]",
          isDragging && "opacity-0"
        )}>
          <div className="flex-1 h-px bg-border/50" />
        </div>
      </div>
    );
  }

  if (block.type === 'database') {
    return (
      <div 
        ref={isDragOverlay ? undefined : setNodeRef}
        data-block-id={block.id}
        style={{ ...style, ...colorStyle }}
        className={clsx("editor-block group py-2 relative flex flex-col items-stretch", isDragging && "z-50")}
      >
        <BlockControls {...controlsProps} listeners={listeners} attributes={attributes} />
        <div className={clsx(
          "relative w-full rounded-[var(--radius-medium)] transition-colors", 
          isSelected && "bg-white/[0.01]",
          isDragging && "opacity-0"
        )}>
          <DatabaseBlock block={block} onUpdate={onUpdate} />
        </div>
      </div>
    );
  }

  if (block.type === 'table') {
    const tableData = block.tableData ?? [['', '', ''], ['', '', ''], ['', '', '']];
    return (
      <div 
        ref={isDragOverlay ? undefined : setNodeRef}
        data-block-id={block.id}
        style={{ ...style, ...colorStyle }}
        className={clsx("editor-block group py-2 relative flex flex-col items-stretch", isDragging && "z-50")}
      >
        <BlockControls {...controlsProps} listeners={listeners} attributes={attributes} />
        <div className={clsx(
          "relative w-full rounded-[var(--radius-medium)] transition-colors", 
          isSelected && "bg-white/[0.01]",
          isDragging && "opacity-0"
        )}>
          <div className="border border-white/10 rounded-[var(--radius-medium)] overflow-hidden bg-white/[0.02]">
            <table className="w-full border-collapse">
              <tbody>
                {tableData.map((row, ri) => (
                  <tr key={ri} className="group/row">
                    {row.map((cell, ci) => (
                      <td
                        key={ci}
                        contentEditable
                        suppressContentEditableWarning
                        className={clsx(
                          "px-4 py-3 text-sm border-b border-r border-white/5 last:border-r-0 outline-none ",
                          ri === 0 ? "font-bold text-foreground bg-white/[0.03]  text-[10px] " : "text-foreground/80 focus:bg-white/[0.05]",
                          ri === tableData.length - 1 && "border-b-0"
                        )}
                        onBlur={(e) => {
                          const newData = [...tableData.map(r => [...r])];
                          newData[ri][ci] = (e.target as HTMLElement).textContent ?? '';
                          onUpdate(block.id, { tableData: newData });
                        }}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex border-t border-white/10 bg-white/[0.01]">
              <button onClick={() => {
                const cols = tableData[0]?.length ?? 3;
                onUpdate(block.id, { tableData: [...tableData, Array(cols).fill('')] });
              }} className="flex-1 py-2 text-[10px]  font-bold  text-muted-foreground/40 hover:text-foreground hover:bg-white/5">+ Add Row</button>
              <button onClick={() => onUpdate(block.id, { tableData: tableData.map(row => [...row, '']) })} className="flex-1 py-2 text-[10px]  font-bold  text-muted-foreground/40 hover:text-foreground hover:bg-white/5">+ Add Column</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
        ref={isDragOverlay ? undefined : setNodeRef}
        data-block-id={block.id}
        className={clsx(
        "editor-block group py-2 relative flex flex-col items-stretch",
        alignVariant === 'center' && "items-center",
        alignVariant === 'right' && "items-end",
        alignVariant === 'left' && "items-start",
        isDragging && "z-50"
      )}
      style={{ ...style }}
      >
        <BlockControls {...controlsProps} listeners={listeners} attributes={attributes} />
        <div className={clsx(
          "relative w-full transition-colors", 
          isSelected && "bg-white/[0.01] rounded-[var(--radius-medium)]",
          isDragging && "opacity-0"
        )}>
          <div className={clsx("relative group/media border border-white/5 bg-white/5", widthClass, "rounded-[var(--radius-medium)] ")}>
            <MediaControls blockId={block.id} currentWidth={block.mediaWidth || 4} onWidthChange={(w) => onUpdate(block.id, { mediaWidth: w as any })} />
            <div className="overflow-hidden rounded-[var(--radius-medium)]">
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
      </div>
    );
  }

  if (block.type === 'embed') {
    const linked = entities.find((e: Entity) => e.id === block.embedEntityId);
    return (
      <div 
        ref={isDragOverlay ? undefined : setNodeRef}
        data-block-id={block.id}
        style={{ ...style, ...colorStyle }}
        className={clsx("editor-block group py-2 relative", isDragging && "z-50")}
      >
        <BlockControls {...controlsProps} listeners={listeners} attributes={attributes} />
        <div className={clsx(
          "relative w-full transition-colors rounded-[var(--radius-medium)]", 
          isSelected && "bg-white/[0.01]",
          isDragging && "opacity-0"
        )}>
          <div onClick={() => linked && setActiveEntityId(linked.id)} className="border border-white/5 rounded-[var(--radius-medium)] px-5 py-4 hover:bg-white/5 flex items-center gap-4 transition-colors">
            <div className="w-10 h-10 rounded-[var(--radius-medium)] bg-accent/10 flex items-center justify-center text-accent text-lg font-bold border border-accent/20 group-hover/embed:bg-accent/20">{linked?.title?.charAt(0) ?? '?'}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground tracking-tight truncate">{linked?.title ?? 'Untitled Page'}</p>
              <p className="text-[10px] font-bold text-muted-foreground/40   pt-0.5">{linked?.type ?? 'page'}</p>
            </div>
            <ExternalLink className="w-4 h-4 text-muted-foreground/20 group-hover/embed:text-accent " />
          </div>
        </div>
      </div>
    );
  }

  if (block.type === 'column') {
    return (
      <div 
        ref={isDragOverlay ? undefined : setNodeRef}
        data-block-id={block.id}
        style={style}
        className={clsx(
          "flex-1 basis-0 min-w-0 break-words rounded-[var(--radius-medium)] pl-14 pr-4 column-container relative group/column hover:bg-hover/10 transition-colors",
          isSelected && "bg-white/[0.01]",
          isDragging && "z-50",
          !block.children?.length && "empty"
        )}
      >
        <BlockControls variant="column" blockId={block.id} menuOpen={menuOpen} onInsertAfter={onInsertAfter} onOpenMenu={onOpenMenu} onDragStart={onDragStart} listeners={listeners} attributes={attributes} />
        <div className={clsx("flex flex-col gap-2 relative z-10", isDragging && "opacity-0")}>
          {(block.children || []).map((subBlock, sIdx) => (
            <BlockRenderer key={subBlock.id} block={subBlock} index={sIdx} onUpdate={onUpdate} onDelete={onDelete} onInsertAfter={onInsertAfter} onSlash={onSlash} onOpenMenu={onOpenMenu} onFocus={onFocus} isInsideColumn={true} onDragStart={onDragStart} />
          ))}
        </div>
      </div>
    );
  }

  if (block.type === 'columns') {
    return (
      <div 
        ref={isDragOverlay ? undefined : setNodeRef}
        data-block-id={block.id}
        style={{ ...style, ...colorStyle }}
        className={clsx("editor-block py-2 relative flex flex-col transition-colors", isDragging && "z-50")}
      >
        <BlockControls {...controlsProps} listeners={listeners} attributes={attributes} />
        <div className={clsx("flex gap-4 w-full h-full relative z-10 group", isDragging && "opacity-0")}>
          <div className="flex gap-4 w-full h-full">
            {(block.children || []).map((colBlock, cIdx) => (
              <div key={colBlock.id} className="relative flex-1 basis-0 min-w-0 flex flex-col">
                <BlockRenderer block={colBlock} index={cIdx} onUpdate={onUpdate} onDelete={onDelete} onInsertAfter={onInsertAfter} onSlash={onSlash} onOpenMenu={onOpenMenu} onFocus={onFocus} isInsideColumn={true} onDragStart={onDragStart} />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const listMarker = () => {
    if (block.type === 'bulletList') return <div className="w-[6px] h-[6px] rounded-full bg-accent flex-shrink-0" />;
    if (block.type === 'dashedList') return <div className="w-[8px] h-[1px] bg-muted-foreground flex-shrink-0" />;
    if (block.type === 'numberedList') return <span className="text-muted-foreground/60 text-[0.95rem] font-mono tabular-nums leading-none">{(listNumber ?? 1)}.</span>;
    if (block.type === 'checklist') return (
       <div onClick={() => onUpdate(block.id, { checked: !block.checked })} className={clsx("w-[18px] h-[18px] rounded-full border flex items-center justify-center transition-all", block.checked ? "bg-accent/20 border-accent/40" : "border-border hover:border-accent/50")}>
         {block.checked && <Check className="w-3 h-3 text-accent stroke-[3px]" />}
       </div>
    );
    return null;
  };

  return (
    <div
      ref={isDragOverlay ? undefined : setNodeRef}
      data-block-id={block.id}
      className={clsx(
        "editor-block group flex flex-col relative overflow-visible py-0.5 transition-all duration-200",
        isFocused && "focused",
        isDragging && "z-50",
        isSelected && "selected-block",
        isInsideColumn && "rounded-[var(--radius-medium)] break-words min-h-[100px] column-container hover:bg-hover/10",
        isInsideColumn && !block.content && "empty"
      )}
      style={{ ...style }}
      onMouseDown={() => onFocus?.(block.id)}
    >
      <BlockControls {...controlsProps} listeners={listeners} attributes={attributes} />
      <div 
        className={clsx(
          "flex-1 flex items-start w-full relative min-h-[1.5em] transition-all duration-200 rounded-[var(--radius-medium)] px-4 py-1",
          !isSelected && "hover:bg-white/[0.01]",
          block.bgColor && "border px-[16px] py-[8px]",
          isDragging && "opacity-0"
        )}
        style={{ ... (block.bgColor ? colorStyle : {}) }}
      >
        <div className="flex-1 flex items-start w-full min-h-[1.5em] h-full relative">
          {(isList || isChecklist) && (
            <div className={clsx("absolute left-[-32px] shrink-0 flex items-center justify-center", getLineHeightClass(effectiveStyle))} style={{ width: '32px' }}>
              {listMarker()}
            </div>
          )}
          <div
            ref={contentRef}
            contentEditable
            suppressContentEditableWarning
            onFocus={() => { setIsFocused(true); onFocus?.(block.id); }}
            onBlur={() => setIsFocused(false)}
            data-placeholder={getPlaceholder(effectiveStyle, block.type, isFocused)}
            className={clsx(
              "flex-1 outline-none min-h-[1.5em]",
              !block.textColor && "text-foreground",
              getStyleClasses(effectiveStyle),
              isQuote && "italic text-muted-foreground",
              block.checked && "line-through text-muted-foreground",
            )}
            style={{ textAlign: block.align ?? 'left' }}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            onClick={handleContentClick}
          />
        </div>
      </div>
    </div>
  );
}

function DropIndicator({ active, position }: { active: boolean; position: 'above' | 'below' | 'horizontal' }) {
  return (
    <div className={clsx(
      "drop-gap",
      active && "active",
      position === 'horizontal' && "horizontal"
    )}>
      <div className="drop-gap-line" />
    </div>
  );
}

function getStyleClasses(style?: BlockStyle): string {
  switch (style) {
    case 'title': return 'text-3xl font-bold tracking-tight leading-[1.3]';
    case 'heading': return 'text-2xl font-bold leading-[1.3]';
    case 'subheading': return 'text-xl font-semibold text-muted-foreground leading-[1.3]';
    case 'mono': return 'font-mono text-sm bg-hover/50 rounded-lg px-3 py-2';
    case 'body':
    default: return 'text-base font-ui leading-[1.5]';
  }
}

function getLineHeightClass(style?: BlockStyle): string {
  switch (style) {
    case 'title':
    case 'heading':
    case 'subheading': return 'h-[1.3em]';
    case 'body':
    default: return 'h-[1.5em]';
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
  onOpenMenu: (id: string, position: { x: number; y: number }) => void;
  isDragging?: boolean;
  variant?: 'standard' | 'column' | 'section';
  listeners?: any;
  attributes?: any;
  blockStyle?: string;
  hasBgColor?: boolean;
}

interface BlockControlsProps extends ControlsProps {
  onDragStart?: (id: string, e: React.DragEvent) => void;
}

function BlockControls({ 
  blockId, 
  menuOpen, 
  onInsertAfter, 
  onOpenMenu, 
  isDragging, 
  onDragStart, 
  attributes,
  listeners,
  blockStyle, 
  hasBgColor 
}: BlockControlsProps) {
  const markerBtnClass = "w-7 h-7 flex items-center justify-center rounded-sm hover:bg-white/10 text-muted-foreground/40 hover:text-foreground transition-none";

  const handleGripClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    onOpenMenu(blockId, { x: rect.right + 8, y: rect.top });
  };

  const styleClasses = getStyleClasses(blockStyle as BlockStyle);
  const heightClass = getLineHeightClass(blockStyle as BlockStyle);

  return (
    <div 
      className={clsx(
        "absolute right-full pr-[8px] flex items-center justify-center gap-1",
        styleClasses,
        heightClass,
        (menuOpen || isDragging) ? "opacity-100 visible" : "opacity-0 invisible group-hover:opacity-100 group-hover:visible has-[:active]:opacity-100 has-[:active]:visible"
      )}
      style={{ 
        width: 'auto',
        minWidth: '42px',
        top: hasBgColor ? '0.5rem' : '0',
        zIndex: 101,
        height: heightClass ? undefined : '1.5em' 
      }}
    >
      <Tooltip content="Add below">
        <button onClick={() => onInsertAfter(blockId)} className={markerBtnClass}>
          <Plus className="w-4 h-4" />
        </button>
      </Tooltip>

      <Tooltip content="Drag / Options">
        <div
          {...attributes}
          {...listeners}
          onClick={handleGripClick}
          className={clsx(
            markerBtnClass,
            "cursor-grab active:cursor-grabbing",
            (menuOpen || isDragging) && "bg-[var(--bone-10)] text-[var(--bone-100)] opacity-100"
          )}
        >
          <GripVertical className="w-4 h-4" />
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
          className={clsx(
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
  isSelected = false,
  isInsideColumn = false,
  onDragStart,
  isDragOverlay = false,
}: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: sortableIsDragging
  } = useSortable({ id: block.id });

  const isDragging = sortableIsDragging;

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    position: 'relative' as const,
    zIndex: isDragging ? 50 : undefined,
  };

  const contentRef = useRef<HTMLDivElement>(null);
  const lastTypedContent = useRef(block.content);
  const [isFocused, setIsFocused] = useState(false);
  const entities = useStore(s => s.entities);
  const setActiveEntityId = useStore(s => s.setActiveEntityId);

  const colorStyle = getBlockColorStyle(block);

  const handleInput = useCallback(() => {
    if (contentRef.current) {
      const newContent = contentRef.current.innerHTML;
      lastTypedContent.current = newContent;
      onUpdate(block.id, { content: newContent });
    }
  }, [block.id, onUpdate]);

  useEffect(() => {
    if (contentRef.current && contentRef.current.innerHTML !== block.content) {
      if (block.content !== lastTypedContent.current) {
        contentRef.current.innerHTML = block.content;
      }
    }
    lastTypedContent.current = block.content;
  }, [block.content]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (slashMenuOpen && (e.key === 'Enter' || e.key === 'ArrowUp' || e.key === 'ArrowDown')) return;
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      onInsertAfter(block.id, 'text');
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      if (['bulletList', 'dashedList', 'numberedList', 'checklist'].includes(block.type)) {
        e.preventDefault();
        onInsertAfter(block.id);
        return;
      }
    }
    if (e.key === 'Backspace' && contentRef.current) {
      const text = contentRef.current.textContent ?? '';
      if (text === '' && index > 0) {
        e.preventDefault();
        onDelete(block.id);
      }
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
  }, [block.id, block.type, index, onInsertAfter, onDelete, onSlash, slashMenuOpen]);

  const handleContentClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const anchor = target.closest('a');
    if (anchor) {
      e.preventDefault();
      e.stopPropagation();
      window.open(anchor.href, '_blank', 'noopener,noreferrer');
    }
  }, []);

  const isList = ['bulletList', 'dashedList', 'numberedList'].includes(block.type);
  const isChecklist = block.type === 'checklist';
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
    hasBgColor: !!block.bgColor
  };

  // ─── Divider ──────────────────────────────────────────
  if (block.type === 'divider') {
    return (
      <div 
        ref={setNodeRef}
        data-block-id={block.id}
        style={style}
        className={clsx("editor-block group flex flex-col items-start relative px-1", isDragging && "z-50")}
      >
        <BlockControls {...controlsProps} listeners={listeners} attributes={attributes} />
        <div className={clsx(
          "flex items-center w-full py-4 relative group rounded-[var(--radius-medium)] transition-colors", 
          isSelected && "bg-white/[0.01]",
          isDragging && "opacity-60 shadow-2xl bg-sidebar/80 rounded-[var(--radius-medium)]"
        )}>
          <div className="flex-1 h-px bg-border/50" />
        </div>
      </div>
    );
  }

  // ─── Database ─────────────────────────────────────────
  if (block.type === 'database') {
    return (
      <div 
        ref={setNodeRef}
        data-block-id={block.id}
        style={{ ...style, ...colorStyle }}
        className={clsx("editor-block group py-2 relative flex flex-col items-stretch", isDragging && "z-50")}
      >
        <BlockControls {...controlsProps} listeners={listeners} attributes={attributes} />
        <div className={clsx(
          "relative w-full rounded-[var(--radius-medium)] transition-colors", 
          isSelected && "bg-white/[0.01]",
          isDragging && "opacity-60 shadow-2xl"
        )}>
          <DatabaseBlock block={block} onUpdate={onUpdate} />
        </div>
      </div>
    );
  }

  // ─── Table ────────────────────────────────────────────
  if (block.type === 'table') {
    const tableData = block.tableData ?? [['', '', ''], ['', '', ''], ['', '', '']];
    return (
      <div 
        ref={setNodeRef}
        data-block-id={block.id}
        style={{ ...style, ...colorStyle }}
        className={clsx("editor-block group py-2 relative flex flex-col items-stretch", isDragging && "z-50")}
      >
        <BlockControls {...controlsProps} listeners={listeners} attributes={attributes} />
        <div className={clsx(
          "relative w-full rounded-[var(--radius-medium)] transition-colors", 
          isSelected && "bg-white/[0.01]",
          isDragging && "opacity-60 shadow-2xl"
        )}>
          <div className="border border-white/10 rounded-[var(--radius-medium)] overflow-hidden bg-white/[0.02]">
            <table className="w-full border-collapse">
              <tbody>
                {tableData.map((row, ri) => (
                  <tr key={ri} className="group/row">
                    {row.map((cell, ci) => (
                      <td
                        key={ci}
                        contentEditable
                        suppressContentEditableWarning
                        className={clsx(
                          "px-4 py-3 text-sm border-b border-r border-white/5 last:border-r-0 outline-none ",
                          ri === 0 ? "font-bold text-foreground bg-white/[0.03]  text-[10px] " : "text-foreground/80 focus:bg-white/[0.05]",
                          ri === tableData.length - 1 && "border-b-0"
                        )}
                        onBlur={(e) => {
                          const newData = [...tableData.map(r => [...r])];
                          newData[ri][ci] = (e.target as HTMLElement).textContent ?? '';
                          onUpdate(block.id, { tableData: newData });
                        }}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex border-t border-white/10 bg-white/[0.01]">
              <button onClick={() => {
                const cols = tableData[0]?.length ?? 3;
                onUpdate(block.id, { tableData: [...tableData, Array(cols).fill('')] });
              }} className="flex-1 py-2 text-[10px]  font-bold  text-muted-foreground/40 hover:text-foreground hover:bg-white/5">+ Add Row</button>
              <button onClick={() => onUpdate(block.id, { tableData: tableData.map(row => [...row, '']) })} className="flex-1 py-2 text-[10px]  font-bold  text-muted-foreground/40 hover:text-foreground hover:bg-white/5">+ Add Column</button>
            </div>
          </div>
        </div>
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
        ref={setNodeRef}
        data-block-id={block.id}
        className={clsx(
        "editor-block group py-2 relative flex flex-col items-stretch",
        alignVariant === 'center' && "items-center",
        alignVariant === 'right' && "items-end",
        alignVariant === 'left' && "items-start",
        isDragging && "z-50"
      )}
      style={{ ...style }}
      >
        <BlockControls {...controlsProps} listeners={listeners} attributes={attributes} />
        <div className={clsx(
          "relative w-full transition-colors", 
          isSelected && "bg-white/[0.01] rounded-[var(--radius-medium)]",
          isDragging && "opacity-60 shadow-2xl"
        )}>
          <div className={clsx("relative group/media border border-white/5 bg-white/5", widthClass, "rounded-[var(--radius-medium)] ")}>
            <MediaControls blockId={block.id} currentWidth={block.mediaWidth || 4} onWidthChange={(w) => onUpdate(block.id, { mediaWidth: w as any })} />
            <div className="overflow-hidden rounded-[var(--radius-medium)]">
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
      </div>
    );
  }

  // ─── Embed ──────────────────────────────────────────
  if (block.type === 'embed') {
    const linked = entities.find((e: Entity) => e.id === block.embedEntityId);
    return (
      <div 
        ref={setNodeRef}
        data-block-id={block.id}
        style={{ ...style, ...colorStyle }}
        className={clsx("editor-block group py-2 relative", isDragging && "z-50")}
      >
        <BlockControls {...controlsProps} listeners={listeners} attributes={attributes} />
        <div className={clsx(
          "relative w-full transition-colors rounded-[var(--radius-medium)]", 
          isSelected && "bg-white/[0.01]",
          isDragging && "opacity-60 shadow-2xl"
        )}>
          <div onClick={() => linked && setActiveEntityId(linked.id)} className="border border-white/5 rounded-[var(--radius-medium)] px-5 py-4 hover:bg-white/5 flex items-center gap-4 transition-colors">
            <div className="w-10 h-10 rounded-[var(--radius-medium)] bg-accent/10 flex items-center justify-center text-accent text-lg font-bold border border-accent/20 group-hover/embed:bg-accent/20">{linked?.title?.charAt(0) ?? '?'}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground tracking-tight truncate">{linked?.title ?? 'Untitled Page'}</p>
              <p className="text-[10px] font-bold text-muted-foreground/40   pt-0.5">{linked?.type ?? 'page'}</p>
            </div>
            <ExternalLink className="w-4 h-4 text-muted-foreground/20 group-hover/embed:text-accent " />
          </div>
        </div>
      </div>
    );
  }

  // ─── Column / Columns ────────────────────────────────
  if (block.type === 'column') {
    return (
      <div 
        ref={setNodeRef}
        data-block-id={block.id}
        style={style}
        className={clsx(
          "flex-1 basis-0 min-w-0 break-words rounded-[var(--radius-medium)] pl-14 pr-4 column-container relative group/column hover:bg-hover/10 transition-colors",
          isSelected && "bg-white/[0.01]",
          isDragging && "z-50",
          !block.children?.length && "empty"
        )}
      >
        <BlockControls variant="column" blockId={block.id} menuOpen={menuOpen} onInsertAfter={onInsertAfter} onOpenMenu={onOpenMenu} onDragStart={onDragStart} listeners={listeners} attributes={attributes} />
        <div className={clsx("flex flex-col gap-2 relative z-10", isDragging && "opacity-60")}>
          {(block.children || []).map((subBlock, sIdx) => (
            <BlockRenderer key={subBlock.id} block={subBlock} index={sIdx} onUpdate={onUpdate} onDelete={onDelete} onInsertAfter={onInsertAfter} onSlash={onSlash} onOpenMenu={onOpenMenu} onFocus={onFocus} isInsideColumn={true} onDragStart={onDragStart} />
          ))}
        </div>
      </div>
    );
  }

  if (block.type === 'columns') {
    return (
      <div 
        ref={setNodeRef}
        data-block-id={block.id}
        style={{ ...style, ...colorStyle }}
        className={clsx("editor-block py-2 relative flex flex-col transition-colors", isDragging && "z-50")}
      >
        <BlockControls {...controlsProps} listeners={listeners} attributes={attributes} />
        <div className={clsx("flex gap-4 w-full h-full relative z-10 group", isDragging && "opacity-60")}>
          <div className="flex gap-4 w-full h-full">
            {(block.children || []).map((colBlock, cIdx) => (
              <div key={colBlock.id} className="relative flex-1 basis-0 min-w-0 flex flex-col">
                <BlockRenderer block={colBlock} index={cIdx} onUpdate={onUpdate} onDelete={onDelete} onInsertAfter={onInsertAfter} onSlash={onSlash} onOpenMenu={onOpenMenu} onFocus={onFocus} isInsideColumn={true} onDragStart={onDragStart} />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── Default (Text, List, Checklist, Quote) ───────────
  const listMarker = () => {
    if (block.type === 'bulletList') return <div className="w-[6px] h-[6px] rounded-full bg-accent flex-shrink-0" />;
    if (block.type === 'dashedList') return <div className="w-[8px] h-[1px] bg-muted-foreground flex-shrink-0" />;
    if (block.type === 'numberedList') return <span className="text-muted-foreground/60 text-[0.95rem] font-mono tabular-nums leading-none">{(listNumber ?? 1)}.</span>;
    if (block.type === 'checklist') return (
       <div onClick={() => onUpdate(block.id, { checked: !block.checked })} className={clsx("w-[18px] h-[18px] rounded-full border flex items-center justify-center transition-all", block.checked ? "bg-accent/20 border-accent/40" : "border-border hover:border-accent/50")}>
         {block.checked && <Check className="w-3 h-3 text-accent stroke-[3px]" />}
       </div>
    );
    return null;
  };

  return (
    <div
      ref={setNodeRef}
      data-block-id={block.id}
      className={clsx(
        "editor-block group flex flex-col relative overflow-visible py-0.5 transition-all duration-200",
        isFocused && "focused",
        isDragging && "z-50",
        isSelected && "selected-block",
        isInsideColumn && "rounded-[var(--radius-medium)] break-words min-h-[100px] column-container hover:bg-hover/10",
        isInsideColumn && !block.content && "empty"
      )}
      style={{ ...style }}
      onMouseDown={() => onFocus?.(block.id)}
    >
      <BlockControls {...controlsProps} listeners={listeners} attributes={attributes} />
      <div 
        className={clsx(
          "flex-1 flex items-start w-full relative min-h-[1.5em] transition-all duration-200 rounded-[var(--radius-medium)] px-4 py-1",
          !isSelected && "hover:bg-white/[0.01]",
          block.bgColor && "border px-[16px] py-[8px]",
          isDragging && "opacity-60 shadow-2xl"
        )}
        style={{ ... (block.bgColor ? colorStyle : {}) }}
      >
        <div className="flex-1 flex items-start w-full min-h-[1.5em] h-full relative">
          {(isList || isChecklist) && (
            <div className={clsx("absolute left-[-32px] shrink-0 flex items-center justify-center", getLineHeightClass(effectiveStyle))} style={{ width: '32px' }}>
              {listMarker()}
            </div>
          )}
          <div
            ref={contentRef}
            contentEditable
            suppressContentEditableWarning
            onFocus={() => { setIsFocused(true); onFocus?.(block.id); }}
            onBlur={() => setIsFocused(false)}
            data-placeholder={getPlaceholder(effectiveStyle, block.type, isFocused)}
            className={clsx(
              "flex-1 outline-none min-h-[1.5em]",
              !block.textColor && "text-foreground",
              getStyleClasses(effectiveStyle),
              isQuote && "italic text-muted-foreground",
              block.checked && "line-through text-muted-foreground",
            )}
            style={{ textAlign: block.align ?? 'left' }}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            onClick={handleContentClick}
          />
        </div>
      </div>
    </div>
  );
}
