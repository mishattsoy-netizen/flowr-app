'use client';

import { useState, useRef, useEffect } from 'react';
import { Plus, Search, FileText, Frame, Layers } from 'lucide-react';
import { useStore } from '@/data/store';
import { useAuth } from '@/components/AuthProvider';

export function Dashboard() {
  const { user } = useAuth();
  const displayName = user?.user_metadata?.display_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || '';
  const setCommandPaletteOpen = useStore(state => state.setCommandPaletteOpen);
  const openModal = useStore(state => state.openModal);
  const now = new Date();
  
  const [showPlusPopup, setShowPlusPopup] = useState(false);
  const plusPopupRef = useRef<HTMLDivElement>(null);
  const plusButtonRef = useRef<HTMLButtonElement>(null);

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

  return (
    <div className="flex-1 overflow-y-auto px-10 py-8 flex flex-col h-full bg-background">
      <div className="max-w-5xl mx-auto w-full flex flex-col gap-6 flex-grow">
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

        {/* Placeholder content for widgets */}
        <div className="flex-grow flex items-center justify-center text-muted-foreground text-sm">
          Widgets Placeholder
        </div>
      </div>
    </div>
  );
}
