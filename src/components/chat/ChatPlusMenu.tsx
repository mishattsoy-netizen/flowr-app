"use client";

import { Image as ImageIcon, Eye, Plug, Wand2 } from 'lucide-react';
import { useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { Tooltip } from '@/components/layout/Tooltip';
import { Toggle } from '@/components/ui/Toggle';

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
      className="min-w-[200px] bg-[var(--color-panel)] border border-[var(--bone-12)] rounded-[var(--radius-regular)] overflow-hidden backdrop-blur-3xl shadow-2xl p-1.5 flex flex-col gap-0.5"
      style={position
        ? { position: 'fixed', bottom: position.bottom, left: position.left, zIndex: 150 }
        : { position: 'absolute', bottom: '100%', left: 0, marginBottom: '8px', zIndex: 50 }}
    >
      {/* Media upload */}
      <button
        onClick={() => { onMediaClick(); onClose(); }}
        className="w-full flex items-center gap-3 px-3 py-1.5 rounded-[var(--radius-medium)] text-[13.5px] transition-none text-[var(--bone-70)] hover:bg-white/[0.08] hover:text-bone-100"
      >
        <ImageIcon className="w-4 h-4 shrink-0 opacity-60" strokeWidth={2} />
        <span className="tracking-wide">Upload Media</span>
      </button>

      {/* Context toggle */}
      <button
        onClick={(e) => { e.stopPropagation(); onContextToggle(); }}
        className={cn(
          'w-full flex items-center gap-3 px-3 py-1.5 rounded-[var(--radius-medium)] text-[13.5px] transition-none text-[var(--bone-70)] hover:bg-white/[0.08] hover:text-bone-100',
          contextEnabled && 'text-bone-100'
        )}
      >
        <Eye className="w-4 h-4 shrink-0 opacity-60" strokeWidth={2} />
        <div className="flex flex-col items-start">
          <Tooltip content="Provides context from your current page">
            <span className="tracking-wide">Context</span>
          </Tooltip>
        </div>
        <Toggle
          size="sm"
          checked={contextEnabled}
          onChange={onContextToggle}
          className="ml-auto pointer-events-none"
        />
      </button>

      <div className="popup-divider" />

      {/* Extensions — stubs */}
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-3 px-3 py-1.5 rounded-[var(--radius-medium)] text-[13.5px] text-[var(--bone-40)] cursor-not-allowed opacity-50">
          <Plug className="w-4 h-4 shrink-0 opacity-60" strokeWidth={2} />
          <div className="flex flex-col">
            <p className="tracking-wide text-[var(--bone-70)]">Extensions</p>
            <p className="text-[12px] tracking-[0.06em] opacity-30 leading-none mt-0.5">Coming soon</p>
          </div>
        </div>
      </div>

      <div className="popup-divider" />

      {/* Design Mode — stub */}
      <div className="flex items-center gap-3 px-3 py-1.5 rounded-[var(--radius-medium)] text-[13.5px] text-[var(--bone-40)] cursor-not-allowed opacity-50">
        <Wand2 className="w-4 h-4 shrink-0 opacity-60" strokeWidth={2} />
        <div className="flex flex-col">
          <p className="tracking-wide text-[var(--bone-70)]">Design Mode</p>
          <p className="text-[12px] tracking-[0.06em] opacity-30 leading-none mt-0.5">Coming soon</p>
        </div>
      </div>
    </div>
  );

  return position ? createPortal(menu, document.body) : menu;
}
