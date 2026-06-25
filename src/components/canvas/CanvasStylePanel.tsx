"use client";

import { useStore, EditorBlock, CanvasStyleExt } from '@/data/store';
import { cn } from '@/lib/utils';
import { Toggle } from '../ui/Toggle';

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
}

const FILL_PRESETS = [
  { label: 'None',    value: 'transparent', opacity: 0 },
  { label: 'White',   value: '#ffffff',     opacity: 1.0 },
  { label: 'Accent',  value: '#d38f36',     opacity: 0.15 },
  { label: 'Blue',    value: '#5b9cf6',     opacity: 0.15 },
  { label: 'Purple',  value: '#a78bfa',     opacity: 0.15 },
  { label: 'Green',   value: '#4ade80',     opacity: 0.15 },
  { label: 'Red',     value: '#f87171',     opacity: 0.15 },
  { label: 'Subtle',  value: '#E9E9E2',     opacity: 0.07 },
];

const STROKE_PRESETS = [
  { label: 'None',   value: 'transparent' },
  { label: 'White',  value: '#ffffff' },
  { label: 'Accent', value: '#d38f36' },
  { label: 'Blue',   value: '#5b9cf6' },
  { label: 'Purple', value: '#a78bfa' },
  { label: 'Green',  value: '#4ade80' },
  { label: 'Red',    value: '#f87171' },
  { label: 'Bone',   value: '#E9E9E2' },
];

function PanelSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-3 py-2.5 border-b border-[var(--bone-10)]">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-ui-label font-medium uppercase tracking-wide text-[var(--bone-60)]">{title}</span>
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
          className="w-[44px] text-[11px] text-[var(--bone-60)] hover:text-[var(--bone-100)] active:text-[var(--brand-blue)] cursor-ew-resize select-none flex-shrink-0 transition-colors"
          title="Drag left/right to scrub value"
        >
          {label}
        </span>
      ) : (
        <span className="w-[44px] text-[11px] text-[var(--bone-60)] flex-shrink-0">{label}</span>
      )}
      <div className="flex-1 flex items-center gap-1">{children}</div>
    </div>
  );
}

function PillInput({ value, onChange }: { value: string | number; onChange: (v: string) => void }) {
  return (
    <input
      className="flex-1 w-0 h-7 min-w-0 bg-[var(--bone-5)] rounded-[var(--radius-small)] text-center text-[11px] text-[var(--bone-70)] border border-[var(--bone-12)] outline-none focus:border-[var(--brand-blue)] focus:bg-[var(--bone-10)] focus:text-[var(--bone-100)] transition-none shadow-inner"
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
      className="flex-1 h-7 rounded-[var(--radius-small)] flex items-center justify-center text-[var(--bone-60)] hover:bg-[var(--bone-10)] hover:text-[var(--bone-100)] transition-none"
    >
      {children}
    </button>
  );
}

