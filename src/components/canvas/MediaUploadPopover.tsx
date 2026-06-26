"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, Link2, ClipboardPaste, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MediaUploadPopoverProps {
  position: { x: number; y: number };
  onConfirm: (url: string) => void;
  onClose: () => void;
}

export function MediaUploadPopover({ position, onConfirm, onClose }: MediaUploadPopoverProps) {
  const [mode, setMode] = useState<'menu' | 'url'>('menu');
  const [urlValue, setUrlValue] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [coords, setCoords] = useState({ x: position.x, y: position.y });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const w = r.width || 224; // 224px is w-56
    const h = r.height || 120;
    
    let x = position.x;
    let y = position.y;
    
    if (x + w > window.innerWidth) {
      x = Math.max(10, window.innerWidth - w - 10);
    }
    if (y + h > window.innerHeight) {
      y = Math.max(10, window.innerHeight - h - 10);
    }
    setCoords({ x, y });
  }, [position]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    
    // Delay adding the listener to prevent the same click from closing it
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClick);
    }, 10);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [onClose]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result) {
        onConfirm(reader.result as string);
      }
    };
    reader.readAsDataURL(file);
  }, [onConfirm]);

  const handlePaste = useCallback(async () => {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imageType = item.types.find(t => t.startsWith('image/'));
        if (imageType) {
          const blob = await item.getType(imageType);
          const reader = new FileReader();
          reader.onload = () => {
            if (reader.result) onConfirm(reader.result as string);
          };
          reader.readAsDataURL(blob);
          return;
        }
      }
      // Fallback: try reading text as URL
      const text = await navigator.clipboard.readText();
      if (text && (text.startsWith('http://') || text.startsWith('https://'))) {
        onConfirm(text);
      }
    } catch {
      // Clipboard API not available
    }
  }, [onConfirm]);

  const handleUrlSubmit = () => {
    if (urlValue.trim()) {
      onConfirm(urlValue.trim());
    }
  };

  return (
    <div
      ref={ref}
      className="fixed z-[6000] w-56 popup-glass-big p-1 canvas-floating-panel"
      style={{ left: coords.x, top: coords.y }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={handleFileUpload}
      />

      {mode === 'menu' ? (
        <div className="flex flex-col gap-0.5">
          <button
            onClick={() => fileRef.current?.click()}
            className="popup-item"
          >
            <Upload size={14} />
            <span>Upload file</span>
          </button>
          <button
            onClick={() => setMode('url')}
            className="popup-item"
          >
            <Link2 size={14} />
            <span>Paste URL</span>
          </button>
          <button
            onClick={handlePaste}
            className="popup-item"
          >
            <ClipboardPaste size={14} />
            <span>Paste from clipboard</span>
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2 p-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Paste URL</span>
            <button onClick={() => setMode('menu')} className="p-0.5 text-muted-foreground hover:text-foreground">
              <X size={12} />
            </button>
          </div>
          <input
            autoFocus
            type="url"
            placeholder="https://..."
            value={urlValue}
            onChange={(e) => setUrlValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleUrlSubmit(); }}
            className="w-full bg-background border border-border rounded-[var(--radius-small)] px-2 py-1.5 text-sm outline-none focus:border-accent"
          />
          <button
            onClick={handleUrlSubmit}
            disabled={!urlValue.trim()}
            className={cn(
              "w-full py-1.5 rounded-[var(--radius-small)] text-xs font-bold",
              urlValue.trim()
                ? "bg-accent/10 border border-accent/30 text-accent hover:bg-accent/20"
                : "bg-[var(--bone-6)] text-muted-foreground cursor-not-allowed"
            )}
          >
            Add Media
          </button>
        </div>
      )}
    </div>
  );
}

