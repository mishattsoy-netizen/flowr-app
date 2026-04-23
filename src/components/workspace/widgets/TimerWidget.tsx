"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';

type TimerMode = 'pomodoro' | 'stopwatch';

const POMODORO_DURATION = 25 * 60; // 25 minutes

export function TimerWidget({ data, onUpdateData }: { data?: any; onUpdateData: (newData: any) => void }) {
  const mode = (data?.mode || 'pomodoro') as TimerMode;
  const setMode = (m: TimerMode) => onUpdateData({ ...data, mode: m });

  const [seconds, setSeconds] = useState(mode === 'pomodoro' ? POMODORO_DURATION : 0);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setSeconds(prev => {
          if (mode === 'pomodoro') {
            if (prev <= 0) {
              setIsRunning(false);
              return 0;
            }
            return prev - 1;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      clearTimer();
    }
    return clearTimer;
  }, [isRunning, mode, clearTimer]);

  const formatTime = (s: number) => {
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const reset = () => {
    setIsRunning(false);
    setSeconds(mode === 'pomodoro' ? POMODORO_DURATION : 0);
  };

  const switchMode = (m: TimerMode) => {
    setIsRunning(false);
    setMode(m);
    setSeconds(m === 'pomodoro' ? POMODORO_DURATION : 0);
  };

  const progress = mode === 'pomodoro' ? (POMODORO_DURATION - seconds) / POMODORO_DURATION : 0;

  return (
    <section className="bg-sidebar border border-[var(--bone-10)] group/widget px-5 pb-5 pt-4 rounded-[var(--radius-big)] widget-shadow h-full flex flex-col">
      <h2 className="text-[15px] font-widget-header font-semibold text-muted-foreground group-hover/widget:text-foreground ">
        Timer
      </h2>

      {/* Mode toggle */}
      <div className="flex gap-1 p-1 bg-[var(--bone-5)] rounded-[var(--radius-small)] mb-4">
        {(['pomodoro', 'stopwatch'] as TimerMode[]).map(m => (
          <button
            key={m}
            onClick={() => switchMode(m)}
            className={`flex-1 text-xs py-1.5 rounded-[3px] font-medium ${
              mode === m 
                ? 'bg-[var(--bone-10)] text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-[var(--bone-5)]'
            }`}
          >
            {m === 'pomodoro' ? 'Pomodoro' : 'Stopwatch'}
          </button>
        ))}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <div className="relative w-28 h-28 flex items-center justify-center">
          {mode === 'pomodoro' && (
            <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="44" fill="none" stroke="var(--bone-5)" strokeWidth="3" />
              <circle
                cx="50" cy="50" r="44" fill="none"
                stroke="var(--bone-100)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 44}`}
                strokeDashoffset={`${2 * Math.PI * 44 * (1 - progress)}`}
                className=""
              />
            </svg>
          )}
          <span className="text-2xl font-mono text-foreground font-semibold tracking-wider">
            {formatTime(seconds)}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsRunning(prev => !prev)}
            className="w-10 h-10 rounded-full bg-[var(--bone-5)] flex items-center justify-center text-[var(--bone-60)] hover:text-foreground hover:bg-[var(--bone-10)] "
          >
            {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>
          <button
            onClick={reset}
            className="w-10 h-10 rounded-full bg-[var(--bone-5)] flex items-center justify-center text-[var(--bone-60)] hover:text-foreground hover:bg-[var(--bone-10)] "
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>
    </section>
  );
}
