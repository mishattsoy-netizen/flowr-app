"use client";

import { useStore, generateId } from '@/data/store';
import { X, Plus } from 'lucide-react';
import { useState } from 'react';

export function NewCollectionModal() {
  const { modal, closeModal, addEntity } = useStore();
  const [name, setName] = useState('');

  if (!modal || modal.kind !== 'newCollection') return null;

  const handleCreate = () => {
    if (!name.trim()) return;
    addEntity({
      id: generateId(),
      title: name.trim(),
      type: 'workspace',
      parentId: null,
      lastModified: Date.now(),
    });
    setName('');
    closeModal();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleCreate();
    if (e.key === 'Escape') closeModal();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-overlay " onClick={closeModal}>
      <div
        className="bg-panel border border-border/50 rounded-[1.25rem] p-5 w-[360px] "
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-foreground">New Workspace</h2>
          <button onClick={closeModal} className="p-1 rounded-full hover:bg-hover  text-muted-foreground hover:text-foreground">
            <X strokeWidth={2} className="w-4.5 h-4.5" />
          </button>
        </div>

        <div className="relative group mb-5">
          <input
            autoFocus
            type="text"
            placeholder="Workspace name"
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
            onClick={handleCreate}
            disabled={!name.trim()}
            className="btn-accent"
          >
            <Plus strokeWidth={2} className="w-4 h-4" />
            Create
          </button>
        </div>
      </div>
    </div>
  );
}


