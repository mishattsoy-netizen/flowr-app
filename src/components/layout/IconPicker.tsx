"use client";

import { useStore } from '@/data/store';
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip } from './Tooltip';
import { ICON_MAP, type IconName } from '../../data/icons';

interface IconPickerProps {
  entityId: string;
  anchorRect: { x: number; y: number; width: number; height: number };
  onClose: () => void;
}

const ICON_CATEGORIES: { label: string; icons: IconName[] }[] = [
  {
    label: 'General',
    icons: ['Folder', 'Archive', 'Box', 'Package', 'Bookmark', 'Tag', 'Hash', 'Inbox'],
  },
  {
    label: 'Creative',
    icons: ['Palette', 'Brush', 'PenTool', 'Film', 'Camera', 'Music', 'Headphones', 'Sparkles', 'Wand2'],
  },
  {
    label: 'Science & Tech',
    icons: ['Code', 'Terminal', 'Bot', 'Atom', 'Brain', 'Lightbulb', 'Telescope', 'Cpu', 'Globe', 'Zap'],
  },
  {
    label: 'Lifestyle',
    icons: ['User', 'Users', 'Share2', 'Heart', 'Coffee', 'Gamepad2', 'Dumbbell', 'Leaf', 'Mountain', 'Plane', 'Home'],
  },
  {
    label: 'Business & Finance',
    icons: ['TrendingUp', 'LineChart', 'BarChart', 'Wallet', 'Briefcase', 'Building2', 'GraduationCap', 'BookOpen', 'Library', 'Target', 'Shield', 'Crown', 'Gem'],
  },
  {
    label: 'Symbols',
    icons: ['Trophy', 'Star', 'Rocket', 'Flame', 'Compass', 'Feather', 'Anchor', 'Moon', 'Sun'],
  },
];

const ALL_ICONS = ICON_CATEGORIES.flatMap(c => c.icons);

export function IconPicker({ entityId, anchorRect, onClose }: IconPickerProps) {
  const { setEntityIcon, entities } = useStore();
  const entity = entities.find(e => e.id === entityId);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [ready, setReady] = useState(false);

  // Position the picker near the anchor, respecting viewport bounds
  useEffect(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const padding = 12;

    let x = anchorRect.x;
    let y = anchorRect.y + anchorRect.height + 8;

    if (x + rect.width > window.innerWidth - padding) {
      x = window.innerWidth - rect.width - padding;
    }
    if (y + rect.height > window.innerHeight - padding) {
      y = anchorRect.y - rect.height - 8;
    }
    x = Math.max(padding, x);
    y = Math.max(padding, y);

    
    setPos({ x, y });
    setReady(true);
  }, [anchorRect]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const filteredIcons = search.trim()
    ? ALL_ICONS.filter(name => name.toLowerCase().includes(search.toLowerCase()))
    : null;

  const handleSelect = (iconName: IconName) => {
    setEntityIcon(entityId, iconName);
    onClose();
  };

  const currentIcon = entity?.icon || 'Folder';

  const content = (
    <div
      ref={ref}
      className={cn(
        "fixed z-[400] popup-glass-big p-4 w-[320px] max-h-[400px] flex flex-col ",
        !ready && "invisible"
      )}
      style={{ left: pos.x, top: pos.y }}
    >
      {/* Search */}
      <div className="flex items-center bg-background border border-border rounded-[var(--radius-small)] px-3 py-2 mb-3 group focus-within:border-[var(--bone-70)] ">
        <Search strokeWidth={2} className="w-3.5 h-3.5 text-muted-foreground mr-2 shrink-0 group-focus-within:text-foreground" />
        <input
          autoFocus
          type="text"
          placeholder="Search icons..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="bg-transparent outline-none text-foreground placeholder-muted-foreground w-full text-sm"
        />
        {search && (
          <Tooltip content="Clear Search">
            <button
              onClick={() => setSearch('')}
              className="p-0.5 rounded-[var(--radius-small)] hover:bg-hover text-muted-foreground hover:text-foreground "
            >
              <X strokeWidth={2} className="w-3 h-3" />
            </button>
          </Tooltip>
        )}
      </div>

      {/* Icons */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden pr-1 -mr-1">
        {filteredIcons ? (
          /* Search results - flat grid */
          filteredIcons.length > 0 ? (
            <div className="grid grid-cols-6 gap-2">
              {filteredIcons.map(iconName => {
                const IconComp = ICON_MAP[iconName];
                if (!IconComp) return null;
                return (
                  <Tooltip key={iconName} content={iconName}>
                    <button
                      onClick={() => handleSelect(iconName)}
                      className={cn(
                        "w-10 h-10 rounded-[var(--radius-small)]  flex items-center justify-center",
                        currentIcon === iconName
                          ? "bg-dark text-[var(--bone-100)] ring-1 ring-inset ring-[var(--bone-30)]"
                          : "opacity-40 hover:opacity-100 hover:bg-hover text-[var(--bone-100)]"
                      )}
                    >
                      <IconComp className="w-5 h-5" />
                    </button>
                  </Tooltip>
                );
              })}
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-muted-foreground">No icons found.</div>
          )
        ) : (
          /* Categorized grid */
          <div className="space-y-4">
            {ICON_CATEGORIES.map(category => (
              <div key={category.label}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-2 px-1">{category.label}</p>
                <div className="grid grid-cols-8 gap-0.5">
                  {category.icons.slice(0, 8).map(iconName => {
                    const IconComp = ICON_MAP[iconName];
                    if (!IconComp) return null;
                    return (
                      <Tooltip key={iconName} content={iconName}>
                        <button
                          onClick={() => handleSelect(iconName)}
                          className={cn(
                            "w-8 h-8 rounded-[var(--radius-small)]  flex items-center justify-center",
                            currentIcon === iconName
                              ? "bg-dark text-[var(--bone-100)] ring-1 ring-inset ring-[var(--bone-30)]"
                              : "opacity-40 hover:opacity-100 hover:bg-hover text-[var(--bone-100)]"
                          )}
                        >
                          <IconComp className="w-4 h-4" />
                        </button>
                      </Tooltip>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(content, document.body);
}


