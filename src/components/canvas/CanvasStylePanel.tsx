"use client";

import { useStore, EditorBlock, CanvasStyleExt } from '@/data/store';
import clsx from 'clsx';

interface Props {
  selectedIds: Set<string>;
  canvasId: string;
  onAlignLeft: () => void;
  onAlignCenterH: () => void;
  onAlignRight: () => void;
  onAlignTop: () => void;
  onAlignCenterV: () => void;
  onAlignBottom: () => void;
}

const FILL_PRESETS = [
  { label: 'None',    value: 'transparent', opacity: 0 },
  { label: 'Accent',  value: '#d38f36',     opacity: 0.15 },
  { label: 'Blue',    value: '#5b9cf6',     opacity: 0.15 },
  { label: 'Purple',  value: '#a78bfa',     opacity: 0.15 },
  { label: 'Green',   value: '#4ade80',     opacity: 0.15 },
  { label: 'Red',     value: '#f87171',     opacity: 0.15 },
  { label: 'Subtle',  value: '#E9E9E2',     opacity: 0.07 },
];

const STROKE_PRESETS = [
  { label: 'None',   value: 'transparent' },
  { label: 'Accent', value: '#d38f36' },
  { label: 'Blue',   value: '#5b9cf6' },
  { label: 'Purple', value: '#a78bfa' },
  { label: 'Green',  value: '#4ade80' },
  { label: 'Red',    value: '#f87171' },
  { label: 'Bone',   value: '#E9E9E2' },
];

function PanelSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-3 py-2.5 border-b border-[rgba(233,233,226,0.06)]">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] text-[rgba(233,233,226,0.6)] font-medium">{title}</span>
      </div>
      {children}
    </div>
  );
}

function PropRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 min-h-[28px] mb-1 last:mb-0">
      <span className="w-[44px] text-[11px] text-[rgba(233,233,226,0.3)] flex-shrink-0">{label}</span>
      <div className="flex-1 flex items-center gap-1">{children}</div>
    </div>
  );
}

function PillInput({ value, onChange }: { value: string | number; onChange: (v: string) => void }) {
  return (
    <input
      className="flex-1 w-0 h-7 min-w-0 bg-[#232321] rounded-[6px] text-center text-[11px] text-[rgba(233,233,226,0.6)] border-none outline-none focus:bg-[rgba(233,233,226,0.1)] focus:text-[rgba(233,233,226,0.9)] transition-colors"
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
      className="flex-1 h-7 rounded-[6px] flex items-center justify-center text-[rgba(233,233,226,0.3)] hover:bg-[rgba(233,233,226,0.06)] hover:text-[rgba(233,233,226,0.6)] transition-colors"
    >
      {children}
    </button>
  );
}

