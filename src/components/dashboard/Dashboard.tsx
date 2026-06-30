'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { Plus, Search, FileText, Frame, Layers, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStore, Entity, EditorBlock } from '@/data/store';
import { useAuth } from '@/components/AuthProvider';
import { useTheme } from '@/components/ThemeProvider';
import { SmartTaskStackWidget } from '@/components/workspace/widgets/SmartTaskStackWidget';
import { ShortcutsWidget } from '@/components/workspace/widgets/ShortcutsWidget';
import { loadBentoLayout, saveBentoLayout } from '@/lib/bento-sync';
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

/** Strip HTML tags and markdown syntax from a string */
function stripHtml(str: string): string {
  return str
    .replace(/<[^>]+>/g, '')       // strip html tags
    .replace(/\*\*(.+?)\*\*/g, '$1') // bold
    .replace(/\*(.+?)\*/g, '$1')    // italic
    .replace(/`(.+?)`/g, '$1')      // inline code
    .replace(/\[(.+?)\]\(.+?\)/g, '$1') // links [text](url)
    .replace(/^[-*+]\s+/, '')       // list markers
    .replace(/^[0-9]+\.\s+/, '')    // numbered list markers
    .replace(/^\[[ x]\]\s+/, '')    // checklist markers
    .trim();
}

