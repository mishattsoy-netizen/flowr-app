import { describe, it, expect, vi, beforeEach } from 'vitest';

const updateCalls: Array<{ table: string; values: any; ids: string[] }> = [];

vi.mock('./supabase', () => ({
  supabase: {
    from: (table: string) => ({
      update: (values: any) => ({
        in: (_col: string, ids: string[]) => {
          updateCalls.push({ table, values, ids });
          return Promise.resolve({ error: null });
        },
      }),
    }),
  },
  isSupabaseEnabled: true,
}));

import { markForPurge, clearPurge, PURGE_GRACE_MS } from './sync';

beforeEach(() => { updateCalls.length = 0; });

describe('markForPurge', () => {
  it('stamps sync_mode local-only and a future purge_at on entities and tasks', async () => {
    const before = Date.now();
    await markForPurge({ entityIds: ['e1', 'e2'], taskIds: ['t1'] });
    const ent = updateCalls.find(c => c.table === 'entities')!;
    const tsk = updateCalls.find(c => c.table === 'tasks')!;
    expect(ent.ids).toEqual(['e1', 'e2']);
    expect(tsk.ids).toEqual(['t1']);
    for (const c of [ent, tsk]) {
      expect(c.values.sync_mode).toBe('local-only');
      const purgeAt = new Date(c.values.purge_at).getTime();
      expect(purgeAt).toBeGreaterThanOrEqual(before + PURGE_GRACE_MS - 5000);
      expect(purgeAt).toBeLessThanOrEqual(Date.now() + PURGE_GRACE_MS + 5000);
    }
  });

  it('skips empty id lists entirely', async () => {
    await markForPurge({ entityIds: [], taskIds: [] });
    expect(updateCalls).toHaveLength(0);
  });

  it('stamps purge_at on spaceIds when provided, but never sync_mode (spaces has no such column)', async () => {
    await markForPurge({ entityIds: [], taskIds: [], spaceIds: ['ws1'] });
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0].table).toBe('spaces');
    expect(updateCalls[0].ids).toEqual(['ws1']);
    expect(updateCalls[0].values).not.toHaveProperty('sync_mode');
    expect(updateCalls[0].values.purge_at).toBeTruthy();
  });
});

describe('clearPurge', () => {
  it('sets the new mode and nulls purge_at', async () => {
    await clearPurge({ entityIds: ['e1'], taskIds: ['t1'] }, 'full-sync');
    expect(updateCalls).toHaveLength(2);
    for (const c of updateCalls) {
      expect(c.values.sync_mode).toBe('full-sync');
      expect(c.values.purge_at).toBeNull();
    }
  });

  it('supports cloud-only as the target mode', async () => {
    await clearPurge({ entityIds: ['e1'], taskIds: [] }, 'cloud-only');
    expect(updateCalls[0].values.sync_mode).toBe('cloud-only');
  });

  it('nulls purge_at on spaceIds but never writes sync_mode (spaces has no such column)', async () => {
    await clearPurge({ entityIds: [], taskIds: [], spaceIds: ['ws1'] }, 'full-sync');
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0].table).toBe('spaces');
    expect(updateCalls[0].values).not.toHaveProperty('sync_mode');
    expect(updateCalls[0].values.purge_at).toBeNull();
  });
});
