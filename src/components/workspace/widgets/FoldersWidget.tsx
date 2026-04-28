"use client";

import { Entity, useStore } from '@/data/store';
import { Folder, MoreHorizontal } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Tooltip } from '@/components/layout/Tooltip';
import clsx from 'clsx';

export function FoldersWidget({ entity }: { entity: Entity }) {
  const entities = useStore(state => state.entities);
  const setActiveEntityId = useStore(state => state.setActiveEntityId);
  const openContextMenu = useStore(state => state.openContextMenu);
  const activeEntityId = useStore(state => state.activeEntityId);
  const editingEntity = useStore(state => state.editingEntity);
  const renameEntity = useStore(state => state.renameEntity);
  const setEditingEntityId = useStore(state => state.setEditingEntityId);
  const contextMenu = useStore(state => state.contextMenu);
  const [tempTitle, setTempTitle] = useState('');

  const folders = useMemo(() => {
    return entities.filter(e => e.parentId === entity.id && (e.type === 'folder' || e.type === 'collection'));
  }, [entities, entity.id]);

  return (
    <section className="bg-sidebar border border-[var(--bone-3)] group/widget px-5 pb-5 pt-4 rounded-[var(--radius-big)] widget-shadow h-full flex flex-col">
      <h2 className="text-[15px] font-widget-header font-semibold text-muted-foreground group-hover/widget:text-foreground mb-4">
        Folders
      </h2>
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {folders.length > 0 ? (
          <div className="grid grid-cols-2 gap-2">
            {folders.map(folder => {
              const isEditing = editingEntity?.id === folder.id && editingEntity.source === 'sidebar';
              return (
                <div
                  key={folder.id}
                  onClick={() => !isEditing && setActiveEntityId(folder.id)}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setTempTitle(folder.title);
                    setEditingEntityId(folder.id, 'sidebar');
                  }}
                  className={clsx(
                    "group/item flex items-center gap-2.5 px-3 py-1.5 rounded-[var(--radius-medium)] cursor-pointer transition-all duration-200",
                    activeEntityId === folder.id ? "bg-[var(--bone-6)] text-[var(--bone-100)]" : "text-[var(--bone-60)] hover:text-[var(--bone-100)] hover:bg-[var(--bone-6)]"
                  )}
                  role="button"
                >
                  <Folder className="w-4 h-4 text-[var(--bone-60)] group-hover/item:text-[var(--bone-100)] shrink-0 " />
                  
                  {isEditing ? (
                    <input
                      autoFocus
                      type="text"
                      value={tempTitle}
                      onChange={e => setTempTitle(e.target.value)}
                      onBlur={() => {
                        if (tempTitle.trim() && tempTitle !== folder.title) {
                          renameEntity(folder.id, tempTitle.trim());
                        } else {
                          setEditingEntityId(null);
                        }
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                        if (e.key === 'Escape') setEditingEntityId(null);
                      }}
                      onClick={e => e.stopPropagation()}
                      className="bg-transparent border-none outline-none text-sm font-medium text-foreground w-full py-0 flex-1"
                    />
                  ) : (
                    <span className="text-sm font-medium text-fade flex-1 text-left">
                      {folder.title}
                    </span>
                  )}

                  {!isEditing && (
                    <Tooltip content="Options">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                          openContextMenu(folder.id, rect.right + 4, rect.top, 'sidebar');
                        }}
                        className={clsx(
                          "w-6 h-6 flex items-center justify-center rounded-[var(--radius-small)] transition-opacity duration-100",
                          contextMenu?.entityId === folder.id
                            ? "opacity-100 !text-[var(--bone-100)] !bg-[var(--bone-15)]"
                            : "opacity-0 group-hover/item:opacity-100 text-[var(--bone-30)] group-hover/item:text-[var(--bone-60)] hover:text-[var(--bone-100)] hover:bg-[var(--bone-6)]"
                        )}
                      >
                        <MoreHorizontal strokeWidth={2} className="w-3.5 h-3.5" />
                      </button>
                    </Tooltip>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="h-full flex items-center justify-center">
            <p className="text-sm text-muted-foreground">No folders.</p>
          </div>
        )}
      </div>
    </section>
  );
}

