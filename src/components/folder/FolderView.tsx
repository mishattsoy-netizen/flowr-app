"use client";

import { Entity, useStore, EntityType, generateId } from '@/data/store';
import { getEntityIcon } from '@/data/icons';
import { useState, useMemo, useEffect, useRef, useSyncExternalStore } from 'react';
import { LayoutGrid, Search, Folder, MoreHorizontal, FileText, Frame, Layers, X, ChevronDown, Pencil, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { IconPicker } from '@/components/layout/IconPicker';
import { Tooltip } from '@/components/layout/Tooltip';

interface FolderViewProps {
  entity: Entity;
}

export function FolderView({ entity }: FolderViewProps) {
  const {
    entities,
    setActiveEntityId,
    openContextMenu,
    openModal,
    editingEntity,
    setEditingEntityId,
    renameEntity,
    contextMenu,
    addEntity
  } = useStore();

  const [newItemPopupPos, setNewItemPopupPos] = useState<{ x: number; y: number } | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'oldest' | 'name-asc' | 'name-desc'>('recent');
  const [tempTitle, setTempTitle] = useState(entity.title);
  const tempTitleRef = useRef(entity.title);
  const [itemTempTitle, setItemTempTitle] = useState('');
  const [iconPickerAnchor, setIconPickerAnchor] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  const isMounted = useSyncExternalStore(() => () => { }, () => true, () => false);

  useEffect(() => {
    if (editingEntity?.id === entity.id && editingEntity.source === 'view') {
      setTempTitle(entity.title);
      tempTitleRef.current = entity.title;
    }
  }, [editingEntity, entity.id, entity.title]);

  const children = useMemo(() => {
    return entities.filter(e => e.parentId === entity.id);
  }, [entities, entity.id]);

  const filteredChildren = useMemo(() => {
    let result = children;
    if (searchQuery.trim()) {
      const lowerQ = searchQuery.toLowerCase();
      result = result.filter(e => e.title.toLowerCase().includes(lowerQ));
    }

    return result.sort((a, b) => {
      switch (sortBy) {
        case 'name-asc': return a.title.localeCompare(b.title);
        case 'name-desc': return b.title.localeCompare(a.title);
        case 'oldest': return a.lastModified - b.lastModified;
        case 'recent':
        default: return b.lastModified - a.lastModified;
      }
    });
  }, [children, searchQuery, sortBy]);

  const folders = filteredChildren.filter(e => e.type === 'folder' || e.type === 'collection' || e.type === 'workspace');
  const files = filteredChildren.filter(e => e.type !== 'folder' && e.type !== 'collection' && e.type !== 'workspace');

  const getIcon = (type: EntityType, cls: string) => {
    switch (type) {
      case 'canvas': return <Frame className={cls} />;
      case 'note': return <FileText className={cls} />;
      case 'mixed': return <Layers className={cls} />;
      case 'folder':
      case 'collection':
      case 'workspace': return <Folder className={cls} />;
      default: return <Frame className={cls} />;
    }
  };

  const formatDateTime = (ts: number) => {
    const d = new Date(ts);
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(d);
  };

  const handleOptionsClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    openContextMenu(id, rect.right - 180, rect.top + 20, 'view');
  };

  const handleMainRename = () => {
    const title = tempTitleRef.current.trim();
    if (title && title !== entity.title) {
      renameEntity(entity.id, title);
    } else {
      setEditingEntityId(null);
    }
  };

  const handleItemRename = (id: string, originalTitle: string) => {
    if (itemTempTitle.trim() && itemTempTitle !== originalTitle) {
      renameEntity(id, itemTempTitle.trim());
    } else {
      setEditingEntityId(null);
    }
  };

  if (!isMounted) return null;

  return (
    <div className="flex-1 overflow-y-auto px-10 py-8 flex flex-col h-full">
      <div className="max-w-5xl mx-auto w-full flex flex-col flex-1">

        {/* Header Section */}
        <header className="flex items-center justify-between mb-6">
          <div className="flex-1 min-w-0">
            <h1
              onDoubleClick={() => {
                setTempTitle(entity.title);
                tempTitleRef.current = entity.title;
                setEditingEntityId(entity.id, 'view');
              }}
              className="group text-4xl font-display font-medium leading-none text-foreground mb-1 flex items-center gap-3"
            >
              {(entity.type === 'collection' || entity.type === 'workspace') ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    setIconPickerAnchor({ x: rect.left, y: rect.top, width: rect.width, height: rect.height });
                  }}
                  className="shrink-0 w-10 h-10 flex items-center justify-center hover:bg-hover rounded-xl transition-colors"
                  title="Change icon"
                >
                  {(() => { const Icon = getEntityIcon(entity.icon); return <Icon className="w-8 h-8 text-[var(--bone-100)]" />; })()}
                </button>
              ) : (
                <div className="shrink-0 w-10 h-10 flex items-center justify-center hover:bg-hover rounded-xl transition-colors">
                  <Folder className="w-8 h-8 text-[var(--bone-100)] shrink-0" />
                </div>
              )}
              {editingEntity?.id === entity.id && editingEntity.source === 'view' ? (
                <input
                  autoFocus
                  type="text"
                  defaultValue={tempTitle}
                  onChange={e => {
                    setTempTitle(e.target.value);
                    tempTitleRef.current = e.target.value;
                  }}
                  onBlur={handleMainRename}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleMainRename();
                    if (e.key === 'Escape') {
                      setEditingEntityId(null);
                      setTempTitle(entity.title);
                    }
                  }}
                  className="bg-transparent border-none p-0 outline-none w-full max-w-[500px] text-foreground inline-block font-display leading-none"
                />
              ) : (
                <>
                  <span className="truncate">{entity.title}</span>
                  <Tooltip content="Rename">
                    <button
                      type="button"
                      aria-label="Rename item"
                      onClick={(e) => {
                        e.stopPropagation();
                        setTempTitle(entity.title);
                        tempTitleRef.current = entity.title;
                        setEditingEntityId(entity.id, 'view');
                      }}
                      className="ml-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-medium)] text-muted-foreground opacity-0 "
                    >
                      <Pencil strokeWidth={2} className="h-4 w-4" />
                    </button>
                  </Tooltip>
                </>
              )}
            </h1>
            <p className="text-muted-foreground text-sm font-medium">
              {children.length} total items
            </p>
          </div>

          <div className="flex items-center gap-4 ml-4">
            {/* Folder-specific search */}
            <div className="relative flex items-center bg-[var(--bone-5)] border border-[var(--bone-6)] px-2.5 h-7 rounded-[var(--radius-medium)] text-xs group focus-within:border-[var(--bone-20)] transition-all">
              <Search className="w-3.5 h-3.5 text-[var(--bone-30)] mr-2 group-focus-within:text-[var(--bone-70)] shrink-0 transition-colors" />
              <input
                type="text"
                placeholder={`Search in ${entity.title}...`}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="bg-transparent outline-none text-foreground placeholder-[var(--bone-20)] w-full text-xs"
              />
              {searchQuery && (
                <Tooltip content="Clear Search">
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 p-1 text-muted-foreground hover:text-foreground rounded-[var(--radius-medium)] "
                  >
                    <X strokeWidth={2} className="w-3 h-3" />
                  </button>
                </Tooltip>
              )}
            </div>

            {/* Sort Toggle */}
            <div className="relative group h-7">
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as 'recent' | 'oldest' | 'name-asc' | 'name-desc')}
                className="appearance-none bg-[var(--bone-5)] border border-[var(--bone-6)] rounded-[var(--radius-medium)] pl-3 pr-7 h-full text-xs text-[var(--bone-70)] hover:text-[var(--bone-100)] outline-none transition-all cursor-pointer"
              >
                <option value="recent">Recent</option>
                <option value="oldest">Oldest</option>
                <option value="name-asc">Name (A-Z)</option>
                <option value="name-desc">Name (Z-A)</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--bone-30)] group-hover:text-[var(--bone-70)] transition-colors" />
            </div>

            <button
              onMouseDown={(e) => {
                e.stopPropagation();
                const rect = e.currentTarget.getBoundingClientRect();
                setNewItemPopupPos({ x: rect.left - 60, y: rect.bottom + 4 });
              }}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-2 px-3 h-7 rounded-[var(--radius-medium)] text-xs font-bold bg-[var(--accent)] text-[var(--bone-100)] hover:opacity-90 transition-opacity border-none shadow-none"
            >
              <Plus strokeWidth={2} className="w-3.5 h-3.5" />
              New Item
            </button>
          </div>
        </header>

        {filteredChildren.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground text-sm">
            <LayoutGrid className="w-12 h-12 mb-4 opacity-20" />
            <p>No items inside this folder.</p>
          </div>
        ) : (
          <section className="bg-panel border border-[var(--bone-6)] p-5 rounded-[var(--radius-big)] widget-shadow flex-1">
            <div className="flex flex-col gap-1">
              {filteredChildren.map(item => {
                const isEditing = editingEntity?.id === item.id && editingEntity.source === 'view';

                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      if (!isEditing) {
                        setActiveEntityId(item.id);
                      }
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setItemTempTitle(item.title);
                      setEditingEntityId(item.id, 'view');
                    }}
                    className={cn(
                      "group flex items-center justify-between px-3 py-2 rounded-[10px] cursor-pointer transition-all",
                      isEditing
                        ? "bg-accent/5 text-[var(--bone-100)]"
                        : "text-[var(--bone-70)] hover:text-[var(--bone-100)] hover:bg-[var(--app-dark)]"
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      {getIcon(item.type, "w-4 h-4 text-[var(--bone-100)] opacity-30 shrink-0 group-hover:opacity-100 transition-opacity duration-200")}
                      {isEditing ? (
                        <input
                          autoFocus
                          type="text"
                          value={itemTempTitle}
                          onChange={e => setItemTempTitle(e.target.value)}
                          onBlur={() => handleItemRename(item.id, item.title)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleItemRename(item.id, item.title);
                            if (e.key === 'Escape') setEditingEntityId(null);
                          }}
                          onClick={e => e.stopPropagation()}
                          className="bg-transparent border-none outline-none text-sm font-medium text-foreground w-full py-0 flex-1"
                        />
                      ) : (
                        <span className="text-[13.8px] font-medium text-[var(--bone-100)] truncate">{item.title}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      {!isEditing && (
                        <span className="text-[11px] text-[var(--bone-30)] group-hover:text-[var(--bone-70)] transition-colors">
                          {formatDateTime(item.lastModified)}
                        </span>
                      )}

                      <button
                        onClick={(e) => handleOptionsClick(e, item.id)}
                        className={cn(
                          "btn-sidebar-utility opacity-0 group-hover:opacity-100 transition-all",
                          contextMenu?.entityId === item.id
                            ? "opacity-100 !text-[var(--bone-100)] !bg-[var(--app-dark)]"
                            : "opacity-0 group-hover:opacity-100 text-[var(--bone-30)] hover:text-[var(--bone-100)] hover:bg-[var(--app-dark)]"
                        )}
                      >
                        <MoreHorizontal strokeWidth={2} className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>

      {/* Icon Picker */}
      {iconPickerAnchor && (
        <IconPicker
          entityId={entity.id}
          anchorRect={iconPickerAnchor}
          onClose={() => setIconPickerAnchor(null)}
        />
      )}

      {newItemPopupPos && (
        <>
          <div className="fixed inset-0 z-[299]" onClick={() => setNewItemPopupPos(null)} />
          <div
            className="fixed z-[300] popup-glass-small min-w-[160px] p-1.5 flex flex-col gap-[3px]"
            style={{ left: newItemPopupPos.x, top: newItemPopupPos.y }}
          >
            {[
              { type: 'note' as const, label: 'Note', icon: FileText },
              { type: 'canvas' as const, label: 'Canvas', icon: Frame },
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
                  setActiveEntityId(newId);
                  setNewItemPopupPos(null);
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
}

