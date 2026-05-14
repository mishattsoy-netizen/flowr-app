"use client";

import { Image as ImageIcon, Eye, Plug, Wand2 } from 'lucide-react';
import { useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

interface ChatPlusMenuProps {
  onClose: () => void;
  onMediaClick: () => void;
  onContextToggle: () => void;
  contextEnabled: boolean;
  position?: { bottom: number; left: number };
}

const EXTENSION_STUBS = [
  'Gmail', 'Figma', 'GitHub', 'Telegram', 'Obsidian', 'Notion', 'TradingView',
];

export function ChatPlusMenu({ onClose, onMediaClick, onContextToggle, contextEnabled, position }: ChatPlusMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  const menu = (
    <div
      ref={ref}
      className="w-64 bg-[var(--color-panel)] border border-[var(--bone-12)] rounded-[var(--radius-regular)] shadow-2xl p-1.5 flex flex-col gap-0.5"
      style={position
        ? { position: 'fixed', bottom: position.bottom, left: position.left, zIndex: 150 }
        : { position: 'absolute', bottom: '100%', left: 0, marginBottom: '8px', zIndex: 50 }}
    >
      {/* Media upload */}
      <button
        onClick={() => { onMediaClick(); onClose(); }}
        className="flex items-center gap-3 px-3 py-1.5 rounded-[var(--radius-medium)] text-[13.5px] text-[var(--bone-70)] hover:bg-white/[0.08] hover:text-[var(--bone-100)] w-full text-left transition-none"
      >
        <ImageIcon className="w-4 h-4 shrink-0 opacity-60 group-hover:opacity-100" />
        <span className="font-semibold tracking-tight">Upload Media</span>
      </button>

      {/* Context toggle */}
      <button
        onClick={(e) => { e.stopPropagation(); onContextToggle(); }}
        className={cn(
          "flex items-center gap-3 px-3 py-1.5 rounded-[var(--radius-medium)] text-[13.5px] transition-none text-[var(--bone-70)] hover:bg-white/[0.08] hover:text-[var(--bone-100)] w-full text-left",
          contextEnabled && "text-[var(--bone-100)]"
        )}
      >
        <Eye className="w-4 h-4 shrink-0 opacity-60" strokeWidth={2} />
        <div className="flex flex-col items-start">
          <span className="font-bold">Context</span>
          <span className="text-[10px] opacity-30 leading-none mt-0.5">{contextEnabled ? 'On' : 'Off'}</span>
        </div>
        <div className={cn(
          'ml-auto w-7 h-4 rounded-full flex items-center transition-none',
          contextEnabled ? 'bg-[var(--brand-blue)] justify-end' : 'bg-white/10 justify-start'
        )}>
          <div className="w-3 h-3 rounded-full bg-white mx-0.5" />
        </div>
      </button>

      <div className="popup-divider" />

      {/* Extensions — stubs */}
      <div className="px-3 py-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--bone-30)] mb-2 opacity-80">Extensions</p>
        <div className="flex flex-wrap gap-1.5">
          {EXTENSION_STUBS.map(name => (
            <span
              key={name}
              className="px-2.5 py-1 rounded-full bg-white/[0.04] text-[10px] font-bold text-[var(--bone-40)] border border-[var(--bone-12)] cursor-not-allowed uppercase tracking-wider"
              title="Coming soon"
            >
              {name}
            </span>
          ))}
        </div>
        <p className="text-[10px] text-[var(--bone-20)] mt-2 italic opacity-40">Coming soon</p>
      </div>

      <div className="popup-divider" />

      {/* Design Mode — stub */}
      <div className="flex items-center gap-3 px-3 py-2 rounded-[var(--radius-medium)] text-[13.5px] text-[var(--bone-40)] cursor-not-allowed opacity-50">
        <Wand2 className="w-4 h-4 shrink-0" />
        <div className="flex flex-col">
          <p className="font-semibold text-[var(--bone-70)]">Design Mode</p>
          <p className="text-[10px] italic">Coming soon</p>
        </div>
      </div>
    </div>
  );

  return position ? createPortal(menu, document.body) : menu;
}
