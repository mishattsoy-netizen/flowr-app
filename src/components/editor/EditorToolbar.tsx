"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Bold, Italic, Underline, Strikethrough,
  Highlighter, Link, List, ListOrdered,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  ChevronDown, Minus, Type, Undo2, Redo2, Check, Trash,
  Heading1, Heading2, FileText, Code,
  Maximize2, Minimize2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BlockStyle, BlockType } from '@/data/store';
import { Tooltip } from '../layout/Tooltip';
import { useStore } from '@/data/store';

interface EditorToolbarProps {
  activeBlockStyle?: BlockStyle;
  activeBlockType?: BlockType;
  onChangeBlockStyle: (style: BlockStyle) => void;
  activeAlign?: 'left' | 'center' | 'right' | 'justify';
  onChangeAlign: (align: 'left' | 'center' | 'right' | 'justify') => void;
  onConvertToList: (type: 'bulletList' | 'dashedList' | 'numberedList') => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  isFloating?: boolean;
}

const BLOCK_STYLES: { value: BlockStyle; label: string; icon: React.ReactNode }[] = [
  { value: 'title', label: 'Title', icon: <Type strokeWidth={2} className="w-4 h-4" /> },
  { value: 'heading', label: 'Heading', icon: <Heading1 strokeWidth={2} className="w-4 h-4" /> },
  { value: 'subheading', label: 'Subheading', icon: <Heading2 strokeWidth={2} className="w-4 h-4" /> },
  { value: 'body', label: 'Body', icon: <FileText strokeWidth={2} className="w-4 h-4" /> },
  { value: 'mono', label: 'Mono', icon: <Code strokeWidth={2} className="w-4 h-4" /> },
];

const HIGHLIGHT_COLORS = [
  { name: 'yellow', class: 'highlight-yellow', color: 'rgba(250, 204, 21, 0.5)' },
  { name: 'green', class: 'highlight-green', color: 'rgba(34, 197, 94, 0.5)' },
  { name: 'blue', class: 'highlight-blue', color: 'rgba(59, 130, 246, 0.5)' },
  { name: 'purple', class: 'highlight-purple', color: 'rgba(168, 85, 247, 0.5)' },
  { name: 'red', class: 'highlight-red', color: 'rgba(239, 68, 68, 0.5)' },
  { name: 'orange', class: 'highlight-orange', color: 'rgba(249, 115, 22, 0.5)' },
];

