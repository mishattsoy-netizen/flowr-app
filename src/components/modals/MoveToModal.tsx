"use client";

import { useStore } from '@/data/store';
import { X } from 'lucide-react';
import { useState } from 'react';
import { PathPicker } from '../layout/PathPicker';

export function MoveToModal() {
  const { modal, entities, moveEntity, closeModal } = useStore();
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);

  if (!modal || modal.kind !== 'moveTo') return null;

  const entity = entities.find(e => e.id === modal.entityId);
  if (!entity) return null;

  const handleMove = () => {
    if (selectedTargetId !== null) {
      moveEntity(entity.id, selectedTargetId);
      closeModal();
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-overlay " onClick={closeModal}>
      <div
        className="popup-glass-big p-5 w-[380px] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-foreground">Move &ldquo;{entity.title}&rdquo;</h2>
          <button onClick={closeModal} className="p-1 rounded-full hover:bg-hover  text-muted-foreground hover:text-foreground">
            <X strokeWidth={2} className="w-4.5 h-4.5" />
          </button>
        </div>

        <div className="mb-6">
          <p className="text-sm text-muted-foreground mb-2">Select destination:</p>
          <PathPicker 
            selectedId={selectedTargetId} 
            onSelect={setSelectedTargetId} 
            excludeEntityId={entity.id} 
          />
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            onClick={closeModal}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            onClick={handleMove}
            disabled={selectedTargetId === null}
            className="btn-accent px-6 py-2"
          >
            Move here
          </button>
        </div>
      </div>
    </div>
  );
}


