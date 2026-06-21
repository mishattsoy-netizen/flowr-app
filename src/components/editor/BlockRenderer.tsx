"use client";

import {
  GripVertical, Plus, ChevronRight, ChevronDown, Copy, Link as LinkIcon, ExternalLink, Check, Pencil, X
} from 'lucide-react';
import { Tooltip } from '@/components/layout/Tooltip';
import { cn } from '@/lib/utils';
import { EditorBlock, BlockStyle, BlockType, Entity, generateId } from '@/data/store';
import { ListBlock } from './ListBlock';
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
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
  isDraggingGlobal = false,
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
      getInitialData: () => ({ type: 'note-block', blockId: block.id, blockType: block.type }),
      onDragStart: () => setIsDraggingLocal(true),
      onDrop: () => setIsDraggingLocal(false),
    });
  }, [block.id, block.type, isDragOverlay]);

  useEffect(() => {
    const el = elementRef.current;
    if (!el || isDragOverlay) return;

    return dropTargetForElements({
      element: el,
      canDrop: ({ source }) => source.data.type === 'note-block' && source.data.blockId !== block.id,
      getData: ({ input, element }) => attachClosestEdge(
        { type: 'note-block', blockId: block.id, blockType: block.type },
        { input, element, allowedEdges: block.type === 'column' ? ['left', 'right'] : ['top', 'bottom'] }
      ),
      onDragEnter: ({ self, source }) => {
        const edge = extractClosestEdge(self.data);
        setClosestEdge(edge);

        if (source.data.type === 'note-block') {
          const draggedEl = document.querySelector(`[data-block-id="${source.data.blockId}"]`) as HTMLElement;
          const targetEl = elementRef.current;
          if (draggedEl && targetEl && draggedEl !== targetEl) {
            const parent = targetEl.parentNode;
            if (parent) {
              const isColDrag = source.data.blockType === 'column' && block.type === 'column';
              const isVertDrag = source.data.blockType !== 'column' && block.type !== 'column';

              if (isColDrag || isVertDrag) {
                if (edge === 'top' || edge === 'left') {
                  parent.insertBefore(draggedEl, targetEl);
                } else if (edge === 'bottom' || edge === 'right') {
                  parent.insertBefore(draggedEl, targetEl.nextSibling);
                }
              }
            }
          }
        }
      },
      onDrag: ({ self, source }) => {
        const edge = extractClosestEdge(self.data);
        setClosestEdge(edge);

        if (source.data.type === 'note-block') {
          const draggedEl = document.querySelector(`[data-block-id="${source.data.blockId}"]`) as HTMLElement;
          const targetEl = elementRef.current;
          if (draggedEl && targetEl && draggedEl !== targetEl) {
            const parent = targetEl.parentNode;
            if (parent) {
              const isColDrag = source.data.blockType === 'column' && block.type === 'column';
              const isVertDrag = source.data.blockType !== 'column' && block.type !== 'column';

              if (isColDrag || isVertDrag) {
                if (edge === 'top' || edge === 'left') {
                  if (targetEl.previousSibling !== draggedEl) {
                    parent.insertBefore(draggedEl, targetEl);
                  }
                } else if (edge === 'bottom' || edge === 'right') {
                  if (targetEl.nextSibling !== draggedEl) {
                    parent.insertBefore(draggedEl, targetEl.nextSibling);
                  }
                }
              }
            }
          }
        }
      },
      onDragLeave: () => setClosestEdge(null),
      onDrop: () => setClosestEdge(null),
    });
  }, [block.id, block.type, isDragOverlay]);

  const isDragging = isDraggingLocal;

  const style = {
    position: 'relative' as const,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.4 : undefined,
  };

  const contentRef = useRef<HTMLDivElement>(null);
  const lastTypedContent = useRef<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [copied, setCopied] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Inline link button Popover states
  const [activeInlineBtn, setActiveInlineBtn] = useState<{
    element: HTMLAnchorElement;
    rect: DOMRect;
    url: string;
    label: string;
  } | null>(null);

  const [isEditingInlineLabel, setIsEditingInlineLabel] = useState(false);
  const [isEditingInlineUrl, setIsEditingInlineUrl] = useState(false);
  const [inlineLabelInput, setInlineLabelInput] = useState('');
  const [inlineUrlInput, setInlineUrlInput] = useState('');
  const [inlineCopied, setInlineCopied] = useState(false);

  const inlineHoverTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (activeInlineBtn) {
      setInlineLabelInput(activeInlineBtn.label);
      setInlineUrlInput(activeInlineBtn.url);
      setIsEditingInlineLabel(false);
      setIsEditingInlineUrl(false);
      setInlineCopied(false);
    }
  }, [activeInlineBtn]);

  useEffect(() => {
    if (isDraggingGlobal) {
      setActiveInlineBtn(null);
      setPopoverOpen(false);
    }
  }, [isDraggingGlobal]);

  const handleInlineMouseEnter = () => {
    if (inlineHoverTimeout.current) clearTimeout(inlineHoverTimeout.current);
  };

  const handleInlineMouseLeave = () => {
    inlineHoverTimeout.current = setTimeout(() => {
      setActiveInlineBtn(null);
    }, 300);
  };

  const handleContentMouseMove = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const inlineBtn = target.closest('.inline-link-btn') as HTMLAnchorElement;
    if (inlineBtn) {
      if (inlineHoverTimeout.current) clearTimeout(inlineHoverTimeout.current);
      const rect = inlineBtn.getBoundingClientRect();
      const url = inlineBtn.getAttribute('data-url') || inlineBtn.getAttribute('href') || '';
      const label = inlineBtn.getAttribute('data-label') || inlineBtn.textContent || '';
      
      if (!activeInlineBtn || activeInlineBtn.element !== inlineBtn) {
        setActiveInlineBtn({
          element: inlineBtn,
          rect,
          url,
          label
        });
      }
    } else if (activeInlineBtn) {
      if (!inlineHoverTimeout.current) {
        inlineHoverTimeout.current = setTimeout(() => {
          setActiveInlineBtn(null);
          inlineHoverTimeout.current = null;
        }, 300);
      }
    }
  };

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    if (isDraggingGlobal) return;
    const target = e.target as HTMLElement;
    const anchor = target.closest('a');
    
    if (anchor && !anchor.classList.contains('inline-link-btn') && contentRef.current?.contains(anchor)) {
      e.preventDefault();
      e.stopPropagation();
      
      const rect = anchor.getBoundingClientRect();
      const url = anchor.getAttribute('href') || '';
      const label = anchor.textContent || '';
      
      setActiveInlineBtn({
        element: anchor,
        rect,
        url,
        label,
        isStandardLink: true
      });
    }
  }, [isDraggingGlobal]);

  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [labelInput, setLabelInput] = useState(block.content || '');
  const [isEditingUrl, setIsEditingUrl] = useState(false);
  const [urlInput, setUrlInput] = useState(block.linkUrl || '');

  useEffect(() => {
    if (popoverOpen) {
      setLabelInput(block.content || '');
      setIsEditingLabel(false);
      setUrlInput(block.linkUrl || '');
      setIsEditingUrl(false);
    }
  }, [popoverOpen, block.content, block.linkUrl]);

  const handleLinkMouseEnter = () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    setPopoverOpen(true);
  };

  const handleLinkMouseLeave = () => {
    hoverTimerRef.current = setTimeout(() => {
      setPopoverOpen(false);
    }, 200);
  };

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
      if (e.shiftKey) return;

      // Check for inline button shortcuts first
      if (contentRef.current) {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          const node = range.startContainer;
          const offset = range.startOffset;
          if (node.nodeType === Node.TEXT_NODE) {
            const txt = node.textContent || "";
            const before = txt.substring(0, offset);
            if (before.endsWith('/button') || before.endsWith('/link')) {
              const trigLength = before.endsWith('/button') ? 7 : 5;
              e.preventDefault();
              range.setStart(node, offset - trigLength);
              range.setEnd(node, offset);
              sel.removeAllRanges();
              sel.addRange(range);
              range.deleteContents();

              const a = document.createElement('a');
              const url = '';
              const label = '';
              a.href = '#';
              a.className = 'inline-link-btn px-2 py-0.5 mx-1 inline-flex items-center gap-1.5 bg-[var(--bone-5)] hover:bg-[var(--bone-10)] rounded-full text-[11px] font-bold font-sans text-[var(--bone-70)] hover:text-[var(--bone-100)] no-underline select-none border border-[var(--bone-10)] align-baseline';
              a.setAttribute('contenteditable', 'false');
              a.setAttribute('data-url', url);
              a.setAttribute('data-label', label);

              const faviconHtml = `<span class="w-3.5 h-3.5 flex items-center justify-center shrink-0 overflow-hidden pointer-events-none"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-link w-3 h-3 text-[var(--bone-100)] opacity-60 shrink-0 pointer-events-none"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg></span>`;
              a.innerHTML = `${faviconHtml}<span class="max-w-[120px] truncate font-medium pointer-events-none">${label}</span>`;

              range.insertNode(a);

              const space = document.createTextNode('\u00A0');
              range.setStartAfter(a);
              range.collapse(true);
              range.insertNode(space);

              range.setStartAfter(space);
              range.collapse(true);
              sel.removeAllRanges();
              sel.addRange(range);

              onUpdate(block.id, { content: contentRef.current.innerHTML });
              return;
            }
          }
        }
      }

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

          // Check for inline button shortcut on Space press
          if (before.endsWith('/button') || before.endsWith('/link')) {
            const trigLength = before.endsWith('/button') ? 7 : 5;
            e.preventDefault();
            range.setStart(node, offset - trigLength);
            range.setEnd(node, offset);
            sel.removeAllRanges();
            sel.addRange(range);
            range.deleteContents();

            const a = document.createElement('a');
            const url = '';
            const label = '';
            a.href = '#';
            a.className = 'inline-link-btn px-2 py-0.5 mx-1 inline-flex items-center gap-1.5 bg-[var(--bone-5)] hover:bg-[var(--bone-10)] rounded-full text-[11px] font-bold font-sans text-[var(--bone-70)] hover:text-[var(--bone-100)] no-underline select-none border border-[var(--bone-10)] align-baseline';
            a.setAttribute('contenteditable', 'false');
            a.setAttribute('data-url', url);
            a.setAttribute('data-label', label);

            const faviconHtml = `<span class="w-3.5 h-3.5 flex items-center justify-center shrink-0 overflow-hidden pointer-events-none"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-link w-3 h-3 text-[var(--bone-100)] opacity-60 shrink-0 pointer-events-none"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg></span>`;
            a.innerHTML = `${faviconHtml}<span class="max-w-[120px] truncate font-medium pointer-events-none">${label}</span>`;

            range.insertNode(a);

            const space = document.createTextNode('\u00A0');
            range.setStartAfter(a);
            range.collapse(true);
            range.insertNode(space);

            range.setStartAfter(space);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);

            onUpdate(block.id, { content: contentRef.current.innerHTML });
            return;
          }

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
    if (isDraggingGlobal) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    const target = e.target as HTMLElement;
    const anchor = target.closest('a');
    if (anchor) {
      e.preventDefault();
      e.stopPropagation();
      window.open(anchor.href, '_blank', 'noopener,noreferrer');
    }
  }, [isDraggingGlobal]);

  const saveInlineLabel = useCallback((newLabel: string) => {
    if (!activeInlineBtn) return;
    const el = activeInlineBtn.element;
    el.setAttribute('data-label', newLabel);
    
    const labelSpan = el.querySelector('span:last-child');
    if (labelSpan) {
      labelSpan.textContent = newLabel;
    } else {
      el.textContent = newLabel;
    }
    
    if (contentRef.current) {
      const html = contentRef.current.innerHTML;
      lastTypedContent.current = html;
      onUpdate(block.id, { content: html });
    }
    
    setActiveInlineBtn(prev => prev ? { ...prev, label: newLabel } : null);
  }, [activeInlineBtn, block.id, onUpdate]);

  const saveInlineUrl = useCallback((newUrl: string) => {
    if (!activeInlineBtn) return;
    const el = activeInlineBtn.element;
    
    let formattedUrl = newUrl;
    if (newUrl && !newUrl.startsWith('http://') && !newUrl.startsWith('https://')) {
      formattedUrl = 'https://' + newUrl;
    }
    
    el.setAttribute('href', formattedUrl);
    el.setAttribute('data-url', formattedUrl);
    
    let faviconUrl = '';
    try {
      faviconUrl = `https://www.google.com/s2/favicons?domain=${new URL(formattedUrl).hostname}&sz=32`;
    } catch (e) {}
    
    const iconSpan = el.querySelector('span:first-child');
    if (iconSpan) {
      if (faviconUrl) {
        iconSpan.innerHTML = `<img src="${faviconUrl}" class="w-3 h-3 object-contain select-none opacity-80" alt="" />`;
      } else {
        iconSpan.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-link w-3 h-3 text-[var(--bone-100)] opacity-60 shrink-0 pointer-events-none"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>`;
      }
    }
    
    if (contentRef.current) {
      const html = contentRef.current.innerHTML;
      lastTypedContent.current = html;
      onUpdate(block.id, { content: html });
    }
    
    setActiveInlineBtn(prev => prev ? { ...prev, url: formattedUrl } : null);
  }, [activeInlineBtn, block.id, onUpdate]);

  const deleteInlineButton = useCallback(() => {
    if (!activeInlineBtn) return;
    const el = activeInlineBtn.element;
    if (activeInlineBtn.isStandardLink) {
      // Unlink: replace anchor with its children text nodes
      const parent = el.parentNode;
      if (parent) {
        while (el.firstChild) {
          parent.insertBefore(el.firstChild, el);
        }
        el.remove();
      }
    } else {
      el.remove();
    }
    if (contentRef.current) {
      const html = contentRef.current.innerHTML;
      lastTypedContent.current = html;
      onUpdate(block.id, { content: html });
    }
    setActiveInlineBtn(null);
  }, [activeInlineBtn, block.id, onUpdate]);

  const renderInlineLinkPopover = () => {
    if (!activeInlineBtn) return null;
    const blockRect = elementRef.current?.getBoundingClientRect();
    const triggerLeft = blockRect ? activeInlineBtn.rect.left - blockRect.left : 0;
    const triggerTop = blockRect ? activeInlineBtn.rect.top - blockRect.top : 0;

    return (
      <Popover 
        open={!!activeInlineBtn} 
        onOpenChange={(open) => {
          if (!open) {
            setActiveInlineBtn(null);
          }
        }}
      >
        <PopoverTrigger asChild>
          <div
            style={{
              position: 'absolute',
              left: triggerLeft,
              top: triggerTop,
              width: activeInlineBtn.rect.width,
              height: activeInlineBtn.rect.height,
              pointerEvents: 'none',
              zIndex: -1,
            }}
          />
        </PopoverTrigger>
        <PopoverContent
          side="top"
          align="start"
          sideOffset={8}
          className="z-[500] w-[260px] p-2 bg-[var(--app-panel)] border border-[var(--bone-12)] shadow-2xl backdrop-blur-2xl rounded-xl"
          onMouseEnter={handleInlineMouseEnter}
          onMouseLeave={handleInlineMouseLeave}
        >
          <div className="flex flex-col gap-2">
            {/* Section 1: Icon and Label */}
            {!activeInlineBtn.isStandardLink && (
              isEditingInlineLabel ? (
                <div className="flex items-center justify-between w-full px-1.5 py-1 gap-2">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span className="w-5 h-5 flex items-center justify-center shrink-0 rounded-md bg-[var(--bone-5)]">
                      {activeInlineBtn.url ? (
                        <img 
                          src={`https://www.google.com/s2/favicons?domain=${new URL(activeInlineBtn.url).hostname}&sz=32`} 
                          alt="" 
                          className="w-3.5 h-3.5 object-contain"
                          onError={(e) => {
                            const img = e.currentTarget;
                            img.style.display = 'none';
                            const fallback = img.parentElement?.querySelector('svg');
                            if (fallback) fallback.style.display = 'block';
                          }}
                        />
                      ) : null}
                      <LinkIcon className="w-3.5 h-3.5 text-[var(--bone-100)] opacity-60" style={{ display: activeInlineBtn.url ? 'none' : 'block' }} />
                    </span>
                    <input
                      type="text"
                      placeholder="Link Label"
                      className="bg-transparent border-none outline-none text-[11px] font-bold text-[var(--bone-100)] w-full p-0 border-b border-[var(--bone-12)] focus:border-[var(--bone-30)] font-sans"
                      value={inlineLabelInput}
                      onChange={(e) => setInlineLabelInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          saveInlineLabel(inlineLabelInput);
                          setIsEditingInlineLabel(false);
                        } else if (e.key === 'Escape') {
                          setInlineLabelInput(activeInlineBtn.label);
                          setIsEditingInlineLabel(false);
                        }
                      }}
                      autoFocus
                    />
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => {
                        saveInlineLabel(inlineLabelInput);
                        setIsEditingInlineLabel(false);
                      }}
                      className="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--bone-5)] text-green-500 hover:text-green-400 cursor-pointer"
                      title="Save"
                    >
                      <Check className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => {
                        setInlineLabelInput(activeInlineBtn.label);
                        setIsEditingInlineLabel(false);
                      }}
                      className="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--bone-5)] text-red-500 hover:text-red-400 cursor-pointer"
                      title="Cancel"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between w-full px-1.5 py-1 group/inline-label">
                  <div 
                    onClick={() => {
                      setIsEditingInlineLabel(true);
                      setIsEditingInlineUrl(false);
                    }}
                    className="flex items-center gap-2.5 min-w-0 cursor-pointer hover:opacity-80 transition-opacity"
                  >
                    <span className="w-5 h-5 flex items-center justify-center shrink-0 rounded-md bg-[var(--bone-5)]">
                      {activeInlineBtn.url ? (
                        <img 
                          src={`https://www.google.com/s2/favicons?domain=${new URL(activeInlineBtn.url).hostname}&sz=32`} 
                          alt="" 
                          className="w-3.5 h-3.5 object-contain"
                          onError={(e) => {
                            const img = e.currentTarget;
                            img.style.display = 'none';
                            const fallback = img.parentElement?.querySelector('svg');
                            if (fallback) fallback.style.display = 'block';
                          }}
                        />
                      ) : null}
                      <LinkIcon className="w-3.5 h-3.5 text-[var(--bone-100)] opacity-60" style={{ display: activeInlineBtn.url ? 'none' : 'block' }} />
                    </span>
                    <span className="text-[11px] font-bold text-[var(--bone-100)] truncate max-w-[140px]">
                      {activeInlineBtn.label || 'Link Label'}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setIsEditingInlineLabel(true);
                      setIsEditingInlineUrl(false);
                    }}
                    className="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--bone-5)] text-[var(--bone-100)] opacity-0 group-hover/inline-label:opacity-30 hover:!opacity-100 transition-all duration-150 cursor-pointer"
                    title="Edit Label"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                </div>
              )
            )}

            {/* Section 2: URL Edit */}
            {isEditingInlineUrl ? (
              <div className="flex items-center justify-between w-full px-1.5 py-0.5 gap-2">
                <input
                  type="text"
                  placeholder="Paste URL here..."
                  className="flex-1 bg-[var(--bone-5)] border border-[var(--bone-12)] focus:border-[var(--bone-30)] outline-none rounded-[6px] px-2 py-1 text-[11px] text-[var(--bone-100)] placeholder-[var(--bone-30)] font-sans"
                  value={inlineUrlInput}
                  onChange={(e) => setInlineUrlInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      saveInlineUrl(inlineUrlInput);
                      setIsEditingInlineUrl(false);
                    } else if (e.key === 'Escape') {
                      setInlineUrlInput(activeInlineBtn.url);
                      setIsEditingInlineUrl(false);
                    }
                  }}
                  autoFocus
                />
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => {
                      saveInlineUrl(inlineUrlInput);
                      setIsEditingInlineUrl(false);
                    }}
                    className="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--bone-5)] text-green-500 hover:text-green-400 cursor-pointer"
                    title="Save"
                  >
                    <Check className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => {
                      setInlineUrlInput(activeInlineBtn.url);
                      setIsEditingInlineUrl(false);
                    }}
                    className="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--bone-5)] text-red-500 hover:text-red-400 cursor-pointer"
                    title="Cancel"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between w-full px-1.5 py-0.5 group/inline-url">
                <span 
                  onClick={() => {
                    setIsEditingInlineUrl(true);
                    setIsEditingInlineLabel(false);
                  }}
                  className="text-[10px] text-[var(--bone-40)] hover:text-[var(--bone-80)] cursor-pointer font-sans truncate max-w-[200px] transition-colors"
                >
                  {activeInlineBtn.url || 'No URL set'}
                </span>
                <button
                  onClick={() => {
                    setIsEditingInlineUrl(true);
                    setIsEditingInlineLabel(false);
                  }}
                  className="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--bone-5)] text-[var(--bone-100)] opacity-0 group-hover/inline-url:opacity-30 hover:!opacity-100 transition-all duration-150 cursor-pointer"
                  title="Edit URL"
                >
                  <Pencil className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* Section 3: Copy, Open, and Delete buttons */}
            <div className="flex items-center gap-1 border-t border-[var(--bone-6)] pt-1.5 mt-0.5">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (activeInlineBtn.url) {
                    navigator.clipboard.writeText(activeInlineBtn.url).then(() => {
                      setInlineCopied(true);
                      setTimeout(() => setInlineCopied(false), 2000);
                    });
                  }
                }}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md hover:bg-[var(--bone-5)] text-[var(--bone-100)] transition-colors cursor-pointer",
                  inlineCopied ? "opacity-100" : "opacity-35 hover:opacity-100"
                )}
              >
                {inlineCopied ? (
                  <Check className="w-3 h-3 text-green-500" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  {inlineCopied ? "COPIED" : "COPY"}
                </span>
              </button>
              <div className="w-px h-3 bg-[var(--bone-6)]" />
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (activeInlineBtn.url) {
                    window.open(activeInlineBtn.url, '_blank', 'noopener,noreferrer');
                  }
                }}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md hover:bg-[var(--bone-5)] text-[var(--bone-100)] opacity-35 hover:opacity-100 transition-colors cursor-pointer"
              >
                <ExternalLink className="w-3 h-3 shrink-0" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Open</span>
              </button>
              <div className="w-px h-3 bg-[var(--bone-6)]" />
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  deleteInlineButton();
                }}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md hover:bg-[var(--bone-5)] text-red-500 hover:text-red-400 opacity-60 hover:opacity-100 transition-colors cursor-pointer"
              >
                <X className="w-3 h-3" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Delete</span>
              </button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    );
  };

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
    dragHandleRef,
    isDraggingGlobal
  };

  // ─── Divider ──────────────────────────────────────────
  if (block.type === 'divider') {
    return (
      <div
        ref={elementRef}
        data-block-id={block.id}
        style={style}
        className={cn("editor-block group flex flex-col items-start relative px-1 before:absolute before:right-full before:top-[-4px] before:bottom-[-4px] before:w-16 before:content-['']")}
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
        className={cn("editor-block group py-2 relative flex flex-col items-stretch before:absolute before:right-full before:top-[-4px] before:bottom-[-4px] before:w-16 before:content-['']")}
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
        className={cn("editor-block group py-2 relative flex flex-col items-stretch before:absolute before:right-full before:top-[-4px] before:bottom-[-4px] before:w-16 before:content-['']")}
      >
        <BlockControls {...controlsProps} topOffset="8px" />
        <div className={cn(
          "relative w-full rounded-3xl transition-colors duration-0 group/table",
          isSelected && "bg-[var(--app-dark)]"
        )}>
          <TableBlock block={block} onUpdate={onUpdate} onContextMenu={handleContextMenu} />
        </div>
        {closestEdge && (
          <div
            className={cn(
              "absolute left-0 right-0 h-[2px] bg-[var(--bone-35)] rounded-full pointer-events-none z-50",
              closestEdge === 'top' ? 'top-0' : 'bottom-0'
            )}
          />
        )}
        {renderInlineLinkPopover()}
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
          "editor-block group py-2 relative flex flex-col items-stretch before:absolute before:right-full before:top-[-4px] before:bottom-[-4px] before:w-16 before:content-['']",
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
        className={cn("editor-block group py-2 relative before:absolute before:right-full before:top-[-4px] before:bottom-[-4px] before:w-16 before:content-['']")}
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
        className={cn("editor-block group py-1.5 relative flex flex-col items-start before:absolute before:right-full before:top-[-4px] before:bottom-[-4px] before:w-16 before:content-['']")}
      >
        <BlockControls {...controlsProps} topOffset="6px" />
        <div className="flex items-center ml-4 relative z-10">
          <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            <PopoverTrigger asChild>
              <a
                href={block.linkUrl || '#'}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (block.linkUrl) {
                    window.open(block.linkUrl, '_blank', 'noopener,noreferrer');
                  }
                }}
                target="_blank"
                rel="noopener noreferrer"
                onMouseEnter={handleLinkMouseEnter}
                onMouseLeave={handleLinkMouseLeave}
                className="link-block-btn inline-flex items-center gap-1.5 px-2 py-1 bg-[var(--bone-5)] hover:bg-[var(--bone-10)] rounded-full text-[11px] font-bold font-sans text-[var(--bone-70)] hover:text-[var(--bone-100)] no-underline transition-all duration-200 select-none border border-[var(--bone-10)]"
              >
                {faviconUrl ? (
                  <span className="w-3.5 h-3.5 flex items-center justify-center shrink-0 overflow-hidden rounded-[4px]">
                    <img src={faviconUrl} className="w-3 h-3 object-contain select-none opacity-80" alt="" />
                  </span>
                ) : (
                  <span className="w-3.5 h-3.5 flex items-center justify-center shrink-0 overflow-hidden">
                    <LinkIcon className="w-3 h-3 text-[var(--bone-100)] opacity-60 shrink-0" />
                  </span>
                )}
                <span className="min-w-[40px] font-medium truncate max-w-[120px]">
                  {block.content || 'Link Label'}
                </span>
              </a>
            </PopoverTrigger>
            <PopoverContent
              side="top"
              align="start"
              sideOffset={8}
              className="z-[500] w-[260px] p-2 bg-[var(--app-panel)] border border-[var(--bone-12)] shadow-2xl backdrop-blur-2xl rounded-xl"
              onMouseEnter={handleLinkMouseEnter}
              onMouseLeave={handleLinkMouseLeave}
            >
              <div className="flex flex-col gap-2">
                {/* Section 1: Icon and Label */}
                {isEditingLabel ? (
                  <div className="flex items-center justify-between w-full px-1.5 py-1 gap-2">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      {faviconUrl ? (
                        <span className="w-5 h-5 flex items-center justify-center shrink-0 rounded-md bg-[var(--bone-5)]">
                          <img src={faviconUrl} alt="" className="w-3.5 h-3.5 object-contain" />
                        </span>
                      ) : (
                        <span className="w-5 h-5 flex items-center justify-center shrink-0 rounded-md bg-[var(--bone-5)]">
                          <LinkIcon className="w-3.5 h-3.5 text-[var(--bone-100)] opacity-60" />
                        </span>
                      )}
                      <input
                        type="text"
                        placeholder="Link Label"
                        className="bg-transparent border-none outline-none text-[11px] font-bold text-[var(--bone-100)] w-full p-0 border-b border-[var(--bone-12)] focus:border-[var(--bone-30)] font-sans"
                        value={labelInput}
                        onChange={(e) => setLabelInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            onUpdate(block.id, { content: labelInput });
                            setIsEditingLabel(false);
                          } else if (e.key === 'Escape') {
                            setLabelInput(block.content || '');
                            setIsEditingLabel(false);
                          }
                        }}
                        autoFocus
                      />
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => {
                          onUpdate(block.id, { content: labelInput });
                          setIsEditingLabel(false);
                        }}
                        className="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--bone-5)] text-green-500 hover:text-green-400 cursor-pointer"
                        title="Save"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => {
                          setLabelInput(block.content || '');
                          setIsEditingLabel(false);
                        }}
                        className="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--bone-5)] text-red-500 hover:text-red-400 cursor-pointer"
                        title="Cancel"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between w-full px-1.5 py-1 group/label">
                    <div 
                      onClick={() => {
                        setIsEditingLabel(true);
                        setIsEditingUrl(false);
                      }}
                      className="flex items-center gap-2.5 min-w-0 cursor-pointer hover:opacity-80 transition-opacity"
                    >
                      {faviconUrl ? (
                        <span className="w-5 h-5 flex items-center justify-center shrink-0 rounded-md bg-[var(--bone-5)]">
                          <img src={faviconUrl} alt="" className="w-3.5 h-3.5 object-contain" />
                        </span>
                      ) : (
                        <span className="w-5 h-5 flex items-center justify-center shrink-0 rounded-md bg-[var(--bone-5)]">
                          <LinkIcon className="w-3.5 h-3.5 text-[var(--bone-100)] opacity-60" />
                        </span>
                      )}
                      <span className="text-[11px] font-bold text-[var(--bone-100)] truncate max-w-[140px]">
                        {block.content || 'Link Label'}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        setIsEditingLabel(true);
                        setIsEditingUrl(false);
                      }}
                      className="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--bone-5)] text-[var(--bone-100)] opacity-0 group-hover/label:opacity-30 hover:!opacity-100 transition-all duration-150 cursor-pointer"
                      title="Edit Label"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                  </div>
                )}

                {/* Section 2: Input box to paste and edit URL */}
                {isEditingUrl ? (
                  <div className="flex items-center justify-between w-full px-1.5 py-0.5 gap-2">
                    <input
                      type="text"
                      placeholder="Paste URL here..."
                      className="flex-1 bg-[var(--bone-5)] border border-[var(--bone-12)] focus:border-[var(--bone-30)] outline-none rounded-none px-2 py-1 text-[11px] text-[var(--bone-100)] placeholder-[var(--bone-30)] font-sans"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          onUpdate(block.id, { linkUrl: urlInput });
                          setIsEditingUrl(false);
                        } else if (e.key === 'Escape') {
                          setUrlInput(block.linkUrl || '');
                          setIsEditingUrl(false);
                        }
                      }}
                      autoFocus
                    />
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => {
                          onUpdate(block.id, { linkUrl: urlInput });
                          setIsEditingUrl(false);
                        }}
                        className="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--bone-5)] text-green-500 hover:text-green-400 cursor-pointer"
                        title="Save"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => {
                          setUrlInput(block.linkUrl || '');
                          setIsEditingUrl(false);
                        }}
                        className="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--bone-5)] text-red-500 hover:text-red-400 cursor-pointer"
                        title="Cancel"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between w-full px-1.5 py-0.5 group/url">
                    <span 
                      onClick={() => {
                        setIsEditingUrl(true);
                        setIsEditingLabel(false);
                      }}
                      className="text-[10px] text-[var(--bone-40)] hover:text-[var(--bone-80)] cursor-pointer font-sans truncate max-w-[200px] transition-colors"
                    >
                      {block.linkUrl || 'No URL set'}
                    </span>
                    <button
                      onClick={() => {
                        setIsEditingUrl(true);
                        setIsEditingLabel(false);
                      }}
                      className="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--bone-5)] text-[var(--bone-100)] opacity-0 group-hover/url:opacity-30 hover:!opacity-100 transition-all duration-150 cursor-pointer"
                      title="Edit URL"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                  </div>
                )}

                {/* Section 3: Copy and Open buttons */}
                <div className="flex items-center gap-1 border-t border-[var(--bone-6)] pt-1.5 mt-0.5">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (block.linkUrl) {
                        navigator.clipboard.writeText(block.linkUrl).then(() => {
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        });
                      }
                    }}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md hover:bg-[var(--bone-5)] text-[var(--bone-100)] transition-all cursor-pointer",
                      copied ? "opacity-100" : "opacity-35 hover:opacity-100"
                    )}
                  >
                    {copied ? (
                      <Check className="w-3 h-3 text-green-500" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    <span className="text-[10px] font-bold uppercase tracking-wider">
                      {copied ? "COPIED" : "COPY"}
                    </span>
                  </button>
                  <div className="w-px h-3 bg-[var(--bone-6)]" />
                  <a
                    href={block.linkUrl || '#'}
                    onClick={(e) => { if (!block.linkUrl) e.preventDefault(); }}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md hover:bg-[var(--bone-5)] text-[var(--bone-100)] opacity-35 hover:opacity-100 transition-all cursor-pointer no-underline"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Open</span>
                  </a>
                </div>
              </div>
            </PopoverContent>
          </Popover>
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
          "flex-1 basis-0 min-w-0 break-words rounded-[var(--radius-medium)] pl-14 pr-4 column-container relative group group/column group-hover:bg-hover/10 group-focus-within:bg-hover/10 transition-colors duration-0",
          isSelected && "bg-[var(--app-dark)]",
          !block.children?.length && "empty"
        )}
      >
        <BlockControls variant="column" blockId={block.id} menuOpen={menuOpen} onInsertAfter={onInsertAfter} onOpenMenu={onOpenMenu} onDragStart={onDragStart} isSelected={isSelected} isFocused={false} topOffset="6px" dragHandleRef={dragHandleRef} isDraggingGlobal={isDraggingGlobal} />
        <div className={cn("flex flex-col gap-2 relative z-10")}>
          {(block.children || []).map((subBlock: EditorBlock, sIdx: number) => (
            <BlockRenderer key={subBlock.id} block={subBlock} index={sIdx} onUpdate={onUpdate} onDelete={onDelete} onIndent={onIndent} onUnindent={onUnindent} onInsertAfter={onInsertAfter} onSlash={onSlash} onOpenMenu={onOpenMenu} onFocus={onFocus} isInsideColumn={true} onDragStart={onDragStart} isDraggingGlobal={isDraggingGlobal} />
          ))}
        </div>
        {closestEdge && (
          <div
            className={cn(
              "absolute top-0 bottom-0 w-[4px] bg-accent rounded-full pointer-events-none z-50",
              closestEdge === 'left' ? 'left-0' : 'right-0'
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
        className={cn("editor-block group py-2 relative flex flex-col transition-colors duration-0 before:absolute before:right-full before:top-[-4px] before:bottom-[-4px] before:w-16 before:content-['']")}
      >
        <BlockControls {...controlsProps} topOffset="8px" />
        <div className={cn("flex gap-4 w-full h-full relative z-10 group")}>
          <div className="flex gap-4 w-full h-full">
            {(block.children || []).map((colBlock: EditorBlock, cIdx: number) => (
              <div key={colBlock.id} className="relative flex-1 basis-0 min-w-0 flex flex-col">
                <BlockRenderer block={colBlock} index={cIdx} onUpdate={onUpdate} onDelete={onDelete} onIndent={onIndent} onUnindent={onUnindent} onInsertAfter={onInsertAfter} onSlash={onSlash} onOpenMenu={onOpenMenu} onFocus={onFocus} isInsideColumn={true} onDragStart={onDragStart} isDraggingGlobal={isDraggingGlobal} />
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
          "before:absolute before:right-full before:top-[-4px] before:bottom-[-4px] before:w-16 before:content-['']",
          isFocused && "focused",
          isSelected && "selected-block",
        )}
        style={{ ...style, fontFamily: '"Literata"', letterSpacing: '-0.01em' }}
      >
        <BlockControls {...controlsProps} topOffset="8px" />
        <div className={cn(
          "flex-1 flex items-start w-full relative rounded-[var(--radius-medium)] pl-3 pr-1 py-1 transition-all duration-0",
          isSelected ? "bg-[var(--app-dark)]" : "group-hover:bg-[var(--bone-2)]"
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
            isDraggingGlobal={isDraggingGlobal}
            onMouseMove={handleContentMouseMove}
            onMouseLeave={handleInlineMouseLeave}
            onContextMenu={handleContextMenu}
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
        {renderInlineLinkPopover()}
      </div>
    );
  }

  const blockRect = elementRef.current?.getBoundingClientRect();
  const triggerLeft = blockRect && activeInlineBtn ? activeInlineBtn.rect.left - blockRect.left : 0;
  const triggerTop = blockRect && activeInlineBtn ? activeInlineBtn.rect.top - blockRect.top : 0;

  const textTopOffset = effectiveStyle === 'mono' ? '20px' : (block.bgColor ? '10px' : '6px');

  return (
    <div
      ref={elementRef}
      data-block-id={block.id}
      className={cn(
        "editor-block group flex flex-col relative overflow-visible transition-all duration-0",
        effectiveStyle === 'mono' ? "py-2" : "py-0.5",
        "before:absolute before:right-full before:top-[-4px] before:bottom-[-4px] before:w-16 before:content-['']",
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
          (!isSelected && effectiveStyle !== 'mono') && (isFocused ? "bg-[var(--bone-2)]" : "group-hover:bg-[var(--bone-2)]"),
          block.bgColor && "border px-[16px] py-[8px]"
        )}
        style={{ ... (block.bgColor ? colorStyle : {}) }}
      >
        <div className="flex-1 flex items-start w-full min-h-[1.5em] h-full relative">
          {block.foldingEnabled && (
            <div
              className={cn(
                "mr-1.5 shrink-0 flex items-center justify-center cursor-pointer hover:bg-[var(--bone-10)] rounded transition-colors text-muted-foreground/40 hover:text-foreground",
                getLineHeightClass(effectiveStyle),
                isDraggingGlobal && "pointer-events-none"
              )}
              style={{ width: '20px' }}
              onClick={(e) => {
                e.stopPropagation();
                if (isDraggingGlobal) return;
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
            onMouseMove={handleContentMouseMove}
            onContextMenu={handleContextMenu}
            onMouseLeave={handleInlineMouseLeave}
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

      {/* Dynamic Popover for Inline Link Buttons */}
      {renderInlineLinkPopover()}
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
  isDraggingGlobal?: boolean;
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
  dragHandleRef,
  isDraggingGlobal = false
}: BlockControlsProps) {
  const markerBtnClass = "w-7 h-7 flex items-center justify-center rounded-sm hover:bg-[var(--bone-10)] text-muted-foreground/40 hover:text-[var(--bone-100)] transition-none";

  const handleGripClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (isDraggingGlobal) return;
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
        (menuOpen || isDragging || isFocused || isSelected) ? "opacity-100 visible" : "opacity-0 group-hover:opacity-100 hover:opacity-100 has-[:active]:opacity-100 transition-none",
        isDraggingGlobal && "pointer-events-none opacity-0 invisible"
      )}
      style={{
        width: 'auto',
        minWidth: '42px',
        top: topOffset ?? (hasBgColor ? '0.5rem' : '0'),
        zIndex: 101,
        height: heightClass ? undefined : '1.5em'
      }}
    >
      <Tooltip content="Add below" disabled={isDraggingGlobal}>
        <button onClick={() => onInsertAfter(blockId)} className={markerBtnClass} disabled={isDraggingGlobal}>
          <Plus strokeWidth={2} className="w-4 h-4" />
        </button>
      </Tooltip>

      <Tooltip content="Drag / Options" disabled={isDraggingGlobal}>
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
