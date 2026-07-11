import { Skeleton } from '@/components/ui/Skeleton';

export function NoteSkeleton() {
  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-hidden relative">
      <div className="max-w-3xl mx-auto w-full pt-16 px-8 sm:px-12 md:px-16 lg:px-20 space-y-10">
        
        {/* Title and metadata */}
        <div className="space-y-4 mb-12">
          <Skeleton className="h-12 w-[60%] rounded-lg bg-[var(--bone-5)]" />
          <div className="flex gap-4 items-center">
            <Skeleton className="h-4 w-24 rounded-md bg-[var(--bone-5)]" />
            <Skeleton className="h-4 w-16 rounded-md bg-[var(--bone-5)]" />
          </div>
        </div>

        {/* Content blocks */}
        <div className="space-y-6">
          <Skeleton className="h-4 w-full rounded-md bg-[var(--bone-5)]" />
          <Skeleton className="h-4 w-[95%] rounded-md bg-[var(--bone-5)]" />
          <Skeleton className="h-4 w-[90%] rounded-md bg-[var(--bone-5)]" />
          <Skeleton className="h-4 w-[80%] rounded-md bg-[var(--bone-5)]" />
        </div>

        <div className="space-y-6 pt-4">
          <Skeleton className="h-4 w-[85%] rounded-md bg-[var(--bone-5)]" />
          <Skeleton className="h-4 w-full rounded-md bg-[var(--bone-5)]" />
          <Skeleton className="h-4 w-[75%] rounded-md bg-[var(--bone-5)]" />
        </div>

        <div className="pt-8 pb-12">
           <Skeleton className="h-48 w-full rounded-xl bg-[var(--bone-5)]" />
        </div>
      </div>
    </div>
  );
}