export function CanvasStylePanel({
  selectedIds, canvasId,
  onAlignLeft, onAlignCenterH, onAlignRight,
  onAlignTop, onAlignCenterV, onAlignBottom,
}: Props) {
  const blocks = useStore(s => s.blocks);
  const updateCanvasBlock = useStore(s => s.updateCanvasBlock);

  const selected = blocks.filter(b => selectedIds.has(b.id));
  if (selected.length === 0) return null;

  const ref = selected[0];
  const style = ref.canvasStyleExt ?? {};

  function updateStyle(patch: Partial<CanvasStyleExt>) {
    selected.forEach(b =>
      updateCanvasBlock(b.id, { canvasStyleExt: { ...(b.canvasStyleExt ?? {}), ...patch } })
    );
  }

  function updateGeom(patch: Partial<Pick<EditorBlock, 'x' | 'y' | 'width' | 'height'>>) {
    selected.forEach(b => updateCanvasBlock(b.id, patch));
  }

  return (
    <div className="w-[250px] bg-[#1c1c1a] border-l border-[rgba(233,233,226,0.1)] flex flex-col flex-shrink-0 overflow-y-auto">

      {/* Alignment bar */}
      <div className="px-2.5 py-2 border-b border-[rgba(233,233,226,0.1)] flex items-center gap-[2px]">
        <AlignBtn title="Align left"     onClick={onAlignLeft}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2" y="3" width="5" height="2.5" rx="0.8" fill="currentColor"/><rect x="2" y="7" width="9" height="2.5" rx="0.8" fill="currentColor" opacity="0.4"/><rect x="1.5" y="2" width="1" height="10" rx="0.5" fill="currentColor" opacity="0.5"/></svg>
        </AlignBtn>
        <AlignBtn title="Align center H"  onClick={onAlignCenterH}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="3.5" y="3" width="7" height="2.5" rx="0.8" fill="currentColor"/><rect x="2" y="7" width="10" height="2.5" rx="0.8" fill="currentColor" opacity="0.4"/><rect x="6.5" y="2" width="1" height="10" rx="0.5" fill="currentColor" opacity="0.5"/></svg>
        </AlignBtn>
        <AlignBtn title="Align right"    onClick={onAlignRight}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="7" y="3" width="5" height="2.5" rx="0.8" fill="currentColor"/><rect x="3" y="7" width="9" height="2.5" rx="0.8" fill="currentColor" opacity="0.4"/><rect x="11.5" y="2" width="1" height="10" rx="0.5" fill="currentColor" opacity="0.5"/></svg>
        </AlignBtn>
        <div className="w-px h-[14px] bg-[rgba(233,233,226,0.1)] mx-[2px]" />
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

      {/* Size */}
      <PanelSection title="Size">
        <PropRow label="Width">
          <PillInput value={Math.round(ref.width ?? 0)} onChange={v => updateGeom({ width: Number(v) || 0 })} />
        </PropRow>
        <PropRow label="Height">
          <PillInput value={Math.round(ref.height ?? 0)} onChange={v => updateGeom({ height: Number(v) || 0 })} />
        </PropRow>
        <PropRow label="Position">
          <PillInput value={`X  ${Math.round(ref.x ?? 0)}`} onChange={v => updateGeom({ x: Number(v.replace(/[^0-9.-]/g, '')) || 0 })} />
          <PillInput value={`Y  ${Math.round(ref.y ?? 0)}`} onChange={v => updateGeom({ y: Number(v.replace(/[^0-9.-]/g, '')) || 0 })} />
        </PropRow>
      </PanelSection>

      {/* Fill */}
      <PanelSection title="Fill">
        <PropRow label="Color">
          <div className="flex gap-[3px] flex-wrap">
            {FILL_PRESETS.map(p => (
              <button
                key={p.value}
                title={p.label}
                onClick={() => updateStyle({ fill: p.value, fillOpacity: p.opacity })}
                className={clsx(
                  "w-5 h-5 rounded-full transition-transform hover:scale-110",
                  style.fill === p.value && "ring-2 ring-offset-1 ring-offset-[#1c1c1a] ring-[rgba(233,233,226,0.6)]"
                )}
                style={{ background: p.value === 'transparent' ? 'transparent' : p.value, border: p.value === 'transparent' ? '1.5px solid rgba(233,233,226,0.15)' : 'none' }}
              />
            ))}
          </div>
        </PropRow>
        <PropRow label="Opacity">
          <input
            type="range" min={0} max={1} step={0.01}
            value={style.fillOpacity ?? 0.15}
            onChange={e => updateStyle({ fillOpacity: Number(e.target.value) })}
            className="flex-1 h-[3px] rounded-full accent-[#d38f36]"
          />
          <span className="text-[11px] text-[rgba(233,233,226,0.4)] w-8 text-right">
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
                className={clsx(
                  "w-5 h-5 rounded-full transition-transform hover:scale-110",
                  style.stroke === p.value && "ring-2 ring-offset-1 ring-offset-[#1c1c1a] ring-[rgba(233,233,226,0.6)]"
                )}
                style={{ background: p.value === 'transparent' ? 'transparent' : p.value, border: p.value === 'transparent' ? '1.5px solid rgba(233,233,226,0.15)' : 'none' }}
              />
            ))}
          </div>
        </PropRow>
        <PropRow label="Width">
          <PillInput value={style.strokeWidth ?? 1.5} onChange={v => updateStyle({ strokeWidth: Number(v) || 1 })} />
          <div className="flex bg-[#232321] rounded-[6px] p-[2px] gap-[1px]">
            {(['solid', 'dashed', 'dotted'] as const).map(ss => (
              <button
                key={ss}
                onClick={() => updateStyle({ strokeStyle: ss })}
                className={clsx(
                  "px-1.5 h-5 rounded-[4px] text-[10px] transition-colors",
                  (style.strokeStyle ?? 'solid') === ss
                    ? "bg-[rgba(233,233,226,0.15)] text-[rgba(233,233,226,0.9)]"
                    : "text-[rgba(233,233,226,0.3)] hover:text-[rgba(233,233,226,0.6)]"
                )}
              >
                {ss === 'solid' ? '—' : ss === 'dashed' ? '- -' : '···'}
              </button>
            ))}
          </div>
        </PropRow>
        <PropRow label="Radius">
          <PillInput value={style.cornerRadius ?? 0} onChange={v => updateStyle({ cornerRadius: Number(v) || 0 })} />
        </PropRow>
      </PanelSection>

      {/* Options */}
      <PanelSection title="Options">
        <PropRow label="Visible">
          <div className="flex bg-[#232321] rounded-[6px] p-[2px] gap-[1px]">
            {([true, false] as const).map(v => (
              <button
                key={String(v)}
                onClick={() => updateStyle({ opacity: v ? 1 : 0 })}
                className={clsx(
                  "px-2.5 h-5 rounded-[4px] text-[11px] transition-colors",
                  ((style.opacity ?? 1) > 0) === v
                    ? "bg-[rgba(233,233,226,0.15)] text-[rgba(233,233,226,0.9)]"
                    : "text-[rgba(233,233,226,0.3)]"
                )}
              >
                {v ? 'True' : 'No'}
              </button>
            ))}
          </div>
        </PropRow>
        <PropRow label="Locked">
          <button
            onClick={() => updateStyle({ locked: !(style.locked ?? false) })}
            className={clsx(
              "w-7 h-4 rounded-full transition-colors relative",
              style.locked ? "bg-[#d38f36]" : "bg-[rgba(233,233,226,0.1)]"
            )}
          >
            <div className={clsx(
              "absolute top-[2px] w-3 h-3 bg-[rgba(233,233,226,0.9)] rounded-full transition-transform",
              style.locked ? "left-[calc(100%-14px)]" : "left-[2px]"
            )} />
          </button>
        </PropRow>
      </PanelSection>

    </div>
  );
}
