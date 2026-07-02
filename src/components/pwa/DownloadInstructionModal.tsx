'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Download, X, Check, Copy, ShieldAlert, Apple } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
  onDownload: () => void;
}

type Platform = 'mac' | 'windows' | 'linux';

function detectPlatform(): Platform {
  if (typeof window === 'undefined') return 'windows';
  const ua = navigator.userAgent;
  if (/Mac/.test(ua)) return 'mac';
  if (/Linux/.test(ua)) return 'linux';
  return 'windows';
}

export default function DownloadInstructionModal({ open, onClose, onDownload }: Props) {
  const platform = detectPlatform();
  const [elapsed, setElapsed] = useState(0);
  const [checked, setChecked] = useState(false);
  const [copied, setCopied] = useState(false);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval>>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Reset state on open
  useEffect(() => {
    if (open) {
      setElapsed(0);
      setChecked(false);
      setCopied(false);
      setVisible(true);
    } else {
      setVisible(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [open]);

  // 5-second timer
  useEffect(() => {
    if (!open) return;
    timerRef.current = setInterval(() => {
      setElapsed(prev => {
        if (prev >= 5) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 5;
        }
        return prev + 0.1;
      });
    }, 100);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [open]);

  const minTimeElapsed = elapsed >= 5;
  const progressPct = Math.min((elapsed / 5) * 100, 100);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText('xattr -dr com.apple.quarantine "/Applications/Flowr Beta.app" && open "/Applications/Flowr Beta.app"');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = 'xattr -dr com.apple.quarantine "/Applications/Flowr Beta.app" && open "/Applications/Flowr Beta.app"';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, []);

  const handleClose = useCallback(() => {
    if (minTimeElapsed && visible) {
      if (timerRef.current) clearInterval(timerRef.current);
      setVisible(false);
      // Delay unmount so event fully resolves (prevents sibling elements
      // from receiving the click after the overlay is removed)
      setTimeout(() => onClose(), 50);
    }
  }, [minTimeElapsed, visible, onClose]);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (minTimeElapsed) handleClose();
  }, [minTimeElapsed, handleClose]);

  const handleCheckboxChange = useCallback(() => {
    if (minTimeElapsed) setChecked(c => !c);
  }, [minTimeElapsed]);

  const handleDownload = useCallback(() => {
    if (checked) {
      setVisible(false);
      onDownload();
    }
  }, [checked, onDownload]);

  if (!mounted || !open) return null;

  const osLabel = platform === 'mac' ? 'macOS' : platform === 'windows' ? 'Windows' : 'Linux';

  // ————— macOS content —————
  const macContent = (
    <>
      <div className="grid grid-cols-[36px_1fr] gap-3 items-center mb-6">
        <Apple strokeWidth={1.5} className="w-9 h-9 text-[var(--bone-70)] mt-1 shrink-0 justify-self-center" />
        <div>
          <h2 className="text-3xl font-medium font-serif text-[var(--foreground)]">Instructions</h2>
          <p className="text-xs text-[var(--bone-60)] mt-0.5">{osLabel}</p>
        </div>
      </div>

      <div className="space-y-5 mb-6">
        <Step number={1} text="Click Download below to get Flowr.dmg" />
        <Step number={2} text="Open the .dmg and drag Flowr to Applications" />
        <Step number={3}>
          <span>Open Terminal, paste and run:</span>
          <div className="mt-3 flex items-center gap-2">
            <code className="flex-1 text-[11px] bg-[var(--app-dark)] border border-[var(--bone-12)] rounded-lg px-3 py-2.5 font-mono text-[var(--bone-70)] select-all break-all whitespace-normal">
              xattr -dr com.apple.quarantine "/Applications/Flowr Beta.app" {'&&'} open "/Applications/Flowr Beta.app"
            </code>
            <button
              onClick={handleCopy}
              className={cn(
                "shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200",
                copied
                  ? "bg-[var(--bone-12)] text-[var(--foreground)]"
                  : "bg-[var(--bone-6)] hover:bg-[var(--bone-12)] text-[var(--bone-70)] hover:text-[var(--foreground)]"
              )}
              title="Copy command"
            >
              {copied ? <Check strokeWidth={2} className="w-3.5 h-3.5" /> : <Copy strokeWidth={2} className="w-3.5 h-3.5" />}
            </button>
          </div>
        </Step>
      </div>

      <WhyBox>
        macOS blocks apps that aren&apos;t Apple-signed. The command removes the quarantine flag. Safe — we just skip the $99/yr fee.
      </WhyBox>
    </>
  );

  // ————— Windows content —————
  const windowsContent = (
    <>
      <div className="grid grid-cols-[36px_1fr] gap-3 items-center mb-6">
        <ShieldAlert strokeWidth={1.5} className="w-9 h-9 text-danger mt-1 shrink-0 justify-self-center" />
        <div>
          <h2 className="text-3xl font-medium font-serif text-[var(--foreground)]">Instructions</h2>
          <p className="text-xs text-[var(--bone-60)] mt-0.5">{osLabel}</p>
        </div>
      </div>

      <div className="space-y-5 mb-6">
        <Step number={1} text="Click Download below to get Flowr-Setup.exe" />
        <Step number={2} text="Run the installer" />
        <Step number={3}>
          <span>SmartScreen may warn — click <strong>&ldquo;More info&rdquo;</strong> then <strong>&ldquo;Run anyway&rdquo;</strong>.</span>
        </Step>
      </div>

      <WhyBox>
        Windows SmartScreen flags unsigned apps. This is standard for indie apps — Flowr is safe.
      </WhyBox>
    </>
  );

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-overlay backdrop-blur-sm cursor-default"
      onClick={handleBackdropClick}
    >
      <div
        className={cn(
          "bg-panel border border-[var(--bone-12)] rounded-[1.5rem] p-7 w-[460px] shadow-2xl",
          "scale-100 opacity-100"
        )}
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          disabled={!minTimeElapsed}
          className={cn(
            "absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full transition-all duration-300",
            minTimeElapsed
              ? "text-[var(--foreground)] opacity-60 hover:opacity-100 hover:bg-[var(--app-dark)] cursor-pointer"
              : "opacity-0 cursor-default"
          )}
        >
          <X strokeWidth={2} className="w-4 h-4" />
        </button>

        {/* OS-specific content */}
        {platform === 'mac' ? macContent : windowsContent}

        {/* Progress bar / Checkbox section */}
        <div className="mb-5 mt-4 min-h-[46px]">
          {!minTimeElapsed ? (
            <div className="py-1">
              <div className="max-w-[95%] mx-auto">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-[var(--bone-60)] tracking-wide">Please read above...</span>
                  <span className="text-xs font-medium text-[var(--bone-70)] tabular-nums">{Math.floor(5 - Math.min(elapsed, 5))}s</span>
                </div>
                <div className="h-1.5 bg-[var(--bone-10)] rounded-full">
                  <div
                    className={cn("h-full rounded-full bg-[var(--bone-30)]", elapsed > 0 && "transition-all duration-150 ease-linear")}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="py-1">
              <div
                onClick={handleCheckboxChange}
                className="grid grid-cols-[36px_1fr] gap-3 items-center cursor-pointer"
              >
                <div
                  className={cn(
                    "w-[18px] h-[18px] rounded-[4px] border flex items-center justify-center justify-self-center border-[var(--bone-30)] bg-[var(--bone-6)] hover:border-[var(--bone-70)] hover:bg-[var(--app-dark)] transition-colors duration-200 ease-in-out"
                  )}
                >
                  {checked && <Check strokeWidth={3} className="w-[12px] h-[12px] text-[var(--bone-100)]" />}
                </div>
                <span className="text-sm leading-[1.35] tracking-wide text-[var(--foreground)]">
                  I&apos;ve read the instructions and understand why the warning appears
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Download button */}
        <button
          onClick={handleDownload}
          disabled={!checked}
          className={cn(
            "w-full flex items-center justify-center gap-3 py-3.5 rounded-xl font-medium text-sm transition-all duration-200",
            checked
              ? "bg-[var(--foreground)] text-[var(--app-background)] hover:bg-[var(--app-dark)] hover:text-[var(--foreground)]"
              : "bg-[var(--bone-10)] text-[var(--foreground)] opacity-30 cursor-not-allowed"
          )}
        >
          <Download strokeWidth={2} className="w-4 h-4" />
          Download
        </button>
      </div>
    </div>
  );
}

// ——— Sub-components ———

function Step({ number, text, children }: { number: number; text?: string; children?: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[36px_1fr] gap-3 items-center">
      <div className="w-6 h-6 rounded-full bg-[var(--bone-10)] text-[var(--bone-70)] flex items-center justify-center text-xs font-semibold justify-self-center mt-0.5">
        {number}
      </div>
      <div className="text-sm text-[var(--foreground)] leading-[1.35] tracking-wide mt-[2.5px]">
        {text && <div>{text}</div>}
        {children}
      </div>
    </div>
  );
}

function WhyBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-4 rounded-xl bg-[var(--bone-5)] border border-[var(--bone-10)]">
      <p className="text-xs text-[var(--bone-60)] leading-[1.35] tracking-wide">
        <span className="font-medium text-[var(--bone-70)]">Why this happens: </span>
        {children}
      </p>
    </div>
  );
}
