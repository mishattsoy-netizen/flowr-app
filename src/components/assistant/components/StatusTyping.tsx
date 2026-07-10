"use client";

import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

export const StatusTyping = ({ text, className, style }: { text: string; className?: string; style?: React.CSSProperties }) => {
  const [displayedText, setDisplayedText] = useState(text);
  const [isTyping, setIsTyping] = useState(false);
  // Tracks the text we've already settled on (fully typed or just mounted with).
  // Guarding on text identity rather than a render-count flag means a duplicate
  // effect invocation (e.g. React StrictMode's dev-only double-invoke on mount)
  // sees the same text as last time and stays a no-op, instead of retyping the
  // status message from scratch every time the chat panel remounts.
  const lastSettledText = useRef(text);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (text === lastSettledText.current) {
      setDisplayedText(text);
      setIsTyping(false);
      return;
    }

    setDisplayedText('');
    setIsTyping(true);

    let currentIdx = 0;
    intervalRef.current = setInterval(() => {
      if (currentIdx < text.length) {
        setDisplayedText(text.substring(0, currentIdx + 1));
        currentIdx++;
      } else {
        setIsTyping(false);
        lastSettledText.current = text;
        if (intervalRef.current) clearInterval(intervalRef.current);
      }
    }, 40); // Faster typing for better feel

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [text]);

  return (
    <span className={cn("inline-flex items-center", className)} style={style}>
      <span className="inline-block overflow-hidden whitespace-nowrap">
        {displayedText}
      </span>
    </span>
  );
};


