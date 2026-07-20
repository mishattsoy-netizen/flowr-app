"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { createClient } from '@/utils/supabase/client';
import { useStore } from '@/data/store';
import type { BotMode } from '@/data/store.types';
import { ChevronDown, Check, ChevronRight, Brain } from 'lucide-react';
import { cn } from '@/lib/utils';
import { saveTimezone, saveAiPrefs } from '@/app/settings/actions';
import {
  STYLE_OPTIONS,
  LANGUAGE_OPTIONS,
  normalizeResponseStyle,
  normalizeReplyLanguage,
  type ResponseStyle,
} from '@/lib/ai-prefs';

const MODE_OPTIONS: { key: BotMode; label: string }[] = [
  { key: 'default', label: 'Regular' },
  { key: 'pro', label: 'Max' },
];

function PrefSelect<T extends string>({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { key: T; label: string }[];
  placeholder?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const display = options.find(o => o.key === value)?.label ?? placeholder ?? value;

  return (
    <div className="relative w-full max-w-[220px]" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between bg-[var(--bone-6)] border border-transparent hover:border-[var(--bone-12)] focus:border-[var(--brand-blue)] focus:shadow-[0_0_0_0.5px_var(--brand-blue)] rounded-md px-3 py-1.5 text-[13px] text-[var(--bone-100)] focus:outline-none transition-colors"
      >
        <span className="truncate">{display}</span>
        <ChevronDown className="w-4 h-4 text-[var(--bone-70)] shrink-0" />
      </button>
      {isOpen && (
        <div className="absolute z-[300] top-full left-0 right-0 mt-1 popup-glass-small min-w-full flex flex-col gap-[2px] max-h-64 overflow-y-auto">
          {options.map(opt => (
            <button
              key={opt.key}
              type="button"
              onClick={() => { onChange(opt.key); setIsOpen(false); }}
              className={cn(
                "popup-item group w-full flex items-center justify-between gap-2",
                value === opt.key && "text-[var(--bone-100)] bg-[var(--app-dark)]"
              )}
            >
              <span className="truncate">{opt.label}</span>
              {value === opt.key && <Check className="w-3.5 h-3.5 shrink-0 opacity-70" strokeWidth={2} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TimezoneSelect({ value, onChange, timezones }: { value: string | null; onChange: (v: string | null) => void; timezones: string[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const displayValue = value || 'Automatic (Browser Default)';

  return (
    <div className="relative w-full max-w-sm" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between bg-[var(--bone-6)] border border-transparent hover:border-[var(--bone-12)] focus:border-[var(--brand-blue)] focus:shadow-[0_0_0_0.5px_var(--brand-blue)] rounded-md px-3 py-1.5 text-[13px] text-[var(--bone-100)] focus:outline-none transition-colors"
      >
        <span className="truncate">{displayValue}</span>
        <ChevronDown className="w-4 h-4 text-[var(--bone-70)] shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute z-[300] top-full left-0 right-0 mt-1 popup-glass-small min-w-full flex flex-col gap-[2px] max-h-64 overflow-y-auto">
          <button
            type="button"
            onClick={() => { onChange(null); setIsOpen(false); }}
            className={cn(
              "popup-item group w-full flex items-center justify-between gap-2",
              !value && "text-[var(--bone-100)] bg-[var(--app-dark)]"
            )}
          >
            <span className="truncate">Automatic (Browser Default)</span>
            {!value && <Check className="w-3.5 h-3.5 shrink-0 opacity-70" strokeWidth={2} />}
          </button>
          {timezones.map(tz => (
            <button
              key={tz}
              type="button"
              onClick={() => { onChange(tz); setIsOpen(false); }}
              className={cn(
                "popup-item group w-full flex items-center justify-between gap-2",
                value === tz && "text-[var(--bone-100)] bg-[var(--app-dark)]"
              )}
            >
              <span className="truncate">{tz}</span>
              {value === tz && <Check className="w-3.5 h-3.5 shrink-0 opacity-70" strokeWidth={2} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PrefRow({
  label,
  helper,
  children,
  last,
}: {
  label: string;
  helper?: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div className={cn(
      "flex items-center justify-between gap-4 py-3",
      !last && "border-b border-[var(--bone-6)]"
    )}>
      <div className="min-w-0 pr-3">
        <h4 className="text-[14px] font-medium text-[var(--bone-100)]">{label}</h4>
        {helper && (
          <p className="text-[12px] text-[var(--bone-60)] mt-0.5">{helper}</p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export default function AISettingsSection() {
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  const {
    manualTimezone,
    setManualTimezone,
    responseStyle,
    setResponseStyle,
    replyLanguage,
    setReplyLanguage,
    activeMode,
    setActiveMode,
    setActiveEntityId,
    closeModal,
  } = useStore();

  const timezones = useMemo(() => {
    try {
      return Intl.supportedValuesOf('timeZone');
    } catch {
      return [
        'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
        'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Moscow',
        'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Kolkata', 'Australia/Sydney', 'UTC'
      ];
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('user_settings')
        .select('timezone, response_style, reply_language')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data?.timezone) setManualTimezone(data.timezone);
      if (data?.response_style != null) setResponseStyle(normalizeResponseStyle(data.response_style));
      if (data?.reply_language != null) setReplyLanguage(normalizeReplyLanguage(data.reply_language));
    })();
  }, [user, setManualTimezone, setResponseStyle, setReplyLanguage, supabase]);

  const getAccessToken = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    return sessionData.session?.access_token ?? null;
  }, [supabase]);

  const handleTimezoneChange = useCallback(async (tz: string | null) => {
    setManualTimezone(tz);
    if (!user) return;
    const token = await getAccessToken();
    if (!token) return;
    await saveTimezone(token, tz);
  }, [user, setManualTimezone, getAccessToken]);

  const handleStyleChange = useCallback(async (style: ResponseStyle) => {
    setResponseStyle(style);
    if (!user) return;
    const token = await getAccessToken();
    if (!token) return;
    await saveAiPrefs(token, { responseStyle: style });
  }, [user, setResponseStyle, getAccessToken]);

  const handleLanguageChange = useCallback(async (lang: string) => {
    const normalized = normalizeReplyLanguage(lang);
    setReplyLanguage(normalized);
    if (!user) return;
    const token = await getAccessToken();
    if (!token) return;
    await saveAiPrefs(token, { replyLanguage: normalized });
  }, [user, setReplyLanguage, getAccessToken]);

  const modeIndex = activeMode === 'pro' ? 1 : 0;

  return (
    <div className="max-w-2xl pb-10">
      <div className="rounded-2xl bg-[var(--app-dark)] p-4 space-y-0">
        <PrefRow
          label="Default mode"
          helper="Used for new chats. You can still switch per conversation."
        >
          <div className="relative flex items-center p-[2px] bg-[var(--slider-track)] rounded-[8px] w-[180px]">
            <div
              className="absolute top-[2px] bottom-[2px] rounded-[6px] bg-[var(--slider-pill)] transition-all duration-300 ease-out shadow-[var(--slider-pill-shadow)]"
              style={{
                width: 'calc((100% - 4px) / 2)',
                left: `calc(2px + (${modeIndex} * (100% - 4px) / 2))`,
              }}
            />
            {MODE_OPTIONS.map(opt => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setActiveMode(opt.key)}
                className={cn(
                  "relative z-10 flex-1 px-2 py-1.5 rounded-[7px] text-[13px] font-medium transition-colors text-center",
                  activeMode === opt.key ? "text-bone-100" : "text-bone-70 hover:text-bone-100"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </PrefRow>

        <PrefRow
          label="Response style"
          helper="Soft default for how long and deep replies are."
        >
          <PrefSelect
            value={responseStyle}
            onChange={handleStyleChange}
            options={STYLE_OPTIONS}
          />
        </PrefRow>

        <PrefRow
          label="Language"
          helper="Default reply language. You can still switch mid-chat; new sessions use this again."
        >
          <PrefSelect
            value={replyLanguage}
            onChange={handleLanguageChange}
            options={LANGUAGE_OPTIONS}
          />
        </PrefRow>

        <PrefRow
          label="Timezone"
          helper="Locks the AI’s local time when you travel or use a VPN."
          last
        >
          <TimezoneSelect
            value={manualTimezone}
            onChange={handleTimezoneChange}
            timezones={timezones}
          />
        </PrefRow>
      </div>

      <button
        type="button"
        onClick={() => {
          closeModal();
          setActiveEntityId('brain');
        }}
        className={cn(
          "mt-6 flex items-center gap-3 w-full px-4 py-3 rounded-[14px] transition-all duration-200 cursor-pointer",
          "bg-white/5 hover:bg-white/10 border border-white/10 group/card text-left"
        )}
      >
        <div className="flex items-center text-bone-80 opacity-30 shrink-0 transition-all group-hover/card:opacity-80">
          <Brain strokeWidth={1.5} className="w-8 h-8" />
        </div>
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <p className="text-base font-serif font-medium tracking-tight text-bone-100 opacity-80 group-hover/card:opacity-100 transition-opacity truncate">
            Open Brain
          </p>
          <p className="text-xs text-[var(--bone-70)] truncate mt-0.5">
            Personal facts and memory live here.
          </p>
        </div>
        <ChevronRight strokeWidth={2} className="w-4 h-4 text-bone-30 shrink-0 opacity-0 group-hover/card:opacity-100 transition-opacity" />
      </button>
    </div>
  );
}
