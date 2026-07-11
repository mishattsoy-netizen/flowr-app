"use client";

import { useState } from 'react';
import { useStore } from '@/data/store';
import { getSyncModeCascade } from '@/data/store.helpers';
import { HardDrive } from 'lucide-react';

export function buildLocalOnlyConfirmText(entityCount: number, taskCount: number): string {
  return `This workspace and everything in it (${entityCount} item${entityCount === 1 ? '' : 's'}, ${taskCount} task${taskCount === 1 ? '' : 's'}) will be removed from the cloud in 24 hours and will only exist on this device. You can undo this by switching back to a cloud mode within 24 hours.`;
}

export function LocalOnlyConfirmModal() {
  const { modal, closeModal, setSyncMode, entities, tasks } = useStore();
  const [pending, setPending] = useState(false);

  if (!modal || modal.kind !== 'localOnlyConfirm') return null;

  const { workspaceId } = modal;
  const { entityIds, taskIds } = getSyncModeCascade(entities, tasks, workspaceId);

  const handleConfirm = async () => {
    setPending(true);
    try {
      await setSyncMode(workspaceId, 'local-only');
    } finally {
      setPending(false);
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
          <div className="p-2 rounded-full bg-emerald-500/10">
            <HardDrive strokeWidth={2} className="w-4.5 h-4.5 text-emerald-400" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">Switch to Local Only?</h2>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          {buildLocalOnlyConfirmText(entityIds.length, taskIds.length)}
        </p>

        <div className="flex items-center justify-end gap-3">
          <button
            disabled={pending}
            onClick={closeModal}
            className="px-4 py-2 border border-[var(--bone-6)] text-sm rounded-full text-muted-foreground hover:text-foreground hover:bg-hover disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            disabled={pending}
            onClick={handleConfirm}
            className="px-4 py-2 text-sm rounded-full bg-emerald-500 hover:bg-emerald-500/80 text-white font-medium disabled:opacity-50"
          >
            Switch to Local Only
          </button>
        </div>
      </div>
    </div>
  );
}
