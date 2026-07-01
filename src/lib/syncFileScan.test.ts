import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseVaultFile, findLocalFileForEntity } from './syncFileScan';
import type { Entity } from '@/data/store.types';

describe('parseVaultFile', () => {
  it('parses a markdown file frontmatter id', () => {
    // Format matches serializeFrontmatter: `key: JSON.stringify(value)`
    const content = '---\nid: "abc123"\ntitle: "My Note"\nsyncMode: "full-sync"\nlastModified: 1000\nversion: 1\n---\n\nBody';
    const result = parseVaultFile('My Note.md', content);
    expect(result).toEqual({ id: 'abc123', syncMode: 'full-sync' });
  });

  it('parses a .canvas JSON file', () => {
    const content = JSON.stringify({ entity: { id: 'canvas1', syncMode: 'local-only' }, blocks: [] });
    const result = parseVaultFile('My Canvas.canvas', content);
    expect(result).toEqual({ id: 'canvas1', syncMode: 'local-only' });
  });

  it('returns null for unparseable content', () => {
    expect(parseVaultFile('broken.md', 'not frontmatter at all')).toBeNull();
  });
});

describe('findLocalFileForEntity', () => {
  beforeEach(() => {
    // Provide a mock flowrFS on the global scope for modules that access it
    (globalThis as any).window = {
      flowrFS: {
        readdir: vi.fn().mockResolvedValue(['Test Note.md', 'Other.md']),
        readFile: vi.fn((path: string) => {
          if (path.includes('Test Note.md')) {
            return Promise.resolve('---\nid: "e1"\ntitle: "Test Note"\nsyncMode: "full-sync"\nlastModified: 1000\nversion: 1\n---\n\nBody');
          }
          return Promise.resolve('---\nid: "other"\ntitle: "Other"\nsyncMode: "cloud-only"\nlastModified: 1000\nversion: 1\n---\n\nBody');
        }),
      },
    };
  });

  it('finds the file matching the given entity id', async () => {
    const entity = { id: 'e1', title: 'Test Note', type: 'note' } as Entity;
    const result = await findLocalFileForEntity('/vault', entity);
    expect(result).toBe('/vault/Test Note.md');
  });

  it('returns null when no file matches the entity id', async () => {
    const entity = { id: 'missing', title: 'Nope', type: 'note' } as Entity;
    const result = await findLocalFileForEntity('/vault', entity);
    expect(result).toBeNull();
  });
});
