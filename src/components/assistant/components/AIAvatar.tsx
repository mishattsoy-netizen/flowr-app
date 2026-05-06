"use client";

import { memo } from 'react';
import { useStore } from '@/data/store';
import { StarIcon } from './StarIcon';
import clsx from 'clsx';

export const AIAvatar = memo(({ className = "w-4 h-4", isTyping = false }: { className?: string; isTyping?: boolean }) => {
  const isAILoading = useStore(state => state.isAILoading);
  const shouldPulse = isAILoading || isTyping;
  return (
    <StarIcon
      className={clsx(
        className,
        "shrink-0 transition-opacity duration-300 text-[#eea047]",
        shouldPulse && "animate-thinking-pulse"
      )}
    />
  );
});
AIAvatar.displayName = 'AIAvatar';
