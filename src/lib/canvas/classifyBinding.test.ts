import { describe, it, expect } from 'vitest';
import { classifyBindingAt, findBindableBlockAt } from './classifyBinding';
import type { EditorBlock } from '@/data/store.types';

const rect: EditorBlock = { id: 'S1', type: 'shape', shapeKind: 'rect', content: '', x: 100, y: 100, width: 200, height: 100, canvasId: 'c1' };
const arrow: EditorBlock = { id: 'A1', type: 'shape', shapeKind: 'arrow', content: '', x: 0, y: 0, width: 0, height: 0, points: [[0,0],[10,10]], canvasId: 'c1' };

describe('classifyBindingAt', () => {
  it('inside the shape → fixedPoint binding (mode 2)', () => {
    const b = classifyBindingAt([150, 130], rect)!;
    expect(b.blockId).toBe('S1');
    expect(b.fixedPoint).toEqual([50, 30]);
    expect(b.focus).toBeUndefined();
  });
  it('within 12px of the outline → focus binding at nearest perimeter point (mode 3)', () => {
    const b = classifyBindingAt([250, 92], rect)!; // 8px above top edge at x=250
    expect(b.fixedPoint).toBeUndefined();
    // top edge, x=250 → perimeter dist 150 of 600 → focus 0.25
    expect(b.focus).toBeCloseTo(0.25, 3);
  });
  it('farther than 12px → no binding', () => {
    expect(classifyBindingAt([250, 80], rect)).toBeNull();
  });
});

describe('findBindableBlockAt', () => {
  it('finds shapes but never arrows/lines/freedraw', () => {
    expect(findBindableBlockAt([150, 130], [arrow, rect])?.id).toBe('S1');
    expect(findBindableBlockAt([5, 5], [arrow])).toBeNull();
  });
  it('prefers the topmost (last in array) when overlapping', () => {
    const top: EditorBlock = { ...rect, id: 'S2' };
    expect(findBindableBlockAt([150, 130], [rect, top])?.id).toBe('S2');
  });
});
