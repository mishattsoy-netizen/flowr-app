"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { useStore, EditorBlock, CanvasStyleExt } from '@/data/store';
import { resolvePoints } from '@/lib/geometry/resolvePoints';
import { calculateSplineBounds } from '@/lib/geometry/splines';
import { useDragState } from '@/lib/canvasDragState';
import { cn } from '@/lib/utils';
import { Toggle } from '../ui/Toggle';
import type { CanvasTool } from './CanvasToolbar';
import { ColorPickerPopover } from './ColorPickerPopover';
import { Eye, EyeOff, Check, Scan, ChevronDown, Camera, Copy, Download } from 'lucide-react';
import { toPng, toJpeg } from 'html-to-image';
import { createPortal } from 'react-dom';
import { computeGroupSpacing, computeGroupBounds } from '@/lib/frameLayout';

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
  canvasBgOpacity: number;
  onCanvasBgOpacityChange: (opacity: number) => void;
  canvasPattern: 'none' | 'grid' | 'dots';
  onCanvasPatternChange: (pattern: 'none' | 'grid' | 'dots') => void;
  canvasPatternOpacity: number;
  onCanvasPatternOpacityChange: (opacity: number) => void;
  canvasPatternColor: string;
  onCanvasPatternColorChange: (color: string) => void;
  activeTool: CanvasTool;
  selectedPointIndex?: number | null;
  captureBg: boolean;
  onCaptureBgChange: (v: boolean) => void;
  captureRatio: 'screen' | '16:9' | '4:3' | '1:1';
  onCaptureRatioChange: (v: 'screen' | '16:9' | '4:3' | '1:1') => void;
  captureOrientation: 'horizontal' | 'vertical';
  onCaptureOrientationChange: (v: 'horizontal' | 'vertical') => void;
  captureScale: number;
  onCaptureScaleChange: (v: number) => void;
  exportFormat: 'png' | 'jpg' | 'svg';
  onExportFormatChange: (v: 'png' | 'jpg' | 'svg') => void;
  fileName: string;
  onFileNameChange: (v: string) => void;
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
    <div className="px-4 py-2.5 border-b border-[var(--bone-10)] last:border-b-0">
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
  const activeIdx = options.indexOf(value);
  const numOptions = options.length;

  return (
    <div
      className="relative flex items-center p-[3px] rounded-[var(--radius-small)] w-full h-7"
      style={{ background: 'var(--slider-track)' }}
    >
      {/* Animated sliding pill */}
      <div
        className="absolute top-[3px] bottom-[3px] rounded-[5px] bg-[var(--slider-pill)] pointer-events-none transition-all duration-300 ease-out"
        style={{
          width: `calc((100% - 6px) / ${numOptions})`,
          left: `calc(3px + ${activeIdx} * (100% - 6px) / ${numOptions})`,
          boxShadow: 'var(--slider-pill-shadow)'
        }}
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


function ExportSelect({
  value,
  onChange,
  options,
  iconOnly,
  align = 'left',
  popupWidth,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; icon?: React.ReactNode }[];
  iconOnly?: boolean;
  align?: 'left' | 'right';
  popupWidth?: number;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const posRef = useRef({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        btnRef.current && !btnRef.current.contains(e.target as Node) &&
        popupRef.current && !popupRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [open]);

  const width = popupWidth ?? posRef.current.width;

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={() => {
          if (!open && btnRef.current) {
            const r = btnRef.current.getBoundingClientRect();
            posRef.current = { top: r.bottom + 4, left: r.left, width: r.width };
          }
          setOpen(prev => !prev);
        }}
        className={cn(
          "w-full h-7 rounded-[var(--radius-small)] text-[11px] border-none outline-none px-2 flex items-center justify-between gap-1 cursor-pointer transition-none",
          open 
            ? "bg-[var(--bone-10)] text-[var(--bone-100)]" 
            : "bg-[var(--bone-6)] text-[var(--bone-90)] hover:bg-[var(--app-dark)]"
        )}
      >
        {iconOnly ? (
          options.find(o => o.value === value)?.icon
        ) : (
          <span className="truncate">{options.find(o => o.value === value)?.label ?? value}</span>
        )}
        <ChevronDown className={cn("w-3 h-3 flex-shrink-0 text-[var(--bone-40)] transition-transform", open && "rotate-180")} />
      </button>
      {open && createPortal(
        <div
          ref={popupRef}
          style={{ 
            position: 'fixed', 
            top: (() => {
              const popupHeight = options.length * 25 + 8;
              let t = posRef.current.top;
              if (t + popupHeight > window.innerHeight - 10) {
                t = Math.max(10, posRef.current.top - 28 - popupHeight - 8); // 28px is trigger h-7 height, 8px gap
              }
              return t;
            })(),
            left: align === 'right' 
              ? posRef.current.left + posRef.current.width - width
              : posRef.current.left, 
            width: width 
          }}
          className="z-[200] popup-glass-small p-1 flex flex-col gap-0.5 canvas-floating-panel"
        >
          {options.map(({ value: optVal, label, icon }) => (
            <button
              key={optVal}
              onClick={() => { onChange(optVal); setOpen(false); }}
              className={cn(
                "w-full h-[25px] px-2 rounded-[var(--radius-small)] text-[10px] text-left flex items-center gap-1.5 text-[var(--bone-80)] hover:text-[var(--bone-100)] hover:bg-[var(--app-dark)] transition-none cursor-pointer border-none outline-none bg-transparent",
                optVal === value && "bg-[var(--app-dark)] text-[var(--bone-100)]"
              )}
            >
              {icon && <span className="shrink-0">{icon}</span>}
              <span className="truncate">{label}</span>
              {optVal === value && <Check className="w-2.5 h-2.5 text-[var(--bone-60)] shrink-0 ml-auto" />}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}

const ARROWHEAD_ICONS: Record<string, React.ReactNode> = {
  none: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="opacity-60 flex-shrink-0">
      <line x1="4" y1="8" x2="14" y2="8" />
    </svg>
  ),
  triangle: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-60 flex-shrink-0">
      <line x1="8" y1="8" x2="14" y2="8" />
      <polygon points="8,5 3,8 8,11" fill="none" />
    </svg>
  ),
  'filled-triangle': (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-60 flex-shrink-0">
      <line x1="8" y1="8" x2="14" y2="8" />
      <polygon points="8,5 3,8 8,11" fill="currentColor" />
    </svg>
  ),
  circle: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-60 flex-shrink-0">
      <line x1="8" y1="8" x2="14" y2="8" />
      <circle cx="5" cy="8" r="2.5" fill="currentColor" />
    </svg>
  ),
  bar: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-60 flex-shrink-0">
      <line x1="5" y1="8" x2="14" y2="8" />
      <line x1="5" y1="5" x2="5" y2="11" />
    </svg>
  ),
  diamond: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-60 flex-shrink-0">
      <line x1="8" y1="8" x2="14" y2="8" />
      <polygon points="5,5 2,8 5,11 8,8" fill="currentColor" />
    </svg>
  ),
};

function ArrowheadDropdown({
  value,
  onChange,
  align = 'left',
}: {
  value: string;
  onChange: (type: string) => void;
  align?: 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const posRef = useRef({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        btnRef.current && !btnRef.current.contains(e.target as Node) &&
        popupRef.current && !popupRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [open]);

  const labels: Record<string, string> = {
    none: 'None',
    triangle: 'Triangle',
    'filled-triangle': 'Filled',
    circle: 'Circle',
    bar: 'Bar',
    diamond: 'Diamond',
  };

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={() => {
          if (!open && btnRef.current) {
            const r = btnRef.current.getBoundingClientRect();
            posRef.current = { top: r.bottom + 4, left: r.left, width: r.width };
          }
          setOpen(prev => !prev);
        }}
        className={cn(
          "w-full h-7 rounded-[var(--radius-small)] border-none outline-none px-1.5 flex items-center justify-between gap-0.5 cursor-pointer transition-none",
          open 
            ? "bg-[var(--bone-10)] text-[var(--bone-100)]" 
            : "bg-[var(--bone-6)] text-[var(--bone-90)] hover:bg-[var(--app-dark)]"
        )}
      >
        <span className="flex items-center justify-center flex-1 min-w-0">
          {ARROWHEAD_ICONS[value] || ARROWHEAD_ICONS['none']}
        </span>
        <ChevronDown className={cn("w-3 h-3 flex-shrink-0 text-[var(--bone-40)] transition-transform", open && "rotate-180")} />
      </button>
      {open && createPortal(
        <div
          ref={popupRef}
          style={{ 
            position: 'fixed', 
            top: (() => {
              const popupHeight = 160; // 6 options * 25px + padding/gap
              let t = posRef.current.top;
              if (t + popupHeight > window.innerHeight - 10) {
                t = Math.max(10, posRef.current.top - 28 - popupHeight - 8); // 28px trigger height, 8px gap
              }
              return t;
            })(),
            left: align === 'right' 
              ? posRef.current.left + posRef.current.width - 120 
              : posRef.current.left, 
            width: 120 
          }}
          className="z-[200] popup-glass-small p-1 flex flex-col gap-0.5 canvas-floating-panel"
        >
          {Object.entries(labels).map(([key, label]) => (
            <button
              key={key}
              onClick={() => { onChange(key); setOpen(false); }}
              className={cn(
                "w-full h-[25px] px-2 rounded-[var(--radius-small)] text-[10px] text-left flex items-center gap-1.5 text-[var(--bone-80)] hover:text-[var(--bone-100)] hover:bg-[var(--app-dark)] transition-none cursor-pointer border-none outline-none bg-transparent",
                key === value && "bg-[var(--app-dark)] text-[var(--bone-100)]"
              )}
            >
              {ARROWHEAD_ICONS[key] || ARROWHEAD_ICONS['none']}
              <span>{label}</span>
              {key === value && <Check className="w-2.5 h-2.5 text-[var(--bone-60)] shrink-0 ml-auto" />}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}


export function CanvasStylePanel({
  selectedIds, canvasId,
  onAlignLeft, onAlignCenterH, onAlignRight,
  onAlignTop, onAlignCenterV, onAlignBottom,
  activeStyle, onChangeActiveStyle,
  canvasBgColor, onCanvasBgColorChange,
  canvasBgOpacity, onCanvasBgOpacityChange,
  canvasPattern, onCanvasPatternChange,
  canvasPatternOpacity, onCanvasPatternOpacityChange,
  canvasPatternColor, onCanvasPatternColorChange,
  activeTool,
  selectedPointIndex,
  captureBg, onCaptureBgChange,
  captureRatio, onCaptureRatioChange,
  captureOrientation, onCaptureOrientationChange,
  captureScale, onCaptureScaleChange,
  exportFormat, onExportFormatChange,
  fileName, onFileNameChange,
}: Props) {
  const blocks = useStore(s => s.blocks);
  const updateCanvasBlock = useStore(s => s.updateCanvasBlock);
  const updateCanvasBlocks = useStore(s => s.updateCanvasBlocks);
  const setFrameClipContent = useStore(s => s.setFrameClipContent);
  const [activePicker, setActivePicker] = useState<'bg' | 'pattern' | 'fill' | 'border' | null>(null);
  const outerRef = useRef<HTMLDivElement>(null);
  const [pickerPos, setPickerPos] = useState({ top: 0, left: 0 });
  const [hiddenColors, setHiddenColors] = useState<Record<string, boolean>>({});
  const prevFillRef = useRef<string>('#ffffff');
  const prevFillOpacityRef = useRef<number>(1);
  const prevStrokeRef = useRef<string>('#ffffff');
  const prevStrokeOpacityRef = useRef<number>(1);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewSize, setPreviewSize] = useState<{w: number; h: number} | null>(null);
  const [capturing, setCapturing] = useState(false);
  const capturingRef = useRef(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [hasGeneratedPreview, setHasGeneratedPreview] = useState(false);

  const handleCapture = useCallback(async () => {
    const el = document.getElementById('canvas-viewport-export');
    if (!el || capturingRef.current) return;
    capturingRef.current = true;
    setCapturing(true);
    setPreviewUrl(null);
    setPreviewSize(null);

    const startTime = Date.now();
    let w = el.offsetWidth;
    let h = el.offsetHeight;
    const scale = captureScale;

    try {
      const captureOpts = {
        pixelRatio: scale,
        backgroundColor: captureBg ? (canvasBgColor === 'default' ? resolveCSSVar('--app-background') : canvasBgColor) : undefined,
        style: { transform: 'none', transformOrigin: '0 0' },
      };
      let dataUrl = exportFormat === 'jpg'
        ? await toJpeg(el as HTMLElement, { ...captureOpts, quality: 0.92 })
        : await toPng(el as HTMLElement, captureOpts);

      // Crop to aspect ratio
      if (captureRatio !== 'screen') {
        const [rw, rh] = captureRatio.split(':').map(Number);
        const targetRatio = rw / rh;
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = reject;
          img.src = dataUrl;
        });
        let cropW = img.width, cropH = img.height;
        if (img.width / img.height > targetRatio) cropW = img.height * targetRatio;
        else cropH = img.width / targetRatio;
        const c = document.createElement('canvas');
        c.width = cropW;
        c.height = cropH;
        const ctx = c.getContext('2d')!;
        ctx.drawImage(img, (img.width - cropW) / 2, (img.height - cropH) / 2, cropW, cropH, 0, 0, cropW, cropH);
        const mime = exportFormat === 'jpg' ? 'image/jpeg' : 'image/png';
        dataUrl = c.toDataURL(mime, 0.92);
        w = cropW;
        h = cropH;
      }

      // Rotate for vertical orientation
      if (captureOrientation === 'vertical') {
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = reject;
          img.src = dataUrl;
        });
        const c = document.createElement('canvas');
        c.width = img.height;
        c.height = img.width;
        const ctx = c.getContext('2d')!;
        ctx.translate(c.width / 2, c.height / 2);
        ctx.rotate(90 * Math.PI / 180);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
        const mime = exportFormat === 'jpg' ? 'image/jpeg' : 'image/png';
        dataUrl = c.toDataURL(mime, 0.92);
        [w, h] = [h, w];
      }

      const elapsed = Date.now() - startTime;
      if (elapsed < 2000) await new Promise(r => setTimeout(r, 2000 - elapsed));

      const finalImg = new Image();
      await new Promise<void>((resolve, reject) => {
        finalImg.onload = () => resolve();
        finalImg.onerror = reject;
        finalImg.src = dataUrl;
      });

      setPreviewUrl(dataUrl);
      setPreviewSize({ w: finalImg.width, h: finalImg.height });
    } catch {}
    capturingRef.current = false;
    setCapturing(false);
  }, [captureScale, captureRatio, captureOrientation, captureBg, exportFormat, canvasBgColor]);

  useEffect(() => {
    if (hasGeneratedPreview) {
      handleCapture();
    }
  }, [captureScale, captureRatio, captureOrientation, captureBg, exportFormat, hasGeneratedPreview, handleCapture]);

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
        // Float popover 10px to the left of the style panel
        const leftPos = outerRect.left - 240; // 230px popover width + 10px spacing
        let topPos = rect.top; // Align top with the clicked swatch button
        const popoverHeight = 330;
        
        // Clamp top to keep popover fully inside visible viewport
        if (topPos + popoverHeight > window.innerHeight - 10) {
          topPos = Math.max(10, window.innerHeight - popoverHeight - 10);
        }
        if (topPos < 10) topPos = 10;
        
        setPickerPos({ left: leftPos, top: topPos });
      }
      setActivePicker(picker);
    }
  };

  const selected = blocks.filter(b => selectedIds.has(b.id));
  const hasSelection = selected.length > 0;
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

  const isShapeTool = ['rect', 'ellipse', 'diamond', 'freedraw', 'line', 'arrow'].includes(activeTool);
  const showShapeCustomization = hasSelection || isShapeTool;

  // ─── Frame / Group selection analysis ──────────────────────
  const isSingleFrame = selected.length === 1 && selected[0].type === 'frame';
  const isSingleText = selected.length === 1 && selected[0].type === 'text';
  const isGroupSelection = selected.length > 1 && selected.every(b => b.groupId && b.groupId === selected[0].groupId);
  const groupSpacing = isGroupSelection ? computeGroupSpacing(selected) : null;

  const ref = hasSelection ? selected[0] : null;
  const style = hasSelection ? (ref?.canvasStyleExt ?? {}) : activeStyle;

  const activeDrag = useDragState(s => ref ? s.offsets[ref.id] : undefined);
  const displayWidth = activeDrag?.resizeW ?? ref?.width ?? 0;
  const displayHeight = activeDrag?.resizeH ?? ref?.height ?? 0;
  const displayX = activeDrag ? (activeDrag.resizeX ?? ((activeDrag.startX ?? ref?.x ?? 0) + activeDrag.dx)) : (ref?.x ?? 0);
  const displayY = activeDrag ? (activeDrag.resizeY ?? ((activeDrag.startY ?? ref?.y ?? 0) + activeDrag.dy)) : (ref?.y ?? 0);
  const displayRotation = activeDrag?.rotation ?? style.rotation ?? 0;
  const rotationsMixed = hasSelection && selected.length > 1 && !activeDrag &&
    new Set(selected.map(b => b.canvasStyleExt?.rotation ?? 0)).size > 1;

  const isArrow = ref?.shapeKind === 'arrow' || ref?.shapeKind === 'line' || ref?.shapeKind === 'freedraw';
  let arrowBounds: { x: number; y: number; w: number; h: number } | null = null;
  if (isArrow && ref?.points?.length) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of ref.points) {
      if (p[0] < minX) minX = p[0];
      if (p[1] < minY) minY = p[1];
      if (p[0] > maxX) maxX = p[0];
      if (p[1] > maxY) maxY = p[1];
    }
    const pad = 6 + (ref.endArrowhead?.size ?? 1) * 8;
    arrowBounds = { x: minX - pad, y: minY - pad, w: Math.max(maxX - minX + pad * 2, 1), h: Math.max(maxY - minY + pad * 2, 1) };
  }

  function updateStyle(patch: Partial<CanvasStyleExt>) {
    if (hasSelection) {
      if ('rotation' in patch && selected.length > 1) {
        // Group rotation: orbit all blocks around the group's center
        const firstRotation = selected[0].canvasStyleExt?.rotation ?? 0;
        const newRotation = patch.rotation ?? 0;
        const deltaDeg = newRotation - firstRotation;
        if (deltaDeg !== 0) {
          // Compute group bounding box center from current positions
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          selected.forEach(b => {
            const bx = b.x ?? 0, by = b.y ?? 0, bw = b.width ?? 0, bh = b.height ?? 0;
            const s = b.canvasStyleExt ?? {};
            const sw = (s.strokeWidth ?? 1.5) / 2;
            let l = bx - sw, t = by - sw, r = bx + bw + sw, bt = by + bh + sw;
            if (l < minX) minX = l;
            if (t < minY) minY = t;
            if (r > maxX) maxX = r;
            if (bt > maxY) maxY = bt;
          });
          const groupCx = (minX + maxX) / 2;
          const groupCy = (minY + maxY) / 2;

          const rad = (deltaDeg * Math.PI) / 180;
          const cos = Math.cos(rad);
          const sin = Math.sin(rad);

          selected.forEach(b => {
            const bx = b.x ?? 0, by = b.y ?? 0, bw = b.width ?? 0, bh = b.height ?? 0;
            const relCx = bx + bw / 2 - groupCx;
            const relCy = by + bh / 2 - groupCy;
            const newRelCx = relCx * cos - relCy * sin;
            const newRelCy = relCx * sin + relCy * cos;

            let blockRotation = ((b.canvasStyleExt?.rotation ?? 0) + deltaDeg) % 360;
            if (blockRotation > 180) blockRotation -= 360;

            updateCanvasBlock(b.id, {
              x: groupCx + newRelCx - bw / 2,
              y: groupCy + newRelCy - bh / 2,
              canvasStyleExt: { ...(b.canvasStyleExt ?? {}), rotation: blockRotation },
            });
          });
        }
      } else {
        selected.forEach(b => {
          let extra = {};
          if ('rotation' in patch && (b.shapeKind === 'arrow' || b.shapeKind === 'line' || b.shapeKind === 'freedraw')) {
            const resolved = resolvePoints(b, blocks);
            const { minX, minY, maxX, maxY } = calculateSplineBounds(resolved, b.editMode, b.pointRadiuses);
            const pad = 6;
            const cx = minX - pad + Math.max(maxX - minX + pad * 2, 1) / 2;
            const cy = minY - pad + Math.max(maxY - minY + pad * 2, 1) / 2;
            if (!b.canvasStyleExt?.pivot) {
              extra = { pivot: [cx, cy] };
            }
          }
          updateCanvasBlock(b.id, { canvasStyleExt: { ...(b.canvasStyleExt ?? {}), ...patch, ...extra } });
        });
      }
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

  // Arrow-specific geometry handlers — translate/scale points instead of setting block.x/y/width/height
  function handleArrowPosChange(deltaX: number, deltaY: number) {
    if (!isArrow || !ref?.points) return;
    selected.forEach(b => {
      if (b.points) {
        updateCanvasBlock(b.id, {
          points: b.points.map(p => [p[0] + deltaX, p[1] + deltaY] as [number, number])
        });
      }
    });
  }
  function handleArrowXChange(newX: number) {
    if (!isArrow || !arrowBounds || !ref?.points) return;
    const delta = newX - arrowBounds.x;
    handleArrowPosChange(delta, 0);
  }
  function handleArrowYChange(newY: number) {
    if (!isArrow || !arrowBounds || !ref?.points) return;
    const delta = newY - arrowBounds.y;
    handleArrowPosChange(0, delta);
  }
  function handleArrowWidthChange(newW: number) {
    if (!isArrow || !arrowBounds || !ref?.points || arrowBounds.w <= 0) return;
    const pad = 6 + (ref.endArrowhead?.size ?? 1) * 8;
    const currentSpan = arrowBounds.w - 2 * pad;
    const targetSpan = Math.max(1, newW - 2 * pad);
    const scale = targetSpan / currentSpan;
    const minX = Math.min(...ref.points.map(p => p[0]));
    selected.forEach(b => {
      if (b.points) {
        const pts = b.points;
        const localMinX = Math.min(...pts.map(p => p[0]));
        updateCanvasBlock(b.id, {
          points: pts.map(p => [localMinX + (p[0] - localMinX) * scale, p[1]] as [number, number])
        });
      }
    });
  }
  function handleArrowHeightChange(newH: number) {
    if (!isArrow || !arrowBounds || !ref?.points || arrowBounds.h <= 0) return;
    const pad = 6 + (ref.endArrowhead?.size ?? 1) * 8;
    const currentSpan = arrowBounds.h - 2 * pad;
    const targetSpan = Math.max(1, newH - 2 * pad);
    const scale = targetSpan / currentSpan;
    const minY = Math.min(...ref.points.map(p => p[1]));
    selected.forEach(b => {
      if (b.points) {
        const pts = b.points;
        const localMinY = Math.min(...pts.map(p => p[1]));
        updateCanvasBlock(b.id, {
          points: pts.map(p => [p[0], localMinY + (p[1] - localMinY) * scale] as [number, number])
        });
      }
    });
  }

  return (
    <>
      <div ref={outerRef} className="relative">
      <div className="w-[250px] flex flex-col overflow-y-auto canvas-floating-panel" style={{ background: 'var(--app-panel)', border: '1px solid var(--bone-12)', borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.12)', maxHeight: 'calc(100vh - 100px)' }}>

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
                    value={Math.round(isArrow && arrowBounds ? arrowBounds.x : displayX)}
                    onChange={v => isArrow && arrowBounds ? handleArrowXChange(Number(v) || 0) : updateGeom({ x: Number(v) || 0 })}
                    scrub={{
                      value: isArrow && arrowBounds ? arrowBounds.x : displayX,
                      onChange: v => isArrow && arrowBounds ? handleArrowXChange(v) : updateGeom({ x: v })
                    }}
                  />
                  <SidebarInput
                    prefix={<span className="text-[11px] font-bold leading-none select-none">Y</span>}
                    value={Math.round(isArrow && arrowBounds ? arrowBounds.y : displayY)}
                    onChange={v => isArrow && arrowBounds ? handleArrowYChange(Number(v) || 0) : updateGeom({ y: Number(v) || 0 })}
                    scrub={{
                      value: isArrow && arrowBounds ? arrowBounds.y : displayY,
                      onChange: v => isArrow && arrowBounds ? handleArrowYChange(v) : updateGeom({ y: v })
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
                      value={rotationsMixed ? 'Mixed' : `${Math.round(displayRotation)}°`}
                      onChange={v => {
                        const num = parseInt(v.replace(/[^0-9-]/g, '')) || 0;
                        let d = (num % 360 + 360) % 360;
                        if (d > 180) d -= 360;
                        updateStyle({ rotation: d });
                      }}
                      scrub={{
                        value: rotationsMixed ? (style.rotation ?? 0) : displayRotation,
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
                      value={Math.round(isArrow && arrowBounds ? arrowBounds.w : displayWidth)}
                      onChange={v => isArrow && arrowBounds ? handleArrowWidthChange(Number(v) || 0) : handleWidthChange(Number(v) || 0)}
                      scrub={{
                        value: isArrow && arrowBounds ? arrowBounds.w : displayWidth,
                        onChange: v => isArrow && arrowBounds ? handleArrowWidthChange(v) : handleWidthChange(v),
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
                      value={Math.round(isArrow && arrowBounds ? arrowBounds.h : displayHeight)}
                      onChange={v => isArrow && arrowBounds ? handleArrowHeightChange(Number(v) || 0) : handleHeightChange(Number(v) || 0)}
                      scrub={{
                        value: isArrow && arrowBounds ? arrowBounds.h : displayHeight,
                        onChange: v => isArrow && arrowBounds ? handleArrowHeightChange(v) : handleHeightChange(v),
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

              {/* ─── Frame / Group Layout Panels ─────────────────────── */}

              {isSingleFrame && (
                <PanelSection title="Frame">
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <SidebarInput
                        prefix={<span className="text-[10px] text-[#888] font-mono">W</span>}
                        value={Math.round(ref?.width ?? 800)}
                        onChange={v => updateCanvasBlock(ref!.id, { width: Number(v) || 1 })}
                      />
                      <SidebarInput
                        prefix={<span className="text-[10px] text-[#888] font-mono">H</span>}
                        value={Math.round(ref?.height ?? 600)}
                        onChange={v => updateCanvasBlock(ref!.id, { height: Number(v) || 1 })}
                      />
                    </div>

                    <div className="flex items-center justify-between border-t border-[#2c2c2c] pt-2">
                      <span className="text-[11px] text-[var(--bone-40)]">Clip content</span>
                      <Toggle
                        checked={ref?.clipContent ?? false}
                        onChange={v => setFrameClipContent(ref!.id, v)}
                        size="sm"
                      />
                    </div>
                  </div>
                </PanelSection>
              )}

              {isGroupSelection && (() => {
                const bounds = computeGroupBounds(selected);
                return (
                  <PanelSection title="Layout">
                    <div className="text-[10px] font-ui-label text-[var(--bone-30)] mb-1">Dimensions</div>
                    <div className="flex gap-2">
                      <SidebarInput
                        prefix={<span className="text-[10px]">W</span>}
                        value={Math.round(bounds.width)}
                        onChange={() => {}}
                      />
                      <SidebarInput
                        prefix={<span className="text-[10px]">H</span>}
                        value={Math.round(bounds.height)}
                        onChange={() => {}}
                      />
                    </div>
                    {groupSpacing !== null && (
                      <PropRow label="Spacing">
                        <SidebarInput
                          prefix={<span className="text-[10px]">≡</span>}
                          value={groupSpacing}
                          onChange={v => {
                            const newGap = Number(v) || 0;
                            // Redistribute group members with the new gap
                            const yVals = selected.map(m => m.y ?? 0);
                            const ySpread = Math.max(...yVals) - Math.min(...yVals);
                            const isHorizontal = ySpread < 20;
                            const sorted = [...selected].sort((a, b) =>
                              isHorizontal ? (a.x ?? 0) - (b.x ?? 0) : (a.y ?? 0) - (b.y ?? 0)
                            );
                            // First block stays, shift subsequent blocks by newGap
                            const batch: { id: string; updates: Partial<EditorBlock> }[] = [];
                            let cursor = isHorizontal ? (sorted[0].x ?? 0) : (sorted[0].y ?? 0);
                            sorted.forEach((m, i) => {
                              const pos = isHorizontal ? (m.x ?? 0) : (m.y ?? 0);
                              const size = isHorizontal ? (m.width ?? 0) : (m.height ?? 0);
                              if (i === 0) {
                                cursor = pos + size + newGap;
                              } else {
                                if (isHorizontal && (m.x ?? 0) !== cursor) {
                                  batch.push({ id: m.id, updates: { x: cursor } });
                                } else if (!isHorizontal && (m.y ?? 0) !== cursor) {
                                  batch.push({ id: m.id, updates: { y: cursor } });
                                }
                                cursor += size + newGap;
                              }
                            });
                            if (batch.length > 0) updateCanvasBlocks(batch);
                          }}
                        />
                      </PropRow>
                    )}
                  </PanelSection>
                );
              })()}

            </>
          )}

          <PanelSection title="Appearance">
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

      {isSingleText && ref && (() => {
        const FONT_PRESETS: { label: string; size: number }[] = [
          { label: 'S', size: 16 },
          { label: 'M', size: 20 },
          { label: 'L', size: 28 },
          { label: 'XL', size: 36 },
        ];
        const currentFontSize = ref.fontSize ?? 20;
        return (
          <PanelSection title="Text">
            <div className="text-[10px] font-ui-label text-[var(--bone-30)] mb-1">Font size</div>
            <div className="flex gap-1 mb-2">
              {FONT_PRESETS.map(p => (
                <button
                  key={p.label}
                  onClick={() => updateCanvasBlock(ref.id, { fontSize: p.size })}
                  className={cn(
                    "flex-1 h-7 rounded-[var(--radius-small)] text-[11px] font-semibold transition-colors",
                    currentFontSize === p.size
                      ? "bg-[var(--bone-15)] text-[var(--bone-100)]"
                      : "bg-[var(--bone-6)] text-[var(--bone-60)] hover:bg-[var(--app-dark)] hover:text-[var(--bone-100)]"
                  )}
                >
                  {p.label}
                </button>
              ))}
              <div className="flex-1">
                <PillInput
                  value={currentFontSize}
                  onChange={v => {
                    const num = Math.max(8, parseInt(v.replace(/[^0-9]/g, '')) || 8);
                    updateCanvasBlock(ref.id, { fontSize: num });
                  }}
                />
              </div>
            </div>

            <div className="text-[10px] font-ui-label text-[var(--bone-30)] mb-1">Align</div>
            <div className="mb-2">
              <SliderGroup
                options={['left', 'center', 'right'] as const}
                value={ref.textAlign ?? 'left'}
                onChange={align => updateCanvasBlock(ref.id, { textAlign: align })}
                renderLabel={align => (
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    {align === 'left' && <path d="M2 4h12M2 8h8M2 12h10" />}
                    {align === 'center' && <path d="M2 4h12M4 8h8M3 12h10" />}
                    {align === 'right' && <path d="M2 4h12M6 8h8M4 12h10" />}
                  </svg>
                )}
              />
            </div>

            <div className="text-[10px] font-ui-label text-[var(--bone-30)] mb-1">Color</div>
            <div className="flex items-center gap-2">
              <div className={cn(
                "flex-1 flex items-center h-7 rounded-[var(--radius-small)] border px-2 gap-2 relative transition-all duration-150",
                activePicker === 'border'
                  ? "border-[var(--bone-30)] bg-[var(--app-dark)]"
                  : "border-transparent bg-[var(--bone-6)] hover:bg-[var(--app-dark)]"
              )}>
                <div className="relative w-3.5 h-3.5 rounded-[3px] border border-[var(--bone-15)] flex-shrink-0 cursor-pointer color-swatch-trigger overflow-hidden">
                  <button
                    onClick={(e) => togglePicker('border', e)}
                    className="w-full h-full rounded-[3px] block transition-none"
                    style={{ backgroundColor: style.stroke && style.stroke !== 'transparent' ? style.stroke : 'var(--bone-90)' }}
                  />
                </div>
                <input
                  type="text"
                  value={!style.stroke || style.stroke === 'transparent' ? 'BONE90' : style.stroke.replace('#', '').toUpperCase()}
                  onChange={e => {
                    const hex = e.target.value.replace(/[^0-9a-fA-F]/g, '');
                    if (hex.length <= 6) updateStyle({ stroke: '#' + hex });
                  }}
                  className="w-full bg-transparent border-none outline-none text-[11px] text-[var(--bone-90)] focus:text-[var(--bone-100)] p-0 m-0 uppercase"
                />
              </div>
            </div>
          </PanelSection>
        );
      })()}

      {!isSingleText && (!ref?.shapeKind || !['arrow', 'line', 'freedraw'].includes(ref.shapeKind)) && (
      <PanelSection title="Fill">
        <div className="flex flex-col gap-1 mb-1">
          <span className="text-[10px] font-ui-label text-[var(--bone-30)] select-none">Color</span>
          <div className="flex items-center gap-2">
            <div className={cn(
              "flex-1 flex items-center h-7 rounded-[var(--radius-small)] border px-2 gap-2 relative transition-all duration-150",
              activePicker === 'fill'
                ? "border-[var(--bone-30)] bg-[var(--app-dark)]"
                : "border-transparent bg-[var(--bone-6)] hover:bg-[var(--app-dark)]",
              hiddenColors['fill'] && "opacity-40"
            )}>
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
              onClick={() => {
                const isNowHidden = !hiddenColors['fill'];
                if (isNowHidden) {
                  // Hide fill — save current and set transparent
                  prevFillRef.current = style.fill && style.fill !== 'transparent' ? style.fill : '#ffffff';
                  prevFillOpacityRef.current = style.fillOpacity ?? 1;
                  updateStyle({ fill: 'transparent', fillOpacity: 0 });
                } else {
                  // Show fill — restore saved
                  updateStyle({ fill: prevFillRef.current, fillOpacity: prevFillOpacityRef.current });
                }
                setHiddenColors(prev => ({ ...prev, fill: isNowHidden }));
              }}
              className="w-7 h-7 rounded-[var(--radius-small)] flex items-center justify-center border border-transparent bg-[var(--bone-6)] hover:bg-[var(--app-dark)] text-[var(--bone-30)] hover:text-[var(--bone-100)] flex-shrink-0"
              title={hiddenColors['fill'] ? 'Show fill' : 'Hide fill'}
            >
              {hiddenColors['fill'] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </PanelSection>
      )}

      {/* Stroke — text blocks get their own "Text" section (font size/align/color) instead */}
      {!isSingleText && (
      <PanelSection title="Stroke">
        <div className="flex flex-col gap-1 mb-1">
          <span className="text-[10px] font-ui-label text-[var(--bone-30)] select-none">Color</span>
          <div className="flex items-center gap-2">
            <div className={cn(
              "flex-1 flex items-center h-7 rounded-[var(--radius-small)] border px-2 gap-2 relative transition-all duration-150",
              activePicker === 'border'
                ? "border-[var(--bone-30)] bg-[var(--app-dark)]"
                : "border-transparent bg-[var(--bone-6)] hover:bg-[var(--app-dark)]",
              hiddenColors['border'] && "opacity-40"
            )}>
              <div className="relative w-3.5 h-3.5 rounded-[3px] border border-[var(--bone-15)] flex-shrink-0 cursor-pointer color-swatch-trigger overflow-hidden">
                <button
                  onClick={(e) => togglePicker('border', e)}
                  className="w-full h-full rounded-[3px] block transition-none"
                  style={{ backgroundColor: style.stroke && style.stroke !== 'transparent' ? style.stroke : 'transparent', opacity: style.strokeOpacity ?? 1 }}
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
                value={Math.round((style.strokeOpacity ?? 1) * 100)}
                onChange={e => {
                  const num = Math.min(100, Math.max(0, parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0));
                  updateStyle({ strokeOpacity: num / 100 });
                }}
                className="w-[26px] bg-transparent border-none outline-none text-[11px] text-[var(--bone-90)] focus:text-[var(--bone-100)] p-0 m-0 text-right"
              />
              <span
                onPointerDown={makeScrub(
                  (style.strokeOpacity ?? 1) * 100,
                  v => updateStyle({ strokeOpacity: v / 100 }),
                  1, 0, 100
                )}
                className="cursor-ew-resize select-none text-[10px] text-[var(--bone-40)] font-ui-label flex-shrink-0"
              >%</span>
            </div>
            <button
              onClick={() => {
                const isNowHidden = !hiddenColors['border'];
                if (isNowHidden) {
                  // Hide border — save current and set transparent
                  prevStrokeRef.current = style.stroke && style.stroke !== 'transparent' ? style.stroke : '#ffffff';
                  prevStrokeOpacityRef.current = style.strokeOpacity ?? 1;
                  updateStyle({ stroke: 'transparent', strokeOpacity: 0 });
                } else {
                  // Show border — restore saved
                  updateStyle({ stroke: prevStrokeRef.current, strokeOpacity: prevStrokeOpacityRef.current });
                }
                setHiddenColors(prev => ({ ...prev, border: isNowHidden }));
              }}
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
      )}

      {ref && (ref.shapeKind === 'arrow' || ref.shapeKind === 'line') && (
        <PanelSection title="Arrowheads">
          <div className="flex gap-2">
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-ui-label text-[var(--bone-30)] mb-1">Size</div>
              <SidebarInput
                prefix={
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 14l12-12M8 2h6v6" />
                  </svg>
                }
                value={Math.round((ref.endArrowhead?.size ?? 1) * 10) / 10}
                onChange={v => {
                  const val = parseFloat(v.replace(/[^0-9.]/g, '')) || 1;
                  const size = Math.min(3, Math.max(0.5, val));
                  updateBlockFields({
                    endArrowhead: { ...ref.endArrowhead ?? { type: 'filled-triangle' }, size },
                    startArrowhead: ref.startArrowhead?.type !== 'none'
                      ? { ...ref.startArrowhead ?? { type: 'none' }, size }
                      : ref.startArrowhead,
                  });
                }}
                scrub={{
                  value: ref.endArrowhead?.size ?? 1,
                  onChange: v => {
                    const size = Math.min(3, Math.max(0.5, v));
                    updateBlockFields({
                      endArrowhead: { ...ref.endArrowhead ?? { type: 'filled-triangle' }, size },
                      startArrowhead: ref.startArrowhead?.type !== 'none'
                        ? { ...ref.startArrowhead ?? { type: 'none' }, size }
                        : ref.startArrowhead,
                    });
                  },
                  step: 0.1,
                  min: 0.5
                }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-ui-label text-[var(--bone-30)] mb-1">Start</div>
              <ArrowheadDropdown
                value={ref.startArrowhead?.type ?? 'none'}
                onChange={type => updateBlockFields({
                  startArrowhead: { type: type as any, size: ref.startArrowhead?.size ?? 1 }
                })}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-ui-label text-[var(--bone-30)] mb-1">End</div>
              <ArrowheadDropdown
                value={ref.endArrowhead?.type ?? 'filled-triangle'}
                align="right"
                onChange={type => updateBlockFields({
                  endArrowhead: { type: type as any, size: ref.endArrowhead?.size ?? 1 }
                })}
              />
            </div>
          </div>
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
        title="Background"
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
            <div className={cn(
              "flex-1 flex items-center h-7 rounded-[var(--radius-small)] border px-2 gap-2 relative transition-all duration-150",
              activePicker === 'bg'
                ? "border-[var(--bone-30)] bg-[var(--app-dark)]"
                : "border-transparent bg-[var(--bone-6)] hover:bg-[var(--app-dark)]"
            )}>
              {/* Color swatch square */}
              <div className="relative w-3.5 h-3.5 rounded-[3px] border border-[var(--bone-15)] flex-shrink-0 cursor-pointer color-swatch-trigger overflow-hidden">
                <button
                  onClick={(e) => togglePicker('bg', e)}
                  className="w-full h-full rounded-[3px] block transition-none"
                  style={{ backgroundColor: canvasBgColor === 'default' ? 'var(--app-background)' : canvasBgColor, opacity: canvasBgOpacity }}
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
                value={Math.round(canvasBgOpacity * 100)}
                onChange={e => {
                  const num = Math.min(100, Math.max(0, parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0));
                  onCanvasBgOpacityChange(num / 100);
                }}
                className="w-[26px] bg-transparent border-none outline-none text-[11px] text-[var(--bone-90)] focus:text-[var(--bone-100)] p-0 m-0 text-right"
              />
              <span
                onPointerDown={makeScrub(
                  canvasBgOpacity * 100,
                  v => onCanvasBgOpacityChange(v / 100),
                  1, 0, 100
                )}
                className="cursor-ew-resize select-none text-[10px] text-[var(--bone-40)] font-ui-label flex-shrink-0"
              >%</span>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <button
              onClick={() => onCaptureBgChange(!captureBg)}
              className="w-4 h-4 rounded-[4px] border flex items-center justify-center shrink-0 border-[var(--bone-30)] hover:border-[var(--bone-70)] bg-[var(--bone-6)] hover:bg-[var(--app-dark)] transition-colors duration-200 ease-in-out"
            >
              {captureBg && <Check className="w-[10px] h-[10px] text-[var(--bone-100)] stroke-[3px]" />}
            </button>
            <span className="text-[10px] font-ui-label text-[var(--bone-60)] select-none">Show in exports</span>
          </div>
        </div>
      </PanelSection>

      <PanelSection 
        title="Pattern"
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
              <div className={cn(
                "flex-1 flex items-center h-7 rounded-[var(--radius-small)] border px-2 gap-2 relative transition-all duration-150",
                activePicker === 'pattern'
                  ? "border-[var(--bone-30)] bg-[var(--app-dark)]"
                  : "border-transparent bg-[var(--bone-6)] hover:bg-[var(--app-dark)]"
              )}>
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
        <div
          onClick={() => {
            setHasGeneratedPreview(true);
            handleCapture();
          }}
          className={cn(
            "relative w-full overflow-hidden rounded-[var(--radius-medium)] border border-[var(--bone-6)] flex items-center justify-center cursor-pointer hover:border-[var(--bone-30)] transition-colors",
            capturing && "skeleton-shimmer-fast",
            previewUrl && !captureBg && "transparency-grid",
            !(previewUrl && !captureBg) && "bg-[var(--bone-5)]"
          )}
          style={{ aspectRatio: '16/10' }}
                >
          {!capturing && (previewUrl ? (
            <img src={previewUrl} alt="Export preview" className="w-full h-full object-contain" />
          ) : (
            <div className="flex flex-col items-center justify-center gap-1">
              <Camera className="w-5 h-5 text-[var(--bone-30)]" />
              <span className="text-[10px] text-[var(--bone-30)]">Click to capture preview</span>
            </div>
          ))}
          {capturing && (
            <div className="absolute inset-0 rounded-[var(--radius-small)] flex flex-col items-center justify-center gap-1.5">
              <Scan className="w-5 h-5 text-[var(--bone-30)]" />
              <span className="text-[11px] font-ui-label text-[var(--bone-40)]">Capturing preview…</span>
            </div>
          )}
        </div>

        {previewUrl && previewSize && (
          <div className="flex items-center justify-center mt-1 text-[10px] font-ui-label text-[var(--bone-40)] select-none">
            {previewSize.w} × {previewSize.h} px
          </div>
        )}

        <div className="mt-2">
          <span className="text-[10px] font-ui-label text-[var(--bone-60)] block mb-1">Filename &amp; Format</span>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={fileName}
              onChange={e => onFileNameChange(e.target.value)}
              className="flex-[2] h-7 bg-[var(--bone-6)] rounded-[var(--radius-small)] border border-transparent hover:bg-[var(--app-dark)] px-2 text-[11px] text-[var(--bone-90)] focus:text-[var(--bone-100)] outline-none transition-none"
            />
            <ExportSelect
              value={exportFormat}
              onChange={v => onExportFormatChange(v as any)}
              options={[
                { value: 'png', label: 'PNG' },
                { value: 'jpg', label: 'JPG' },
                { value: 'svg', label: 'SVG' },
              ]}
            />
          </div>
        </div>

        <div className="flex gap-2 mt-2">
          <div className="flex-1">
            <span className="text-[10px] font-ui-label text-[var(--bone-30)] block mb-1">Scale</span>
            <ExportSelect
              value={String(captureScale)}
              onChange={v => onCaptureScaleChange(Number(v))}
              options={[
                { value: '0.5', label: '0.5x' },
                { value: '0.75', label: '0.75x' },
                { value: '1', label: '1x' },
                { value: '1.5', label: '1.5x' },
                { value: '2', label: '2x' },
                { value: '3', label: '3x' },
                { value: '5', label: '5x' },
              ]}
            />
          </div>
          <div className="flex-1">
            <span className="text-[10px] font-ui-label text-[var(--bone-30)] block mb-1">Ratio</span>
            <ExportSelect
              value={captureRatio}
              onChange={v => onCaptureRatioChange(v as any)}
              align="right"
              popupWidth={95}
              options={[
                { value: 'screen', label: 'Screen' },
                { value: '16:9', label: '16:9' },
                { value: '4:3', label: '4:3' },
                { value: '1:1', label: '1:1' },
              ]}
            />
          </div>
          <div className="flex-1">
            <span className="text-[10px] font-ui-label text-[var(--bone-30)] block mb-1">Orient</span>
            <ExportSelect
              value={captureOrientation}
              onChange={v => onCaptureOrientationChange(v as any)}
              iconOnly
              align="right"
              popupWidth={120}
              options={[
                { value: 'horizontal', label: 'Horizontal', icon: <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1.5" y="4" width="13" height="8" rx="1.5" /></svg> },
                { value: 'vertical', label: 'Vertical', icon: <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="4" y="1.5" width="8" height="13" rx="1.5" /></svg> },
              ]}
            />
          </div>
        </div>

        {previewUrl && (
          <div className="flex gap-2 mt-2">
            <button
              onClick={async () => {
                if (copySuccess) return;
                try {
                  const res = await fetch(previewUrl);
                  const blob = await res.blob();
                  const mime = exportFormat === 'jpg' ? 'image/jpeg' : 'image/png';
                  await navigator.clipboard.write([new ClipboardItem({ [mime]: blob })]);
                } catch {}
                setCopySuccess(true);
                setTimeout(() => setCopySuccess(false), 1500);
              }}
              className={cn(
                "flex-1 h-7 rounded-[var(--radius-small)] text-[11px] font-semibold transition-none cursor-pointer flex items-center justify-center gap-1",
                copySuccess
                  ? "bg-[#22c55e1a] text-[#22c55e]"
                  : "bg-[var(--bone-6)] hover:bg-[var(--app-dark)] text-[var(--bone-60)] hover:text-[var(--bone-100)]"
              )}
            >
              {copySuccess ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copySuccess ? 'Copied' : 'Copy'}
            </button>
            <button
              onClick={() => {
                if (downloadSuccess) return;
                const a = document.createElement('a');
                a.href = previewUrl;
                a.download = `${fileName}.${exportFormat}`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setDownloadSuccess(true);
                setTimeout(() => setDownloadSuccess(false), 1500);
              }}
              className={cn(
                "flex-1 h-7 rounded-[var(--radius-small)] text-[11px] font-semibold transition-none cursor-pointer flex items-center justify-center gap-1",
                downloadSuccess
                  ? "bg-[#22c55e1a] text-[#22c55e]"
                  : "bg-[var(--bone-6)] hover:bg-[var(--app-dark)] text-[var(--bone-60)] hover:text-[var(--bone-100)]"
              )}
            >
              {downloadSuccess ? <Check className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
              {downloadSuccess ? 'Downloaded' : 'Download'}
            </button>
          </div>
        )}
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
            activePicker === 'border' ? (style.strokeOpacity ?? 1) :
            activePicker === 'bg' ? canvasBgOpacity :
            canvasPatternOpacity
          }
          onChange={(color, opacity) => {
            if (activePicker === 'fill') {
              updateStyle({ fill: color, fillOpacity: opacity });
            } else if (activePicker === 'border') {
              updateStyle({ stroke: color, strokeOpacity: opacity });
            } else if (activePicker === 'bg') {
              onCanvasBgColorChange(color);
              onCanvasBgOpacityChange(opacity);
            } else if (activePicker === 'pattern') {
              onCanvasPatternColorChange(color);
              onCanvasPatternOpacityChange(opacity);
            }
          }}
          onClose={() => setActivePicker(null)}
          style={{
            left: `${pickerPos.left}px`,
            top: `${pickerPos.top}px`,
          }}
        />
      )}
    </div>
    </>   );
}
