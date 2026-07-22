"use client";

import { useStore } from '@/data/store';
import { X, Brain, Copy, Check, Info, FileText } from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

export function SummaryPreviewModal() {
  const { modal, closeModal } = useStore();
  const [copied, setCopied] = useState(false);

  // Derive modal properties safely
  const modalData = (modal && modal.kind === 'summaryPreview') ? modal : null;
  
  // Close modal on Escape key down
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeModal]);

  if (!modalData) return null;

  const { summary } = modalData;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy summary to clipboard:', err);
    }
  };

  // Calculate quick metrics
  const charCount = summary.length;
  const wordCount = summary.split(/\s+/).filter(Boolean).length;
  const estimatedTokens = Math.round(charCount / 4);

  return (
    <div 
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 backdrop-blur-xl animate-in fade-in duration-300"
      onClick={closeModal}
    >
      <div 
        className="bg-panel border border-[var(--bone-12)] rounded-[24px] p-6 w-full max-w-[500px] shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col gap-5 max-h-[85vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[var(--bone-5)] border border-[var(--bone-12)] flex items-center justify-center text-accent shadow-inner">
              <Brain className="w-5 h-5 text-accent animate-pulse" />
            </div>
            <div className="flex flex-col">
              <h2 className="text-base font-bold text-[var(--bone-100)] tracking-tight">Condensed Memory Summary</h2>
              <p className="text-[11px] text-bone-40 uppercase tracking-widest font-semibold mt-0.5">Distilled Conversation Context</p>
            </div>
          </div>
          <button 
            onClick={closeModal} 
            className="w-8 h-8 rounded-full bg-[var(--bone-5)] border border-[var(--bone-12)] text-bone-70 hover:text-bone-100 hover:bg-[var(--bone-10)] flex items-center justify-center transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Informative Note */}
        <div className="p-3.5 rounded-[12px] bg-[var(--bone-3)] border border-[var(--bone-6)] flex gap-2.5 items-start">
          <Info className="w-4 h-4 text-bone-50 shrink-0 mt-0.5" />
          <p className="text-[11px] leading-relaxed text-bone-70">
            Earlier parts of this session were distilled to optimize token capacity. The AI assistant retains the core context below to maintain deep memory and fast responses.
          </p>
        </div>

        {/* Scrollable Summary Container */}
        <div className="relative group">
          <div className="max-h-[300px] overflow-y-auto overflow-x-hidden rounded-[16px] border border-[var(--bone-12)] bg-[var(--bone-2)] p-4 text-[13.5px] leading-relaxed text-[var(--bone-80)] whitespace-pre-wrap select-text scrollbar-thin">
            {summary || "No distilled summary available yet."}
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-3 gap-3 p-3.5 rounded-[16px] bg-[var(--bone-3)] border border-[var(--bone-6)]">
          <div className="text-center">
            <p className="text-bone-30 text-[9px] uppercase tracking-wider font-semibold">Distilled Words</p>
            <p className="text-bone-100 font-bold text-sm mt-1">{wordCount.toLocaleString()}</p>
          </div>
          <div className="text-center border-x border-[var(--bone-6)]">
            <p className="text-bone-30 text-[9px] uppercase tracking-wider font-semibold">Total Characters</p>
            <p className="text-bone-100 font-bold text-sm mt-1">{charCount.toLocaleString()}</p>
          </div>
          <div className="text-center">
            <p className="text-bone-30 text-[9px] uppercase tracking-wider font-semibold">Token Savings</p>
            <p className="text-accent font-bold text-sm mt-1">~{estimatedTokens.toLocaleString()}</p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-between gap-3 pt-1 border-t border-[var(--bone-6)]">
          <p className="text-[10px] text-bone-30 select-none">Press ESC to dismiss</p>
          <div className="flex gap-2">
            <button
              onClick={closeModal}
              className="px-4 py-2 text-xs font-semibold rounded-full bg-[var(--bone-5)] hover:bg-[var(--bone-10)] text-bone-80 hover:text-bone-100 transition-colors"
            >
              Close Preview
            </button>
            <button
              onClick={handleCopy}
              className="px-4 py-2 text-xs font-semibold rounded-full bg-accent text-[var(--on-accent)] flex items-center gap-2 hover:bg-accent/95 shadow-lg active:scale-95 transition-all"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 animate-in zoom-in-50" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Summary</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
