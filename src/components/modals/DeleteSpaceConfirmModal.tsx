"use client";

import { useStore } from '@/data/store';
import { AlertTriangle } from 'lucide-react';
import { useState } from 'react';

export function DeleteSpaceConfirmModal() {
  const { modal, spaces, closeModal, deleteSpace } = useStore();
  const [inputValue, setInputValue] = useState('');

  if (!modal || modal.kind !== 'deleteSpaceConfirm') return null;

  const space = spaces.find(w => w.id === modal.spaceId);
  if (!space) return null;

  const isMatch = inputValue === space.name;

  const handleDelete = () => {
    if (isMatch) {
      deleteSpace(space.id);
      closeModal();
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-overlay" onClick={closeModal}>
      <div
        className="bg-panel border border-[var(--bone-12)] rounded-[1.25rem] p-5 w-[420px]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-full bg-danger/10 flex-shrink-0">
            <AlertTriangle strokeWidth={2} className="w-4.5 h-4.5 text-danger" />
          </div>
          <h2 className="text-lg font-semibold text-foreground leading-tight">Delete Space "{space.name}"?</h2>
        </div>

        <p className="text-sm text-fade mb-4">
          This will permanently delete this space, including all its spaces, folders, notes, canvases, and chats. 
          <strong className="text-foreground block mt-2">This action cannot be undone.</strong>
        </p>

        <div className="mb-6">
          <label className="block text-xs font-semibold text-fade mb-1.5">
            Type <span className="text-foreground font-bold select-all">{space.name}</span> to confirm
          </label>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="w-full h-9 px-3 bg-dark border border-[var(--bone-12)] rounded-[var(--radius-medium)] text-sm text-foreground focus:outline-none focus:border-accent"
            placeholder={space.name}
            autoFocus
          />
        </div>

        <div className="flex justify-end gap-2 mt-2">
          <button
            onClick={closeModal}
            className="px-4 py-2 text-sm font-semibold text-fade hover:text-foreground hover:bg-[var(--app-dark)] rounded-full transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={!isMatch}
            className="px-4 py-2 text-sm font-semibold bg-danger text-white rounded-full hover:bg-danger/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Delete Space
          </button>
        </div>
      </div>
    </div>
  );
}
