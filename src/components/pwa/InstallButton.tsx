'use client';

import { useEffect, useState, useCallback } from 'react';
import { Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip } from '@/components/layout/Tooltip';
import { isDesktop } from '@/lib/env';
import DownloadInstructionModal from './DownloadInstructionModal';

export default function InstallButton({ collapsed }: { collapsed: boolean }) {
  const [mounted, setMounted] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Determine user OS
  const ua = typeof window !== 'undefined' ? window.navigator.userAgent : '';
  const isMac = /Mac/.test(ua);
  const isLinux = /Linux/.test(ua);
  const skipModal = isLinux; // only macOS and Windows get the popup

  const baseUrl = 'https://github.com/mishattsoy-netizen/flowr-app/releases/latest/download';
  const getDownloadUrl = () => {
    if (isMac) return `${baseUrl}/Flowr.dmg`;
    if (isLinux) return `${baseUrl}/Flowr.AppImage`;
    return `${baseUrl}/Flowr-Setup.exe`;
  };

  const triggerDownload = useCallback(() => {
    const link = document.createElement('a');
    link.href = getDownloadUrl();
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [isMac, isLinux]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (skipModal) {
      // Linux — download directly, no popup
      triggerDownload();
    } else {
      // macOS / Windows — show instruction modal first
      setShowModal(true);
    }
  }, [skipModal, triggerDownload]);

  // Don't show inside the Electron Desktop app itself
  if (!mounted || isDesktop()) return null;

  return (
    <>
      <Tooltip content="Download Desktop App">
        <button
          onClick={handleClick}
          aria-label="Download Desktop App"
          className={cn(
            collapsed
              ? "w-10 h-10 flex items-center justify-center rounded-[var(--radius-8)] text-[var(--bone-100)] opacity-70 hover:opacity-100 hover:bg-[var(--app-dark)] transition-colors border border-transparent"
              : "btn-sidebar-utility rounded-[7px] w-7 h-7 flex items-center justify-center hover:!bg-[var(--slider-pill)] transition-colors duration-200"
          )}
        >
          <Download strokeWidth={2} className="w-3.5 h-3.5" />
        </button>
      </Tooltip>

      <DownloadInstructionModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onDownload={() => {
          setShowModal(false);
          triggerDownload();
        }}
      />
    </>
  );
}
