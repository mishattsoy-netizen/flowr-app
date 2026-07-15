// Verifies Scope 2: loadDeltaFromSupabase issues a delta query (changed rows
// only, last_modified > cursor) plus a lightweight all-ids query per table, so
// callers can reconcile deletions (ids absent from the all-ids set) without
// re-fetching full rows.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const selectCalls: Array<{ table: string; cols: string; gt?: [string, number] }> = [];

function makeQuery(table: string, rows: any[]) {
  const q: any = {
    _cols: '*',
    select(cols: string) { this._cols = cols; return this; },
    gt(col: string, val: number) { this._gt = [col, val]; return this; },
    then(resolve: any) {
      selectCalls.push({ table, cols: this._cols, gt: this._gt });
      // return only rows passing the gt filter if present
      const filtered = this._gt
        ? rows.filter(r => (r[this._gt[0]] ?? 0) > this._gt[1])
        : rows.map(r => (this._cols === 'id, last_modified' ? { id: r.id, last_modified: r.last_modified } : r));
      return Promise.resolve({ data: filtered, error: null }).then(resolve);
    },
  };
  return q;
}

vi.mock('@/lib/supabase', () => ({
  isSupabaseEnabled: true,
  supabase: {
    from(table: string) {
      const rowsByTable: Record<string, any[]> = {
        entities: [
          { id: 'e-old', last_modified: 100, title: 'Old', type: 'note' },
          { id: 'e-new', last_modified: 500, title: 'New', type: 'note' },
        ],
        tasks: [],
        spaces: [],
        settings: [],
      };
      return makeQuery(table, rowsByTable[table] ?? []);
    },
  },
}));
vi.mock('@/lib/env', () => ({ isDesktop: () => false, isWeb: () => true }));

import { loadDeltaFromSupabase } from './sync';

describe('loadDeltaFromSupabase', () => {
  beforeEach(() => { selectCalls.length = 0; });

  it('returns only rows changed after the cursor, plus the full id set for deletion reconciliation', async () => {
    const result = await loadDeltaFromSupabase({ entities: 200, tasks: 0, spaces: 0 });

    // delta rows: only e-new (last_modified 500 > 200)
    expect(result!.entities.map(e => e.id)).toEqual(['e-new']);
    // all-ids set includes BOTH e-old and e-new (unchanged + changed)
    expect([...result!.entityIds].sort()).toEqual(['e-new', 'e-old']);
  });

  it('issues a lightweight id-only query and a gt-filtered full query for entities', async () => {
    await loadDeltaFromSupabase({ entities: 200, tasks: 0, spaces: 0 });
    const entityCalls = selectCalls.filter(c => c.table === 'entities');
    expect(entityCalls.some(c => c.cols === 'id, last_modified')).toBe(true);
    expect(entityCalls.some(c => c.gt && c.gt[0] === 'last_modified' && c.gt[1] === 200)).toBe(true);
  });
});
