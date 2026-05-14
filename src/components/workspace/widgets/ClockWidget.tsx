"use client";

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import type { WidgetProps } from './types';

type ClockStyle = 'simple' | 'datetime' | 'analog';

interface ClockData {
  style?: ClockStyle;
  hour12?: boolean;
  timezone?: string;
}

interface ClockWidgetProps extends WidgetProps {
  data?: ClockData;
}

const TIMEZONES = [
  { label: 'Local', value: '' },
  { label: 'UTC', value: 'UTC' },
  { label: 'New York', value: 'America/New_York' },
  { label: 'London', value: 'Europe/London' },
  { label: 'Paris', value: 'Europe/Paris' },
  { label: 'Dubai', value: 'Asia/Dubai' },
  { label: 'Singapore', value: 'Asia/Singapore' },
  { label: 'Tokyo', value: 'Asia/Tokyo' },
  { label: 'Sydney', value: 'Australia/Sydney' },
];

export function ClockWidget({ data, onUpdateData, isEditing }: ClockWidgetProps) {
  const [now, setNow] = useState(new Date());
  const style: ClockStyle = data?.style ?? 'simple';
  const hour12 = data?.hour12 ?? true;
  const timezone = data?.timezone ?? '';

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const fmtOpts = (extra: Intl.DateTimeFormatOptions = {}) => ({
    ...extra,
    ...(timezone ? { timeZone: timezone } : {}),
  });

  const timeStr = new Intl.DateTimeFormat('en-US', fmtOpts({ hour: 'numeric', minute: '2-digit', hour12 })).format(now);
  const dateStr = new Intl.DateTimeFormat('en-US', fmtOpts({ weekday: 'long', month: 'long', day: 'numeric' })).format(now);

  const hours = Number(new Intl.DateTimeFormat('en-US', fmtOpts({ hour: 'numeric', hour12: false })).format(now));
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();
  const hourAngle = ((hours % 12) + minutes / 60) * 30;
  const minuteAngle = (minutes + seconds / 60) * 6;
  const secondAngle = seconds * 6;

  const STYLES: { key: ClockStyle; label: string }[] = [
    { key: 'simple', label: 'Simple' },
    { key: 'datetime', label: 'Date' },
    { key: 'analog', label: 'Analog' },
  ];

  return (
    <section className="bg-sidebar group/widget rounded-[var(--radius-big)] widget-shadow h-full flex flex-col relative">
      {onUpdateData && isEditing && (
        <div className="absolute top-3 right-3 z-10 flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-0.5 bg-[var(--bone-6)] rounded-[var(--radius-small)] p-0.5">
            {STYLES.map((s) => (
              <button
                key={s.key}
                onClick={() => onUpdateData({ ...data, style: s.key })}
                className={cn(
                  'px-2.5 py-0.5 text-[10px] font-semibold rounded-[4px] transition-colors',
                  style === s.key
                    ? 'bg-[var(--bone-15)] text-[var(--bone-100)]'
                    : 'text-[var(--bone-30)] hover:text-[var(--bone-100)]'
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onUpdateData({ ...data, hour12: !hour12 })}
              className="px-2 py-0.5 text-[10px] font-semibold rounded-[4px] bg-[var(--bone-6)] text-[var(--bone-70)] hover:text-[var(--bone-100)] transition-colors"
            >
              {hour12 ? '12h' : '24h'}
            </button>
            <select
              value={timezone}
              onChange={(e) => onUpdateData({ ...data, timezone: e.target.value })}
              className="text-[10px] bg-[var(--bone-6)] border-none rounded-[4px] px-1.5 py-0.5 text-[var(--bone-70)] outline-none"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
      <div className="flex-1 flex flex-col items-center justify-center px-5 py-5">
        {style === 'simple' && (
           <p className="text-7xl font-display font-normal text-foreground tabular-nums" style={{ letterSpacing: '-0.03em' }}>{timeStr}</p>
        )}
        {style === 'datetime' && (
          <div className="text-center space-y-1.5">
             <p className="text-6xl font-display font-normal text-foreground tabular-nums" style={{ letterSpacing: '-0.03em' }}>{timeStr}</p>
            <p className="text-sm font-medium text-muted-foreground">{dateStr}</p>
          </div>
        )}
        {style === 'analog' && (
          <svg viewBox="0 0 100 100" className="w-32 h-32">
            <circle cx="50" cy="50" r="46" fill="none" stroke="var(--bone-10)" strokeWidth="1.5" />
            {[...Array(12)].map((_, i) => {
              const angle = i * 30;
              const r1 = 40;
              const r2 = i % 3 === 0 ? 43 : 42;
              const rad = (angle * Math.PI) / 180;
              return (
                <line
                  key={i}
                  x1={50 + r1 * Math.sin(rad)}
                  y1={50 - r1 * Math.cos(rad)}
                  x2={50 + r2 * Math.sin(rad)}
                  y2={50 - r2 * Math.cos(rad)}
                  stroke="var(--bone-30)"
                  strokeWidth={i % 3 === 0 ? 2 : 1}
                  strokeLinecap="round"
                />
              );
            })}
            <line
              x1="50"
              y1="50"
              x2={50 + 22 * Math.sin((hourAngle * Math.PI) / 180)}
              y2={50 - 22 * Math.cos((hourAngle * Math.PI) / 180)}
              stroke="var(--bone-100)"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <line
              x1="50"
              y1="50"
              x2={50 + 32 * Math.sin((minuteAngle * Math.PI) / 180)}
              y2={50 - 32 * Math.cos((minuteAngle * Math.PI) / 180)}
              stroke="var(--bone-70)"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <line
              x1="50"
              y1="50"
              x2={50 + 37 * Math.sin((secondAngle * Math.PI) / 180)}
              y2={50 - 37 * Math.cos((secondAngle * Math.PI) / 180)}
              stroke="color-mix(in srgb, var(--accent) 80%, transparent)"
              strokeWidth="0.8"
              strokeLinecap="round"
            />
            <circle cx="50" cy="50" r="2" fill="var(--bone-70)" />
          </svg>
        )}
      </div>
    </section>
  );
}
