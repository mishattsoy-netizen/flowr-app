import { describe, it, expect } from 'vitest';
import { layoutLabelInShape, pathMidpoint, getBoundText, LABEL_PADDING } from './boundText';
import type { EditorBlock } from '@/data/store.types';

const container: EditorBlock = { id: 'S1', type: 'shape', shapeKind: 'rect', content: '', x: 100, y: 100, width: 200, height: 100, canvasId: 'c1' };

describe('layoutLabelInShape', () => {
  it('centers a short label', () => {
    const l = layoutLabelInShape(container, 20, 'Hi');
    expect(l.width).toBeLessThanOrEqual(200 - 2 * LABEL_PADDING);
    expect(l.x).toBeGreaterThan(100);
    expect(l.y).toBeGreaterThan(100);
    expect(l.containerGrowsTo).toBeUndefined();
  });
  it('grows the container when the text is too tall', () => {
    const long = Array(20).fill('line').join('\n');
    const l = layoutLabelInShape(container, 20, long);
    expect(l.containerGrowsTo).toBeGreaterThan(100);
  });
});

describe('pathMidpoint', () => {
  it('finds the halfway point along the polyline', () => {
    expect(pathMidpoint([[0, 0], [100, 0]])).toEqual([50, 0]);
    expect(pathMidpoint([[0, 0], [100, 0], [100, 100]])).toEqual([100, 0]);
  });
});

describe('getBoundText', () => {
  it('finds the label by containerId', () => {
    const label: EditorBlock = { id: 'T1', type: 'text', content: 'x', containerId: 'S1', canvasId: 'c1', x: 0, y: 0 };
    expect(getBoundText('S1', [container, label])?.id).toBe('T1');
    expect(getBoundText('S1', [container])).toBeUndefined();
  });
});
