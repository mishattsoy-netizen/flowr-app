"use client";

import { useState, useEffect } from 'react';
import clsx from 'clsx';

type ClockStyle = 'simple' | 'datetime' | 'analog';

interface ClockData {
  style?: ClockStyle;
}

interface Props {
  data?: ClockData;
  onUpdateData?: (d: ClockData) => void;
  isEditing?: boolean;
}

export function ClockWidget({ data, onUpdateData, isEditing }: Props) {
  const [now, setNow] = useState(new Date());
  const style: ClockStyle = data?.style ?? 'simple';

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const hours = now.getHours();
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();

  const timeStr = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(now);

  const dateStr = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(now);

  const hourAngle = ((hours % 12) + minutes / 60) * 30;
  const minuteAngle = (minutes + seconds / 60) * 6;
  const secondAngle = seconds * 6;

  const STYLES: { key: ClockStyle; label: string }[] = [
    { key: 'simple', label: 'Simple' },
    { key: 'datetime', label: 'Date' },
    { key: 'analog', label: 'Analog' },
  ];

  return (
    <section className="bg-sidebar border border-[var(--bone-10)] group/widget rounded-[var(--radius-big)] widget-shadow h-full flex flex-col relative">
      {onUpdateData && isEditing && (
        <div className="absolute top-3 right-3 z-10 flex items-center gap-0.5 bg-[var(--bone-6)] rounded-[var(--radius-small)] p-0.5">
          {STYLES.map(s => (
            <button
              key={s.key}
              onClick={() => onUpdateData({ ...data, style: s.key })}
              className={clsx(
                "px-2.5 py-0.5 text-[10px] font-semibold rounded-[4px] transition-colors",
                style === s.key
                  ? "bg-[var(--bone-15)] text-[var(--bone-100)]"
                  : "text-[var(--bone-30)] hover:text-[var(--bone-100)]"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center px-5 py-5">
        {style === 'simple' && (
          <p className="text-6xl font-display font-semibold  text-foreground tabular-nums">
            {timeStr}
          </p>
        )}

        {style === 'datetime' && (
          <div className="text-center space-y-1.5">
            <p className="text-5xl font-display font-semibold  text-foreground tabular-nums">
              {timeStr}
            </p>
            <p className="text-sm font-medium text-muted-foreground">{dateStr}</p>
          </div>
        )}

        {style === 'analog' && (
          <svg viewBox="0 0 100 100" className="w-32 h-32">
            <circle cx="50" cy="50" r="46" fill="none" stroke="var(--bone-10)" strokeWidth="1.5" />
            {[...Array(12)].map((_, i) => {
              const angle = i * 30;
              const r1 = 40, r2 = i % 3 === 0 ? 43 : 42;
              const rad = (angle * Math.PI) / 180;
              return (
                <line
                  key={i}
                  x1={50 + r1 * Math.sin(rad)} y1={50 - r1 * Math.cos(rad)}
                  x2={50 + r2 * Math.sin(rad)} y2={50 - r2 * Math.cos(rad)}
                  stroke="var(--bone-30)"
                  strokeWidth={i % 3 === 0 ? 2 : 1}
                  strokeLinecap="round"
                />
              );
            })}
            {/* Hour hand */}
            <line
              x1="50" y1="50"
              x2={50 + 22 * Math.sin((hourAngle * Math.PI) / 180)}
              y2={50 - 22 * Math.cos((hourAngle * Math.PI) / 180)}
              stroke="var(--bone-100)" strokeWidth="2.5" strokeLinecap="round"
            />
            {/* Minute hand */}
            <line
              x1="50" y1="50"
              x2={50 + 32 * Math.sin((minuteAngle * Math.PI) / 180)}
              y2={50 - 32 * Math.cos((minuteAngle * Math.PI) / 180)}
              stroke="var(--bone-60)" strokeWidth="1.5" strokeLinecap="round"
            />
            {/* Second hand */}
            <line
              x1="50" y1="50"
              x2={50 + 37 * Math.sin((secondAngle * Math.PI) / 180)}
              y2={50 - 37 * Math.cos((secondAngle * Math.PI) / 180)}
              stroke="color-mix(in srgb, var(--accent) 80%, transparent)" strokeWidth="0.8" strokeLinecap="round"
            />
            <circle cx="50" cy="50" r="2" fill="var(--bone-60)" />
          </svg>
        )}
      </div>
    </section>
  );
}
