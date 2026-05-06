"use client";

import { useState, useEffect, useRef } from 'react';
import clsx from 'clsx';

export const StatusTyping = ({ text, className, style }: { text: string; className?: string; style?: React.CSSProperties }) => {
  const [displayedText, setDisplayedText] = useState('');
  const [showCursor, setShowCursor] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setDisplayedText('');
    setShowCursor(false);
    
    let currentIdx = 0;
    intervalRef.current = setInterval(() => {
      if (currentIdx < text.length) {
        setDisplayedText(text.substring(0, currentIdx + 1));
        currentIdx++;
      } else {
        setShowCursor(true);
        if (intervalRef.current) clearInterval(intervalRef.current);
      }
    }, 80);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [text]);

  return (
    <span className={clsx("flex items-center gap-1", className)} style={style}>
      <span className="inline-block overflow-hidden whitespace-nowrap">
        {displayedText}
        <span className={clsx("ai-cursor-inline", !showCursor && "opacity-0")} style={{ color: 'inherit' }}>_</span>
      </span>
    </span>
  );
};

