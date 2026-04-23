"use client";

import { Entity, EntityType, useStore } from '@/data/store';
import { FileText, Frame, Layers, Folder, MoreHorizontal, LayoutGrid, List, ArrowDown, Type, Layout } from 'lucide-react';
import { getEntityIcon } from '@/data/icons';
import { useMemo, useState, useCallback, useEffect } from 'react';
import { Tooltip } from '@/components/layout/Tooltip';
import clsx from 'clsx';

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const getIcon = (type: EntityType, cls: string, entity?: Entity) => {
  if (entity?.icon) {
    const CustomIcon = getEntityIcon(entity.icon);
    return <CustomIcon className={cls} />;
  }
  switch (type) {
    case 'canvas': return <Frame className={cls} />;
    case 'note': return <FileText className={cls} />;
    case 'mixed': return <Layers className={cls} />;
    case 'folder':
    case 'collection': return <Folder className={cls} />;
    default: return <Frame className={cls} />;
  }
};

const formatDateTime = (ts: number) => {
  const d = new Date(ts);
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(d);
};

/* ── Sortable Item ── */
function SortableFileItem({ 
  child, 
  isGrid, 
  activeEntityId, 
  setActiveEntityId, 
  editingEntity, 
  setEditingEntityId, 
  renameEntity,
  openContextMenu 
}: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: child.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : 1,
    opacity: isDragging ? 0.5 : 1,
  };

  const isEditing = editingEntity?.id === child.id && editingEntity.source === 'widget';
  const [tempTitle, setTempTitle] = useState(child.title);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => !isEditing && setActiveEntityId(child.id)}
      onDoubleClick={(e) => {
        e.stopPropagation();
        setEditingEntityId(child.id, 'widget');
      }}
      className={clsx(
        "group/item relative flex items-center gap-3 rounded-[var(--radius-medium)] cursor-pointer transition-all duration-300",
        isGrid 
          ? "flex-col p-3 bg-[var(--bone-5)] border border-[var(--bone-10)] hover:border-accent/40 hover:bg-[var(--bone-6)] hover:shadow-lg hover:-translate-y-0.5" 
          : "px-3 py-2 text-[var(--bone-60)] hover:text-[var(--bone-100)] hover:bg-[var(--bone-6)]",
        activeEntityId === child.id && (isGrid ? "border-accent bg-[var(--bone-6)] ring-1 ring-accent/20" : "bg-[var(--bone-6)] text-[var(--bone-100)]")
      )}
    >
      <div className={clsx(
        "shrink-0 transition-transform duration-300",
        isGrid ? "w-12 h-12 flex items-center justify-center bg-[var(--bone-10)] rounded-xl text-accent group-hover/item:scale-110 group-hover/item:bg-[var(--bone-15)]" : ""
      )}>
        {getIcon(child.type, isGrid ? "w-7 h-7" : "w-5 h-5 text-[var(--bone-60)] group-hover/item:text-[var(--bone-100)]", child)}
      </div>

      <div className={clsx("min-w-0 flex-1", isGrid ? "text-center w-full" : "text-left")}>
        {isEditing ? (
          <input
            autoFocus
            type="text"
            value={tempTitle}
            onChange={e => setTempTitle(e.target.value)}
            onBlur={() => {
              if (tempTitle.trim() && tempTitle !== child.title) {
                renameEntity(child.id, tempTitle.trim());
              } else {
                setEditingEntityId(null);
              }
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              if (e.key === 'Escape') {
                setEditingEntityId(null);
                setTempTitle(child.title);
              }
            }}
            onClick={e => e.stopPropagation()}
            className="bg-[var(--color-panel)] border border-accent rounded px-1 outline-none text-xs font-medium text-foreground w-full py-0.5"
          />
        ) : (
          <span className={clsx("font-medium truncate block transition-colors", isGrid ? "text-[11px]" : "text-sm", activeEntityId === child.id ? "text-[var(--bone-100)]" : "text-[var(--bone-60)] group-hover/item:text-[var(--bone-100)]")}>
            {child.title}
          </span>
        )}
        {!isGrid && (
          <span className="text-[10px] text-[var(--bone-30)] group-hover/item:text-[var(--bone-60)]">
            {formatDateTime(child.lastModified)}
          </span>
        )}
      </div>

      {!isEditing && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            openContextMenu(child.id, rect.right + 4, rect.top, 'sidebar');
          }}
          className={clsx(
            "opacity-0 group-hover/item:opacity-100 flex items-center justify-center hover:bg-[var(--bone-10)] rounded-[var(--radius-small)] text-[var(--bone-40)] hover:text-foreground transition-all",
            isGrid ? "absolute top-1 right-1 w-6 h-6" : "w-7 h-7"
          )}
        >
          <MoreHorizontal className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

