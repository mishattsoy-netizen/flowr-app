"use client";

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { saveAiUserDescription, getAiUserDescription } from '@/app/settings/ai/actions';

export default function AISettingsSection() {
  const { user } = useAuth();
  const [description, setDescription] = useState('');
  const [savedDescription, setSavedDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');

  useEffect(() => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    getAiUserDescription(user.id).then((val) => {
      const text = val ?? '';
      setDescription(text);
      setSavedDescription(text);
      setIsLoading(false);
    }).catch(() => {
      setIsLoading(false);
    });
  }, [user?.id]);

  const handleSave = useCallback(async () => {
    if (!user?.id) return;
    setIsSaving(true);
    setSaveStatus('idle');
    const result = await saveAiUserDescription(user.id, description);
    if (result.success) {
      setSavedDescription(description);
      setSaveStatus('saved');
    } else {
      setSaveStatus('error');
    }
    setIsSaving(false);
  }, [user?.id, description]);

  const hasChanges = description !== savedDescription;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h4 className="text-sm font-semibold text-[var(--bone-100)]">Tell me about yourself</h4>
        <p className="text-xs text-[var(--bone-70)] mt-1">
          Write a short summary about yourself — who you are, what you like, and what you do.
          The AI will use this to personalize its responses.
        </p>
      </div>

      <textarea
        value={description}
        onChange={(e) => { setDescription(e.target.value); setSaveStatus('idle'); }}
        placeholder="e.g. I'm a software engineer who loves hiking, photography, and reading sci-fi. I work at a startup building developer tools..."
        rows={8}
        disabled={isLoading}
        className="w-full bg-[var(--color-bg)] border border-[var(--bone-10)] rounded-[var(--radius-medium)] p-4 text-sm text-[var(--bone-100)] placeholder:text-[var(--bone-30)] resize-y focus:outline-none focus:ring-1 focus:ring-accent/40 focus:border-accent/40 disabled:opacity-50"
      />

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={isSaving || !hasChanges || isLoading || !user?.id}
          className="px-5 py-2 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>

        {saveStatus === 'saved' && (
          <span className="text-xs text-green-500 font-medium">Saved</span>
        )}
        {saveStatus === 'error' && (
          <span className="text-xs text-red-500 font-medium">Failed to save</span>
        )}

        {!hasChanges && savedDescription && saveStatus === 'idle' && (
          <span className="text-xs text-[var(--bone-40)]">No changes</span>
        )}
      </div>
    </div>
  );
}
