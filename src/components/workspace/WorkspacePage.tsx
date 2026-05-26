"use client";

import { Entity, useStore, generateId } from '@/data/store';
import { useState, useSyncExternalStore } from 'react';
import { Plus, Pencil, Folder, FileText, Frame, Layers } from 'lucide-react';
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
  const addEntity = useStore(state => state.addEntity);
  const setActiveEntityId = useStore(state => state.setActiveEntityId);

  const [tempTitle, setTempTitle] = useState(entity.title);
  const [iconPickerAnchor, setIconPickerAnchor] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [newItemPopupPos, setNewItemPopupPos] = useState<{ x: number; y: number } | null>(null);

  const isMounted = useSyncExternalStore(() => () => { }, () => true, () => false);

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
        className="group text-4xl font-display font-medium leading-none text-foreground mb-1 flex items-center gap-3"
      >
        <div
          className="shrink-0 w-10 h-10 flex items-center justify-center cursor-pointer hover:bg-hover rounded-xl transition-colors"
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
          {(() => { const Icon = getEntityIcon(entity.icon); return <Icon className="w-8 h-8 text-[var(--bone-100)]" />; })()}
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

      {newItemPopupPos && (
        <>
          <div className="fixed inset-0 z-[299]" onClick={() => setNewItemPopupPos(null)} />
          <div
            className="fixed z-[300] popup-glass-small min-w-[160px] p-1.5 flex flex-col gap-[3px]"
            style={{ left: newItemPopupPos.x, top: newItemPopupPos.y }}
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
    </>
  );
}