function NoteBlockPreview({ blocks }: { blocks: EditorBlock[] }) {
  if (!blocks || blocks.length === 0) {
    return <span className="text-[11px] text-[var(--bone-30)] italic">No preview content</span>;
  }

  // Flatten top-level blocks, skip canvas-only types, cap at 4 rows
  const previewBlocks = blocks
    .filter(b => !['shape', 'frame', 'comment', 'connection', 'column'].includes(b.type))
    .slice(0, 4);

  const rows: React.ReactNode[] = previewBlocks.map((b, i) => {
    const text = stripHtml(b.content || '');

    switch (b.type) {
      case 'text': {
        if (!text) return null;
        // Detect heading by style or content starting with #
        const isH = b.style === 'title' || b.style === 'heading' || b.style === 'subheading';
        const isMono = b.style === 'mono';
        return (
          <div key={i} className={cn(
            'truncate',
            isH ? 'font-semibold text-[12px] text-[var(--bone-80)]' :
            isMono ? 'font-mono text-[10px] text-[var(--bone-50)] bg-black/20 px-1.5 py-[1px] rounded' :
            'text-[11px] text-[var(--bone-60)]'
          )}>
            {text}
          </div>
        );
      }
      case 'bulletList':
      case 'dashedList':
        return (
          <div key={i} className="flex items-start gap-1.5 text-[11px] text-[var(--bone-60)]">
            <span className="mt-[3px] w-1 h-1 rounded-full bg-[var(--bone-30)] flex-shrink-0" />
            <span className="truncate">{text || '…'}</span>
          </div>
        );
      case 'numberedList':
        return (
          <div key={i} className="flex items-start gap-1.5 text-[11px] text-[var(--bone-60)]">
            <span className="text-[var(--bone-30)] flex-shrink-0 font-mono">{i + 1}.</span>
            <span className="truncate">{text || '…'}</span>
          </div>
        );
      case 'checklist':
        return (
          <div key={i} className="flex items-start gap-1.5 text-[11px] text-[var(--bone-60)]">
            <span className="mt-[2px] w-2.5 h-2.5 rounded-[2px] border border-[var(--bone-20)] flex-shrink-0" />
            <span className="truncate">{text || '…'}</span>
          </div>
        );
      case 'quote':
        return (
          <div key={i} className="flex items-start gap-1.5 text-[11px] text-[var(--bone-50)] italic">
            <div className="w-[2px] h-3 bg-[var(--bone-30)] rounded-full flex-shrink-0 mt-[1px]" />
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
      case 'link':
        return (
          <div key={i} className="flex items-center gap-1 text-[11px] text-[var(--bone-40)] truncate">
            <span className="text-[9px]">🔗</span>
            <span className="truncate underline underline-offset-2">{text || 'Link'}</span>
          </div>
        );
      case 'divider':
        return <div key={i} className="w-full h-[1px] bg-[var(--bone-6)] my-[1px]" />;
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

function getNotePreviewData(entity: Entity) {
  const bulletPoints: string[] = [];
  let footerSentence = '';

  if (!entity.content || !Array.isArray(entity.content)) {
    return { bulletPoints, footerSentence };
  }

  const traverse = (blocks: EditorBlock[]) => {
    for (const b of blocks) {
      if (bulletPoints.length >= 4 && footerSentence) break;

      if (['text', 'checklist', 'bulletList', 'dashedList', 'numberedList', 'quote'].includes(b.type) && b.content && b.content.trim()) {
        const text = b.content.trim();
        if (bulletPoints.length < 4) {
          const cleanText = text.replace(/^[-*+]\s+|^\[[ x]\]\s+|^[0-9]+\.\s+/, '');
          bulletPoints.push(cleanText);
        } else if (!footerSentence) {
          footerSentence = text;
        }
      }

      if (b.children) {
        traverse(b.children);
      }
    }
  };

  traverse(entity.content);
  return { bulletPoints, footerSentence };
}

function getCanvasPreviewData(entity: Entity) {
  const bulletPoints: string[] = [];
  let footerSentence = '';

  if (entity.content && Array.isArray(entity.content)) {
    const textElements = entity.content
      .filter(b => b.content && b.content.trim())
      .map(b => b.content.trim());

    for (let i = 0; i < Math.min(textElements.length, 4); i++) {
      bulletPoints.push(textElements[i]);
    }

    if (textElements.length > 4) {
      footerSentence = textElements[4];
    } else {
      footerSentence = `Board contains ${entity.content.length} elements.`;
    }
  } else {
    footerSentence = 'Empty canvas board.';
  }

  return { bulletPoints, footerSentence };
}

function CanvasMiniPreview({ canvasBlocks }: { canvasBlocks: EditorBlock[] }) {
  const visualBlocks = canvasBlocks.filter(b => typeof b.x === 'number' && typeof b.y === 'number');

  if (visualBlocks.length === 0) {
    return (
      <div className="relative w-full h-[90px] bg-black/15 border border-[var(--bone-6)] rounded overflow-hidden flex items-center justify-center">
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'radial-gradient(var(--bone-100) 0.5px, transparent 0.5px)',
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
  const targetH = 90 - 12;

  const scale = Math.min(targetW / (mapW || 1), targetH / (mapH || 1), 0.15);
  const offsetX = 6 + (targetW - mapW * scale) / 2;
  const offsetY = 6 + (targetH - mapH * scale) / 2;

  return (
    <div className="relative w-full h-[90px] bg-black/15 border border-[var(--bone-6)] rounded overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: 'radial-gradient(var(--bone-100) 0.5px, transparent 0.5px)',
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
        const isLine = b.shapeKind === 'line' || b.shapeKind === 'arrow' || b.type === 'connection';

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
  const displayName = user?.user_metadata?.display_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || '';
  const setCommandPaletteOpen = useStore(state => state.setCommandPaletteOpen);
  const openModal = useStore(state => state.openModal);
  const now = new Date();
  const { resolvedTheme } = useTheme();

  // Recents state
  const recentEntityIds = useStore(state => state.recentEntityIds);
  const entities = useStore(state => state.entities);
  const allBlocks = useStore(state => state.blocks);
  const workspaces = useStore(state => state.workspaces);
  const setActiveEntityId = useStore(state => state.setActiveEntityId);
  const setActiveWorkspaceId = useStore(state => state.setActiveWorkspaceId);
  const isFullWidth = useStore(state => state.isFullWidth);

  // Layout shortcuts state
  const [dashboardLayout, setDashboardLayout] = useState<BentoLayoutItem[]>([]);
  const [showPlusPopup, setShowPlusPopup] = useState(false);
  const plusPopupRef = useRef<HTMLDivElement>(null);
  const plusButtonRef = useRef<HTMLButtonElement>(null);
  const sliderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadBentoLayout('dashboard').then(saved => {
      if (saved && saved.items) {
        setDashboardLayout(saved.items);
      } else {
        const defaults = [
          { i: 'dashboard-recent',         type: 'recent',      row: 0, order: 0, w: 2, h: 4 },
          { i: 'dashboard-tasks-today',    type: 'smart-tasks', row: 0, order: 1, w: 4, h: 2 },
          { i: 'dashboard-shortcuts',      type: 'shortcuts',   row: 2, order: 0, w: 4, h: 2 },
        ];
        setDashboardLayout(defaults);
      }
    });
  }, []);

  const shortcutsItem = useMemo(() => {
    return dashboardLayout.find(it => it.type === 'shortcuts');
  }, [dashboardLayout]);

  const shortcutsData = useMemo(() => {
    return shortcutsItem?.data || { shortcuts: [] };
  }, [shortcutsItem]);

  const handleUpdateShortcuts = (newData: any) => {
    const updated = dashboardLayout.map(it => {
      if (it.type === 'shortcuts') {
        return { ...it, data: newData };
      }
      return it;
    });

    if (!dashboardLayout.some(it => it.type === 'shortcuts')) {
      updated.push({
        i: 'dashboard-shortcuts',
        type: 'shortcuts',
        row: 2,
        order: 0,
        w: 4,
        h: 2,
        data: newData
      });
    }

    setDashboardLayout(updated);
    saveBentoLayout('dashboard', updated, [6, 6, 6, 6]);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        plusPopupRef.current && !plusPopupRef.current.contains(e.target as Node) &&
        plusButtonRef.current && !plusButtonRef.current.contains(e.target as Node)
      ) {
        setShowPlusPopup(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const recentEntities = useMemo(() => {
    return recentEntityIds
      .map(id => entities.find(e => e.id === id))
      .filter((e): e is Entity => !!e && (e.type === 'note' || e.type === 'canvas'))
      .slice(0, 10);
  }, [recentEntityIds, entities]);

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
    if (entity.workspaceId) {
      setActiveWorkspaceId(entity.workspaceId);
    }
    setActiveEntityId(entity.id);
  };

  return (
    <div className="flex-1 overflow-y-auto px-8 py-5 flex flex-col h-full bg-background select-none">
      <div className={cn("w-full flex flex-col gap-4 flex-grow", isFullWidth ? "w-full" : "max-w-[1200px] mx-auto")}>
        {/* Header */}
        <header className="flex items-center justify-between py-2 border-b border-[var(--bone-6)] select-none">
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
              className="w-full flex items-center gap-2 px-3 h-9 rounded-[var(--radius-medium)] border border-[var(--bone-10)] bg-[var(--bone-5)] text-muted-foreground hover:border-[var(--bone-20)] text-xs text-left transition-all duration-200"
            >
              <Search className="w-3.5 h-3.5 text-[var(--bone-30)]" />
              <span>Search...</span>
            </button>
          </div>

          {/* Action on the right side: round plus button */}
          <div className="relative">
            <button
              ref={plusButtonRef}
              onClick={() => setShowPlusPopup(!showPlusPopup)}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-[var(--accent)] text-[var(--bone-100)] hover:opacity-90 transition-opacity border-none shadow-none"
            >
              <Plus className="w-5 h-5 text-dark" strokeWidth={2.5} />
            </button>

            {/* Quick add popup */}
            {showPlusPopup && (
              <div
                ref={plusPopupRef}
                className="absolute right-0 mt-2 z-[300] popup-glass-small min-w-[180px] p-1 flex flex-col gap-[2px]"
              >
                {[
                  { type: 'note' as const, label: 'Note', icon: FileText },
                  { type: 'canvas' as const, label: 'Canvas', icon: Frame },
                  { type: 'mixed' as const, label: 'Mixed', icon: Layers }
                ].map(opt => (
                  <button
                    key={opt.type}
                    onClick={() => {
                      openModal({ kind: 'newItem', initialType: opt.type, defaultToFirstCollection: true });
                      setShowPlusPopup(false);
                    }}
                    className="popup-item group w-full flex items-center gap-2 px-3 py-[6px] text-sm text-[var(--bone-70)] hover:text-[var(--bone-100)] hover:bg-[var(--bone-6)] transition-none text-left rounded-[var(--radius-small)]"
                  >
                    <opt.icon strokeWidth={2} className="w-4 h-4 shrink-0 text-[var(--bone-30)] group-hover:text-[var(--bone-100)]" />
                    <span className="flex-1 font-medium tracking-wide">{opt.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </header>

        {/* Recents Widget */}
        <section className="bg-panel relative rounded-[var(--radius-big)] overflow-hidden widget-shadow px-5 pb-5 pt-4 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[15px] font-widget-header font-semibold text-muted-foreground">Recents</h2>
            {recentEntities.length > 3 && (
              <div className="flex items-center gap-1.5 no-drag select-none">
                <button
                  onClick={() => scrollSlider('left')}
                  className="w-7 h-7 flex items-center justify-center rounded-[var(--radius-small)] border border-[var(--bone-10)] hover:bg-[var(--bone-5)] text-[var(--bone-70)] hover:text-[var(--bone-100)] transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => scrollSlider('right')}
                  className="w-7 h-7 flex items-center justify-center rounded-[var(--radius-small)] border border-[var(--bone-10)] hover:bg-[var(--bone-5)] text-[var(--bone-70)] hover:text-[var(--bone-100)] transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          <HorizontalOverlayScrollbar
            scrollRef={node => { sliderRef.current = node; }}
            scrollClassName="flex gap-4 pb-1.5 scroll-smooth pr-10"
          >
            {recentEntities.length > 0 ? (
              recentEntities.map(entity => {
                const isNote = entity.type === 'note';
                const Icon = isNote ? FileText : Frame;
                const { bulletPoints, footerSentence } = isNote
                  ? getNotePreviewData(entity)
                  : getCanvasPreviewData(entity);
                const ws = entity.workspaceId ? workspaces.find(w => w.id === entity.workspaceId) : null;
                const parentEntity = entity.parentId ? entities.find(e => e.id === entity.parentId) : null;
                const locationLabel = parentEntity?.title || 'Unsorted';

                return (
                  <button
                    key={entity.id}
                    onClick={() => handleCardClick(entity)}
                    className="flex-shrink-0 w-[280px] h-[185px] bg-[var(--bone-3)] border border-[var(--bone-10)] rounded-xl p-4 text-left flex flex-col justify-between hover:bg-[var(--app-dark)] transition-all duration-200 cursor-pointer"
                  >
                    <div className="flex flex-col gap-3 w-full">
                      {/* Card Header */}
                      <div className="flex items-center justify-between text-[11px] text-[var(--bone-30)] font-medium">
                        <div className="flex items-center gap-1.5">
                          <Icon className="w-3.5 h-3.5 text-[var(--bone-30)]" />
                          <span>{isNote ? 'Note' : 'Canvas'}</span>
                          <span>·</span>
                          <span className="truncate max-w-[85px]">{locationLabel}</span>
                        </div>
                        <span>{formatAge(entity.lastModified)}</span>
                      </div>

                      {/* Card Title */}
                      <h3 className="font-display font-medium text-base text-[var(--bone-100)] line-clamp-1">
                        {entity.title || 'Untitled'}
                      </h3>

                      {/* Visual previews: semantic block renderer for notes, visual minimap for canvases */}
                      {isNote ? (
                        <NoteBlockPreview blocks={(entity.content || []).filter(b => !['shape','frame','comment','connection','column'].includes(b.type)).slice(0,4)} />
                      ) : (
                        <CanvasMiniPreview canvasBlocks={allBlocks.filter(b => b.canvasId === entity.id)} />
                      )}
                    </div>

                    {/* Card Footer — only for notes */}
                    {isNote && footerSentence && (
                      <p className="text-[11px] text-[var(--bone-30)] truncate w-full pt-2 border-t border-[var(--bone-3)] font-sans">
                        {footerSentence}
                      </p>
                    )}
                  </button>
                );
              })
            ) : (
              <div className="w-full h-[180px] flex flex-col items-center justify-center gap-2 border border-dashed border-[var(--bone-10)] rounded-[var(--radius-big)] text-center p-4">
                <span className="text-sm font-semibold text-muted-foreground">No recent documents</span>
                <span className="text-xs text-muted-foreground/60 max-w-[280px]">Your recently updated Notes and Canvases will appear here.</span>
              </div>
            )}
          </HorizontalOverlayScrollbar>
          <div
            className="pointer-events-none absolute inset-0 rounded-[var(--radius-big)] border"
            style={{ borderColor: resolvedTheme === 'dark' ? 'var(--bone-3)' : 'var(--bone-6)' }}
          />
        </section>

        {/* Bottom widgets grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-grow min-h-0 select-none pb-4">
          {/* Tasks (2/3 width) */}
          <div className="md:col-span-2 flex flex-col h-[485px] relative rounded-[var(--radius-big)] overflow-hidden">
            <div className="flex-1 min-h-0">
              <SmartTaskStackWidget contextId="dashboard" />
            </div>
            <div
              className="pointer-events-none absolute inset-0 rounded-[var(--radius-big)] border"
              style={{ borderColor: resolvedTheme === 'dark' ? 'var(--bone-3)' : 'var(--bone-6)' }}
            />
          </div>

          {/* Shortcuts (1/3 width) */}
          <div className="flex flex-col h-[485px] relative rounded-[var(--radius-big)] overflow-hidden">
            <div className="flex-1 min-h-0">
              <ShortcutsWidget
                data={shortcutsData}
                onUpdateData={handleUpdateShortcuts}
              />
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
