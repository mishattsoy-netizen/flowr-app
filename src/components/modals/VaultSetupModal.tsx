"use client";

import { useEffect, useState } from 'react';
import { FolderOpen } from 'lucide-react';
import { isDesktop } from '@/lib/env';
import { pickVaultFolder, getVaultPath } from '@/lib/fileVault';

export function VaultSetupModal() {
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isDesktop()) return;
    
    // Check if vault path is set
    getVaultPath().then(path => {
      if (!path) {
        setShow(true);
      }
    });
  }, []);

  const handleSelectFolder = async () => {
    setLoading(true);
    try {
      const path = await pickVaultFolder();
      if (path) {
        setShow(false);
      }
    } catch (err) {
      console.error('Failed to pick vault folder:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-md select-none">
      <div className="bg-panel border border-[var(--bone-10)] rounded-[1.5rem] p-8 w-[420px] shadow-2xl flex flex-col items-center text-center animate-fade-in">
        <div className="w-16 h-16 rounded-[var(--radius-16)] bg-[var(--bone-6)] border border-[var(--bone-10)] flex items-center justify-center text-[var(--bone-90)] mb-6">
          <FolderOpen className="w-8 h-8 text-[var(--bone-80)]" strokeWidth={1.5} />
        </div>
        
        <h2 className="text-xl font-bold font-display text-[var(--bone-100)] tracking-tight mb-2">
          Setup Vault Directory
        </h2>
        <p className="text-sm text-[var(--bone-70)] leading-relaxed mb-8 max-w-[320px]">
          Welcome to Flowr! Please select a local folder on your computer to store your workspace files, notes, and local databases.
        </p>

        <button
          onClick={handleSelectFolder}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2.5 py-3 px-6 rounded-full bg-[var(--bone-100)] text-black hover:bg-[var(--bone-90)] active:scale-[0.98] transition-all font-semibold text-sm cursor-pointer disabled:opacity-50"
        >
          {loading ? 'Opening folder picker...' : 'Select Local Directory'}
        </button>
      </div>
    </div>
  );
}
