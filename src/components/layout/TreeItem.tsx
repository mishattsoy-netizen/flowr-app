"use client";

import { Entity, EntityType, useStore, generateId } from '@/data/store';
import { getEntityIcon } from '@/data/icons';
import { ChevronRight, ChevronDown, FileText, Frame, Folder, Layers, Plus, MoreHorizontal, StarOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { IconPicker } from './IconPicker';
import { Tooltip } from './Tooltip';
import { draggable, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { attachClosestEdge, type Edge, extractClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import { disableNativeDragPreview } from '@atlaskit/pragmatic-drag-and-drop/element/disable-native-drag-preview';
import { stripHtml } from '@/lib/utils';

// Global cursor tracker — updated by both the source draggable's onDrag
// (Chrome) and a window-level pointermove listener (Safari fallback).
// Safari doesn't reliably provide location.current.input in drop target
// callbacks, so drop targets read from this instead.
const dragCursor = { x: 0, y: 0, ready: false };

// Bind a window-level listener so dragCursor is always in sync regardless
// of pragmatic-dnd adapter quirks per browser.
if (typeof window !== 'undefined') {
  window.addEventListener('pointermove', (e) => {
    dragCursor.x = e.clientX;
    dragCursor.y = e.clientY;
    dragCursor.ready = true;
  }, { passive: true });
}

/** Small spacer rendered after a folder's children list. When hovered during a
 *  tree-item drag it shows an edge line at the folder's depth to signal
 *  "insert after this folder at the parent level." The Sidebar's onDrop
 *  recognizes the isAfterFolder flag and forces edge='bottom' on the folder. */
function AfterFolderSpacer({ folderId, depth }: { folderId: string; depth: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [isOver, setIsOver] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return dropTargetForElements({
      element: el,
      canDrop: ({ source }) => source.data.type === 'tree-item' && source.data.id !== folderId,
      getData: () => ({ type: 'tree-item', id: folderId, isAfterFolder: true }),
      onDragEnter: () => setIsOver(true),
      onDragLeave: () => setIsOver(false),
      onDrop: () => setIsOver(false),
    });
  }, [folderId]);

  return (
    <div
      ref={ref}
      className="relative w-full"
      style={{ height: isOver ? '6px' : '2px' }}
    >
      {isOver && (
        <div
          className="absolute h-px bg-[var(--bone-30)] pointer-events-none z-10 top-0"
          style={{
            left: `${8 + depth * 18}px`,
            right: '3px',
          }}
        />
      )}
    </div>
  );
}

interface TreeItemProps {
  entity: Entity;
  depth: number;
  idOverride?: string;
  isDragOverlay?: boolean;
  disableNesting?: boolean;
  isMultiSelected?: boolean;
  onShiftClick?: (entityId: string, e: React.MouseEvent) => void;
  /** On the drag-overlay clone only: show an "unpin on drop" hint badge. */
  showUnpinHint?: boolean;
}

export const TreeItem = React.memo(function TreeItem({ entity, depth, idOverride, isDragOverlay, disableNesting, isMultiSelected, onShiftClick, showUnpinHint }: TreeItemProps) {
  const entities = useStore(state => state.entities);
  const activeEntityId = useStore(state => state.activeEntityId);
  const collapsedIds = useStore(state => state.collapsedIds);
  const setActiveEntityId = useStore(state => state.setActiveEntityId);
  const toggleCollapsed = useStore(state => state.toggleCollapsed);
  const openModal = useStore(state => state.openModal);
  const openContextMenu = useStore(state => state.openContextMenu);
  const editingEntity = useStore(state => state.editingEntity);
  const setEditingEntityId = useStore(state => state.setEditingEntityId);
  const renameEntity = useStore(state => state.renameEntity);
  const addEntity = useStore(state => state.addEntity);
  const aiCursor = useStore(state => state.aiCursor);
  const contextMenu = useStore(state => state.contextMenu);

  const elementRef = useRef<HTMLDivElement | null>(null);
  const rowRef = useRef<HTMLDivElement | null>(null);
  const [isDraggingLocal, setIsDraggingLocal] = useState(false);
  const [closestEdge, setClosestEdge] = useState<Edge | null>(null);
  const [isOver, setIsOver] = useState(false);
  const edgeRef = useRef<Edge | null>(null);

  const myId = idOverride || entity.id;
  const isFolder = entity.type === 'folder' || entity.type === 'collection' || entity.type === 'workspace';
  const isFolderDropTarget = isOver && isFolder;

  // Render ghost preview portal using createPortal
  const [preview, setPreview] = useState<boolean>(false);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = elementRef.current;
    if (!el || isDragOverlay) return;

    // Set cursor to grabbing immediately on native dragstart — before
    // pragmatic-dnd's lifecycle fires — so the browser never shows the
    // default copy/green-plus cursor.
    const handleDragStart = (e: DragEvent) => {
      e.dataTransfer!.effectAllowed = 'move';
      e.dataTransfer!.dropEffect = 'move';
      document.body.style.cursor = 'grabbing';
    };
    el.addEventListener('dragstart', handleDragStart, { capture: true });

    const cleanup = draggable({
      element: el,
      getInitialData: () => ({
        type: 'tree-item',
        id: myId,
        parentId: entity.parentId,
        workspaceId: entity.workspaceId,
        isPinned: idOverride?.startsWith('pinned-') || false,
      }),
      onGenerateDragPreview: ({ nativeSetDragImage, source, location }) => {
        disableNativeDragPreview({ nativeSetDragImage });
        setPreview(true);
      },
      onDrag: ({ location }) => {
        const node = previewRef.current;
        if (!node) return;
        // The centering wrapper inside the portal offsets by -50%,
        // so positioning the outer wrapper's top-left at the cursor
        // keeps the preview centered on it.
        node.style.transform = `translate(${location.current.input.clientX}px, ${location.current.input.clientY}px)`;
        // Keep the global cursor tracker updated for Safari fallback
        dragCursor.x = location.current.input.clientX;
        dragCursor.y = location.current.input.clientY;
      },
      onDragStart: () => {
        setIsDraggingLocal(true);
        setPreview(true);
      },
      onDrop: () => {
        setIsDraggingLocal(false);
        setPreview(false);
      },
    });

    return () => {
      el.removeEventListener('dragstart', handleDragStart, { capture: true } as EventListenerOptions);
      cleanup();
    };
  }, [myId, entity.parentId, entity.workspaceId, idOverride, isDragOverlay]);

  // Drop target is on the row div only (not the wrapper that includes children),
  // so the gap below an item's children doesn't get caught by the parent's drop
  // target — hover must be on a specific item's row to see edge zone lines.
  useEffect(() => {
    const el = rowRef.current;
    if (!el || isDragOverlay) return;

    return dropTargetForElements({
      element: el,
      canDrop: ({ source }) => source.data.type === 'tree-item' && source.data.id !== myId,
      getData: ({ input, element }) => attachClosestEdge(
        { type: 'tree-item', id: myId },
        { input, element, allowedEdges: ['top', 'bottom'] }
      ),
      onDragEnter: ({ location }) => {
        setIsOver(true);
        const rect = rowRef.current?.getBoundingClientRect();
        if (!rect) return;
        // Always use the globally-tracked cursor (updated by window
        // pointermove AND the source draggable's onDrag). Safari's drop
        // target callbacks can return stale/missing clientY from
        // location.current.input, so we bypass it entirely.
        if (!dragCursor.ready) return;
        const clientY = dragCursor.y;
        let edge: Edge | null;
        if (isFolder) {
          // Folders/collections/workspaces: top 25%=reorder above,
          // middle 50%=nest inside (null), bottom 25%=reorder below.
          const threshold = rect.height * 0.25;
          if (clientY < rect.top + threshold) {
            edge = 'top';
          } else if (clientY > rect.bottom - threshold) {
            edge = 'bottom';
          } else {
            edge = null;
          }
        } else {
          edge = clientY < rect.top + rect.height / 2 ? 'top' : 'bottom';
        }
        if (edge !== edgeRef.current) {
          edgeRef.current = edge;
          setClosestEdge(edge);
        }
      },
      onDrag: ({ location }) => {
        // isOver is already true from onDragEnter — no need to setState on every frame
        const rect = rowRef.current?.getBoundingClientRect();
        if (!rect) return;
        if (!dragCursor.ready) return;
        const clientY = dragCursor.y;
        let edge: Edge | null;
        if (isFolder) {
          const threshold = rect.height * 0.25;
          if (clientY < rect.top + threshold) {
            edge = 'top';
          } else if (clientY > rect.bottom - threshold) {
            edge = 'bottom';
          } else {
            edge = null;
          }
        } else {
          edge = clientY < rect.top + rect.height / 2 ? 'top' : 'bottom';
        }
        if (edge !== edgeRef.current) {
          edgeRef.current = edge;
          setClosestEdge(edge);
        }
      },
      onDragLeave: () => {
        setIsOver(false);
        edgeRef.current = null;
        setClosestEdge(null);
      },
      onDrop: () => {
        setIsOver(false);
        edgeRef.current = null;
        setClosestEdge(null);
      },
    });
  }, [myId, isFolder, isDragOverlay]);

  const style = {
    zIndex: isDraggingLocal ? 1000 : (isDragOverlay ? 2000 : undefined),
    position: 'relative' as const,
    opacity: isDraggingLocal && !isDragOverlay ? 0.4 : undefined,
  };

  const [tempTitle, setTempTitle] = React.useState(entity.title);
  const [iconPickerAnchor, setIconPickerAnchor] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [plusPopupPos, setPlusPopupPos] = useState<{ x: number; y: number } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isEditing = editingEntity?.id === entity.id && editingEntity?.source === 'sidebar';

  React.useEffect(() => {
    if (isEditing) {
      setTempTitle(entity.title);
    }
  }, [isEditing, entity.title]);

  const handleRename = () => {
    if (tempTitle.trim() && tempTitle !== entity.title) {
      renameEntity(entity.id, tempTitle.trim());
    } else {
      setEditingEntityId(null);
    }
  };

  React.useEffect(() => {
    if (isEditing && textareaRef.current) {
      const target = textareaRef.current;
      target.style.height = '18px';
      target.style.height = `${Math.min(target.scrollHeight, 40)}px`;
    }
  }, [isEditing]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleRename();
    if (e.key === 'Escape') setEditingEntityId(null);
  };

  const isDescendantActive = (parentId: string): boolean => {
    if (!activeEntityId) return false;
    let current = entities.find(e => e.id === activeEntityId);
    while (current?.parentId) {
      if (current.parentId === parentId) return true;
      const nextId = current.parentId;
      current = entities.find(e => e.id === nextId);
    }
    return false;
  };

  const isChildActive = isDescendantActive(entity.id);
  const children = entities
    .filter(e => e.parentId === entity.id)
    .sort((a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999));
  const hasChildren = children.length > 0;
  const isPinned = idOverride?.startsWith('pinned-');
  const isCollapsible = hasChildren && !isPinned && !disableNesting;
  const isCollapsed = collapsedIds.includes(entity.id);
  const isActive = activeEntityId === entity.id;

  const selectedSidebarIds = useStore(state => state.selectedSidebarIds);
  const clearSelectedSidebarIds = useStore(state => state.clearSelectedSidebarIds);
  const effectiveMultiSelected = isMultiSelected || selectedSidebarIds.includes(entity.id);

  const handleClick = (e: React.MouseEvent) => {
    if (e.shiftKey && onShiftClick) {
      e.preventDefault();
      onShiftClick(entity.id, e);
      return;
    }
    // Clear multi-select on any non-shift click
    clearSelectedSidebarIds();
    setActiveEntityId(entity.id);
  };

  const handleChevronClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleCollapsed(entity.id);
  };

  const handlePlusClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setPlusPopupPos({ x: rect.right + 4, y: rect.top });
  };

  const handleOptionsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    openContextMenu(entity.id, rect.right + 4, rect.top, 'sidebar');
  };

  const handleIconClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (entity.type !== 'collection' && entity.type !== 'workspace') return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setIconPickerAnchor({ x: rect.left, y: rect.top, width: rect.width, height: rect.height });
  }, [entity.type]);

  const closeIconPicker = useCallback(() => {
    setIconPickerAnchor(null);
  }, []);

  const getIcon = (type: EntityType) => {
    const size = "w-3.5 h-3.5";
    const cls = `${size} shrink-0 `;

    const iconColorClass = "text-inherit";

    if (type === 'collection' || type === 'workspace' || type === 'folder') {
      const FolderIcon = (type === 'collection' || type === 'workspace') ? getEntityIcon(entity.icon) : Folder;

      const mainIcon = (
        <div
          className={cn(
            "flex items-center justify-center",
            isCollapsible && "group-hover:opacity-0 transition-opacity duration-100"
          )}
        >
          <FolderIcon strokeWidth={2} className={cn(cls, iconColorClass)} />
        </div>
      );

      return (
        <div className="relative flex items-center justify-center w-3.5 h-3.5">
          {mainIcon}

          {isCollapsible && (
            <button
              onClick={handleChevronClick}
              onPointerDown={(e) => e.stopPropagation()}
              className="sidebar-actions absolute -top-[4px] -left-[4px] btn-sidebar-utility opacity-0 group-hover:opacity-100"
            >
              {isCollapsed
                ? <ChevronRight strokeWidth={2} className="w-3.5 h-3.5" />
                : <ChevronDown strokeWidth={2} className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      );
    }

    const isTargeted = aiCursor?.id === entity.id;
    const typingIndicator = isTargeted && (aiCursor?.type === 'writing' || aiCursor?.type === 'generating_image');
    const presenceBadge = isTargeted && (
      <span className="absolute -top-1 -right-1 w-2 h-2 bg-accent rounded-full border border-background" />
    );

    switch (type) {
      case 'note': return <FileText strokeWidth={2} className={cn(cls, iconColorClass)} />;
      case 'canvas': return <Frame strokeWidth={2} className={cn(cls, iconColorClass)} />;
      case 'mixed': return <Layers strokeWidth={2} className={cn(cls, iconColorClass)} />;
    }
  };


  const isWorkspace = depth === 0;
  const isExpanded = isCollapsible && !isCollapsed;
  const blockActive = isActive || isChildActive;

  return (
    <div
      ref={elementRef}
      style={style}
      className={cn(
        isWorkspace && "rounded-[var(--radius-small)] ",
        isWorkspace && isExpanded && "group/workspace",
        "relative group/treeitem",
        "pt-[1px]"
      )}
    >
      <div
        ref={rowRef}
        onClick={handleClick}
        data-selected={isActive || undefined}
        className={cn(
          "sidebar-item-row group relative flex w-full select-none transition-all",
          isEditing ? "items-start pt-[5px]" : "items-center h-7",
          "px-3 rounded-[var(--radius-small)]",
          effectiveMultiSelected
            ? "bg-[var(--app-dark)] text-[var(--bone-70)] hover:text-[var(--bone-100)]"
            : (isActive || contextMenu?.entityId === entity.id)
              ? "!bg-dark text-[var(--bone-100)] font-normal tracking-wide"
              : "text-[var(--bone-70)] hover:text-[var(--bone-100)] [&:hover:not(:has(.sidebar-actions:hover))]:bg-[var(--app-dark)]",
          isWorkspace && !isActive && "group-hover/workspace:text-[var(--bone-100)]",
          isFolderDropTarget && "sidebar-folder-drop-target",
          "text-[14px]",
        )}
        style={{ paddingLeft: `${8 + depth * 18}px`, paddingRight: '3px' }}
      >
        <div className={cn(
          "w-[14px] shrink-0 flex items-center justify-center text-[var(--bone-100)] transition-opacity duration-200",
          isActive ? "opacity-100" : "opacity-70 group-hover:opacity-100"
        )}>
          {(!disableNesting && isCollapsible) ? getIcon(entity.type) : getIcon(entity.type)}
        </div>

        {isEditing ? (
          <textarea
            ref={textareaRef}
            autoFocus
            rows={1}
            value={tempTitle}
            onChange={(e) => setTempTitle(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleRename();
              }
              if (e.key === 'Escape') setEditingEntityId(null);
            }}
            onClick={(e) => e.stopPropagation()}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = '18px';
              target.style.height = `${Math.min(target.scrollHeight, 40)}px`;
            }}
            className="ml-[6px] flex-1 min-w-0 bg-transparent outline-none text-[var(--foreground)] border-none p-0 text-[13px] leading-snug resize-none overflow-hidden break-words whitespace-pre-wrap w-full"
          />
        ) : (
          <span className={cn(
            "ml-[6px] flex-1 text-left truncate leading-snug",
            isActive ? "text-[var(--bone-100)]" : "text-[var(--bone-70)] group-hover:text-[var(--bone-100)]"
          )}>
            {stripHtml(entity.title)}
          </span>
        )}

        <div className={cn(
          "sidebar-actions flex items-center gap-[1px] shrink-0",
          contextMenu?.entityId === entity.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        )}>
          {(entity.type === 'workspace' || entity.type === 'collection' || entity.type === 'folder') && (
            <button
              onClick={handlePlusClick}
              className="btn-sidebar-utility"
            >
              <Plus strokeWidth={2} className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={handleOptionsClick}
            className={cn(
              "btn-sidebar-utility",
              contextMenu?.entityId === entity.id && "!bg-[var(--app-dark)] !text-[var(--bone-100)] !opacity-100"
            )}
          >
            <MoreHorizontal strokeWidth={2} className="w-3.5 h-3.5" />
          </button>
        </div>

        {isOver && closestEdge && (
          <div
            className={cn(
              "absolute h-px bg-[var(--bone-30)] pointer-events-none z-10",
              closestEdge === 'top' ? 'top-0' : '-bottom-px'
            )}
            style={{
              left: `${8 + depth * 18}px`,
              right: '3px'
            }}
          />
        )}
      </div>

      {/* Overlay-clone only: dragging a pinned item outside the pinned section
          will unpin it on drop (it never moves the real entity). Surface that. */}
      {isDragOverlay && showUnpinHint && (
        <div className="absolute -right-1 -top-2 z-20 flex items-center gap-1 rounded-full bg-danger px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-md pointer-events-none">
          <StarOff strokeWidth={2.5} className="w-3 h-3" />
          <span>Unpin</span>
        </div>
      )}

      {iconPickerAnchor && (
        <IconPicker
          entityId={entity.id}
          anchorRect={iconPickerAnchor}
          onClose={closeIconPicker}
        />
      )}

      {children.length > 0 && !isPinned && !disableNesting && (
        <div
          className={cn(
            "grid transition-all duration-100 ease-out",
            isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
          )}
        >
          <div className="overflow-hidden">
            <div className={cn("relative flex flex-col", isExpanded && "mt-[1px]")}>
              {children.map((child) => (
                <TreeItem
                  key={idOverride ? `${idOverride.split('-')[0]}-${child.id}` : child.id}
                  entity={child}
                  depth={depth + 1}
                  idOverride={idOverride ? `${idOverride.split('-')[0]}-${child.id}` : undefined}
                  onShiftClick={onShiftClick}
                />
              ))}
              {/* Hierarchy Line */}
              <div
                className="absolute top-0 bottom-0 w-[1px] bg-[var(--bone-15)] group-hover/treeitem:bg-[var(--bone-30)] transition-colors duration-200 pointer-events-none"
                style={{ left: `${8 + depth * 18 + 6}px` }}
              />
            </div>
          </div>
        </div>
      )}
      {isFolder && children.length > 0 && !!isExpanded && (
        <AfterFolderSpacer folderId={entity.id} depth={depth} />
      )}
      {plusPopupPos && (
        <>
          <div className="fixed inset-0 z-[299]" onClick={(e) => { e.stopPropagation(); setPlusPopupPos(null); }} />
          <div
            className="fixed z-[300] popup-glass-small min-w-[160px] p-1.5 flex flex-col gap-[3px]"
            style={{ left: plusPopupPos.x, top: plusPopupPos.y }}
            onClick={(e) => e.stopPropagation()}
          >
            {[
              { type: 'folder' as const, label: 'Folder', icon: Folder },
              { type: 'note' as const, label: 'Note', icon: FileText },
              { type: 'canvas' as const, label: 'Canvas', icon: Frame },
              { type: 'mixed' as const, label: 'Mixed', icon: Layers }
            ].map(opt => (
              <button
                key={opt.type}
                onClick={() => {
                  const newId = generateId();
                  addEntity({
                    id: newId,
                    title: `Untitled ${opt.label}`,
                    type: opt.type,
                    parentId: entity.id,
                    lastModified: Date.now()
                  });
                  if (opt.type !== 'folder') {
                    setActiveEntityId(newId);
                  }
                  setPlusPopupPos(null);
                }}
                className="popup-item group w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-none"
              >
                <opt.icon strokeWidth={2} className="w-4 h-4 shrink-0 text-[var(--bone-70)] group-hover:text-[var(--bone-100)]" />
                <span className="flex-1 text-left font-medium tracking-wide">{opt.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
      {preview &&
        createPortal(
          <div
            ref={previewRef}
            className="fixed top-0 left-0 z-[10000] pointer-events-none"
            style={{ transform: 'translate(-9999px, -9999px)' }}
          >
            {/* Centering wrapper offsets the preview so its center is at
                the cursor position set by the parent's JS transform */}
            <div className="-translate-x-1/2 -translate-y-1/2">
              <div className="w-[240px] bg-sidebar rounded-[var(--radius-small)] opacity-85 shadow-lg border border-[var(--bone-10)]">
                <TreeItem
                  entity={entity}
                  depth={0}
                  isDragOverlay
                  disableNesting
                  showUnpinHint={showUnpinHint}
                />
              </div>
            </div>
          </div>,
          document.body
        )
      }
    </div>
  );
});


