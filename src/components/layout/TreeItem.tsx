"use client";

import { Entity, EntityType, useStore, generateId } from '@/data/store';
import { getEntityIcon } from '@/data/icons';
import { ChevronRight, ChevronDown, FileText, Frame, Folder, Layers, Plus, MoreHorizontal, StarOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import React, { useState, useCallback, useRef } from 'react';
import { IconPicker } from './IconPicker';
import { Tooltip } from './Tooltip';
import { draggable, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { attachClosestEdge, type Edge, extractClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import { disableNativeDragPreview } from '@atlaskit/pragmatic-drag-and-drop/element/disable-native-drag-preview';
import { stripHtml } from '@/lib/utils';

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

  // The overlay clone must register under a distinct id so it doesn't collide
  // with the real row already in the SortableContext (duplicate ids destabilize
  // dnd-kit's measurement and make the drag jump).
  const sortable = useSortable({
    id: isDragOverlay ? `overlay-${idOverride || entity.id}` : (idOverride || entity.id),
    disabled: isDragOverlay
  });

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = sortable;

  const { over } = useDndContext();
  const myId = idOverride || entity.id;
  // Only the real tree row shows the insert line — never the floating overlay
  // clone (which is also a TreeItem and would otherwise draw a stray line that
  // follows the cursor). The line marks the drop slot under a sibling row.
  const isDropTarget = !isDragging && !isDragOverlay && over?.id === myId;
  const isFolder = entity.type === 'folder' || entity.type === 'collection' || entity.type === 'workspace';
  // Hovering a folder while dragging means "drop inside" — give the row a
  // distinct nest highlight (ring + glow) instead of the between-rows insert line.
  const isFolderDropTarget = isDropTarget && isFolder;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragOverlay ? undefined : transition,
    zIndex: isDragging ? 1000 : (isDragOverlay ? 2000 : undefined),
    position: 'relative' as const,
    // A live clone follows the cursor in the DragOverlay, so dim the original
    // in place to show its source slot without a second solid copy.
    opacity: isDragging && !isDragOverlay ? 0.4 : undefined,
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
      ref={setNodeRef}
      style={style}
      className={cn(
        isWorkspace && "rounded-[var(--radius-small)] ",
        isWorkspace && isExpanded && "group/workspace",
        "relative group/treeitem"
      )}
    >
      <div
        onClick={handleClick}
        {...attributes}
        {...listeners}
        data-selected={isActive || undefined}
        className={cn(
          "sidebar-item-row group relative flex w-full cursor-pointer select-none transition-all",
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
      </div>

      {isDropTarget && !isFolder && (
        <div className="absolute bottom-0 left-3 right-3 h-0.5 bg-[var(--bone-30)] rounded-full pointer-events-none z-10" />
      )}

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
            <div className={cn("relative flex flex-col gap-[1px]", isExpanded && "mt-[1px]")}>
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
    </div>
  );
});


