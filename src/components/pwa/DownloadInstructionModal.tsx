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
      await navigator.clipboard.writeText('xattr -dr com.apple.quarantine /Applications/Flowr.app && open /Applications/Flowr.app');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = 'xattr -dr com.apple.quarantine /Applications/Flowr.app && open /Applications/Flowr.app';
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

  // ————— macOS content —————
  const macContent = (
    <>
      <div className="flex items-center gap-4 mb-6">
        <div className="p-3 rounded-full bg-[var(--accent)]/10">
          <Apple strokeWidth={2} className="w-5 h-5 text-[var(--accent)]" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-[var(--foreground)]">macOS Instructions</h2>
        </div>
      </div>

      <div className="space-y-5 mb-6">
        <Step number={1} text="Click Download below to get Flowr.dmg" />
        <Step number={2} text="Open the .dmg and drag Flowr to Applications" />
        <Step number={3}>
          <span>Open Terminal, paste and run:</span>
          <div className="mt-3 flex items-center gap-2">
            <code className="flex-1 text-xs bg-[var(--app-dark)] border border-[var(--bone-12)] rounded-lg px-3 py-2.5 font-mono text-[var(--bone-70)] select-all truncate">
              xattr -dr com.apple.quarantine /Applications/Flowr.app {'&&'} open /Applications/Flowr.app
            </code>
            <button
              onClick={handleCopy}
              className={cn(
                "shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200",
                copied
                  ? "bg-[var(--accent)]/15 text-[var(--accent)]"
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
      <div className="flex items-center gap-4 mb-6">
        <div className="p-3 rounded-full bg-danger/10">
          <ShieldAlert strokeWidth={2} className="w-5 h-5 text-danger" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Windows Instructions</h2>
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
      className="fixed inset-0 z-[200] flex items-center justify-center bg-overlay"
      onClick={handleBackdropClick}
    >
      <div
        className={cn(
          "bg-panel border border-[var(--bone-12)] rounded-[1.5rem] p-7 w-[460px] shadow-2xl",
          "transform transition-all duration-300",
          visible ? "scale-100 opacity-100" : "scale-95 opacity-0"
        )}
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          disabled={!minTimeElapsed}
          className={cn(
            "absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-full transition-all duration-300",
            minTimeElapsed
              ? "text-[var(--bone-60)] hover:text-[var(--foreground)] hover:bg-[var(--bone-10)] cursor-pointer"
              : "text-transparent cursor-default"
          )}
        >
          <X strokeWidth={2} className="w-4 h-4" />
        </button>

        {/* OS-specific content */}
        {platform === 'mac' ? macContent : windowsContent}

        {/* Progress bar — fades out when complete so spacing stays */}
        <div className={cn("transition-all duration-500 overflow-hidden", minTimeElapsed ? "opacity-0 max-h-0 mt-0 mb-0" : "opacity-100 max-h-16 mt-6 mb-0")}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-[var(--bone-60)] tracking-wide">Please read above...</span>
            <span className="text-xs font-medium text-[var(--bone-70)] tabular-nums">{Math.floor(elapsed)}s</span>
          </div>
          <div className="h-1.5 bg-[var(--bone-10)] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--bone-30)] transition-all duration-150 ease-linear"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        <div className="h-4" />

        {/* Checkbox */}
        <label
          onClick={handleCheckboxChange}
          className={cn(
            "flex items-center gap-4 p-4 rounded-xl border transition-all duration-300 cursor-pointer mb-5",
            minTimeElapsed
              ? "border-[var(--bone-12)] hover:border-[var(--accent)]/30 hover:bg-[var(--accent)]/5"
              : "border-[var(--bone-6)] opacity-40 cursor-not-allowed"
          )}
        >
          <div
            className={cn(
              "w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all duration-200",
              checked
                ? "bg-[var(--accent)] border-[var(--accent)] text-white"
                : minTimeElapsed
                  ? "border-[var(--bone-30)]"
                  : "border-[var(--bone-12)]"
            )}
          >
            {checked && <Check strokeWidth={3} className="w-3 h-3" />}
          </div>
          <span className={cn(
            "text-sm transition-all leading-relaxed tracking-wide",
            minTimeElapsed ? "text-[var(--foreground)]" : "text-[var(--bone-60)]"
          )}>
            I&apos;ve read the instructions and understand why the warning appears
          </span>
        </label>

        {/* Download button */}
        <button
          onClick={handleDownload}
          disabled={!checked}
          className={cn(
            "w-full flex items-center justify-center gap-3 py-3.5 rounded-xl font-medium text-sm transition-all duration-200",
            checked
              ? "bg-[var(--accent)] text-white hover:opacity-90 shadow-lg shadow-[var(--accent)]/20"
              : "bg-[var(--bone-6)] text-[var(--bone-30)] cursor-not-allowed"
          )}
        >
          <Download strokeWidth={2} className="w-4 h-4" />
          Start Download
        </button>
      </div>
    </div>
  );
}

// ——— Sub-components ———

function Step({ number, text, children }: { number: number; text?: string; children?: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="shrink-0 w-6 h-6 rounded-full bg-[var(--accent)]/15 text-[var(--accent)] flex items-center justify-center text-xs font-semibold mt-0.5">
        {number}
      </div>
      <div className="text-sm text-[var(--foreground)] leading-relaxed tracking-wide">
        {text && <div>{text}</div>}
        {children}
      </div>
    </div>
  );
}

function WhyBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-4 rounded-xl bg-[var(--bone-5)] border border-[var(--bone-10)]">
      <p className="text-xs text-[var(--bone-60)] leading-relaxed tracking-wide">
        <span className="font-medium text-[var(--bone-70)]">Why this happens: </span>
        {children}
      </p>
    </div>
  );
}
