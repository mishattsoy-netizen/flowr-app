import { Skeleton } from '@/components/ui/Skeleton';

/**
 * ChatHistorySkeleton
 * Skeleton for the sidebar chat list
 */
export function ChatHistorySkeleton() {
  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      {/* Top Buttons Skeleton */}
      <div className="flex flex-col px-3 pt-3 pb-1 shrink-0 gap-1">
        <Skeleton className="h-7 w-full rounded-[var(--radius-small)] bg-[var(--bone-5)]" />
        <Skeleton className="h-7 w-full rounded-[var(--radius-small)] bg-[var(--bone-5)]" />
      </div>

      {/* List Area Skeleton */}
      <div className="flex-1 min-h-0 px-3 pt-4 pb-4 space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-2 w-12 rounded-sm bg-[var(--bone-5)] mb-4 ml-3" />
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex items-center gap-3 py-1 px-2">
              <Skeleton className="h-4 flex-1 rounded-md bg-[var(--bone-5)]" />
              <Skeleton className="w-4 h-4 rounded-md bg-[var(--bone-5)] shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * ChatMainSkeleton
 * Skeleton for the main chat conversation area
 */
export function ChatMainSkeleton() {
  return (
    <div className="flex-1 flex flex-col h-full bg-background relative min-h-0 min-w-0">
      <div className="flex-1 min-h-0 overflow-hidden px-6 pt-16 pb-60">
        <div className="max-w-3xl mx-auto w-full space-y-10">
          {/* Simulated User Message 1 */}
          <div className="flex flex-col items-end gap-3 w-full">
            <Skeleton className="h-4 w-32 rounded-md bg-[var(--bone-5)]" />
          </div>
          {/* Simulated AI Message 1 */}
          <div className="flex flex-col items-start gap-3 w-full">
             <Skeleton className="h-5 w-48 rounded-md bg-[var(--bone-5)] mb-1" />
             <div className="space-y-2 w-full">
                <Skeleton className="h-4 w-full rounded-md bg-[var(--bone-5)]" />
                <Skeleton className="h-4 w-[95%] rounded-md bg-[var(--bone-5)]" />
                <Skeleton className="h-4 w-[85%] rounded-md bg-[var(--bone-5)]" />
             </div>
          </div>
          {/* Simulated User Message 2 */}
          <div className="flex flex-col items-end gap-2 w-full">
            <Skeleton className="h-4 w-48 rounded-md bg-[var(--bone-5)]" />
            <Skeleton className="h-4 w-32 rounded-md bg-[var(--bone-5)]" />
          </div>
          {/* Simulated AI Message 2 */}
          <div className="flex flex-col items-start gap-3 w-full">
             <div className="space-y-2 w-full">
                <Skeleton className="h-4 w-full rounded-md bg-[var(--bone-5)]" />
                <Skeleton className="h-4 w-[90%] rounded-md bg-[var(--bone-5)]" />
                <Skeleton className="h-4 w-[40%] rounded-md bg-[var(--bone-5)]" />
             </div>
          </div>
          {/* Simulated User Message 3 */}
          <div className="flex flex-col items-end gap-3 w-full">
            <Skeleton className="h-4 w-24 rounded-md bg-[var(--bone-5)]" />
          </div>
          {/* Simulated AI Message 3 */}
          <div className="flex flex-col items-start gap-3 w-full">
             <div className="space-y-2 w-full">
                <Skeleton className="h-4 w-[80%] rounded-md bg-[var(--bone-5)]" />
                <Skeleton className="h-4 w-[60%] rounded-md bg-[var(--bone-5)]" />
             </div>
          </div>
        </div>
      </div>
      
      {/* Input bar skeleton */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-full max-w-4xl px-6">
         <Skeleton className="h-14 w-full rounded-2xl bg-[var(--bone-5)]" />
      </div>
    </div>
  );
}
