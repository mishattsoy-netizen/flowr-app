"use client";

import { useState, useRef, useEffect, useMemo } from 'react';
import {
  Type, Heading1, Heading2, FileText, Code,
  List, Minus, ListOrdered, CheckSquare, Quote,
  Columns2, Columns3, Columns4, SeparatorHorizontal,
  FileInput, Table, Kanban, GalleryHorizontalEnd,
  ListFilter, ImageIcon, Video, Link
} from 'lucide-react';
import type { BlockType, DatabaseViewType } from '@/data/store';

export interface SlashCommand {
  id: string;
  label: string;
  icon: React.ReactNode;
  category: string;
  shortcut?: string;
  action: () => void;
}

interface SlashCommandMenuProps {
  position: { x: number; y: number };
  search: string;
  onClose: () => void;
  onInsertBlock: (type: BlockType, extra?: Record<string, unknown>) => void;
  activeBlockStyle?: string;
}

const ICON_CLS = "w-4 h-4";

export function SlashCommandMenu({ position, search, onClose, onInsertBlock, activeBlockStyle }: SlashCommandMenuProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  const commands: SlashCommand[] = useMemo(() => {
    const allCommands: SlashCommand[] = [
      // Text Styles
      { id: 'title', label: 'Title', icon: <Type strokeWidth={2} className={ICON_CLS} />, category: 'Text Styles', shortcut: 'H1', action: () => onInsertBlock('text', { style: 'title' }) },
      { id: 'heading', label: 'Heading', icon: <Heading1 strokeWidth={2} className={ICON_CLS} />, category: 'Text Styles', shortcut: '#', action: () => onInsertBlock('text', { style: 'heading' }) },
      { id: 'subheading', label: 'Subheading', icon: <Heading2 strokeWidth={2} className={ICON_CLS} />, category: 'Text Styles', shortcut: '##', action: () => onInsertBlock('text', { style: 'subheading' }) },
      { id: 'body', label: 'Body', icon: <FileText strokeWidth={2} className={ICON_CLS} />, category: 'Text Styles', shortcut: 'T', action: () => onInsertBlock('text', { style: 'body' }) },
      { id: 'mono', label: 'Mono', icon: <Code strokeWidth={2} className={ICON_CLS} />, category: 'Text Styles', shortcut: '`', action: () => onInsertBlock('text', { style: 'mono' }) },

      // Lists
      { id: 'bullet-list', label: 'Bulleted List', icon: <List strokeWidth={2} className={ICON_CLS} />, category: 'Lists', shortcut: '-', action: () => onInsertBlock('bulletList') },
      { id: 'dashed-list', label: 'Dashed List', icon: <Minus strokeWidth={2} className={ICON_CLS} />, category: 'Lists', shortcut: '--', action: () => onInsertBlock('dashedList') },
      { id: 'numbered-list', label: 'Numbered List', icon: <ListOrdered strokeWidth={2} className={ICON_CLS} />, category: 'Lists', shortcut: '1.', action: () => onInsertBlock('numberedList') },
      { id: 'checklist', label: 'Checklist', icon: <CheckSquare strokeWidth={2} className={ICON_CLS} />, category: 'Lists', shortcut: '[]', action: () => onInsertBlock('checklist') },

      // Layout
      { id: 'quote', label: 'Quote Block', icon: <Quote strokeWidth={2} className={ICON_CLS} />, category: 'Layout', shortcut: '>', action: () => onInsertBlock('quote') },
      { id: 'divider', label: 'Divider', icon: <SeparatorHorizontal strokeWidth={2} className={ICON_CLS} />, category: 'Layout', shortcut: '---', action: () => onInsertBlock('divider') },
      { id: 'link', label: 'Link Button', icon: <Link strokeWidth={2} className={ICON_CLS} />, category: 'Layout', shortcut: '@', action: () => onInsertBlock('link') },
      { id: '2-columns', label: '2 Columns', icon: <Columns2 strokeWidth={2} className={ICON_CLS} />, category: 'Layout', action: () => onInsertBlock('columns', { columnCount: 2 }) },
      { id: '3-columns', label: '3 Columns', icon: <Columns3 strokeWidth={2} className={ICON_CLS} />, category: 'Layout', action: () => onInsertBlock('columns', { columnCount: 3 }) },
      { id: '4-columns', label: '4 Columns', icon: <Columns4 strokeWidth={2} className={ICON_CLS} />, category: 'Layout', action: () => onInsertBlock('columns', { columnCount: 4 }) },
      
      // Media
      { id: 'image', label: 'Image', icon: <ImageIcon strokeWidth={2} className={ICON_CLS} />, category: 'Media', action: () => onInsertBlock('image') },
      { id: 'video', label: 'Video', icon: <Video strokeWidth={2} className={ICON_CLS} />, category: 'Media', action: () => onInsertBlock('video') },

      // Embeds
      { id: 'embed', label: 'Embed Subpage', icon: <FileInput strokeWidth={2} className={ICON_CLS} />, category: 'Embeds', action: () => onInsertBlock('embed') },
      { id: 'table', label: 'Simple Table', icon: <Table strokeWidth={2} className={ICON_CLS} />, category: 'Embeds', shortcut: '|', action: () => onInsertBlock('table') },

      // Database
      { id: 'db-table', label: 'Table View', icon: <Table strokeWidth={2} className={ICON_CLS} />, category: 'Database', action: () => onInsertBlock('database', { dbViewType: 'table' as DatabaseViewType }) },
      { id: 'db-board', label: 'Board View', icon: <Kanban strokeWidth={2} className={ICON_CLS} />, category: 'Database', action: () => onInsertBlock('database', { dbViewType: 'board' as DatabaseViewType }) },
      { id: 'db-gallery', label: 'Gallery View', icon: <GalleryHorizontalEnd strokeWidth={2} className={ICON_CLS} />, category: 'Database', action: () => onInsertBlock('database', { dbViewType: 'gallery' as DatabaseViewType }) },
      { id: 'db-list', label: 'List View', icon: <ListFilter strokeWidth={2} className={ICON_CLS} />, category: 'Database', action: () => onInsertBlock('database', { dbViewType: 'list' as DatabaseViewType }) },
    ];
 
     if (activeBlockStyle && ['title', 'heading', 'subheading'].includes(activeBlockStyle)) {
       return allCommands.filter(c => c.category !== 'Lists');
     }
 
     return allCommands;
   }, [onInsertBlock, activeBlockStyle]);

  const filtered = useMemo(() => {
    if (!search.trim()) return commands;
    const q = search.toLowerCase();
    return commands.filter(c =>
      c.label.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q)
    );
  }, [commands, search]);

  const groupedCommands = useMemo(() => {
    const groups: { category: string; items: SlashCommand[] }[] = [];
    for (const cmd of filtered) {
      const existing = groups.find(g => g.category === cmd.category);
      if (existing) {
        existing.items.push(cmd);
      } else {
        groups.push({ category: cmd.category, items: [cmd] });
      }
    }
    return groups;
  }, [filtered]);

  // Keyboard nav
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex(i => Math.min(i + 1, filtered.length - 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex(i => Math.max(i - 1, 0));
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[activeIndex]) {
          filtered[activeIndex].action();
          onClose();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [filtered, activeIndex, onClose]);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  // Reset active index when search changes
  useEffect(() => {
    setActiveIndex(0);
  }, [search]);

  let flatIndex = 0;

  return (
    <div
      ref={menuRef}
      className="fixed z-[150] popup-glass-small w-[280px] max-h-[340px] flex flex-col overflow-hidden p-1.5 gap-[3px]"
      style={{ left: position.x, top: position.y }}
    >
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {groupedCommands.length === 0 && (
          <div className="px-3.5 py-4 text-center text-sm text-muted-foreground">No results</div>
        )}
        {groupedCommands.map(group => (
          <div key={group.category}>
            <div className="px-3.5 pt-2 pb-1 text-[11px] font-semibold text-muted-foreground/40 uppercase tracking-wider">
              {group.category}
            </div>
            {group.items.map(cmd => {
              const idx = flatIndex++;
              return (
                <button
                  key={cmd.id}
                  className={`popup-item border-none flex items-center justify-between group/cmd ${idx === activeIndex ? 'bg-hover text-foreground' : ''}`}
                  onClick={() => { cmd.action(); onClose(); }}
                  onMouseEnter={() => setActiveIndex(idx)}
                >
                  <div className="flex items-center gap-2">
                    {cmd.icon}
                    {cmd.label}
                  </div>
                  {cmd.shortcut && (
                    <span className="text-[9px] font-mono font-medium px-1.5 py-0.5 rounded bg-white/[0.04] text-bone-60/40 transition-all group-hover/cmd:text-bone-60/70 group-hover/cmd:bg-white/[0.08]">
                      {cmd.shortcut}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

