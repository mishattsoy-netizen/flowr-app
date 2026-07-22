"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Bold, Italic, Underline, Strikethrough, Highlighter, Link, Check, Trash, X, Palette, CircleDashed } from 'lucide-react';
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

const COLORS = [
  '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#F97316', '#06B6D4',
];


export function SelectionToolbar({
  editorRef,
  isReadOnly = false,
  disjointTextRanges = [],
  setDisjointTextRanges,
  forceHide = false,
}: {
  editorRef: React.RefObject<HTMLDivElement | null>;
  isReadOnly?: boolean;
  disjointTextRanges?: Array<{ id: string; text: string; range: Range }>;
  setDisjointTextRanges?: React.Dispatch<React.SetStateAction<Array<{ id: string; text: string; range: Range }>>>;
  // True while another popup (block options / slash / mention menu) is open.
  // Without this, the formatting toolbar kept floating on screen alongside
  // whatever menu the user opened next, since its own visibility logic only
  // reacts to the text selection, not to sibling popups.
  forceHide?: boolean;
}) {
  if (isReadOnly) return null;
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [activeFmt, setActiveFmt] = useState<Set<string>>(new Set());
  const [activeColor, setActiveColor] = useState<string | null>(null);
  const [showLinkPopover, setShowLinkPopover] = useState(false);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');

  // Suppress tooltips when the link popover or highlight/color picker is open
  useTooltipSuppression(Boolean(showLinkPopover || showHighlightPicker || showColorPicker));
  const [storedRange, setStoredRange] = useState<Range | null>(null);

  // Close any open sub-popover when another editor popup takes over, so it
  // doesn't come back stale-open the next time the toolbar reappears.
  useEffect(() => {
    if (forceHide) {
      setShowLinkPopover(false);
      setShowHighlightPicker(false);
      setShowColorPicker(false);
    }
  }, [forceHide]);
  const linkInputRef = useRef<HTMLInputElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const skipNextCheck = useRef(false);

  const checkFormatting = useCallback(() => {
    const newFmt = new Set<string>();
    if (disjointTextRanges.length > 0) {
      const sel = window.getSelection();
      const firstRange = disjointTextRanges[0]?.range;
      if (firstRange) {
        try {
          sel?.removeAllRanges();
          sel?.addRange(firstRange);
        } catch (_) {}
      }
    }
    if (document.queryCommandState('bold')) newFmt.add('bold');
    if (document.queryCommandState('italic')) newFmt.add('italic');
    if (document.queryCommandState('underline')) newFmt.add('underline');
    if (document.queryCommandState('strikethrough')) newFmt.add('strikethrough');
    setActiveFmt(newFmt);

    const sel = window.getSelection();
    let currentHtmlColor: string | null = null;
    if (sel && sel.rangeCount > 0) {
      let node = sel.getRangeAt(0).commonAncestorContainer;
      if (node.nodeType === Node.TEXT_NODE && node.parentNode) node = node.parentNode;
      while (node && node instanceof HTMLElement && !node.getAttribute('data-block-content')) {
        if (node.style.color) {
          currentHtmlColor = node.style.color;
          break;
        }
        node = node.parentNode as HTMLElement;
      }
    }
    setActiveColor(currentHtmlColor);
  }, [disjointTextRanges]);

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
    if (disjointTextRanges.length > 0) {
      const sel = window.getSelection();
      const updatedList: Array<{ id: string; text: string; range: Range }> = [];

      disjointTextRanges.forEach(r => {
        try {
          sel?.removeAllRanges();
          sel?.addRange(r.range);
          document.execCommand(cmd, false, value);
          if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
            updatedList.push({
              ...r,
              text: sel.toString() || r.text,
              range: sel.getRangeAt(0).cloneRange()
            });
          } else {
            updatedList.push(r);
          }
        } catch (_) {
          updatedList.push(r);
        }
      });

      if (setDisjointTextRanges && updatedList.length > 0) {
        setDisjointTextRanges(updatedList);
      }

      setActiveFmt(prev => {
        const next = new Set(prev);
        if (next.has(cmd)) {
          next.delete(cmd);
        } else {
          next.add(cmd);
        }
        return next;
      });
      setVisible(true);
    } else {
      // Single selection: the toolbar's onMouseDown preventDefault already
      // keeps the live selection intact through the click, and execCommand
      // natively preserves that selection over the newly-formatted text. The
      // old save/restore dance (removeAllRanges + addRange from a stored
      // range) actively BROKE this: setStoredRange is async, so restoreRange
      // read the PREVIOUS toggle's range — stale after execCommand mutated the
      // DOM — and re-applying it shifted/collapsed the selection on every
      // toggle. Just run the command and re-read the format state.
      document.execCommand(cmd, false, value);
      checkFormatting();
      setVisible(true);
    }
  }, [checkFormatting, disjointTextRanges, setDisjointTextRanges]);

  const handleToolbarAction = useCallback((action: () => void) => {
    skipNextCheck.current = true;
    action();
    setVisible(true);
    setTimeout(() => {
      skipNextCheck.current = false;
    }, 50);
  }, []);

  // Show/hide on selection change & multi-selection positioning
  useEffect(() => {
    if (disjointTextRanges.length > 0) {
      const lastItem = disjointTextRanges[disjointTextRanges.length - 1];
      if (lastItem && lastItem.range) {
        try {
          const rect = lastItem.range.getBoundingClientRect();
          if (rect.width || rect.height) {
            const toolbarWidth = 280;
            let left = rect.left + rect.width / 2 - toolbarWidth / 2;
            const toolbarHeight = 40;
            let top = rect.top - toolbarHeight - 8;

            left = Math.max(8, Math.min(left, window.innerWidth - toolbarWidth - 8));
            if (top < 4) top = rect.bottom + 8;

            setPosition({ top, left });
            setVisible(true);
            return;
          }
        } catch (_) {}
      }
    }

    const onSelectionChange = () => {
      if (skipNextCheck.current) {
        return;
      }

      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) {
        if (!showLinkPopover && !showHighlightPicker && !showColorPicker && disjointTextRanges.length === 0) {
          setVisible(false);
        }
        return;
      }

      const range = sel.getRangeAt(0);
      const editorEl = editorRef.current;
      if (!editorEl) return;

      // Check if selection is inside the editor
      if (!editorEl.contains(range.commonAncestorContainer)) {
        if (disjointTextRanges.length === 0) setVisible(false);
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
        if (disjointTextRanges.length === 0) setVisible(false);
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
    onSelectionChange();
    return () => document.removeEventListener('selectionchange', onSelectionChange);
  }, [editorRef, showLinkPopover, showHighlightPicker, showColorPicker, checkFormatting, disjointTextRanges]);

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
    setShowColorPicker(false);
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
    try { range.surroundContents(span); } catch { }
    setShowHighlightPicker(false);
  };

  const applyTextColor = (color?: string) => {
    document.execCommand('styleWithCSS', false, 'true');
    if (color) {
      document.execCommand('foreColor', false, color);
    } else {
      document.execCommand('foreColor', false, 'inherit');
    }
    setShowColorPicker(false);
  };

  if (!visible || forceHide) return null;

  return (
    <Portal>
      <div
        ref={toolbarRef}
        className="fixed z-[5000] popup-glass-small flex items-center gap-0.5"
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
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-[5001] popup-glass-small min-w-[240px] flex items-center justify-between gap-2">
              <input
                ref={linkInputRef}
                type="text"
                placeholder="Paste link..."
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applyLink()}
                className="flex-1 bg-[var(--bone-5)] border border-[var(--bone-12)] focus:border-[var(--bone-30)] outline-none rounded-[6px] px-2 py-1.5 text-[11px] text-[var(--bone-100)] placeholder-[var(--bone-30)] font-sans"
              />
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={applyLink} className="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--bone-5)] text-green-500 hover:text-green-400 cursor-pointer">
                  <Check strokeWidth={2.5} className="w-3 h-3" />
                </button>
                <button onClick={removeLink} className="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--bone-5)] text-red-500 hover:text-red-400 cursor-pointer">
                  <X strokeWidth={2.5} className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="relative">
          <button
            onMouseDown={(e) => { e.preventDefault(); handleToolbarAction(() => { setShowHighlightPicker(!showHighlightPicker); setShowColorPicker(false); setShowLinkPopover(false); }); }}
            className={cn("toolbar-btn rounded-[var(--radius-medium)]", showHighlightPicker && "toolbar-btn-active")}
          >
            <Tooltip content="Highlight"><Highlighter strokeWidth={2} className="w-3.5 h-3.5" /></Tooltip>
          </button>
          {showHighlightPicker && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-[5001] popup-glass-small flex gap-1.5">
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

        <div className="relative">
          <button
            onMouseDown={(e) => { e.preventDefault(); handleToolbarAction(() => { setShowColorPicker(!showColorPicker); setShowHighlightPicker(false); setShowLinkPopover(false); }); }}
            className={cn("toolbar-btn rounded-[var(--radius-medium)]", showColorPicker && "toolbar-btn-active")}
          >
            <Tooltip content="Text Color">
              {activeColor ? (
                <div className="w-3.5 h-3.5 rounded-full shadow-sm ring-1 ring-black/5" style={{ backgroundColor: activeColor }} />
              ) : (
                <div className="w-3.5 h-3.5 rounded-full border-[1.5px] border-current opacity-70" />
              )}
            </Tooltip>
          </button>
          {showColorPicker && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-[5001] popup-glass-small flex flex-col gap-2 min-w-[160px]">
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyTextColor(undefined)}
                className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-[8px] text-[13px] font-medium cursor-pointer transition-none text-[var(--bone-70)] hover:bg-[var(--bone-5)]"
              >
                <CircleDashed className="w-3.5 h-3.5 shrink-0 text-[var(--bone-40)]" />
                <span>None</span>
              </button>
              <div className="grid grid-cols-4 gap-2 px-1 pb-0.5 place-items-center">
                {COLORS.slice(0, 4).map(c => (
                  <button
                    key={c}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applyTextColor(c)}
                    className="w-7 h-7 rounded-full transition-all cursor-pointer flex items-center justify-center opacity-50 hover:opacity-100"
                    style={{ backgroundColor: c }}
                    title={c}
                  />
                ))}
              </div>
              <div className="grid grid-cols-4 gap-2 px-1 pb-0 place-items-center">
                {COLORS.slice(4, 8).map(c => (
                  <button
                    key={c}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applyTextColor(c)}
                    className="w-7 h-7 rounded-full transition-all cursor-pointer flex items-center justify-center opacity-50 hover:opacity-100"
                    style={{ backgroundColor: c }}
                    title={c}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Portal>
  );
}
