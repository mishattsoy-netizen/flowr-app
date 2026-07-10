"use client";

import { memo } from 'react';
import { cn } from '@/lib/utils';

export const AIAvatar = memo(({ className = "w-4 h-4" }: { className?: string; isTyping?: boolean }) => {
  return (
    <img
      src="/Ai star.svg"
      alt="AI"
      className={cn(
        className,
        "shrink-0"
      )}
    />
  );
});
AIAvatar.displayName = 'AIAvatar';
