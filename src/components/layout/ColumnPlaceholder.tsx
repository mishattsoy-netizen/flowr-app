"use client";

import { useStore, generateId } from '@/data/store';
import { Search, FileText, Frame } from 'lucide-react';
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

  const recentEntities = recentEntityIds
    .map(id => entities.find(e => e.id === id))
    .filter((e): e is NonNullable<typeof e> => !!e)
    .filter(e => e.type === 'note' || e.type === 'canvas')
    .slice(0, 3);

  const searchResults = searchQuery.trim()
    ? entities
        .filter(e => e.type === 'note' || e.type === 'canvas')
        .filter(e => e.title.toLowerCase().includes(searchQuery.toLowerCase()))
        .slice(0, 5)
    : [];

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
    <div className="flex-1 flex flex-col items-center justify-center p-8 gap-8 min-h-0 overflow-y-auto animate-fade-in bg-[var(--app-background)]">
      {/* Logo */}
      <div className="flex items-center justify-center w-20 h-20 rounded-2xl bg-[var(--bone-4)] border border-[var(--bone-6)] mb-2">
        <span
          className="font-serif italic font-medium text-[var(--bone-40)] select-none"
          style={{ fontSize: 36, lineHeight: 1, letterSpacing: '-0.02em' }}
        >
          F
        </span>
      </div>

      {/* Quick action buttons */}
      <div className="flex gap-3">
        <button
          onClick={() => handleNewEntity('note')}
          className="flex items-center gap-2 px-4 py-2 rounded-[8px] bg-[var(--app-background)] hover:bg-[var(--bone-6)] border border-[var(--bone-10)] text-[var(--bone-100)] text-sm font-medium transition-colors"
        >
          <FileText strokeWidth={2} className="w-4 h-4 opacity-70" />
          New Note
        </button>
        <button
          onClick={() => handleNewEntity('canvas')}
          className="flex items-center gap-2 px-4 py-2 rounded-[8px] bg-[var(--app-background)] hover:bg-[var(--bone-6)] border border-[var(--bone-10)] text-[var(--bone-100)] text-sm font-medium transition-colors"
        >
          <Frame strokeWidth={2} className="w-4 h-4 opacity-70" />
          New Canvas
        </button>
      </div>

      {/* Search bar */}
      <div className="w-full max-w-[280px] relative">
        <Search
          strokeWidth={2}
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--bone-40)] pointer-events-none"
        />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search entities..."
          className="w-full pl-9 pr-4 py-2 rounded-[8px] bg-[var(--app-background)] border border-[var(--bone-10)] text-[var(--bone-100)] text-sm placeholder:text-[var(--bone-30)] outline-none focus:border-[var(--bone-30)] focus:bg-[var(--bone-4)] transition-colors"
        />
        {/* Search results dropdown */}
        {searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 rounded-[8px] bg-[var(--app-background)] border border-[var(--bone-10)] shadow-lg overflow-hidden z-50">
            {searchResults.map(entity => {
              const Icon = entity.icon
                ? getEntityIcon(entity.icon)
                : entity.type === 'canvas' ? Frame : FileText;
              return (
                <button
                  key={entity.id}
                  onClick={() => {
                    onOpenEntity(entity.id);
                    setSearchQuery('');
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-[var(--bone-4)] text-sm text-[var(--bone-100)] transition-colors border-b border-[var(--bone-3)] last:border-0"
                >
                  <Icon strokeWidth={2} className="w-4 h-4 shrink-0 opacity-70" />
                  <span className="truncate font-medium">{stripHtml(entity.title)}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Instruction text */}
      <div className="flex items-center justify-center w-full max-w-[280px] py-2">
        <div className="h-[1px] flex-1 bg-[var(--bone-10)]" />
        <span className="px-3 text-[10px] uppercase tracking-wider font-semibold text-[var(--bone-30)]">
          Or
        </span>
        <div className="h-[1px] flex-1 bg-[var(--bone-10)]" />
      </div>

      <p className="text-xs text-[var(--bone-40)] text-center max-w-[240px] leading-relaxed">
        Drag and drop any entity from the sidebar to open it here
      </p>

      {/* Recent entities */}
      {recentEntities.length > 0 && (
        <div className="w-full max-w-[280px] mt-2">
          <p className="text-xs font-semibold text-[var(--bone-30)] mb-2 ml-1">Recent</p>
          <div className="flex flex-col gap-1">
            {recentEntities.map(entity => {
              const Icon = entity.icon
                ? getEntityIcon(entity.icon)
                : entity.type === 'canvas' ? Frame : FileText;
              return (
                <button
                  key={entity.id}
                  onClick={() => onOpenEntity(entity.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-[8px] hover:bg-[var(--bone-4)] text-sm text-[var(--bone-100)] transition-colors"
                >
                  <Icon strokeWidth={2} className="w-4 h-4 shrink-0 opacity-70" />
                  <span className="truncate">{stripHtml(entity.title)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default ColumnPlaceholder;
