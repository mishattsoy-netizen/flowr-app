import { describe, it, expect } from 'vitest';
import { serializeFrontmatter, parseFrontmatter, needsBlockBackup, stripBom, sanitizeObject } from './frontmatter';

describe('Frontmatter Engine', () => {
  it('serializes and parses meta correctly without loss', () => {
    const meta = { id: '123', title: 'Test Note', syncMode: 'cloud-only', lastModified: 1000, version: 1 };
    const md = serializeFrontmatter(meta as any) + "\n\nBody text";
    
    const parsed = parseFrontmatter(md);
    expect(parsed.meta.id).toBe('123');
    expect(parsed.meta.title).toBe('Test Note');
    expect(parsed.body).toBe('Body text');
  });

  it('handles missing frontmatter gracefully', () => {
    const parsed = parseFrontmatter("Just some text");
    expect(parsed.meta.id).toBeUndefined();
    expect(parsed.body).toBe("Just some text");
  });

  it('strips BOM and sanitizes proto', () => {
    const text = '\uFEFFHello';
    expect(stripBom(text)).toBe('Hello');
    
    const obj = JSON.parse('{"__proto__": {"hacked": true}, "a": 1}');
    const clean = sanitizeObject(obj);
    expect((clean as any).__proto__.hacked).toBeUndefined();
  });

  it('identifies if block backup is needed', () => {
    expect(needsBlockBackup([{ id: '1', type: 'text', content: 'test', style: 'body' }])).toBe(false);
    expect(needsBlockBackup([{ id: '1', type: 'columns', content: '' }])).toBe(true);
  });
});