export function EditorToolbar({
  activeBlockStyle,
  activeBlockType,
  onChangeBlockStyle,
  activeAlign,
  onChangeAlign,
  onConvertToList,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  isFloating = true,
}: EditorToolbarProps) {
  const isToolbarVisible = useStore(state => state.isToolbarVisible);
  const toolbarPosition = useStore(state => state.toolbarPosition);
  const setToolbarPosition = useStore(state => state.setToolbarPosition);
  const setToolbarVisible = useStore(state => state.setToolbarVisible);
  const isFullWidth = useStore(state => state.isFullWidth);
  const toggleFullWidth = useStore(state => state.toggleFullWidth);
  const [showStyleDropdown, setShowStyleDropdown] = useState(false);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);
  const [activeFmt, setActiveFmt] = useState<Set<string>>(new Set());
  const styleRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const linkRef = useRef<HTMLDivElement>(null);
  const linkInputRef = useRef<HTMLInputElement>(null);
  const alignContainerRef = useRef<HTMLDivElement>(null);
  const alignPillRef = useRef<HTMLDivElement>(null);

  const [showLinkPopover, setShowLinkPopover] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [storedRange, setStoredRange] = useState<Range | null>(null);

  // Active Style label with smooth width transition
  const [displayedStyleLabel, setDisplayedStyleLabel] = useState(BLOCK_STYLES.find(s => s.value === activeBlockStyle)?.label ?? 'Body');
  const labelRef = useRef<HTMLSpanElement>(null);
  const labelContainerRef = useRef<HTMLDivElement>(null);

  // Check active formatting from selection
  const checkFormatting = useCallback(() => {
    const newFmt = new Set<string>();
    if (document.queryCommandState('bold')) newFmt.add('bold');
    if (document.queryCommandState('italic')) newFmt.add('italic');
    if (document.queryCommandState('underline')) newFmt.add('underline');
    if (document.queryCommandState('strikethrough')) newFmt.add('strikethrough');
    setActiveFmt(newFmt);
  }, []);

  useEffect(() => {
    document.addEventListener('selectionchange', checkFormatting);
    return () => document.removeEventListener('selectionchange', checkFormatting);
  }, [checkFormatting]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (styleRef.current && !styleRef.current.contains(e.target as Node)) {
        setShowStyleDropdown(false);
      }
      if (highlightRef.current && !highlightRef.current.contains(e.target as Node)) {
        setShowHighlightPicker(false);
      }
      if (linkRef.current && !linkRef.current.contains(e.target as Node)) {
        setShowLinkPopover(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Alignment pill immediate update
  useEffect(() => {
    if (!alignContainerRef.current || !alignPillRef.current) return;

    const activeButton = alignContainerRef.current.querySelector('[data-active="true"]') as HTMLElement;
    if (activeButton) {
      alignPillRef.current.style.transform = `translateX(${activeButton.offsetLeft}px) translateY(-50%)`;
      alignPillRef.current.style.width = `${activeButton.offsetWidth}px`;
      alignPillRef.current.style.opacity = '1';
    } else {
      alignPillRef.current.style.opacity = '0';
    }
  }, [activeAlign]);

  // Style Label width immediate update
  useEffect(() => {
    const newLabel = BLOCK_STYLES.find(s => s.value === activeBlockStyle)?.label ?? 'Body';
    if (labelRef.current?.innerText === newLabel) return;

    // Create a temporary hidden measure element to get the new width
    const measure = document.createElement('span');
    measure.style.visibility = 'hidden';
    measure.style.position = 'absolute';
    measure.style.whiteSpace = 'nowrap';
    measure.className = 'text-xs font-medium';
    measure.innerText = newLabel;
    document.body.appendChild(measure);
    const newWidth = measure.offsetWidth + 4;
    measure.remove();

    if (labelContainerRef.current && labelRef.current) {
      labelContainerRef.current.style.width = `${newWidth}px`;
      setDisplayedStyleLabel(newLabel);
      labelRef.current.style.opacity = '1';
    }
  }, [activeBlockStyle]);

  // Draggable logic
  const toolbarRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const [isDraggingState, setIsDraggingState] = useState(false);

  // Initialize position to bottom center if null
  useEffect(() => {
    if (!toolbarPosition && toolbarRef.current) {
      const mainRect = document.querySelector('main')?.getBoundingClientRect();
      const rect = toolbarRef.current.getBoundingClientRect();
      if (mainRect) {
        const x = mainRect.left + (mainRect.width - rect.width) / 2;
        const y = mainRect.bottom - rect.height - 40;
        setToolbarPosition({ x, y });
      } else {
        const x = (window.innerWidth - rect.width) / 2;
        const y = window.innerHeight - rect.height - 40;
        setToolbarPosition({ x, y });
      }
    }
  }, [toolbarPosition, setToolbarPosition]);

  const startDrag = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button')) return;

    isDragging.current = true;
    setIsDraggingState(true);
    const initialPos = toolbarPosition || {
      x: toolbarRef.current?.offsetLeft || 0,
      y: toolbarRef.current?.offsetTop || 0
    };

    const startX = e.clientX - initialPos.x;
    const startY = e.clientY - initialPos.y;

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (isDragging.current && toolbarRef.current) {
        const mainRect = document.querySelector('main')?.getBoundingClientRect();
        const toolbarRect = toolbarRef.current.getBoundingClientRect();

        if (mainRect) {
          const minX = mainRect.left + 10;
          const maxX = mainRect.right - toolbarRect.width - 10;
          const minY = mainRect.top + 10;
          const maxY = mainRect.bottom - toolbarRect.height - 10;

          const nx = Math.max(minX, Math.min(maxX, moveEvent.clientX - startX));
          const ny = Math.max(minY, Math.min(maxY, moveEvent.clientY - startY));
          setToolbarPosition({ x: nx, y: ny });
        } else {
          const nx = Math.max(10, Math.min(window.innerWidth - 100, moveEvent.clientX - startX));
          const ny = Math.max(10, Math.min(window.innerHeight - 50, moveEvent.clientY - startY));
          setToolbarPosition({ x: nx, y: ny });
        }
      }
    };

    const onMouseUp = () => {
      isDragging.current = false;
      setIsDraggingState(false);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [toolbarPosition, setToolbarPosition]);

  // Entrance/Exit immediate update
  useEffect(() => {
    if (!toolbarRef.current) return;

    if (isToolbarVisible) {
      toolbarRef.current.style.opacity = '1';
      toolbarRef.current.style.pointerEvents = 'auto';
      toolbarRef.current.style.visibility = 'visible';
    } else {
      toolbarRef.current.style.opacity = '0';
      toolbarRef.current.style.pointerEvents = 'none';
      toolbarRef.current.style.visibility = 'hidden';
    }
  }, [isToolbarVisible]);

  const execCmd = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value);
    checkFormatting();
  };

  const handleLinkBtnClick = () => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
      setStoredRange(selection.getRangeAt(0).cloneRange());

      // Check if current selection is already a link
      let parent = selection.anchorNode?.parentElement;
      let existingUrl = '';
      while (parent && parent.className.includes('editor-block') === false) {
        if (parent.tagName === 'A') {
          existingUrl = (parent as HTMLAnchorElement).href;
          break;
        }
        parent = parent.parentElement;
      }

      setLinkUrl(existingUrl);
      setShowLinkPopover(true);
      setTimeout(() => linkInputRef.current?.focus(), 10);
    }
  };

  const applyLink = () => {
    if (!storedRange) return;

    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(storedRange);

    let finalUrl = linkUrl.trim();
    if (finalUrl && !/^[a-z][a-z0-9+.-]*:/i.test(finalUrl)) {
      finalUrl = 'https://' + finalUrl;
    }

    if (finalUrl) {
      document.execCommand('createLink', false, finalUrl);
    } else {
      document.execCommand('unlink');
    }

    setShowLinkPopover(false);
    setLinkUrl('');
    setStoredRange(null);
  };

  const removeLink = () => {
    if (!storedRange) return;
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(storedRange);
    document.execCommand('unlink');
    setShowLinkPopover(false);
    setLinkUrl('');
    setStoredRange(null);
  };

  const applyHighlight = (colorClass: string) => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const range = selection.getRangeAt(0);
    const span = document.createElement('span');
    span.className = colorClass;
    range.surroundContents(span);
    setShowHighlightPicker(false);
  };

  return (
    <div
      ref={toolbarRef}
      onMouseDown={isFloating ? startDrag : undefined}
      style={isFloating ? {
        left: toolbarPosition?.x ?? '50%',
        top: toolbarPosition?.y ?? 'auto',
        bottom: !toolbarPosition ? '40px' : 'auto',
        transform: !toolbarPosition ? 'translateX(-50%)' : 'none',
      } : {}}
      className={cn(
        "z-[2000] flex items-center gap-0.5 bg-sidebar/90 border border-border/70 backdrop-blur-md select-none",
        isFloating ? "fixed cursor-grab rounded-[var(--radius-medium)] px-2 py-1.5" : "relative mb-8 mx-auto w-full rounded-[var(--radius-medium)] px-4 py-2",
        !isFloating && "w-full rounded-[var(--radius-medium)] px-4 py-2",
        isFloating && isDraggingState && "cursor-grabbing ring-1 ring-accent/30"
      )}
    >
      {isFloating && (
        <div className="flex flex-col gap-0.5 px-1 opacity-20 group-hover:opacity-40">
          <div className="flex gap-0.5">
            <div className="w-0.5 h-0.5 rounded-[var(--radius-small)] bg-foreground" />
            <div className="w-0.5 h-0.5 rounded-[var(--radius-small)] bg-foreground" />
          </div>
          <div className="flex gap-0.5">
            <div className="w-0.5 h-0.5 rounded-[var(--radius-small)] bg-foreground" />
            <div className="w-0.5 h-0.5 rounded-[var(--radius-small)] bg-foreground" />
          </div>
          <div className="flex gap-0.5">
            <div className="w-0.5 h-0.5 rounded-[var(--radius-small)] bg-foreground" />
            <div className="w-0.5 h-0.5 rounded-[var(--radius-small)] bg-foreground" />
          </div>
        </div>
      )}

      <div className="flex items-center gap-0.5 mr-1 ml-0.5">
        <Tooltip content="Undo (Ctrl+Z)">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="toolbar-btn rounded-[var(--radius-medium)] disabled:opacity-20 disabled:cursor-not-allowed"
          >
            <Undo2 strokeWidth={2} className="w-4 h-4" />
          </button>
        </Tooltip>
        <Tooltip content="Redo (Ctrl+Shift+Z)">
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="toolbar-btn rounded-[var(--radius-medium)] disabled:opacity-20 disabled:cursor-not-allowed"
          >
            <Redo2 strokeWidth={2} className="w-4 h-4" />
          </button>
        </Tooltip>
      </div>

      <div className="w-px h-5 bg-border/50 mx-1" />

      {/* Block Style Dropdown */}
      <div ref={styleRef} className="relative">
        <Tooltip content={activeBlockType && ['bulletList', 'dashedList', 'numberedList', 'checklist'].includes(activeBlockType) ? "Lists are restricted to Body style" : "Block Style"}>
          <button
            onClick={() => !(activeBlockType && ['bulletList', 'dashedList', 'numberedList', 'checklist'].includes(activeBlockType)) && setShowStyleDropdown(!showStyleDropdown)}
            disabled={!!(activeBlockType && ['bulletList', 'dashedList', 'numberedList', 'checklist'].includes(activeBlockType))}
            className={cn("toolbar-btn rounded-[var(--radius-medium)] !w-auto px-2.5 gap-1.5 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed", showStyleDropdown && "toolbar-btn-active")}
          >
            <Type strokeWidth={2} className="w-3.5 h-3.5" />
            <div
              ref={labelContainerRef}
              className="relative overflow-hidden flex items-center justify-start h-4"
              style={{ width: 'auto' }}
            >
              <span ref={labelRef} className="truncate whitespace-nowrap block">
                {displayedStyleLabel}
              </span>
            </div>
            {!(activeBlockType && ['bulletList', 'dashedList', 'numberedList', 'checklist'].includes(activeBlockType)) && (
              <ChevronDown strokeWidth={2} className="w-3 h-3 opacity-50" />
            )}
          </button>
        </Tooltip>
        {showStyleDropdown && (
          <div className="absolute top-full left-0 mt-2 z-[100] popup-glass-small p-1.5 min-w-[160px] overflow-hidden flex flex-col gap-[3px]">
            {BLOCK_STYLES.map(s => (
              <button
                key={s.value}
                onClick={() => { onChangeBlockStyle(s.value); setShowStyleDropdown(false); }}
                className={cn(
                  "popup-item",
                  activeBlockStyle === s.value && "bg-hover text-foreground"
                )}
              >
                {s.icon}
                <span>{s.label}</span>
                {activeBlockStyle === s.value && <Check className="w-3.5 h-3.5 text-accent ml-auto" />}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="w-px h-5 bg-border/50 mx-1" />

      {/* Text Formatting */}
      <Tooltip content="Bold">
        <button
          onMouseDown={(e) => { e.preventDefault(); execCmd('bold'); }}
          className={cn("toolbar-btn rounded-[var(--radius-medium)]", activeFmt.has('bold') && "toolbar-btn-active")}
        >
          <Bold strokeWidth={2} className="w-3.5 h-3.5" />
        </button>
      </Tooltip>
      <Tooltip content="Italic">
        <button
          onMouseDown={(e) => { e.preventDefault(); execCmd('italic'); }}
          className={cn("toolbar-btn rounded-[var(--radius-medium)]", activeFmt.has('italic') && "toolbar-btn-active")}
        >
          <Italic strokeWidth={2} className="w-3.5 h-3.5" />
        </button>
      </Tooltip>
      <Tooltip content="Underline">
        <button
          onMouseDown={(e) => { e.preventDefault(); execCmd('underline'); }}
          className={cn("toolbar-btn rounded-[var(--radius-medium)]", activeFmt.has('underline') && "toolbar-btn-active")}
        >
          <Underline strokeWidth={2} className="w-3.5 h-3.5" />
        </button>
      </Tooltip>
      <Tooltip content="Strikethrough">
        <button
          onMouseDown={(e) => { e.preventDefault(); execCmd('strikethrough'); }}
          className={cn("toolbar-btn rounded-[var(--radius-medium)]", activeFmt.has('strikethrough') && "toolbar-btn-active")}
        >
          <Strikethrough strokeWidth={2} className="w-3.5 h-3.5" />
        </button>
      </Tooltip>

      <div className="w-px h-5 bg-border/50 mx-1" />

      {/* Link */}
      <div ref={linkRef} className="relative">
        <Tooltip content="Link (Ctrl+K)">
          <button
            onClick={handleLinkBtnClick}
            className={cn("toolbar-btn rounded-[var(--radius-medium)]", showLinkPopover && "toolbar-btn-active")}
          >
            <Link strokeWidth={2} className="w-3.5 h-3.5" />
          </button>
        </Tooltip>

        {showLinkPopover && (
          <div className="absolute top-full left-0 mt-2 z-[100] popup-glass-small p-1.5 min-w-[240px] flex gap-2 items-center">
            <input
              ref={linkInputRef}
              type="text"
              placeholder="Paste link..."
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applyLink()}
              className="bg-background border border-border rounded-[var(--radius-medium)] px-2 py-1.5 text-xs flex-1 outline-none focus:border-accent"
            />
            <div className="flex gap-1">
              <button
                onClick={applyLink}
                className="p-1.5 rounded-[var(--radius-small)] hover:bg-accent/10 text-accent"
              >
                <Check strokeWidth={2} className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={removeLink}
                className="p-1.5 rounded-[var(--radius-small)] hover:bg-danger/10 text-danger"
              >
                <Trash strokeWidth={2} className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="w-px h-5 bg-border/50 mx-1" />

      {/* Highlight */}
      <div ref={highlightRef} className="relative">
        <Tooltip content="Highlight">
          <button
            onClick={() => setShowHighlightPicker(!showHighlightPicker)}
            className={cn("toolbar-btn rounded-[var(--radius-medium)]", showHighlightPicker && "toolbar-btn-active")}
          >
            <Highlighter strokeWidth={2} className="w-3.5 h-3.5" />
          </button>
        </Tooltip>
        {showHighlightPicker && (
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 popup-glass-small p-1.5 flex flex-col gap-[3px]">
            <div className="flex gap-1.5">
              {HIGHLIGHT_COLORS.map(c => (
                <button
                  key={c.name}
                  onClick={() => applyHighlight(c.class)}
                  className="w-6 h-6 rounded-[var(--radius-small)]"
                  style={{ backgroundColor: c.color }}
                  title={c.name}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="w-px h-5 bg-border/50 mx-1" />

      {!(activeBlockStyle && ['title', 'heading', 'subheading'].includes(activeBlockStyle)) && (
        <>
          {/* Lists */}
          <Tooltip content="Bulleted List">
            <button
              onClick={() => onConvertToList('bulletList')}
              className="toolbar-btn rounded-[var(--radius-medium)]"
            >
              <List strokeWidth={2} className="w-3.5 h-3.5" />
            </button>
          </Tooltip>
          <Tooltip content="Dashed List">
            <button
              onClick={() => onConvertToList('dashedList')}
              className="toolbar-btn rounded-[var(--radius-medium)]"
            >
              <Minus strokeWidth={2} className="w-3.5 h-3.5" />
            </button>
          </Tooltip>
          <Tooltip content="Numbered List">
            <button
              onClick={() => onConvertToList('numberedList')}
              className="toolbar-btn rounded-[var(--radius-medium)]"
            >
              <ListOrdered strokeWidth={2} className="w-3.5 h-3.5" />
            </button>
          </Tooltip>

          <div className="w-px h-5 bg-border/50 mx-1" />
        </>
      )}

      {/* Alignment */}
      <div ref={alignContainerRef} className="relative flex items-center gap-0.5">
        <div
          ref={alignPillRef}
          className="absolute h-[24px] bg-accent/15 rounded-[var(--radius-medium)] z-0 pointer-events-none"
          style={{ top: '50%', transform: 'translateY(-50%)', transition: 'none' }}
        />

        <Tooltip content="Align Left">
          <button
            onClick={() => onChangeAlign('left')}
            data-active={activeAlign === 'left'}
            className={cn("toolbar-btn rounded-[var(--radius-medium)] relative z-10", activeAlign === 'left' && "!bg-transparent text-accent")}
          >
            <AlignLeft strokeWidth={2} className="w-3.5 h-3.5" />
          </button>
        </Tooltip>
        <Tooltip content="Align Center">
          <button
            onClick={() => onChangeAlign('center')}
            data-active={activeAlign === 'center'}
            className={cn("toolbar-btn rounded-[var(--radius-medium)] relative z-10", activeAlign === 'center' && "!bg-transparent text-accent")}
          >
            <AlignCenter strokeWidth={2} className="w-3.5 h-3.5" />
          </button>
        </Tooltip>
        <Tooltip content="Align Right">
          <button
            onClick={() => onChangeAlign('right')}
            data-active={activeAlign === 'right'}
            className={cn("toolbar-btn rounded-[var(--radius-medium)] relative z-10", activeAlign === 'right' && "!bg-transparent text-accent")}
          >
            <AlignRight strokeWidth={2} className="w-3.5 h-3.5" />
          </button>
        </Tooltip>
        <Tooltip content="Justify">
          <button
            onClick={() => onChangeAlign('justify')}
            data-active={activeAlign === 'justify'}
            className={cn("toolbar-btn rounded-[var(--radius-medium)] relative z-10", activeAlign === 'justify' && "!bg-transparent text-accent")}
          >
            <AlignJustify strokeWidth={2} className="w-3.5 h-3.5" />
          </button>
        </Tooltip>
      </div>

      <div className="w-px h-5 bg-border/50 mx-1" />

      <Tooltip content={isFullWidth ? "Collapse Layout" : "Expand Layout"}>
        <button
          onClick={toggleFullWidth}
          className={cn("toolbar-btn rounded-[var(--radius-medium)]", isFullWidth && "text-accent")}
        >
          {isFullWidth ? <Minimize2 strokeWidth={2} className="w-3.5 h-3.5" /> : <Maximize2 strokeWidth={2} className="w-3.5 h-3.5" />}
        </button>
      </Tooltip>
    </div>
  );
}
