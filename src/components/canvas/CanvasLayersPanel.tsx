"use client";

import { useStore } from '@/data/store';
import { EditorBlock } from '@/data/store.types';
import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Square, Circle, Diamond, MoveUpRight, Minus, Type, Image, MessageSquarePlus, Frame, Eye, EyeOff, Lock, Pencil, Layers, Package } from 'lucide-react';

interface Props {
  canvasId: string;
  selectedIds: Set<string>;
  onSelect: (id: string, addToSelection: boolean) => void;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  rect:     <Square className="w-3 h-3 text-[var(--bone-100)]" />,
  ellipse:  <Circle className="w-3 h-3 text-[var(--bone-100)]" />,
  diamond:  <Diamond className="w-3 h-3 text-[var(--bone-100)]" />,
  arrow:    <MoveUpRight className="w-3 h-3 text-[var(--bone-100)]" />,
  line:     <Minus className="w-3 h-3 text-[var(--bone-100)]" />,
  text:     <Type className="w-3 h-3 text-[var(--bone-100)]" />,
  image:    <Image className="w-3 h-3 text-[var(--bone-100)]" />,
  comment:  <MessageSquarePlus className="w-3 h-3 text-[var(--bone-100)]" />,
  section:  <Frame className="w-3 h-3 text-[var(--bone-100)]" />,
  freedraw: <Pencil className="w-3 h-3 text-[var(--bone-100)]" />,
};

function blockIcon(b: EditorBlock) {
  if (b.type === 'shape' && b.shapeKind) return ICON_MAP[b.shapeKind] ?? <Square className="w-3 h-3 text-[var(--bone-100)]" />;
  return ICON_MAP[b.type] ?? <Square className="w-3 h-3 text-[var(--bone-100)]" />;
}

function blockLabel(b: EditorBlock) {
  if (b.content) return b.content.slice(0, 28);
  if (b.type === 'shape') return b.shapeKind ?? 'Shape';
  return b.type.charAt(0).toUpperCase() + b.type.slice(1);
}

