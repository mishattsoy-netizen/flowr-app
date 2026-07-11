import { Skeleton } from '@/components/ui/Skeleton';

export function SidebarSkeleton({ collapsed, inferredEntityId }: { collapsed?: boolean; inferredEntityId?: string | null }) {
  if (collapsed) {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-4 flex flex-col items-center gap-3 w-full scrollbar-none">
        <div className="flex flex-col items-center gap-4 pt-1">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="w-8 h-8 rounded-[var(--radius-medium)] shrink-0 bg-[var(--bone-5)]" />
          ))}
        </div>
      </div>
    );
  }

  // Home tree items (dashboard/folder/space)
  if (!inferredEntityId || inferredEntityId === 'dashboard') {
    return (
      <div className="flex-1 flex flex-col min-h-0 px-3 pt-3 space-y-7">
        <div className="space-y-4 px-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-2.5 w-20 rounded-sm bg-[var(--bone-5)] uppercase" />
            <Skeleton className="h-3 w-3 rounded-full bg-[var(--bone-5)]" />
          </div>
          <div className="space-y-1">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex items-center gap-3 py-1.5">
                <Skeleton className="w-3.5 h-3.5 rounded-[4px] shrink-0 bg-[var(--bone-5)]" />
                <Skeleton className="h-3 flex-1 max-w-[140px] rounded-md bg-[var(--bone-5)]" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Tracker tags / workspaces filters
  if (inferredEntityId === 'tracker') {
    return (
      <div className="flex-1 flex flex-col min-h-0 px-3 pt-3 space-y-7">
        <div className="space-y-4 px-3">
          <Skeleton className="h-2.5 w-16 rounded-sm bg-[var(--bone-5)] uppercase" />
          <div className="space-y-1">
            {[1, 2].map(i => (
              <div key={i} className="flex items-center gap-3 py-1.5">
                <Skeleton className="h-3 flex-1 max-w-[120px] rounded-md bg-[var(--bone-5)]" />
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-4 px-3">
          <Skeleton className="h-2.5 w-20 rounded-sm bg-[var(--bone-5)] uppercase" />
          <div className="space-y-1 flex flex-wrap gap-2">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-6 w-16 rounded-full bg-[var(--bone-5)]" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Chat history
  if (inferredEntityId === 'chat') {
    return (
      <div className="flex-1 flex flex-col min-h-0 px-3 pt-3 space-y-7">
        <div className="space-y-4 px-3">
          <Skeleton className="h-2.5 w-20 rounded-sm bg-[var(--bone-5)] uppercase" />
          <div className="space-y-1">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="flex flex-col gap-1.5 py-1.5">
                <Skeleton className="h-3.5 w-3/4 rounded-md bg-[var(--bone-5)]" />
                <Skeleton className="h-2 w-1/4 rounded bg-[var(--bone-5)]" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Fallback
  return null;
}
