"use client";

import React, { useState, useRef, useEffect, ReactNode, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { useTooltipOverlay } from './TooltipOverlayContext';

interface TooltipProps {
  children: ReactNode;
  content: ReactNode;
  delay?: number;
  className?: string;
  disabled?: boolean;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export function Tooltip({ children, content, delay = 500, className, disabled, position = 'top' }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [renderedPos, setRenderedPos] = useState({ x: 0, y: 0 });
  const [hasCalculated, setHasCalculated] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  const { isSuppressed } = useTooltipOverlay();

  // Hide immediately when any overlay becomes active
  useEffect(() => {
    if (isSuppressed && isVisible) {
      setIsVisible(false);
      setHasCalculated(false);
      if (timerRef.current) clearTimeout(timerRef.current);
    }
  }, [isSuppressed, isVisible]);

  const handleMouseEnter = () => {
    if (disabled || !content || isSuppressed) return;
    if (timerRef.current) clearTimeout(timerRef.current);

    if (delay > 0) {
      timerRef.current = setTimeout(() => {
        setIsVisible(true);
      }, delay);
    } else {
      setIsVisible(true);
    }
  };

  const handleMouseLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsVisible(false);
    setHasCalculated(false);
  };

  const handleClick = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsVisible(false);
    setHasCalculated(false);
  };

  const handlePointerDown = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsVisible(false);
    setHasCalculated(false);
  };

  useEffect(() => {
    if (disabled && isVisible) {
      setIsVisible(false);
      setHasCalculated(false);
      if (timerRef.current) clearTimeout(timerRef.current);
    }
  }, [disabled, isVisible]);

  useEffect(() => {
    if (!isVisible || !tooltipRef.current || !triggerRef.current) return;

    const updatePosition = () => {
      if (!tooltipRef.current || !triggerRef.current) return;
      const tooltipEl = tooltipRef.current;
      const triggerEl = triggerRef.current;
      
      let rect = triggerEl.getBoundingClientRect();
      if ((rect.width === 0 || rect.height === 0) && triggerEl.firstElementChild) {
        rect = triggerEl.firstElementChild.getBoundingClientRect();
      }
      
      const tooltipRect = tooltipEl.getBoundingClientRect();
      const padding = 8;
      const gap = 6;
      
      let x = 0;
      let y = 0;
      
      const posAttr = position || 'top';
      
      if (posAttr === 'top') {
        x = rect.left + (rect.width - tooltipRect.width) / 2;
        y = rect.top - tooltipRect.height - gap;
      } else if (posAttr === 'bottom') {
        x = rect.left + (rect.width - tooltipRect.width) / 2;
        y = rect.bottom + gap;
      } else if (posAttr === 'left') {
        x = rect.left - tooltipRect.width - gap;
        y = rect.top + (rect.height - tooltipRect.height) / 2;
      } else if (posAttr === 'right') {
        x = rect.right + gap;
        y = rect.top + (rect.height - tooltipRect.height) / 2;
      }
      
      // Auto-fallback boundary check (if offscreen top -> bottom)
      if (posAttr === 'top' && y < padding) {
        y = rect.bottom + gap;
      } else if (posAttr === 'bottom' && y + tooltipRect.height > window.innerHeight - padding) {
        y = rect.top - tooltipRect.height - gap;
      }
      
      // Left/Right bounds constraint
      x = Math.max(padding, Math.min(x, window.innerWidth - tooltipRect.width - padding));
      y = Math.max(padding, Math.min(y, window.innerHeight - tooltipRect.height - padding));
      
      setRenderedPos({ x, y });
      setHasCalculated(true);
    };

    updatePosition();

    window.addEventListener('resize', updatePosition, { passive: true });
    window.addEventListener('scroll', updatePosition, { capture: true, passive: true });

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition);
    };
  }, [isVisible, position]);

  const tooltipBody = isVisible && mounted && createPortal(
    <div
      ref={tooltipRef}
      className={cn(
        "fixed pointer-events-none z-[9999] px-2 py-1 bg-neutral-950 rounded-[var(--radius-small)] text-[11px] font-medium text-neutral-300 shadow-xl",
        !hasCalculated && "invisible",
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

  const isReactElement = React.isValidElement(children);

  if (!isReactElement) {
    return (
      <span
        ref={triggerRef as any}
        className="inline-block"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClickCapture={handleClick}
        onPointerDown={handlePointerDown}
      >
        {children}
        {tooltipBody}
      </span>
    );
  }

  const child = children as React.ReactElement<any>;
  const isReact19 = React.version && React.version.startsWith('19');
  const childRef = isReact19 ? child.props?.ref : (child as any).ref;

  const setRefs = React.useCallback((node: any) => {
    (triggerRef as any).current = node;
    if (typeof childRef === 'function') {
      childRef(node);
    } else if (childRef && typeof childRef === 'object') {
      (childRef as any).current = node;
    }
  }, [childRef]);

  return (
    <>
      {React.cloneElement(child, {
        ref: setRefs,
        onMouseEnter: (e: React.MouseEvent) => {
          child.props.onMouseEnter?.(e);
          handleMouseEnter();
        },
        onMouseLeave: (e: React.MouseEvent) => {
          child.props.onMouseLeave?.(e);
          handleMouseLeave();
        },
        onClick: (e: React.MouseEvent) => {
          child.props.onClick?.(e);
          handleClick();
        },
        onPointerDown: (e: React.PointerEvent) => {
          child.props.onPointerDown?.(e);
          handlePointerDown();
        },
      })}
      {tooltipBody}
    </>
  );
}


