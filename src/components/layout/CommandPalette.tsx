"use client";

import { useStore, generateId } from '@/data/store';
import type { Entity, EntityType } from '@/data/store';
import { getEntityIcon } from '@/data/icons';
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  Search, FileText, Frame, Layers, Folder, Sparkles, ArrowRight,
  CornerDownLeft, ArrowUp, ArrowDown, X, Plus, ListTodo, Command,
  Hash, Clock
} from 'lucide-react';
import clsx from 'clsx';

interface CommandDef {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  shortcut?: string;
  action: () => void;
}

export function CommandPalette() {
  const isOpen = useStore(s => s.isCommandPaletteOpen);
  const setOpen = useStore(s => s.setCommandPaletteOpen);
  const entities = useStore(s => s.entities);
  const setActiveEntityId = useStore(s => s.setActiveEntityId);
  const openModal = useStore(s => s.openModal);
  const addEntity = useStore(s => s.addEntity);
  const setAIAssistantOpen = useStore(s => s.setAIAssistantOpen);
  const sendAIMessage = useStore(s => s.sendAIMessage);

  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Sync rendering state with isOpen to support exit animations
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setIsClosing(false);
    } else if (shouldRender) {
      setIsClosing(true);
      const timer = setTimeout(() => {
        setShouldRender(false);
        setIsClosing(false);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isOpen, shouldRender]);

  const updateScrollFade = useCallback((target: HTMLDivElement | null) => {
    if (!target) return;
    const scrollTop = target.scrollTop;
    const scrollHeight = target.scrollHeight;
    const clientHeight = target.clientHeight;
    
    if (scrollHeight <= clientHeight) {
      target.style.setProperty('--scroll-top-offset', '0px');
      target.style.setProperty('--scroll-bottom-offset', '0px');
      return;
    }
    
    const topOffset = Math.min(scrollTop, 20);
    const bottomOffset = Math.min(scrollHeight - clientHeight - scrollTop, 20);
    
    target.style.setProperty('--scroll-top-offset', `${topOffset}px`);
    target.style.setProperty('--scroll-bottom-offset', `${bottomOffset}px`);
  }, []);

  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    updateScrollFade(e.currentTarget);
  };

  // --- COMMANDS ---
  const close = useCallback(() => setOpen(false), [setOpen]);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
        updateScrollFade(listRef.current);
      }, 50);
    }
  }, [isOpen, updateScrollFade]);

  // Close on Escape (handled via keyDown on input, but also globally)
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, setOpen]);

  // Detect mode
  const isCommandMode = query.startsWith('/');
  const isAskMode = query.toLowerCase().startsWith('ask:');
  const isSearchMode = !isCommandMode && !isAskMode && query.trim().length > 0;

  const allCommands: CommandDef[] = useMemo(() => [
    {
      id: 'note-create',
      label: 'Create Note',
      description: 'Create a new unsorted note',
      icon: <FileText strokeWidth={2} className="w-4 h-4" />,
      shortcut: '/note',
      action: () => {
        const id = generateId();
        addEntity({ id, title: 'Untitled Note', type: 'note' as EntityType, parentId: null, lastModified: Date.now() });
        setActiveEntityId(id);
        close();
      }
    },
    {
      id: 'canvas-create',
      label: 'Create Canvas',
      description: 'Create a new drawing canvas',
      icon: <Frame strokeWidth={2} className="w-4 h-4" />,
      shortcut: '/canvas',
      action: () => {
        const id = generateId();
        addEntity({ id, title: 'Untitled Canvas', type: 'canvas' as EntityType, parentId: null, lastModified: Date.now() });
        setActiveEntityId(id);
        close();
      }
    },
    {
      id: 'split-create',
      label: 'Create Split Page',
      description: 'Create a new mixed split page',
      icon: <Layers strokeWidth={2} className="w-4 h-4" />,
      shortcut: '/split',
      action: () => {
        const id = generateId();
        addEntity({ id, title: 'Untitled Split Page', type: 'mixed' as EntityType, parentId: null, lastModified: Date.now() });
        setActiveEntityId(id);
        close();
      }
    },
    {
      id: 'workspace-create',
      label: 'Create Workspace',
      description: 'Open workspace creation dialog',
      icon: <Folder strokeWidth={2} className="w-4 h-4" />,
      shortcut: '/workspace',
      action: () => { openModal({ kind: 'newWorkspace' }); close(); }
    },
    {
      id: 'task-open',
      label: 'Create Task',
      description: 'Open task creation window',
      icon: <ListTodo strokeWidth={2} className="w-4 h-4" />,
      shortcut: '/task',
      action: () => { openModal({ kind: 'newTask' }); close(); }
    },
    {
      id: 'settings',
      label: 'Open Settings',
      description: 'Open application settings',
      icon: <Command strokeWidth={2} className="w-4 h-4" />,
      shortcut: '/settings',
      action: () => { openModal({ kind: 'settings' }); close(); }
    },
    {
      id: 'dashboard',
      label: 'Go to Dashboard',
      description: 'Navigate to the dashboard',
      icon: <Layers strokeWidth={2} className="w-4 h-4" />,
      shortcut: '/dashboard',
      action: () => { setActiveEntityId('dashboard'); close(); }
    },
  ], [addEntity, setActiveEntityId, openModal, close]);

  const filteredCommands = useMemo(() => {
    if (!isCommandMode) return [];
    const term = query.slice(1).toLowerCase().trim();
    if (!term) return allCommands;
    return allCommands.filter(c =>
      c.id.includes(term) || c.label.toLowerCase().includes(term)
    );
  }, [query, isCommandMode, allCommands]);

  // --- SEARCH RESULTS ---
  const searchResults = useMemo(() => {
    if (!isSearchMode) return [];
    const lowerQ = query.toLowerCase().trim();
    return entities
      .filter(e =>
        e.title.toLowerCase().includes(lowerQ) ||
        (e.tags ?? []).some(tag => tag.toLowerCase().includes(lowerQ))
      )
      .slice(0, 12);
  }, [query, isSearchMode, entities]);



  // --- ASK AI ---
  const handleAskAI = useCallback(() => {
    const aiQuery = isAskMode ? query.slice(4).trim() : '';
    setAIAssistantOpen(true);
    if (aiQuery) {
      setTimeout(() => sendAIMessage(aiQuery), 200);
    }
    close();
  }, [query, isAskMode, setAIAssistantOpen, sendAIMessage, close]);

  // --- ITEMS LIST (unified for keyboard nav) ---
  const items = useMemo(() => {
    if (isCommandMode) {
      return filteredCommands.map(c => ({
        id: c.id,
        label: c.label,
        description: c.description,
        icon: c.icon,
        shortcut: c.shortcut,
        action: c.action,
        type: 'command' as const,
      }));
    }
    if (isAskMode) {
      return [{
        id: 'ask-ai',
        label: `Ask AI: "${query.slice(4).trim() || '...'}"`,
        description: 'Send this question to the Agent',
        icon: <Sparkles strokeWidth={2} className="w-4 h-4" />,
        action: handleAskAI,
        type: 'action' as const,
      }];
    }
    if (isSearchMode) {
      const results = searchResults.map(e => ({
        id: e.id,
        label: e.title,
        description: e.tags?.join(', ') || '',
        icon: getEntityTypeIcon(e.type, e),
        action: () => { setActiveEntityId(e.id); close(); },
        type: 'entity' as const,
        entityType: e.type,
        tags: e.tags,
      }));

      // If query matches "ask", "as", "a", prepend Ask AI
      const q = query.toLowerCase().trim();
      if ('ask ai'.startsWith(q) || q === 'ask') {
        return [{
          id: 'ask-ai-search-default',
          label: 'Ask AI',
          description: 'Open the AI Assistant',
          icon: <Sparkles strokeWidth={2} className="w-3.5 h-3.5" />,
          shortcut: 'ask:',
          action: () => { setQuery('ask:'); inputRef.current?.focus(); },
          type: 'action' as const,
        }, ...results];
      }
      return results;
    }
    // Default: all commands + Ask AI
    const commandItems = allCommands.map(c => ({
        id: c.id,
        label: c.label,
        description: c.description,
        icon: c.icon,
        shortcut: c.shortcut,
        action: c.action,
        type: 'command' as const,
    }));
    const askAiAction = {
      id: 'ask-ai-default',
      label: 'Ask AI',
      description: 'Open the AI Assistant',
      icon: <Sparkles strokeWidth={2} className="w-3.5 h-3.5" />,
      shortcut: 'ask:',
      action: () => { setQuery('ask:'); inputRef.current?.focus(); },
      type: 'action' as const,
    };
    return [...commandItems, askAiAction];
  }, [isCommandMode, isAskMode, isSearchMode, filteredCommands, searchResults, handleAskAI, allCommands, setActiveEntityId, setAIAssistantOpen, close]);

  // Clamp activeIndex when items change
  useEffect(() => {
    if (activeIndex >= items.length && items.length > 0) {
      setActiveIndex(items.length - 1);
    }
    // Update scroll fade when results change
    requestAnimationFrame(() => {
      updateScrollFade(listRef.current);
    });
  }, [items.length, activeIndex, updateScrollFade]);

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (isAskMode && items.length === 0) {
        handleAskAI();
      } else if (items[activeIndex]) {
        items[activeIndex].action();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  }, [items, activeIndex, isAskMode, handleAskAI, setOpen]);

  if (!shouldRender) return null;

  const sectionLabel = isCommandMode
    ? 'Commands'
    : isAskMode
      ? 'AI'
      : isSearchMode
        ? 'Results'
        : 'Actions & Commands';

  return (
    <div 
      className={clsx(
        "fixed inset-0 z-[300] flex items-start justify-center pt-[15vh]",
        isClosing && "pointer-events-none"
      )} 
      onClick={() => setOpen(false)}
    >
      {/* Backdrop */}
      <div 
        className={clsx(
          "absolute inset-0 bg-black/30 backdrop-blur-sm",
          isClosing ? "backdrop-exit" : "backdrop-enter"
        )} 
      />

      {/* Palette */}
      <div
        className={clsx(
          "relative w-full max-w-[640px] bg-[var(--color-panel)] border border-[var(--bone-15)] rounded-[var(--radius-big)] overflow-hidden shadow-2xl",
          isClosing ? "palette-exit" : "palette-enter"
        )}
        onClick={e => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center px-5 py-4 border-b border-[var(--bone-15)]">
          <div className="w-5 h-5 shrink-0 flex items-center justify-center mr-3">
            {isCommandMode ? (
              <Command strokeWidth={2} className="w-4.5 h-4.5 text-accent" />
            ) : isAskMode ? (
              <Sparkles strokeWidth={2} className="w-4.5 h-4.5 text-accent" />
            ) : (
              <Search strokeWidth={2} className="w-4.5 h-4.5 text-[var(--bone-30)]" />
            )}
          </div>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setActiveIndex(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Search pages, tags, or type / for commands..."
            className="flex-1 bg-transparent outline-none text-foreground text-[15px] placeholder:text-[var(--bone-30)] caret-accent"
            autoComplete="off"
            spellCheck={false}
          />
          {query && (
            <button
              onClick={() => { setQuery(''); setActiveIndex(0); inputRef.current?.focus(); }}
              className="p-1 rounded-[var(--radius-small)] text-[var(--bone-30)] hover:text-[var(--bone-100)] hover:bg-[var(--bone-6)] ml-2"
            >
              <X strokeWidth={2} className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Results */}
        <div 
          ref={listRef} 
          onScroll={onScroll}
          className="max-h-[480px] overflow-y-auto scrollbar-none py-2 px-2 flex flex-col gap-[3px]"
        >
          {/* Section label */}
          {items.length > 0 && (
            <div className="px-3 pt-1 pb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--bone-30)]">
                {sectionLabel}
              </span>
            </div>
          )}

          {items.length === 0 && query.trim() && !isAskMode && (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-[var(--bone-30)]">No results found</p>
              <p className="text-xs text-[var(--bone-30)] mt-1 opacity-60">
                Try a different search or type <span className="text-accent font-mono">/</span> for commands
              </p>
            </div>
          )}

          {items.map((item, idx) => (
            <button
              key={item.id}
              data-index={idx}
              onClick={item.action}
              onMouseEnter={() => setActiveIndex(idx)}
              className={clsx(
                "w-full flex items-center gap-2 px-2 py-1.5 rounded-[var(--radius-8)] text-left group",
                activeIndex === idx
                  ? "bg-[var(--bone-15)] text-[var(--bone-100)]"
                  : "text-[var(--bone-60)] hover:bg-[var(--bone-15)] hover:text-[var(--bone-100)]"
              )}
            >
              <div className={clsx(
                "w-6 h-6 flex items-center justify-center shrink-0",
                activeIndex === idx ? "text-[var(--bone-100)]" : "text-[var(--bone-60)]"
              )}>
                {item.icon}
              </div>
              <div className="flex-1 min-w-0 flex items-center gap-2 text-fade">
                <p className="text-[13px] font-medium tracking-wide shrink-0">{item.label}</p>
                {item.description && (
                  <p className="text-[11px] text-[var(--bone-30)] opacity-80">{item.description}</p>
                )}
              </div>
              {'tags' in item && (item as any).tags?.length > 0 && (
                <div className="flex items-center gap-1 shrink-0 ml-2">
                  {((item as any).tags as string[]).slice(0, 2).map((tag: string) => (
                    <span key={tag} className="px-1.5 py-0.5 rounded-full bg-[var(--bone-6)] text-[9px] font-bold text-[var(--bone-30)] uppercase tracking-wider">
                      <Hash strokeWidth={2} className="w-2 h-2 inline mr-0.5 -mt-px" />{tag}
                    </span>
                  ))}
                </div>
              )}
              {'entityType' in item && (
                <span className="text-[10px] font-bold text-[var(--bone-30)] uppercase tracking-wider shrink-0 ml-2">
                  {(item as any).entityType}
                </span>
              )}
              {((item as any).shortcut) && (
                <div className="flex items-center gap-0.5 shrink-0 ml-2">
                  <span className="px-1.5 py-0.5 rounded-[var(--radius-small)] bg-[var(--bone-6)] text-[10px] font-mono text-[var(--bone-30)] group-hover:text-[var(--bone-60)]">
                    {(item as any).shortcut}
                  </span>
                </div>
              )}
            </button>
          ))}


        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--bone-15)] bg-[var(--bone-3)]">
          <button
            onClick={() => { setAIAssistantOpen(true); close(); }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[var(--radius-medium)] text-[11px] font-bold text-[var(--bone-30)] hover:text-[var(--bone-100)] hover:bg-[var(--bone-6)] transition-colors"
          >
            <Sparkles strokeWidth={2} className="w-3 h-3" />
            Ask AI
          </button>
          <div className="flex items-center gap-4 text-[10px] text-[var(--bone-30)] font-medium tracking-wide">
            <span className="flex items-center gap-1">
              <ArrowUp strokeWidth={2} className="w-2.5 h-2.5" />
              <ArrowDown strokeWidth={2} className="w-2.5 h-2.5" />
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <CornerDownLeft strokeWidth={2} className="w-2.5 h-2.5" />
              Open
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-[var(--bone-6)] text-[9px] font-bold">ESC</kbd>
              Close
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper to get entity icon
function getEntityTypeIcon(type: EntityType, entity?: Entity) {
  const cls = "w-4 h-4";
  if ((type === 'collection' || type === 'folder' || type === 'workspace') && entity?.icon) {
    const CustomIcon = getEntityIcon(entity.icon);
    return <CustomIcon strokeWidth={2} className={cls} />;
  }
  switch (type) {
    case 'canvas': return <Frame strokeWidth={2} className={cls} />;
    case 'note': return <FileText strokeWidth={2} className={cls} />;
    case 'mixed': return <Layers strokeWidth={2} className={cls} />;
    case 'workspace': return <Folder strokeWidth={2} className={cls} />;
    default: return <Frame strokeWidth={2} className={cls} />;
  }
}
