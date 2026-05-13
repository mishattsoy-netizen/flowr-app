import { AIAvatar } from './AIAvatar';
import { Skeleton } from '@/components/ui/Skeleton';

/**
 * ChatSkeleton Component
 * Mimics an AI message bubble with staggered shimmer lines.
 */
export function ChatSkeleton() {
  return (
    <div className="flex items-start gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Avatar Placeholder */}
      <div className="shrink-0 pt-1">
        <Skeleton className="w-8 h-8 rounded-full" />
      </div>

      {/* Message Bubble Placeholder */}
      <div className="flex-1 space-y-2.5 max-w-[85%]">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-[95%] rounded-md" />
          <Skeleton className="h-4 w-[80%] rounded-md" />
          <Skeleton className="h-4 w-[40%] rounded-md" />
        </div>
      </div>
    </div>
  );
}
