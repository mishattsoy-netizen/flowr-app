'use client';

import React, { useEffect, useState } from 'react';
import { Leaf, ArrowRight } from 'lucide-react';
import { isDesktop } from '@/lib/env';

export default function UpdateBanner() {
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!isDesktop()) return;

    const updater = (window as any).flowrUpdater;
    if (!updater) return;

    // Listen for updates available and downloaded
    const removeAvailableListener = updater.onUpdateAvailable((info: any) => {
      console.log('Update available:', info);
      if (info && info.version) {
        setUpdateVersion(info.version);
      }
    });

    const removeDownloadedListener = updater.onUpdateDownloaded((info: any) => {
      console.log('Update downloaded:', info);
      if (info && info.version) {
        setUpdateVersion(info.version);
      }
      setIsReady(true);
    });

    // Also trigger initial check in case electron main didn't finish loading
    updater.checkForUpdates().catch((err: any) => {
      console.error('Failed to trigger update check:', err);
    });

    return () => {
      removeAvailableListener();
      removeDownloadedListener();
    };
  }, []);

  const handleRelaunch = async () => {
    if (!isDesktop()) return;
    const updater = (window as any).flowrUpdater;
    if (updater) {
      await updater.installUpdate();
    }
  };

  // If there's no update or it's not ready, don't show the banner
  if (!isReady || !updateVersion) {
    return null;
  }

  return (
    <div className="px-4 py-2 select-none w-full animate-fade-in shrink-0">
      <button
        onClick={handleRelaunch}
        className="w-full flex items-center justify-between p-3.5 rounded-[var(--radius-12)] border border-[var(--bone-10)] bg-[var(--bone-4)] hover:bg-[var(--bone-6)] transition-all text-left duration-200 outline-none group cursor-pointer"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-[var(--radius-8)] bg-[var(--bone-8)] flex items-center justify-center text-[var(--bone-90)] group-hover:scale-105 transition-transform duration-200 shrink-0">
            <Leaf className="w-5 h-5 text-[var(--bone-80)]" strokeWidth={2} />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold text-[var(--bone-100)] tracking-wide leading-tight">
              Relaunch to update
            </span>
            <span className="text-xs text-[var(--bone-50)] tracking-wide mt-0.5 font-medium">
              v{updateVersion}
            </span>
          </div>
        </div>
        <ArrowRight className="w-4 h-4 text-[var(--bone-60)] group-hover:text-[var(--bone-100)] group-hover:translate-x-0.5 transition-all duration-200 shrink-0" strokeWidth={2.5} />
      </button>
    </div>
  );
}
