"use client";

import { useStore } from '@/data/store';
import { X } from 'lucide-react';
import { useState } from 'react';

export function RenameModal() {
  const { modal, entities, closeModal, renameEntity } = useStore();
  
  const entity = modal?.kind === 'rename' ? entities.find(e => e.id === modal.entityId) : null;
  const [name, setName] = useState(entity?.title || '');

  if (!modal || modal.kind !== 'rename') return null;

  const handleRename = () => {
    if (!name.trim()) return;
    renameEntity(modal.entityId, name.trim());
    closeModal();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleRename();
    if (e.key === 'Escape') closeModal();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-overlay " onClick={closeModal}>
      <div
        className="bg-panel border border-border/50 rounded-[1.25rem] p-5 w-[360px] "
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-foreground">Rename</h2>
          <button onClick={closeModal} className="p-1 rounded-full hover:bg-hover  text-muted-foreground hover:text-foreground">
            <X strokeWidth={2} className="w-4.5 h-4.5" />
          </button>
        </div>

        <div className="relative group mb-5">
          <input
            autoFocus
            type="text"
            placeholder="Enter new name"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full bg-transparent border border-border/50 rounded-full pl-3 pr-9 py-2 text-sm text-foreground placeholder-muted-foreground hover:bg-hover focus:bg-transparent focus:border-accent outline-none "
          />
          {name && (
            <button 
              onClick={() => setName('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-hover text-muted-foreground hover:text-foreground "
            >
              <X strokeWidth={2} className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            onClick={closeModal}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            onClick={handleRename}
            disabled={!name.trim()}
            className="btn-accent"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}


