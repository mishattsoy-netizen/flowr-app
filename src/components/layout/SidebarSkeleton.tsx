import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/utils';
import { Plus, LayoutDashboard, CheckSquare, ListTodo, Inbox, Pen, MessageCircleDashed } from 'lucide-react';

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
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden h-full w-full">
        {/* Fixed Top Buttons */}
        <div className="flex flex-col gap-[1px] px-[10px] pt-1.5 pb-0 shrink-0">
          <div className="flex items-center w-full rounded-[var(--radius-small)] pl-[8px] pr-[3px] h-7">
            <div className="w-[14px] shrink-0 flex items-center justify-center">
              <Plus strokeWidth={2} className="w-3.5 h-3.5 text-[var(--bone-70)]" />
            </div>
            <span className="ml-[6px] flex-1 text-left text-[14px] tracking-wide text-[var(--bone-70)]">New Page</span>
          </div>
          <div className="flex items-center w-full rounded-[var(--radius-small)] pl-[8px] pr-[3px] h-7">
            <div className="w-[14px] shrink-0 flex items-center justify-center">
              <LayoutDashboard strokeWidth={2} className="w-3.5 h-3.5 text-[var(--bone-70)]" />
            </div>
            <span className="ml-[6px] flex-1 text-left text-[14px] tracking-wide text-[var(--bone-70)]">Dashboard</span>
          </div>
          <div className="h-px bg-transparent -mx-[10px] mt-[10px] mb-0" />
        </div>

        {/* Tree Skeletons */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden pt-2">
          <div className="px-[10px] mb-6 shrink-0">
            <div className="pl-2 mb-1.5 flex items-center h-6">
              <Skeleton className="h-2 w-16 rounded-sm bg-[var(--bone-5)]" />
            </div>
            {['w-[140px]', 'w-[100px]', 'w-[120px]', 'w-[80px]', 'w-[150px]'].map((widthClass, i) => (
              <div key={`unsorted-${i}`} className="flex items-center h-7 pl-[8px] pr-[3px] rounded-[var(--radius-small)]">
                <Skeleton className="w-3.5 h-3.5 rounded-[4px] shrink-0 bg-[var(--bone-5)]" />
                <Skeleton className={cn("ml-[6px] h-2.5 rounded-sm bg-[var(--bone-5)]", widthClass)} />
              </div>
            ))}
          </div>

          <div className="px-[10px] mb-6 shrink-0">
            <div className="pl-2 mb-1.5 flex items-center h-6">
              <Skeleton className="h-2 w-20 rounded-sm bg-[var(--bone-5)]" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center h-7 pl-[8px] pr-[3px] rounded-[var(--radius-small)]">
                <Skeleton className="w-3.5 h-3.5 rounded-[4px] shrink-0 bg-[var(--bone-5)]" />
                <Skeleton className="ml-[6px] h-2.5 flex-1 max-w-[130px] rounded-sm bg-[var(--bone-5)]" />
              </div>
              {['w-[110px]', 'w-[90px]', 'w-[120px]'].map((widthClass, i) => (
                <div key={`ws1-child-${i}`} className="flex items-center h-7 pl-[26px] pr-[3px] rounded-[var(--radius-small)]">
                  <Skeleton className="w-3.5 h-3.5 rounded-[4px] shrink-0 bg-[var(--bone-5)]" />
                  <Skeleton className={cn("ml-[6px] h-2.5 rounded-sm bg-[var(--bone-5)]", widthClass)} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Tracker tags / workspaces filters
  if (inferredEntityId === 'tracker') {
    return (
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden h-full w-full">
        {/* Fixed Top Buttons */}
        <div className="flex flex-col gap-[1px] px-[10px] pt-1.5 pb-0 shrink-0">
          <div className="flex items-center w-full rounded-[var(--radius-small)] pl-[8px] pr-[3px] h-7">
            <div className="w-[14px] shrink-0 flex items-center justify-center">
              <CheckSquare strokeWidth={2} className="w-3.5 h-3.5 text-[var(--bone-70)]" />
            </div>
            <span className="ml-[6px] flex-1 text-left text-[14px] tracking-wide text-[var(--bone-70)]">New Task</span>
          </div>
          <div className="flex items-center w-full rounded-[var(--radius-small)] pl-[8px] pr-[3px] h-7">
            <div className="w-[14px] shrink-0 flex items-center justify-center">
              <ListTodo strokeWidth={2} className="w-3.5 h-3.5 text-[var(--bone-70)]" />
            </div>
            <span className="ml-[6px] flex-1 text-left text-[14px] tracking-wide text-[var(--bone-70)]">All tasks</span>
          </div>
          <div className="flex items-center w-full rounded-[var(--radius-small)] pl-[8px] pr-[3px] h-7">
            <div className="w-[14px] shrink-0 flex items-center justify-center">
              <Inbox strokeWidth={2} className="w-3.5 h-3.5 text-[var(--bone-70)]" />
            </div>
            <span className="ml-[6px] flex-1 text-left text-[14px] tracking-wide text-[var(--bone-70)]">Unsorted</span>
          </div>
          <div className="h-px bg-transparent -mx-[10px] mt-[10px] mb-0" />
        </div>

        <div className="flex-1 flex flex-col min-h-0 px-3 pt-3 space-y-7">
          <div className="space-y-4 px-[10px]">
            <Skeleton className="h-2.5 w-16 rounded-sm bg-[var(--bone-5)] uppercase" />
            <div className="space-y-1">
              {[1, 2].map(i => (
                <div key={i} className="flex items-center gap-3 py-1.5">
                  <Skeleton className="h-3 flex-1 max-w-[120px] rounded-md bg-[var(--bone-5)]" />
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-4 px-[10px]">
            <Skeleton className="h-2.5 w-20 rounded-sm bg-[var(--bone-5)] uppercase" />
            <div className="space-y-1 flex flex-wrap gap-2">
              {[1, 2, 3, 4].map(i => (
                <Skeleton key={i} className="h-6 w-16 rounded-full bg-[var(--bone-5)]" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Chat history
  if (inferredEntityId === 'chat') {
    return (
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden h-full w-full">
        {/* Fixed Top Buttons */}
        <div className="flex flex-col gap-[1px] px-[10px] pt-1.5 pb-0 shrink-0">
          <div className="flex items-center w-full rounded-[var(--radius-small)] pl-[8px] pr-[3px] h-7">
            <div className="w-[14px] shrink-0 flex items-center justify-center">
              <Pen strokeWidth={2} className="w-3.5 h-3.5 text-[var(--bone-70)]" />
            </div>
            <span className="ml-[6px] flex-1 text-left text-[14px] tracking-wide text-[var(--bone-70)]">New Chat</span>
          </div>
          <div className="flex items-center w-full rounded-[var(--radius-small)] pl-[8px] pr-[3px] h-7">
            <div className="w-[14px] shrink-0 flex items-center justify-center">
              <MessageCircleDashed strokeWidth={2} className="w-3.5 h-3.5 text-[var(--bone-70)]" />
            </div>
            <span className="ml-[6px] flex-1 text-left text-[14px] tracking-wide text-[var(--bone-70)]">Temp Chat</span>
          </div>
          <div className="h-px bg-transparent -mx-[10px] mt-[10px] mb-0" />
        </div>

        <div className="flex-1 flex flex-col min-h-0 px-[10px] pt-3 space-y-7">
          <div className="space-y-4">
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
      </div>
    );
  }

  // Fallback
  return null;
}
