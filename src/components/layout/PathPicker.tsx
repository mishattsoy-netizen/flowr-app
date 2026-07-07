"use client";

import { useStore } from '@/data/store';
import { Folder, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface PathPickerProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
  excludeEntityId?: string; // Exclude an exact entity and its descendants
}

export function PathPicker({ selectedId, onSelect, excludeEntityId }: PathPickerProps) {
  const entities = useStore(state => state.entities);
  const openContextMenu = useStore(state => state.openContextMenu);
  const [localCollapsed] = useState<Set<string>>(new Set());

  const getDescendants = (parentId: string): string[] => {
    const children = entities.filter(e => e.parentId === parentId);
    let ids: string[] = [];
    for (const c of children) {
      ids.push(c.id);
      ids = ids.concat(getDescendants(c.id));
    }
    return ids;
  };

  const excludeIds = excludeEntityId ? new Set([excludeEntityId, ...getDescendants(excludeEntityId)]) : new Set();

  // Only spaces and folders are valid container targets
  const allContainers = entities.filter(e =>
    (e.type === 'workspace' || e.type === 'folder') && !excludeIds.has(e.id)
  );

  const renderTree = (parentId: string | null = null, depth = 0) => {
    const nodes = allContainers.filter(e => e.parentId === parentId);
    if (nodes.length === 0) return null;

    return (
      <div className="-mb-px flex flex-col">
        {nodes.map(node => {
          const isCollapsed = localCollapsed.has(node.id);
          const hasChildren = allContainers.some(e => e.parentId === node.id);
          const isSelected = selectedId === node.id;

          return (
            <div key={node.id}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => onSelect(node.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(node.id);
                  }
                }}
                className={cn(
                  "group flex items-center w-full px-3 py-1.5 cursor-pointer text-left outline-none rounded-[var(--radius-small)] transition-none",
                  node.type === 'workspace' ? "text-[14px] font-semibold" : "text-[13px]",
                  isSelected
                    ? "bg-[var(--bone-15)] text-[var(--bone-100)]"
                    : "text-[var(--bone-70)] hover:bg-[var(--bone-6)] hover:text-[var(--bone-100)]"
                )}
                style={{ paddingLeft: `${depth * 16 + 12}px` }}
              >
                {/* Indentation Spacer instead of Chevron */}
                <div className="w-4 h-4 shrink-0 mr-1.5" />

                <Folder strokeWidth={2} className={cn(
                  "mr-2 shrink-0 text-[var(--bone-100)] transition-opacity duration-200",
                  node.type === 'workspace' ? "w-4 h-4 opacity-70" : "w-3.5 h-3.5",
                  isSelected ? "opacity-100" : "opacity-30 group-hover:opacity-100"
                )} />
                <span className="truncate flex-1">{node.title}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    openContextMenu(node.id, rect.right + 4, rect.top, 'sidebar');
                  }}
                  className="w-6 h-6 flex items-center justify-center rounded-[var(--radius-small)] opacity-0 group-hover:opacity-100 hover:bg-hover text-muted-foreground hover:text-foreground shrink-0"
                >
                  <MoreHorizontal strokeWidth={2} className="w-3.5 h-3.5" />
                </button>
              </div>
              {hasChildren && (
                <div
                  className={cn(
                    "grid",
                    isCollapsed ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"
                  )}
                >
                  <div className="overflow-hidden">
                    <div className="relative flex flex-col">
                      {renderTree(node.id, depth + 1)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="w-full bg-[var(--bone-2)] border border-[var(--bone-6)] rounded-[var(--radius-medium)] max-h-60 overflow-y-auto scrollbar-none py-1 flex flex-col gap-[1px]">
      {renderTree(null, 0)}
      {allContainers.length === 0 && (
        <div className="text-xs text-muted-foreground p-3 text-center">No available spaces</div>
      )}
    </div>
  );
}


