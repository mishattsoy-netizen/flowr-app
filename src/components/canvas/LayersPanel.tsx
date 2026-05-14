"use client";

import { useStore, EditorBlock } from "@/data/store";
import {
  Layers,
  Trash2,
  Layout,
  Type,
  MessageSquare,
  Box,
  ArrowRight,
  MoreVertical,
  Image,
  GripVertical
} from "lucide-react";
import { useState, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";

interface LayersPanelProps {
  canvasId: string;
  selectedBlockId?: string | null;
  onSelect?: (id: string | null) => void;
}

export function LayersPanel({ canvasId, selectedBlockId, onSelect }: LayersPanelProps) {
  const allBlocks = useStore(state => state.blocks);
  const blocks = useMemo(() => allBlocks.filter(b => b.canvasId === canvasId), [allBlocks, canvasId]);
  const updateBlock = useStore(state => state.updateCanvasBlock);
  const deleteBlock = useStore(state => state.deleteCanvasBlock);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  // Group blocks by parent
  const sections = useMemo(() => blocks.filter(b => b.type === 'section'), [blocks]);
  const standaloneBlocks = useMemo(() => blocks.filter(b => !b.parentId && b.type !== 'section'), [blocks]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'text': return <Type size={14} />;
      case 'image': return <Image size={14} />;
      case 'section': return <Box size={14} />;
      case 'comment': return <MessageSquare size={14} />;
      case 'connection': return <ArrowRight size={14} />;
      default: return <Layout size={14} />;
    }
  };

  const getLabel = (block: EditorBlock) => {
    if (block.content) {
      // Strip HTML tags for display
      const text = block.content.replace(/<[^>]+>/g, '').trim();
      if (text) return text.length > 30 ? text.slice(0, 30) + '…' : text;
    }
    return block.type.charAt(0).toUpperCase() + block.type.slice(1);
  };

  // Simple drag reordering via zIndex swap
  const handleDragStart = useCallback((blockId: string) => {
    setDraggedId(blockId);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) return;

    const draggedBlock = blocks.find(b => b.id === draggedId);
    const targetBlock = blocks.find(b => b.id === targetId);
    if (draggedBlock && targetBlock) {
      // Swap zIndices
      const dragZ = draggedBlock.zIndex || 0;
      const targetZ = targetBlock.zIndex || 0;
      updateBlock(draggedId, { zIndex: targetZ });
      updateBlock(targetId, { zIndex: dragZ });
    }
  }, [draggedId, blocks, updateBlock]);

  const handleDragEnd = useCallback(() => {
    setDraggedId(null);
  }, []);

  const LayerItem = ({ block, depth = 0 }: { block: EditorBlock; depth?: number }) => {
    const isEditing = editingId === block.id;
    const isDragged = draggedId === block.id;
    const isSelected = selectedBlockId === block.id;

    return (
      <div
        draggable
        onDragStart={() => handleDragStart(block.id)}
        onDragOver={(e) => handleDragOver(e, block.id)}
        onDragEnd={handleDragEnd}
        className={cn(
          "group flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer",
          isSelected ? "bg-accent/10 border border-accent/20" : "hover:bg-hover",
          depth > 0 && "ml-4 border-l border-border/50",
          isDragged && "opacity-50"
        )}
        onPointerDown={() => onSelect?.(block.id)}
        onDoubleClick={() => setEditingId(block.id)}
      >
        <GripVertical strokeWidth={2} size={10} className="text-muted-foreground/40 cursor-grab shrink-0" />
        <span className="text-muted-foreground">{getIcon(block.type)}</span>

        {isEditing ? (
          <input
            autoFocus
            className="bg-background border border-accent rounded px-1 shrink min-w-0 text-sm outline-none"
            defaultValue={block.content || block.type}
            onBlur={(e) => {
              updateBlock(block.id, { content: e.target.value });
              setEditingId(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                updateBlock(block.id, { content: (e.target as HTMLInputElement).value });
                setEditingId(null);
              }
            }}
          />
        ) : (
          <span className="text-sm truncate flex-1 font-medium">
            {getLabel(block)}
          </span>
        )}

        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
          <button
            onClick={() => deleteBlock(block.id)}
            className="p-1 hover:text-danger rounded"
          >
            <Trash2 strokeWidth={2} size={12} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="w-64 border-r border-border bg-background flex flex-col h-full overflow-hidden select-none">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h3 className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Layers</h3>
        <span className="bg-hover text-[10px] px-1.5 py-0.5 rounded-full font-bold">{blocks.length}</span>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {sections.map(section => (
          <div key={section.id} className="space-y-1">
            <LayerItem block={section} />
            <div className="space-y-1">
              {blocks.filter(b => b.parentId === section.id).map(child => (
                <LayerItem key={child.id} block={child} depth={1} />
              ))}
            </div>
          </div>
        ))}

        {standaloneBlocks.length > 0 && (
          <div className="pt-2">
            {standaloneBlocks.map(block => (
              <LayerItem key={block.id} block={block} />
            ))}
          </div>
        )}

        {blocks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Layers size={24} className="text-muted-foreground/30 mb-2" />
            <span className="text-xs text-muted-foreground/50">No layers yet</span>
          </div>
        )}
      </div>
    </div>
  );
}

