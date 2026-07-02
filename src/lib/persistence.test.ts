import { describe, it, expect, vi, beforeEach } from 'vitest';
import { saveEntityToFile } from './persistence';
import type { Entity } from '@/data/store.types';

vi.mock('./env', () => ({ isDesktop: () => true }));
vi.mock('./fileVault', () => ({
  getVaultPath: async () => '/fake/vault',
  sanitizeFileName: (s: string) => s,
  getEntityPath: (entity: any) => `${entity.title}.${entity.type === 'canvas' ? 'flowr' : 'md'}`,
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

  it('writes canvas entities as .flowr Excalidraw-compatible JSON, not raw {entity, blocks} JSON', async () => {
    const entity: Entity = {
      id: 'cv1',
      title: 'My Canvas',
      type: 'canvas',
      parentId: null,
      lastModified: 1000,
      tags: [],
      syncMode: 'full-sync',
    } as unknown as Entity;

    const blocks = [
      { id: 'b1', type: 'text', content: 'hello', canvasId: 'cv1', x: 0, y: 0, width: 10, height: 10, zIndex: 0 },
    ];

    await saveEntityToFile(entity, blocks as any);

    const [path, content] = (global as any).window.flowrFS.writeFile.mock.calls[0];
    expect(path).toBe('/fake/vault/My Canvas.flowr');

    const parsed = JSON.parse(content);
    expect(parsed.type).toBe('excalidraw');
    expect(parsed.flowr).toEqual({ formatVersion: 1, entityId: 'cv1', title: 'My Canvas' });
    expect(Array.isArray(parsed.elements)).toBe(true);
    // Should not be the legacy raw-JSON shape
    expect(parsed.entity).toBeUndefined();
    expect(parsed.blocks).toBeUndefined();
  });
});
