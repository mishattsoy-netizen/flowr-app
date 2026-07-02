import { describe, it, expect, vi, beforeEach } from 'vitest';
import { saveEntityToFile } from './persistence';
import type { Entity } from '@/data/store.types';

vi.mock('./env', () => ({ isDesktop: () => true }));
vi.mock('./fileVault', () => ({
  getVaultPath: async () => '/fake/vault',
  sanitizeFileName: (s: string) => s,
  getEntityPath: (entity: any) => `${entity.title}.${entity.type === 'canvas' ? 'canvas' : 'md'}`,
}));

describe('saveEntityToFile', () => {
  beforeEach(() => {
    (global as any).window = {
      flowrFS: {
        writeFile: vi.fn().mockResolvedValue(undefined),
        readdir: vi.fn().mockResolvedValue([]),
        listAllFiles: vi.fn().mockResolvedValue([])
      }
    };
  });

  it('writes the entity\'s actual syncMode into frontmatter, not a hardcoded fallback', async () => {
    const entity: Entity = {
      id: 'e1',
      title: 'Test Note',
      type: 'note',
      parentId: null,
      lastModified: 1000,
      tags: [],
      content: [],
      syncMode: 'cloud-only',
    } as unknown as Entity;

    await saveEntityToFile(entity, []);

    const [, content] = (global as any).window.flowrFS.writeFile.mock.calls[0];
    expect(content).toContain('syncMode: "cloud-only"');
    expect(content).not.toContain('syncMode: "full-sync"');
  });

  it('does not silently substitute a falsy syncMode with a hardcoded "full-sync" fallback', async () => {
    // A falsy syncMode (e.g. '') is the only input that can distinguish
    // `entity.syncMode || 'full-sync'` from plain `entity.syncMode`, since
    // `||` only falls back on falsy values. This guards against the
    // fallback silently mislabeling an entity's real (falsy) syncMode.
    const entity: Entity = {
      id: 'e2',
      title: 'Test Note 2',
      type: 'note',
      parentId: null,
      lastModified: 1000,
      tags: [],
      content: [],
      syncMode: '' as any,
    } as unknown as Entity;

    await saveEntityToFile(entity, []);

    const [, content] = (global as any).window.flowrFS.writeFile.mock.calls[0];
    expect(content).not.toContain('syncMode: "full-sync"');
  });
});
