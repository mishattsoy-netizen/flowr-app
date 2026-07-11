import { Skeleton } from '@/components/ui/Skeleton';

const COLUMNS = ['To do', 'Today', 'Overdue', 'Completed'];

export function TrackerSkeleton() {
  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[var(--color-background)] h-full overflow-hidden relative pt-6 pb-6">
      <div className="flex-1 overflow-x-auto min-h-0 pb-0 scrollbar-none">
        <div className="flex gap-3 h-full min-w-max">
          <div className="w-4 shrink-0" />
          {COLUMNS.map((title) => (
            <div
              key={title}
              className="flex flex-col w-[300px] shrink-0 h-full rounded-[var(--radius-big)] p-4 bg-[var(--color-panel)] border border-[var(--bone-3)]"
            >
              <div className="flex items-center justify-between mb-4 px-1">
                <div className="flex items-center gap-2">
                  <Skeleton className="w-2 h-2 rounded-full shrink-0 bg-[var(--bone-5)]" />
                  <Skeleton className="h-4 w-20 rounded-md bg-[var(--bone-5)]" />
                </div>
                <Skeleton className="h-[22px] w-[22px] rounded-[4px] bg-[var(--bone-5)] shrink-0" />
              </div>

              <div className="flex-1 flex flex-col gap-3 overflow-y-hidden pr-1.5 min-h-0">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="rounded-[12px] p-[10px] bg-[var(--app-dark)] border border-[var(--bone-4)]"
                  >
                    <Skeleton className="h-[76px] w-full rounded-[8px] bg-[var(--bone-5)]" />
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="w-4 shrink-0" />
        </div>
      </div>
    </div>
  );
}
