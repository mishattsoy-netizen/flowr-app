"use client";

import { Entity, EntityType, useStore } from '@/data/store';
import { getEntityIcon } from '@/data/icons';
import { ChevronRight, ChevronDown, FileText, Frame, Folder, Layers, Plus, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import React, { useState, useCallback, useRef } from 'react';
import { IconPicker } from './IconPicker';
import { Tooltip } from './Tooltip';
import { useSortable } from '@dnd-kit/sortable';
import { useDndContext } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { stripHtml } from '@/lib/utils';

interface TreeItemProps {
  entity: Entity;
  depth: number;
  idOverride?: string;
  isDragOverlay?: boolean;
  disableNesting?: boolean;
  isMultiSelected?: boolean;
  onShiftClick?: (entityId: string, e: React.MouseEvent) => void;
}

export const TreeItem = React.memo(function TreeItem({ entity, depth, idOverride, isDragOverlay, disableNesting, isMultiSelected, onShiftClick }: TreeItemProps) {
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
  const aiCursor = useStore(state => state.aiCursor);
  const contextMenu = useStore(state => state.contextMenu);

  const sortable = useSortable({ 
    id: idOverride || entity.id,
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
  const isDropTarget = !isDragging && over?.id === myId;
  const isFolder = entity.type === 'folder' || entity.type === 'collection' || entity.type === 'workspace';

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragOverlay ? undefined : transition,
    zIndex: isDragging ? 1000 : (isDragOverlay ? 2000 : undefined),
    position: 'relative' as const,
  };

  const [tempTitle, setTempTitle] = React.useState(entity.title);
  const [iconPickerAnchor, setIconPickerAnchor] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
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
    openModal({ kind: 'newItem', parentId: entity.id });
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
    
    const iconColorClass = cn(
      "",
      isActive ? "text-[var(--bone-100)]" : "text-[var(--bone-70)] group-hover:text-[var(--bone-100)]"
    );

    if (type === 'collection' || type === 'workspace' || type === 'folder') {
      const FolderIcon = (type === 'collection' || type === 'workspace') ? getEntityIcon(entity.icon) : Folder;
      
      const mainIcon = (
        <div 
          className={cn(
            "flex items-center justify-center ",
            isCollapsible && "group-hover:opacity-0"
          )}
        >
          <FolderIcon strokeWidth={2} className={cn(cls, iconColorClass)} />
        </div>
      );

      return (
        <div className="relative flex items-center justify-center w-3.5 h-3.5 group/icon">
          {mainIcon}
          
          {isCollapsible && (
            <div 
              onClick={handleChevronClick}
              onPointerDown={(e) => e.stopPropagation()}
              className="absolute -inset-[4px] flex items-center justify-center opacity-0 group-hover:opacity-100 rounded-[var(--radius-small)] hover:bg-[var(--bone-10)] cursor-pointer"
            >
              {isCollapsed 
                ? <ChevronRight strokeWidth={2} className="w-3.5 h-3.5 text-[var(--bone-70)] group-hover:text-[var(--bone-100)]" /> 
                : <ChevronDown strokeWidth={2} className="w-3.5 h-3.5 text-[var(--bone-70)] group-hover:text-[var(--bone-100)]" />}
            </div>
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
        "relative"
      )}
    >
      <div
        onClick={handleClick}
        {...attributes}
        {...listeners}
        data-selected={isActive || undefined}
        className={cn(
          "sidebar-item-row group relative flex w-full cursor-pointer select-none ",
          isEditing ? "items-start pt-[5px]" : "items-center h-7",
          "px-3 rounded-[var(--radius-small)]",
          effectiveMultiSelected
            ? "bg-[var(--bone-6)] text-[var(--bone-70)] hover:text-[var(--bone-100)]"
            : (isActive || contextMenu?.entityId === entity.id)
              ? "!bg-[var(--bone-15)] text-[var(--bone-100)] font-normal tracking-wide" 
              : "text-[var(--bone-70)] hover:text-[var(--bone-100)] hover:bg-[var(--bone-6)]",
          isWorkspace && !isActive && "group-hover/workspace:text-[var(--bone-100)]",
          "text-[13px]",
        )}
        style={{ paddingLeft: `${depth * 18 + 10}px`, paddingRight: '6px' }}
      >
        <div className="w-[14px] shrink-0 flex items-center justify-center">
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
            "ml-[6px] flex-1 text-left text-fade line-clamp-2 leading-snug",
            isActive ? "text-[var(--bone-100)]" : "text-[var(--bone-70)] group-hover:text-[var(--bone-100)]"
          )}>
            {stripHtml(entity.title)}
          </span>
        )}

        <div className={cn(
          "flex items-center gap-1 shrink-0",
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
               contextMenu?.entityId === entity.id && "!bg-[var(--bone-15)] !text-[var(--bone-100)] !opacity-100"
             )}
          >
            <MoreHorizontal strokeWidth={2} className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {isDropTarget && !isFolder && (
        <div className="absolute bottom-0 left-3 right-3 h-0.5 bg-accent rounded-full pointer-events-none z-10" />
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
            <div className={cn("relative flex flex-col gap-[3px]", isExpanded && "mt-[3px]")}>
              <div 
                className="absolute top-0 bottom-0 w-[1px] bg-[var(--bone-12)]" 
                style={{ left: `${depth * 18 + 17}px` }}
              />
              {children.map((child) => (
                <TreeItem 
                  key={idOverride ? `${idOverride.split('-')[0]}-${child.id}` : child.id} 
                  entity={child} 
                  depth={depth + 1} 
                  idOverride={idOverride ? `${idOverride.split('-')[0]}-${child.id}` : undefined}
                  onShiftClick={onShiftClick}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});


