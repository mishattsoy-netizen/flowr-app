'use client';

import React, { useEffect, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
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
  if (!updateVersion || !isReady) {
    return null;
  }

  const displayVersion = updateVersion;

  return (
    <button
      onClick={handleRelaunch}
      className="mx-[10px] mb-3 select-none flex items-center justify-between rounded-[10px] bg-[var(--bone-10)] p-[4px] pr-2 cursor-pointer border border-[var(--bone-3)] hover:border-[var(--bone-15)] hover:bg-[var(--bone-15)] hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 outline-none group text-left animate-fade-in shrink-0"
    >
      <div className="flex items-center text-left flex-1 min-w-0 gap-2.5 pl-2 pr-1.5 py-1">
        <div className="!w-7 !h-7 rounded-[7px] bg-gradient-to-br from-[var(--bone-15)] to-[var(--bone-6)] flex items-center justify-center shrink-0 overflow-hidden relative">
          <Download className="w-3.5 h-3.5 text-[var(--bone-80)]" strokeWidth={2} />
        </div>
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-[12px] font-semibold text-[var(--bone-100)] truncate tracking-wide leading-tight">
            Relaunch to update
          </span>
          <span className="text-[10px] text-[var(--bone-30)] truncate tracking-wide leading-tight">
            v{displayVersion}
          </span>
        </div>
      </div>
      <div className="btn-sidebar-utility rounded-[7px] !w-7 !h-7 flex items-center justify-center text-[var(--bone-70)] group-hover:text-[var(--bone-100)] transition-colors shrink-0">
        <RefreshCw className="w-3.5 h-3.5 transition-transform duration-700 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)] group-hover:rotate-[360deg]" strokeWidth={2} />
      </div>
    </button>
  );
}
