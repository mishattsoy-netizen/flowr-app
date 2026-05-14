"use client";

import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

export const StatusTyping = ({ text, className, style }: { text: string; className?: string; style?: React.CSSProperties }) => {
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setDisplayedText('');
    setIsTyping(true);
    
    let currentIdx = 0;
    intervalRef.current = setInterval(() => {
      if (currentIdx < text.length) {
        setDisplayedText(text.substring(0, currentIdx + 1));
        currentIdx++;
      } else {
        setIsTyping(false);
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


