"use client";

import React from 'react';
import {
  MousePointer2, Hand, Square, Circle, Diamond,
  MoveUpRight, Minus, Pencil, Type, Image, MessageSquarePlus,
  Frame, Layers, Download, Share2, Undo2, Redo2, Magnet
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type CanvasTool =
  | 'select' | 'move'
  | 'rect' | 'ellipse' | 'diamond' | 'arrow' | 'line' | 'freedraw'
  | 'text' | 'image' | 'comment' | 'section';

interface CanvasToolbarProps {
  activeTool: CanvasTool;
  setActiveTool: (tool: CanvasTool) => void;
  showLayers: boolean;
  setShowLayers: (show: boolean) => void;
  snapEnabled: boolean;
  setSnapEnabled: (v: boolean) => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onExport: () => void;
  onShare: () => void;
  canvasTitle: string;
}

type ToolDef = { id: CanvasTool; icon: React.ReactNode; shortcut: string; label: string };

const NAV_TOOLS: ToolDef[] = [
  { id: 'select', icon: <MousePointer2 className="w-3.5 h-3.5" />, shortcut: 'V', label: 'Select' },
  { id: 'move',   icon: <Hand className="w-3.5 h-3.5" />,          shortcut: 'H', label: 'Pan' },
];

const SHAPE_TOOLS: ToolDef[] = [
  { id: 'rect',     icon: <Square className="w-3.5 h-3.5" />,       shortcut: 'R', label: 'Rectangle' },
  { id: 'ellipse',  icon: <Circle className="w-3.5 h-3.5" />,       shortcut: 'O', label: 'Ellipse' },
  { id: 'diamond',  icon: <Diamond className="w-3.5 h-3.5" />,      shortcut: 'D', label: 'Diamond' },
  { id: 'arrow',    icon: <MoveUpRight className="w-3.5 h-3.5" />,  shortcut: 'A', label: 'Arrow' },
  { id: 'line',     icon: <Minus className="w-3.5 h-3.5" />,        shortcut: 'L', label: 'Line' },
  { id: 'freedraw', icon: <Pencil className="w-3.5 h-3.5" />,       shortcut: 'P', label: 'Freedraw' },
];

const CONTENT_TOOLS: ToolDef[] = [
  { id: 'text',    icon: <Type className="w-3.5 h-3.5" />,              shortcut: 'T', label: 'Text' },
  { id: 'image',   icon: <Image className="w-3.5 h-3.5" />,             shortcut: 'I', label: 'Image' },
  { id: 'comment', icon: <MessageSquarePlus className="w-3.5 h-3.5" />, shortcut: 'C', label: 'Comment' },
  { id: 'section', icon: <Frame className="w-3.5 h-3.5" />,             shortcut: 'F', label: 'Section' },
];

function ToolGroup({ tools, activeTool, setActiveTool }: {
  tools: ToolDef[]; activeTool: CanvasTool; setActiveTool: (t: CanvasTool) => void;
}) {
  return (
    <div className="flex items-center bg-[var(--bone-5)] rounded-[var(--radius-medium)] p-[3px] gap-[1px]">
      {tools.map(t => (
        <button
          key={t.id}
          title={`${t.label} (${t.shortcut})`}
          onClick={() => setActiveTool(t.id)}
          className={cn(
            "w-7 h-[26px] rounded-[var(--radius-small)] flex items-center justify-center transition-none",
            activeTool === t.id
              ? "bg-[var(--bone-15)] text-[var(--bone-100)] font-semibold"
              : "bg-transparent text-[var(--bone-60)] hover:bg-[var(--bone-10)] hover:text-[var(--bone-100)]"
          )}
        >
          {t.icon}
        </button>
      ))}
    </div>
  );
}

function VSep() {
  return <div className="w-px h-[14px] bg-border/30 mx-[2px]" />;
}

function TbBtn({ onClick, active, title, children }: {
  onClick: () => void; active?: boolean; title: string; children: React.ReactNode;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={cn(
        "w-7 h-7 rounded-[var(--radius-small)] flex items-center justify-center transition-none",
        active
          ? "bg-[var(--bone-15)] text-[var(--bone-100)]"
          : "bg-transparent text-[var(--bone-60)] hover:bg-[var(--bone-10)] hover:text-[var(--bone-100)]"
      )}
    >
      {children}
    </button>
  );
}

export function CanvasToolbar({
  activeTool, setActiveTool,
  showLayers, setShowLayers,
  snapEnabled, setSnapEnabled,
  zoom, onZoomIn, onZoomOut,
  canUndo, canRedo, onUndo, onRedo,
  onExport, onShare,
  canvasTitle,
}: CanvasToolbarProps) {
  return (
    <div className="absolute top-0 left-0 right-0 h-10 bg-sidebar border-b border-[var(--bone-10)] flex items-center px-2.5 gap-1.5 z-[2000] select-none">
      {/* Left: title */}
      <div className="flex items-center gap-1.5 min-w-[160px]">
        <span className="text-[12px] text-[var(--bone-60)] px-2 py-1 rounded-[6px]">
          <span className="text-[var(--bone-90)] font-medium">{canvasTitle}</span>
        </span>
      </div>

      {/* Center: tool groups */}
      <div className="flex-1 flex items-center justify-center gap-[3px]">
        <ToolGroup tools={NAV_TOOLS}     activeTool={activeTool} setActiveTool={setActiveTool} />
        <VSep />
        <ToolGroup tools={SHAPE_TOOLS}   activeTool={activeTool} setActiveTool={setActiveTool} />
        <VSep />
        <ToolGroup tools={CONTENT_TOOLS} activeTool={activeTool} setActiveTool={setActiveTool} />
      </div>

      {/* Right: zoom, undo/redo, layers, export, share */}
      <div className="flex items-center gap-1 min-w-[160px] justify-end">
        {/* Zoom */}
        <div className="flex items-center bg-[var(--bone-6)] hover:bg-[var(--bone-10)] rounded-[var(--radius-small)] px-2 h-[26px] gap-1.5 text-[11px] text-[var(--bone-60)] hover:text-[var(--bone-100)] cursor-pointer transition-none">
          {Math.round(zoom * 100)}%
        </div>
        <VSep />
        {/* Undo/Redo */}
        <TbBtn onClick={onUndo} active={canUndo} title="Undo (Ctrl+Z)">
          <Undo2 className="w-3.5 h-3.5" />
        </TbBtn>
        <TbBtn onClick={onRedo} active={canRedo} title="Redo (Ctrl+Y)">
          <Redo2 className="w-3.5 h-3.5" />
        </TbBtn>
        <VSep />
        {/* Layers toggle */}
        <TbBtn onClick={() => setShowLayers(!showLayers)} active={showLayers} title="Layers panel">
          <Layers className="w-3.5 h-3.5" />
        </TbBtn>
        {/* Snapping toggle */}
        <TbBtn onClick={() => setSnapEnabled(!snapEnabled)} active={snapEnabled} title={snapEnabled ? "Snapping is ON (aligns blocks to each other)" : "Snapping is OFF (smooth movement)"}>
          <Magnet className="w-3.5 h-3.5" />
        </TbBtn>
        {/* Export */}
        <TbBtn onClick={onExport} title="Export PNG">
          <Download className="w-3.5 h-3.5" />
        </TbBtn>
        {/* Share */}
        <button
          onClick={onShare}
          className="h-[26px] px-3 rounded-[var(--radius-small)] bg-[var(--bone-15)] text-[var(--bone-100)] hover:bg-[var(--bone-25)] hover:text-[var(--bone-100)] text-[11px] font-semibold tracking-wide transition-none active:bg-[var(--bone-30)]"
        >
          Share
        </button>
      </div>
    </div>
  );
}
