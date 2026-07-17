"use client";

import { cn } from '@/lib/utils';
import { Brain, ChevronDown, Check } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';

interface BrainMeta {
  id: string;
  title: string;
  description: string | null;
  is_default: boolean;
}

export function BrainPresetPicker({
  brains,
  selectedBrainId,
  onSelect,
}: {
  brains: BrainMeta[];
  selectedBrainId: string | null;
  onSelect: (brainId: string) => void;
}) {
  const current = brains.find(b => b.id === selectedBrainId);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-2 h-9 px-3 rounded-[12px] text-[13px] font-medium select-none canvas-floating-panel",
            "bg-panel/98 backdrop-blur-xl border border-[var(--bone-12)] shadow-[0_4px_16px_rgba(0,0,0,0.14)]",
            "text-[var(--bone-100)] transition-colors hover:border-[var(--bone-20)]"
          )}
        >
          <Brain className="w-4 h-4 text-[var(--accent)]" strokeWidth={2} />
          <span className="font-display truncate max-w-[140px]">{current?.title ?? 'Select brain'}</span>
          <ChevronDown className="w-3.5 h-3.5 text-[var(--bone-30)]" strokeWidth={2} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-60 p-1.5 bg-panel border border-[var(--bone-12)] shadow-[0_8px_30px_rgba(0,0,0,0.24)] rounded-[14px] z-[300] overflow-hidden"
        align="start"
        sideOffset={6}
      >
        <div className="flex flex-col gap-0.5">
          {brains.map(b => {
            const isSelected = b.id === selectedBrainId;
            return (
              <button
                key={b.id}
                onClick={() => onSelect(b.id)}
                className={cn(
                  "w-full flex items-center gap-2 px-2.5 py-2 rounded-[10px] text-[13px] text-left transition-colors border-none outline-none",
                  isSelected
                    ? "bg-[var(--app-dark)] text-[var(--bone-100)] font-medium"
                    : "text-[var(--bone-70)] hover:bg-[var(--app-dark)] hover:text-[var(--bone-100)]"
                )}
              >
                <Brain className="w-3.5 h-3.5 shrink-0 text-[var(--bone-40)]" strokeWidth={2} />
                <span className="truncate flex-1">{b.title}</span>
                {b.is_default && <span className="text-[10px] text-[var(--bone-30)] uppercase tracking-wide shrink-0">default</span>}
                {isSelected && <Check className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" strokeWidth={2.5} />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
