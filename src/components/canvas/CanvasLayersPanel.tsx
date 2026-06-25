"use client";

import { useStore } from '@/data/store';
import { EditorBlock } from '@/data/store.types';
import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Square, Circle, Diamond, MoveUpRight, Minus, Type, Image, MessageSquarePlus, Frame, Eye, EyeOff, Lock, Pencil } from 'lucide-react';

interface Props {
  canvasId: string;
  selectedIds: Set<string>;
  onSelect: (id: string, addToSelection: boolean) => void;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  rect:     <Square className="w-3 h-3" />,
  ellipse:  <Circle className="w-3 h-3" />,
  diamond:  <Diamond className="w-3 h-3" />,
  arrow:    <MoveUpRight className="w-3 h-3" />,
  line:     <Minus className="w-3 h-3" />,
  text:     <Type className="w-3 h-3" />,
  image:    <Image className="w-3 h-3" />,
  comment:  <MessageSquarePlus className="w-3 h-3" />,
  section:  <Frame className="w-3 h-3" />,
  freedraw: <Pencil className="w-3 h-3" />,
};

function blockIcon(b: EditorBlock) {
  if (b.type === 'shape' && b.shapeKind) return ICON_MAP[b.shapeKind] ?? <Square className="w-3 h-3" />;
  return ICON_MAP[b.type] ?? <Square className="w-3 h-3" />;
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
          "group h-7 flex items-center gap-[5px] px-2.5 mx-1.5 rounded-[var(--radius-medium)] cursor-pointer select-none border border-transparent transition-none",
          isSelected ? "bg-[var(--bone-15)] text-[var(--bone-100)] font-medium" : "text-[var(--bone-60)] hover:bg-[var(--bone-6)] hover:text-[var(--bone-100)]"
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
        <div className={cn("w-[14px] flex-shrink-0 flex items-center justify-center", isSelected ? "text-[var(--bone-100)]" : "text-[var(--bone-30)]")}>
          {blockIcon(block)}
        </div>
        <div className={cn("flex-1 text-[11px] truncate", isSelected ? "text-[var(--bone-100)] font-medium" : "text-[var(--bone-60)]", isHidden && "opacity-40")}>
          {blockLabel(block)}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
          {isLocked && <Lock className="w-2.5 h-2.5 text-[var(--bone-30)]" />}
          <button onClick={(e) => toggleVisibility(block, e)} className="text-[var(--bone-30)] hover:text-[var(--bone-70)]">
            {isHidden ? <EyeOff className="w-2.5 h-2.5" /> : <Eye className="w-2.5 h-2.5" />}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-[220px] bg-sidebar border-r border-[var(--bone-10)] flex flex-col flex-shrink-0 overflow-hidden z-10">
      {/* Tabs */}
      <div className="h-10 flex items-center px-2.5 border-b border-[var(--bone-10)] flex-shrink-0">
        <div className="relative flex items-center p-0.5 bg-background rounded-[var(--radius-medium)] w-full">
          {/* Sliding Background Pill */}
          <div 
            className="absolute top-[3px] bottom-[3px] rounded-[var(--radius-small)] bg-[var(--bone-10)] shadow-sm transition-all duration-0"
            style={{ 
              left: tab === 'layers' ? '3px' : 'calc(50% + 1px)',
              width: 'calc(50% - 4px)'
            }}
          />
          {(['layers', 'assets'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "relative z-10 flex-1 flex items-center justify-center py-1 rounded-[var(--radius-small)] capitalize transition-none",
                tab === t ? "text-[var(--bone-100)]" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="text-[11px] font-semibold">
                {t}
              </span>
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