/* ── Main Widget ── */
export function AllFilesWidget({ entity: propEntity, contextId, data, onUpdateData }: any) {
  const entities = useStore(state => state.entities);
  const setActiveEntityId = useStore(state => state.setActiveEntityId);
  const openContextMenu = useStore(state => state.openContextMenu);
  const activeEntityId = useStore(state => state.activeEntityId);
  const editingEntity = useStore(state => state.editingEntity);
  const renameEntity = useStore(state => state.renameEntity);
  const setEditingEntityId = useStore(state => state.setEditingEntityId);
  const reorderEntities = useStore(state => state.reorderEntities);

  const [sortMode, setSortMode] = useState<'modified' | 'alpha' | 'category' | 'manual'>(data?.sortMode || 'modified');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(data?.viewMode || 'grid');
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 3 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Find target entity context
  const entity = useMemo(() => {
    if (propEntity) return propEntity;
    if (!contextId || contextId === 'dashboard') return null;
    return entities.find(e => e.id === contextId) || null;
  }, [propEntity, contextId, entities]);

  const children = useMemo(() => {
    let filtered = entities.filter(e => entity ? e.parentId === entity.id : !e.parentId);
    
    // Don't show workspaces in the files list if we are on dashboard
    if (!entity) {
       filtered = filtered.filter(e => e.type !== 'workspace');
    }

    const sorted = [...filtered];

    if (sortMode === 'modified') {
      sorted.sort((a, b) => b.lastModified - a.lastModified);
    } else if (sortMode === 'alpha') {
      sorted.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortMode === 'category') {
      const typeWeights: Record<string, number> = { 'folder': 0, 'collection': 0, 'note': 1, 'canvas': 2, 'mixed': 3 };
      sorted.sort((a, b) => {
        const weightA = typeWeights[a.type] ?? 10;
        const weightB = typeWeights[b.type] ?? 10;
        if (weightA !== weightB) return weightA - weightB;
        return a.title.localeCompare(b.title);
      });
    } else if (sortMode === 'manual') {
      sorted.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    }

    return sorted;
  }, [entities, entity, sortMode]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = children.findIndex(c => c.id === active.id);
      const newIndex = children.findIndex(c => c.id === over.id);
      const reordered = arrayMove(children, oldIndex, newIndex);
      reorderEntities(reordered.map(c => c.id as string));
      if (sortMode !== 'manual') {
        setSortMode('manual');
        onUpdateData?.({ ...(data || {}), sortMode: 'manual' });
      }
    }
  };

  const updateSort = (mode: any) => {
    setSortMode(mode);
    onUpdateData?.({ ...(data || {}), sortMode: mode });
  };

  return (
    <section className="bg-sidebar border border-[var(--bone-10)] group/widget rounded-[var(--radius-big)] widget-shadow h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-[var(--bone-5)] bg-[var(--color-panel)]/50 backdrop-blur-md sticky top-0 z-10">
        <h2 className="text-[13px] font-semibold text-[var(--bone-40)] uppercase tracking-wider">
          {entity?.title || 'All Files'}
        </h2>
        
        <div className="flex items-center gap-1">
          {/* View Toggle */}
          <div className="flex bg-[var(--bone-5)] p-0.5 rounded-lg border border-[var(--bone-10)] mr-2">
            <button 
              onClick={() => setViewMode('grid')}
              className={clsx("p-1 rounded-md transition-all", viewMode === 'grid' ? "bg-[var(--bone-15)] shadow-sm text-accent" : "text-[var(--bone-40)] hover:text-foreground")}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={clsx("p-1 rounded-md transition-all", viewMode === 'list' ? "bg-[var(--bone-15)] shadow-sm text-accent" : "text-[var(--bone-40)] hover:text-foreground")}
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Sort Controls */}
          <div className="flex items-center gap-1">
             <Tooltip content="Sort by Category">
              <button 
                onClick={() => updateSort('category')}
                className={clsx("p-1.5 rounded-lg transition-all", sortMode === 'category' ? "bg-accent/10 text-accent" : "hover:bg-[var(--bone-6)] text-[var(--bone-40)]")}
              >
                <Layers className="w-3.5 h-3.5" />
              </button>
            </Tooltip>
            <Tooltip content="Sort Alphabetically">
              <button 
                onClick={() => updateSort('alpha')}
                className={clsx("p-1.5 rounded-lg transition-all", sortMode === 'alpha' ? "bg-accent/10 text-accent" : "hover:bg-[var(--bone-6)] text-[var(--bone-40)]")}
              >
                <Type className="w-3.5 h-3.5" />
              </button>
            </Tooltip>
             <Tooltip content="Sort by Modified">
              <button 
                onClick={() => updateSort('modified')}
                className={clsx("p-1.5 rounded-lg transition-all", sortMode === 'modified' ? "bg-accent/10 text-accent" : "hover:bg-[var(--bone-6)] text-[var(--bone-40)]")}
              >
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
            </Tooltip>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
        {children.length > 0 ? (
          isMounted ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={children.map(c => c.id)}
                strategy={viewMode === 'grid' ? rectSortingStrategy : undefined}
              >
                <div className={clsx(
                  "gap-3",
                  viewMode === 'grid' ? "grid grid-cols-[repeat(auto-fill,minmax(90px,1fr))]" : "flex flex-col"
                )}>
                  {children.map(child => (
                    <SortableFileItem 
                      key={child.id}
                      child={child}
                      isGrid={viewMode === 'grid'}
                      activeEntityId={activeEntityId}
                      setActiveEntityId={setActiveEntityId}
                      editingEntity={editingEntity}
                      setEditingEntityId={setEditingEntityId}
                      renameEntity={renameEntity}
                      openContextMenu={openContextMenu}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          ) : (
            <div className={clsx(
              "gap-3",
              viewMode === 'grid' ? "grid grid-cols-[repeat(auto-fill,minmax(90px,1fr))]" : "flex flex-col"
            )}>
              {children.map(child => (
                <div
                  key={child.id}
                  className={clsx(
                    "group/item relative flex items-center gap-3 rounded-[var(--radius-medium)] cursor-pointer transition-all duration-300",
                    viewMode === 'grid' 
                      ? "flex-col p-3 bg-[var(--bone-5)] border border-[var(--bone-10)]" 
                      : "px-3 py-2 text-[var(--bone-60)]"
                  )}
                >
                  <div className={clsx(
                    "shrink-0",
                    viewMode === 'grid' ? "w-12 h-12 flex items-center justify-center bg-[var(--bone-10)] rounded-xl text-accent" : ""
                  )}>
                    {getIcon(child.type, viewMode === 'grid' ? "w-7 h-7" : "w-5 h-5 text-[var(--bone-60)]", child)}
                  </div>
                  <div className={clsx("min-w-0 flex-1", viewMode === 'grid' ? "text-center w-full" : "text-left")}>
                    <span className={clsx("font-medium truncate block", viewMode === 'grid' ? "text-[11px]" : "text-sm", "text-[var(--bone-60)]")}>
                      {child.title}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="h-full flex flex-col items-center justify-center gap-3 opacity-40">
            <Layout className="w-10 h-10 text-[var(--bone-20)]" />
            <p className="text-sm text-muted-foreground">No files found here</p>
          </div>
        )}
      </div>
    </section>
  );
}
