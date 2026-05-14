"use client";

import { memo } from 'react';
import { StarIcon } from './StarIcon';
import { cn } from '@/lib/utils';

export const AIAvatar = memo(({ className = "w-4 h-4" }: { className?: string; isTyping?: boolean }) => {
  return (
    <StarIcon
      className={cn(
        className,
        "shrink-0 text-[var(--accent)]"
      )}
    />
  );
});
AIAvatar.displayName = 'AIAvatar';
