"use client";

import React, { useState } from 'react';
import { PATCHES, PatchType } from '@/data/patches';
import { Sparkles, CheckCircle, RefreshCw, PlusCircle, Calendar, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isDesktop } from '@/lib/env';

const typeConfig: Record<PatchType, { label: string; color: string; icon: any }> = {
  added: {
    label: 'Added',
    color: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20 dark:text-emerald-400 dark:bg-emerald-400/10 dark:border-emerald-400/20',
    icon: PlusCircle
  },
  fixed: {
    label: 'Fixed',
    color: 'text-blue-600 bg-blue-500/10 border-blue-500/20 dark:text-blue-400 dark:bg-blue-400/10 dark:border-blue-400/20',
    icon: CheckCircle
  },
  changed: {
    label: 'Changed',
    color: 'text-amber-600 bg-amber-500/10 border-amber-500/20 dark:text-amber-400 dark:bg-amber-400/10 dark:border-amber-400/20',
    icon: RefreshCw
  },
  improved: {
    label: 'Improved',
    color: 'text-purple-600 bg-purple-500/10 border-purple-500/20 dark:text-purple-400 dark:bg-purple-400/10 dark:border-purple-400/20',
    icon: Sparkles
  }
};

import { OverlayScrollbar } from '@/components/tracker/OverlayScrollbar';

export default function UpdatesSection() {
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const handleCheck = async () => {
    if (!isDesktop()) return;
    setChecking(true);
    setStatus('Checking for updates...');
    const updater = (window as any).flowrUpdater;
    if (updater) {
      try {
        await updater.checkForUpdates();
        setStatus('Update check completed.');
        setTimeout(() => setStatus(null), 3000);
      } catch (err: any) {
        setStatus(`Check failed: ${err.message || err}`);
        setTimeout(() => setStatus(null), 5000);
      }
    } else {
      setStatus('Updater not available.');
      setTimeout(() => setStatus(null), 3000);
    }
    setChecking(false);
  };

  return (
    <OverlayScrollbar 
      className="h-full flex-1 min-h-0 w-full animate-fade-in" 
      scrollClassName="space-y-6 px-1 pt-4 pb-8"
    >
      {isDesktop() && (
        <div className="flex items-center justify-between p-4 rounded-2xl bg-[var(--app-dark)] mb-2">
          <div className="text-left">
            <h4 className="text-sm font-semibold text-[var(--bone-100)]">App Updates</h4>
            <p className="text-xs text-[var(--bone-40)] mt-0.5">
              {status || "Check if a new version is available for installation."}
            </p>
          </div>
          <button
            onClick={handleCheck}
            disabled={checking}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-[var(--bone-6)] border border-[var(--bone-10)] text-[var(--bone-90)] hover:bg-[var(--bone-10)] transition-all shrink-0 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", checking && "animate-spin")} />
            Check for Updates
          </button>
        </div>
      )}
      {PATCHES.map((patch) => (
        <div 
          key={patch.version}
          className={cn(
            "p-5 rounded-2xl border transition-all duration-200",
            patch.featured
              ? "border-[var(--brand-blue)]/30 bg-gradient-to-br from-[var(--brand-blue)]/[0.04] to-[var(--brand-blue)]/[0.01] shadow-[0_0_0_1px_rgba(var(--brand-blue-rgb),0.08),0_4px_24px_rgba(var(--brand-blue-rgb),0.08)] hover:border-[var(--brand-blue)]/50"
              : "border-[var(--bone-6)] bg-[var(--color-panel)] hover:border-[var(--bone-15)]"
          )}
        >
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3 flex-wrap">
              <span className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-bold font-mono",
                patch.featured
                  ? "bg-[var(--brand-blue)]/15 border border-[var(--brand-blue)]/30 text-[var(--brand-blue)]"
                  : "bg-accent/10 border border-accent/20 text-accent"
              )}>
                v{patch.version}
              </span>
              <h4 className={cn(
                "font-bold text-[var(--bone-100)] tracking-tight",
                patch.featured ? "text-[17px]" : "text-[15px]"
              )}>
                {patch.title}
              </h4>
              {patch.featured && (
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[var(--brand-blue)]/10 text-[10px] font-bold text-[var(--brand-blue)] uppercase tracking-wider">
                  <Star className="w-2.5 h-2.5 fill-current" />
                  Major
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[var(--bone-40)] font-medium">
              <Calendar className="w-3.5 h-3.5" />
              <span>{patch.date}</span>
              <span className="opacity-45 font-mono">• Build {patch.build}</span>
            </div>
          </div>

          {/* Change Sections */}
          <div className="space-y-4 pt-1">
            {patch.sections.map((section, idx) => {
              const config = typeConfig[section.type] || typeConfig.changed;
              const Icon = config.icon;
              return (
                <div key={idx} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className={cn("flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border", config.color)}>
                      <Icon className="w-3 h-3" />
                      {config.label}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {section.items.map((item, itemIdx) => (
                      <div key={itemIdx} className="relative pl-[26px]">
                        <span className="absolute left-[14px] top-[8px] -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[var(--bone-30)] shrink-0" />
                        <p className="text-[13px] leading-relaxed text-[var(--bone-70)] text-left">
                          {item}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Images comparison section */}
          {patch.images && (
            <div className="mt-6 border-t border-[var(--bone-6)] pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  {patch.images.beforeTitle && (
                    <div className="text-[10px] font-bold text-[var(--bone-40)] uppercase tracking-wider text-left">
                      {patch.images.beforeTitle}
                    </div>
                  )}
                  <div className="rounded-xl border border-[var(--bone-6)] overflow-hidden bg-sidebar/20">
                    <img 
                      src={patch.images.before} 
                      alt={patch.images.beforeTitle || 'Before'} 
                      className="w-full h-auto object-cover select-none pointer-events-none"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  {patch.images.afterTitle && (
                    <div className="text-[10px] font-bold text-accent uppercase tracking-wider text-left">
                      {patch.images.afterTitle}
                    </div>
                  )}
                  <div className="rounded-xl border border-accent/20 overflow-hidden bg-accent/[0.02]">
                    <img 
                      src={patch.images.after} 
                      alt={patch.images.afterTitle || 'After'} 
                      className="w-full h-auto object-cover select-none pointer-events-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </OverlayScrollbar>
  );
}
