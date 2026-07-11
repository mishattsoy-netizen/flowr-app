import { Skeleton } from "@/components/ui/Skeleton";

export function DashboardSkeleton() {
  return (
    <div className="flex-1 overflow-y-auto px-8 py-8 flex flex-col h-full bg-background select-none items-center">
      <div className="w-full max-w-[1200px] mx-auto flex flex-col gap-4 flex-1 min-h-0">
        
        {/* Header Skeleton */}
        <header className="flex items-center justify-between py-2 select-none h-16 shrink-0">
          <div className="flex-1 min-w-0">
            <div className="space-y-2 mb-1">
              <Skeleton className="h-8 w-64 rounded-md bg-[var(--bone-5)]" />
              <Skeleton className="h-4 w-40 rounded-md bg-[var(--bone-5)]" />
            </div>
          </div>
          <div className="flex-1 max-w-[280px] mx-4 relative">
            <Skeleton className="w-full h-9 rounded-full bg-[var(--bone-5)]" />
          </div>
          <div className="relative">
            <Skeleton className="w-9 h-9 rounded-full bg-[var(--bone-5)]" />
          </div>
        </header>

        {/* Top section (Recents) Skeleton */}
        <section
          className="relative rounded-[var(--radius-big)] overflow-hidden px-5 pb-5 pt-4 flex flex-col min-h-[180px] max-h-[365px] basis-0"
          style={{ flexGrow: 261 }}
        >
          <Skeleton className="absolute inset-0 w-full h-full bg-[var(--bone-5)]" />
        </section>

        {/* Bottom widgets grid Skeleton */}
        <div
          className="grid grid-cols-1 md:grid-cols-3 gap-4 min-h-[320px] max-h-[680px] basis-0 select-none"
          style={{ flexGrow: 485 }}
        >
          {/* Tasks (2/3 width) */}
          <div className="md:col-span-2 flex flex-col relative rounded-[var(--radius-big)] overflow-hidden">
            <div className="flex-1 min-h-0">
              <Skeleton className="h-full w-full bg-[var(--bone-5)]" />
            </div>
          </div>
          
          {/* Shortcuts (1/3 width) */}
          <div className="flex flex-col relative rounded-[var(--radius-big)] overflow-hidden">
            <div className="flex-1 min-h-0">
              <Skeleton className="h-full w-full bg-[var(--bone-5)]" />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
