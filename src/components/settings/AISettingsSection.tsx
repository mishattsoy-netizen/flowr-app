"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/lib/supabase';
import { useStore } from '@/data/store';

export default function AISettingsSection() {
  const { user } = useAuth();

  // About Me state
  const [description, setDescription] = useState('');
  const [savedDescription, setSavedDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');

  const { manualTimezone, setManualTimezone } = useStore();

  const timezones = useMemo(() => {
    try {
      return Intl.supportedValuesOf('timeZone');
    } catch (e) {
      return [
        'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
        'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Moscow',
        'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Kolkata', 'Australia/Sydney', 'UTC'
      ];
    }
  }, []);

  useEffect(() => {
    const userId = user?.id;
    if (!userId) {
      setIsLoading(false);
      return;
    }
    
    async function loadBio() {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'ai_user_description')
          .eq('owner_id', userId)
          .maybeSingle();

        if (error) throw error;
        const userText = (data?.value as { description?: string })?.description ?? '';
        setDescription(userText);
        setSavedDescription(userText);
      } catch (err) {
        console.error('[AISettingsSection] Failed to load bio:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadBio();
  }, [user?.id]);

  const handleSave = useCallback(async () => {
    if (!user?.id) return;
    setIsSaving(true);
    setSaveStatus('idle');
    const { error } = await supabase
      .from('settings')
      .upsert({
        key: 'ai_user_description',
        value: { description, updated_at: new Date().toISOString() },
        owner_id: user.id,
        updated_at: new Date().toISOString()
      }, { onConflict: 'owner_id,key' });

    if (!error) {
      setSavedDescription(description);
      setSaveStatus('saved');
    } else {
      console.error('[AISettingsSection] Failed to save bio:', error);
      setSaveStatus('error');
    }
    setIsSaving(false);
  }, [user?.id, description]);

  const hasChanges = description !== savedDescription;

  return (
    <div className="space-y-12 max-w-2xl pb-10">

      {/* Timezone Section */}
      <div className="space-y-4">
        <div>
          <h4 className="text-sm font-semibold text-[var(--bone-100)]">AI Timezone Context</h4>
          <p className="text-xs text-[var(--bone-70)] mt-1">
            By default, the AI infers your timezone from your device. If you travel frequently or use a VPN, you can lock it to a specific timezone here.
          </p>
        </div>
        
        <select
          value={manualTimezone || ''}
          onChange={(e) => setManualTimezone(e.target.value || null)}
          className="w-full max-w-sm bg-[var(--color-bg)] border border-[var(--bone-10)] rounded-[var(--radius-medium)] px-3 py-2 text-sm text-[var(--bone-100)] focus:outline-none focus:ring-1 focus:ring-accent/40 focus:border-accent/40"
        >
          <option value="">Automatic (Browser Default)</option>
          {timezones.map(tz => (
            <option key={tz} value={tz}>{tz}</option>
          ))}
        </select>
      </div>

      <div className="h-px bg-[var(--bone-6)] w-full" />

      {/* About Me Section */}
      <div className="space-y-6">
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
    </div>
  );
}