export function CanvasLayersPanel({ canvasId, selectedIds, onSelect }: Props) {
  const blocks = useStore(s => s.blocks);
  const updateCanvasBlock = useStore(s => s.updateCanvasBlock);
  const [tab, setTab] = useState<'layers' | 'assets'>('layers');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const TAB_OPTIONS = ['layers', 'assets'] as const;
  const TAB_ICONS: Record<string, React.ReactNode> = { layers: <Layers className="w-3 h-3 text-[var(--bone-100)]" />, assets: <Package className="w-3 h-3 text-[var(--bone-100)]" /> };


  const pageBlocks = useMemo(() =>
    blocks.filter(b => b.canvasId === canvasId && b.type !== 'connection'),
    [blocks, canvasId]
  );

  const sections = useMemo(() => pageBlocks.filter(b => b.type === 'section'), [pageBlocks]);
  const loose = useMemo(() => pageBlocks.filter(b => b.type !== 'section' && !b.parentId), [pageBlocks]);

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleVisibility(b: EditorBlock, e: React.MouseEvent) {
    e.stopPropagation();
    const hidden = (b.canvasStyleExt?.opacity ?? 1) === 0;
    updateCanvasBlock(b.id, { canvasStyleExt: { ...b.canvasStyleExt, opacity: hidden ? 1 : 0 } });
  }

  function LayerRow({ block, depth = 0 }: { block: EditorBlock; depth?: number }) {
    const isSelected = selectedIds.has(block.id);
    const isHidden = (block.canvasStyleExt?.opacity ?? 1) === 0;
    const isLocked = block.canvasStyleExt?.locked ?? false;

    return (
      <div
        className={cn(
          "group h-7 flex items-center gap-[5px] px-2.5 mx-1.5 rounded-[var(--radius-medium)] cursor-pointer select-none border border-transparent transition-all duration-150 ease-in-out",
          isSelected ? "bg-[var(--bone-15)] text-[var(--bone-100)] font-medium" : "text-[var(--bone-60)] hover:bg-[var(--app-dark)] hover:text-[var(--bone-100)]"
        )}
        style={{ paddingLeft: 10 + depth * 14 }}
        onClick={(e) => onSelect(block.id, e.shiftKey)}
      >
        {block.type === 'section' ? (
          <button
            className="w-[10px] h-[10px] flex items-center justify-center text-[7px] text-[var(--bone-30)] flex-shrink-0"
            onClick={e => { e.stopPropagation(); toggleExpand(block.id); }}
          >
            {expanded.has(block.id) ? '▼' : '▶'}
          </button>
        ) : (
          <div className="w-[10px] flex-shrink-0" />
        )}
        <div className={cn("w-[14px] flex-shrink-0 flex items-center justify-center", isSelected ? "text-[var(--bone-100)]" : "text-[var(--bone-100)] opacity-30")}>
          {blockIcon(block)}
        </div>
        <div className={cn("flex-1 text-[11px] truncate", isSelected ? "text-[var(--bone-100)] font-medium" : "text-[var(--bone-60)]", isHidden && "opacity-40")}>
          {blockLabel(block)}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
          {isLocked && <span className="opacity-30"><Lock className="w-2.5 h-2.5 text-[var(--bone-100)]" /></span>}
          <button onClick={(e) => toggleVisibility(block, e)} className="group text-[var(--bone-30)] hover:text-[var(--bone-70)]">
            <span className="opacity-30 group-hover:opacity-70">{isHidden ? <EyeOff className="w-2.5 h-2.5 text-[var(--bone-100)]" /> : <Eye className="w-2.5 h-2.5 text-[var(--bone-100)]" />}</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-[220px] flex flex-col overflow-hidden canvas-floating-panel" style={{ background: 'var(--app-panel)', border: '1px solid var(--bone-12)', borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.12)' }}>
      {/* Tabs */}
      <div className="h-10 flex items-center px-2.5 border-b border-[var(--bone-10)] flex-shrink-0">
        <div
          className="relative flex items-center p-[3px] rounded-[var(--radius-small)] w-full h-7"
          style={{ background: 'var(--slider-track)' }}
        >
          <div
            className="absolute top-[3px] bottom-[3px] rounded-[5px] bg-[var(--slider-pill)] pointer-events-none transition-all duration-300 ease-out"
            style={{
              width: 'calc((100% - 6px) / 2)',
              left: `calc(3px + ${TAB_OPTIONS.indexOf(tab)} * (100% - 6px) / 2)`,
              boxShadow: 'var(--slider-pill-shadow)'
            }}
          />
          {TAB_OPTIONS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "group relative z-10 flex-1 h-full flex items-center justify-center gap-1 text-[10px] font-semibold rounded-[5px] transition-all duration-150 ease-in-out cursor-pointer capitalize",
                tab === t
                  ? "text-[var(--bone-100)]"
                  : "text-[var(--bone-60)] hover:text-[var(--bone-100)]"
              )}
            >
              <span className={tab === t ? "opacity-100" : "opacity-60 group-hover:opacity-100"}>{TAB_ICONS[t]}</span>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Layer tree */}
      <div className="flex-1 overflow-y-auto py-1 scrollbar-thin scrollbar-thumb-[rgba(233,233,226,0.1)]">
        {tab === 'layers' && (
          <>
            {sections.map(section => {
              const children = pageBlocks.filter(b => b.parentId === section.id);
              return (
                <div key={section.id}>
                  <LayerRow block={section} depth={0} />
                  {expanded.has(section.id) && children.map(child => (
                    <LayerRow key={child.id} block={child} depth={1} />
                  ))}
                </div>
              );
            })}
            {loose.length > 0 && sections.length > 0 && (
              <div className="px-2.5 pt-3 pb-1 text-[10px] uppercase tracking-[0.07em] text-[rgba(233,233,226,0.3)]">Loose</div>
            )}
            {loose.map(b => <LayerRow key={b.id} block={b} depth={0} />)}
          </>
        )}
        {tab === 'assets' && (
          <div className="px-3 pt-4 text-[11px] text-[rgba(233,233,226,0.3)]">No assets yet</div>
        )}
      </div>
    </div>
  );
}
