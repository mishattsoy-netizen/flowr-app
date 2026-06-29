'use client';

import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip } from '@/components/layout/Tooltip';
import { isDesktop } from '@/lib/env';

export default function InstallButton({ collapsed }: { collapsed: boolean }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Don't show inside the Electron Desktop app itself
  if (!mounted || isDesktop()) return null;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Determine user OS
    const ua = typeof window !== 'undefined' ? window.navigator.userAgent : '';
    const isMac = /Mac/.test(ua);
    const isLinux = /Linux/.test(ua);
    
    const baseUrl = 'https://github.com/mishattsoy-netizen/flowr-app/releases/latest/download';
    let downloadUrl = `${baseUrl}/Flowr-Setup.exe`; // Default to Windows

    if (isMac) {
      downloadUrl = `${baseUrl}/Flowr.dmg`;
    } else if (isLinux) {
      downloadUrl = `${baseUrl}/Flowr.AppImage`;
    }

    // Trigger direct download without opening a new tab
    const link = document.createElement('a');
    link.href = downloadUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
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
  );
}
