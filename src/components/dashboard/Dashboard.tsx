'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { Plus, Search, FileText, Frame, Layers, ChevronLeft, ChevronRight } from 'lucide-react';
import { useStore, Entity, EditorBlock } from '@/data/store';
import { useAuth } from '@/components/AuthProvider';
import { useTheme } from '@/components/ThemeProvider';
import { TasksWidget } from '@/components/workspace/widgets/TasksWidget';
import { ShortcutsWidget } from '@/components/workspace/widgets/ShortcutsWidget';
import { loadBentoLayout, saveBentoLayout } from '@/lib/bento-sync';
import type { BentoLayoutItem } from '@/components/bento/types';

function formatAge(ts: number) {
  if (!ts) return '';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
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
  const workspaces = useStore(state => state.workspaces);
  const setActiveEntityId = useStore(state => state.setActiveEntityId);
  const setActiveWorkspaceId = useStore(state => state.setActiveWorkspaceId);

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
    <div className="flex-1 overflow-y-auto px-10 py-8 flex flex-col h-full bg-background select-none">
      <div className="max-w-5xl mx-auto w-full flex flex-col gap-8 flex-grow">
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

        {/* Recents Section */}
        <section className="flex flex-col gap-3 relative group/slider">
          <div className="flex items-center justify-between">
            <h2 className="text-[13px] font-ui-label text-muted-foreground tracking-[0.06em] uppercase">Recents</h2>
            {recentEntities.length > 3 && (
              <div className="flex items-center gap-1.5">
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

          <div
            ref={sliderRef}
            className="flex gap-4 overflow-x-auto snap-x snap-mandatory no-scrollbar pr-10 pb-2 scroll-smooth"
          >
            {recentEntities.length > 0 ? (
              recentEntities.map(entity => {
                const isNote = entity.type === 'note';
                const Icon = isNote ? FileText : Frame;
                const { bulletPoints, footerSentence } = isNote
                  ? getNotePreviewData(entity)
                  : getCanvasPreviewData(entity);
                const ws = entity.workspaceId ? workspaces.find(w => w.id === entity.workspaceId) : null;

                return (
                  <button
                    key={entity.id}
                    onClick={() => handleCardClick(entity)}
                    className="flex-shrink-0 w-[280px] h-[220px] snap-start bg-panel/40 backdrop-blur-xl border border-[var(--bone-5)] rounded-[var(--radius-big)] p-5 text-left flex flex-col justify-between hover:border-[var(--bone-20)] transition-all duration-200 cursor-pointer"
                  >
                    <div className="flex flex-col gap-3 w-full">
                      {/* Card Header */}
                      <div className="flex items-center justify-between text-[11px] text-[var(--bone-30)] font-medium">
                        <div className="flex items-center gap-1.5">
                          <Icon className="w-3.5 h-3.5 text-[var(--bone-30)]" />
                          <span>{isNote ? 'Note' : 'Canvas'}</span>
                          {ws && (
                            <>
                              <span>·</span>
                              <span className="truncate max-w-[85px]">{ws.name}</span>
                            </>
                          )}
                        </div>
                        <span>{formatAge(entity.lastModified)}</span>
                      </div>

                      {/* Card Title */}
                      <h3 className="font-display font-medium text-base text-[var(--bone-100)] line-clamp-1">
                        {entity.title || 'Untitled'}
                      </h3>

                      {/* Bullet Previews */}
                      <ul className="flex flex-col gap-1 text-[12px] text-[var(--bone-70)] leading-tight">
                        {bulletPoints.length > 0 ? (
                          bulletPoints.slice(0, 3).map((pt, idx) => (
                            <li key={idx} className="truncate pl-3 relative before:absolute before:left-0 before:top-1.5 before:w-1 before:h-1 before:rounded-full before:bg-[var(--bone-30)]">
                              {pt}
                            </li>
                          ))
                        ) : (
                          <li className="text-[var(--bone-30)] italic">No preview content</li>
                        )}
                      </ul>
                    </div>

                    {/* Card Footer Preview text */}
                    {footerSentence && (
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
          </div>
        </section>

        {/* Bottom widgets grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-grow min-h-0 select-none pb-10">
          {/* Tasks (2/3 width) */}
          <div className="md:col-span-2 flex flex-col min-h-[360px] relative rounded-[var(--radius-big)] overflow-hidden">
            <div className="flex-1 min-h-0">
              <TasksWidget contextId="dashboard" />
            </div>
            <div
              className="pointer-events-none absolute inset-0 rounded-[var(--radius-big)] border"
              style={{ borderColor: resolvedTheme === 'dark' ? 'var(--bone-3)' : 'var(--bone-6)' }}
            />
          </div>

          {/* Shortcuts (1/3 width) */}
          <div className="flex flex-col min-h-[360px] relative rounded-[var(--radius-big)] overflow-hidden">
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
