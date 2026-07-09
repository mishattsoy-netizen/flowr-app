import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createDebouncedPush } from './debouncedPush';

describe('createDebouncedPush', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('collapses rapid calls for the same id into a single push after the delay', () => {
    const pushFn = vi.fn();
    const debouncedPush = createDebouncedPush(pushFn, 1500);

    debouncedPush({ id: 'a', v: 1 });
    debouncedPush({ id: 'a', v: 2 });
    debouncedPush({ id: 'a', v: 3 });

    expect(pushFn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1500);
    expect(pushFn).toHaveBeenCalledTimes(1);
    expect(pushFn).toHaveBeenCalledWith({ id: 'a', v: 3 });
  });

  it('pushes independently for different ids', () => {
    const pushFn = vi.fn();
    const debouncedPush = createDebouncedPush(pushFn, 1500);

    debouncedPush({ id: 'a', v: 1 });
    debouncedPush({ id: 'b', v: 1 });

    vi.advanceTimersByTime(1500);
    expect(pushFn).toHaveBeenCalledTimes(2);
  });
});
