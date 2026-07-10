import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/env', () => ({ isDesktop: () => false }));
vi.mock('@/lib/sync', () => ({
  markForPurge: vi.fn(),
  clearPurge: vi.fn(),
}));

import { useStore, drainPendingModeWrites } from './store';

describe('pending mode writes queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useStore.setState({ pendingModeWrites: [] });
  });

  it('queuePendingModeWrite appends to the queue', () => {
    useStore.getState().queuePendingModeWrite({ entityIds: ['e1'], taskIds: [], spaceIds: [], action: 'purge', mode: 'local-only' });
    expect(useStore.getState().pendingModeWrites).toHaveLength(1);
  });

  it('is a no-op when the queue is empty', async () => {
    const markForPurge = vi.fn();
    const clearPurge = vi.fn();
    await drainPendingModeWrites({ markForPurge, clearPurge });
    expect(markForPurge).not.toHaveBeenCalled();
    expect(clearPurge).not.toHaveBeenCalled();
  });

  it('retries each write and removes successes', async () => {
    const markForPurge = vi.fn().mockResolvedValue({ error: null });
    const clearPurge = vi.fn().mockResolvedValue({ error: null });
    useStore.setState({ pendingModeWrites: [
      { entityIds: ['e1'], taskIds: [], spaceIds: [], action: 'purge', mode: 'local-only' },
      { entityIds: ['e2'], taskIds: ['t1'], spaceIds: [], action: 'clear', mode: 'full-sync' },
    ]});

    await drainPendingModeWrites({ markForPurge, clearPurge });

    expect(markForPurge).toHaveBeenCalledTimes(1);
    expect(markForPurge).toHaveBeenCalledWith({ entityIds: ['e1'], taskIds: [], spaceIds: [] });
    expect(clearPurge).toHaveBeenCalledWith({ entityIds: ['e2'], taskIds: ['t1'], spaceIds: [] }, 'full-sync');
    expect(useStore.getState().pendingModeWrites).toHaveLength(0);
  });

  it('keeps failed writes queued for the next drain', async () => {
    const markForPurge = vi.fn().mockResolvedValue({ error: { message: 'offline' } });
    const clearPurge = vi.fn().mockResolvedValue({ error: null });
    useStore.setState({ pendingModeWrites: [
      { entityIds: ['e1'], taskIds: [], spaceIds: [], action: 'purge', mode: 'local-only' },
    ]});

    await drainPendingModeWrites({ markForPurge, clearPurge });

    expect(useStore.getState().pendingModeWrites).toHaveLength(1);
  });

  it('partially drains: keeps only the ones that failed', async () => {
    const markForPurge = vi.fn().mockResolvedValue({ error: null });
    const clearPurge = vi.fn().mockResolvedValue({ error: { message: 'offline' } });
    useStore.setState({ pendingModeWrites: [
      { entityIds: ['e1'], taskIds: [], spaceIds: [], action: 'purge', mode: 'local-only' },
      { entityIds: ['e2'], taskIds: [], spaceIds: [], action: 'clear', mode: 'cloud-only' },
    ]});

    await drainPendingModeWrites({ markForPurge, clearPurge });

    const pending = useStore.getState().pendingModeWrites;
    expect(pending).toHaveLength(1);
    expect(pending[0].entityIds).toEqual(['e2']);
  });
});
