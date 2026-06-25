"use client";

import { useState, useRef, useLayoutEffect, useEffect } from 'react';
import { useStore, EditorBlock, CanvasStyleExt } from '@/data/store';
import { useDragState } from '@/lib/canvasDragState';
import { cn } from '@/lib/utils';
import { Toggle } from '../ui/Toggle';
import type { CanvasTool } from './CanvasToolbar';
import { ColorPickerPopover } from './ColorPickerPopover';
import { Eye, EyeOff } from 'lucide-react';
import { toPng } from 'html-to-image';

interface Props {
  selectedIds: Set<string>;
  canvasId: string;
  onAlignLeft: () => void;
  onAlignCenterH: () => void;
  onAlignRight: () => void;
  onAlignTop: () => void;
  onAlignCenterV: () => void;
  onAlignBottom: () => void;
  activeStyle: CanvasStyleExt;
  onChangeActiveStyle: (s: CanvasStyleExt) => void;
  canvasBgColor: string;
  onCanvasBgColorChange: (color: string) => void;
  canvasPattern: 'none' | 'grid' | 'dots';
  onCanvasPatternChange: (pattern: 'none' | 'grid' | 'dots') => void;
  canvasPatternOpacity: number;
  onCanvasPatternOpacityChange: (opacity: number) => void;
  canvasPatternColor: string;
  onCanvasPatternColorChange: (color: string) => void;
  activeTool: CanvasTool;
  selectedPointIndex?: number | null;
}


const PATTERN_ICONS: Record<'none' | 'grid' | 'dots', React.ReactNode> = {
  none: (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" className="flex-shrink-0">
      <circle cx="6" cy="6" r="4.5" />
      <line x1="3" y1="3" x2="9" y2="9" />
    </svg>
  ),
  grid: (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" className="flex-shrink-0">
      <path d="M1 4h10M1 8h10M4 1v10M8 1v10" />
    </svg>
  ),
  dots: (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" className="flex-shrink-0">
      <circle cx="2.5" cy="2.5" r="1" />
      <circle cx="6" cy="2.5" r="1" />
      <circle cx="9.5" cy="2.5" r="1" />
      <circle cx="2.5" cy="6" r="1" />
      <circle cx="6" cy="6" r="1" />
      <circle cx="9.5" cy="6" r="1" />
      <circle cx="2.5" cy="9.5" r="1" />
      <circle cx="6" cy="9.5" r="1" />
      <circle cx="9.5" cy="9.5" r="1" />
    </svg>
  )
};

function PanelSection({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="px-4 py-2.5 border-b border-[var(--bone-10)]">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-ui-label font-semibold tracking-wider text-[var(--bone-100)]">{title}</span>
        {action}
      </div>
      {children}
    </div>
  );
}

function PropRow({
  label,
  children,
  scrub,
}: {
  label: string;
  children: React.ReactNode;
  scrub?: {
    value: number;
    onChange: (v: number) => void;
    step?: number;
    min?: number;
  };
}) {
  return (
    <div className="flex items-center gap-2 min-h-[28px] mb-1 last:mb-0">
      {scrub ? (
        <span
          onPointerDown={(e) => {
            e.preventDefault();
            const startX = e.clientX;
            const startValue = scrub.value;
            const step = scrub.step ?? 1;
            const min = scrub.min;

            const handlePointerMove = (ev: PointerEvent) => {
              const dx = ev.clientX - startX;
              let newVal = startValue + dx * step;
              if (min !== undefined && newVal < min) {
                newVal = min;
              }
              newVal = step % 1 === 0 ? Math.round(newVal) : Math.round(newVal * 10) / 10;
              scrub.onChange(newVal);
            };

            const handlePointerUp = () => {
              document.removeEventListener('pointermove', handlePointerMove);
              document.removeEventListener('pointerup', handlePointerUp);
              document.body.style.cursor = '';
            };

            document.addEventListener('pointermove', handlePointerMove);
            document.addEventListener('pointerup', handlePointerUp);
            document.body.style.cursor = 'ew-resize';
          }}
          className="w-[44px] text-[11px] text-[var(--bone-30)] hover:text-[var(--bone-100)] active:text-[var(--brand-blue)] cursor-ew-resize select-none flex-shrink-0 transition-colors"
          title="Drag left/right to scrub value"
        >
          {label}
        </span>
      ) : (
        <span className="w-[44px] text-[11px] text-[var(--bone-30)] flex-shrink-0">{label}</span>
      )}
      <div className="flex-1 flex items-center gap-1">{children}</div>
    </div>
  );
}

interface SidebarInputProps {
  prefix: React.ReactNode;
  value: string | number;
  onChange: (v: string) => void;
  title?: string;
  scrub?: {
    value: number;
    onChange: (v: number) => void;
    step?: number;
    min?: number;
  };
}

