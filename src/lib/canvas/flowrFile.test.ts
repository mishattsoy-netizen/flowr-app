import { describe, it, expect } from 'vitest';
import { serializeCanvas, parseFlowrFile } from './flowrFile';
import type { EditorBlock } from '@/data/store.types';

const blocks: EditorBlock[] = [
  { id: 'r1', type: 'shape', shapeKind: 'rect', content: '', canvasId: 'c1', x: 100, y: 100, width: 200, height: 100, zIndex: 0,
    canvasStyleExt: { stroke: '#e9e9e2', fill: '#d38f36', fillOpacity: 1, strokeWidth: 2, strokeStyle: 'solid', roundCorners: true, rotation: 45 } },
  { id: 't1', type: 'text', content: 'Label', canvasId: 'c1', x: 150, y: 130, width: 60, height: 25, zIndex: 1,
    fontSize: 20, textAlign: 'center', containerId: 'r1', canvasStyleExt: { stroke: '#ffffff' } },
  { id: 'a1', type: 'shape', shapeKind: 'arrow', content: '', canvasId: 'c1', x: 0, y: 0, width: 0, height: 0, zIndex: 2,
    points: [[320, 150], [420, 150]], pathMode: 'curved',
    endBinding: { blockId: 'r1', focus: 0.25, gap: 4 },
    endArrowhead: { type: 'filled-triangle', size: 1 } },
  { id: 'f1', type: 'frame', content: 'My Section', canvasId: 'c1', x: 0, y: 300, width: 500, height: 300, zIndex: 3 },
  { id: 'r2', type: 'shape', shapeKind: 'ellipse', content: '', canvasId: 'c1', x: 50, y: 350, width: 80, height: 80, zIndex: 4, parentId: 'f1' },
];

describe('.flowr round trip', () => {
  const json = serializeCanvas({ id: 'c1', title: 'Test Canvas' }, blocks);

  it('produces excalidraw-typed JSON with a flowr key', () => {
    const doc = JSON.parse(json);
    expect(doc.type).toBe('excalidraw');
    expect(doc.source).toBe('flowr');
    expect(doc.flowr.entityId).toBe('c1');
    expect(doc.elements).toHaveLength(5);
  });

  it('maps element types and styles to excalidraw names', () => {
    const doc = JSON.parse(json);
    const rect = doc.elements.find((e: any) => e.id === 'r1');
    expect(rect.type).toBe('rectangle');
    expect(rect.strokeColor).toBe('#e9e9e2');
    expect(rect.backgroundColor).toBe('#d38f36');
    expect(rect.angle).toBeCloseTo(Math.PI / 4, 5);
    expect(rect.roundness).toMatchObject({ type: 3 });
    const text = doc.elements.find((e: any) => e.id === 't1');
    expect(text.containerId).toBe('r1');
    expect(rect.boundElements).toEqual([{ id: 't1', type: 'text' }]);
    const arrow = doc.elements.find((e: any) => e.id === 'a1');
    expect(arrow.endBinding.elementId).toBe('r1');
    expect(arrow.x).toBe(320); // bbox min
    expect(arrow.points[0]).toEqual([0, 0]); // relative
    const ell = doc.elements.find((e: any) => e.id === 'r2');
    expect(ell.frameId).toBe('f1');
    const frame = doc.elements.find((e: any) => e.id === 'f1');
    expect(frame.name).toBe('My Section');
  });

  it('round-trips losslessly', () => {
    const parsed = parseFlowrFile(json);
    expect(parsed.entityId).toBe('c1');
    const byId = Object.fromEntries(parsed.blocks.map(b => [b.id, b]));
    expect(byId['r1'].shapeKind).toBe('rect');
    expect(byId['r1'].canvasStyleExt?.rotation).toBeCloseTo(45, 4);
    expect(byId['r1'].canvasStyleExt?.roundCorners).toBe(true);
    expect(byId['t1'].containerId).toBe('r1');
    expect(byId['t1'].fontSize).toBe(20);
    expect(byId['a1'].points).toEqual([[320, 150], [420, 150]]); // absolute again
    expect(byId['a1'].endBinding).toMatchObject({ blockId: 'r1', focus: 0.25, gap: 4 });
    expect(byId['a1'].pathMode).toBe('curved');
    expect(byId['r2'].parentId).toBe('f1');
    expect(byId['f1'].content).toBe('My Section');
    expect(parsed.blocks.map(b => b.zIndex)).toEqual([0, 1, 2, 3, 4]);
  });

  it('rejects garbage', () => {
    expect(() => parseFlowrFile('not json')).toThrow('invalid-flowr-file');
    expect(() => parseFlowrFile('{"type":"something-else"}')).toThrow('invalid-flowr-file');
  });

  it('preserves unknown element types untouched (forward compat)', () => {
    const doc = JSON.parse(json);
    doc.elements.push({ id: 'x9', type: 'magicwand', x: 1, y: 2, custom: true });
    const reparsed = parseFlowrFile(JSON.stringify(doc));
    const rejson = JSON.parse(serializeCanvas({ id: 'c1', title: 'T' }, reparsed.blocks));
    expect(rejson.elements.find((e: any) => e.id === 'x9')).toMatchObject({ type: 'magicwand', custom: true });
  });
});
