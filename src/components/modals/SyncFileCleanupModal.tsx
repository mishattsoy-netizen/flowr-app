"use client";

import { useState } from 'react';
import { useStore } from '@/data/store';
import { AlertTriangle } from 'lucide-react';
import { deleteVaultFile, markFilesKeptByUser } from '@/lib/syncFileScan';

export function SyncFileCleanupModal() {
  const { modal, closeModal } = useStore();
  const [pending, setPending] = useState(false);

  if (!modal || modal.kind !== 'syncFileCleanup') return null;

  const { files } = modal;

  const handleKeep = () => {
    markFilesKeptByUser(files);
    closeModal();
  };

  const handleDelete = async () => {
    setPending(true);
    try {
      await Promise.all(files.map(f => deleteVaultFile(f.path)));
    } catch (err) {
      console.error('[SyncFileCleanupModal] failed to delete file(s):', err);
    } finally {
      setPending(false);
      closeModal();
    }
  };

  const isBatch = files.length > 1;
  const title = isBatch
    ? `Found ${files.length} local file${files.length === 1 ? '' : 's'} out of sync`
    : `"${files[0].entityTitle}" is now cloud-only`;

  const description = isBatch
    ? `These items are cloud-only but still have local copies on disk. You can delete all of these local copies, or keep all of them as offline snapshots — they won't be flagged again.`
    : `A local copy of this file still exists on disk. You can delete it or keep it as an offline snapshot — it will not be updated while the item stays cloud-only, and you won't be asked about it again.`;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-overlay" onClick={closeModal}>
      <div
        className="bg-panel border border-[var(--bone-12)] rounded-[1.25rem] p-5 w-[420px]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-full bg-danger/10">
            <AlertTriangle strokeWidth={2} className="w-4.5 h-4.5 text-danger" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          {description}
        </p>

        {isBatch && (
          <ul className="mb-4 max-h-48 overflow-y-auto text-sm text-foreground space-y-1">
            {files.map(f => (
              <li key={f.path} className="truncate">
                {f.recognized ? f.entityTitle : `Unrecognized file: ${f.path.split('/').pop()}`}
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center justify-end gap-3">
          <button
            disabled={pending}
            onClick={handleKeep}
            className="px-4 py-2 border border-[var(--bone-6)] text-sm rounded-full text-muted-foreground hover:text-foreground hover:bg-hover disabled:opacity-50"
          >
            Keep local {isBatch ? 'copies' : 'copy'}
          </button>
          <button
            disabled={pending}
            onClick={handleDelete}
            className="px-4 py-2 text-sm rounded-full bg-danger hover:bg-danger/80 text-white font-medium disabled:opacity-50"
          >
            Delete local {isBatch ? 'copies' : 'copy'}
          </button>
        </div>
      </div>
    </div>
  );
}
