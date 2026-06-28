"use client";

import { useEffect, useState } from 'react';
import { FolderOpen, Check } from 'lucide-react';
import { isDesktop } from '@/lib/env';
import { getVaultPath, setVaultPath } from '@/lib/fileVault';

export function VaultSetupModal() {
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [defaultPath, setDefaultPath] = useState<string>('~/Documents/Flowr');
  const [customPath, setCustomPath] = useState<string | null>(null);

  const displayPath = customPath ?? defaultPath;
  const isCustomSelected = customPath !== null;

  useEffect(() => {
    if (!isDesktop()) return;

    // Load real default path from main process
    if ((window as any).flowrFS?.getDefaultVaultPath) {
      (window as any).flowrFS.getDefaultVaultPath().then((p: string) => {
        if (p) setDefaultPath(p);
      });
    }

    // Check if vault path is already set
    getVaultPath().then(path => {
      if (!path) setShow(true);
    });
  }, []);

  const handleBrowse = async () => {
    setLoading(true);
    try {
      if (typeof window === 'undefined' || !(window as any).flowrFS) return;
      // Only picks the folder — does NOT save it yet
      const path = await (window as any).flowrFS.pickVaultFolder();
      if (path) setCustomPath(path);
    } catch (err) {
      console.error('Failed to pick vault folder:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUseDefault = async () => {
    await setVaultPath(defaultPath);
    setShow(false);
  };

  const handleUseCustom = async () => {
    if (!customPath) return;
    // Path was already picked — just save it now
    await setVaultPath(customPath);
    setShow(false);
  };

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center select-none"
      style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="rounded-[1.5rem] p-8 w-[480px] flex flex-col items-center text-center animate-fade-in"
        style={{
          background: 'var(--sys-color)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
        }}
      >
        {/* Folder icon — large, no container */}
        <FolderOpen
          className="mb-5 mt-1"
          style={{ width: 56, height: 56, color: 'var(--bone-55)', strokeWidth: 1.2 }}
        />

        <h2 className="text-xl font-bold font-display text-[var(--bone-100)] tracking-tight mb-2">
          Set Up Your Vault
        </h2>
        <p className="text-sm leading-relaxed mb-7 max-w-[340px]" style={{ color: 'var(--bone-55)' }}>
          Choose where Flowr stores your workspace files, notes, and local data.
        </p>

        {/* Path display box with inline Change button */}
        <div
          className="w-full flex items-center rounded-xl overflow-hidden mb-5"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)' }}
        >
          <span
            className="flex-1 text-left text-xs px-4 py-[11px] truncate"
            style={{
              color: isCustomSelected ? 'var(--bone-85)' : 'var(--bone-50)',
              fontFamily: 'ui-monospace, monospace',
            }}
            title={displayPath}
          >
            {displayPath}
          </span>
          <button
            onClick={handleBrowse}
            disabled={loading}
            className="px-4 py-[11px] text-xs font-medium shrink-0 transition-colors cursor-pointer hover:text-[var(--bone-90)]"
            style={{
              color: 'var(--bone-60)',
              borderLeft: '1px solid rgba(255,255,255,0.09)',
            }}
          >
            {loading ? '…' : 'Change'}
          </button>
        </div>

        {/* Action buttons */}
        <div className="w-full flex gap-3">
          <button
            onClick={handleUseDefault}
            className="flex-1 py-3 px-4 rounded-full text-sm font-semibold transition-all cursor-pointer active:scale-[0.98] hover:opacity-90"
            style={{ background: 'rgba(255,255,255,0.93)', color: '#000' }}
          >
            Use Default
          </button>
          <button
            onClick={handleUseCustom}
            disabled={!isCustomSelected}
            className="flex-1 py-3 px-4 rounded-full text-sm font-semibold transition-all active:scale-[0.98] disabled:cursor-not-allowed"
            style={{
              background: isCustomSelected ? 'rgba(255,255,255,0.11)' : 'rgba(255,255,255,0.04)',
              color: isCustomSelected ? 'var(--bone-90)' : 'var(--bone-35)',
              border: '1px solid rgba(255,255,255,0.08)',
              cursor: isCustomSelected ? 'pointer' : 'not-allowed',
            }}
          >
            {isCustomSelected ? (
              <span className="flex items-center justify-center gap-1.5">
                <Check style={{ width: 13, height: 13 }} strokeWidth={2.5} />
                Use Custom
              </span>
            ) : 'Use Custom'}
          </button>
        </div>

        {/* Settings hint */}
        <p className="text-xs mt-5" style={{ color: 'var(--bone-38)' }}>
          This can be changed any time in Settings → Storage.
        </p>
      </div>
    </div>
  );
}
