"use client";

import { Entity, EntityType, useStore } from '@/data/store';
import { getEntityIcon } from '@/data/icons';
import { ChevronRight, ChevronDown, FileText, Frame, Folder, Layers, Plus, MoreHorizontal } from 'lucide-react';
import clsx from 'clsx';
import React, { useState, useCallback } from 'react';
import { IconPicker } from './IconPicker';
import { Tooltip } from './Tooltip';
import { useSortable } from '@dnd-kit/sortable';
import { useDndContext } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

interface TreeItemProps {
  entity: Entity;
  depth: number;
  idOverride?: string;
  isDragOverlay?: boolean;
  disableNesting?: boolean;
}

export const TreeItem = React.memo(function TreeItem({ entity, depth, idOverride, isDragOverlay, disableNesting }: TreeItemProps) {
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

  const handleClick = () => {
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
    const size = "w-4 h-4";
    const cls = `${size} shrink-0 `;
    
    const iconColorClass = clsx(
      "",
      isActive ? "text-[var(--bone-100)]" : "text-[var(--bone-60)] group-hover:text-[var(--bone-100)]"
    );

    if (type === 'collection' || type === 'workspace' || type === 'folder') {
      const FolderIcon = (type === 'collection' || type === 'workspace') ? getEntityIcon(entity.icon) : Folder;
      
      const mainIcon = (
        <div 
          className={clsx(
            "flex items-center justify-center ",
            isCollapsible && "group-hover:opacity-0"
          )}
        >
          <FolderIcon strokeWidth={2} className={clsx(cls, iconColorClass)} />
        </div>
      );

      return (
        <div className="relative flex items-center justify-center w-3.5 h-3.5 group/icon">
          {mainIcon}
          
          {isCollapsible && (
            <div 
              onClick={handleChevronClick}
              onPointerDown={(e) => e.stopPropagation()}
              className="absolute inset-0 -m-1.25 flex items-center justify-center opacity-0 group-hover:opacity-100 rounded-[var(--radius-small)] hover:bg-[var(--bone-10)] cursor-pointer"
            >
              {isCollapsed 
                ? <ChevronRight strokeWidth={2} className="w-3.5 h-3.5 text-[var(--bone-60)] group-hover:text-[var(--bone-100)]" /> 
                : <ChevronDown strokeWidth={2} className="w-3.5 h-3.5 text-[var(--bone-60)] group-hover:text-[var(--bone-100)]" />}
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
      case 'note': return <FileText strokeWidth={2} className={clsx(cls, iconColorClass)} />;
      case 'canvas': return <Frame strokeWidth={2} className={clsx(cls, iconColorClass)} />;
      case 'mixed': return <Layers strokeWidth={2} className={clsx(cls, iconColorClass)} />;
    }
  };


  const isWorkspace = depth === 0;
  const isExpanded = isCollapsible && !isCollapsed;
  const blockActive = isActive || isChildActive;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={clsx(
        isWorkspace && "rounded-[var(--radius-small)] transition-all duration-0",
        isWorkspace && isExpanded && "group/workspace",
        "relative"
      )}
    >
      <div
        onClick={handleClick}
        {...attributes}
        {...listeners}
        data-selected={isActive || undefined}
        className={clsx(
          "sidebar-item-row group relative flex items-center w-full cursor-pointer select-none transition-all duration-0",
          "px-3 rounded-[var(--radius-small)]",
          "py-[3px]",
          isActive 
            ? "bg-[var(--bone-15)] text-[var(--bone-100)]" 
            : "text-[var(--bone-60)] hover:text-[var(--bone-100)] hover:bg-[var(--bone-6)]",
          isWorkspace && !isActive && "group-hover/workspace:text-[var(--bone-100)]",
          isWorkspace ? "text-[14px] font-medium" : "text-[13.5px]",
        )}
        style={{ paddingLeft: `${depth * 18 + 12}px`, paddingRight: '12px' }}
      >
        <div className="w-5 shrink-0 flex items-center justify-center">
          {(!disableNesting && isCollapsible) ? getIcon(entity.type) : getIcon(entity.type)}
        </div>

        {isEditing ? (
          <input
            autoFocus
            type="text"
            value={tempTitle}
            onChange={(e) => setTempTitle(e.target.value)}
            onBlur={handleRename}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
            className="ml-[8px] flex-1 min-w-0 bg-transparent outline-none text-[var(--foreground)] border-none p-0 inline-block text-sm"
          />
        ) : (
          <span className={clsx(
            "ml-[8px] text-fade flex-1 text-left",
            isWorkspace && "font-medium",
            isActive ? "text-[var(--bone-100)]" : "text-[var(--bone-60)] group-hover:text-[var(--bone-100)]"
          )}>
            {entity.title}
          </span>
        )}

        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 shrink-0 ml-1">
          {(entity.type === 'workspace' || entity.type === 'collection' || entity.type === 'folder') && (
            <button
               onClick={handlePlusClick}
               className="w-6 h-6 flex items-center justify-center rounded-[var(--radius-small)] text-[var(--bone-60)] hover:text-[var(--bone-100)] hover:bg-[var(--bone-10)]"
            >
              <Plus strokeWidth={2} className="w-3.5 h-3.5" />
            </button>
          )}
          <button
             onClick={handleOptionsClick}
             className="w-6 h-6 flex items-center justify-center rounded-[var(--radius-small)] text-[var(--bone-60)] hover:text-[var(--bone-100)] hover:bg-[var(--bone-10)]"
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
          className={clsx(
            "grid transition-all duration-100 ease-out",
            isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
          )}
        >
          <div className="overflow-hidden">
            <div className={clsx("relative flex flex-col gap-[3px]", isExpanded && "mt-[3px]")}>
              <div 
                className="absolute top-0 bottom-0 w-[1px] bg-[var(--bone-10)]" 
                style={{ left: `${depth * 18 + 14.5}px` }}
              />
              {children.map((child) => (
                <TreeItem 
                  key={idOverride ? `${idOverride.split('-')[0]}-${child.id}` : child.id} 
                  entity={child} 
                  depth={depth + 1} 
                  idOverride={idOverride ? `${idOverride.split('-')[0]}-${child.id}` : undefined}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});


