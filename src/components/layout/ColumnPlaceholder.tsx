"use client";

import { useStore, generateId } from '@/data/store';
import { Search, FileText, Frame, ChevronRight } from 'lucide-react';
import { getEntityIcon } from '@/data/icons';
import { stripHtml } from '@/lib/utils';
import { useState } from 'react';

interface ColumnPlaceholderProps {
  column: 'left' | 'right';
  onOpenEntity: (entityId: string) => void;
}

export function ColumnPlaceholder({ column, onOpenEntity }: ColumnPlaceholderProps) {
  const entities = useStore(s => s.entities);
  const recentEntityIds = useStore(s => s.recentEntityIds);
  const addEntity = useStore(s => s.addEntity);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const recentEntities = recentEntityIds
    .map(id => entities.find(e => e.id === id))
    .filter((e): e is NonNullable<typeof e> => !!e)
    .filter(e => e.type === 'note' || e.type === 'canvas')
    .slice(0, 5);

  const searchResults = searchQuery.trim()
    ? entities
      .filter(e => e.type === 'note' || e.type === 'canvas')
      .filter(e => e.title.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => b.lastModified - a.lastModified)
    : entities
      .filter(e => e.type === 'note' || e.type === 'canvas')
      .sort((a, b) => b.lastModified - a.lastModified);

  const handleNewEntity = (type: 'note' | 'canvas') => {
    const newId = generateId();
    addEntity({
      id: newId,
      title: `Untitled ${type === 'note' ? 'Note' : 'Canvas'}`,
      type,
      parentId: null,
      lastModified: Date.now(),
    });
    onOpenEntity(newId);
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 gap-5 min-h-0 overflow-y-auto animate-fade-in bg-[var(--app-background)] relative">
      {/* Quick action buttons */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => handleNewEntity('note')}
          className="flex items-center gap-2.5 px-5 h-11 rounded-full border border-[var(--bone-10)] bg-[var(--sys-color)] text-[var(--bone-90)] hover:border-[var(--bone-30)] hover:bg-[var(--card-bg)] transition-all duration-200 text-sm font-semibold select-none"
        >
          <FileText strokeWidth={2} className="w-5 h-5 opacity-70" />
          New Note
        </button>
        <button
          onClick={() => handleNewEntity('canvas')}
          className="flex items-center gap-2.5 px-5 h-11 rounded-full border border-[var(--bone-10)] bg-[var(--sys-color)] text-[var(--bone-90)] hover:border-[var(--bone-30)] hover:bg-[var(--card-bg)] transition-all duration-200 text-sm font-semibold select-none"
        >
          <Frame strokeWidth={2} className="w-5 h-5 opacity-70" />
          New Canvas
        </button>
      </div>

      {/* Bento Widget Container */}
      <div className="w-[420px] shrink-0 bg-panel widget-shadow border border-[var(--bone-6)] rounded-[var(--radius-big)] p-6 flex flex-col gap-6">
        {/* Search bar */}
        <div className="w-full relative">
          <Search strokeWidth={2} className="absolute top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--bone-60)] pointer-events-none" style={{ left: 16 }} />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="Search"
            className="w-full pr-4 h-11 rounded-[10px] bg-[var(--bone-3)] hover:bg-[var(--bone-5)] focus:bg-[var(--bone-5)] border border-[var(--bone-3)] hover:border-[var(--bone-10)] focus:border-[var(--brand-blue)] focus:hover:border-[var(--bone-10)] text-[var(--bone-100)] text-sm placeholder:text-[var(--bone-60)] outline-none transition-colors"
            style={{ paddingLeft: 44 }}
          />
          {/* Search results dropdown */}
          {isFocused && searchResults.length > 0 && (
            <div
              className="absolute top-full left-0 right-0 mt-2 z-[300] popup-glass-small overflow-hidden"
              onMouseDown={(e) => e.preventDefault()}
            >
              <div
                className="p-1 flex flex-col gap-[2px] overflow-y-auto custom-scrollbar"
                style={{ maxHeight: 300 }}
              >
                {searchResults.slice(0, 20).map(entity => {
                  const Icon = entity.icon
                    ? getEntityIcon(entity.icon)
                    : entity.type === 'canvas' ? Frame : FileText;
                  return (
                    <button
                      key={entity.id}
                      onClick={() => {
                        onOpenEntity(entity.id);
                        setSearchQuery('');
                        setIsFocused(false);
                        (document.activeElement as HTMLElement)?.blur();
                      }}
                      className="popup-item justify-between py-2 shrink-0"
                    >
                      <div className="flex items-center gap-3 truncate">
                        <Icon strokeWidth={2} className="w-5 h-5 shrink-0 opacity-70" />
                        <span className="truncate font-medium">{stripHtml(entity.title)}</span>
                      </div>
                      <ChevronRight strokeWidth={2} className="w-5 h-5 opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Recent entities */}
        <div className="w-full flex flex-col gap-2">
          <p className="text-[13px] font-medium text-[var(--bone-60)] ml-1 mb-1">Recent</p>
          <div className="flex flex-col gap-1">
            {recentEntities.map(entity => {
              const Icon = entity.icon
                ? getEntityIcon(entity.icon)
                : entity.type === 'canvas' ? Frame : FileText;
              return (
                <button
                  key={entity.id}
                  onClick={() => onOpenEntity(entity.id)}
                  className="group flex items-center justify-between w-full px-3 py-2.5 rounded-[10px] bg-[var(--bone-6)] text-[var(--bone-70)] hover:bg-[var(--app-dark)] hover:text-[var(--bone-100)] transition-colors"
                >
                  <div className="flex items-center gap-3 truncate">
                    <Icon strokeWidth={2} className="w-5 h-5 text-[var(--bone-100)] opacity-70 shrink-0" />
                    <span className="truncate text-sm font-medium">{stripHtml(entity.title)}</span>
                  </div>
                  <ChevronRight strokeWidth={2} className="w-5 h-5 opacity-0 group-hover:opacity-60 text-[var(--bone-100)] transition-opacity shrink-0" />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <p className="text-xs text-[var(--bone-30)] text-center mt-2 max-w-[240px] leading-relaxed z-10">
        Drag and drop any entity from the sidebar to open it here
      </p>

      {/* Logo at bottom */}
      <img
        src="/Logo stamp.svg"
        alt="Flowr Logo"
        className="absolute bottom-8 w-12 h-12 opacity-5 select-none pointer-events-none"
      />
    </div>
  );
}

export default ColumnPlaceholder;
