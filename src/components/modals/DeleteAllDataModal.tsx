"use client";

import { useStore } from '@/data/store';
import { AlertTriangle, Trash2, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export function DeleteAllDataModal() {
  const { modal, spaces, closeModal, deleteAllSpaceData, activeSpaceId } = useStore();
  const [selectedSpaceId, setSelectedSpaceId] = useState<string>(activeSpaceId || spaces[0]?.id || '');
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!modal || modal.kind !== 'deleteAllDataConfirm') return null;

  const selectedSpace = spaces.find(s => s.id === selectedSpaceId);
  const isMatch = inputValue === selectedSpace?.name;

  const handleDelete = async () => {
    if (isMatch && selectedSpaceId) {
      setIsDeleting(true);
      await deleteAllSpaceData(selectedSpaceId);
      // Note: window.location.reload() is called inside deleteAllSpaceData
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
            <Trash2 strokeWidth={2} className="w-4.5 h-4.5 text-danger" />
          </div>
          <h2 className="text-lg font-semibold text-foreground leading-tight">Delete All Data</h2>
        </div>

        <p className="text-sm text-fade mb-4">
          This will permanently delete all tasks, notes, canvases, folders, chat sessions, shortcuts,
          and the space itself for the selected workspace.
          <strong className="text-foreground block mt-2">This action cannot be undone.</strong>
        </p>

        {/* Space Selector */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-fade mb-1.5">
            Select workspace to wipe
          </label>
          <div className="relative">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="w-full h-9 px-3 bg-dark border border-[var(--bone-12)] rounded-[var(--radius-medium)] text-sm text-foreground flex items-center justify-between"
            >
              <span>{selectedSpace?.name || 'Select a workspace'}</span>
              <ChevronDown strokeWidth={2} className={cn("w-3.5 h-3.5 text-fade transition-transform", isOpen && "rotate-180")} />
            </button>
            {isOpen && (
              <div className="absolute top-full mt-1 left-0 right-0 bg-panel border border-[var(--bone-12)] rounded-[var(--radius-medium)] shadow-lg z-10 overflow-hidden">
                {spaces.map(s => (
                  <button
                    key={s.id}
                    onClick={() => { setSelectedSpaceId(s.id); setIsOpen(false); setInputValue(''); }}
                    className={cn(
                      "w-full px-3 py-2 text-sm text-left transition-colors",
                      s.id === selectedSpaceId
                        ? "bg-accent/10 text-accent font-semibold"
                        : "text-fade hover:text-foreground hover:bg-[var(--bone-6)]"
                    )}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Type to confirm */}
        <div className="mb-6">
          <label className="block text-xs font-semibold text-fade mb-1.5">
            Type <span className="text-foreground font-bold select-all">{selectedSpace?.name}</span> to confirm
          </label>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="w-full h-9 px-3 bg-dark border border-[var(--bone-12)] rounded-[var(--radius-medium)] text-sm text-foreground focus:outline-none focus:border-danger/60"
            placeholder={selectedSpace?.name}
            autoFocus
          />
        </div>

        <div className="flex justify-end gap-2 mt-2">
          <button
            onClick={closeModal}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-semibold text-fade hover:text-foreground hover:bg-[var(--app-dark)] rounded-full transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={!isMatch || isDeleting}
            className="px-4 py-2 text-sm font-semibold bg-danger text-white rounded-full hover:bg-danger/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isDeleting ? (
              <>Deleting...</>
            ) : (
              <>
                <Trash2 strokeWidth={2} className="w-3.5 h-3.5" />
                Delete Everything
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
