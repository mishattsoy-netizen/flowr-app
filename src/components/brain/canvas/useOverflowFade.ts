"use client";

import { useLayoutEffect, useRef, useState, type DependencyList, type RefObject } from 'react';

const DEFAULT_MIN_LINES = 3;

/**
 * Full (unclamped) content height of `el` at its current width, using a
 * temporary clone so `-webkit-line-clamp` does not collapse the measure.
 */
function measureFullHeight(el: HTMLElement): { fullH: number; lineHeight: number } {
  const width = el.clientWidth;
  const cs = getComputedStyle(el);
  const lineHeight = parseFloat(cs.lineHeight) || 18;
  if (width <= 0) return { fullH: 0, lineHeight };

  const clone = document.createElement('div');
  clone.textContent = el.textContent ?? '';
  clone.setAttribute('aria-hidden', 'true');
  clone.style.cssText = [
    'position:absolute',
    'left:-99999px',
    'top:0',
    'visibility:hidden',
    'pointer-events:none',
    'height:auto',
    'max-height:none',
    `width:${width}px`,
    'overflow:visible',
    'display:block',
    '-webkit-line-clamp:unset',
    'line-clamp:unset',
    `font-size:${cs.fontSize}`,
    `font-family:${cs.fontFamily}`,
    `font-weight:${cs.fontWeight}`,
    `font-style:${cs.fontStyle}`,
    `letter-spacing:${cs.letterSpacing}`,
    `line-height:${cs.lineHeight}`,
    `word-break:${cs.wordBreak}`,
    `overflow-wrap:${cs.overflowWrap}`,
    `white-space:${cs.whiteSpace}`,
    'padding:0',
    'margin:0',
    'border:0',
    'box-sizing:border-box',
  ].join(';');

  document.body.appendChild(clone);
  const fullH = clone.scrollHeight;
  document.body.removeChild(clone);

  return { fullH, lineHeight };
}

/**
 * Show the preview bottom fade when content spans at least `minLines` rows
 * (default 3), not only when it overflows the line-clamp box.
 */
export function useOverflowFade(
  deps: DependencyList,
  minLines: number = DEFAULT_MIN_LINES,
): {
  ref: RefObject<HTMLParagraphElement | null>;
  /** True when fade should render (line count >= minLines). */
  overflowing: boolean;
} {
  const ref = useRef<HTMLParagraphElement | null>(null);
  const [overflowing, setOverflowing] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) {
      setOverflowing(false);
      return;
    }
    const check = () => {
      const { fullH, lineHeight } = measureFullHeight(el);
      const lines = fullH / lineHeight;
      // Small epsilon so 3.0 lines from subpixel measure still counts.
      setOverflowing(lines >= minLines - 0.05);
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller controls deps
  }, deps);

  return { ref, overflowing };
}
