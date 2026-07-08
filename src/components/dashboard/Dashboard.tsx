'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { Plus, Search, FileText, Frame, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStore, Entity, EditorBlock, generateId } from '@/data/store';
import { useAuth } from '@/components/AuthProvider';
import { useTheme } from '@/components/ThemeProvider';
import { SmartTaskStackWidget } from '@/components/workspace/widgets/SmartTaskStackWidget';
import { ShortcutsWidget } from '@/components/workspace/widgets/ShortcutsWidget';
import { loadBentoLayout, saveBentoLayout, loadBentoLayoutSync } from '@/lib/bento-sync';
import { HorizontalOverlayScrollbar } from '@/components/tracker/HorizontalOverlayScrollbar';
import type { BentoLayoutItem } from '@/components/bento/types';

function formatAge(ts: number) {
  if (!ts) return '';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function decodeEntities(str: string): string {
  return str
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');
}

/** Strip HTML tags, markdown syntax, and decode HTML entities */
function stripHtml(str: string): string {
  return decodeEntities(str
    .replace(/<[^>]+>/g, ' ')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .replace(/^[-*+]\s+/, '')
    .replace(/^[0-9]+\.\s+/, '')
    .replace(/^\[[ x]\]\s+/, '')
    .replace(/\s+/g, ' ')
    .trim());
}

/**
 * Parse a block's HTML content into React nodes, rendering inline-link-btn
 * anchors as underlined text spans and everything else as plain text.
 */
function parseInlineContent(html: string): React.ReactNode {
  // Split on inline-link-btn anchors, capture their inner text
  const parts = html.split(/(<a\b[^>]*class="[^"]*inline-link-btn[^"]*"[^>]*>[\s\S]*?<\/a>)/gi);
  if (parts.length === 1) {
    // No inline links — plain text after entity decode
    const plain = decodeEntities(html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
    return plain || null;
  }
  return parts.map((part, idx) => {
    if (/inline-link-btn/i.test(part)) {
      // Extract data-label or inner text
      const labelMatch = part.match(/data-label="([^"]*)"/i);
      const innerMatch = part.match(/>([^<]*)</);
      const label = decodeEntities((labelMatch?.[1] || innerMatch?.[1] || 'link').trim());
      if (!label) return null;
      return (
        <span key={idx} className="underline underline-offset-2 decoration-[var(--bone-30)] text-[var(--bone-50)]">
          {label}
        </span>
      );
    }
    const plain = decodeEntities(part.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '));
    return plain || null;
  });
}

function NoteBlockPreview({ blocks }: { blocks: EditorBlock[] }) {
  if (!blocks || blocks.length === 0) {
    return <span className="text-[11px] text-[var(--bone-30)] italic">No preview content</span>;
  }

  const previewBlocks = blocks
    .filter(b => !['shape', 'frame', 'column'].includes(b.type));

  const rows: React.ReactNode[] = previewBlocks.map((b, i) => {
    const text = stripHtml(b.content || '');

    switch (b.type) {
      case 'text': {
        const isH = b.style === 'title' || b.style === 'heading' || b.style === 'subheading';
        const isMono = b.style === 'mono';
        const content = parseInlineContent(b.content || '');
        if (!content) return null;
        return (
          <div key={i} className={cn(
            'truncate',
            isH ? 'font-semibold text-[12px] text-[var(--bone-80)]' :
            isMono ? 'font-mono text-[10px] text-[var(--bone-50)] bg-black/20 px-1.5 py-[1px] rounded' :
            'text-[11px] text-[var(--bone-60)]'
          )}>
            {content}
          </div>
        );
      }
      case 'bulletList':
        return (
          <div key={i} className="flex items-center gap-1.5 text-[11px] text-[var(--bone-60)]">
            <span className="w-[5px] h-[5px] rounded-full bg-[var(--bone-30)] flex-shrink-0" />
            <span className="truncate">{text || '…'}</span>
          </div>
        );
      case 'dashedList':
        return (
          <div key={i} className="flex items-center gap-1.5 text-[11px] text-[var(--bone-60)]">
            <span className="w-[8px] h-[1.5px] bg-[var(--bone-30)] flex-shrink-0" />
            <span className="truncate">{text || '…'}</span>
          </div>
        );
      case 'numberedList':
        return (
          <div key={i} className="flex items-center gap-1.5 text-[11px] text-[var(--bone-60)]">
            <span className="text-[var(--bone-30)] flex-shrink-0 font-mono">{i + 1}.</span>
            <span className="truncate">{text || '…'}</span>
          </div>
        );
      case 'checklist':
        return (
          <div key={i} className="flex items-center gap-1.5 text-[11px] text-[var(--bone-60)]">
            <span className="w-2.5 h-2.5 rounded-[2px] border border-[var(--bone-20)] flex-shrink-0 translate-y-[0.5px]" />
            <span className="truncate">{text || '…'}</span>
          </div>
        );
      case 'quote':
        return (
          <div key={i} className="flex items-center gap-1.5 text-[11px] text-[var(--bone-50)] italic">
            <div className="w-[2px] h-3 bg-[var(--bone-30)] rounded-full flex-shrink-0" />
            <span className="truncate">{text || '…'}</span>
          </div>
        );
      case 'table':
        return (
          <div key={i} className="flex flex-col gap-[2px] w-full">
            <div className="h-[5px] w-full rounded-[1px] bg-[var(--bone-10)]" />
            <div className="h-[4px] w-4/5 rounded-[1px] bg-[var(--bone-6)]" />
            <div className="h-[4px] w-4/5 rounded-[1px] bg-[var(--bone-6)]" />
          </div>
        );
      case 'image':
      case 'video':
        return (
          <div key={i} className="flex items-center gap-1.5 text-[10px] text-[var(--bone-40)]">
            <span>{b.type === 'image' ? '🖼' : '▶'}</span>
            <span>{b.type === 'image' ? 'Image' : 'Video'}</span>
          </div>
        );
      case 'link': {
        let label = '';
        try { if (b.linkUrl) label = new URL(b.linkUrl).hostname; } catch {}
        if (!label) label = stripHtml(b.content || '') || 'Link';
        return (
          <span key={i} className="truncate text-[11px] text-[var(--bone-50)] underline underline-offset-2 decoration-[var(--bone-30)]">
            {label}
          </span>
        );
      }
      case 'divider':
        return <div key={i} className="w-full h-[1px] bg-[var(--bone-6)] my-[3px]" />;
      case 'columns':
        return (
          <div key={i} className="flex gap-1 w-full">
            <div className="h-[5px] flex-1 rounded-[1px] bg-[var(--bone-10)]" />
            <div className="h-[5px] flex-1 rounded-[1px] bg-[var(--bone-10)]" />
          </div>
        );
      default:
        if (!text) return null;
        return (
          <div key={i} className="truncate text-[11px] text-[var(--bone-50)]">{text}</div>
        );
    }
  }).filter(Boolean);

  if (rows.length === 0) {
    return <span className="text-[11px] text-[var(--bone-30)] italic">No preview content</span>;
  }

  return <div className="flex flex-col gap-[5px] w-full">{rows}</div>;
}


function CanvasMiniPreview({ canvasBlocks }: { canvasBlocks: EditorBlock[] }) {
  const visualBlocks = canvasBlocks.filter(b => typeof b.x === 'number' && typeof b.y === 'number');

  if (visualBlocks.length === 0) {
    return (
      <div className="relative w-full h-full bg-[color-mix(in_srgb,black_15%,var(--card-bg))] border border-[var(--bone-6)] rounded-md overflow-hidden flex items-center justify-center">
        <div
          className="absolute inset-0 opacity-[0.01]"
          style={{
            backgroundImage: 'linear-gradient(to right, var(--bone-100) 1px, transparent 1px), linear-gradient(to bottom, var(--bone-100) 1px, transparent 1px)',
            backgroundSize: '8px 8px',
          }}
        />
        <span className="text-[10px] font-medium text-[var(--bone-40)] select-none">Empty board</span>
      </div>
    );
  }

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  visualBlocks.forEach(b => {
    const x = b.x ?? 0;
    const y = b.y ?? 0;
    const w = b.width ?? 100;
    const h = b.height ?? 80;
    if (x < minX) minX = x;
    if (x + w > maxX) maxX = x + w;
    if (y < minY) minY = y;
    if (y + h > maxY) maxY = y + h;
  });

  const mapW = maxX - minX;
  const mapH = maxY - minY;
  const targetW = 248 - 12;
  const targetH = 120 - 12;

  const scale = Math.min(targetW / (mapW || 1), targetH / (mapH || 1), 0.15);
  const offsetX = 6 + (targetW - mapW * scale) / 2;
  const offsetY = 6 + (targetH - mapH * scale) / 2;

  return (
    <div className="relative w-full h-full bg-[color-mix(in_srgb,black_15%,var(--card-bg))] border border-[var(--bone-6)] rounded-md overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.01]"
        style={{
          backgroundImage: 'linear-gradient(to right, var(--bone-100) 1px, transparent 1px), linear-gradient(to bottom, var(--bone-100) 1px, transparent 1px)',
          backgroundSize: '8px 8px',
        }}
      />
      {visualBlocks.map(b => {
        const left = offsetX + ((b.x ?? 0) - minX) * scale;
        const top = offsetY + ((b.y ?? 0) - minY) * scale;
        const width = Math.max((b.width ?? 100) * scale, 1.5);
        const height = Math.max((b.height ?? 80) * scale, 1.5);

        const fill = b.canvasStyleExt?.fill || b.bgColor || 'var(--bone-20)';
        const isCircle = b.shapeKind === 'ellipse';
        const isLine = b.shapeKind === 'line' || b.shapeKind === 'arrow';

        if (isLine) {
          return (
            <div
              key={b.id}
              className="absolute bg-[var(--bone-30)] opacity-60"
              style={{ left, top, width, height, borderRadius: 1 }}
            />
          );
        }

        return (
          <div
            key={b.id}
            className={cn(
              "absolute border-[0.5px] border-white/10 opacity-70",
              isCircle ? "rounded-full" : "rounded-[1.5px]"
            )}
            style={{ left, top, width, height, backgroundColor: fill }}
          />
        );
      })}
    </div>
  );
}

export function Dashboard() {
  const { user } = useAuth();
  const cachedDisplayName = useStore(state => state.cachedDisplayName);
  const setCachedDisplayName = useStore(state => state.setCachedDisplayName);
  const displayName = user?.user_metadata?.display_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || cachedDisplayName || '';

  useEffect(() => {
    if (user) {
      const name = user.user_metadata?.display_name || user.user_metadata?.full_name || user.email?.split('@')[0] || '';
      if (name && name !== cachedDisplayName) {
        setCachedDisplayName(name);
      }
    }
  }, [user, cachedDisplayName, setCachedDisplayName]);

  const setCommandPaletteOpen = useStore(state => state.setCommandPaletteOpen);
  const addEntity = useStore(state => state.addEntity);
  const now = new Date();
  const { resolvedTheme } = useTheme();

  // Recents state
  const recentEntityIds = useStore(state => state.recentEntityIds);
  const entities = useStore(state => state.entities);
  const allBlocks = useStore(state => state.blocks);
  const spaces = useStore(state => state.spaces);
  const setActiveEntityId = useStore(state => state.setActiveEntityId);
  const setActiveSpaceId = useStore(state => state.setActiveSpaceId);
  const activeSpaceId = useStore(state => state.activeSpaceId);
  const isFullWidth = useStore(state => state.isFullWidth);
  const [recentSort, setRecentSort] = useState<'opened' | 'edited'>('opened');
  const [showSortPicker, setShowSortPicker] = useState(false);

  // Layout shortcuts state
  const [dashboardLayout, setDashboardLayout] = useState<BentoLayoutItem[]>(() => {
    const cached = loadBentoLayoutSync('dashboard');
    if (cached && cached.items) {
      return cached.items;
    }
    return [
      { i: 'dashboard-recent',         type: 'recent',      row: 0, order: 0, w: 2, h: 4 },
      { i: 'dashboard-tasks-today',    type: 'smart-tasks', row: 0, order: 1, w: 4, h: 2 },
      { i: 'dashboard-shortcuts',      type: 'shortcuts',   row: 2, order: 0, w: 4, h: 2 },
    ];
  });
  const [showPlusPopup, setShowPlusPopup] = useState(false);
  const plusPopupRef = useRef<HTMLDivElement>(null);
  const plusButtonRef = useRef<HTMLButtonElement>(null);
  const sliderRef = useRef<HTMLDivElement>(null);
  const sortPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cached = loadBentoLayoutSync('dashboard');
    if (cached && cached.items) {
      setDashboardLayout(cached.items);
    } else {
      setDashboardLayout([
        { i: 'dashboard-recent',         type: 'recent',      row: 0, order: 0, w: 2, h: 4 },
        { i: 'dashboard-tasks-today',    type: 'smart-tasks', row: 0, order: 1, w: 4, h: 2 },
        { i: 'dashboard-shortcuts',      type: 'shortcuts',   row: 2, order: 0, w: 4, h: 2 },
      ]);
    }

    loadBentoLayout('dashboard').then(saved => {
      if (saved && saved.items) {
        setDashboardLayout(saved.items);
      }
    });
  }, []);



  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        plusPopupRef.current && !plusPopupRef.current.contains(e.target as Node) &&
        plusButtonRef.current && !plusButtonRef.current.contains(e.target as Node)
      ) {
        setShowPlusPopup(false);
      }
      if (sortPickerRef.current && !sortPickerRef.current.contains(e.target as Node)) {
        setShowSortPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const recentEntities = useMemo(() => {
    const defaultSpace = spaces.find(s => s.isDefault);
    const list = recentEntityIds
      .map(id => entities.find(e => e.id === id))
      .filter((e): e is Entity => {
        if (!e || (e.type !== 'note' && e.type !== 'canvas')) return false;
        const entitySpaceId = e.spaceId || 'ws-personal';
        // Legacy 'ws-personal' entities visible in the default space
        if (entitySpaceId === 'ws-personal') {
          if (defaultSpace) return activeSpaceId === defaultSpace.id;
          return true;
        }
        return entitySpaceId === activeSpaceId;
      })
      .slice(0, 10);
    if (recentSort === 'edited') {
      return [...list].sort((a, b) => (b.lastModified ?? 0) - (a.lastModified ?? 0));
    }
    return list; // 'opened' order is preserved from recentEntityIds
  }, [recentEntityIds, entities, recentSort, activeSpaceId]);

  const scrollSlider = (direction: 'left' | 'right') => {
    if (sliderRef.current) {
      const scrollAmount = 360;
      sliderRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const handleCardClick = (entity: Entity) => {
    if (entity.spaceId) {
      setActiveSpaceId(entity.spaceId);
    }
    setActiveEntityId(entity.id);
  };

  return (
    <div className="flex-1 overflow-y-auto px-8 py-8 flex flex-col h-full bg-background select-none items-center">
      <div className={cn("w-full flex flex-col gap-4 flex-1 min-h-0", isFullWidth ? "w-full" : "max-w-[1200px] mx-auto")}>
        {/* Header */}
        <header className="flex items-center justify-between py-2 select-none h-16 shrink-0">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-display font-medium text-foreground mb-0.5">
              Welcome back{displayName ? `, ${displayName}` : ''}
            </h1>
            <p className="text-muted-foreground text-xs font-medium">
              {new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(now)}
            </p>
          </div>

          {/* Search bar in header */}
          <div className="flex-1 max-w-[280px] mx-4 relative">
            <button
              onClick={() => setCommandPaletteOpen(true)}
              className="group w-full flex items-center gap-2 px-3 h-9 rounded-full border border-[var(--bone-10)] bg-[var(--sys-color)] hover:border-[var(--bone-30)] hover:bg-[var(--card-bg)] text-[var(--bone-100)] text-xs text-left transition-all duration-200"
            >
              <Search className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 transition-opacity" />
              <span className="opacity-60 group-hover:opacity-100 transition-opacity">Search...</span>
            </button>
          </div>

          {/* Action on the right side: round plus button */}
          <div className="relative">
            <button
              ref={plusButtonRef}
              onClick={() => setShowPlusPopup(!showPlusPopup)}
              className="group w-9 h-9 flex items-center justify-center rounded-full border border-[var(--bone-10)] bg-[var(--sys-color)] text-[var(--bone-100)] hover:border-[var(--bone-30)] hover:bg-[var(--card-bg)] transition-all duration-200 shadow-none"
            >
              <Plus className="w-5 h-5 opacity-60 group-hover:opacity-100 transition-opacity" strokeWidth={2} />
            </button>

            {/* Quick add popup */}
            {showPlusPopup && (
              <div
                ref={plusPopupRef}
                className="absolute right-0 mt-2 z-[300] popup-glass-small min-w-[160px] p-1 flex flex-col gap-[2px]"
              >
                {[
                  { type: 'note' as const, label: 'Note', icon: FileText },
                  { type: 'canvas' as const, label: 'Canvas', icon: Frame },
                ].map(opt => (
                  <button
                    key={opt.type}
                    onClick={() => {
                      const newId = generateId();
                      addEntity({
                        id: newId,
                        title: `Untitled ${opt.label}`,
                        type: opt.type,
                        parentId: null,
                        lastModified: Date.now(),
                      });
                      setActiveEntityId(newId);
                      setShowPlusPopup(false);
                    }}
                    className="popup-item group w-full flex items-center gap-2 px-3 text-sm transition-none"
                  >
                    <opt.icon strokeWidth={2} className="w-4 h-4 shrink-0 text-[var(--bone-100)] opacity-70 group-hover:opacity-100" />
                    <span className="flex-1 text-left font-medium tracking-wide">{opt.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </header>

        {/* Recents Widget */}
        <section
          className="bg-panel relative rounded-[var(--radius-big)] overflow-hidden widget-shadow px-5 pb-5 pt-4 flex flex-col min-h-[180px] max-h-[365px] basis-0"
          style={{ flexGrow: 261 }}
        >
          <div className="flex items-center justify-between mb-4 shrink-0">
            <h2 className="text-[15px] font-widget-header font-semibold text-muted-foreground">Recents</h2>
            <div className="flex items-center gap-1.5 no-drag select-none">
              {/* Sort picker */}
              <div ref={sortPickerRef} className="relative">
                <button
                  onClick={() => setShowSortPicker(p => !p)}
                  className="flex items-center gap-1 pl-3 pr-2 h-7 rounded-[var(--radius-small)] text-[11px] font-medium text-[var(--bone-60)] bg-[var(--bone-3)] hover:text-[var(--bone-100)] hover:bg-[var(--app-dark)] transition-colors"
                >
                  {recentSort === 'opened' ? 'Last opened' : 'Last edited'}
                  <ChevronDown className="w-3 h-3" />
                </button>
                {showSortPicker && (
                  <div className="absolute right-0 mt-1 z-[300] popup-glass-small min-w-[140px] p-1 flex flex-col gap-[2px]">
                    {([['opened', 'Last opened'], ['edited', 'Last edited']] as const).map(([val, label]) => (
                      <button
                        key={val}
                        onClick={() => { setRecentSort(val); setShowSortPicker(false); }}
                        className={cn(
                          "popup-item",
                          recentSort === val && "text-[var(--bone-100)] bg-[var(--app-dark)]"
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* Scroll arrows */}
              {recentEntities.length > 3 && (
                <>
                  <button
                    onClick={() => scrollSlider('left')}
                    className="w-7 h-7 flex items-center justify-center rounded-[var(--radius-small)] text-[var(--bone-60)] bg-[var(--bone-3)] hover:text-[var(--bone-100)] hover:bg-[var(--app-dark)] transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => scrollSlider('right')}
                    className="w-7 h-7 flex items-center justify-center rounded-[var(--radius-small)] text-[var(--bone-60)] bg-[var(--bone-3)] hover:text-[var(--bone-100)] hover:bg-[var(--app-dark)] transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>

          {recentEntities.length > 0 ? (
            <HorizontalOverlayScrollbar
              scrollRef={node => { sliderRef.current = node; }}
              scrollClassName="flex gap-4 pb-1.5 pr-10"
            >
              {recentEntities.map(entity => {
                const isNote = entity.type === 'note';
                const Icon = isNote ? FileText : Frame;
                const ws = entity.spaceId ? spaces.find(w => w.id === entity.spaceId) : null;
                const parentEntity = entity.parentId ? entities.find(e => e.id === entity.parentId) : null;
                const locationLabel = parentEntity?.title || 'Unsorted';

                return (
                  <button
                    key={entity.id}
                    onClick={() => handleCardClick(entity)}
                    className="group flex-shrink-0 w-[280px] h-full min-h-0 bg-[var(--card-bg)] border border-[var(--bone-10)] rounded-xl text-left flex flex-col hover:bg-[var(--app-dark)] transition-all duration-200 cursor-pointer overflow-hidden"
                    style={{ paddingTop: '0.875rem', paddingLeft: '1rem', paddingRight: '1rem', paddingBottom: isNote ? 0 : '1rem' }}
                  >
                    {/* Card Header */}
                    <div className="flex items-center justify-between text-[11px] text-[var(--bone-30)] font-medium shrink-0 mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <Icon className="w-3.5 h-3.5 text-[var(--bone-100)] opacity-30" />
                        <span>{isNote ? 'Note' : 'Canvas'}</span>
                        <span>·</span>
                        <span className="truncate max-w-[85px]">{locationLabel}</span>
                      </div>
                      <span>{formatAge(entity.lastModified)}</span>
                    </div>

                    {/* Card Title */}
                    <h3 className="font-display font-medium text-base text-[var(--bone-100)] line-clamp-1 shrink-0 mb-2.5">
                      {entity.title || 'Untitled'}
                    </h3>

                    {/* Preview — fills remaining space with fade-out */}
                    <div className="relative flex-1 min-h-0 overflow-hidden">
                      {isNote ? (
                        <NoteBlockPreview blocks={(Array.isArray(entity.content) ? entity.content : []).filter(b => !['shape','frame','column'].includes(b.type))} />
                      ) : (
                        <CanvasMiniPreview canvasBlocks={allBlocks.filter(b => b.canvasId === entity.id)} />
                      )}
                      {isNote && (
                        <div className="absolute inset-x-0 bottom-0 h-12 pointer-events-none bg-gradient-to-b from-transparent to-[var(--card-bg)] group-hover:to-[var(--app-dark)] transition-colors duration-200" />
                      )}
                    </div>

                  </button>
                );
              })}
            </HorizontalOverlayScrollbar>
          ) : (
            <div className="w-full h-full min-h-0 flex flex-col items-center justify-center gap-3 p-4 bg-white/[0.01] rounded-[12px] text-center">
              <div className="text-center max-w-[320px]">
                <p className="text-base font-semibold text-bone-100 opacity-40">No recent documents</p>
                <p className="text-xs text-bone-70 opacity-25 mt-1 leading-snug text-balance">Your recently updated Notes and Canvases will appear here.</p>
              </div>
            </div>
          )}
          <div
            className="pointer-events-none absolute inset-0 rounded-[var(--radius-big)] border"
            style={{ borderColor: resolvedTheme === 'dark' ? 'var(--bone-3)' : 'var(--bone-6)' }}
          />
        </section>

        {/* Bottom widgets grid */}
        <div
          className="grid grid-cols-1 md:grid-cols-3 gap-4 min-h-[320px] max-h-[680px] basis-0 select-none"
          style={{ flexGrow: 485 }}
        >
          {/* Tasks (2/3 width) */}
          <div className="md:col-span-2 flex flex-col relative rounded-[var(--radius-big)] overflow-hidden">
            <div className="flex-1 min-h-0">
              <SmartTaskStackWidget contextId="dashboard" />
            </div>
            <div
              className="pointer-events-none absolute inset-0 rounded-[var(--radius-big)] border"
              style={{ borderColor: resolvedTheme === 'dark' ? 'var(--bone-3)' : 'var(--bone-6)' }}
            />
          </div>

          {/* Shortcuts (1/3 width) */}
          <div className="flex flex-col relative rounded-[var(--radius-big)] overflow-hidden">
            <div className="flex-1 min-h-0">
              <ShortcutsWidget contextId="dashboard" />
            </div>
            <div
              className="pointer-events-none absolute inset-0 rounded-[var(--radius-big)] border"
              style={{ borderColor: resolvedTheme === 'dark' ? 'var(--bone-3)' : 'var(--bone-6)' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
