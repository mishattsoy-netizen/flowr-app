"use client";

import { useStore } from '@/data/store';
import { X } from 'lucide-react';
import { useState } from 'react';

export function NewSpaceModal() {
  const { modal, closeModal, createSpace, addEntity, setActiveSpaceId } = useStore();
  const [name, setName] = useState('');

  if (!modal || modal.kind !== 'newWorkspace') return null;

  const handleCreate = () => {
    if (!name.trim()) return;

    // 1. Create the Space record in the spaces store
    const id = createSpace({ name: name.trim(), type: 'personal' });

    // 2. Create the corresponding workspace entity in the new space
    addEntity({
      id,
      title: name.trim(),
      type: 'workspace',
      parentId: null,
      lastModified: Date.now(),
      spaceId: id, // explicitly assign to the new space
    });

    // 3. Set the active space to the new one
    setActiveSpaceId(id);
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
        className="bg-panel border border-[var(--bone-6)] rounded-[1.25rem] p-5 w-[360px] "
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-foreground">New Space</h2>
          <button onClick={closeModal} className="p-1 rounded-full hover:bg-hover  text-muted-foreground hover:text-foreground">
            <X strokeWidth={2} className="w-4.5 h-4.5" />
          </button>
        </div>

        <div className="relative group mb-5">
          <input
            autoFocus
            type="text"
            placeholder="Space name"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full bg-transparent border border-[var(--bone-6)] rounded-full pl-3 pr-9 py-2 text-sm text-foreground placeholder-muted-foreground hover:bg-hover focus:bg-transparent focus:border-accent outline-none "
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

        <div className="flex justify-end gap-2">
          <button
            onClick={closeModal}
            className="px-4 py-2 text-sm font-medium text-foreground hover:bg-hover rounded-full transition-colors "
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!name.trim()}
            className="px-4 py-2 text-sm font-medium bg-accent text-accent-foreground hover:bg-accent/90 rounded-full transition-colors disabled:opacity-50 disabled:pointer-events-none "
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
