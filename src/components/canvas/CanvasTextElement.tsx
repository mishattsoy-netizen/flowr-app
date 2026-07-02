"use client";
import React, { useLayoutEffect, useRef } from 'react';
import { useStore, type EditorBlock } from '@/data/store';
import { cn } from '@/lib/utils';

export const TEXT_FONT_FAMILY = 'inherit'; // app font
export const DEFAULT_FONT_SIZE = 20;
export const LINE_HEIGHT = 1.25;

let measurer: HTMLDivElement | null = null;
export function measureTextSize(text: string, fontSize: number): { width: number; height: number } {
  if (typeof document === 'undefined') {
    const lines = text.split('\n');
    return { width: Math.max(...lines.map(l => l.length), 1) * fontSize * 0.6, height: lines.length * fontSize * LINE_HEIGHT };
  }
  if (!measurer) {
    measurer = document.createElement('div');
    measurer.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;left:-9999px;top:-9999px;';
    // Match the app's base font exactly (mirrors the textarea's fontFamily:'inherit'), so
    // measured width doesn't drift from what actually renders on canvas.
    measurer.style.fontFamily = getComputedStyle(document.body).fontFamily;
    document.body.appendChild(measurer);
  }
  measurer.style.fontSize = `${fontSize}px`;
  measurer.style.lineHeight = String(LINE_HEIGHT);
  measurer.textContent = text || ' ';
  const rect = measurer.getBoundingClientRect();
  // Extra right-side padding (beyond the +2 fudge) so the blinking caret after the last
  // character has room and isn't clipped by the textarea's overflow-hidden edge.
  return { width: Math.max(rect.width + 2 + fontSize * 0.15, fontSize * 0.6), height: Math.max(rect.height, fontSize * LINE_HEIGHT) };
}

interface Props {
  block: EditorBlock;
  isEditing: boolean;
  onStartEdit: () => void;
  onEndEdit: () => void;
}

export function CanvasTextElement({ block, isEditing, onStartEdit, onEndEdit }: Props) {
  const updateCanvasBlock = useStore(s => s.updateCanvasBlock);
  const deleteCanvasBlock = useStore(s => s.deleteCanvasBlock);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fontSize = block.fontSize ?? DEFAULT_FONT_SIZE;
  const color = block.canvasStyleExt?.stroke || 'var(--bone-90)';
  const align = block.textAlign ?? 'left';

  // Keep block dimensions synced to content (auto-size).
  useLayoutEffect(() => {
    const { width, height } = measureTextSize(block.content ?? '', fontSize);
    if (Math.abs((block.width ?? 0) - width) > 0.5 || Math.abs((block.height ?? 0) - height) > 0.5) {
      updateCanvasBlock(block.id, { width, height });
    }
  }, [block.content, fontSize]); // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    if (isEditing) {
      taRef.current?.focus();
      taRef.current?.setSelectionRange(taRef.current.value.length, taRef.current.value.length);
    }
  }, [isEditing]);

  const styleCommon: React.CSSProperties = {
    fontSize, lineHeight: LINE_HEIGHT, color, textAlign: align,
    fontFamily: TEXT_FONT_FAMILY, whiteSpace: 'pre', width: '100%', height: '100%',
  };

  if (isEditing) {
    return (
      <textarea
        ref={taRef}
        className="bg-transparent outline-none resize-none overflow-hidden block caret-[var(--brand-blue)] p-0 m-0 border-0 box-border"
        style={styleCommon}
        value={block.content}
        onChange={e => updateCanvasBlock(block.id, { content: e.target.value })}
        onBlur={() => {
          if (!(block.content ?? '').trim()) deleteCanvasBlock(block.id);
          onEndEdit();
        }}
        onKeyDown={e => {
          if (e.key === 'Escape') { e.stopPropagation(); (e.target as HTMLTextAreaElement).blur(); }
        }}
        onPointerDown={e => e.stopPropagation()}
      />
    );
  }
  return (
    <div className={cn("select-none")} style={styleCommon} onDoubleClick={onStartEdit}>
      {block.content}
    </div>
  );
}
