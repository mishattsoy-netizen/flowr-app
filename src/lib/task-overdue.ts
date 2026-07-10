/**
 * Task overdue utility — single source of truth used by all date displays.
 *
 * A task is overdue when:
 *   - It is not completed
 *   - The effective deadline (endDate if set, otherwise dueDate) has fully passed:
 *     - If the deadline has a time component (contains 'T'): compare as a full Date object
 *     - If the deadline is date-only: compare dates only (the task becomes overdue at midnight of the NEXT day)
 */

/** Return the effective deadline string for a task: endDate preferred over dueDate. */
export function getEffectiveDeadline(
  dueDate?: string | null,
  endDate?: string | null
): string | null {
  // Use endDate when it exists, otherwise fall back to dueDate
  if (endDate && endDate.trim()) return endDate;
  if (dueDate && dueDate.trim()) return dueDate;
  return null;
}

/**
 * Returns true when the deadline has FULLY passed.
 *
 * Rules:
 *  - If deadline includes a time (contains 'T'), compare deadline timestamp vs now.
 *    The task is overdue only after that exact moment.
 *  - If deadline is date-only (e.g. "2026-07-10"), compare the date portion only.
 *    "Jul 10" becomes overdue only after Jul 10 ends — i.e. deadline < today string.
 */
export function isDeadlinePassed(deadline: string): boolean {
  if (deadline.includes('T')) {
    // Full datetime: compare as timestamps
    return new Date(deadline).getTime() < Date.now();
  }
  // Date-only: overdue only when the DATE is strictly before today's date string
  const todayStr = new Date().toISOString().split('T')[0];
  return deadline < todayStr;
}

/**
 * Main helper: returns true if the task is overdue.
 * Uses getEffectiveDeadline → isDeadlinePassed.
 */
export function isTaskOverdue(params: {
  completed: boolean;
  dueDate?: string | null;
  endDate?: string | null;
}): boolean {
  if (params.completed) return false;
  const deadline = getEffectiveDeadline(params.dueDate, params.endDate);
  if (!deadline) return false;
  return isDeadlinePassed(deadline);
}
