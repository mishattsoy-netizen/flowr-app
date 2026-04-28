"use client";

import { Entity, useStore, EntityType } from '@/data/store';
import { getEntityIcon } from '@/data/icons';
import { useState, useMemo, useEffect, useRef, useSyncExternalStore } from 'react';
import { LayoutGrid, Search, Folder, MoreHorizontal, FileText, Frame, Layers, X, ChevronDown, Pencil, Plus } from 'lucide-react';
import clsx from 'clsx';
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
    contextMenu
  } = useStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'oldest' | 'name-asc' | 'name-desc'>('recent');
  const [tempTitle, setTempTitle] = useState(entity.title);
  const tempTitleRef = useRef(entity.title);
  const [itemTempTitle, setItemTempTitle] = useState('');
  const [iconPickerAnchor, setIconPickerAnchor] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  const isMounted = useSyncExternalStore(() => () => {}, () => true, () => false);

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
        <header className="flex items-center justify-between mb-8 pb-6 border-b border-border">
          <div className="flex-1 min-w-0">
            <h1
              onDoubleClick={() => {
                setTempTitle(entity.title);
                tempTitleRef.current = entity.title;
                setEditingEntityId(entity.id, 'view');
              }}
              className="group text-4xl font-display text-foreground mb-1 flex items-center gap-3"
            >
              {(entity.type === 'collection' || entity.type === 'workspace') ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    setIconPickerAnchor({ x: rect.left, y: rect.top, width: rect.width, height: rect.height });
                  }}
                  className="shrink-0 p-1 rounded-[var(--radius-medium)] hover:bg-hover "
                  title="Change icon"
                >
                  {(() => { const Icon = getEntityIcon(entity.icon); return <Icon className="w-8 h-8 !text-accent" />; })()}
                </button>
              ) : (
                <Folder className="w-8 h-8 text-muted-foreground shrink-0" />
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
                  className="bg-transparent border-none p-0 outline-none w-full max-w-[500px] text-foreground inline-block font-display"
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
            <div className="flex items-center bg-background border border-border px-3 py-2 rounded-[var(--radius-medium)] text-sm group focus-within:border-accent ">
              <Search className="w-[15px] h-[15px] text-muted-foreground mr-2 group-focus-within:text-foreground shrink-0" />
              <input
                type="text"
                placeholder={`Search in ${entity.title}...`}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="bg-transparent outline-none text-foreground placeholder-muted-foreground w-full text-sm"
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
            <div className="relative group">
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as 'recent' | 'oldest' | 'name-asc' | 'name-desc')}
                className="appearance-none bg-sidebar border border-border rounded-[var(--radius-medium)] pl-5 pr-9 py-2 text-sm text-foreground outline-none "
              >
                <option value="recent">Recent</option>
                <option value="oldest">Oldest</option>
                <option value="name-asc">Name (A-Z)</option>
                <option value="name-desc">Name (Z-A)</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground group-hover:text-foreground " />
            </div>

            <button
              onClick={() => openModal({ kind: 'newItem', parentId: entity.id })}
              className="btn-accent px-4 py-2"
            >
              <Plus strokeWidth={2} className="w-4 h-4" />
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
          <div className="space-y-10 flex-1">

            {/* Folders Grid */}
            {folders.length > 0 && (
              <section className="bg-sidebar border border-border p-5 rounded-[var(--radius-medium)] widget-shadow">
                <h2 className="text-sm font-bold tracking-wider text-muted-foreground uppercase mb-4">Folders</h2>
                <div className="grid grid-cols-3 gap-3">
                  {folders.map(folder => (
                    <div
                      key={folder.id}
                      onClick={() => setActiveEntityId(folder.id)}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setItemTempTitle(folder.title);
                        setEditingEntityId(folder.id, 'view');
                      }}
                      className={clsx(
                        "group relative flex items-center gap-3 px-4 py-3 rounded-[var(--radius-medium)] border ",
                        (editingEntity?.id === folder.id && editingEntity.source === 'view') 
                          ? "border-accent bg-accent/5" 
                          : "border-transparent bg-transparent text-[var(--bone-60)] hover:text-foreground hover:bg-[var(--color-background)] hover:border-transparent"
                      )}
                    >
                      <Folder className="w-5 h-5 text-[var(--bone-30)] group-hover:text-accent shrink-0 " />
                      <div className="min-w-0 flex-1 pr-6">
                        {editingEntity?.id === folder.id && editingEntity.source === 'view' ? (
                          <input
                            autoFocus
                            type="text"
                            value={itemTempTitle}
                            onChange={e => setItemTempTitle(e.target.value)}
                            onBlur={() => handleItemRename(folder.id, folder.title)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleItemRename(folder.id, folder.title);
                              if (e.key === 'Escape') setEditingEntityId(null);
                            }}
                            onClick={e => e.stopPropagation()}
                            className="bg-transparent border-none outline-none text-sm font-medium text-foreground w-full"
                          />
                        ) : (
                          <p className="text-sm font-medium text-[var(--bone-60)] group-hover:text-[var(--bone-100)] truncate">{folder.title}</p>
                        )}
                      </div>

                      {!(editingEntity?.id === folder.id && editingEntity.source === 'view') && (
                        <Tooltip content="Options">
                          <button
                            onClick={(e) => handleOptionsClick(e, folder.id)}
                            className={clsx(
                              "absolute right-3 w-6 h-6 flex items-center justify-center rounded-[var(--radius-small)] transition-opacity duration-100",
                              contextMenu?.entityId === folder.id 
                                ? "opacity-100 !text-[var(--bone-100)] !bg-[var(--bone-15)]" 
                                : "opacity-0 group-hover:opacity-100 text-[var(--bone-30)] group-hover:text-[var(--bone-60)] hover:text-[var(--bone-100)] hover:bg-[var(--bone-6)]"
                            )}
                          >
                            <MoreHorizontal strokeWidth={2} className="w-4 h-4" />
                          </button>
                        </Tooltip>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Files List */}
            {files.length > 0 && (
              <section className="bg-sidebar border border-border p-5 rounded-[var(--radius-medium)] widget-shadow">
                <h2 className="text-sm font-bold tracking-wider text-muted-foreground uppercase mb-4">Files</h2>
                <div className="flex flex-col border border-border/50 rounded-[var(--radius-medium)] overflow-hidden bg-background/70 backdrop-blur-[16px]">
                  {files.map(file => (
                    <div
                      key={file.id}
                      onClick={() => setActiveEntityId(file.id)}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setItemTempTitle(file.title);
                        setEditingEntityId(file.id, 'view');
                      }}
                      className={clsx(
                        "group flex items-center justify-between px-4 py-2 rounded-[var(--radius-medium)] ",
                        (editingEntity?.id === file.id && editingEntity.source === 'view') 
                          ? "bg-accent/5 text-[var(--bone-100)]" 
                          : "text-[var(--bone-60)] hover:text-foreground hover:bg-[var(--color-background)] border-transparent hover:border-transparent"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {getIcon(file.type, "w-4 h-4 text-[var(--bone-30)] shrink-0 group-hover:text-[var(--bone-100)] ")}
                        {editingEntity?.id === file.id && editingEntity.source === 'view' ? (
                          <input
                            autoFocus
                            type="text"
                            value={itemTempTitle}
                            onChange={e => setItemTempTitle(e.target.value)}
                            onBlur={() => handleItemRename(file.id, file.title)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleItemRename(file.id, file.title);
                              if (e.key === 'Escape') setEditingEntityId(null);
                            }}
                            onClick={e => e.stopPropagation()}
                            className="bg-transparent border-none outline-none text-sm font-medium text-foreground w-full"
                          />
                        ) : (
                          <span className="text-sm font-medium text-foreground truncate">{file.title}</span>
                        )}
                      </div>

                      <div className="flex items-center gap-4 shrink-0">
                        {!(editingEntity?.id === file.id && editingEntity.source === 'view') && <span className="text-xs text-muted-foreground group-hover:text-foreground/70 ">{formatDateTime(file.lastModified)}</span>}

                        <button
                          onClick={(e) => handleOptionsClick(e, file.id)}
                          className={clsx(
                            "w-6 h-6 flex items-center justify-center rounded-[var(--radius-small)] transition-opacity duration-100",
                            contextMenu?.entityId === file.id
                              ? "opacity-100 !text-[var(--bone-100)] !bg-[var(--bone-15)]"
                              : "opacity-0 group-hover:opacity-100 text-[var(--bone-30)] hover:text-[var(--bone-100)] hover:bg-[var(--bone-6)]"
                          )}
                        >
                          <MoreHorizontal strokeWidth={2} className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

          </div>
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
    </div>
  );
}

