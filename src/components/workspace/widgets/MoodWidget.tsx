"use client";

import { useStore } from '@/data/store';

export function MoodWidget() {
  const _store = useStore(state => state);

  return (
    <div className="bg-sidebar border border-[var(--bone-3)] group/widget px-5 pb-5 pt-4 rounded-[var(--radius-big)] widget-shadow h-full flex flex-col">
      <h3 className="text-sm font-semibold mb-2 text-foreground">Mood</h3>
      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
        How are you feeling today?
      </div>
    </div>
  );
}
