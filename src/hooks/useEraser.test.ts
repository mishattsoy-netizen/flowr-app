import { describe, it, expect } from 'vitest';
import { hitTestBlock } from './useEraser';
import type { EditorBlock } from '@/data/store.types';

const rect: EditorBlock = { id: 'S1', type: 'shape', shapeKind: 'rect', content: '', x: 100, y: 100, width: 200, height: 100, canvasId: 'c1', canvasStyleExt: { fill: '#fff', fillOpacity: 1 } };
const hollow: EditorBlock = { ...rect, id: 'S2', canvasStyleExt: { fill: 'transparent', fillOpacity: 0 } };
const arrow: EditorBlock = { id: 'A1', type: 'shape', shapeKind: 'arrow', content: '', x: 0, y: 0, width: 0, height: 0, points: [[0, 0], [100, 100]], canvasId: 'c1' };

describe('hitTestBlock', () => {
  it('filled shape: anywhere inside hits', () => {
    expect(hitTestBlock([200, 150], rect, [rect], 8)).toBe(true);
  });
  it('hollow shape: only near the outline hits', () => {
    expect(hitTestBlock([200, 150], hollow, [hollow], 8)).toBe(false);
    expect(hitTestBlock([100, 150], hollow, [hollow], 8)).toBe(true);
  });
  it('arrow: near the polyline hits', () => {
    expect(hitTestBlock([52, 48], arrow, [arrow], 8)).toBe(true);
    expect(hitTestBlock([80, 20], arrow, [arrow], 8)).toBe(false);
  });
});
