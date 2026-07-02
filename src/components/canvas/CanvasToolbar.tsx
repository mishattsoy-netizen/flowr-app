"use client";

import React from 'react';
import {
  MousePointer2, Hand, Square, Circle, Diamond,
  MoveUpRight, Minus, Pencil, Type, Image,
  Frame, Layers, Download, Share2, Undo2, Redo2, Magnet, Eraser
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type CanvasTool =
  | 'select' | 'move'
  | 'rect' | 'ellipse' | 'diamond' | 'arrow' | 'line' | 'freedraw'
  | 'text' | 'image' | 'frame' | 'eraser';

interface CanvasToolbarProps {
  activeTool: CanvasTool;
  setActiveTool: (tool: CanvasTool) => void;
}

type ToolDef = { id: CanvasTool; icon: React.ReactNode; shortcut: string; label: string };

const NAV_TOOLS: ToolDef[] = [
  { id: 'select', icon: <MousePointer2 className="w-4 h-4 text-[var(--bone-100)]" />, shortcut: 'V', label: 'Select' },
  { id: 'move',   icon: <Hand className="w-4 h-4 text-[var(--bone-100)]" />,          shortcut: 'H', label: 'Pan' },
];

const SHAPE_TOOLS: ToolDef[] = [
  { id: 'rect',     icon: <Square className="w-4 h-4 text-[var(--bone-100)]" />,       shortcut: 'R', label: 'Rectangle' },
  { id: 'ellipse',  icon: <Circle className="w-4 h-4 text-[var(--bone-100)]" />,       shortcut: 'O', label: 'Ellipse' },
  { id: 'diamond',  icon: <Diamond className="w-4 h-4 text-[var(--bone-100)]" />,      shortcut: 'D', label: 'Diamond' },
  { id: 'arrow',    icon: <MoveUpRight className="w-4 h-4 text-[var(--bone-100)]" />,  shortcut: 'A', label: 'Arrow' },
  { id: 'line',     icon: <Minus className="w-4 h-4 text-[var(--bone-100)]" />,        shortcut: 'L', label: 'Line' },
  { id: 'freedraw', icon: <Pencil className="w-4 h-4 text-[var(--bone-100)]" />,       shortcut: 'P', label: 'Freedraw' },
];

const CONTENT_TOOLS: ToolDef[] = [
  { id: 'text',    icon: <Type className="w-4 h-4 text-[var(--bone-100)]" />,              shortcut: 'T', label: 'Text' },
  { id: 'image',   icon: <Image className="w-4 h-4 text-[var(--bone-100)]" />,             shortcut: 'I', label: 'Image' },
  { id: 'frame', icon: <Frame className="w-4 h-4 text-[var(--bone-100)]" />,               shortcut: 'F', label: 'Section' },
];

const ERASER_TOOLS: ToolDef[] = [
  { id: 'eraser', icon: <Eraser className="w-4 h-4 text-[var(--bone-100)]" />,             shortcut: 'E', label: 'Eraser' },
];

function ToolGroup({ tools, activeTool, setActiveTool }: {
  tools: ToolDef[]; activeTool: CanvasTool; setActiveTool: (t: CanvasTool) => void;
}) {
  return (
    <>
      {tools.map(t => (
          <button
            key={t.id}
            title={`${t.label} (${t.shortcut})`}
            onClick={() => setActiveTool(t.id)}
            className={cn(
              "group w-[34px] h-[30px] rounded-[var(--radius-small)] flex items-center justify-center transition-all duration-150 ease-in-out",
              activeTool === t.id
                ? "bg-[var(--bone-12)] text-[var(--bone-100)] font-semibold"
                : "bg-transparent text-[var(--bone-60)] hover:bg-[var(--app-dark)] hover:text-[var(--bone-100)]"
            )}
          >
            <span className={activeTool === t.id ? "" : "opacity-60 group-hover:opacity-100"}>{t.icon}</span>
        </button>
      ))}
    </>
  );
}

function VSep() {
  return <div className="w-px h-[18px] bg-border/30 mx-[3px]" />;
}

function TbBtn({ onClick, active, title, children }: {
  onClick: () => void; active?: boolean; title: string; children: React.ReactNode;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={cn(
        "group w-7 h-7 rounded-[var(--radius-small)] flex items-center justify-center transition-all duration-150 ease-in-out",
        active
          ? "bg-[var(--bone-12)] text-[var(--bone-100)]"
          : "bg-transparent text-[var(--bone-60)] hover:bg-[var(--app-dark)] hover:text-[var(--bone-100)]"
      )}
    >
      <span className={active ? "" : "opacity-60 group-hover:opacity-100"}>{children}</span>
    </button>
  );
}

export function CanvasToolbar({
  activeTool, setActiveTool,
}: CanvasToolbarProps) {
  return (
    <>
      {/* Floating Toolbar (bottom center) */}
      <div 
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[2000] flex items-center bg-panel border border-[var(--bone-12)] shadow-[0_4px_12px_rgba(0,0,0,0.12)] rounded-[11px] p-[5px] gap-[4px] select-none canvas-floating-panel"
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <ToolGroup tools={NAV_TOOLS}     activeTool={activeTool} setActiveTool={setActiveTool} />
        <VSep />
        <ToolGroup tools={SHAPE_TOOLS}   activeTool={activeTool} setActiveTool={setActiveTool} />
        <VSep />
        <ToolGroup tools={CONTENT_TOOLS} activeTool={activeTool} setActiveTool={setActiveTool} />
        <VSep />
        <ToolGroup tools={ERASER_TOOLS} activeTool={activeTool} setActiveTool={setActiveTool} />
      </div>
    </>
  );
}
