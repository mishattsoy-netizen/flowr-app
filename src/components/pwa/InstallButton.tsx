'use client';

import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip } from '@/components/layout/Tooltip';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function detectIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  // iPad on iPadOS 13+ reports as Macintosh; check touch points to disambiguate.
  const isIPadOS = ua.includes('Macintosh') && typeof (navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints === 'number' && (navigator as Navigator & { maxTouchPoints: number }).maxTouchPoints > 1;
  return /iPhone|iPad|iPod/.test(ua) || isIPadOS;
}

export default function InstallButton({ collapsed }: { collapsed: boolean }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    setIsIOS(detectIOS());

    if (typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (isIOS || isInstalled || !deferredPrompt) return null;

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const p = deferredPrompt;
    if (!p) return;
    setDeferredPrompt(null);
    try {
      await p.prompt();
      await p.userChoice;
    } catch {
      // user dismissed or prompt unavailable — nothing to do
    }
  };

  return (
    <Tooltip content="Install app">
      <button
        onClick={handleClick}
        aria-label="Install Flowr"
        className={cn(
          collapsed
            ? "w-10 h-10 flex items-center justify-center rounded-[var(--radius-8)] text-[var(--bone-70)] hover:text-[var(--bone-100)] hover:bg-[var(--app-dark)] transition-colors border border-transparent"
            : "btn-sidebar-utility hover:!bg-[var(--app-dark)]"
        )}
      >
        <Download strokeWidth={2} className="w-4 h-4" />
      </button>
    </Tooltip>
  );
}
