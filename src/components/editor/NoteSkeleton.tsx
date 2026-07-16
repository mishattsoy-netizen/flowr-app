import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/utils';

export function NoteSkeleton() {
  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-hidden relative">
      <div className="mx-auto py-8 max-w-[850px] w-full px-4">
        {/* Title and metadata container */}
        <div className="flex flex-col items-center gap-4 mb-4">
          <div className="flex flex-col w-full bg-panel border border-border rounded-3xl widget-shadow overflow-hidden">
            <div className="pr-9 py-6" style={{ paddingLeft: '44px' }}>
              <Skeleton className="h-14 w-[60%] rounded-lg bg-[var(--bone-5)]" />
            </div>
            
            <div className="pr-9 py-5 bg-panel flex items-start justify-between" style={{ paddingLeft: '44px' }}>
              <div className="flex items-start gap-x-12 flex-wrap">
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-2 w-16 rounded bg-[var(--bone-5)]" />
                  <div className="h-6 flex items-center">
                    <Skeleton className="h-4 w-24 rounded bg-[var(--bone-5)]" />
                  </div>
                </div>

                <div className="w-px h-8 bg-border/50 shrink-0 self-center" />

                <div className="flex flex-col gap-2 flex-1">
                  <Skeleton className="h-2 w-10 rounded bg-[var(--bone-5)]" />
                  <div className="h-6 flex items-center gap-2">
                    <Skeleton className="h-6 w-16 rounded bg-[var(--bone-5)]" />
                    <Skeleton className="h-6 w-20 rounded bg-[var(--bone-5)]" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content blocks */}
        <div className="pt-8 space-y-6">
          <Skeleton className="h-4 w-full rounded-md bg-[var(--bone-5)]" />
          <Skeleton className="h-4 w-[95%] rounded-md bg-[var(--bone-5)]" />
          <Skeleton className="h-4 w-[90%] rounded-md bg-[var(--bone-5)]" />
          <Skeleton className="h-4 w-[80%] rounded-md bg-[var(--bone-5)]" />
        </div>

        <div className="pt-6 space-y-6">
          <Skeleton className="h-4 w-[85%] rounded-md bg-[var(--bone-5)]" />
          <Skeleton className="h-4 w-full rounded-md bg-[var(--bone-5)]" />
          <Skeleton className="h-4 w-[75%] rounded-md bg-[var(--bone-5)]" />
        </div>
      </div>
    </div>
  );
}
