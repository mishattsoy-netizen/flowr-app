"use client";

import { useEffect, useRef, useState } from 'react';
import { ExternalLink, Copy, Trash, Check } from 'lucide-react';
import { createPortal } from 'react-dom';

interface LinkPreviewProps {
  url: string;
  rect: DOMRect;
  onClose: () => void;
  onRemove: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export function LinkPreview({ url, rect, onRemove, onMouseEnter, onMouseLeave }: LinkPreviewProps) {
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Immediate appearance
    if (containerRef.current) {
      containerRef.current.style.opacity = '1';
      containerRef.current.style.transform = 'translateY(0) scale(1)';
    }
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpen = () => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Position logic
  const isBrowser = typeof window !== 'undefined';
  const scrollY = isBrowser ? window.scrollY : 0;
  const scrollX = isBrowser ? window.scrollX : 0;
  const innerWidth = isBrowser ? window.innerWidth : 1000;

  const offset = 12;
  const top = rect.bottom + scrollY + offset;
  const left = rect.left + scrollX + (rect.width / 2) - 150;

  return createPortal(
    <div
      ref={containerRef}
      className="absolute z-[500] pointer-events-auto"
      style={{
        top: top - 10,
        left: Math.max(16, Math.min(innerWidth - 320 - 16, left)),
        paddingTop: '10px',
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="flex items-center gap-1.5 bg-panel border border-border/50 rounded-xl  p-1.5 min-w-[200px] max-w-[320px] ">
        <div 
          onClick={handleOpen}
          className="flex-1 flex items-center gap-2 px-2 py-1 h-7 text-xs text-muted-foreground hover:text-accent hover:bg-accent/10 rounded-lg cursor-pointer truncate mr-1 group"
        >
          <span className="truncate max-w-[140px]">{url}</span>
          <ExternalLink strokeWidth={2} className="w-3 h-3 flex-shrink-0 opacity-0 group-hover:opacity-100" />
        </div>

        <div className="flex gap-0.5 border-l border-border/50 pl-1.5">
          <button
            onClick={handleCopy}
                        className="p-1.5 rounded-lg hover:bg-hover text-muted-foreground hover:text-foreground"
          >
            {copied ? <Check strokeWidth={2} className="w-3.5 h-3.5 text-green-500" /> : <Copy strokeWidth={2} className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={onRemove}
                        className="p-1.5 rounded-lg hover:bg-danger/10 text-muted-foreground hover:text-danger"
          >
            <Trash strokeWidth={2} className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

