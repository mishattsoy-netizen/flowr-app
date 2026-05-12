"use client";

import { memo, useState, useRef, useEffect } from 'react';
import { ExternalLink, Plus, RefreshCw, Skull } from 'lucide-react';
import { useStore } from '@/data/store';
import { StarIcon } from './StarIcon';
import clsx from 'clsx';

export const ChatImage = memo(({ src, alt, description, messageId, onHeightChange, onAddToWorkspace }: { src: string; alt: string; description?: string; messageId?: string; onHeightChange?: () => void; onAddToWorkspace?: () => void }) => {
  const [error, setError] = useState(false);
  // data: URIs are locally available — no network load needed, skip spinner
  const [loading, setLoading] = useState(!src.startsWith('data:'));
  const [imgSrc, setImgSrc] = useState(src);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setImgSrc(src);
    // Reset loading state: data URIs load instantly, external URLs need spinner
    setLoading(!src.startsWith('data:'));
    setError(false);
  }, [src]);

  useEffect(() => {
    if (imgRef.current?.complete && !imgRef.current.naturalWidth) {
      // complete but naturalWidth=0 means decode error
      setError(true);
      setLoading(false);
    } else if (imgRef.current?.complete) {
      setLoading(false);
      onHeightChange?.();
    }
  }, [imgSrc, onHeightChange]);

  useEffect(() => {
    if (!loading || error) return;
    const timer = setTimeout(() => {
      if (loading) {
        setError(true);
        setLoading(false);
        onHeightChange?.();
      }
    }, 90000);
    return () => clearTimeout(timer);
  }, [loading, error, onHeightChange]);

  const handleRetry = () => {
    setError(false);
    setLoading(true);
    setImgSrc(prev => {
      const sep = prev.includes('?') ? '&' : '?';
      return prev.split('&retry=')[0] + sep + 'retry=' + Date.now();
    });
    onHeightChange?.();
  };

  return (
    <div className="my-4 max-w-[50%] relative group rounded-2xl bg-white/5 overflow-hidden min-h-[100px] flex flex-col justify-center">
      {loading && !error && (
        <div className="flex flex-col items-center justify-center gap-3 py-10 w-full">
          <div className="relative">
            <StarIcon className="w-8 h-8 text-bone-100 animate-pulse" />
            <div className="absolute inset-0 w-8 h-8 rounded-[var(--radius-small)] bg-white/10 blur-xl animate-pulse" />
          </div>
          <div className="text-[11px] text-bone-100 font-bold uppercase tracking-widest">Generating...</div>
        </div>
      )}

      {error && (
        <div className="flex flex-col items-center justify-center gap-4 py-8 text-center bg-[var(--black-overlay)] z-20 w-full">
          <Skull strokeWidth={2} className="w-8 h-8 opacity-70 grayscale contrast-125 text-white/40" />
          <div className="space-y-1.5 px-6">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.25em] text-foreground/80">Generation Timeout</h3>
          </div>
          <button
            onClick={handleRetry}
            className="mt-2 flex items-center gap-2.5 px-5 py-2.5 bg-[var(--bone-6)] hover:bg-[var(--bone-10)] text-muted-foreground hover:text-foreground text-[10px] font-bold uppercase tracking-[0.15em] rounded-full transition-colors group/retry"
          >
            <RefreshCw strokeWidth={2} className="w-3 h-3 group-hover/retry:animate-spin" />
            Retry
          </button>
        </div>
      )}

      {!error && (
        <img
          ref={imgRef}
          src={imgSrc}
          alt={alt}
          style={loading ? { position: 'absolute', width: 0, height: 0, opacity: 0, pointerEvents: 'none' } : undefined}
          className={clsx(
            "max-w-full h-auto cursor-pointer",
            !loading && "block opacity-100 transition-opacity duration-700 hover:opacity-90"
          )}
          onClick={() => {
            if (!loading && !error) {
              useStore.getState().openModal({
                kind: 'mediaViewer',
                url: imgSrc,
                mediaType: 'image',
                description: (description && description !== 'Generated Image') ? description : (alt && alt !== 'Generated Image' ? alt : undefined),
                messageId
              });
            }
          }}
          onLoad={() => { setLoading(false); onHeightChange?.(); }}
          onError={() => { setError(true); setLoading(false); onHeightChange?.(); }}
        />
      )}

      {(!loading || error) && (
        <div className={clsx(
          "absolute top-3 right-3 flex flex-col gap-2 transition-opacity duration-300",
          error ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        )}>
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="w-10 h-10 bg-[var(--bone-6)] backdrop-blur-md rounded-full flex items-center justify-center text-muted-foreground hover:bg-[var(--bone-10)] hover:text-foreground transition-colors"
            title="Open original image"
          >
            <ExternalLink strokeWidth={2} className="w-4 h-4 ml-0.5" />
          </a>
          {onAddToWorkspace && !error && (
            <button
              onClick={(e) => { e.preventDefault(); onAddToWorkspace(); }}
              className="w-10 h-10 bg-accent/90 backdrop-blur-md rounded-[var(--radius-small)] flex items-center justify-center text-white hover:bg-accent"
              title="Add to Workspace"
            >
              <Plus strokeWidth={2} className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
});
ChatImage.displayName = 'ChatImage';
