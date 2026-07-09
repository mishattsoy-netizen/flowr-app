"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/lib/supabase';
import { useStore } from '@/data/store';
import { ChevronDown, Check } from 'lucide-react';

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
        className="w-full flex items-center justify-between bg-[var(--bone-6)] border border-transparent hover:border-[var(--bone-12)] focus:border-[var(--brand-blue)] focus:shadow-[0_0_0_0.5px_var(--brand-blue)] rounded-md px-3 py-2 text-[13px] text-[var(--bone-100)] focus:outline-none transition-colors"
      >
        <span className="truncate">{displayValue}</span>
        <ChevronDown className="w-4 h-4 text-[var(--bone-70)] shrink-0" />
      </button>
      
      {isOpen && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-[var(--app-panel)] border border-[var(--border-inner)] rounded-md shadow-[0_4px_12px_var(--popup-shadow-color)] max-h-64 overflow-y-auto py-1">
          <button
            type="button"
            onClick={() => { onChange(null); setIsOpen(false); }}
            className={`w-full text-left px-3 py-1.5 text-[13px] hover:bg-[var(--bone-6)] flex items-center justify-between ${!value ? 'text-[var(--brand-blue)] bg-[var(--bone-3)]' : 'text-[var(--bone-100)]'}`}
          >
            Automatic (Browser Default)
            {!value && <Check className="w-3.5 h-3.5" />}
          </button>
          {timezones.map(tz => (
            <button
              key={tz}
              type="button"
              onClick={() => { onChange(tz); setIsOpen(false); }}
              className={`w-full text-left px-3 py-1.5 text-[13px] hover:bg-[var(--bone-6)] flex items-center justify-between ${value === tz ? 'text-[var(--brand-blue)] bg-[var(--bone-3)]' : 'text-[var(--bone-100)]'}`}
            >
              <span className="truncate pr-2">{tz}</span>
              {value === tz && <Check className="w-3.5 h-3.5 shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AISettingsSection() {
  const { user } = useAuth();

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
        
        <TimezoneSelect 
          value={manualTimezone} 
          onChange={setManualTimezone} 
          timezones={timezones} 
        />
      </div>
    </div>
  );
}
