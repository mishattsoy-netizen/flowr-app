"use client";

import { useState, useCallback, useMemo, useRef, useEffect, useLayoutEffect } from 'react';
import { X, Plus, Pencil, MoreVertical, BookOpen, Star, Link, Copy, Trash2, Download, ChevronRight, FileText, FileCode, Image as ImageIcon, FileJson, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Entity, EditorBlock, BlockType, BlockStyle, generateId, useStore } from '@/data/store';
import { SelectionToolbar } from './SelectionToolbar';
import { SlashCommandMenu } from './SlashCommandMenu';
import { BlockRenderer } from './BlockRenderer';
import { BlockOptionsMenu } from './BlockOptionsMenu';
import { flattenRows, nestRows } from './ListBlock';
import { Portal } from '../layout/Portal';
import { Tooltip } from '../layout/Tooltip';
import { useTooltipSuppression } from '../layout/TooltipOverlayContext';
import { Skeleton } from '@/components/ui/Skeleton';
import { OverlayScrollbar } from '@/components/tracker/OverlayScrollbar';
import { mergeAcrossBlocks } from '@/lib/editor/mergeSelection';
import { getBlockSelection, restoreCursor, sliceHtmlByTextOffset, blockOf } from '@/lib/editor/domSelection';

import { monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { extractClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import { looksLikeMarkdown, parseMarkdownToBlocks, blocksToMarkdown } from '@/lib/editor/markdownBlocks';

function arrayMove<T>(array: T[], from: number, to: number): T[] {
  const newArray = array.slice();
  newArray.splice(to < 0 ? newArray.length + to : to, 0, newArray.splice(from, 1)[0]);
  return newArray;
}

interface NoteEditorProps {
  entity: Entity;
  isMixed?: boolean;
  isLoading?: boolean;
}

function createBlock(type: BlockType = 'text', extra?: Record<string, unknown>): EditorBlock {
  return {
    id: generateId(),
    type,
    content: '',
    style: (extra?.style as BlockStyle) ?? (type === 'text' ? 'body' : undefined),
    checked: type === 'checklist' ? false : undefined,
    columnCount: type === 'columns' ? Math.min((extra?.columnCount as number) ?? 2, 4) : undefined,
    children: type === 'columns'
      ? Array.from({ length: Math.min((extra?.columnCount as number) ?? 2, 4) }, () => ({
        id: generateId(),
        type: 'column' as const,
        content: '',
        children: []
      }))
      : (type === 'column' ? [] : undefined),
    tableData: type === 'table' ? [['Header 1', 'Header 2', 'Header 3'], ['', '', ''], ['', '', '']] : undefined,
    mediaUrl: (extra?.mediaUrl as string) || (type === 'image' ? 'https://images.unsplash.com/photo-1544391496-1ca7c97651a2?q=80&w=2000&auto=format&fit=crop' : type === 'video' ? 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' : undefined),
    mediaWidth: (extra?.mediaWidth as any) || 4,
    mediaCaption: (extra?.mediaCaption as string) || '',
    align: 'left',
    linkUrl: type === 'link' ? '' : undefined,
    ...extra,
  };
}

const findBlockById = (list: EditorBlock[], id: string): EditorBlock | undefined => {
  for (const b of list) {
    if (b.id === id) return b;
    if (b.children) {
      const found = findBlockById(b.children, id);
      if (found) return found;
    }
  }
  return undefined;
};

const updateBlockRecursive = (list: EditorBlock[], id: string, updates: Partial<EditorBlock>): EditorBlock[] => {
  return list.map(b => {
    if (b.id === id) return { ...b, ...updates };
    if (b.children) {
      return {
        ...b,
        children: updateBlockRecursive(b.children, id, updates)
      };
    }
    return b;
  });
};

const findAndRemoveBlock = (list: EditorBlock[], id: string): { list: EditorBlock[], removed: EditorBlock | null } => {
  let removed: EditorBlock | null = null;

  const newList = list.flatMap(b => {
    if (b.id === id) {
      removed = b;
      return [];
    }

    if (b.children) {
      const res = findAndRemoveBlock(b.children, id);
      if (res.removed) removed = res.removed;

      if (b.type === 'columns') {
        const nonEmptyCols = res.list.filter(col => col.type === 'column' && (col.children?.length ?? 0) > 0);
        if (nonEmptyCols.length === 0) return [];
        if (nonEmptyCols.length === 1) return nonEmptyCols[0].children || [];
        return [{ ...b, children: res.list }];
      }

      if (b.type === 'column' && res.list.length === 0) {
        return [{ ...b, children: res.list }];
      }

      return [{ ...b, children: res.list }];
    }
    return [b];
  });

  return { list: newList, removed };
};

const moveBlocksRecursive = (
  list: EditorBlock[],
  activeIds: string[],
  overId: string,
  edge: 'top' | 'bottom' | 'left' | 'right'
): EditorBlock[] => {
  let removedBlocks: EditorBlock[] = [];

  const removeBlocks = (blocks: EditorBlock[]): EditorBlock[] => {
    return blocks.flatMap(b => {
      if (activeIds.includes(b.id)) {
        removedBlocks.push(b);
        return [];
      }
      if (b.children) {
        return [{
          ...b,
          children: removeBlocks(b.children)
        }];
      }
      return [b];
    });
  };

  const cleanList = removeBlocks(list);
  if (removedBlocks.length === 0) return list;

  const insertBlocks = (blocks: EditorBlock[]): EditorBlock[] => {
    const idx = blocks.findIndex(b => b.id === overId);
    if (idx !== -1) {
      const newList = [...blocks];
      const targetBlock = newList[idx];

      const isMovingColumns = removedBlocks.some(b => b.type === 'column');
      if (targetBlock.type === 'column' && !isMovingColumns) {
        const targetChildren = targetBlock.children ? [...targetBlock.children] : [];
        targetChildren.push(...removedBlocks);
        newList[idx] = { ...targetBlock, children: targetChildren };
        return newList;
      }

      const insertIdx = (edge === 'bottom' || edge === 'right') ? idx + 1 : idx;
      newList.splice(insertIdx, 0, ...removedBlocks);
      return newList;
    }

    return blocks.map(b => {
      if (b.children && b.children.length > 0) {
        return {
          ...b,
          children: insertBlocks(b.children)
        };
      }
      return b;
    });
  };

  return insertBlocks(cleanList);
};




const getTagColors = (tag: string) => {
  return {
    bg: 'var(--bone-5)',
    text: 'var(--bone-70)',
    border: 'var(--bone-10)'
  };
};

function TagItem({
  tag,
  index,
  isEditing,
  onEdit,
  onDelete,
  onUpdate,
  allTags,
  disabled
}: {
  tag: string;
  index: number;
  isEditing: boolean;
  onEdit: (idx: number) => void;
  onDelete: (tag: string) => void;
  onUpdate: (oldTag: string, newTag: string) => void;
  allTags: string[];
  disabled?: boolean;
}) {
  const [editValue, setEditValue] = useState(tag);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = useMemo(() => {
    if (!editValue) return [];
    return allTags
      .filter(t => t.toLowerCase().includes(editValue.toLowerCase()) && t !== editValue)
      .slice(0, 5);
  }, [editValue, allTags]);

  useEffect(() => {
    if (isEditing) {
      setEditValue(tag);
      requestAnimationFrame(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.setSelectionRange(0, inputRef.current.value.length);
        }
      });
    }
  }, [isEditing, tag]);

  const handleSave = useCallback(() => {
    const value = editValue.trim();
    if (value === "") {
      onDelete(tag);
    } else if (value !== tag) {
      onUpdate(tag, value.toLowerCase());
    }
    onEdit(-1);
    setShowSuggestions(false);
    setSelectedIndex(-1);
  }, [editValue, tag, onDelete, onUpdate, onEdit]);

  const handleBlur = () => {
    // Short delay to allow suggestion selection
    setTimeout(() => {
      if (isEditing) handleSave();
    }, 150);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (selectedIndex >= 0 && suggestions[selectedIndex]) {
        onUpdate(tag, suggestions[selectedIndex]);
        onEdit(-1);
      } else {
        handleSave();
      }
      setShowSuggestions(false);
      setSelectedIndex(-1);
    } else if (e.key === 'Escape') {
      onEdit(-1);
      setShowSuggestions(false);
      setSelectedIndex(-1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : (prev === -1 ? 0 : 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : (prev === -1 ? suggestions.length - 1 : suggestions.length - 1)));
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(tag);
  };

  const colors = getTagColors(tag);

  return (
    <div className="relative flex items-center group">
      <div
        onClick={(!isEditing && !disabled) ? () => onEdit(index) : undefined}
        className={cn(
          "px-2 py-0.5 rounded-full text-[11px] font-medium flex items-center gap-1 transition-all border",
          (!isEditing && !disabled) ? "cursor-pointer hover:brightness-110" : "cursor-default"
        )}
        style={{
          backgroundColor: colors.bg,
          color: colors.text,
          borderColor: colors.border
        }}
      >
        {isEditing ? (
          <div className="relative inline-grid items-center grid-cols-1 min-w-0">
            <span className="invisible col-start-1 row-start-1 px-0 text-[11px] font-medium whitespace-pre">
              {editValue.padEnd(3, ' ')}
            </span>
            <input
              ref={inputRef}
              type="text"
              value={editValue}
              onChange={e => {
                setEditValue(e.target.value);
                setShowSuggestions(true);
                setSelectedIndex(-1);
              }}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              className="bg-transparent outline-none text-[11px] font-medium p-0 m-0 border-none text-inherit col-start-1 row-start-1 w-0 min-w-full"
              style={{ color: 'inherit' }}
            />
          </div>
        ) : (
          <span className="truncate max-w-[120px]">{tag || "new tag"}</span>
        )}
        {!disabled && (
          <button
            onClick={handleDelete}
            aria-label={`Delete tag ${tag}`}
            className="hover:text-danger rounded-full p-0.5 transition-all opacity-60 hover:opacity-100"
          >
            <X strokeWidth={2} className="w-3 h-3" />
          </button>
        )}
      </div>

      {isEditing && showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full left-0 mt-1 z-[300] popup-glass-small min-w-[160px] p-1.5 flex flex-col gap-[3px]">
          {suggestions.map((s, idx) => (
            <button
              key={s}
              onMouseDown={() => {
                onUpdate(tag, s);
                onEdit(-1);
              }}
              className={cn(
                "popup-item border-none w-full text-left px-3 py-1.5 text-xs ",
                selectedIndex === idx ? "bg-accent text-accent-foreground" : "hover:bg-hover"
              )}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const ScrollWrapper = ({ children, isSplit }: { children: React.ReactNode, isSplit: boolean }) => {
  if (isSplit) {
    return (
      <div id="note-editor-container" className="flex-1 note-editor-bg overflow-hidden min-h-0">
        {children}
      </div>
    );
  }
  return (
    <OverlayScrollbar
      thumbOffsetRight={0}
      thumbRightClass="right-0"
      scrollProps={{ id: "note-editor-container" } as any}
      className="flex-1 note-editor-bg min-h-0"
      scrollClassName="flex-1 note-editor-bg"
    >
      {children}
    </OverlayScrollbar>
  );
};

export function NoteEditor({ entity, isMixed = false, isLoading }: NoteEditorProps) {
  const updateEntityContent = useStore(s => s.updateEntityContent);
  const removeTagFromEntity = useStore(s => s.removeTagFromEntity);
  const updateTagInEntity = useStore(s => s.updateTagInEntity);
  const renameEntity = useStore(s => s.renameEntity);
  const setEditingEntityId = useStore(s => s.setEditingEntityId);
  const editingEntity = useStore(s => s.editingEntity);
  const entities = useStore(s => s.entities);
  const setActiveEntityId = useStore(s => s.setActiveEntityId);
  const addEmptyTag = useStore(s => s.addEmptyTag);
  const aiCursor = useStore(s => s.aiCursor);
  const favoriteIds = useStore(s => s.favoriteIds);
  const toggleFavorite = useStore(s => s.toggleFavorite);
  const duplicateEntity = useStore(s => s.duplicateEntity);
  const openModal = useStore(s => s.openModal);
  const splitViewActive = useStore(s => s.splitViewActive);

  const allUniqueTags = useMemo(() => {
    return Array.from(new Set(entities.flatMap(e => e.tags || [])));
  }, [entities]);

  const [blocks, setBlocks] = useState<EditorBlock[]>(() => {
    if (Array.isArray(entity.content) && entity.content.length > 0) return entity.content;
    return [createBlock('text', { style: 'body' })];
  });

  const lastSyncedVersion = useRef<string>(JSON.stringify(Array.isArray(entity.content) ? entity.content : []));
  const lastEntityId = useRef<string>(entity.id);
  const isFirstMount = useRef<boolean>(true);
  const isUserModified = useRef<boolean>(false);
  const blocksRef = useRef<EditorBlock[]>(blocks);

  useEffect(() => {
    blocksRef.current = blocks;
  }, [blocks]);

  // Debounced Store Sync
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const debouncedSyncToStore = useCallback((id: string, content: EditorBlock[]) => {
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(() => {
      updateEntityContent(id, content);
      lastSyncedVersion.current = JSON.stringify(content || []);
      isUserModified.current = false; // Reset after sync
    }, 1000); // 1s debounce for store persistence
  }, [updateEntityContent]);

  useEffect(() => {
    // 1. Entity Switch Protection
    if (entity.id !== lastEntityId.current) {
      // Flush any pending debounced save for the previous entity before switching
      if (isUserModified.current) {
        if (syncTimeoutRef.current) {
          clearTimeout(syncTimeoutRef.current);
          syncTimeoutRef.current = null;
        }
        updateEntityContent(lastEntityId.current, blocksRef.current);
      }

      const newContent = Array.isArray(entity.content) && entity.content.length > 0
        ? entity.content
        : [createBlock('text', { style: 'body' })];
      setBlocks(newContent);
      lastSyncedVersion.current = JSON.stringify(Array.isArray(entity.content) ? entity.content : []);
      lastEntityId.current = entity.id;
      isFirstMount.current = true;
      isUserModified.current = false;
      return;
    }

    const isAiWritingThis = aiCursor?.id === entity.id;
    const storeJson = JSON.stringify(Array.isArray(entity.content) ? entity.content : []);

    // CASE A: External update (AI or another tab/component)
    if (storeJson !== lastSyncedVersion.current) {
      const localJson = JSON.stringify(blocks);
      if (storeJson !== localJson) {
        setBlocks(Array.isArray(entity.content) ? entity.content : []);
      }
      lastSyncedVersion.current = storeJson;
      isFirstMount.current = false;
    }
    // CASE B: Local user update
    else if (isUserModified.current && !isAiWritingThis) {
      const localJson = JSON.stringify(blocks);
      if (localJson !== lastSyncedVersion.current) {
        debouncedSyncToStore(entity.id, blocks);
      }
    } else {
      isFirstMount.current = false;
    }
  }, [entity.id, entity.content, blocks, debouncedSyncToStore, aiCursor, updateEntityContent]);

  // Flush sync on unmount or entity change
  useEffect(() => {
    return () => {
      if (isUserModified.current) {
        if (syncTimeoutRef.current) {
          clearTimeout(syncTimeoutRef.current);
        }
        updateEntityContent(lastEntityId.current, blocksRef.current);
      }
    };
  }, [updateEntityContent]); // Only depend on store action

  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);

  const [slashMenu, setSlashMenu] = useState<{ blockId: string; position: { x: number; y: number } } | null>(null);
  const [activeOptionsMenu, setActiveOptionsMenu] = useState<{ blockId: string; position: { x: number; y: number } } | null>(null);
  const [deletingIds, setDeletingIds] = useState<string[]>([]);


  const [selectedBlockIds, setSelectedBlockIds] = useState<Set<string>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsDragging(false);
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  // Suppress tooltips when a popup menu is open or a block drag is in progress
  useTooltipSuppression(Boolean(activeOptionsMenu || slashMenu || isDragging));
  const [activeId, setActiveId] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const blocksHostRef = useRef<HTMLDivElement>(null);
  const pendingCursor = useRef<{ blockId: string; offset: number } | null>(null);
  const typingHistoryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isReadMode = useStore(s => !!s.readModeStates[entity.id]);
  const setReadMode = useStore(s => s.setReadMode);
  const [optionsMenuPos, setOptionsMenuPos] = useState<{ x: number, y: number } | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null!);
  const [editingTagIndex, setEditingTagIndex] = useState<number | null>(null);

  const isEditingTitle = !isReadMode && editingEntity?.id === entity.id && editingEntity.source === 'view';

  useLayoutEffect(() => {
    if (isEditingTitle && titleRef.current) {
      titleRef.current.focus();
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(titleRef.current);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }, [isEditingTitle]);

  const [history, setHistory] = useState<EditorBlock[][]>(() => [blocks]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const persistBlocks = useCallback((newBlocks: EditorBlock[], skipHistory = false) => {
    // Any persist means a definite state is committed right now, so a
    // still-pending coalesced-typing flush is obsolete. Harmless/redundant
    // on its own (its target ref is live, not stale), but clearing it here
    // is correct in spirit — a completed persist supersedes a pending one.
    if (typingHistoryTimer.current) {
      clearTimeout(typingHistoryTimer.current);
      typingHistoryTimer.current = null;
    }

    // 1. Structural Sanity check: Ensure columns sections only contain column blocks
    const sanitizeRecursive = (list: EditorBlock[]): EditorBlock[] => {
      return list.map(b => {
        const updatedB = { ...b };
        if (b.type === 'columns' && b.children) {
          updatedB.children = b.children.slice(0, 4).map(child => {
            if (child.type !== 'column') {
              return { id: generateId(), type: 'column' as const, content: '', children: [child] };
            }
            return child;
          });
          updatedB.columnCount = updatedB.children.length;
        }
        if (updatedB.children) {
          updatedB.children = sanitizeRecursive(updatedB.children);
        }
        return updatedB;
      });
    };

    const sanitized = sanitizeRecursive(newBlocks);
    setBlocks(sanitized);
    isUserModified.current = true; // User interaction recorded
    updateEntityContent(entity.id, sanitized);

    // ROOT CAUSE of markdown-shortcut conversions (`- `, `# `, `--- `, etc.)
    // silently reverting ~1s after conversion with zero further user
    // interaction: plain typing (handleHostInput -> updateBlock) only calls
    // setBlocks, so it never reaches here — it instead flows through the
    // entity-sync useEffect's "CASE B: Local user update" branch, which
    // schedules debouncedSyncToStore(entity.id, blocks) with `blocks`
    // captured BY VALUE in that setTimeout's closure. If persistBlocks
    // (here) then commits a DIFFERENT value (the conversion) before that
    // 1000ms elapses, the orphaned timer still fires afterward and
    // overwrites the store with its stale pre-conversion snapshot — this
    // function's own synchronous updateEntityContent call above gets
    // silently undone. Clearing the pending timer, and marking this
    // persist as already synced, closes the race.
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = null;
    }
    isUserModified.current = false;
    lastSyncedVersion.current = JSON.stringify(sanitized);

    if (!skipHistory) {
      setHistory(prev => {
        const newHistory = prev.slice(0, historyIndex + 1);
        newHistory.push(sanitized);
        if (newHistory.length > 50) newHistory.shift();
        setHistoryIndex(newHistory.length - 1);
        return newHistory;
      });
    }
  }, [entity.id, updateEntityContent, historyIndex]);

  // A native Selection can span blocks now that they share one editing host.
  // Let the browser handle everything inside a single block; intercept only
  // DESTRUCTIVE edits that span two or more blocks, so the store cannot fall
  // out of sync with a DOM the browser rewrote across several blocks at once.
  //
  // MUST be a native `addEventListener('beforeinput', ...)`, not React's
  // `onBeforeInput` prop. Measured: React's onBeforeInput is a legacy
  // polyfilled synthetic event (predates the native Input Events API) —
  // native.inputType came through as undefined for typing, and the handler
  // never fired at all for deleteContentBackward/Forward. A raw capture-phase
  // listener on the same host received the real native `beforeinput` with the
  // correct inputType every time. Without this, the entire cross-block merge
  // path (type-over, Backspace, Cut, Paste) silently never ran in the browser.
  const handleHostBeforeInput = useCallback((native: InputEvent) => {
    if (isReadMode) return;
    const host = blocksHostRef.current;
    if (!host) return;

    const DESTRUCTIVE = new Set([
      'insertText',
      'insertParagraph',
      'insertLineBreak',
      'insertFromPaste',
      'deleteContentBackward',
      'deleteContentForward',
      'deleteByCut',
      'deleteByDrag',
    ]);
    if (!DESTRUCTIVE.has(native.inputType)) return;

    const selection = getBlockSelection(host);
    if (!selection) {
      // Collapsed caret / single block. Everything is native EXCEPT
      // insertParagraph: every legitimate Enter is already handled (and
      // preventDefaulted) in handleHostKeyDown, so one reaching here means
      // the caret was somewhere we couldn't resolve (chrome, gap). Letting
      // the browser split host children creates unmanaged divs React
      // doesn't know about — swallow it instead.
      if (native.inputType === 'insertParagraph') native.preventDefault();
      return;
    }

    native.preventDefault();

    const insert =
      native.inputType === 'insertText' ? (native.data ?? '')
      : native.inputType === 'insertFromPaste'
        ? (native.dataTransfer?.getData('text/plain') ?? '')
      : '';

    // Slice the surviving head/tail as HTML, so bold/links in text the user
    // never selected are preserved. Doing this here (not in mergeSelection)
    // keeps the merge function DOM-free and therefore unit-testable.
    const aIdx = blocks.findIndex(b => b.id === selection.startBlockId);
    const bIdx = blocks.findIndex(b => b.id === selection.endBlockId);
    if (aIdx === -1 || bIdx === -1) return;

    const forward = aIdx < bIdx;
    const first = blocks[forward ? aIdx : bIdx];
    const last = blocks[forward ? bIdx : aIdx];
    const headOffset = forward ? selection.startOffset : selection.endOffset;
    const tailOffset = forward ? selection.endOffset : selection.startOffset;

    const surviving = {
      headHtml: sliceHtmlByTextOffset(first.content, 0, headOffset),
      tailHtml: sliceHtmlByTextOffset(last.content, tailOffset, Number.MAX_SAFE_INTEGER),
    };

    const result = mergeAcrossBlocks(blocks, selection, insert, surviving);
    if (result.blocks === blocks) return;   // guard said no change

    pendingCursor.current = { blockId: result.cursorBlockId, offset: result.cursorOffset };
    persistBlocks(result.blocks);
  }, [blocks, isReadMode, persistBlocks]);

  useEffect(() => {
    const host = blocksHostRef.current;
    if (!host) return;
    host.addEventListener('beforeinput', handleHostBeforeInput);
    return () => host.removeEventListener('beforeinput', handleHostBeforeInput);
  }, [handleHostBeforeInput]);

  // Put the caret at the seam after React has re-rendered the merged blocks.
  //
  // Deliberately useEffect, NOT useLayoutEffect. Measured: this fired BEFORE
  // BlockRenderer's own content-sync effect (which imperatively writes
  // contentRef.current.innerHTML = block.content, since the content div has
  // no React children). React runs child effects before parent effects
  // within a commit, and useLayoutEffect always runs before useEffect — so a
  // parent useLayoutEffect here walked the STALE pre-merge DOM, set a caret
  // into a text node that was about to be destroyed, and the caret collapsed
  // to 0 when the child's useEffect replaced it moments later. useEffect
  // here (still before paint completes for the child's useEffect, since both
  // are useEffect and ordered child-first) fixes the ordering.
  useEffect(() => {
    const target = pendingCursor.current;
    const host = blocksHostRef.current;
    if (!target || !host) return;
    pendingCursor.current = null;
    restoreCursor(host, target.blockId, target.offset);
  }, [blocks]);

  // Keep activeBlockId synced to the real caret. Under the single editing
  // host, per-block onFocus/onBlur never fire (document.activeElement is
  // always the host), so caret position is the only truthful focus signal.
  useEffect(() => {
    const onSelectionChange = () => {
      const host = blocksHostRef.current;
      if (!host) return;
      const sel = window.getSelection();
      const anchorNode = sel?.anchorNode ?? null;
      const anchorEl = anchorNode
        ? (anchorNode.nodeType === Node.TEXT_NODE ? anchorNode.parentElement : anchorNode as HTMLElement)
        : null;
      const blockEl = anchorEl?.closest?.('[data-block-id]') as HTMLElement | null;
      const id = blockEl && host.contains(blockEl) ? (blockEl.dataset.blockId ?? null) : null;
      setActiveBlockId(prev => (prev === id ? prev : id));
    };
    document.addEventListener('selectionchange', onSelectionChange);
    return () => document.removeEventListener('selectionchange', onSelectionChange);
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Only handle if clicking on the container background or an empty space
    const target = e.target as HTMLElement;
    const isEditorBg = target === editorRef.current || target.classList.contains('note-editor-bg');

    if (isEditorBg) {
      // Clear selection unless Shift is held
      if (!e.shiftKey) {
        setSelectedBlockIds(new Set());
      }

      // Close popups when clicking on empty space
      setActiveOptionsMenu(null);
      setSlashMenu(null);
    }
  }, []);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    // Only trigger if clicking on the background container or empty space
    const target = e.target as HTMLElement;
    const isEditorBg = target.closest('.note-editor-bg') && !target.closest('[data-block-id]');

    if (isEditorBg) {
      const newBlock = createBlock('text', { style: 'body' });
      const newBlocks = [...blocks, newBlock];
      persistBlocks(newBlocks);

      // Auto-focus the new block
      setTimeout(() => {
        const newEl = document.querySelector(`[data-block-id="${newBlock.id}"] [data-block-content]`) as HTMLElement;
        if (newEl) {
          blocksHostRef.current?.focus();
          // Place cursor at the end
          const range = document.createRange();
          const sel = window.getSelection();
          range.selectNodeContents(newEl);
          range.collapse(false);
          sel?.removeAllRanges();
          sel?.addRange(range);
        }
      }, 50);
    }
  }, [blocks, persistBlocks]);

  // Ref, not the state value directly: this effect's listener is registered
  // once (mount-only deps) so a captured `slashMenu` would be a stale
  // closure frozen at its initial `null` — the listener must read the
  // CURRENT value every time it fires, not the value from when it mounted.
  const slashMenuRef = useRef(slashMenu);
  useEffect(() => {
    slashMenuRef.current = slashMenu;
  }, [slashMenu]);

  useEffect(() => {
    const handleDocumentMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // Determine if we clicked inside a block container
      const clickedBlockEl = target.closest<HTMLElement>('[data-block-id]');
      const clickedInsideBlock = !!clickedBlockEl;

      // Determine if we clicked inside an active popup menu (like block options, slash command, or toolbar)
      const clickedInsidePopup = !!target.closest('.popup-glass-small') || !!target.closest('.popup-glass');

      // If clicking entirely outside any block and any popup menu (e.g. empty space), reset state
      if (!clickedInsideBlock && !clickedInsidePopup) {
        setSelectedBlockIds(new Set());
        setActiveOptionsMenu(null);
        setSlashMenu(null);
        return;
      }

      // Clicking a DIFFERENT block than the one the slash menu is anchored
      // to must also close it — "inside a block" alone isn't "outside the
      // menu": every ordinary block click passes clickedInsideBlock, so the
      // menu never closed on any block-to-block click before this check.
      const currentSlashMenu = slashMenuRef.current;
      if (!clickedInsidePopup && currentSlashMenu && clickedBlockEl?.dataset.blockId !== currentSlashMenu.blockId) {
        setSlashMenu(null);
      }
    };
    document.addEventListener('mousedown', handleDocumentMouseDown);
    return () => document.removeEventListener('mousedown', handleDocumentMouseDown);
  }, []);

  const selectedBlockIdsRef = useRef(selectedBlockIds);
  useEffect(() => {
    selectedBlockIdsRef.current = selectedBlockIds;
  }, [selectedBlockIds]);

  useEffect(() => {
    return monitorForElements({
      canMonitor: ({ source }) => source.data.type === 'note-block',
      onDragStart: ({ source }) => {
        const id = source.data.blockId as string;
        setSelectedBlockIds(prev => {
          if (!prev.has(id)) {
            return new Set([id]);
          }
          return prev;
        });
        setActiveBlockId(id);
        setIsDragging(true);
        setActiveOptionsMenu(null);
        setSlashMenu(null);
        setEditingTagIndex(null);
        window.getSelection()?.removeAllRanges();
      },
      onDrop: ({ source, location }) => {
        setIsDragging(false);
        setActiveId(null);
        const target = location.current.dropTargets[0];
        if (!target) return;

        const activeId_val = source.data.blockId as string;
        const overId = target.data.blockId as string;
        if (!activeId_val || !overId || activeId_val === overId) return;

        const edge = extractClosestEdge(target.data);

        setBlocks(prev => {
          const movingIds = selectedBlockIdsRef.current.has(activeId_val)
            ? Array.from(selectedBlockIdsRef.current)
            : [activeId_val];

          const newBlocks = moveBlocksRecursive(prev, movingIds, overId, edge as any);
          setTimeout(() => persistBlocks(newBlocks, true), 0);
          return newBlocks;
        });
      }
    });
  }, [persistBlocks]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const prevBlocks = history[historyIndex - 1];
      setHistoryIndex(historyIndex - 1);
      setBlocks(prevBlocks);
      updateEntityContent(entity.id, prevBlocks);
    }
  }, [history, historyIndex, entity.id, updateEntityContent]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextBlocks = history[historyIndex + 1];
      setHistoryIndex(historyIndex + 1);
      setBlocks(nextBlocks);
      updateEntityContent(entity.id, nextBlocks);
    }
  }, [history, historyIndex, entity.id, updateEntityContent]);

  const updateBlock = useCallback((id: string, updates: Partial<EditorBlock>) => {
    isUserModified.current = true;
    const next = updateBlockRecursive(blocksRef.current, id, updates);
    blocksRef.current = next;
    setBlocks(next);
  }, []);

  // Same as updateBlock but recorded in undo history. Use for STRUCTURAL
  // one-shot edits (row insert/remove/indent, markdown conversions).
  // Per-keystroke typing must keep using updateBlock — its history entry is
  // coalesced separately by the typing timer in handleHostInput.
  const persistBlockUpdate = useCallback((id: string, updates: Partial<EditorBlock>) => {
    persistBlocks(updateBlockRecursive(blocksRef.current, id, updates));
  }, [persistBlocks]);

  // Single-block edits: the browser applies its own default DOM edit (we did
  // NOT preventDefault for these in handleHostBeforeInput), so by the time
  // "input" fires the block's own contentEditable div already has the new
  // text. With the container as the single editing host, native "input"
  // targets the HOST, not the block div — BlockRenderer's own onInput never
  // fires — so persistence must happen here, or typed text is silently lost
  // on the next unrelated re-render.
  //
  // Cross-block edits are already fully handled (preventDefault + persist) in
  // handleHostBeforeInput, so this only needs to act when getBlockSelection
  // returns null (a single-block/collapsed selection).
  const handleHostInput = useCallback((e: React.FormEvent<HTMLDivElement>) => {
    if (isReadMode) return;
    const host = blocksHostRef.current;
    if (!host) return;

    const selection = getBlockSelection(host);
    if (selection) return;   // cross-block edit — handleHostBeforeInput already persisted it
    // NOTE: a selection spanning two rows of the SAME list also returns null
    // here, because both endpoints climb to the same [data-block-id] (the list
    // wrapper) in blockOf/getBlockSelection. Cross-row destructive edits are
    // therefore not intercepted by the merge path — consistent with nested
    // children being out of scope for Phase 1 (see mergeSelection.ts).

    const sel = window.getSelection();
    const anchorNode = sel?.anchorNode ?? null;
    const anchorEl = anchorNode?.nodeType === Node.TEXT_NODE ? anchorNode.parentElement : (anchorNode as HTMLElement | null);
    if (!anchorEl) return;

    // A list row is nested inside its list block's [data-block-id] wrapper —
    // check for the more specific target first, or typing in row 2 could
    // resolve to the list's own (wrong) block id.
    const rowEl = anchorEl.closest<HTMLElement>('[data-row-id]');
    let edited = false;
    if (rowEl && host.contains(rowEl)) {
      const rowId = rowEl.dataset.rowId;
      if (rowId) {
        updateBlock(rowId, { content: rowEl.innerHTML });
        edited = true;
      }
    } else {
      const blockEl = blockOf(anchorNode);
      if (blockEl && host.contains(blockEl)) {
        const blockId = blockEl.dataset.blockId;
        const contentEl = blockId ? blockEl.querySelector<HTMLElement>('[data-block-content]') : null;
        if (blockId && contentEl) {
          updateBlock(blockId, { content: contentEl.innerHTML });
          edited = true;
        }
      }
    }

    // Coalesced undo history: one entry per pause in typing, not per
    // keystroke, for BOTH rows and blocks. persistBlocks(blocksRef.current)
    // pushes the post-burst state; history[historyIndex] still holds the
    // pre-burst state at that moment because updateBlock (above) never
    // touches `history` — so the existing history/historyIndex mechanism
    // produces the correct undo step with no extra snapshot bookkeeping.
    if (edited) {
      if (typingHistoryTimer.current) clearTimeout(typingHistoryTimer.current);
      typingHistoryTimer.current = setTimeout(() => {
        persistBlocks(blocksRef.current);
      }, 600);
    }
  }, [isReadMode, updateBlock, persistBlocks]);

  const deleteBlock = useCallback((id: string) => {
    isUserModified.current = true;
    setDeletingIds(prev => [...prev, id]);
    setTimeout(() => {
      setBlocks(prev => {
        if (prev.length <= 1 && prev.some(b => b.id === id)) return prev;

        const { list: newList, removed } = findAndRemoveBlock([...prev], id);
        if (removed) {
          setTimeout(() => updateEntityContent(entity.id, newList), 0);
          return newList;
        }
        return prev;
      });
      setDeletingIds(prev => prev.filter(x => x !== id));
    }, 280);
  }, [entity.id, updateEntityContent]);

  const insertAfter = useCallback((afterId: string, forceType?: BlockType, openSlash: boolean = false, inside: boolean = false) => {
    const newBlock = createBlock(forceType || 'text');

    const insertRecursive = (list: EditorBlock[]): { newList: EditorBlock[], found: boolean } => {
      const idx = list.findIndex(b => b.id === afterId);
      if (idx !== -1) {
        const newList = [...list];
        const target = newList[idx];

        if (inside && target.children) {
          return {
            newList: list.map(b => b.id === afterId ? { ...b, children: [newBlock, ...(b.children || [])] } : b),
            found: true
          };
        }

        newList.splice(idx + 1, 0, newBlock);
        return { newList, found: true };
      }

      let foundInChild = false;
      const newList = list.map(b => {
        if (b.children) {
          const res = insertRecursive(b.children);
          if (res.found) foundInChild = true;
          return { ...b, children: res.newList };
        }
        return b;
      });

      return { newList, found: foundInChild };
    };

    const { newList, found } = insertRecursive([...blocks]);
    if (found) {
      persistBlocks(newList);
        setTimeout(() => {
          const el = document.querySelector(`[data-block-id="${newBlock.id}"] [data-block-content]`) as HTMLElement;
          if (el) {
            el.focus();
          const range = document.createRange();
          const sel = window.getSelection();
          range.selectNodeContents(el);
          range.collapse(false);
          sel?.removeAllRanges();
          sel?.addRange(range);
          if (openSlash) {
            const rect = el.getBoundingClientRect();
            setSlashMenu({ blockId: newBlock.id, position: { x: rect.left, y: rect.bottom + 4 } });
          }
        }
      }, 50);
    }
  }, [blocks, persistBlocks]);

  const handleSlash = useCallback((blockId: string, rect: DOMRect) => {
    setSlashMenu({
      blockId,
      position: { x: rect.left, y: rect.bottom + 4 },
    });
  }, []);

  const indentBlock = useCallback((id: string) => {
    setBlocks(prev => {
      const findAndIndent = (list: EditorBlock[]): { newList: EditorBlock[], found: boolean } => {
        const idx = list.findIndex(b => b.id === id);
        if (idx > 0) {
          const newList = [...list];
          const target = { ...newList[idx] };
          const prevSibling = { ...newList[idx - 1] };
          if (prevSibling.type !== 'divider' && prevSibling.type !== 'columns') {
            newList.splice(idx, 1);
            prevSibling.children = [...(prevSibling.children || []), target];
            newList[idx - 1] = prevSibling;
            return { newList, found: true };
          }
        }
        let found = false;
        const newList = list.map(b => {
          if (!found && b.children) {
            const res = findAndIndent(b.children);
            if (res.found) {
              found = true;
              return { ...b, children: res.newList };
            }
          }
          return b;
        });
        return { newList, found };
      };
      const { newList, found } = findAndIndent(prev);
      if (found) {
        setTimeout(() => updateEntityContent(entity.id, newList), 0);
        return newList;
      }
      return prev;
    });
  }, [entity.id, updateEntityContent]);

  const unindentBlock = useCallback((id: string) => {
    setBlocks(prev => {
      let found = false;
      const process = (list: EditorBlock[]): EditorBlock[] => {
        const localList: EditorBlock[] = [];
        for (let i = 0; i < list.length; i++) {
          const b = list[i];
          if (b.children) {
            const childIdx = b.children.findIndex(c => c.id === id);
            if (childIdx !== -1) {
              const child = b.children[childIdx];
              const newChildren = [...b.children];
              newChildren.splice(childIdx, 1);
              localList.push({ ...b, children: newChildren });
              localList.push(child);
              found = true;
              continue;
            }
            localList.push({ ...b, children: process(b.children) });
          } else {
            localList.push(b);
          }
        }
        return localList;
      };
      const newList = process(prev);
      if (found) {
        setTimeout(() => updateEntityContent(entity.id, newList), 0);
        return newList;
      }
      return prev;
    });
  }, [entity.id, updateEntityContent]);

  const focusAtEnd = (el: HTMLElement) => {
    // Every call site reaches `el` through a setTimeout (10ms after a
    // structural blocks/rows update), so a fast follow-up keystroke can
    // remove that exact node from the DOM before this fires. Building a
    // Range against a detached node throws; isConnected is a cheap guard
    // against that race rather than a fix for a specific reproduced crash.
    if (!el.isConnected) return;
    el.focus();
    const range = document.createRange();
    const sel = window.getSelection();
    range.selectNodeContents(el);
    range.collapse(false);
    sel?.removeAllRanges();
    sel?.addRange(range);
  };

  // PROOF-OF-CONCEPT SCAFFOLD for relocating per-block keydown handling to the
  // single editing host. Same root cause as handleHostBeforeInput/handleHostInput:
  // once the container is the sole contentEditable host, per-block onKeyDown
  // never fires (keydown targets document.activeElement, which is the host).
  // This wires ONLY "/" opening the slash menu, as a proven pattern — the rest
  // of BlockRenderer's and ListBlock's keydown logic (markdown shortcuts, Enter,
  // Tab, Backspace) still needs the same relocation and is NOT done here.
  const handleHostKeyDown = useCallback((e: KeyboardEvent) => {
    if (isReadMode) return;
    const host = blocksHostRef.current;
    if (!host) return;

    // Undo/redo MUST be checked before any block/row resolution below — it
    // has to work even when the caret isn't in a resolvable position.
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (typingHistoryTimer.current) { clearTimeout(typingHistoryTimer.current); typingHistoryTimer.current = null; }
      if (e.shiftKey) redo(); else undo();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      if (typingHistoryTimer.current) { clearTimeout(typingHistoryTimer.current); typingHistoryTimer.current = null; }
      redo();
      return;
    }

    // Ctrl+Enter: insert a new plain text block immediately after the
    // CURRENT TOP-LEVEL BLOCK, regardless of what's focused inside it — a
    // list row, a table cell, plain paragraph text, anything. This is the
    // escape hatch for "I'm inside a list and want a normal block below
    // it" without needing to empty a row first (previously the only way to
    // exit a list). Checked here, before the row-vs-block resolution split
    // below, because the answer is the same either way: resolve to the
    // nearest [data-block-id] ancestor. For a list row that's the list's
    // own wrapper (rows live nested inside it) — exactly the "parent
    // block" id insertAfter needs.
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      const selCE = window.getSelection();
      const anchorNodeCE = selCE?.anchorNode ?? null;
      const anchorElCE = anchorNodeCE?.nodeType === Node.TEXT_NODE ? anchorNodeCE.parentElement : (anchorNodeCE as HTMLElement | null);
      const targetBlockEl = anchorElCE?.closest<HTMLElement>('[data-block-id]');
      const targetBlockId = targetBlockEl?.dataset.blockId;
      if (targetBlockId && host.contains(targetBlockEl!)) {
        insertAfter(targetBlockId, 'text');
      }
      return;
    }

    const sel = window.getSelection();
    const anchorNode = sel?.anchorNode ?? null;
    const anchorEl = anchorNode?.nodeType === Node.TEXT_NODE ? anchorNode.parentElement : (anchorNode as HTMLElement | null);
    if (!anchorEl) return;

    // ROW LEVEL (Task 4)
    //
    // CRITICAL: this whole block MUST unconditionally `return` at the end
    // (see the `return;` right before the block-level section below), even
    // when no inner key branch matched. Without it, a keystroke inside a
    // list row that isn't handled here falls through into the block-level
    // logic, where `anchorEl.closest('[data-block-id]')` resolves to the
    // ROW'S PARENT LIST BLOCK (rows are nested inside the list's
    // [data-block-id] wrapper) — not a plain text block. Confirmed bug:
    // without the return, Backspace on a row fell through to the
    // block-level "delete empty block" logic, which found no
    // [data-block-content] inside the list wrapper (that marker only
    // exists on plain text blocks), read that as empty text, and deleted
    // the ENTIRE LIST BLOCK on an ordinary same-row text-clearing
    // Backspace. Verified via headless probe against the real app.
    const rowEl = anchorEl.closest<HTMLElement>('[data-row-id]');
    if (rowEl && host.contains(rowEl)) {
      const rowId = rowEl.dataset.rowId;
      const parentBlockEl = rowEl.closest<HTMLElement>('[data-block-id]');
      const parentBlockId = parentBlockEl?.dataset.blockId;
      if (rowId && parentBlockId) {
        const parentBlock = blocks.find(b => b.id === parentBlockId);
        if (parentBlock) {
          const isListLike = ['bulletList', 'numberedList', 'dashedList', 'checklist'].includes(parentBlock.type);
          if (isListLike) {
            const rows = flattenRows(parentBlock);
            const rowIndex = rows.findIndex(r => r.id === rowId);
            if (rowIndex !== -1) {
              const row = rows[rowIndex];

              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const contentEl = rowEl;
                const contentText = contentEl.textContent ?? '';

                if (!contentText.trim()) {
                  if (row.depth > 0) {
                    const newRows = [...rows];
                    newRows[rowIndex] = { ...row, depth: row.depth - 1 };
                    const nested = nestRows(newRows, parentBlock.type);
                    persistBlockUpdate(parentBlockId, { content: nested.content, children: nested.children });
                  } else if (rowIndex === rows.length - 1) {
                    const newRows = rows.slice(0, rowIndex);
                    if (newRows.length === 0) {
                      insertAfter(parentBlockId, 'text');
                      setBlocks(prev => {
                        const { list } = findAndRemoveBlock(prev, parentBlockId);
                        setTimeout(() => updateEntityContent(entity.id, list), 0);
                        return list;
                      });
                    } else {
                      const nested = nestRows(newRows, parentBlock.type);
                      persistBlockUpdate(parentBlockId, { content: nested.content, children: nested.children });
                      insertAfter(parentBlockId, 'text');
                    }
                  } else {
                    insertAfter(parentBlockId, 'text');
                  }
                  return;
                }

                const newRow = {
                  id: generateId(),
                  content: '',
                  checked: parentBlock.type === 'checklist' ? false : undefined,
                  depth: row.depth,
                };
                const newRows = [...rows.slice(0, rowIndex + 1), newRow, ...rows.slice(rowIndex + 1)];
                const nested = nestRows(newRows, parentBlock.type);
                persistBlockUpdate(parentBlockId, { content: nested.content, children: nested.children });
                
                setTimeout(() => {
                  // Row divs are passive (no contentEditable of their own —
                  // the host is the only editing surface), so a plain
                  // .focus() is a no-op and never actually moves the caret.
                  // The caret must be placed with an explicit Range, like
                  // every other row-to-row jump in this file (focusAtEnd).
                  // Without this, Enter on a row silently leaves the caret
                  // on the OLD row, and the very next keystroke — including
                  // simply continuing to type — lands there instead of in
                  // the new (apparently empty, actually just unfocused) row.
                  const newEl = host.querySelector<HTMLElement>(`[data-row-id="${newRow.id}"]`);
                  if (newEl) focusAtEnd(newEl);
                }, 10);
                return;
              }

              if (e.key === 'Tab') {
                e.preventDefault();
                if (e.shiftKey) {
                  if (row.depth === 0) return;
                  const newRows = [...rows];
                  newRows[rowIndex] = { ...row, depth: row.depth - 1 };
                  const nested = nestRows(newRows, parentBlock.type);
                  persistBlockUpdate(parentBlockId, { content: nested.content, children: nested.children });
                } else {
                  if (rowIndex === 0) return;
                  const maxDepth = rows[rowIndex - 1].depth + 1;
                  const newRows = [...rows];
                  newRows[rowIndex] = { ...row, depth: Math.min(row.depth + 1, maxDepth) };
                  const nested = nestRows(newRows, parentBlock.type);
                  persistBlockUpdate(parentBlockId, { content: nested.content, children: nested.children });
                }
                return;
              }

              if (e.key === 'Backspace') {
                const contentEl = rowEl;
                const text = contentEl.textContent ?? '';
                if (!text.trim()) {
                  e.preventDefault();
                  if (row.depth > 0) {
                    const newRows = [...rows];
                    newRows[rowIndex] = { ...row, depth: row.depth - 1 };
                    const nested = nestRows(newRows, parentBlock.type);
                    persistBlockUpdate(parentBlockId, { content: nested.content, children: nested.children });
                  } else if (rowIndex === 0 && rows.length === 1) {
                    insertAfter(parentBlockId, 'text');
                    setBlocks(prev => {
                      const { list } = findAndRemoveBlock(prev, parentBlockId);
                      setTimeout(() => updateEntityContent(entity.id, list), 0);
                      return list;
                    });
                  } else if (rowIndex === 0) {
                    const newRows = rows.slice(1);
                    const nested = nestRows(newRows, parentBlock.type);
                    persistBlockUpdate(parentBlockId, { content: nested.content, children: nested.children });
                  } else {
                    const prevId = rows[rowIndex - 1].id;
                    const newRows = [...rows.slice(0, rowIndex), ...rows.slice(rowIndex + 1)];
                    const nested = nestRows(newRows, parentBlock.type);
                    persistBlockUpdate(parentBlockId, { content: nested.content, children: nested.children });
                    setTimeout(() => {
                      const prevEl = host.querySelector<HTMLElement>(`[data-row-id="${prevId}"]`);
                      if (prevEl) focusAtEnd(prevEl);
                    }, 10);
                  }
                  return;
                }

                const sel2 = window.getSelection();
                if (sel2?.rangeCount && sel2.getRangeAt(0).collapsed) {
                  const range = sel2.getRangeAt(0);
                  const testRange = document.createRange();
                  testRange.selectNodeContents(contentEl!);
                  testRange.setEnd(range.startContainer, range.startOffset);
                  if (testRange.toString().length === 0) {
                    e.preventDefault();
                    if (row.depth > 0) {
                      const newRows = [...rows];
                      newRows[rowIndex] = { ...row, depth: row.depth - 1 };
                      const nested = nestRows(newRows, parentBlock.type);
                      persistBlockUpdate(parentBlockId, { content: nested.content, children: nested.children });
                    } else if (rowIndex > 0) {
                      const prevRow = rows[rowIndex - 1];
                      const prevContent = prevRow.content || '';
                      const curContent = row.content || '';
                      const newContent = prevContent + curContent;
                      const mergedRows = [...rows.slice(0, rowIndex - 1), { ...prevRow, content: newContent }, ...rows.slice(rowIndex + 1)];
                      const nested = nestRows(mergedRows, parentBlock.type);
                      persistBlockUpdate(parentBlockId, { content: nested.content, children: nested.children });
                      setTimeout(() => {
                        const prevEl = host.querySelector<HTMLElement>(`[data-row-id="${prevRow.id}"]`);
                        if (prevEl) focusAtEnd(prevEl);
                      }, 10);
                    }
                    return;
                  }
                }
              }
            }
          }
          return; // parentBlock resolved but was not list-like — still a row, never fall through
        }
      }
      return; // rowId/parentBlockId resolved but no match above — never fall through to block logic
    }

    const blockEl = anchorEl.closest<HTMLElement>('[data-block-id]');
    if (!blockEl || !host.contains(blockEl)) return;
    const blockId = blockEl.dataset.blockId;
    if (!blockId) return;

    if (e.key === '/') {
      const contentEl = blockEl.querySelector<HTMLElement>('[data-block-content]');
      const text = contentEl?.textContent ?? '';
      // Matches the ORIGINAL per-block check (BlockRenderer.tsx, now removed):
      // only opens when the block is empty or already just "/" (avoids
      // re-triggering on every slash typed inside existing text).
      if (text === '' || text === '/') {
        setTimeout(() => {
          const rect = contentEl?.getBoundingClientRect();
          if (rect) handleSlash(blockId, rect);
        }, 10);
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      const block = blocks.find(b => b.id === blockId);
      if (!block) return;
      const isListLike = ['bulletList', 'numberedList', 'dashedList', 'checklist'].includes(block.type);
      if (isListLike) return; // handled by the row-level Enter logic (Task 4)

      e.preventDefault();
      insertAfter(blockId, 'text');
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) unindentBlock(blockId);
      else indentBlock(blockId);
      return;
    }

    if (e.key === 'Backspace') {
      const contentEl = blockEl.querySelector<HTMLElement>('[data-block-content]');
      const text = contentEl?.textContent ?? '';
      if (!text.trim()) {
        e.preventDefault();
        
        const prevBlockEl = blockEl.previousElementSibling as HTMLElement | null;
        const targetFocusId = prevBlockEl?.dataset?.blockId;

        setBlocks(prev => {
          // If it's the very first block, don't delete it
          if (prev.length > 0 && prev[0].id === blockId) {
             return prev;
          }
          const { list, removed } = findAndRemoveBlock(prev, blockId);
          if (removed) {
             setTimeout(() => updateEntityContent(entity.id, list), 0);
             return list;
          }
          return prev;
        });
        
        if (targetFocusId) {
          setTimeout(() => {
            // Was a broken literal `\${targetFocusId}` (unescaped $ inside a
            // template literal), so this selector never matched anything and
            // the caret silently failed to land after deleting an empty
            // block — the deletion itself worked, only the focus restore
            // was a no-op.
            const el = host.querySelector<HTMLElement>(`[data-block-id="${targetFocusId}"] [data-block-content]`);
            if (el) focusAtEnd(el);
          }, 10);
        }
        return;
      }

      // Non-empty block, caret at its very start → merge into the previous
      // block ourselves ("first block wins", caret at the seam). Without
      // this preventDefault the browser natively merges two React-owned
      // divs and the DOM desyncs from the store permanently.
      const selB = window.getSelection();
      if (contentEl && selB?.rangeCount && selB.getRangeAt(0).collapsed) {
        const r = selB.getRangeAt(0);
        const test = document.createRange();
        test.selectNodeContents(contentEl);
        test.setEnd(r.startContainer, r.startOffset);
        if (test.toString().length === 0) {
          e.preventDefault();
          const idx = blocks.findIndex(b => b.id === blockId);
          if (idx > 0) {
            const prev = blocks[idx - 1];
            const cur = blocks[idx];
            if (prev.type === 'divider') {
              // Backspace against a divider deletes the divider.
              pendingCursor.current = { blockId: cur.id, offset: 0 };
              persistBlocks(blocks.filter(b => b.id !== prev.id));
            } else if ((prev.type === 'text' || prev.type === 'quote') && (cur.type === 'text' || cur.type === 'quote')) {
              const prevEl = host.querySelector<HTMLElement>(`[data-block-id="${prev.id}"] [data-block-content]`);
              const prevLen = (prevEl?.textContent ?? '').length;
              const merged = blocks.slice();
              merged[idx - 1] = { ...prev, content: prev.content + cur.content };
              merged.splice(idx, 1);
              pendingCursor.current = { blockId: prev.id, offset: prevLen };
              persistBlocks(merged);
            } else if (
              (cur.type === 'text' || cur.type === 'quote') &&
              ['bulletList', 'numberedList', 'dashedList', 'checklist'].includes(prev.type)
            ) {
              // Backspace at the start of a paragraph whose PREVIOUS block is
              // a list: append this block's content onto the list's LAST
              // row, matching "first block wins" for text-to-text but
              // mirrored — here the LIST is first in document order, so the
              // list's own content survives and the paragraph's content is
              // what gets appended into it. Previously this whole branch
              // fell through the unconditional "swallow the key" comment
              // below and did nothing at all — reproduced live: Backspace
              // (and the symmetric Delete case) at a text<->list boundary
              // silently no-op'd every time.
              const rows = flattenRows(prev);
              const lastRow = rows[rows.length - 1];
              const lastRowLen = (lastRow.content ?? '').length;
              const newRows = rows.slice();
              newRows[newRows.length - 1] = { ...lastRow, content: (lastRow.content ?? '') + cur.content };
              const nested = nestRows(newRows, prev.type as BlockType);
              const merged = blocks.slice();
              merged[idx - 1] = { ...prev, content: nested.content, checked: nested.checked, children: nested.children };
              merged.splice(idx, 1);
              pendingCursor.current = { blockId: lastRow.id, offset: lastRowLen };
              persistBlocks(merged);
            }
            // Other neighbor types (media, tables): swallow the key. No
            // merge yet — text<->text and text<->list are the two cases
            // this codebase's users have actually hit; media/table merges
            // are a separate, larger design question (what does merging
            // TEXT into a TABLE CELL even mean?) deferred until requested.
          }
          return;
        }
      }
      return;
    }

    if (e.key === 'Delete') {
      const contentEl = blockEl.querySelector<HTMLElement>('[data-block-content]');
      const selD = window.getSelection();
      if (contentEl && selD?.rangeCount && selD.getRangeAt(0).collapsed) {
        const r = selD.getRangeAt(0);
        const test = document.createRange();
        test.selectNodeContents(contentEl);
        test.setStart(r.startContainer, r.startOffset);
        if (test.toString().length === 0) {
          // Caret at the very end of this block → forward-merge next block in.
          e.preventDefault();
          const idx = blocks.findIndex(b => b.id === blockId);
          if (idx !== -1 && idx < blocks.length - 1) {
            const cur = blocks[idx];
            const next = blocks[idx + 1];
            if (next.type === 'divider') {
              persistBlocks(blocks.filter(b => b.id !== next.id));
            } else if ((cur.type === 'text' || cur.type === 'quote') && (next.type === 'text' || next.type === 'quote')) {
              const curLen = (contentEl.textContent ?? '').length;
              const merged = blocks.slice();
              merged[idx] = { ...cur, content: cur.content + next.content };
              merged.splice(idx + 1, 1);
              pendingCursor.current = { blockId: cur.id, offset: curLen };
              persistBlocks(merged);
            } else if (
              (cur.type === 'text' || cur.type === 'quote') &&
              ['bulletList', 'numberedList', 'dashedList', 'checklist'].includes(next.type)
            ) {
              // Delete at the true end of a paragraph whose NEXT block is a
              // list: pull the list's FIRST row's content up onto the end
              // of this paragraph, then remove just that first row from the
              // list (the list block itself survives with one fewer row,
              // unless it only had one row — mirrors "empty row removal"
              // elsewhere in this file). Symmetric to the Backspace case
              // above; same previously-silent no-op this fixes.
              const curLen = (contentEl.textContent ?? '').length;
              const rows = flattenRows(next);
              const firstRow = rows[0];
              const remainingRows = rows.slice(1);
              const merged = blocks.slice();
              merged[idx] = { ...cur, content: cur.content + (firstRow.content ?? '') };
              if (remainingRows.length === 0) {
                merged.splice(idx + 1, 1);
              } else {
                const nested = nestRows(remainingRows, next.type as BlockType);
                merged[idx + 1] = { ...next, content: nested.content, checked: nested.checked, children: nested.children };
              }
              pendingCursor.current = { blockId: cur.id, offset: curLen };
              persistBlocks(merged);
            }
          }
          return;
        }
      }
      return;
    }

    if (e.key === ' ') {
      const contentEl = blockEl.querySelector<HTMLElement>('[data-block-content]');
      const text = contentEl?.textContent ?? '';

      const transform = (updates: Partial<EditorBlock>) => {
        e.preventDefault();
        if (contentEl) contentEl.innerHTML = '';
        persistBlockUpdate(blockId, { content: '', ...updates });
      };

      if (text === '#') return transform({ type: 'text', style: 'title' });
      if (text === '##') return transform({ type: 'text', style: 'heading' });
      if (text === '###') return transform({ type: 'text', style: 'subheading' });
      if (text === '-' || text === '*') return transform({ type: 'bulletList' });
      if (text === '1.') return transform({ type: 'numberedList' });
      if (text === '[]') return transform({ type: 'checklist', checked: false });
      if (text === '"' || text === '>') return transform({ type: 'quote' });
      if (text === '```') return transform({ type: 'text', style: 'mono' });
      if (text === '---') return transform({ type: 'divider' });
      if (text === '/table' || text === '|') return transform({ type: 'table', tableData: [['', '', ''], ['', '', ''], ['', '', '']] });
    }
  }, [isReadMode, handleSlash, undo, redo, persistBlockUpdate, blocks, insertAfter, indentBlock, unindentBlock, setBlocks, entity.id, updateEntityContent]);

  useEffect(() => {
    const host = blocksHostRef.current;
    if (!host) return;
    host.addEventListener('keydown', handleHostKeyDown);
    return () => host.removeEventListener('keydown', handleHostKeyDown);
  }, [handleHostKeyDown]);



  const handleOpenMenu = useCallback((blockId: string, position: { x: number; y: number }, shiftKey?: boolean) => {
    if (shiftKey) {
      setActiveOptionsMenu(null);
      setSelectedBlockIds(prev => {
        const next = new Set(prev);
        if (next.has(blockId)) next.delete(blockId);
        else next.add(blockId);
        return next;
      });
    } else {
      setActiveOptionsMenu(prev => {
        if (prev?.blockId === blockId) {
          return null;
        }
        setSelectedBlockIds(new Set([blockId]));
        return { blockId, position };
      });
    }
  }, []);

  const insertBlock = useCallback((type: BlockType, extra?: Record<string, unknown>) => {
    if (!slashMenu) return;

    if (type === 'link') {
      const blockId = slashMenu.blockId;
      const el = document.querySelector(`[data-block-id="${blockId}"] [data-block-content]`) as HTMLElement;
      if (el) {
        blocksHostRef.current?.focus();
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          const node = range.startContainer;
          const offset = range.startOffset;
          if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent || "";
            const lastSlashIdx = text.lastIndexOf('/', offset);
            if (lastSlashIdx !== -1) {
              range.setStart(node, lastSlashIdx);
              range.setEnd(node, offset);
              range.deleteContents();
            }
          }

          const a = document.createElement('a');
          const url = 'https://flowr.website';
          const label = 'flowr.website';
          a.href = url;
          a.className = 'inline-link-btn px-2 py-0.5 mx-1 inline-flex items-center gap-1.5 bg-panel hover:bg-[var(--bone-5)] rounded-full text-[11px] font-bold font-sans text-[var(--bone-70)] hover:text-[var(--bone-100)] no-underline select-none border border-[var(--bone-10)] align-baseline';
          a.setAttribute('contenteditable', 'false');
          a.setAttribute('data-url', url);
          a.setAttribute('data-label', label);

          const faviconUrl = `https://www.google.com/s2/favicons?domain=flowr.website&sz=32`;
          a.innerHTML = `<span class="w-3.5 h-3.5 flex items-center justify-center shrink-0 overflow-hidden rounded-[4px] pointer-events-none"><img src="${faviconUrl}" class="w-3 h-3 object-contain select-none opacity-80" alt="" /></span><span class="font-medium pointer-events-none">${label}</span>`;

          range.insertNode(a);

          const space = document.createTextNode('\u00A0');
          range.setStartAfter(a);
          range.collapse(true);
          range.insertNode(space);

          range.setStartAfter(space);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
        }

        // Save the updated HTML block content
        updateBlock(blockId, { content: el.innerHTML });
      }
      setSlashMenu(null);
      return;
    }

    // Preserve the original block's id (matches turnIntoBlock, the other
    // place a block's type gets swapped in place) rather than minting a new
    // one via createBlock. A new id meant the block the user was looking at
    // and the block now in the array were different objects: nothing here
    // ever restored focus/caret afterward, so the browser's leftover
    // selection state (pointing at whatever DOM happened to still exist)
    // decided where typed text went — reproduced landing in an unrelated
    // sibling block.
    const targetBlockId = slashMenu.blockId;
    const replaceRecursive = (list: EditorBlock[]): EditorBlock[] => {
      return list.map(b => {
        if (b.id === targetBlockId) {
          return { ...createBlock(type, extra), id: targetBlockId };
        }
        if (b.children) {
          return { ...b, children: replaceRecursive(b.children) };
        }
        return b;
      });
    };

    const newBlocks = replaceRecursive(blocks);
    persistBlocks(newBlocks);
    setSlashMenu(null);

    setTimeout(() => {
      const el = blocksHostRef.current?.querySelector<HTMLElement>(
        `[data-block-id="${targetBlockId}"] [data-block-content], [data-row-id="${targetBlockId}"]`
      );
      if (el) focusAtEnd(el);
    }, 10);
  }, [blocks, slashMenu, persistBlocks, updateBlock]);

  const duplicateBlock = useCallback((id: string) => {
    const idx = blocks.findIndex(b => b.id === id);
    if (idx === -1) return;
    const clone = { ...blocks[idx], id: generateId() };
    const newBlocks = [...blocks];
    newBlocks.splice(idx + 1, 0, clone);
    persistBlocks(newBlocks);
  }, [blocks, persistBlocks]);

  const moveToTop = useCallback((id: string) => {
    const idx = blocks.findIndex(b => b.id === id);
    if (idx <= 0) return;
    const block = blocks[idx];
    const newBlocks = blocks.filter(b => b.id !== id);
    newBlocks.unshift({ ...block, pinned: true });
    persistBlocks(newBlocks);
  }, [blocks, persistBlocks]);

  const addColumn = useCallback((columnId: string) => {
    let parentId: string | null = null;
    const findParent = (list: EditorBlock[]) => {
      for (const b of list) {
        if (b.type === 'columns' && b.children?.some(c => c.id === columnId)) {
          parentId = b.id;
          return;
        }
        if (b.children) findParent(b.children);
      }
    };
    findParent(blocks);

    if (!parentId) return;

    const newList = blocks.map(b => {
      if (b.id === parentId && (b.children?.length ?? 0) < 4) {
        return {
          ...b,
          children: [
            ...(b.children || []),
            { id: generateId(), type: 'column' as const, content: '', children: [] }
          ]
        };
      }
      return b;
    });
    persistBlocks(newList);
  }, [blocks, persistBlocks]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          const focusedEl = document.activeElement as HTMLElement;
          const blockEl = focusedEl.closest('[data-block-id]');
          const afterId = blockEl?.getAttribute('data-block-id');
          const reader = new FileReader();
          reader.onload = (event) => {
            const dataUrl = event.target?.result as string;
            const newBlock = createBlock('image', { mediaUrl: dataUrl });
            if (afterId) {
              persistBlocks(blocks.flatMap(b => b.id === afterId ? [b, newBlock] : [b]));
            } else {
              persistBlocks([...blocks, newBlock]);
            }
          };
          reader.readAsDataURL(file);
          e.preventDefault();
          return;
        }
      }
    }

    const text = e.clipboardData.getData('text');
    const isImageLink = text.match(/\.(jpeg|jpg|gif|png|webp)$/i);
    const isVideoLink = text.match(/(youtube\.com|youtu\.be|vimeo\.com|mp4|webm|ogg)/i);

    if (isImageLink || isVideoLink) {
      const type = isImageLink ? 'image' : 'video';
      const focusedEl = document.activeElement as HTMLElement;
      const blockEl = focusedEl.closest('[data-block-id]');
      const afterId = blockEl?.getAttribute('data-block-id');

      if (afterId) {
        const block = blocks.find(b => b.id === afterId);
        if (block && block.type === 'text' && !block.content.trim()) {
          e.preventDefault();
          updateBlock(afterId, { type: type as any, mediaUrl: text, content: '' });
          return;
        }
      }
    }

    const target = e.target as HTMLElement;
    if (target.isContentEditable) {
      e.preventDefault();
      const plainText = e.clipboardData.getData('text/plain');

      if (looksLikeMarkdown(plainText)) {
        const parsedBlocks = parseMarkdownToBlocks(plainText);
        if (parsedBlocks.length > 0) {
          const blockEl = (document.activeElement as HTMLElement)?.closest('[data-block-id]');
          const focusedId = blockEl?.getAttribute('data-block-id');
          const focusedBlock = focusedId ? blocks.find(b => b.id === focusedId) : null;

          if (focusedBlock && !focusedBlock.content.trim()) {
            const idx = blocks.findIndex(b => b.id === focusedId);
            const newBlocks = [...blocks];
            newBlocks.splice(idx, 1, ...parsedBlocks);
            persistBlocks(newBlocks);
          } else if (focusedId) {
            const idx = blocks.findIndex(b => b.id === focusedId);
            const newBlocks = [...blocks];
            newBlocks.splice(idx + 1, 0, ...parsedBlocks);
            persistBlocks(newBlocks);
          } else {
            persistBlocks([...blocks, ...parsedBlocks]);
          }
          return;
        }
      }

      document.execCommand('insertText', false, plainText);
    }
  }, [blocks, insertAfter, persistBlocks, updateBlock]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        const newBlock = createBlock('image', { mediaUrl: dataUrl });
        persistBlocks([...blocks, newBlock]);
      };
      reader.readAsDataURL(files[0]);
    }
  }, [blocks, persistBlocks]);

  const turnIntoBlock = useCallback((id: string, type: BlockType, extra?: Record<string, unknown>) => {
    const isList = ['bulletList', 'dashedList', 'numberedList', 'checklist'].includes(type);

    const updateRecursive = (list: EditorBlock[]): EditorBlock[] => {
      return list.map(b => {
        if (b.id === id) {
          return {
            ...b,
            type,
            style: isList ? 'body' : ((extra?.style as BlockStyle) ?? (type === 'text' ? 'body' : b.style)),
            content: (extra?.content as string) ?? b.content,
            columnCount: type === 'columns' ? ((extra?.columnCount as number) ?? 2) : undefined,
            children: type === 'columns'
              ? Array.from({ length: (extra?.columnCount as number) ?? 2 }, () => ({
                id: generateId(),
                type: 'column' as const,
                content: '',
                children: []
              }))
              : undefined,
            checked: type === 'checklist' ? false : undefined,
          };
        }
        if (b.children) return { ...b, children: updateRecursive(b.children) };
        return b;
      });
    };

    const newBlocks = updateRecursive(blocks);
    persistBlocks(newBlocks);
  }, [blocks, persistBlocks]);


  const activeBlock = useMemo(() => {
    if (!activeBlockId) return undefined;
    return findBlockById(blocks, activeBlockId);
  }, [blocks, activeBlockId, findBlockById]);

  const slashQuery = useMemo(() => {
    if (!slashMenu) return '';
    const block = findBlockById(blocks, slashMenu.blockId);
    if (!block) return '';
    const text = block.content.replace(/<[^>]*>/g, '');
    const lastSlash = text.lastIndexOf('/');
    if (lastSlash === -1) return '';
    return text.substring(lastSlash + 1);
  }, [slashMenu, blocks]);

  const changeBlockStyle = useCallback((style: BlockStyle) => {
    if (activeBlock) {
      const isList = ['bulletList', 'dashedList', 'numberedList', 'checklist'].includes(activeBlock.type);
      if (isList) return;
      updateBlock(activeBlock.id, { style });
    }
  }, [activeBlock, updateBlock]);

  const changeAlign = useCallback((align: 'left' | 'center' | 'right' | 'justify') => {
    if (activeBlock) {
      updateBlock(activeBlock.id, { align });
    }
  }, [activeBlock, updateBlock]);

  const convertToList = useCallback((type: 'bulletList' | 'dashedList' | 'numberedList') => {
    if (activeBlock) {
      updateBlock(activeBlock.id, { type, style: 'body' });
    }
  }, [activeBlock, updateBlock]);

  const handleTitleBlur = () => {
    const value = (titleRef.current?.textContent ?? '').trim();
    if (value !== entity.title) {
      renameEntity(entity.id, value || "Untitled");
    }
    setEditingEntityId(null);
  };

  const handleAddTag = () => {
    addEmptyTag(entity.id);
    setEditingTagIndex((entity.tags ?? []).length);
  };

  const formatDate = (date: string | number) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleBlockFocus = useCallback((id: string) => {
    setActiveBlockId(id);
    setSelectedBlockIds(new Set());
  }, []);

  const getListCounter = useCallback((blockId: string, siblings: EditorBlock[]): number => {
    let count = 0;
    for (const b of siblings) {
      if (b.type === 'numberedList') count++;
      else count = 0;
      if (b.id === blockId) return count;
    }
    return 1;
  }, []);

  const renderBlocksRecursive = (list: EditorBlock[], depth: number = 0): React.ReactNode[] => {
    return list.flatMap((block, idx) => {
      const rendered = [
        <BlockRenderer
          key={block.id}
          block={block}
          index={idx}
          depth={depth}
          onUpdate={persistBlockUpdate}
          onDelete={deleteBlock}
          onIndent={indentBlock}
          onUnindent={unindentBlock}
          onInsertAfter={insertAfter}
          onSlash={handleSlash}
          onOpenMenu={handleOpenMenu}
          onFocus={handleBlockFocus}
          isSelected={selectedBlockIds.has(block.id)}
          isActive={activeBlockId === block.id}
          listNumber={block.type === 'numberedList' ? getListCounter(block.id, list) : undefined}
          slashMenuOpen={slashMenu?.blockId === block.id}
          menuOpen={activeOptionsMenu?.blockId === block.id}
          isDraggingGlobal={isDragging}
          isReadOnly={isReadMode}
        />
      ];
      const isListBlock = ['bulletList', 'numberedList', 'dashedList', 'checklist'].includes(block.type);
      if (!isListBlock && block.children && block.children.length > 0 && !block.isFolded) {
        rendered.push(
          <div key={`${block.id}-children`} className="pl-8">
            {renderBlocksRecursive(block.children, depth + 1)}
          </div>
        );
      }
      return rendered;
    });
  };

  return (
    <div
      ref={editorRef}
      className={cn(
        "flex-1 flex flex-col relative note-editor-bg",
        !splitViewActive && "overflow-hidden"
      )}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      onPaste={handlePaste}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      dir="ltr"
      style={{ direction: 'ltr' }}
    >
      {/* Top right corner control buttons (Read/Edit mode and Options menu) */}
      {!splitViewActive && (
        <div className="absolute top-4 right-6 z-40 flex items-center gap-1.5 [-webkit-app-region:no-drag]">
          <Tooltip content={isReadMode ? "Switch to Edit Mode" : "Switch to Reading Mode"}>
            <button
              onClick={() => setReadMode(entity.id, !isReadMode)}
              className="flex items-center justify-center w-8 h-8 rounded-[var(--radius-medium)] text-[var(--bone-100)] opacity-70 hover:opacity-100 hover:bg-[var(--bone-6)] border border-transparent transition-all cursor-pointer"
            >
              {isReadMode ? (
                <BookOpen className="w-4 h-4" />
              ) : (
                <Pencil className="w-4 h-4" />
              )}
            </button>
          </Tooltip>

          <Tooltip content="More Options">
            <button
              onClick={(e) => {
                e.stopPropagation();
                const rect = e.currentTarget.getBoundingClientRect();
                setOptionsMenuPos({ x: rect.left - 150, y: rect.bottom + 6 });
              }}
              className="flex items-center justify-center w-8 h-8 rounded-[var(--radius-medium)] text-[var(--bone-100)] opacity-70 hover:opacity-100 hover:bg-[var(--bone-6)] border border-transparent transition-all cursor-pointer"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          </Tooltip>
        </div>
      )}

      <ScrollWrapper isSplit={splitViewActive}>
        <div
          className={cn(
            "mx-auto py-8 editor-content-container note-editor-bg",
            "max-w-[850px]",
            splitViewActive ? "pl-[80px] pr-10" : "px-4",
            isDragging && "dragging-active-content"
          )}
          dir="ltr"
          style={{ direction: 'ltr' }}
          data-dragging={isDragging}
        >
          <div className="flex flex-col items-center gap-4 mb-4">
            <div
              onDoubleClick={(e) => e.stopPropagation()}
              className="flex flex-col w-full bg-panel border border-border rounded-3xl widget-shadow overflow-hidden transition-none"
            >
              <div
                className="pr-9 py-6 group relative transition-none duration-0"
                style={{ paddingLeft: '44px' }}
              >
                <div className="flex items-start justify-between w-full">
                  {isLoading ? (
                    <Skeleton className="h-14 w-3/4 rounded-lg bg-[var(--bone-5)]" />
                  ) : (
                    <h1
                      ref={titleRef}
                      contentEditable={isEditingTitle}
                      suppressContentEditableWarning
                      onDoubleClick={(e) => { e.stopPropagation(); setEditingEntityId(entity.id, 'view'); }}
                      onBlur={handleTitleBlur}
                      onKeyDown={e => {
                        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && isEditingTitle) {
                          // The title isn't a block (no data-block-id, lives
                          // outside blocksHostRef entirely) — there's no
                          // "afterId" to reuse insertAfter with. Insert a
                          // fresh text block at the very front of the array
                          // instead.
                          e.preventDefault();
                          const newBlock = createBlock('text');
                          persistBlocks([newBlock, ...blocks]);
                          setTimeout(() => {
                            const el = document.querySelector(`[data-block-id="${newBlock.id}"] [data-block-content]`) as HTMLElement;
                            if (el) focusAtEnd(el);
                          }, 50);
                          return;
                        }
                        if (e.key === 'Enter' && isEditingTitle) {
                          e.preventDefault();
                          e.currentTarget.blur();
                        }
                        if (e.key === 'Escape' && isEditingTitle) {
                          e.currentTarget.textContent = entity.title;
                          setEditingEntityId(null);
                        }
                      }}
                      className="text-5xl font-display font-medium outline-none cursor-text select-text text-foreground flex-1 break-words leading-tight block transition-none duration-0 transform-none"
                    >
                      {entity.title}
                    </h1>
                  )}
                  {!isReadMode && !isLoading && (
                    <button
                      onClick={() => setEditingEntityId(entity.id, 'view')}
                      className="opacity-0 group-hover:opacity-40 hover:!opacity-100 p-2 rounded-md hover:bg-hover text-[var(--bone-100)] transition-all mt-4"
                    >
                      <Pencil className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>

              <div
                className="pr-9 py-5 bg-panel flex items-start justify-between"
                style={{ paddingLeft: '44px' }}
              >
                <div className="flex items-start gap-x-12 gap-y-4 flex-wrap">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase opacity-50 leading-none">Last Modified</span>
                    <div className="h-6 flex items-center">
                      <span className="text-xs font-semibold text-foreground/80 whitespace-nowrap leading-none">
                        {formatDate(entity.lastModified)}
                      </span>
                    </div>
                  </div>

                  <div className="w-px h-8 bg-border/50 shrink-0 self-center" />

                  <div className="flex flex-col gap-1 flex-1 min-w-0">
                    <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase opacity-50 leading-none">Tags</span>
                    <div className="h-6 flex items-center gap-2 flex-wrap min-h-0">
                      {(entity.tags ?? []).map((tag, idx) => (
                        <TagItem
                          key={`tag-${idx}-${tag}`}
                          tag={tag}
                          index={idx}
                          isEditing={editingTagIndex === idx}
                          onEdit={setEditingTagIndex}
                          onDelete={(t: string) => removeTagFromEntity(entity.id, t)}
                          onUpdate={(oldTag: string, newTag: string) => updateTagInEntity(entity.id, oldTag, newTag)}
                          allTags={allUniqueTags}
                          disabled={isReadMode}
                        />
                      ))}

                      {!isReadMode && (
                        <button
                          onClick={handleAddTag}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium text-[var(--bone-40)] hover:text-[var(--bone-100)] hover:bg-[var(--app-dark)] transition-all"
                        >
                          <Plus strokeWidth={2} className="w-3 h-3" />
                          <span>New</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {(() => {
            const getLevel = (block: EditorBlock) => {
              if (block.type !== 'text') return 4;
              switch (block.style) {
                case 'title': return 1;
                case 'heading': return 2;
                case 'subheading': return 3;
                default: return 4;
              }
            };

            let currentFoldLevel = Infinity;
            const renderedBlocks = blocks.filter((block) => {
              const level = getLevel(block);

              if (level <= currentFoldLevel) {
                currentFoldLevel = Infinity;
              }

              const isVisible = currentFoldLevel === Infinity;

              if (block.isFolded && currentFoldLevel === Infinity) {
                currentFoldLevel = level;
              }

              return isVisible;
            });

            return (
              <div
                ref={blocksHostRef}
                contentEditable={!isReadMode}
                suppressContentEditableWarning
                onInput={handleHostInput}
                className="space-y-2 min-h-[50vh] note-editor-bg outline-none"
              >
                <div className="flex flex-col note-editor-bg">
                  {isLoading ? (
                    <div className="flex flex-col gap-4 py-4">
                      {[...Array(8)].map((_, i) => (
                        <Skeleton
                          key={i}
                          className={cn(
                            "h-5 rounded bg-[var(--bone-5)]",
                            i % 3 === 0 ? "w-full" : i % 3 === 1 ? "w-3/4" : "w-5/6",
                            i === 0 && "h-8 w-1/3 mb-4"
                          )}
                        />
                      ))}
                    </div>
                  ) : blocks.length === 0 ? (
                    <div
                      className="py-20 text-center cursor-text  group opacity-0 "
                      onClick={() => persistBlocks([createBlock('text')])}
                    >
                      <p className="text-[#a1a1aa] text-lg font-light tracking-wide group-hover:text-[#f26f21]/50 ">
                        This note is empty. Click anywhere to start writing...
                      </p>
                      <div className="mt-4 w-12 h-[1px] bg-gradient-to-r from-transparent via-[#f26f21]/20 to-transparent mx-auto" />
                    </div>
                  ) : (
                    renderBlocksRecursive(renderedBlocks)
                  )}
                </div>
              </div>
            );
          })()}
          <div
            className={cn("h-32 note-editor-bg", !isReadMode ? "cursor-text" : "cursor-default")}
            onClick={() => {
              if (isReadMode) return;
              // Only create a new block if there is no active selection and no open menus
              if (selectedBlockIds.size > 0 || activeOptionsMenu || slashMenu) {
                setSelectedBlockIds(new Set());
                setActiveOptionsMenu(null);
                setSlashMenu(null);
                return;
              }
              const newBlock = createBlock('text', { style: 'body' });
              persistBlocks([...blocks, newBlock]);
              setTimeout(() => {
                const el = document.querySelector(`[data-block-id="${newBlock.id}"] [data-block-content]`) as HTMLElement;
                if (el) {
                  blocksHostRef.current?.focus();
                  const range = document.createRange();
                  const sel = window.getSelection();
                  range.selectNodeContents(el);
                  range.collapse(false);
                  sel?.removeAllRanges();
                  sel?.addRange(range);
                }
              }, 50);
            }}
          />
        </div>
      </ScrollWrapper>



      {slashMenu && (
        <Portal>
          <SlashCommandMenu
            position={slashMenu.position}
            search={slashQuery}
            onClose={() => setSlashMenu(null)}
            onInsertBlock={insertBlock}
            activeBlockStyle={blocks.find(b => b.id === slashMenu.blockId)?.style}
          />
        </Portal>
      )}
      {activeOptionsMenu && (
        <Portal>
          <BlockOptionsMenu
            entityId={entity.id}
            block={findBlockById(blocks, activeOptionsMenu.blockId)!}
            position={activeOptionsMenu.position}
            onClose={() => setActiveOptionsMenu(null)}
            onUpdate={persistBlockUpdate}
            onDelete={deleteBlock}
            onDuplicate={duplicateBlock}
            onMoveToTop={moveToTop}
            onTurnInto={turnIntoBlock}
            onAddColumn={addColumn}
          />
        </Portal>
      )}
      {optionsMenuPos && (
        <Portal>
          <div
            className="fixed inset-0 z-[9998]"
            onClick={() => setOptionsMenuPos(null)}
          />
          <div
            className="fixed z-[9999] popup-glass-small backdrop-blur-xl p-1 min-w-[180px] flex flex-col gap-[2px]"
            style={{
              top: optionsMenuPos.y,
              left: optionsMenuPos.x
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseLeave={() => setShowExportMenu(false)}
          >
            <button
              onClick={() => {
                toggleFavorite(entity.id);
                setOptionsMenuPos(null);
              }}
              className="popup-item flex items-center gap-2 w-full text-left"
            >
              <Star className={cn("w-3.5 h-3.5", favoriteIds.includes(entity.id) ? "fill-accent text-accent" : "text-[var(--bone-40)]")} />
              <span>{favoriteIds.includes(entity.id) ? "Unpin from sidebar" : "Pin to sidebar"}</span>
            </button>

            <button
              onClick={() => {
                setEditingEntityId(entity.id, 'view');
                setOptionsMenuPos(null);
              }}
              className="popup-item flex items-center gap-2 w-full text-left"
            >
              <Pencil className="w-3.5 h-3.5 text-[var(--bone-40)]" />
              <span>Rename</span>
            </button>

            <button
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                setOptionsMenuPos(null);
              }}
              className="popup-item flex items-center gap-2 w-full text-left"
            >
              <Link className="w-3.5 h-3.5 text-[var(--bone-40)]" />
              <span>Copy link</span>
            </button>

            <button
              onClick={() => {
                duplicateEntity(entity.id);
                setOptionsMenuPos(null);
              }}
              className="popup-item flex items-center gap-2 w-full text-left"
            >
              <Copy className="w-3.5 h-3.5 text-[var(--bone-40)]" />
              <span>Duplicate</span>
            </button>

            <div
              className="relative"
              onMouseEnter={() => setShowExportMenu(true)}
            >
              <button
                className="popup-item flex items-center justify-between w-full text-left"
                onClick={() => setShowExportMenu(true)}
              >
                <div className="flex items-center gap-2">
                  <Download className="w-3.5 h-3.5 text-[var(--bone-40)]" />
                  <span>Export</span>
                </div>
                <ChevronRight className="w-3 h-3 text-[var(--bone-40)]" />
              </button>

              {showExportMenu && (
                <div className="absolute right-[calc(100%+4px)] top-0 z-[10000] popup-glass-small backdrop-blur-xl p-1 min-w-[140px] flex flex-col gap-[2px]">
                  <button
                    onClick={() => {
                      openModal({ kind: 'pdfExport', entityId: entity.id, entityTitle: entity.title, blocks });
                      setOptionsMenuPos(null);
                      setShowExportMenu(false);
                    }}
                    className="popup-item flex items-center gap-2 w-full text-left"
                  >
                    <FileText className="w-3.5 h-3.5 text-[var(--bone-40)]" />
                    <span>PDF (.pdf)</span>
                  </button>
                  <button
                    onClick={() => {
                      const mdContent = blocksToMarkdown(blocks);
                      const blob = new Blob([mdContent], { type: 'text/markdown' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `${entity.title || 'Untitled'}.md`;
                      a.click();
                      URL.revokeObjectURL(url);
                      setOptionsMenuPos(null);
                      setShowExportMenu(false);
                    }}
                    className="popup-item flex items-center gap-2 w-full text-left"
                  >
                    <FileCode className="w-3.5 h-3.5 text-[var(--bone-40)]" />
                    <span>Markdown (.md)</span>
                  </button>

                  <div className="popup-divider" />

                  <button
                    onClick={() => {
                      // Remove markdown styling for a cleaner plain text file, but keep structural newlines
                      const txtContent = blocksToMarkdown(blocks)
                        .replace(/\*\*(.*?)\*\*/g, '$1') // remove bold
                        .replace(/\*(.*?)\*/g, '$1') // remove italic
                        .replace(/`(.*?)`/g, '$1') // remove code
                        .replace(/\[(.*?)\]\((.*?)\)/g, '$1 ($2)') // clean links
                        .replace(/\[pill:(.*?)\]\((.*?)\)/g, '$1 ($2)'); // clean pill links

                      const blob = new Blob([txtContent], { type: 'text/plain' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `${entity.title || 'Untitled'}.txt`;
                      a.click();
                      URL.revokeObjectURL(url);
                      setOptionsMenuPos(null);
                      setShowExportMenu(false);
                    }}
                    className="popup-item flex items-center gap-2 w-full text-left"
                  >
                    <FileText className="w-3.5 h-3.5 text-[var(--bone-40)]" />
                    <span>Text (.txt)</span>
                  </button>
                  <button
                    onClick={() => {
                      // We will need to implement actual image export, for now just basic handler
                      import('html-to-image').then((htmlToImage) => {
                        const node = document.getElementById('note-editor-container');
                        if (node) {
                          htmlToImage.toPng(node).then((dataUrl) => {
                            const a = document.createElement('a');
                            a.href = dataUrl;
                            a.download = `${entity.title || 'Untitled'}.png`;
                            a.click();
                          });
                        }
                      });
                      setOptionsMenuPos(null);
                      setShowExportMenu(false);
                    }}
                    className="popup-item flex items-center gap-2 w-full text-left"
                  >
                    <ImageIcon className="w-3.5 h-3.5 text-[var(--bone-40)]" />
                    <span>Image (.png)</span>
                  </button>
                  <button
                    onClick={() => {
                      const jsonContent = JSON.stringify({ title: entity.title, blocks }, null, 2);
                      const blob = new Blob([jsonContent], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `${entity.title || 'Untitled'}.json`;
                      a.click();
                      URL.revokeObjectURL(url);
                      setOptionsMenuPos(null);
                      setShowExportMenu(false);
                    }}
                    className="popup-item flex items-center gap-2 w-full text-left"
                  >
                    <FileJson className="w-3.5 h-3.5 text-[var(--bone-40)]" />
                    <span>JSON (.json)</span>
                  </button>
                  <button
                    onClick={() => {
                      const htmlContent = `<html><head><title>${entity.title}</title></head><body>` + blocks.map(b => `<p>${b.content}</p>`).join('') + `</body></html>`;
                      const blob = new Blob([htmlContent], { type: 'text/html' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `${entity.title || 'Untitled'}.html`;
                      a.click();
                      URL.revokeObjectURL(url);
                      setOptionsMenuPos(null);
                      setShowExportMenu(false);
                    }}
                    className="popup-item flex items-center gap-2 w-full text-left"
                  >
                    <Globe className="w-3.5 h-3.5 text-[var(--bone-40)]" />
                    <span>HTML (.html)</span>
                  </button>
                </div>
              )}
            </div>

            <div className="popup-divider" />

            <button
              onClick={() => {
                openModal({ kind: 'deleteConfirm', entityId: entity.id });
                setOptionsMenuPos(null);
              }}
              className="popup-item flex items-center gap-2 w-full text-left text-red-500 hover:text-red-400 hover:bg-red-500/10"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>
          </div>
        </Portal>
      )}
      <SelectionToolbar editorRef={editorRef} isReadOnly={isReadMode} />
    </div>
  );
}

