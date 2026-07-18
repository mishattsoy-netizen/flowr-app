"use client";

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

export function WorkspaceDescriptionPopup({
  initialTitle,
  initialDescription,
  onSave,
  onCancel,
}: {
  initialTitle: string;
  initialDescription: string;
  onSave: (title: string, description: string) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription.slice(0, 500));
  const [saving, setSaving] = useState(false);
  const remaining = 500 - description.length;

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div
        className={cn(
          "relative w-full max-w-md rounded-[16px] p-4",
          "bg-[var(--app-panel)] border border-[var(--bone-12)] shadow-[0_16px_48px_rgba(0,0,0,0.4)]"
        )}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[15px] font-semibold text-[var(--bone-100)]">Workspace</h2>
          <button
            type="button"
            onClick={onCancel}
            className="w-7 h-7 flex items-center justify-center rounded-[8px] text-[var(--bone-40)] hover:text-[var(--bone-100)] border-none outline-none bg-transparent"
          >
            <X className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>
        <label className="block text-[12px] text-[var(--bone-50)] mb-1">Title</label>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="w-full mb-3 bg-[var(--bone-6)] rounded-md px-3 py-2 text-[13px] text-[var(--bone-100)] border-none outline-none"
        />
        <label className="block text-[12px] text-[var(--bone-50)] mb-1">Description</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value.slice(0, 500))}
          rows={5}
          className="w-full mb-1 bg-[var(--bone-6)] rounded-md px-3 py-2 text-[13px] text-[var(--bone-100)] border-none outline-none resize-none"
        />
        <p className={cn("text-[11px] mb-3 tabular-nums", remaining < 40 ? "text-amber-400" : "text-[var(--bone-40)]")}>
          {description.length} / 500
        </p>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="h-9 px-3 rounded-[10px] text-[13px] text-[var(--bone-60)] border-none outline-none bg-transparent hover:bg-[var(--bone-6)]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || !title.trim()}
            onClick={async () => {
              setSaving(true);
              try {
                await onSave(title.trim(), description);
              } finally {
                setSaving(false);
              }
            }}
            className="h-9 px-4 rounded-[10px] text-[13px] font-medium bg-[var(--brand-blue)] text-white border-none outline-none disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
