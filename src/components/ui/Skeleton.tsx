import { cn } from "@/lib/utils";

/**
 * Skeleton Primitive Component
 * Uses the global .skeleton-shimmer-container utility for the sweep effect.
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "skeleton-shimmer-container rounded-md",
        className
      )}
      {...props}
    />
  );
}
