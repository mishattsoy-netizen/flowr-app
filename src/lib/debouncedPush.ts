export function createDebouncedPush<T extends { id: string }>(
  pushFn: (item: T) => void,
  delayMs: number
): (item: T) => void {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  return (item: T) => {
    const existing = timers.get(item.id);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      timers.delete(item.id);
      pushFn(item);
    }, delayMs);

    timers.set(item.id, timer);
  };
}
