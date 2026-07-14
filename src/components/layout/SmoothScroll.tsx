"use client";

import { useEffect } from 'react';

export function SmoothScroll() {
  useEffect(() => {
    let targetNode: HTMLElement | null = null;
    let currentY = 0;
    let velocity = 0;
    let rafId: number | null = null;

    const getScrollableParent = (node: HTMLElement | null): HTMLElement | null => {
      if (!node || node === document.body || node === document.documentElement) return null;
      const style = window.getComputedStyle(node);
      const overflowY = style.overflowY;
      const isScrollable = overflowY === 'auto' || overflowY === 'scroll';
      
      if (isScrollable && node.scrollHeight > node.clientHeight) {
        return node;
      }
      return getScrollableParent(node.parentElement);
    };

    const update = () => {
      if (!targetNode) {
        rafId = null;
        return;
      }

      // Apply velocity
      currentY += velocity;
      
      // Apply friction/resistance (0.9 means it glides, lower means more resistance)
      velocity *= 0.95;

      const maxScroll = targetNode.scrollHeight - targetNode.clientHeight;

      // Bounce/clamp at edges
      if (currentY < 0) {
        currentY = 0;
        velocity = 0;
      } else if (currentY > maxScroll) {
        currentY = maxScroll;
        velocity = 0;
      }

      targetNode.scrollTop = currentY;

      // Stop loop if velocity is tiny
      if (Math.abs(velocity) < 0.1) {
        velocity = 0;
        rafId = null;
        return;
      }

      rafId = requestAnimationFrame(update);
    };

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey || e.shiftKey) return; 
      
      const scrollable = getScrollableParent(e.target as HTMLElement);
      if (!scrollable) return;
      
      e.preventDefault();
      
      if (scrollable !== targetNode) {
        targetNode = scrollable;
        currentY = targetNode.scrollTop;
        velocity = 0;
      }

      // We use raw e.deltaY to respect high-precision mice, but clamp it 
      // just in case your OS is sending massive numbers.
      const rawDelta = Math.max(-100, Math.min(100, e.deltaY));
      
      // Extremely low sensitivity multiplier
      velocity += rawDelta * 0.03;

      // Cap the maximum velocity to a slower speed
      velocity = Math.max(-20, Math.min(20, velocity));

      if (!rafId) {
        rafId = requestAnimationFrame(update);
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      window.removeEventListener('wheel', handleWheel);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  return null;
}


