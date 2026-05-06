"use client";

import { memo, useState, useRef } from 'react';
import { Play, Pause, Trash2 } from 'lucide-react';
import clsx from 'clsx';

export const ChatAudioPlayer = memo(({ url, name, isPending = false, onRemove }: { url: string; name?: string; isPending?: boolean; onRemove?: () => void }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const formatTime = (time: number) => {
    if (!time || isNaN(time)) return "0:00";
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={clsx(
      "flex items-center gap-3 px-3 py-2 bg-[var(--bone-6)] rounded-[var(--radius-small)] min-w-[220px] max-w-full",
      isPending && "bg-transparent! border-none! py-0!"
    )}>
      <audio
        ref={audioRef}
        src={url}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onEnded={() => setIsPlaying(false)}
      />

      <button
        onClick={togglePlay}
        className="w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center shrink-0 hover:scale-105 active:scale-95 transition-all shadow-lg shadow-accent/20"
      >
        {isPlaying ? <Pause strokeWidth={2} className="w-3.5 h-3.5 fill-current" /> : <Play strokeWidth={2} className="w-3.5 h-3.5 fill-current ml-0.5" />}
      </button>

      <div className="flex-1 flex items-center gap-0.5 h-4 min-w-[100px]">
        {[...Array(24)].map((_, i) => {
          const progress = currentTime / (duration || 1);
          const isActive = progress > i / 24;
          return (
            <div
              key={i}
              className={clsx(
                "w-0.5 rounded-full transition-all duration-300",
                isActive ? "bg-accent" : "bg-white/10"
              )}
              style={{
                height: `${Math.max(20, 30 + Math.sin(i * 0.8) * 40 + (isPlaying ? Math.random() * 20 : 0))}%`
              }}
            />
          );
        })}
      </div>

      <div className="text-[10px] font-mono font-bold text-accent/60 w-8 text-right tabular-nums">
        {formatTime(isPlaying ? currentTime : (duration || currentTime))}
      </div>

      {isPending && onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="w-7 h-7 rounded-full bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white flex items-center justify-center transition-all ml-1"
        >
          <Trash2 strokeWidth={2} className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
});
ChatAudioPlayer.displayName = 'ChatAudioPlayer';