function SidebarInput({ prefix, value, onChange, title, scrub }: SidebarInputProps) {
  const [isScrubbing, setIsScrubbing] = useState(false);

  return (
    <div 
      className={cn(
        "flex-1 min-w-0 h-7 rounded-[var(--radius-small)] flex items-center px-2 gap-1.5 transition-colors border border-transparent",
        isScrubbing 
          ? "bg-[var(--bone-10)]" 
          : "bg-[var(--bone-6)] hover:bg-[var(--app-dark)] focus-within:bg-[var(--bone-10)]"
      )}
      title={title}
    >
      {scrub ? (
        <div
          onPointerDown={(e) => {
            e.preventDefault();
            setIsScrubbing(true);
            const startX = e.clientX;
            const startValue = scrub.value;
            const step = scrub.step ?? 1;
            const min = scrub.min;

            const handlePointerMove = (ev: PointerEvent) => {
              const dx = ev.clientX - startX;
              let newVal = startValue + dx * step;
              if (min !== undefined && newVal < min) {
                newVal = min;
              }
              newVal = step % 1 === 0 ? Math.round(newVal) : Math.round(newVal * 10) / 10;
              scrub.onChange(newVal);
            };

            const handlePointerUp = () => {
              document.removeEventListener('pointermove', handlePointerMove);
              document.removeEventListener('pointerup', handlePointerUp);
              document.body.style.cursor = '';
              setIsScrubbing(false);
            };

            document.addEventListener('pointermove', handlePointerMove);
            document.addEventListener('pointerup', handlePointerUp);
            document.body.style.cursor = 'ew-resize';
          }}
          className="cursor-ew-resize select-none flex-shrink-0 text-[var(--bone-45)] hover:text-[var(--bone-100)] active:text-[var(--brand-blue)] flex items-center justify-center transition-colors"
          title="Drag to adjust"
        >
          {prefix}
        </div>
      ) : (
        <div className="flex-shrink-0 text-[var(--bone-45)] flex items-center justify-center select-none">
          {prefix}
        </div>
      )}
      <input
        className="w-full bg-transparent border-none outline-none text-[11px] text-[var(--bone-90)] focus:text-[var(--bone-100)] p-0 m-0"
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
}

function PillInput({ value, onChange }: { value: string | number; onChange: (v: string) => void }) {
  return (
    <input
      className="flex-1 w-0 h-7 min-w-0 bg-[var(--bone-6)] rounded-[var(--radius-small)] text-center text-[11px] text-[var(--bone-70)] border border-transparent hover:bg-[var(--app-dark)] focus:bg-[var(--bone-10)] outline-none focus:text-[var(--bone-100)] transition-none"
      value={value}
      onChange={e => onChange(e.target.value)}
    />
  );
}

function AlignBtn({ title, children, onClick }: { title: string; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="flex-1 h-7 rounded-[var(--radius-small)] flex items-center justify-center text-[var(--bone-60)] hover:bg-[var(--app-dark)] hover:text-[var(--bone-10)] transition-none"
    >
      {children}
    </button>
  );
}

/** Sliding-pill tab group — same behaviour as the nav slider */
function SliderGroup<T extends string>({
  options,
  value,
  onChange,
  renderLabel,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  renderLabel?: (v: T) => React.ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pillStyle, setPillStyle] = useState({ left: 3, width: 40 });

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const idx = options.indexOf(value);
    const buttons = container.querySelectorAll<HTMLButtonElement>('button');
    const btn = buttons[idx];
    if (!btn) return;
    const containerRect = container.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    setPillStyle({
      left: btnRect.left - containerRect.left,
      width: btnRect.width,
    });
  }, [value, options]);

  return (
    <div
      ref={containerRef}
      className="relative flex items-center p-[3px] rounded-[var(--radius-small)] w-full h-7"
      style={{ background: 'var(--slider-track)' }}
    >
      {/* Animated sliding pill */}
      <div
        className="absolute top-[3px] bottom-[3px] rounded-[5px] bg-[var(--slider-pill)] transition-all duration-250 ease-out pointer-events-none"
        style={{ left: pillStyle.left, width: pillStyle.width, boxShadow: 'var(--slider-pill-shadow)' }}
      />
      {options.map(opt => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={cn(
            'relative z-10 flex-1 h-full flex items-center justify-center gap-1 text-[10px] font-semibold rounded-[5px] transition-colors duration-200 cursor-pointer',
            value === opt
              ? 'text-[var(--bone-100)]'
              : 'text-[var(--bone-100)] opacity-60 hover:opacity-100'
          )}
        >
          {renderLabel ? renderLabel(opt) : opt}
        </button>
      ))}
    </div>
  );
}


