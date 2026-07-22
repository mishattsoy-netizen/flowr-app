"use client";

import { useState, useRef, useEffect, useMemo } from 'react';
import { useStore } from '@/data/store';
import { getEntityIconReact } from '../assistant/components/ChatMessage';

interface MentionMenuProps {
  position: { x: number; y: number };
  search: string;
  onClose: () => void;
  onSelect: (item: { id: string; title: string; type: string }) => void;
}

const MENTIONABLE = new Set(['note', 'folder', 'canvas']);

export function MentionMenu({ position, search, onClose, onSelect }: MentionMenuProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const entities = useStore(s => s.entities);
  const spaces = useStore(s => s.spaces);

  const items = useMemo(() => {
    const fromEntities = entities
      .filter(e => MENTIONABLE.has(e.type) && e.title?.trim())
      .map(e => ({ id: e.id, title: e.title, type: e.type }));
    const fromSpaces = spaces
      .filter(s => s.name?.trim())
      .map(s => ({ id: s.id, title: s.name, type: 'workspace' }));
    const all = [...fromEntities, ...fromSpaces];
    const q = search.trim().toLowerCase();
    const matched = q ? all.filter(i => i.title.toLowerCase().includes(q)) : all;
    return matched
      .sort((a, b) => {
        const ap = a.title.toLowerCase().startsWith(q) ? 0 : 1;
        const bp = b.title.toLowerCase().startsWith(q) ? 0 : 1;
        return ap - bp || a.title.localeCompare(b.title);
      })
      .slice(0, 30);
  }, [entities, spaces, search]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); setActiveIndex(i => Math.min(i + 1, items.length - 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); setActiveIndex(i => Math.max(i - 1, 0)); return; }
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        if (items[activeIndex]) { onSelect(items[activeIndex]); onClose(); }
        return;
      }
      // Space/Backspace are intentionally NOT stopped here: NoteEditor's own
      // keydown handler needs to see them (to close the menu when the user
      // backspaces past the `@` or types a space with an empty query) and
      // the underlying contentEditable still needs to receive the character.
    };
    // Capture phase + stopPropagation on the keys this menu owns: the host's
    // own keydown handler (handleHostKeyDown in NoteEditor.tsx) is attached
    // directly to the contentEditable host and would otherwise ALSO see
    // Enter/ArrowUp/ArrowDown and act on them (e.g. Enter inserts a new
    // block) since it runs during the bubble phase before this document
    // listener would fire. Capturing first and stopping propagation here
    // pre-empts that double-handling.
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [items, activeIndex, onClose, onSelect]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  // Close on scroll of the note content, same rationale as SlashCommandMenu:
  // `position` is fixed viewport coordinates computed once at open time, so
  // any scroll leaves the popup anchored to nothing. Scrolling inside the
  // menu's own list must not trigger this.
  useEffect(() => {
    const handleScroll = (e: Event) => {
      if (menuRef.current && menuRef.current.contains(e.target as Node)) return;
      onClose();
    };
    document.addEventListener('scroll', handleScroll, true);
    return () => document.removeEventListener('scroll', handleScroll, true);
  }, [onClose]);

  useEffect(() => { setActiveIndex(0); }, [search]);

  return (
    <div
      ref={menuRef}
      className="fixed z-[150] popup-glass-small w-[280px] max-h-[300px] flex flex-col overflow-hidden gap-[3px]"
      style={{ left: position.x, top: position.y }}
    >
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {items.length === 0 && (
          <div className="px-3.5 py-4 text-center text-sm text-muted-foreground">No matches</div>
        )}
        {items.map((item, idx) => (
          <button
            key={item.id}
            className={`popup-item border-none flex items-center gap-2 w-full text-left ${idx === activeIndex ? 'bg-hover text-foreground' : ''}`}
            onClick={() => { onSelect(item); onClose(); }}
            onMouseEnter={() => setActiveIndex(idx)}
          >
            {getEntityIconReact(item.type)}
            <span className="truncate">{item.title}</span>
            <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground/40">{item.type}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
