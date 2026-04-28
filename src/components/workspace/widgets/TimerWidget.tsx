"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, RotateCcw, Plus, Minus } from 'lucide-react';

type TimerMode = 'pomodoro' | 'stopwatch';

interface TimerData {
  mode?: TimerMode;
  pomoDuration?: number; // minutes, default 25
  breakDuration?: number; // minutes, default 5
}

export function TimerWidget({ data, onUpdateData, isEditing }: { data?: TimerData; onUpdateData: (d: TimerData) => void; isEditing?: boolean }) {
  const mode = (data?.mode ?? 'pomodoro') as TimerMode;
  const pomoDuration = (data?.pomoDuration ?? 25) * 60;
  const breakDuration = (data?.breakDuration ?? 5) * 60;

  const [seconds, setSeconds] = useState(mode === 'pomodoro' ? pomoDuration : 0);
  const [isRunning, setIsRunning] = useState(false);
  const [sessions, setSessions] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  }, []);

  const notify = useCallback((msg: string) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Flowr Timer', { body: msg, icon: '/favicon.ico' });
    }
  }, []);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setSeconds(prev => {
          if (mode === 'pomodoro') {
            if (prev <= 1) {
              setIsRunning(false);
              setSessions(s => s + 1);
              notify('Pomodoro complete! Take a break.');
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
  }, [isRunning, mode, clearTimer, notify]);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    setIsRunning(false);
    setSeconds(mode === 'pomodoro' ? pomoDuration : 0);
  }, [pomoDuration, mode]);

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const reset = () => { setIsRunning(false); setSeconds(mode === 'pomodoro' ? pomoDuration : 0); };

  const switchMode = (m: TimerMode) => {
    setIsRunning(false);
    onUpdateData({ ...data, mode: m });
    setSeconds(m === 'pomodoro' ? pomoDuration : 0);
  };

  const progress = mode === 'pomodoro' ? (pomoDuration - seconds) / pomoDuration : 0;

  return (
    <section className="bg-sidebar border border-[var(--bone-3)] group/widget px-5 pb-5 pt-4 rounded-[var(--radius-big)] widget-shadow h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[15px] font-widget-header font-semibold text-muted-foreground group-hover/widget:text-foreground">Timer</h2>
        {sessions > 0 && (
          <span className="text-[10px] font-semibold text-[var(--bone-40)] tracking-wide">{sessions} session{sessions !== 1 ? 's' : ''} today</span>
        )}
      </div>

      <div className="flex gap-1 p-1 bg-[var(--bone-5)] rounded-[var(--radius-small)] mb-4">
        {(['pomodoro', 'stopwatch'] as TimerMode[]).map(m => (
          <button key={m} onClick={() => switchMode(m)}
            className={`flex-1 text-xs py-1.5 rounded-[3px] font-medium ${mode === m ? 'bg-[var(--bone-10)] text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
            {m === 'pomodoro' ? 'Pomodoro' : 'Stopwatch'}
          </button>
        ))}
      </div>

      {isEditing && mode === 'pomodoro' && (
        <div className="flex items-center justify-center gap-4 mb-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <button onClick={() => onUpdateData({ ...data, pomoDuration: Math.max(5, (data?.pomoDuration ?? 25) - 5) })} className="w-5 h-5 rounded flex items-center justify-center hover:bg-[var(--bone-10)]"><Minus className="w-3 h-3" /></button>
            <span className="w-8 text-center font-mono text-foreground">{data?.pomoDuration ?? 25}m</span>
            <button onClick={() => onUpdateData({ ...data, pomoDuration: Math.min(90, (data?.pomoDuration ?? 25) + 5) })} className="w-5 h-5 rounded flex items-center justify-center hover:bg-[var(--bone-10)]"><Plus className="w-3 h-3" /></button>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <div className="relative w-28 h-28 flex items-center justify-center">
          {mode === 'pomodoro' && (
            <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="44" fill="none" stroke="var(--bone-5)" strokeWidth="3" />
              <circle cx="50" cy="50" r="44" fill="none" stroke="var(--bone-100)" strokeWidth="3" strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 44}`} strokeDashoffset={`${2 * Math.PI * 44 * (1 - progress)}`} />
            </svg>
          )}
          <span className="text-2xl font-mono text-foreground font-semibold tracking-wider">{formatTime(seconds)}</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setIsRunning(p => !p)} className="w-10 h-10 rounded-full bg-[var(--bone-5)] flex items-center justify-center text-[var(--bone-60)] hover:text-foreground hover:bg-[var(--bone-10)]">
            {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>
          <button onClick={reset} className="w-10 h-10 rounded-full bg-[var(--bone-5)] flex items-center justify-center text-[var(--bone-60)] hover:text-foreground hover:bg-[var(--bone-10)]">
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>
    </section>
  );
}