export function CanvasStylePanel({
  selectedIds, canvasId,
  onAlignLeft, onAlignCenterH, onAlignRight,
  onAlignTop, onAlignCenterV, onAlignBottom,
  activeStyle, onChangeActiveStyle,
  canvasBgColor, onCanvasBgColorChange,
  canvasPattern, onCanvasPatternChange,
  canvasPatternOpacity, onCanvasPatternOpacityChange,
  canvasPatternColor, onCanvasPatternColorChange,
  activeTool,
  selectedPointIndex,
}: Props) {
  const blocks = useStore(s => s.blocks);
  const updateCanvasBlock = useStore(s => s.updateCanvasBlock);
  const [activePicker, setActivePicker] = useState<'bg' | 'pattern' | 'fill' | 'border' | null>(null);
  const outerRef = useRef<HTMLDivElement>(null);
  const [pickerTop, setPickerTop] = useState(0);
  const [hiddenColors, setHiddenColors] = useState<Record<string, boolean>>({});
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  function resolveCSSVar(name: string): string {
    if (typeof document === 'undefined') return '#000000';
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function makeScrub(initVal: number, onChange: (v: number) => void, step = 1, min = 0, max = 100) {
    return (e: React.PointerEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startVal = initVal;
      const onMove = (ev: PointerEvent) => {
        const dx = ev.clientX - startX;
        let newVal = Math.round((startVal + dx * 0.5) / step) * step;
        newVal = Math.min(max, Math.max(min, newVal));
        onChange(newVal);
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        document.body.style.cursor = '';
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      document.body.style.cursor = 'ew-resize';
    };
  }

  const togglePicker = (picker: 'bg' | 'pattern' | 'fill' | 'border', e: React.MouseEvent) => {
    e.stopPropagation();
    if (activePicker === picker) {
      setActivePicker(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      const outerRect = outerRef.current?.getBoundingClientRect();
      if (outerRect) {
        let topPos = rect.top - outerRect.top;
        const popoverHeight = 330;
        if (topPos + popoverHeight > outerRect.height) {
          topPos = Math.max(10, outerRect.height - popoverHeight - 10);
        }
        setPickerTop(topPos);
      }
      setActivePicker(picker);
    }
  };

  const selected = blocks.filter(b => selectedIds.has(b.id));
  const hasSelection = selected.length > 0;
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

  const isShapeTool = ['rect', 'ellipse', 'diamond', 'freedraw', 'line', 'arrow'].includes(activeTool);
  const showShapeCustomization = hasSelection || isShapeTool;

  // Debounced canvas preview capture
  useEffect(() => {
    if (showShapeCustomization) return;

    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    previewTimerRef.current = setTimeout(async () => {
      const el = document.getElementById('canvas-viewport-export');
      if (!el) return;
      try {
        const url = await toPng(el as HTMLElement, { pixelRatio: 0.3, backgroundColor: '#141413' });
        setPreviewUrl(url);
      } catch {}
    }, 800);

    return () => { if (previewTimerRef.current) clearTimeout(previewTimerRef.current); };
  }, [canvasBgColor, canvasPattern, canvasPatternColor, canvasPatternOpacity, blocks, showShapeCustomization]);

  const ref = hasSelection ? selected[0] : null;
  const style = hasSelection ? (ref?.canvasStyleExt ?? {}) : activeStyle;

  const activeDrag = useDragState(s => ref ? s.offsets[ref.id] : undefined);
  const displayWidth = activeDrag?.resizeW ?? ref?.width ?? 0;
  const displayHeight = activeDrag?.resizeH ?? ref?.height ?? 0;
  const displayX = activeDrag ? (activeDrag.resizeX ?? ((activeDrag.startX ?? ref?.x ?? 0) + activeDrag.dx)) : (ref?.x ?? 0);
  const displayY = activeDrag ? (activeDrag.resizeY ?? ((activeDrag.startY ?? ref?.y ?? 0) + activeDrag.dy)) : (ref?.y ?? 0);
  const displayRotation = activeDrag?.rotation ?? style.rotation ?? 0;

  function updateStyle(patch: Partial<CanvasStyleExt>) {
    if (hasSelection) {
      selected.forEach(b =>
        updateCanvasBlock(b.id, { canvasStyleExt: { ...(b.canvasStyleExt ?? {}), ...patch } })
      );
    }
    onChangeActiveStyle({ ...activeStyle, ...patch });
  }

  function updateGeom(patch: Partial<Pick<EditorBlock, 'x' | 'y' | 'width' | 'height'>>) {
    if (hasSelection) {
      selected.forEach(b => updateCanvasBlock(b.id, patch));
    }
  }

  function updateBlockFields(patch: Partial<Pick<EditorBlock, 'startArrowhead' | 'endArrowhead' | 'editMode' | 'pointRadiuses'>>) {
    if (hasSelection) {
      selected.forEach(b => updateCanvasBlock(b.id, patch));
    }
  }

  const handleWidthChange = (w: number) => {
    const currentW = ref?.width ?? 0;
    const currentH = ref?.height ?? 0;
    if (style.aspectRatioLocked && currentW > 0 && currentH > 0) {
      const ratio = currentW / currentH;
      updateGeom({ width: w, height: Math.round(w / ratio) });
    } else {
      updateGeom({ width: w });
    }
  };

  const handleHeightChange = (h: number) => {
    const currentW = ref?.width ?? 0;
    const currentH = ref?.height ?? 0;
    if (style.aspectRatioLocked && currentW > 0 && currentH > 0) {
      const ratio = currentW / currentH;
      updateGeom({ height: h, width: Math.round(h * ratio) });
    } else {
      updateGeom({ height: h });
    }
  };

  const rotate90 = () => {
    let next = ((style.rotation ?? 0) + 90) % 360;
    if (next > 180) next -= 360;
    updateStyle({ rotation: next });
  };
  const toggleFlipH = () => {
    updateStyle({ flipH: !style.flipH });
  };
  const toggleFlipV = () => {
    updateStyle({ flipV: !style.flipV });
  };

  return (
    <div ref={outerRef} className="relative">
      <div className="w-[250px] flex flex-col overflow-y-auto" style={{ background: 'var(--sys-color)', border: '1px solid var(--bone-12)', borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.12)', maxHeight: 'calc(100vh - 100px)' }}>

      {showShapeCustomization ? (
        <>
          {hasSelection && ref && (
            <>
              <PanelSection title="Position">
                {/* Alignment subsection */}
                <div className="text-[10px] font-ui-label text-[var(--bone-30)] mb-1">Alignment</div>
                <div className="flex items-center gap-2 mb-2">
                  {/* Horiz Group */}
                  <div className="flex bg-[var(--bone-6)] border border-transparent rounded-[var(--radius-small)] overflow-hidden flex-1 h-7">
                    <button
                      onClick={onAlignLeft}
                      className="flex-1 flex items-center justify-center text-[var(--bone-50)] hover:text-[var(--bone-100)] hover:bg-[var(--app-dark)] transition-colors border-r border-transparent"
                      title="Align left"
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2" y="3" width="5" height="2.5" rx="0.8" fill="currentColor"/><rect x="2" y="7" width="9" height="2.5" rx="0.8" fill="currentColor" opacity="0.4"/><rect x="1.5" y="2" width="1" height="10" rx="0.5" fill="currentColor" opacity="0.5"/></svg>
                    </button>
                    <button
                      onClick={onAlignCenterH}
                      className="flex-1 flex items-center justify-center text-[var(--bone-50)] hover:text-[var(--bone-100)] hover:bg-[var(--app-dark)] transition-colors border-r border-transparent"
                      title="Align center H"
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="3.5" y="3" width="7" height="2.5" rx="0.8" fill="currentColor"/><rect x="2" y="7" width="10" height="2.5" rx="0.8" fill="currentColor" opacity="0.4"/><rect x="6.5" y="2" width="1" height="10" rx="0.5" fill="currentColor" opacity="0.5"/></svg>
                    </button>
                    <button
                      onClick={onAlignRight}
                      className="flex-1 flex items-center justify-center text-[var(--bone-50)] hover:text-[var(--bone-100)] hover:bg-[var(--app-dark)] transition-colors"
                      title="Align right"
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="7" y="3" width="5" height="2.5" rx="0.8" fill="currentColor"/><rect x="3" y="7" width="9" height="2.5" rx="0.8" fill="currentColor" opacity="0.4"/><rect x="11.5" y="2" width="1" height="10" rx="0.5" fill="currentColor" opacity="0.5"/></svg>
                    </button>
                  </div>

                  {/* Vert Group */}
                  <div className="flex bg-[var(--bone-6)] border border-transparent rounded-[var(--radius-small)] overflow-hidden flex-1 h-7">
                    <button
                      onClick={onAlignTop}
                      className="flex-1 flex items-center justify-center text-[var(--bone-50)] hover:text-[var(--bone-100)] hover:bg-[var(--app-dark)] transition-colors border-r border-transparent"
                      title="Align top"
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="3" y="4" width="2.5" height="5" rx="0.8" fill="currentColor"/><rect x="7" y="2.5" width="2.5" height="9" rx="0.8" fill="currentColor" opacity="0.4"/><rect x="2" y="1.5" width="10" height="1" rx="0.5" fill="currentColor" opacity="0.5"/></svg>
                    </button>
                    <button
                      onClick={onAlignCenterV}
                      className="flex-1 flex items-center justify-center text-[var(--bone-50)] hover:text-[var(--bone-100)] hover:bg-[var(--app-dark)] transition-colors border-r border-transparent"
                      title="Align center V"
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="3" y="4" width="2.5" height="5" rx="0.8" fill="currentColor"/><rect x="7" y="2.5" width="2.5" height="9" rx="0.8" fill="currentColor" opacity="0.4"/><rect x="2" y="6.5" width="10" height="1" rx="0.5" fill="currentColor" opacity="0.5"/></svg>
                    </button>
                    <button
                      onClick={onAlignBottom}
                      className="flex-1 flex items-center justify-center text-[var(--bone-50)] hover:text-[var(--bone-100)] hover:bg-[var(--app-dark)] transition-colors"
                      title="Align bottom"
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="3" y="4" width="2.5" height="5" rx="0.8" fill="currentColor"/><rect x="7" y="2.5" width="2.5" height="9" rx="0.8" fill="currentColor" opacity="0.4"/><rect x="2" y="11.5" width="10" height="1" rx="0.5" fill="currentColor" opacity="0.5"/></svg>
                    </button>
                  </div>
                </div>

                {/* Position subsection */}
                <div className="text-[10px] font-ui-label text-[var(--bone-30)] mb-1">Position</div>
                <div className="flex gap-2 mb-2">
                  <SidebarInput
                    prefix={<span className="text-[11px] font-bold leading-none select-none">X</span>}
                    value={Math.round(displayX)}
                    onChange={v => updateGeom({ x: Number(v) || 0 })}
                    scrub={{
                      value: displayX,
                      onChange: v => updateGeom({ x: v })
                    }}
                  />
                  <SidebarInput
                    prefix={<span className="text-[11px] font-bold leading-none select-none">Y</span>}
                    value={Math.round(displayY)}
                    onChange={v => updateGeom({ y: Number(v) || 0 })}
                    scrub={{
                      value: displayY,
                      onChange: v => updateGeom({ y: v })
                    }}
                  />
                </div>

                {/* Rotation subsection */}
                <div className="text-[10px] font-ui-label text-[var(--bone-30)] mb-1">Rotation</div>
                <div className="flex gap-2 items-center">
                  <div className="flex-1">
                    <SidebarInput
                      prefix={
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M14 14H2V2" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M8 14A6 6 0 0 0 2 8" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      }
                      value={`${Math.round(displayRotation)}°`}
                      onChange={v => {
                        const num = parseInt(v.replace(/[^0-9-]/g, '')) || 0;
                        let d = (num % 360 + 360) % 360;
                        if (d > 180) d -= 360;
                        updateStyle({ rotation: d });
                      }}
                      scrub={{
                        value: displayRotation,
                        onChange: v => {
                          let d = (Math.round(v) % 360 + 360) % 360;
                          if (d > 180) d -= 360;
                          updateStyle({ rotation: d });
                        }
                      }}
                    />
                  </div>

                  {/* Group of buttons */}
                  <div className="flex flex-1 bg-[var(--bone-6)] border border-transparent rounded-[var(--radius-small)] overflow-hidden h-7">
                    <button
                      onClick={rotate90}
                      className="flex-1 h-full flex items-center justify-center text-[var(--bone-50)] hover:text-[var(--bone-100)] hover:bg-[var(--app-dark)] transition-colors border-r border-transparent"
                      title="Rotate 90° clockwise"
                    >
                      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M12 4.5A5.5 5.5 0 1 0 13.5 9" strokeLinecap="round"/>
                        <path d="M14 2.5v3h-3" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                    <button
                      onClick={toggleFlipH}
                      className={cn(
                        "flex-1 h-full flex items-center justify-center transition-colors border-r border-transparent",
                        style.flipH 
                          ? "bg-[var(--brand-blue)] text-white" 
                          : "text-[var(--bone-50)] hover:text-[var(--bone-100)] hover:bg-[var(--app-dark)]"
                      )}
                      title="Flip horizontally"
                    >
                      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <line x1="8" y1="2" x2="8" y2="14" strokeDasharray="2 2"/>
                        <path d="M2 8l5-5v10z" fill="currentColor"/>
                        <path d="M14 8l-5-5v10z" fill="currentColor" fillOpacity="0.3"/>
                      </svg>
                    </button>
                    <button
                      onClick={toggleFlipV}
                      className={cn(
                        "flex-1 h-full flex items-center justify-center transition-colors",
                        style.flipV 
                          ? "bg-[var(--brand-blue)] text-white" 
                          : "text-[var(--bone-50)] hover:text-[var(--bone-100)] hover:bg-[var(--app-dark)]"
                      )}
                      title="Flip vertically"
                    >
                      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <line x1="2" y1="8" x2="14" y2="8" strokeDasharray="2 2"/>
                        <path d="M8 2l-5 5h10z" fill="currentColor"/>
                        <path d="M8 14l-5-5h10z" fill="currentColor" fillOpacity="0.3"/>
                      </svg>
                    </button>
                  </div>
                </div>
              </PanelSection>

              <PanelSection title="Layout">
                <div className="text-[10px] font-ui-label text-[var(--bone-30)] mb-1">Dimensions</div>
                <div className="flex items-center gap-2 relative">
                  <div className="relative flex items-center flex-1 gap-2">
                    <SidebarInput
                      prefix={
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M2 8h12M5 5L2 8l3 3M11 5l3 3-3 3" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      }
                      value={Math.round(displayWidth)}
                      onChange={v => handleWidthChange(Number(v) || 0)}
                      scrub={{
                        value: displayWidth,
                        onChange: handleWidthChange,
                        min: 20
                      }}
                    />

                    {/* Aspect ratio connection bridge line */}
                    <div className={cn(
                      "absolute left-[calc(50%-10px)] top-1/2 -translate-y-1/2 flex items-center justify-center w-5 h-4 pointer-events-none z-10",
                      style.aspectRatioLocked ? "text-[var(--brand-blue)] opacity-80" : "text-[var(--bone-30)] opacity-20"
                    )}>
                      <svg width="12" height="8" viewBox="0 0 12 8" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M1 4c0-1.5 1-3 3-3h4c2 0 3 1.5 3 3c0 1.5-1 3-3 3H4c-2 0-3-1.5-3-3z" strokeDasharray={style.aspectRatioLocked ? undefined : "1.5 1.5"} />
                      </svg>
                    </div>

                    <SidebarInput
                      prefix={
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M8 2v12M5 5l3-3 3 3M5 11l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      }
                      value={Math.round(displayHeight)}
                      onChange={v => handleHeightChange(Number(v) || 0)}
                      scrub={{
                        value: displayHeight,
                        onChange: handleHeightChange,
                        min: 20
                      }}
                    />
                  </div>

                  {/* Constrain proportions button */}
                  <button
                    onClick={() => updateStyle({ aspectRatioLocked: !style.aspectRatioLocked })}
                    className={cn(
                      "w-7 h-7 rounded-[var(--radius-small)] flex items-center justify-center border border-transparent transition-colors flex-shrink-0",
                      style.aspectRatioLocked 
                        ? "bg-[var(--brand-blue)] text-white" 
                        : "bg-[var(--bone-6)] hover:bg-[var(--app-dark)] text-[var(--bone-50)] hover:text-[var(--bone-80)]"
                    )}
                    title="Constrain proportions"
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M10 7h1.5a2.5 2.5 0 0 1 0 5H10M5.5 8h5" strokeLinecap="round"/>
                    </svg>
                  </button>
                </div>
              </PanelSection>
            </>
          )}

          <PanelSection title="Opacity & Corner">
            <div className="flex gap-2">
              <div className="flex-1">
                <div className="text-[10px] font-ui-label text-[var(--bone-30)] mb-1">Opacity</div>
                <SidebarInput
                  prefix={
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <circle cx="8" cy="8" r="6"/>
                      <path d="M8 2v12a6 6 0 0 0 0-12z" fill="currentColor"/>
                    </svg>
                  }
                  value={`${Math.round((style.opacity ?? 1) * 100)}%`}
                  onChange={v => {
                    const text = v.replace(/[^0-9]/g, '');
                    const num = Math.min(100, Math.max(0, parseInt(text) || 0));
                    updateStyle({ opacity: num / 100 });
                  }}
                  scrub={{
                    value: (style.opacity ?? 1) * 100,
                    onChange: v => {
                      const num = Math.min(100, Math.max(0, v));
                      updateStyle({ opacity: num / 100 });
                    },
                    min: 0,
                    step: 1
                  }}
                />
              </div>
              <div className="flex-1">
                <div className="text-[10px] font-ui-label text-[var(--bone-30)] mb-1">Corner radius</div>
                <SidebarInput
                  prefix={
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M2 8V4a2 2 0 0 1 2-2h4" strokeLinecap="round"/>
                      <path d="M2 11v1a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2h-1" strokeDasharray="2 2"/>
                    </svg>
                  }
                  value={style.cornerRadius ?? 0}
                  onChange={v => updateStyle({ cornerRadius: Number(v) || 0 })}
                  scrub={{
                    value: style.cornerRadius ?? 0,
                    onChange: v => updateStyle({ cornerRadius: v }),
                    min: 0
                  }}
                />
              </div>
            </div>
          </PanelSection>

      {/* Fill */}
      <PanelSection title="Fill">
        <div className="flex flex-col gap-1 mb-1">
          <span className="text-[10px] font-ui-label text-[var(--bone-30)] select-none">Color</span>
          <div className="flex items-center gap-2">
            <div className={cn("flex-1 flex items-center h-7 bg-[var(--bone-6)] rounded-[var(--radius-small)] border border-transparent hover:bg-[var(--app-dark)] px-2 gap-2 relative", hiddenColors['fill'] && "opacity-40")}>
              <div className="relative w-3.5 h-3.5 rounded-[3px] border border-[var(--bone-15)] flex-shrink-0 cursor-pointer color-swatch-trigger overflow-hidden">
                <button
                  onClick={(e) => togglePicker('fill', e)}
                  className="w-full h-full rounded-[3px] block transition-none"
                  style={{ background: style.fill && style.fill !== 'transparent' ? style.fill : 'transparent' }}
                />
              </div>
              <input
                type="text"
                value={!style.fill || style.fill === 'transparent' ? 'None' : style.fill.replace('#', '').toUpperCase()}
                onChange={e => {
                  const val = e.target.value;
                  if (val.toLowerCase() === 'none') {
                    updateStyle({ fill: 'transparent' });
                  } else {
                    const hex = val.replace(/[^0-9a-fA-F]/g, '');
                    if (hex.length <= 6) {
                      updateStyle({ fill: '#' + hex });
                    }
                  }
                }}
                className={cn(
                  "w-full bg-transparent border-none outline-none text-[11px] text-[var(--bone-90)] focus:text-[var(--bone-100)] p-0 m-0",
                  style.fill && style.fill !== 'transparent' && "uppercase"
                )}
              />
              <div className="w-px h-4 bg-[var(--bone-15)] flex-shrink-0" />
              <input
                type="text"
                value={Math.round((style.fillOpacity ?? 1) * 100)}
                onChange={e => {
                  const num = Math.min(100, Math.max(0, parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0));
                  updateStyle({ fillOpacity: num / 100 });
                }}
                className="w-[26px] bg-transparent border-none outline-none text-[11px] text-[var(--bone-90)] focus:text-[var(--bone-100)] p-0 m-0 text-right"
              />
              <span
                onPointerDown={makeScrub(
                  (style.fillOpacity ?? 1) * 100,
                  v => updateStyle({ fillOpacity: v / 100 }),
                  1, 0, 100
                )}
                className="cursor-ew-resize select-none text-[10px] text-[var(--bone-40)] font-ui-label flex-shrink-0"
              >%</span>
            </div>
            <button
              onClick={() => setHiddenColors(prev => ({ ...prev, fill: !prev['fill'] }))}
              className="w-7 h-7 rounded-[var(--radius-small)] flex items-center justify-center border border-transparent bg-[var(--bone-6)] hover:bg-[var(--app-dark)] text-[var(--bone-30)] hover:text-[var(--bone-100)] flex-shrink-0"
              title={hiddenColors['fill'] ? 'Show fill' : 'Hide fill'}
            >
              {hiddenColors['fill'] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </PanelSection>

      {/* Border */}
      <PanelSection title="Border">
        <div className="flex flex-col gap-1 mb-1">
          <span className="text-[10px] font-ui-label text-[var(--bone-30)] select-none">Color</span>
          <div className="flex items-center gap-2">
            <div className={cn("flex-1 flex items-center h-7 bg-[var(--bone-6)] rounded-[var(--radius-small)] border border-transparent hover:bg-[var(--app-dark)] px-2 gap-2 relative", hiddenColors['border'] && "opacity-40")}>
              <div className="relative w-3.5 h-3.5 rounded-[3px] border border-[var(--bone-15)] flex-shrink-0 cursor-pointer color-swatch-trigger overflow-hidden">
                <button
                  onClick={(e) => togglePicker('border', e)}
                  className="w-full h-full rounded-[3px] block transition-none"
                  style={{ background: style.stroke && style.stroke !== 'transparent' ? style.stroke : 'transparent' }}
                />
              </div>
              <input
                type="text"
                value={!style.stroke || style.stroke === 'transparent' ? 'None' : style.stroke.replace('#', '').toUpperCase()}
                onChange={e => {
                  const val = e.target.value;
                  if (val.toLowerCase() === 'none') {
                    updateStyle({ stroke: 'transparent' });
                  } else {
                    const hex = val.replace(/[^0-9a-fA-F]/g, '');
                    if (hex.length <= 6) {
                      updateStyle({ stroke: '#' + hex });
                    }
                  }
                }}
                className={cn(
                  "w-full bg-transparent border-none outline-none text-[11px] text-[var(--bone-90)] focus:text-[var(--bone-100)] p-0 m-0",
                  style.stroke && style.stroke !== 'transparent' && "uppercase"
                )}
              />
              <div className="w-px h-4 bg-[var(--bone-15)] flex-shrink-0" />
              <input
                type="text"
                value={100}
                onChange={e => {
                  const num = Math.min(100, Math.max(0, parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0));
                  updateStyle({ stroke: style.stroke });
                }}
                className="w-[26px] bg-transparent border-none outline-none text-[11px] text-[var(--bone-90)] focus:text-[var(--bone-100)] p-0 m-0 text-right"
              />
              <span className="text-[10px] text-[var(--bone-40)] font-ui-label flex-shrink-0 select-none">%</span>
            </div>
            <button
              onClick={() => setHiddenColors(prev => ({ ...prev, border: !prev['border'] }))}
              className="w-7 h-7 rounded-[var(--radius-small)] flex items-center justify-center border border-transparent bg-[var(--bone-6)] hover:bg-[var(--app-dark)] text-[var(--bone-30)] hover:text-[var(--bone-100)] flex-shrink-0"
              title={hiddenColors['border'] ? 'Show border' : 'Hide border'}
            >
              {hiddenColors['border'] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
        
        <div className="mt-2">
          <div className="text-[10px] font-ui-label text-[var(--bone-30)] mb-1">Weight</div>
          <div className="flex gap-2 items-center">
            <div className="flex-1">
              <SidebarInput
                prefix={
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1">
                    <line x1="3" y1="4" x2="13" y2="4" strokeWidth="1.5" strokeLinecap="round" />
                    <line x1="3" y1="8" x2="13" y2="8" strokeWidth="2.5" strokeLinecap="round" />
                    <line x1="3" y1="12" x2="13" y2="12" strokeWidth="4" strokeLinecap="round" />
                  </svg>
                }
                value={style.strokeWidth ?? 1.5}
                onChange={v => updateStyle({ strokeWidth: Number(v) || 1 })}
                scrub={{
                  value: style.strokeWidth ?? 1.5,
                  onChange: v => updateStyle({ strokeWidth: v }),
                  step: 0.5,
                  min: 0
                }}
              />
            </div>
            
            <div className="flex-1">
              <SliderGroup
                options={['solid', 'dashed', 'dotted'] as const}
                value={(style.strokeStyle ?? 'solid') as 'solid' | 'dashed' | 'dotted'}
                onChange={ss => updateStyle({ strokeStyle: ss })}
                renderLabel={ss => ss === 'solid' ? '—' : ss === 'dashed' ? '- -' : '···'}
              />
            </div>
          </div>
        </div>
      </PanelSection>

      {ref && (ref.shapeKind === 'arrow' || ref.shapeKind === 'line') && (
        <PanelSection title="Arrowheads">
          <div className="flex gap-2 mb-2">
            <div className="flex-1">
              <div className="text-[10px] font-ui-label text-[var(--bone-30)] mb-1">Start</div>
              <select
                value={ref.startArrowhead?.type ?? 'none'}
                onChange={e => updateBlockFields({
                  startArrowhead: { type: e.target.value as any, size: ref.startArrowhead?.size ?? 1 }
                })}
                className="w-full h-7 bg-[var(--bone-6)] rounded-[var(--radius-small)] text-[11px] text-[var(--bone-90)] border-none outline-none px-2"
              >
                <option value="none">None</option>
                <option value="triangle">Triangle</option>
                <option value="filled-triangle">Filled ▲</option>
                <option value="circle">Circle</option>
                <option value="bar">Bar</option>
                <option value="diamond">Diamond</option>
              </select>
            </div>
            <div className="flex-1">
              <div className="text-[10px] font-ui-label text-[var(--bone-30)] mb-1">End</div>
              <select
                value={ref.endArrowhead?.type ?? 'filled-triangle'}
                onChange={e => updateBlockFields({
                  endArrowhead: { type: e.target.value as any, size: ref.endArrowhead?.size ?? 1 }
                })}
                className="w-full h-7 bg-[var(--bone-6)] rounded-[var(--radius-small)] text-[11px] text-[var(--bone-90)] border-none outline-none px-2"
              >
                <option value="none">None</option>
                <option value="triangle">Triangle</option>
                <option value="filled-triangle">Filled ▲</option>
                <option value="circle">Circle</option>
                <option value="bar">Bar</option>
                <option value="diamond">Diamond</option>
              </select>
            </div>
          </div>
          <PropRow label="Size">
            <input
              type="range" min={0.5} max={3} step={0.1}
              value={ref.endArrowhead?.size ?? 1}
              onChange={e => updateBlockFields({
                endArrowhead: { ...ref.endArrowhead ?? { type: 'filled-triangle' }, size: Number(e.target.value) },
                startArrowhead: ref.startArrowhead?.type !== 'none'
                  ? { ...ref.startArrowhead ?? { type: 'none' }, size: Number(e.target.value) }
                  : ref.startArrowhead,
              })}
              className="flex-1 h-[3px] rounded-full accent-[var(--accent)]"
            />
            <span className="text-[11px] text-[var(--bone-40)] w-6 text-right">
              {Math.round((ref.endArrowhead?.size ?? 1) * 10) / 10}
            </span>
          </PropRow>
        </PanelSection>
      )}

      {ref && (ref.shapeKind === 'arrow' || ref.shapeKind === 'line' || ref.shapeKind === 'freedraw') && (
        <PanelSection title="Edit Mode">
          <div className="flex bg-[var(--bone-6)] border border-transparent rounded-[var(--radius-small)] p-[2px] gap-[1.5px] h-7">
            {(['simple', 'advanced'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => {
                  if (mode === 'advanced' && ref.editMode !== 'advanced') {
                    const count = (ref.points?.length || 0);
                    updateBlockFields({
                      editMode: 'advanced',
                      pointRadiuses: Array(count).fill(20),
                    });
                  } else if (mode === 'simple') {
                    updateBlockFields({ editMode: 'simple', pointRadiuses: undefined });
                  } else {
                    updateBlockFields({ editMode: mode });
                  }
                }}
                className={cn(
                  "flex-1 h-full rounded-[var(--radius-tiny)] text-[10px] capitalize transition-colors",
                  (ref.editMode ?? 'simple') === mode
                    ? "bg-[var(--bone-15)] text-[var(--bone-100)] font-semibold"
                    : "text-[var(--bone-60)] hover:text-[var(--bone-100)] hover:bg-[var(--app-dark)]"
                )}
              >
                {mode}
              </button>
            ))}
          </div>
        </PanelSection>
      )}

      {ref && (ref.shapeKind === 'arrow' || ref.shapeKind === 'line' || ref.shapeKind === 'freedraw') && ref.editMode === 'advanced' && (() => {
        const radii = ref.pointRadiuses ?? [];
        const allSame = radii.length > 0 && radii.every(r => r === radii[0]);
        const hasMixed = radii.length > 1 && !allSame;
        const selIdx = selectedPointIndex != null && selectedPointIndex < radii.length ? selectedPointIndex : null;
        const currentVal = selIdx != null ? radii[selIdx] : (allSame ? radii[0] : null);
        return (
          <PanelSection title="Corner Radius">
            {selIdx != null ? (
              <PropRow label={`Corner #${selIdx + 1}`}>
                <input
                  type="number" min={0} max={100} step={1}
                  value={currentVal ?? 20}
                  onChange={e => {
                    const v = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                    const newRadii = [...radii];
                    if (selIdx < newRadii.length) {
                      newRadii[selIdx] = v;
                    }
                    updateBlockFields({ pointRadiuses: newRadii });
                  }}
                  className="flex-1 h-7 bg-[var(--bone-6)] rounded-[var(--radius-small)] text-[11px] text-[var(--bone-90)] border-none outline-none px-2"
                />
              </PropRow>
            ) : hasMixed ? (
              <PropRow label="Corners">
                <div className="flex-1 h-7 bg-[var(--bone-6)] rounded-[var(--radius-small)] flex items-center px-2">
                  <span className="text-[11px] text-[var(--bone-40)]">Mixed</span>
                </div>
              </PropRow>
            ) : allSame ? (
              <PropRow label="Corners">
                <input
                  type="number" min={0} max={100} step={1}
                  value={currentVal ?? 20}
                  onChange={e => {
                    const v = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                    updateBlockFields({ pointRadiuses: Array(radii.length).fill(v) });
                  }}
                  className="flex-1 h-7 bg-[var(--bone-6)] rounded-[var(--radius-small)] text-[11px] text-[var(--bone-90)] border-none outline-none px-2"
                />
              </PropRow>
            ) : null}
          </PanelSection>
        );
      })()}

      <PanelSection title="Options">
        <PropRow label="Locked">
          <Toggle
            checked={style.locked ?? false}
            onChange={(checked) => updateStyle({ locked: checked })}
            size="sm"
          />
        </PropRow>
      </PanelSection>
    </>
  ) : (
    <>
      <PanelSection 
        title="Canvas Background"
        action={
          canvasBgColor !== 'default' && (
            <button
              onClick={() => onCanvasBgColorChange('default')}
              className="text-[10px] font-ui text-[var(--bone-45)] hover:text-[var(--bone-100)] transition-none cursor-pointer"
              title="Reset to default background"
            >
              Reset
            </button>
          )
        }
      >
        <div className="flex flex-col gap-1 mb-1">
          <span className="text-[10px] font-ui-label text-[var(--bone-30)] select-none">Color</span>
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center h-7 bg-[var(--bone-6)] rounded-[var(--radius-small)] border border-transparent hover:bg-[var(--app-dark)] px-2 gap-2 relative">
              {/* Color swatch square */}
              <div className="relative w-3.5 h-3.5 rounded-[3px] border border-[var(--bone-15)] flex-shrink-0 cursor-pointer color-swatch-trigger overflow-hidden">
                <button
                  onClick={(e) => togglePicker('bg', e)}
                  className="w-full h-full rounded-[3px] block transition-none"
                  style={{ backgroundColor: canvasBgColor === 'default' ? 'var(--app-background)' : canvasBgColor }}
                />
              </div>
              
              {/* Hex value text */}
              <input
                type="text"
                value={canvasBgColor === 'default' ? resolveCSSVar('--app-background').replace('#', '').toUpperCase() : canvasBgColor.replace('#', '').toUpperCase()}
                onChange={e => {
                  const val = e.target.value;
                  if (val.toLowerCase() === 'default') {
                    onCanvasBgColorChange('default');
                  } else {
                    const hex = val.replace(/[^0-9a-fA-F]/g, '');
                    if (hex.length <= 6) {
                      onCanvasBgColorChange('#' + hex);
                    }
                  }
                }}
                className={cn(
                  "w-full bg-transparent border-none outline-none text-[11px] text-[var(--bone-90)] focus:text-[var(--bone-100)] p-0 m-0",
                  canvasBgColor !== 'default' && "uppercase"
                )}
              />
              
              {/* Separator and Opacity percentage */}
              <div className="w-px h-4 bg-[var(--bone-15)] flex-shrink-0" />
              <input
                type="text"
                value={100}
                onChange={e => {
                  const num = Math.min(100, Math.max(0, parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0));
                  onCanvasBgColorChange(canvasBgColor);
                }}
                className="w-[26px] bg-transparent border-none outline-none text-[11px] text-[var(--bone-90)] focus:text-[var(--bone-100)] p-0 m-0 text-right"
              />
              <span className="text-[10px] text-[var(--bone-40)] font-ui-label flex-shrink-0 select-none">%</span>
            </div>
          </div>
        </div>
      </PanelSection>

      <PanelSection 
        title="Canvas Pattern"
        action={
          (canvasPattern !== 'grid' || canvasPatternColor !== 'default' || canvasPatternOpacity !== 0.03) && (
            <button
              onClick={() => {
                onCanvasPatternChange('grid');
                onCanvasPatternColorChange('default');
                onCanvasPatternOpacityChange(0.03);
              }}
              className="text-[10px] font-ui text-[var(--bone-45)] hover:text-[var(--bone-100)] transition-none cursor-pointer"
              title="Reset to default pattern"
            >
              Reset
            </button>
          )
        }
      >
        <SliderGroup
          options={['none', 'grid', 'dots'] as const}
          value={canvasPattern}
          onChange={onCanvasPatternChange}
          renderLabel={p => (
            <>
              {PATTERN_ICONS[p]}
              <span>{p.charAt(0).toUpperCase() + p.slice(1)}</span>
            </>
          )}
        />

        {canvasPattern !== 'none' && (
          <div className="flex flex-col gap-1 mt-2.5">
            <span className="text-[10px] font-ui-label text-[var(--bone-30)] select-none">Color</span>
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center h-7 bg-[var(--bone-6)] rounded-[var(--radius-small)] border border-transparent hover:bg-[var(--app-dark)] px-2 gap-2 relative">
                {/* Color swatch square */}
                <div className="relative w-3.5 h-3.5 rounded-[3px] border border-[var(--bone-15)] flex-shrink-0 cursor-pointer color-swatch-trigger overflow-hidden">
                  <button
                    onClick={(e) => togglePicker('pattern', e)}
                    className="w-full h-full rounded-[3px] block transition-none"
                    style={{ backgroundColor: canvasPatternColor === 'default' ? 'var(--bone-100)' : canvasPatternColor }}
                  />
                </div>
                
                {/* Hex value text */}
                <input
                  type="text"
                  value={canvasPatternColor === 'default' ? resolveCSSVar('--bone-100').replace('#', '').toUpperCase() : canvasPatternColor.replace('#', '').toUpperCase()}
                  onChange={e => {
                    const val = e.target.value;
                    if (val.toLowerCase() === 'default') {
                      onCanvasPatternColorChange('default');
                    } else {
                      const hex = val.replace(/[^0-9a-fA-F]/g, '');
                      if (hex.length <= 6) {
                        onCanvasPatternColorChange('#' + hex);
                      }
                    }
                  }}
                  className={cn(
                    "w-full bg-transparent border-none outline-none text-[11px] text-[var(--bone-90)] focus:text-[var(--bone-100)] p-0 m-0",
                    canvasPatternColor !== 'default' && "uppercase"
                  )}
                />
                
                {/* Separator and adjustable Opacity percentage */}
                <div className="w-px h-4 bg-[var(--bone-15)] flex-shrink-0" />
                <input
                  type="text"
                  value={Math.round(canvasPatternOpacity * 100)}
                  onChange={e => {
                    const num = Math.min(100, Math.max(0, parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0));
                    onCanvasPatternOpacityChange(num / 100);
                  }}
                  className="w-[26px] bg-transparent border-none outline-none text-[11px] text-[var(--bone-90)] focus:text-[var(--bone-100)] p-0 m-0 text-right"
                />
                <span
                  onPointerDown={makeScrub(
                    canvasPatternOpacity * 100,
                    v => onCanvasPatternOpacityChange(v / 100),
                    1, 0, 100
                  )}
                  className="cursor-ew-resize select-none text-[10px] text-[var(--bone-40)] font-ui-label flex-shrink-0"
                >%</span>
              </div>
            </div>
          </div>
        )}
      </PanelSection>

      <PanelSection title="Export Preview">
        <div className="relative w-full overflow-hidden rounded-[var(--radius-small)] border border-[var(--bone-15)] bg-[var(--bone-5)] flex items-center justify-center" style={{ aspectRatio: '16/10' }}>
          {previewUrl ? (
            <img src={previewUrl} alt="Export preview" className="w-full h-full object-contain" />
          ) : (
            <span className="text-[10px] text-[var(--bone-30)]">Capturing preview…</span>
          )}
        </div>
      </PanelSection>
    </>
  )}
      </div>

      {/* Sibling color picker popover */}
      {activePicker && (
        <ColorPickerPopover
          color={
            activePicker === 'fill' ? (style.fill || '#ffffff') :
            activePicker === 'border' ? (style.stroke || '#ffffff') :
            activePicker === 'bg' ? (canvasBgColor === 'default' ? '#F8F8F6' : canvasBgColor) :
            (canvasPatternColor === 'default' ? (isDark ? '#E9E9E2' : '#242423') : canvasPatternColor)
          }
          opacity={
            activePicker === 'fill' ? (style.fillOpacity ?? 1) :
            activePicker === 'border' ? 1 :
            activePicker === 'bg' ? 1 :
            canvasPatternOpacity
          }
          onChange={(color, opacity) => {
            if (activePicker === 'fill') {
              updateStyle({ fill: color, fillOpacity: opacity });
            } else if (activePicker === 'border') {
              updateStyle({ stroke: color });
            } else if (activePicker === 'bg') {
              onCanvasBgColorChange(color);
            } else if (activePicker === 'pattern') {
              onCanvasPatternColorChange(color);
              onCanvasPatternOpacityChange(opacity);
            }
          }}
          onClose={() => setActivePicker(null)}
          style={{
            right: '260px',
            top: `${pickerTop}px`,
          }}
        />
      )}
    </div>
  );
}
