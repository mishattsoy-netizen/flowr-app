// src/lib/legacyImport.test.ts
import { describe, it, expect } from 'vitest';
import { parseLegacyLocalStorageSnapshot } from './legacyImport';

describe('parseLegacyLocalStorageSnapshot', () => {
  it('extracts entities, tasks, and spaces from the flowr-storage blob', () => {
    const raw = JSON.stringify({
      state: {
        entities: [{ id: 'e1', title: 'Old note', type: 'note', lastModified: 100, syncMode: 'local-only' }],
        tasks: [{ id: 't1', title: 'Old task', completed: false, syncMode: 'local-only' }],
        spaces: [{ id: 's1', name: 'Personal', type: 'personal', syncMode: 'local-only' }],
      },
    });
    const result = parseLegacyLocalStorageSnapshot(raw);
    expect(result.entities).toHaveLength(1);
    expect(result.entities[0].id).toBe('e1');
    expect(result.tasks[0].id).toBe('t1');
    expect(result.spaces[0].id).toBe('s1');
  });

  it('defaults lastModified to the provided import time when absent (legacy tasks/spaces)', () => {
    const raw = JSON.stringify({ state: { entities: [], tasks: [{ id: 't1', title: 'X', completed: false, syncMode: 'local-only' }], spaces: [] } });
    const result = parseLegacyLocalStorageSnapshot(raw, 999);
    expect(result.tasks[0].lastModified).toBe(999);
  });

  it('returns empty arrays for invalid JSON', () => {
    const result = parseLegacyLocalStorageSnapshot('not json');
    expect(result).toEqual({ entities: [], tasks: [], spaces: [] });
  });
});
