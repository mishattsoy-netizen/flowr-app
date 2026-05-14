"use client";

import { useStore } from '@/data/store';
import { X, ExternalLink, Download, FileText } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

export function MediaViewerModal() {
  const { modal, closeModal } = useStore();
  const messageId = (modal as any)?.messageId;
  const storeMessage = useStore(state => state.aiMessages.find(m => m.id === messageId));
  const [isZoomed, setIsZoomed] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);

  // Derive values safely
  const modalData = (modal && modal.kind === 'mediaViewer') ? (modal as any) : null;
  const description = storeMessage?.image_description || modalData?.description;

  useEffect(() => {
    if (description) {
      setShowDrawer(true);
    }
  }, [description]);

  if (!modal || modal.kind !== 'mediaViewer') return null;

  const { url, mediaType } = modalData;

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `flowr-file-${Date.now()}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenOriginal = () => {
    window.open(url, '_blank');
  };

  return (
    <div 
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/90 backdrop-blur-xl animate-in fade-in duration-300" 
      onClick={closeModal}
    >
      {/* Top Left Branding */}
      <div className="absolute top-6 left-6 flex items-center gap-3 z-[1010]">
        <div className="flex flex-col">
            <h2 className="text-white text-[13px] font-bold tracking-tight">Attachment Preview</h2>
            <p className="text-white/40 text-[10px] font-medium uppercase tracking-widest">{mediaType}</p>
        </div>
      </div>

      {/* Top Right Controls */}
      <div className="absolute top-6 right-6 flex items-center gap-3 z-[1010]">
        {description && (
          <button 
            onClick={(e) => { e.stopPropagation(); setShowDrawer(!showDrawer); }}
            className={cn(
              "w-10 h-10 rounded-full border flex items-center justify-center transition-all",
              showDrawer 
                ? "bg-bone-100 border-bone-100 text-black" 
                : "bg-white/5 border border-[var(--bone-12)] text-white/60 hover:text-white hover:bg-white/10"
            )}
            title="Toggle Details"
          >
            <FileText className="w-4.5 h-4.5" />
          </button>
        )}
        <button 
          onClick={(e) => { e.stopPropagation(); handleOpenOriginal(); }}
          className="w-10 h-10 rounded-full bg-white/5 border border-[var(--bone-12)] text-white/60 hover:text-white hover:bg-white/10 flex items-center justify-center transition-all"
          title="Open in new tab"
        >
          <ExternalLink className="w-4.5 h-4.5" />
        </button>
        <button 
          onClick={(e) => { e.stopPropagation(); handleDownload(); }}
          className="w-10 h-10 rounded-full bg-white/5 border border-[var(--bone-12)] text-white/60 hover:text-white hover:bg-white/10 flex items-center justify-center transition-all"
          title="Download"
        >
          <Download className="w-4.5 h-4.5" />
        </button>
        <div className="w-px h-6 bg-[var(--bone-6)] mx-1" />
        <button 
          onClick={closeModal} 
          className="w-10 h-10 rounded-full bg-white/5 border border-[var(--bone-12)] text-white/60 hover:text-white hover:bg-white/10 flex items-center justify-center transition-all"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Content Area */}
      <div 
        className={cn(
          "relative transition-all duration-500 ease-out flex items-center justify-center",
          showDrawer ? "pr-[400px] w-full h-full" : "w-full h-full"
        )}
        onClick={e => e.stopPropagation()}
      >
        <div className="max-w-[90%] max-h-[85%] flex items-center justify-center overflow-hidden">
          {mediaType === 'image' ? (
            <img
              src={url}
              alt="Preview"
              className={cn(
                  "rounded-xl shadow-2xl transition-all duration-300 select-none",
                  isZoomed ? "cursor-zoom-out max-w-none scale-150" : "cursor-zoom-in object-contain max-h-[80vh] w-auto border border-[var(--bone-12)]"
              )}
              onClick={() => setIsZoomed(!isZoomed)}
            />
          ) : (
            <div className="bg-white/5 border border-[var(--bone-12)] p-12 rounded-[2.5rem] flex flex-col items-center gap-6 shadow-2xl">
              <div className="w-24 h-24 rounded-3xl bg-accent/10 border border-accent/30 flex items-center justify-center shadow-2xl shadow-accent/10">
                <FileText className="w-12 h-12 text-accent" />
              </div>
              <div className="text-center space-y-2">
                  <p className="text-white font-bold text-lg">Document Attachment</p>
                  <p className="text-white/40 text-xs">This file format requires browser viewing or downloading.</p>
              </div>
              <button 
                  onClick={handleOpenOriginal}
                  className="mt-4 px-8 py-3 bg-accent/20 border border-accent/40 text-white font-bold text-sm rounded-full hover:bg-accent/30 transition-all active:scale-95"
              >
                  Open in Browser
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Side Description Drawer */}
      <div 
        className={cn(
          "fixed top-0 right-0 bottom-0 w-[400px] bg-black/60 backdrop-blur-3xl border-l border-[var(--bone-12)] z-[1005] transition-transform duration-500 ease-out p-8 pt-24 overflow-y-auto custom-scrollbar",
          showDrawer ? "translate-x-0" : "translate-x-full"
        )}
        onClick={e => e.stopPropagation()}
      >
        <div className="space-y-8 animate-in slide-in-from-right duration-500">
          <div className="space-y-2">
            <h3 className="text-white/40 text-[11px] font-bold uppercase tracking-[0.2em]">Image Narrative</h3>
            <div className="h-px w-12 bg-[var(--bone-6)]" />
          </div>
          
          <div className="text-bone-100/90 text-[17px] leading-[135%] tracking-[0.135em] font-medium font-serif italic selection:bg-bone-100/20">
            {description}
          </div>

          <div className="pt-8 flex flex-col gap-6">
            {/* Image Prompt Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <FileText className="w-3 h-3 text-white/30" />
                <h4 className="text-white/30 text-[9px] font-bold uppercase tracking-widest">Image Prompt</h4>
              </div>
              <div className="p-4 rounded-2xl bg-white/5 border border-white/5 text-[13px] text-white/60 leading-relaxed font-mono">
                {(storeMessage as any)?.image_prompt || 'Prompt not available'}
              </div>
            </div>

            {/* Metadata Grid */}
            <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-4">
              <p className="text-[9px] font-bold text-white/30 uppercase tracking-widest">Processing Data</p>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-white/20 text-[8px] uppercase tracking-tighter mb-1">Narration</p>
                  <p className={cn(
                    "text-[11px] font-bold",
                    description ? "text-emerald-400" : "text-amber-400 animate-pulse"
                  )}>
                    {description ? 'SUCCESS' : 'PENDING'}
                  </p>
                </div>
                <div>
                  <p className="text-white/20 text-[8px] uppercase tracking-tighter mb-1">Complexity</p>
                  <p className="text-white/60 text-[11px] font-bold">
                    {description ? `${description.split(' ').length} words` : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-white/20 text-[8px] uppercase tracking-tighter mb-1">Model Chain</p>
                  <p className="text-white/60 text-[11px] font-bold truncate">
                    {storeMessage?.model_chain?.split(' → ').pop()?.split('|')[0] || 'Unknown'}
                  </p>
                </div>
                <div>
                  <p className="text-white/20 text-[8px] uppercase tracking-tighter mb-1">Context</p>
                  <p className="text-white/60 text-[11px] font-bold">
                    {storeMessage?.classification_trace?.[0]?.category || 'Standard'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 text-white/20 text-[10px] font-medium tracking-tight pointer-events-none">
        Click anywhere to close preview
      </div>
    </div>
  );
}
