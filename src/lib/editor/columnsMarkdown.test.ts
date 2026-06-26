import { describe, it, expect } from 'vitest';
import { parseColumnFences, serializeColumns } from './columnsMarkdown';

describe('Columns Markdown', () => {
  it('parses column fences correctly', () => {
    const lines = [
      '::: columns',
      '::: column',
      'Left text',
      ':::',
      '::: column',
      'Right text',
      ':::',
      '::::',
      'Outside text'
    ];
    
    const res = parseColumnFences(lines, 0);
    expect(res).not.toBeNull();
    expect(res?.endIndex).toBe(7); // Index of '::::'
    expect(res?.columnContents.length).toBe(2);
    expect(res?.columnContents[0]).toEqual(['Left text']);
    expect(res?.columnContents[1]).toEqual(['Right text']);
  });

  it('rejects nested columns', () => {
    const lines = ['::: columns', '::: column', '::: columns', ':::', '::::'];
    const res = parseColumnFences(lines, 0);
    expect(res).toBeNull();
  });
});
