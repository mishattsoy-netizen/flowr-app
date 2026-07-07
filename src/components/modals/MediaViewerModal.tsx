"use client";

import { useStore } from '@/data/store';
import { X, Copy, Check, Download, FileText } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Tooltip } from '@/components/layout/Tooltip';

export function MediaViewerModal() {
  const { modal, closeModal } = useStore();
  const messageId = (modal as any)?.messageId;
  const storeMessage = useStore(state => messageId ? state.aiMessages.find(m => m.id === messageId) : undefined);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [mouseDownPos, setMouseDownPos] = useState({ x: 0, y: 0 });
  const [showDrawer, setShowDrawer] = useState(false);
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Derive values safely
  const modalData = (modal && modal.kind === 'mediaViewer') ? (modal as any) : null;
  const description = storeMessage?.image_description || modalData?.description;
  const url = modalData?.url;
  const mediaType = modalData?.mediaType;

  // Reset zoom & pan when modal or url changes
  useEffect(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
    setIsDragging(false);
    setDownloaded(false);
  }, [modal, url]);

  useEffect(() => {
    if (modal && modal.kind === 'mediaViewer') {
      setShowDrawer(!!description);
    }
  }, [modal, description]);

  useEffect(() => {
    if (!modal || modal.kind !== 'mediaViewer') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modal, closeModal]);

  // Window listeners for dragging (pan)
  useEffect(() => {
    if (!isDragging) return;

    const handleWindowMouseMove = (e: MouseEvent) => {
      const newX = e.clientX - dragStart.x;
      const newY = e.clientY - dragStart.y;
      setOffset({ x: newX, y: newY });
    };

    const handleWindowMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [isDragging, dragStart]);

  // Wheel listener for scroll zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !modalData || modalData.mediaType !== 'image') return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      
      const zoomFactor = 0.08;
      let newScale = scale;
      if (e.deltaY < 0) {
        newScale = Math.min(scale + zoomFactor, 3.5);
      } else {
        newScale = Math.max(scale - zoomFactor, 1);
      }
      
      if (newScale === 1) {
        setOffset({ x: 0, y: 0 });
      }
      setScale(newScale);
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [scale, modalData]);

  if (!modal || modal.kind !== 'mediaViewer') return null;

  const handleDownload = async () => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      const ext = (blob.type.split('/')[1] || 'png').split(';')[0];
      a.download = `flowr-${mediaType}-${Date.now()}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objUrl);
      setDownloaded(true);
      setTimeout(() => setDownloaded(false), 1500);
    } catch {
      const link = document.createElement('a');
      link.href = url;
      link.download = `flowr-file-${Date.now()}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setDownloaded(true);
      setTimeout(() => setDownloaded(false), 1500);
    }
  };

  const handleOpenOriginal = () => {
    window.open(url, '_blank');
  };

  const handleCopyImage = async () => {
    try {
      const blobPromise = (async () => {
        const img = imgRef.current;
        if (!img) throw new Error('no img');
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('no ctx');
        ctx.drawImage(img, 0, 0);
        return new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/png');
        });
      })();
      const item = new ClipboardItem({ 'image/png': blobPromise });
      await navigator.clipboard.write([item]);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } catch {
        console.error('[MediaViewer] copy failed:', err);
      }
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-overlay backdrop-blur-sm animate-in fade-in duration-300" 
      onClick={closeModal}
    >
      {/* Top Left Branding */}
      <div className="absolute top-6 left-6 flex items-center gap-3 z-[1010]">
        <div className="flex flex-col">
            <h2 className="text-white text-[13px] font-bold tracking-tight truncate max-w-xs sm:max-w-md" title={modalData?.title || 'Attachment Preview'}>
              {modalData?.title || "Attachment Preview"}
            </h2>
            <p className="text-white/40 text-[10px] font-medium uppercase tracking-widest">{mediaType}</p>
        </div>
      </div>

      {/* Top Right Controls */}
      <div className="absolute top-6 right-6 flex items-center gap-2.5 z-[1010]">
        {description && (
          <Tooltip content="Toggle Details" position="bottom" ignoreSuppression>
            <button 
              onClick={(e) => { e.stopPropagation(); setShowDrawer(!showDrawer); }}
              className={cn(
                "group w-11 h-11 rounded-full border flex items-center justify-center transition-all duration-200 shadow-none",
                showDrawer 
                  ? "bg-[var(--bone-100)] border-[var(--bone-100)] text-[var(--app-background)]" 
                  : "border-[var(--bone-10)] bg-[var(--sys-color)] text-[var(--bone-100)] hover:border-[var(--bone-30)] hover:bg-[var(--card-bg)]"
              )}
            >
              <FileText className={cn("w-5 h-5", !showDrawer && "opacity-60 group-hover:opacity-100 transition-opacity")} />
            </button>
          </Tooltip>
        )}
        {mediaType === 'image' && (
          <Tooltip content={copied ? 'Copied!' : 'Copy Image'} position="bottom" ignoreSuppression>
            <button
              onClick={(e) => { e.stopPropagation(); handleCopyImage(); }}
              className={cn(
                "group w-11 h-11 rounded-full border flex items-center justify-center transition-all duration-200 shadow-none",
                copied
                  ? "bg-[#22c55e1a] border-[#22c55e33] text-[#22c55e]"
                  : "border-[var(--bone-10)] bg-[var(--sys-color)] text-[var(--bone-100)] hover:border-[var(--bone-30)] hover:bg-[var(--card-bg)]"
              )}
            >
              {copied ? (
                <Check className="w-5 h-5 text-[#22c55e] animate-in fade-in zoom-in duration-200" />
              ) : (
                <Copy className="w-5 h-5 opacity-60 group-hover:opacity-100 transition-opacity" />
              )}
            </button>
          </Tooltip>
        )}
        <Tooltip content={downloaded ? 'Downloaded!' : 'Download File'} position="bottom" ignoreSuppression>
          <button
            onClick={(e) => { e.stopPropagation(); handleDownload(); }}
            className={cn(
              "group w-11 h-11 rounded-full border flex items-center justify-center transition-all duration-200 shadow-none",
              downloaded
                ? "bg-[#22c55e1a] border-[#22c55e33] text-[#22c55e]"
                : "border-[var(--bone-10)] bg-[var(--sys-color)] text-[var(--bone-100)] hover:border-[var(--bone-30)] hover:bg-[var(--card-bg)]"
            )}
          >
            {downloaded ? (
              <Check className="w-5 h-5 text-[#22c55e] animate-in fade-in zoom-in duration-200" />
            ) : (
              <Download className="w-5 h-5 opacity-60 group-hover:opacity-100 transition-opacity" />
            )}
          </button>
        </Tooltip>
        <Tooltip content="Close Preview" position="bottom" ignoreSuppression>
          <button 
            onClick={closeModal} 
            className="group w-11 h-11 rounded-full border border-[var(--bone-10)] bg-[var(--sys-color)] text-[var(--bone-100)] hover:border-[var(--bone-30)] hover:bg-[var(--card-bg)] flex items-center justify-center transition-all duration-200 shadow-none"
          >
            <X className="w-5 h-5 opacity-60 group-hover:opacity-100 transition-opacity" />
          </button>
        </Tooltip>
      </div>

      {/* Main Content Area */}
      <div 
        ref={containerRef}
        className={cn(
          "relative transition-all duration-500 ease-out flex items-center justify-center",
          showDrawer ? "pr-[400px] w-full h-full" : "w-full h-full"
        )}
        onClick={closeModal}
      >
        <div className="max-w-[90%] max-h-[85%] flex items-center justify-center overflow-visible">
          {mediaType === 'image' ? (
            <img
              ref={imgRef}
              src={url}
              alt="Preview"
              crossOrigin="anonymous"
              className="rounded-xl shadow-2xl select-none object-contain max-h-[80vh] w-auto border border-[var(--bone-12)]"
              style={{
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in',
                transition: isDragging ? 'none' : 'transform 0.15s cubic-bezier(0.16, 1, 0.3, 1)'
              }}
              onClick={(e) => {
                e.stopPropagation();
                
                // If the user dragged, do not toggle zoom
                const dx = Math.abs(e.clientX - mouseDownPos.x);
                const dy = Math.abs(e.clientY - mouseDownPos.y);
                if (dx > 5 || dy > 5) return;

                if (scale > 1) {
                  setScale(1);
                  setOffset({ x: 0, y: 0 });
                } else {
                  setScale(1.3); // Zoom to 1.3 on click (gentle zoom)
                  setOffset({ x: 0, y: 0 });
                }
              }}
              onMouseDown={(e) => {
                setMouseDownPos({ x: e.clientX, y: e.clientY });
                if (scale <= 1) return;
                e.preventDefault();
                e.stopPropagation();
                setIsDragging(true);
                setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
              }}
            />
          ) : (
            <div className="bg-white/5 border border-[var(--bone-12)] p-12 rounded-[2.5rem] flex flex-col items-center gap-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}>
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
            <div className="h-px w-12 bg-[var(--app-dark)]" />
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