export function CanvasStylePanel({
  selectedIds, canvasId,
  onAlignLeft, onAlignCenterH, onAlignRight,
  onAlignTop, onAlignCenterV, onAlignBottom,
  activeStyle, onChangeActiveStyle,
}: Props) {
  const blocks = useStore(s => s.blocks);
  const updateCanvasBlock = useStore(s => s.updateCanvasBlock);

  const selected = blocks.filter(b => selectedIds.has(b.id));
  const hasSelection = selected.length > 0;

  const ref = hasSelection ? selected[0] : null;
  const style = hasSelection ? (ref?.canvasStyleExt ?? {}) : activeStyle;

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

  return (
    <div className="w-[250px] bg-sidebar border-l border-[var(--bone-10)] flex flex-col flex-shrink-0 overflow-y-auto z-10">

      {/* Alignment bar */}
      {hasSelection && (
        <div className="px-2.5 py-2 border-b border-border/30 flex items-center gap-[2px]">
          <AlignBtn title="Align left"     onClick={onAlignLeft}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2" y="3" width="5" height="2.5" rx="0.8" fill="currentColor"/><rect x="2" y="7" width="9" height="2.5" rx="0.8" fill="currentColor" opacity="0.4"/><rect x="1.5" y="2" width="1" height="10" rx="0.5" fill="currentColor" opacity="0.5"/></svg>
          </AlignBtn>
          <AlignBtn title="Align center H"  onClick={onAlignCenterH}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="3.5" y="3" width="7" height="2.5" rx="0.8" fill="currentColor"/><rect x="2" y="7" width="10" height="2.5" rx="0.8" fill="currentColor" opacity="0.4"/><rect x="6.5" y="2" width="1" height="10" rx="0.5" fill="currentColor" opacity="0.5"/></svg>
          </AlignBtn>
          <AlignBtn title="Align right"    onClick={onAlignRight}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="7" y="3" width="5" height="2.5" rx="0.8" fill="currentColor"/><rect x="3" y="7" width="9" height="2.5" rx="0.8" fill="currentColor" opacity="0.4"/><rect x="11.5" y="2" width="1" height="10" rx="0.5" fill="currentColor" opacity="0.5"/></svg>
          </AlignBtn>
          <div className="w-px h-[14px] bg-border/30 mx-[2px]" />
          <AlignBtn title="Align top"      onClick={onAlignTop}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="3" y="4" width="2.5" height="5" rx="0.8" fill="currentColor"/><rect x="7" y="2.5" width="2.5" height="9" rx="0.8" fill="currentColor" opacity="0.4"/><rect x="2" y="1.5" width="10" height="1" rx="0.5" fill="currentColor" opacity="0.5"/></svg>
          </AlignBtn>
          <AlignBtn title="Align center V" onClick={onAlignCenterV}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="3" y="4" width="2.5" height="5" rx="0.8" fill="currentColor"/><rect x="7" y="2.5" width="2.5" height="9" rx="0.8" fill="currentColor" opacity="0.4"/><rect x="2" y="6.5" width="10" height="1" rx="0.5" fill="currentColor" opacity="0.5"/></svg>
          </AlignBtn>
          <AlignBtn title="Align bottom"   onClick={onAlignBottom}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="3" y="4" width="2.5" height="5" rx="0.8" fill="currentColor"/><rect x="7" y="2.5" width="2.5" height="9" rx="0.8" fill="currentColor" opacity="0.4"/><rect x="2" y="11.5" width="10" height="1" rx="0.5" fill="currentColor" opacity="0.5"/></svg>
          </AlignBtn>
        </div>
      )}

      {/* Size */}
      {hasSelection && ref && (
        <PanelSection title="Size">
          <PropRow
            label="Width"
            scrub={{
              value: ref.width ?? 0,
              onChange: (v) => updateGeom({ width: v }),
              min: 20
            }}
          >
            <PillInput value={Math.round(ref.width ?? 0)} onChange={v => updateGeom({ width: Number(v) || 0 })} />
          </PropRow>
          <PropRow
            label="Height"
            scrub={{
              value: ref.height ?? 0,
              onChange: (v) => updateGeom({ height: v }),
              min: 20
            }}
          >
            <PillInput value={Math.round(ref.height ?? 0)} onChange={v => updateGeom({ height: Number(v) || 0 })} />
          </PropRow>
          <PropRow label="Position">
            <div className="flex-1 flex items-center gap-1">
              <span
                onPointerDown={(e) => {
                  e.preventDefault();
                  const startX = e.clientX;
                  const startValue = ref.x ?? 0;
                  const handlePointerMove = (ev: PointerEvent) => {
                    const dx = ev.clientX - startX;
                    updateGeom({ x: Math.round(startValue + dx) });
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
                className="text-[10px] text-[var(--bone-40)] hover:text-[var(--bone-100)] cursor-ew-resize select-none pr-0.5"
                title="Drag to scrub X"
              >
                X
              </span>
              <PillInput value={Math.round(ref.x ?? 0)} onChange={v => updateGeom({ x: Number(v) || 0 })} />
            </div>
            <div className="flex-1 flex items-center gap-1">
              <span
                onPointerDown={(e) => {
                  e.preventDefault();
                  const startX = e.clientX;
                  const startValue = ref.y ?? 0;
                  const handlePointerMove = (ev: PointerEvent) => {
                    const dx = ev.clientX - startX;
                    updateGeom({ y: Math.round(startValue + dx) });
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
                className="text-[10px] text-[var(--bone-40)] hover:text-[var(--bone-100)] cursor-ew-resize select-none pr-0.5"
                title="Drag to scrub Y"
              >
                Y
              </span>
              <PillInput value={Math.round(ref.y ?? 0)} onChange={v => updateGeom({ y: Number(v) || 0 })} />
            </div>
          </PropRow>
        </PanelSection>
      )}

      {/* Fill */}
      <PanelSection title="Fill">
        <PropRow label="Color">
          <div className="flex gap-[3px] flex-wrap">
            {FILL_PRESETS.map(p => (
              <button
                key={p.value}
                title={p.label}
                onClick={() => updateStyle({ fill: p.value, fillOpacity: p.opacity })}
                className={cn(
                  "w-5 h-5 rounded-full",
                  style.fill === p.value && "ring-2 ring-offset-1 ring-offset-[var(--app-panel)] ring-[var(--bone-60)]"
                )}
                style={{ background: p.value === 'transparent' ? 'transparent' : p.value, border: p.value === 'transparent' ? '1.5px solid var(--border-outer)' : 'none' }}
              />
            ))}
          </div>
        </PropRow>
        <PropRow label="Opacity">
          <input
            type="range" min={0} max={1} step={0.01}
            value={style.fillOpacity ?? 0.15}
            onChange={e => updateStyle({ fillOpacity: Number(e.target.value) })}
            className="flex-1 h-[3px] rounded-full accent-[var(--accent)]"
          />
          <span className="text-[11px] text-[var(--bone-40)] w-8 text-right">
            {Math.round((style.fillOpacity ?? 0.15) * 100)}%
          </span>
        </PropRow>
      </PanelSection>

      {/* Border */}
      <PanelSection title="Border">
        <PropRow label="Color">
          <div className="flex gap-[3px] flex-wrap">
            {STROKE_PRESETS.map(p => (
              <button
                key={p.value}
                title={p.label}
                onClick={() => updateStyle({ stroke: p.value })}
                className={cn(
                  "w-5 h-5 rounded-full",
                  style.stroke === p.value && "ring-2 ring-offset-1 ring-offset-[var(--app-panel)] ring-[var(--bone-60)]"
                )}
                style={{ background: p.value === 'transparent' ? 'transparent' : p.value, border: p.value === 'transparent' ? '1.5px solid var(--border-outer)' : 'none' }}
              />
            ))}
          </div>
        </PropRow>
        <PropRow
          label="Width"
          scrub={{
            value: style.strokeWidth ?? 1.5,
            onChange: (v) => updateStyle({ strokeWidth: v }),
            step: 0.5,
            min: 0
          }}
        >
          <PillInput value={style.strokeWidth ?? 1.5} onChange={v => updateStyle({ strokeWidth: Number(v) || 1 })} />
          <div className="flex bg-[var(--bone-5)] rounded-[var(--radius-small)] p-[2px] gap-[1px]">
            {(['solid', 'dashed', 'dotted'] as const).map(ss => (
              <button
                key={ss}
                onClick={() => updateStyle({ strokeStyle: ss })}
                className={cn(
                  "px-1.5 h-5 rounded-[var(--radius-tiny)] text-[10px] transition-none",
                  (style.strokeStyle ?? 'solid') === ss
                    ? "bg-[var(--bone-15)] text-[var(--bone-100)] font-semibold"
                    : "text-[var(--bone-60)] hover:text-[var(--bone-100)]"
                )}
              >
                {ss === 'solid' ? '—' : ss === 'dashed' ? '- -' : '···'}
              </button>
            ))}
          </div>
        </PropRow>
        <PropRow
          label="Radius"
          scrub={{
            value: style.cornerRadius ?? 0,
            onChange: (v) => updateStyle({ cornerRadius: v }),
            min: 0
          }}
        >
          <PillInput value={style.cornerRadius ?? 0} onChange={v => updateStyle({ cornerRadius: Number(v) || 0 })} />
        </PropRow>
      </PanelSection>

      {/* Options */}
      {hasSelection && (
        <PanelSection title="Options">
          <PropRow label="Visible">
            <Toggle
              checked={((style.opacity ?? 1) > 0)}
              onChange={(checked) => updateStyle({ opacity: checked ? 1 : 0 })}
              size="sm"
            />
          </PropRow>
          <PropRow label="Locked">
            <Toggle
              checked={style.locked ?? false}
              onChange={(checked) => updateStyle({ locked: checked })}
              size="sm"
            />
          </PropRow>
        </PanelSection>
      )}

    </div>
  );
}
