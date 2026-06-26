"use client";

import { useState, useEffect, useRef } from 'react';
import {
  Bold, Italic, Underline, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, List,
  Heading1, Heading2, Heading3
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CanvasTextToolbarProps {
  blockRect: { x: number; y: number; width: number; height?: number };
  viewport: { x: number; y: number; scale: number };
  onClose: () => void;
}

type FormatAction = 'bold' | 'italic' | 'underline' | 'strikeThrough'
  | 'justifyLeft' | 'justifyCenter' | 'justifyRight'
  | 'insertUnorderedList'
  | 'formatBlock-h1' | 'formatBlock-h2' | 'formatBlock-h3';

const TOOLS: { action: FormatAction; icon: React.ReactNode; label: string }[] = [
  { action: 'bold',            icon: <Bold size={14} className="text-[var(--bone-100)]" />,          label: 'Bold' },
  { action: 'italic',          icon: <Italic size={14} className="text-[var(--bone-100)]" />,        label: 'Italic' },
  { action: 'underline',       icon: <Underline size={14} className="text-[var(--bone-100)]" />,     label: 'Underline' },
  { action: 'strikeThrough',   icon: <Strikethrough size={14} className="text-[var(--bone-100)]" />, label: 'Strikethrough' },
  { action: 'formatBlock-h1',  icon: <Heading1 size={14} className="text-[var(--bone-100)]" />,      label: 'Heading 1' },
  { action: 'formatBlock-h2',  icon: <Heading2 size={14} className="text-[var(--bone-100)]" />,      label: 'Heading 2' },
  { action: 'formatBlock-h3',  icon: <Heading3 size={14} className="text-[var(--bone-100)]" />,      label: 'Heading 3' },
  { action: 'justifyLeft',     icon: <AlignLeft size={14} className="text-[var(--bone-100)]" />,     label: 'Align Left' },
  { action: 'justifyCenter',   icon: <AlignCenter size={14} className="text-[var(--bone-100)]" />,   label: 'Align Center' },
  { action: 'justifyRight',    icon: <AlignRight size={14} className="text-[var(--bone-100)]" />,    label: 'Align Right' },
  { action: 'insertUnorderedList', icon: <List size={14} className="text-[var(--bone-100)]" />,      label: 'Bullet List' },
];

export function CanvasTextToolbar({ blockRect, viewport, onClose }: CanvasTextToolbarProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Position in screen-space above the block
  const screenX = blockRect.x * viewport.scale + viewport.x + (blockRect.width * viewport.scale) / 2;
  const screenY = blockRect.y * viewport.scale + viewport.y - 12;

  const [coords, setCoords] = useState({ x: screenX, y: screenY });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const w = r.width || 310;
    const h = r.height || 36;

    let x = screenX;
    let y = screenY;

    // Apply viewport bounds (accounting for transform: translate(-50%, -100%))
    const minX = w / 2 + 10;
    const maxX = window.innerWidth - w / 2 - 10;
    if (x < minX) x = minX;
    if (x > maxX) x = maxX;

    // Clamp Y: if too high, flip it below the text block
    const minY = h + 10;
    const maxY = window.innerHeight - 10;
    if (y < minY) {
      // Position below the text block if there is no space above
      const blockH = blockRect.height ?? 30;
      y = (blockRect.y + blockH) * viewport.scale + viewport.y + h + 12;
    }
    if (y > maxY) y = maxY;

    setCoords({ x, y });
  }, [screenX, screenY, blockRect, viewport.scale]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        // Don't close if clicking inside the editable block
        const target = e.target as HTMLElement;
        if (target.closest('[contenteditable]')) return;
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  const exec = (action: FormatAction) => {
    if (action.startsWith('formatBlock-')) {
      const tag = action.replace('formatBlock-', '');
      document.execCommand('formatBlock', false, `<${tag}>`);
    } else {
      document.execCommand(action, false);
    }
  };

  return (
    <div
      ref={ref}
      className="fixed z-[6000] flex items-center gap-0.5 px-1.5 py-1 bg-panel/95 border border-border/70 backdrop-blur-md rounded-[var(--radius-medium)] canvas-floating-panel"
      style={{
        left: coords.x,
        top: coords.y,
        transform: 'translate(-50%, -100%)',
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {TOOLS.map((tool, i) => (
        <button
          key={tool.action}
          onClick={() => exec(tool.action)}
          title={tool.label}
          className={cn(
            "group flex items-center justify-center w-7 h-7 rounded-[var(--radius-small)] ",
            "text-muted-foreground hover:text-foreground hover:bg-[var(--black-overlay)]"
          )}
        >
          <span className="opacity-70 group-hover:opacity-100">{tool.icon}</span>
        </button>
      ))}
    </div>
  );
}

