"use client";

import { Entity, useStore } from '@/data/store';
import { useState, useSyncExternalStore } from 'react';
import { Plus, Pencil } from 'lucide-react';
import { getEntityIcon } from '@/data/icons';
import { IconPicker } from '@/components/layout/IconPicker';
import { Tooltip } from '@/components/layout/Tooltip';
import { BentoDashboard } from '@/components/bento/BentoDashboard';

/* ── Main page ── */
export function WorkspacePage({ entity }: { entity: Entity }) {
  const openModal = useStore(state => state.openModal);
  const editingEntity = useStore(state => state.editingEntity);
  const setEditingEntityId = useStore(state => state.setEditingEntityId);
  const renameEntity = useStore(state => state.renameEntity);

  const [tempTitle, setTempTitle] = useState(entity.title);
  const [iconPickerAnchor, setIconPickerAnchor] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  const isMounted = useSyncExternalStore(() => () => {}, () => true, () => false);

  /* ── Rename ── */
  const isEditing = editingEntity?.id === entity.id && editingEntity.source === 'view';

  const handleRename = () => {
    if (tempTitle.trim() && tempTitle !== entity.title) {
      renameEntity(entity.id, tempTitle.trim());
    } else {
      setEditingEntityId(null);
      setTempTitle(entity.title);
    }
  };

  if (!isMounted) return null;

  const title = (
    <div className="flex-1 min-w-0">
      <h1
        onDoubleClick={() => {
          setTempTitle(entity.title);
          setEditingEntityId(entity.id, 'view');
        }}
        className="group text-4xl font-display text-foreground mb-1 flex items-center gap-3"
      >
        <div 
          className="shrink-0 p-1 cursor-pointer hover:bg-hover rounded-xl transition-colors"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            setIconPickerAnchor({
              x: rect.left,
              y: rect.top,
              width: rect.width,
              height: rect.height
            });
          }}
        >
          {(() => { const Icon = getEntityIcon(entity.icon); return <Icon className="w-8 h-8 !text-accent" />; })()}
        </div>

        {isEditing ? (
          <input
            autoFocus
            type="text"
            value={tempTitle}
            onChange={e => setTempTitle(e.target.value)}
            onBlur={handleRename}
            onKeyDown={e => {
              if (e.key === 'Enter') handleRename();
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
                onClick={(e) => {
                  e.stopPropagation();
                  setTempTitle(entity.title);
                  setEditingEntityId(entity.id, 'view');
                }}
                className="ml-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-medium)] text-muted-foreground opacity-0 "
              >
                <Pencil className="h-4 w-4" />
              </button>
            </Tooltip>
          </>
        )}
      </h1>
    </div>
  );

  const actions = (
    <div className="flex items-center gap-3">
      <button
        onClick={() => openModal({ kind: 'newItem', parentId: entity.id })}
        className="btn-accent"
      >
        <Plus strokeWidth={2} className="w-4 h-4" />
        New Item
      </button>
    </div>
  );

  return (
    <>
      <BentoDashboard contextId={entity.id} title={title} actions={actions} />

      {/* Icon Picker */}
      {iconPickerAnchor && (
        <IconPicker
          entityId={entity.id}
          anchorRect={iconPickerAnchor}
          onClose={() => setIconPickerAnchor(null)}
        />
      )}
    </>
  );
}
