"use client";

import React, { useState, useRef, useEffect, ReactNode, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

interface TooltipProps {
  children: ReactNode;
  content: ReactNode;
  delay?: number;
  className?: string;
  disabled?: boolean;
}

export function Tooltip({ children, content, delay = 2000, className, disabled }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [renderedPos, setRenderedPos] = useState({ x: 0, y: 0 });
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);

  const handleMouseEnter = (e: React.MouseEvent) => {
    if (disabled || !content) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    
    setPos({ x: e.clientX, y: e.clientY });
    timerRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isVisible) {
      setPos({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsVisible(false);
  };

  const handleClick = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsVisible(false);
  };

  useEffect(() => {
    if (disabled && isVisible) {
      setIsVisible(false);
      if (timerRef.current) clearTimeout(timerRef.current);
    }
  }, [disabled, isVisible]);

  useEffect(() => {
    if (isVisible && tooltipRef.current) {
      const rect = tooltipRef.current.getBoundingClientRect();
      const padding = 12;
      let x = pos.x + 12;
      let y = pos.y + 12;

      // Viewport bounds
      if (x + rect.width > window.innerWidth - padding) {
        x = pos.x - rect.width - 12;
      }
      if (y + rect.height > window.innerHeight - padding) {
        y = pos.y - rect.height - 12;
      }

      x = Math.max(padding, x);
      y = Math.max(padding, y);

      setRenderedPos({ x, y });
    }
  }, [isVisible, pos]);

  const tooltipBody = isVisible && mounted && createPortal(
    <div
      ref={tooltipRef}
      className={cn(
        "fixed pointer-events-none z-[9999] px-3 py-2 bg-panel/95 border border-border/50 rounded-2xl text-[11px] font-medium text-foreground backdrop-blur-xl",
        className
      )}
      style={{
        left: renderedPos.x,
        top: renderedPos.y,
      }}
    >
      {content}
    </div>,
    document.body
  );

  return (
    <div 
      className="contents" 
      onMouseEnter={handleMouseEnter} 
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClickCapture={handleClick}
    >
      {children}
      {tooltipBody}
    </div>
  );
}


