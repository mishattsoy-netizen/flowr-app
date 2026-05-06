"use client";

import { useStore } from '@/data/store';
import { X, Plus } from 'lucide-react';
import { useState } from 'react';

export function NewWorkspaceModal() {
  const { modal, closeModal, createWorkspace, setActiveWorkspaceId } = useStore();
  const [name, setName] = useState('');

  if (!modal || modal.kind !== 'newWorkspace') return null;

  const handleCreate = () => {
    if (!name.trim()) return;
    const id = createWorkspace({ name: name.trim(), type: 'personal' });
    setActiveWorkspaceId(id);
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
        className="popup-glass-big p-6 w-[380px]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-xl text-foreground">New workspace</h2>
          <button onClick={closeModal} className="btn-icon">
            <X strokeWidth={2} className="w-4 h-4" />
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
            className="font-ui w-full bg-transparent border border-[color:var(--bone-15)] rounded-[var(--radius-small)] px-3.5 py-2.5 text-sm text-foreground placeholder:text-[color:var(--dim-foreground)] focus:border-[color:var(--bone-60)] outline-none "
          />
          {name && (
            <button
              onClick={() => setName('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 btn-icon !w-7 !h-7"
            >
              <X strokeWidth={2} className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center justify-end gap-2">
          <button onClick={closeModal} className="btn-regular">
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


