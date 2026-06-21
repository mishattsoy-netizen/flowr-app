"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Bold, Italic, Underline, Strikethrough, Highlighter, Link, Check, Trash } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip } from '../layout/Tooltip';
import { useTooltipSuppression } from '../layout/TooltipOverlayContext';
import { Portal } from '../layout/Portal';

const HIGHLIGHT_COLORS = [
  { name: 'yellow', class: 'highlight-yellow', color: 'rgba(250, 204, 21, 0.5)' },
  { name: 'green', class: 'highlight-green', color: 'rgba(34, 197, 94, 0.5)' },
  { name: 'blue', class: 'highlight-blue', color: 'rgba(59, 130, 246, 0.5)' },
  { name: 'purple', class: 'highlight-purple', color: 'rgba(168, 85, 247, 0.5)' },
  { name: 'red', class: 'highlight-red', color: 'rgba(239, 68, 68, 0.5)' },
  { name: 'orange', class: 'highlight-orange', color: 'rgba(249, 115, 22, 0.5)' },
];

export function SelectionToolbar({ editorRef }: { editorRef: React.RefObject<HTMLDivElement | null> }) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [activeFmt, setActiveFmt] = useState<Set<string>>(new Set());
  const [showLinkPopover, setShowLinkPopover] = useState(false);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');

  // Suppress tooltips when the link popover or highlight picker is open
  useTooltipSuppression(Boolean(showLinkPopover || showHighlightPicker));
  const [storedRange, setStoredRange] = useState<Range | null>(null);
  const linkInputRef = useRef<HTMLInputElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const skipNextCheck = useRef(false);

  const checkFormatting = useCallback(() => {
    const newFmt = new Set<string>();
    if (document.queryCommandState('bold')) newFmt.add('bold');
    if (document.queryCommandState('italic')) newFmt.add('italic');
    if (document.queryCommandState('underline')) newFmt.add('underline');
    if (document.queryCommandState('strikethrough')) newFmt.add('strikethrough');
    setActiveFmt(newFmt);
  }, []);

  const saveRange = useCallback(() => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
      setStoredRange(sel.getRangeAt(0).cloneRange());
    }
  }, []);

  const restoreRange = useCallback(() => {
    if (!storedRange) return;
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(storedRange);
  }, [storedRange]);

  const execCmd = useCallback((cmd: string, value?: string) => {
    restoreRange();
    document.execCommand(cmd, false, value);
    checkFormatting();
  }, [restoreRange, checkFormatting]);

  const handleToolbarAction = useCallback((action: () => void) => {
    skipNextCheck.current = true;
    action();
  }, []);

  // Show/hide on selection change
  useEffect(() => {
    const onSelectionChange = () => {
      if (skipNextCheck.current) {
        skipNextCheck.current = false;
        return;
      }

      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) {
        if (!showLinkPopover && !showHighlightPicker) setVisible(false);
        return;
      }

      const range = sel.getRangeAt(0);
      const editorEl = editorRef.current;
      if (!editorEl) return;

      // Check if selection is inside the editor
      if (!editorEl.contains(range.commonAncestorContainer)) {
        setVisible(false);
        return;
      }

      // Check if selection anchor and focus both reside inside a contenteditable block
      const getElementFromNode = (n: Node | null) => {
        if (!n) return null;
        return (n.nodeType === Node.TEXT_NODE ? n.parentNode : n) as HTMLElement | null;
      };

      const anchorEl = getElementFromNode(sel.anchorNode);
      const focusEl = getElementFromNode(sel.focusNode);

      const isAnchorInsideBlock = anchorEl?.closest('[data-block-id]') && (anchorEl?.closest('[contenteditable="true"]') || anchorEl?.closest('[contenteditable=""]'));
      const isFocusInsideBlock = focusEl?.closest('[data-block-id]') && (focusEl?.closest('[contenteditable="true"]') || focusEl?.closest('[contenteditable=""]'));

      if (!isAnchorInsideBlock || !isFocusInsideBlock) {
        setVisible(false);
        return;
      }

      // Position toolbar above the selection
      const rect = range.getBoundingClientRect();
      const toolbarWidth = 280;
      let left = rect.left + rect.width / 2 - toolbarWidth / 2;
      const toolbarHeight = 40;
      let top = rect.top - toolbarHeight - 8;

      // Clamp to viewport
      left = Math.max(8, Math.min(left, window.innerWidth - toolbarWidth - 8));

      // If not enough space above, show below
      if (top < 4) {
        top = rect.bottom + 8;
      }

      setPosition({ top, left });
      setVisible(true);
      checkFormatting();
    };

    document.addEventListener('selectionchange', onSelectionChange);
    return () => document.removeEventListener('selectionchange', onSelectionChange);
  }, [editorRef, showLinkPopover, showHighlightPicker, checkFormatting]);

  // Close on Escape
  useEffect(() => {
    if (!visible) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setVisible(false);
        setShowLinkPopover(false);
        setShowHighlightPicker(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [visible]);

  // Hide on scroll
  useEffect(() => {
    if (!visible) return;
    const onScroll = () => setVisible(false);
    document.addEventListener('scroll', onScroll, true);
    return () => document.removeEventListener('scroll', onScroll, true);
  }, [visible]);

  // Close sub-popups on outside click
  useEffect(() => {
    if (!showLinkPopover && !showHighlightPicker) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setShowLinkPopover(false);
        setShowHighlightPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showLinkPopover, showHighlightPicker]);

  // Link popup handlers
  const openLinkPopover = () => {
    saveRange();
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;

    let parent = sel.anchorNode?.parentElement;
    let existingUrl = '';
    while (parent && !parent.classList.contains('editor-block')) {
      if (parent.tagName === 'A') {
        existingUrl = (parent as HTMLAnchorElement).href;
        break;
      }
      parent = parent.parentElement;
    }

    setLinkUrl(existingUrl);
    setShowLinkPopover(true);
    setShowHighlightPicker(false);
    setTimeout(() => linkInputRef.current?.focus(), 10);
  };

  const applyLink = () => {
    if (!storedRange) return;
    restoreRange();

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
    restoreRange();
    document.execCommand('unlink');
    setShowLinkPopover(false);
    setLinkUrl('');
    setStoredRange(null);
  };

  // Highlight handler
  const applyHighlight = (colorClass: string) => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    const range = sel.getRangeAt(0);
    const span = document.createElement('span');
    span.className = colorClass;
    try { range.surroundContents(span); } catch {}
    setShowHighlightPicker(false);
  };

  if (!visible) return null;

  return (
    <Portal>
      <div
        ref={toolbarRef}
        className="fixed z-[5000] popup-glass-small px-1.5 py-1 flex items-center gap-0.5"
        style={{ top: position.top, left: position.left }}
        onMouseDown={(e) => e.preventDefault()}
      >
        <button
          onMouseDown={(e) => { e.preventDefault(); handleToolbarAction(() => { saveRange(); execCmd('bold'); }); }}
          className={cn("toolbar-btn rounded-[var(--radius-medium)]", activeFmt.has('bold') && "toolbar-btn-active")}
        >
          <Tooltip content="Bold"><Bold strokeWidth={2} className="w-3.5 h-3.5" /></Tooltip>
        </button>
        <button
          onMouseDown={(e) => { e.preventDefault(); handleToolbarAction(() => { saveRange(); execCmd('italic'); }); }}
          className={cn("toolbar-btn rounded-[var(--radius-medium)]", activeFmt.has('italic') && "toolbar-btn-active")}
        >
          <Tooltip content="Italic"><Italic strokeWidth={2} className="w-3.5 h-3.5" /></Tooltip>
        </button>
        <button
          onMouseDown={(e) => { e.preventDefault(); handleToolbarAction(() => { saveRange(); execCmd('underline'); }); }}
          className={cn("toolbar-btn rounded-[var(--radius-medium)]", activeFmt.has('underline') && "toolbar-btn-active")}
        >
          <Tooltip content="Underline"><Underline strokeWidth={2} className="w-3.5 h-3.5" /></Tooltip>
        </button>
        <button
          onMouseDown={(e) => { e.preventDefault(); handleToolbarAction(() => { saveRange(); execCmd('strikethrough'); }); }}
          className={cn("toolbar-btn rounded-[var(--radius-medium)]", activeFmt.has('strikethrough') && "toolbar-btn-active")}
        >
          <Tooltip content="Strikethrough"><Strikethrough strokeWidth={2} className="w-3.5 h-3.5" /></Tooltip>
        </button>

        <div className="w-px h-5 bg-border/50 mx-1" />

        <div className="relative">
          <button
            onMouseDown={(e) => { e.preventDefault(); handleToolbarAction(openLinkPopover); }}
            className={cn("toolbar-btn rounded-[var(--radius-medium)]", showLinkPopover && "toolbar-btn-active")}
          >
            <Tooltip content="Link"><Link strokeWidth={2} className="w-3.5 h-3.5" /></Tooltip>
          </button>
          {showLinkPopover && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-[5001] popup-glass-small p-1.5 min-w-[240px] flex gap-2 items-center">
              <input
                ref={linkInputRef}
                type="text"
                placeholder="Paste link..."
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applyLink()}
                className="bg-background border border-border rounded-[var(--radius-medium)] px-2 py-1.5 text-xs flex-1 outline-none focus:border-accent"
              />
              <button onClick={applyLink} className="p-1.5 rounded-[var(--radius-small)] hover:bg-accent/10 text-accent">
                <Check strokeWidth={2} className="w-3.5 h-3.5" />
              </button>
              <button onClick={removeLink} className="p-1.5 rounded-[var(--radius-small)] hover:bg-danger/10 text-danger">
                <Trash strokeWidth={2} className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        <div className="relative">
          <button
            onMouseDown={(e) => { e.preventDefault(); handleToolbarAction(() => { setShowHighlightPicker(!showHighlightPicker); setShowLinkPopover(false); }); }}
            className={cn("toolbar-btn rounded-[var(--radius-medium)]", showHighlightPicker && "toolbar-btn-active")}
          >
            <Tooltip content="Highlight"><Highlighter strokeWidth={2} className="w-3.5 h-3.5" /></Tooltip>
          </button>
          {showHighlightPicker && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-[5001] popup-glass-small p-1.5 flex gap-1.5">
              {HIGHLIGHT_COLORS.map(c => (
                <button
                  key={c.name}
                  onMouseDown={(e) => { e.preventDefault(); }}
                  onClick={() => applyHighlight(c.class)}
                  className="w-6 h-6 rounded-[var(--radius-small)]"
                  style={{ backgroundColor: c.color }}
                  title={c.name}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </Portal>
  );
}
