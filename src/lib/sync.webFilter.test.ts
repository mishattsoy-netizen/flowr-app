import { describe, it, expect } from 'vitest';
import { filterLocalOnlyForWeb } from './sync';

const mk = (id: string, syncMode: string) => ({ id, syncMode } as any);

describe('filterLocalOnlyForWeb', () => {
  it('drops local-only rows on web', () => {
    const rows = [mk('a', 'cloud-only'), mk('b', 'local-only'), mk('c', 'full-sync')];
    expect(filterLocalOnlyForWeb(rows, false).map(r => r.id)).toEqual(['a', 'c']);
  });

  it('keeps everything on desktop', () => {
    const rows = [mk('a', 'cloud-only'), mk('b', 'local-only')];
    expect(filterLocalOnlyForWeb(rows, true).map(r => r.id)).toEqual(['a', 'b']);
  });

  it('handles an empty list', () => {
    expect(filterLocalOnlyForWeb([], false)).toEqual([]);
  });
});
