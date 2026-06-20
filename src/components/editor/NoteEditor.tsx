"use client";

import { useState, useCallback, useMemo, useRef, useEffect, useLayoutEffect } from 'react';
import { X, Plus, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Entity, EditorBlock, BlockType, BlockStyle, generateId, useStore } from '@/data/store';
import { SelectionToolbar } from './SelectionToolbar';
import { SlashCommandMenu } from './SlashCommandMenu';
import { BlockRenderer } from './BlockRenderer';
import { BlockOptionsMenu } from './BlockOptionsMenu';
import { Portal } from '../layout/Portal';

import { monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { extractClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import { looksLikeMarkdown, parseMarkdownToBlocks } from '@/lib/editor/markdownBlocks';

function arrayMove<T>(array: T[], from: number, to: number): T[] {
  const newArray = array.slice();
  newArray.splice(to < 0 ? newArray.length + to : to, 0, newArray.splice(from, 1)[0]);
  return newArray;
}

interface NoteEditorProps {
  entity: Entity;
  isMixed?: boolean;
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
    dbViewType: type === 'database' ? ((extra?.dbViewType as string) ?? 'table') as EditorBlock['dbViewType'] : undefined,
    dbColumns: type === 'database' ? [
      { id: 'col-name', name: 'Name', type: 'text' as const },
      { id: 'col-status', name: 'Status', type: 'select' as const, options: ['To Do', 'In Progress', 'Done'] },
      { id: 'col-date', name: 'Date', type: 'date' as const },
    ] : undefined,
    dbRows: type === 'database' ? [
      { id: generateId(), cells: { 'col-name': 'Item 1', 'col-status': 'To Do', 'col-date': '' } },
      { id: generateId(), cells: { 'col-name': 'Item 2', 'col-status': 'In Progress', 'col-date': '' } },
    ] : undefined,
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
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return {
    bg: `hsla(${hue}, 40%, 45%, 0.12)`,
    text: `hsl(${hue}, 70%, 85%)`,
    border: `hsla(${hue}, 40%, 50%, 0.25)`
  };
};

function TagItem({
  tag,
  index,
  isEditing,
  onEdit,
  onDelete,
  onUpdate,
  allTags
}: {
  tag: string;
  index: number;
  isEditing: boolean;
  onEdit: (idx: number) => void;
  onDelete: (tag: string) => void;
  onUpdate: (oldTag: string, newTag: string) => void;
  allTags: string[];
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
        onClick={!isEditing ? () => onEdit(index) : undefined}
        className={cn(
          "px-2 py-0.5 rounded-full text-[11px] font-medium cursor-pointer flex items-center gap-1 transition-all border",
          !isEditing && "hover:brightness-110"
        )}
        style={{ 
          backgroundColor: colors.bg, 
          color: colors.text,
          borderColor: colors.border
        }}
      >
        {isEditing ? (
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
            className="bg-transparent outline-none text-[11px] font-medium p-0 m-0 border-none text-inherit max-w-[120px]"
            style={{ width: `${Math.max(editValue.length, 2)}ch`, color: 'inherit' }}
          />
        ) : (
          <span className="truncate max-w-[120px]">{tag || "new tag"}</span>
        )}
        <button
          onClick={handleDelete}
          aria-label={`Delete tag ${tag}`}
          className="hover:text-danger rounded-full p-0.5 transition-colors opacity-60 hover:opacity-100"
        >
          <X strokeWidth={2} className="w-3 h-3" />
        </button>
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

export function NoteEditor({ entity, isMixed = false }: NoteEditorProps) {
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

  const allUniqueTags = useMemo(() => {
    return Array.from(new Set(entities.flatMap(e => e.tags || [])));
  }, [entities]);

  const [blocks, setBlocks] = useState<EditorBlock[]>(() => {
    if (entity.content && entity.content.length > 0) return entity.content;
    return [createBlock('text', { style: 'body' })];
  });

  const lastSyncedVersion = useRef<string>(JSON.stringify(entity.content || []));
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
       if (syncTimeoutRef.current && isUserModified.current) {
         clearTimeout(syncTimeoutRef.current);
         syncTimeoutRef.current = null;
         updateEntityContent(lastEntityId.current, blocksRef.current);
       }

       const newContent = entity.content && entity.content.length > 0
        ? entity.content
        : [createBlock('text', { style: 'body' })];
       setBlocks(newContent);
       lastSyncedVersion.current = JSON.stringify(entity.content || []);
       lastEntityId.current = entity.id;
       isFirstMount.current = true;
       isUserModified.current = false;
       return;
    }

    const isAiWritingThis = aiCursor?.id === entity.id;
    const storeJson = JSON.stringify(entity.content || []);
    
    // CASE A: External update (AI or another tab/component)
    if (storeJson !== lastSyncedVersion.current) {
      const localJson = JSON.stringify(blocks);
      if (storeJson !== localJson) {
        setBlocks(entity.content || []);
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
      if (syncTimeoutRef.current && isUserModified.current) {
        clearTimeout(syncTimeoutRef.current);
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
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectionBox, setSelectionBox] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    active: boolean;
  } | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const isFullWidth = useStore(s => s.isFullWidth);

  const titleRef = useRef<HTMLHeadingElement>(null!);
  const [editingTagIndex, setEditingTagIndex] = useState<number | null>(null);

  const isEditingTitle = editingEntity?.id === entity.id && editingEntity.source === 'view';

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

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Only start selection if clicking on the container background or an empty space
    const target = e.target as HTMLElement;
    const isEditorBg = target === editorRef.current || target.classList.contains('note-editor-bg');
    
    if (isEditorBg) {
      const rect = editorRef.current?.getBoundingClientRect();
      if (!rect) return;
      
      setSelectionBox({
        startX: e.clientX,
        startY: e.clientY,
        currentX: e.clientX,
        currentY: e.clientY,
        active: true
      });
      
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
        const newEl = document.querySelector(`[data-block-id="${newBlock.id}"] [contenteditable]`) as HTMLElement;
        if (newEl) {
          newEl.focus();
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

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (selectionBox?.active) {
      setSelectionBox(prev => prev ? { ...prev, currentX: e.clientX, currentY: e.clientY } : null);
      
      // Calculate selection rectangle
      const x1 = Math.min(selectionBox.startX, e.clientX);
      const y1 = Math.min(selectionBox.startY, e.clientY);
      const x2 = Math.max(selectionBox.startX, e.clientX);
      const y2 = Math.max(selectionBox.startY, e.clientY);
      
      // Find blocks intersecting this rect
      const blockElements = editorRef.current?.querySelectorAll('[data-block-id]');
      

      
      // Standard behavior: selection is exactly what's inside the current rectangle
      const currentSelected = new Set<string>();
      blockElements?.forEach(el => {
        const rect = el.getBoundingClientRect();
        const id = el.getAttribute('data-block-id');
        if (!id) return;
        const isInside = (rect.left < x2 && rect.right > x1 && rect.top < y2 && rect.bottom > y1);
        if (isInside) currentSelected.add(id);
      });
      
      setSelectedBlockIds(currentSelected);
    }
  }, [selectionBox]);

  const handleMouseUp = useCallback(() => {
    setSelectionBox(null);
  }, []);

  useEffect(() => {
    if (selectionBox?.active) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [selectionBox?.active, handleMouseMove, handleMouseUp]);

  useEffect(() => {
    const handleDocumentMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      // Determine if we clicked inside a block container
      const clickedInsideBlock = !!target.closest('[data-block-id]');
      
      // Determine if we clicked inside an active popup menu (like block options, slash command, or toolbar)
      const clickedInsidePopup = !!target.closest('.popup-glass-small') || !!target.closest('.popup-glass');
      
      // If clicking entirely outside any block and any popup menu (e.g. empty space), reset state
      if (!clickedInsideBlock && !clickedInsidePopup) {
        setSelectedBlockIds(new Set());
        setActiveOptionsMenu(null);
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
    setBlocks(prev => updateBlockRecursive(prev, id, updates));
  }, []);



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
        const el = document.querySelector(`[data-block-id="${newBlock.id}"] [contenteditable]`) as HTMLElement;
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
      const el = document.querySelector(`[data-block-id="${blockId}"] [contenteditable]`) as HTMLElement;
      if (el) {
        el.focus();
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
          a.className = 'inline-link-btn px-2 py-0.5 mx-1 inline-flex items-center gap-1.5 bg-[var(--bone-5)] hover:bg-[var(--bone-10)] rounded-full text-[11px] font-bold font-sans text-[var(--bone-70)] hover:text-[var(--bone-100)] no-underline select-none border border-[var(--bone-10)] align-baseline';
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

    const replaceRecursive = (list: EditorBlock[]): EditorBlock[] => {
      return list.map(b => {
        if (b.id === slashMenu.blockId) {
          return createBlock(type, extra);
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
          onUpdate={updateBlock}
          onDelete={deleteBlock}
          onIndent={indentBlock}
          onUnindent={unindentBlock}
          onInsertAfter={insertAfter}
          onSlash={handleSlash}
          onOpenMenu={handleOpenMenu}
          onFocus={handleBlockFocus}
          isSelected={selectedBlockIds.has(block.id)}
          listNumber={block.type === 'numberedList' ? getListCounter(block.id, list) : undefined}
          slashMenuOpen={slashMenu?.blockId === block.id}
          menuOpen={activeOptionsMenu?.blockId === block.id}
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
      className="flex-1 flex flex-col relative overflow-hidden note-editor-bg"
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      onPaste={handlePaste}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      dir="ltr"
      style={{ direction: 'ltr' }}
    >
      <div 
        className="flex-1 overflow-y-auto custom-scrollbar note-editor-bg"
      >
        <div 
            className={cn(
              "mx-auto py-8 editor-content-container note-editor-bg",
              isFullWidth ? "w-full md:px-20 px-4" : "max-w-[850px] px-4",
              isDragging && "dragging-active-content"
            )}
            dir="ltr"
            style={{ direction: 'ltr' }}
            data-dragging={isDragging}
          >
          <div className="flex flex-col items-center gap-4 mb-4">
              <div 
                onDoubleClick={(e) => e.stopPropagation()}
                className="flex flex-col w-full bg-sidebar border border-border rounded-3xl widget-shadow overflow-hidden transition-none"
              >
                <div 
                  className="pr-9 py-6 group relative transition-none duration-0"
                  style={{ paddingLeft: '44px' }}
                >
                  <div className="flex items-start justify-between w-full">
                  <h1
                    ref={titleRef}
                    contentEditable={isEditingTitle}
                    suppressContentEditableWarning
                    onDoubleClick={(e) => { e.stopPropagation(); setEditingEntityId(entity.id, 'view'); }}
                    onBlur={handleTitleBlur}
                    onKeyDown={e => {
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
                  <button
                    onClick={() => setEditingEntityId(entity.id, 'view')}
                    className="opacity-0 group-hover:opacity-100 p-2 rounded-md hover:bg-hover text-muted-foreground hover:text-foreground transition-colors mt-4"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
                </div>

                <div 
                  className="pr-9 py-5 bg-sidebar flex items-start justify-between"
                  style={{ paddingLeft: '44px' }}
                >
                <div className="flex items-start gap-x-12 gap-y-4 flex-wrap">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase opacity-50 leading-none">Last Modified</span>
                    <span className="text-xs font-semibold text-foreground/80 whitespace-nowrap pt-1 leading-none">
                      {formatDate(entity.lastModified)}
                    </span>
                  </div>

                  <div className="w-px h-8 bg-border/50 shrink-0" />

                  <div className="flex flex-col gap-2 flex-1 min-w-0">
                    <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase opacity-50 leading-none">Tags</span>
                    <div className="flex items-center gap-2 flex-wrap min-h-0 pt-0.5">
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
                        />
                      ))}

                      <button
                        onClick={handleAddTag}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium text-[var(--bone-40)] hover:text-[var(--bone-100)] hover:bg-[var(--app-dark)] transition-all"
                      >
                        <Plus strokeWidth={2} className="w-3 h-3" />
                        <span>New</span>
                      </button>
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
                className="space-y-2 min-h-[50vh] note-editor-bg"
              >
                <div className="flex flex-col note-editor-bg">
                  {blocks.length === 0 ? (
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
            className="h-32 note-editor-bg cursor-text" 
            onClick={() => {
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
                const el = document.querySelector(`[data-block-id="${newBlock.id}"] [contenteditable]`) as HTMLElement;
                if (el) {
                  el.focus();
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
      </div>

      {selectionBox?.active && (
        <div 
          className="selection-box fixed"
          style={{
            left: Math.min(selectionBox.startX, selectionBox.currentX),
            top: Math.min(selectionBox.startY, selectionBox.currentY),
            width: Math.abs(selectionBox.currentX - selectionBox.startX),
            height: Math.abs(selectionBox.currentY - selectionBox.startY)
          }}
        />
      )}

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
            onUpdate={updateBlock}
            onDelete={deleteBlock}
            onDuplicate={duplicateBlock}
            onMoveToTop={moveToTop}
            onTurnInto={turnIntoBlock}
            onAddColumn={addColumn}
          />
        </Portal>
      )}
      <SelectionToolbar editorRef={editorRef} />
    </div>
  );
}

