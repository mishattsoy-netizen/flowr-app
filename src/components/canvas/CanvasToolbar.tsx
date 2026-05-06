"use client";

import React from 'react';
import {
  MousePointer2, Hand, Square, Circle, Diamond,
  MoveUpRight, Minus, Pencil, Type, Image, MessageSquarePlus,
  Frame, Layers, Download, Share2, Undo2, Redo2
} from 'lucide-react';
import clsx from 'clsx';

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
    <div className="flex items-center bg-[rgba(233,233,226,0.06)] rounded-[8px] p-[3px] gap-[1px]">
      {tools.map(t => (
        <button
          key={t.id}
          title={`${t.label} (${t.shortcut})`}
          onClick={() => setActiveTool(t.id)}
          className={clsx(
            "w-7 h-[26px] rounded-[5px] flex items-center justify-center transition-all duration-100",
            activeTool === t.id
              ? "bg-[rgba(233,233,226,0.15)] text-[var(--bone-100)]"
              : "bg-transparent text-[rgba(233,233,226,0.3)] hover:bg-[rgba(233,233,226,0.06)] hover:text-[rgba(233,233,226,0.6)]"
          )}
        >
          {t.icon}
        </button>
      ))}
    </div>
  );
}

function VSep() {
  return <div className="w-px h-[14px] bg-[rgba(233,233,226,0.1)] mx-[2px]" />;
}

function TbBtn({ onClick, active, title, children }: {
  onClick: () => void; active?: boolean; title: string; children: React.ReactNode;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={clsx(
        "w-7 h-7 rounded-[6px] flex items-center justify-center transition-all duration-100",
        active
          ? "text-[var(--bone-100)]"
          : "bg-transparent text-[rgba(233,233,226,0.3)] hover:bg-[rgba(233,233,226,0.06)] hover:text-[rgba(233,233,226,0.6)]"
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
    <div className="absolute top-0 left-0 right-0 h-10 bg-[#1c1c1a] border-b border-[rgba(233,233,226,0.1)] flex items-center px-2.5 gap-1.5 z-[2000] select-none">
      {/* Left: title */}
      <div className="flex items-center gap-1.5 min-w-[160px]">
        <span className="text-[12px] text-[rgba(233,233,226,0.6)] px-2 py-1 rounded-[6px]">
          <span className="text-[rgba(233,233,226,0.9)]">{canvasTitle}</span>
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
        <div className="flex items-center bg-[rgba(233,233,226,0.06)] rounded-[6px] px-2 h-[26px] gap-1.5 text-[11px] text-[rgba(233,233,226,0.35)] cursor-pointer hover:text-[rgba(233,233,226,0.6)] transition-colors">
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
        {/* Export */}
        <TbBtn onClick={onExport} title="Export PNG">
          <Download className="w-3.5 h-3.5" />
        </TbBtn>
        {/* Share */}
        <button
          onClick={onShare}
          className="h-[26px] px-3 rounded-[6px] bg-[rgba(211,143,54,0.15)] text-[#d38f36] text-[11px] uppercase tracking-[0.05em] hover:bg-[rgba(211,143,54,0.22)] transition-colors"
        >
          Share
        </button>
      </div>
    </div>
  );
}
