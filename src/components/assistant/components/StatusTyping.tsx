"use client";

import { useRef, useEffect } from 'react';
import clsx from 'clsx';

export const StatusTyping = ({ text, className, style }: { text: string; className?: string; style?: React.CSSProperties }) => {
  const elRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (elRef.current) {
      elRef.current.style.width = 'auto';
      elRef.current.style.opacity = '1';
    }
  }, [text]);

  return (
    <span className={clsx("flex items-center gap-1", className)} style={style}>
      <span className="inline-block overflow-hidden whitespace-nowrap" ref={elRef}>
        {text}
      </span>
    </span>
  );
};
