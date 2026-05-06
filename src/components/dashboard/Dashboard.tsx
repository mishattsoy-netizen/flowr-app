'use client';

import { useState, useRef, useEffect } from 'react';
import { Plus, FileText, Layout, Layers } from 'lucide-react';
import { useStore } from '@/data/store';
import { BentoDashboard } from '@/components/bento/BentoDashboard';

export function Dashboard() {
  const openModal = useStore(state => state.openModal);
  const now = new Date();
  const [showNewPagePopup, setShowNewPagePopup] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setShowNewPagePopup(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCreateNote = () => {
    setShowNewPagePopup(false);
    openModal({ kind: 'newItem', initialType: 'note', defaultToFirstCollection: true });
  };

  const handleCreateCanvas = () => {
    setShowNewPagePopup(false);
    openModal({ kind: 'newItem', initialType: 'canvas', defaultToFirstCollection: true });
  };

  const handleCreateMixed = () => {
    setShowNewPagePopup(false);
    openModal({ kind: 'newItem', initialType: 'mixed', defaultToFirstCollection: true });
  };

  const title = (
    <div>
      <h1 className="text-4xl font-display text-foreground mb-1">Welcome back, Misha</h1>
      <p className="text-muted-foreground text-sm font-medium">
        {new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(now)}
      </p>
    </div>
  );

  const actions = (
    <div className="flex gap-3 items-start">
      <button onClick={() => openModal({ kind: 'newItem', defaultToFirstCollection: true })} className="btn-accent">
        <Plus strokeWidth={2} className="w-4 h-4" /> New Task
      </button>
      <div className="relative" ref={popupRef}>
        <button onClick={() => setShowNewPagePopup(!showNewPagePopup)} className="btn-task">
          <Plus strokeWidth={2} className="w-4 h-4" /> New Page
        </button>
        {showNewPagePopup && (
          <div className="absolute top-full left-0 mt-2 w-48 bg-[var(--bone-6)] border border-[var(--bone-15)] rounded-[var(--radius-medium)] shadow-lg overflow-hidden z-50">
            <button
              onClick={handleCreateNote}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-foreground/80 hover:bg-[var(--bone-10)] transition-colors"
            >
              <FileText strokeWidth={2} className="w-4 h-4 text-accent" />
              Note page
            </button>
            <button
              onClick={handleCreateCanvas}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-foreground/80 hover:bg-[var(--bone-10)] transition-colors"
            >
              <Layout strokeWidth={2} className="w-4 h-4 text-accent" />
              Canvas
            </button>
            <button
              onClick={handleCreateMixed}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-foreground/80 hover:bg-[var(--bone-10)] transition-colors border-t border-[var(--bone-15)]"
            >
              <Layers strokeWidth={2} className="w-4 h-4 text-accent" />
              Mixed
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return <BentoDashboard contextId="dashboard" title={title} actions={actions} />;
}