import type { EditorBlock, ShapeKind, ArrowBinding, ArrowheadStyle } from '@/data/store.types';

/** A block we don't understand (came from a foreign/future Excalidraw element type). Preserved verbatim. */
interface RawBlock extends EditorBlock {
  __raw?: unknown;
}

/**
 * `EditorBlock` keys that this module maps explicitly onto native Excalidraw fields
 * (or that are structural/derived and shouldn't be echoed back as "extra" data).
 * Everything else on a block is captured generically into customData.flowr.rest
 * so newly-added store fields can never silently vanish on round-trip.
 */
const HANDLED_BLOCK_KEYS = new Set<string>([
  'id', 'type', 'content', 'canvasId', 'x', 'y', 'width', 'height', 'zIndex',
  'shapeKind', 'points', 'groupId', 'parentId', 'canvasStyleExt',
  'startBinding', 'endBinding', 'startArrowhead', 'endArrowhead', 'curved',
  'fontSize', 'textAlign', 'containerId', 'mediaUrl',
]);

/** `CanvasStyleExt` keys mapped explicitly onto native Excalidraw style fields. */
const HANDLED_STYLE_KEYS = new Set<string>([
  'stroke', 'fill', 'fillOpacity', 'strokeWidth', 'strokeStyle', 'opacity',
  'rotation', 'locked', 'cornerRadius', 'startArrowhead', 'endArrowhead',
  'startBinding', 'endBinding',
]);

function pickRest<T extends Record<string, unknown>>(obj: T | undefined, handled: Set<string>): Record<string, unknown> | undefined {
  if (!obj) return undefined;
  const rest: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (!handled.has(k) && v !== undefined) rest[k] = v;
  }
  return Object.keys(rest).length > 0 ? rest : undefined;
}

const SHAPE_TO_EXCALIDRAW: Record<ShapeKind, string> = {
  rect: 'rectangle', ellipse: 'ellipse', diamond: 'diamond',
  line: 'line', arrow: 'arrow', freedraw: 'freedraw',
};
const EXCALIDRAW_TO_SHAPE: Record<string, ShapeKind> = Object.fromEntries(
  Object.entries(SHAPE_TO_EXCALIDRAW).map(([k, v]) => [v, k as ShapeKind]),
);
const LINEAR: ShapeKind[] = ['line', 'arrow', 'freedraw'];

const mapBindingOut = (b?: ArrowBinding) =>
  b ? { elementId: b.blockId, focus: b.focus ?? null, gap: b.gap ?? null, fixedPoint: b.fixedPoint ?? null } : null;

const mapBindingIn = (b: any): ArrowBinding | undefined =>
  b?.elementId
    ? {
        blockId: b.elementId,
        ...(b.focus != null ? { focus: b.focus } : {}),
        ...(b.gap != null ? { gap: b.gap } : {}),
        ...(b.fixedPoint != null ? { fixedPoint: b.fixedPoint as [number, number] } : {}),
      }
    : undefined;

function blockToElement(b: EditorBlock, all: EditorBlock[]): Record<string, unknown> {
  const raw = (b as RawBlock).__raw;
  if (raw) {
    return { ...(raw as Record<string, unknown>), id: b.id };
  }

  const s = b.canvasStyleExt ?? {};
  const boundText = all.find(t => t.type === 'text' && t.containerId === b.id);

  // Style fields with no native Excalidraw equivalent (strokeOpacity, flipH/V, pivot, etc.)
  // and any block-level fields outside the mapping table (isFolded, linkUrl, mediaWidth, ...)
  // are captured generically so they survive round-trip even as the store schema grows.
  const styleRest = pickRest(s as Record<string, unknown>, HANDLED_STYLE_KEYS);
  const blockRest = pickRest(b as unknown as Record<string, unknown>, HANDLED_BLOCK_KEYS);
  const hasExt = !!styleRest || !!blockRest;

  const base: Record<string, unknown> = {
    id: b.id,
    x: b.x ?? 0, y: b.y ?? 0,
    width: b.width ?? 0, height: b.height ?? 0,
    angle: ((s.rotation ?? 0) * Math.PI) / 180,
    strokeColor: s.stroke ?? '#e9e9e2',
    backgroundColor: s.fill && (s.fillOpacity ?? 1) > 0 ? s.fill : 'transparent',
    fillStyle: 'solid',
    strokeWidth: s.strokeWidth ?? 1,
    strokeStyle: s.strokeStyle ?? 'solid',
    roughness: 0,
    opacity: Math.round((s.opacity ?? 1) * 100),
    groupIds: b.groupId ? [b.groupId] : [],
    frameId: b.parentId ?? null,
    locked: s.locked ?? false,
    isDeleted: false,
    boundElements: boundText ? [{ id: boundText.id, type: 'text' }] : null,
  };

  let customDataFlowr: Record<string, unknown> | undefined = hasExt
    ? { ...(styleRest ? { styleRest } : {}), ...(blockRest ? { blockRest } : {}) }
    : undefined;

  if (b.type === 'shape' && b.shapeKind) {
    base.type = SHAPE_TO_EXCALIDRAW[b.shapeKind];
    if (LINEAR.includes(b.shapeKind)) {
      const pts = b.points ?? [];
      const minX = Math.min(...pts.map(p => p[0]), Infinity);
      const minY = Math.min(...pts.map(p => p[1]), Infinity);
      const ox = Number.isFinite(minX) ? minX : 0;
      const oy = Number.isFinite(minY) ? minY : 0;
      base.x = ox; base.y = oy;
      base.points = pts.map(p => [p[0] - ox, p[1] - oy]);
      base.startBinding = mapBindingOut(b.startBinding);
      base.endBinding = mapBindingOut(b.endBinding);
      base.startArrowhead = b.startArrowhead?.type && b.startArrowhead.type !== 'none' ? 'triangle' : null;
      base.endArrowhead = b.endArrowhead?.type && b.endArrowhead.type !== 'none' ? 'triangle' : null;
      base.roundness = b.curved ? { type: 2 } : null;
      customDataFlowr = {
        ...(customDataFlowr ?? {}),
        startArrowhead: b.startArrowhead ?? null,
        endArrowhead: b.endArrowhead ?? null,
      };
    } else {
      base.roundness = s.cornerRadius ? { type: 3, value: s.cornerRadius } : null;
    }
  } else if (b.type === 'text') {
    base.type = 'text';
    base.text = b.content ?? '';
    base.fontSize = b.fontSize ?? 20;
    base.fontFamily = 1;
    base.textAlign = b.textAlign ?? 'left';
    base.verticalAlign = b.containerId ? 'middle' : 'top';
    base.containerId = b.containerId ?? null;
  } else if (b.type === 'image' || b.type === 'video') {
    base.type = 'image';
    base.fileId = b.id;
    base.status = 'saved';
    customDataFlowr = { ...(customDataFlowr ?? {}), kind: b.type, src: b.mediaUrl ?? null };
  } else if (b.type === 'frame') {
    base.type = 'frame';
    base.name = b.content || 'Section';
    base.frameId = null;
  } else {
    // Any other store block type: keep the Excalidraw envelope generic and
    // stash the whole block so we never lose data even without a __raw source.
    base.type = b.type;
    customDataFlowr = { ...(customDataFlowr ?? {}), storeBlock: b };
  }

  if (customDataFlowr) {
    base.customData = { flowr: customDataFlowr };
  }

  return base;
}

function elementToBlock(el: any, index: number, canvasId: string): EditorBlock {
  const styleRest = el.customData?.flowr?.styleRest;
  const blockRest = el.customData?.flowr?.blockRest;
  const style: Record<string, unknown> = {
    stroke: el.strokeColor,
    fill: el.backgroundColor === 'transparent' ? undefined : el.backgroundColor,
    fillOpacity: el.backgroundColor === 'transparent' ? 0 : 1,
    strokeWidth: el.strokeWidth,
    strokeStyle: el.strokeStyle,
    opacity: (el.opacity ?? 100) / 100,
    rotation: ((el.angle ?? 0) * 180) / Math.PI,
    locked: el.locked ?? false,
    ...(el.roundness?.value ? { cornerRadius: el.roundness.value } : {}),
    ...(styleRest ?? {}),
  };

  const common: EditorBlock = {
    id: el.id, type: 'shape', content: '', canvasId,
    x: el.x ?? 0, y: el.y ?? 0, width: el.width ?? 0, height: el.height ?? 0,
    zIndex: index,
    canvasStyleExt: style,
    ...(el.groupIds?.[0] ? { groupId: el.groupIds[0] } : {}),
    ...(el.frameId ? { parentId: el.frameId } : {}),
    ...(blockRest ?? {}),
  };

  if (EXCALIDRAW_TO_SHAPE[el.type]) {
    const shapeKind = EXCALIDRAW_TO_SHAPE[el.type];
    const block: EditorBlock = { ...common, shapeKind };
    if (LINEAR.includes(shapeKind)) {
      block.points = (el.points ?? []).map(
        (p: [number, number]) => [p[0] + (el.x ?? 0), p[1] + (el.y ?? 0)] as [number, number],
      );
      block.x = 0; block.y = 0; block.width = 0; block.height = 0;
      block.startBinding = mapBindingIn(el.startBinding);
      block.endBinding = mapBindingIn(el.endBinding);
      block.curved = el.roundness?.type === 2 ? true : undefined;
      const flowrHeads = el.customData?.flowr;
      const defaultHead: ArrowheadStyle = { type: 'none' };
      block.startArrowhead =
        flowrHeads?.startArrowhead ?? (el.startArrowhead ? ({ type: 'filled-triangle', size: 1 } as ArrowheadStyle) : defaultHead);
      block.endArrowhead =
        flowrHeads?.endArrowhead ?? (el.endArrowhead ? ({ type: 'filled-triangle', size: 1 } as ArrowheadStyle) : defaultHead);
    }
    return block;
  }

  if (el.type === 'text') {
    return {
      ...common, type: 'text', content: el.text ?? '',
      fontSize: el.fontSize ?? 20, textAlign: el.textAlign ?? 'left',
      ...(el.containerId ? { containerId: el.containerId } : {}),
    };
  }

  if (el.type === 'image') {
    const kind: 'image' | 'video' = el.customData?.flowr?.kind === 'video' ? 'video' : 'image';
    return { ...common, type: kind, content: '', mediaUrl: el.customData?.flowr?.src ?? undefined };
  }

  if (el.type === 'frame') {
    return { ...common, type: 'frame', content: el.name ?? 'Section' };
  }

  if (el.customData?.flowr?.storeBlock) {
    // A store block type without a dedicated Excalidraw analogue: restore verbatim,
    // but keep zIndex/canvasId in sync with the file's current position/entity.
    const stored = el.customData.flowr.storeBlock as EditorBlock;
    return { ...stored, id: el.id, canvasId, zIndex: index };
  }

  // Unknown element from a foreign/future tool: preserve raw for lossless re-serialization.
  return { ...common, type: 'shape', shapeKind: undefined, __raw: el } as RawBlock;
}

export function serializeCanvas(entity: { id: string; title: string }, blocks: EditorBlock[]): string {
  const sorted = [...blocks].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
  return JSON.stringify(
    {
      type: 'excalidraw',
      version: 2,
      source: 'flowr',
      elements: sorted.map(b => blockToElement(b, sorted)),
      appState: { viewBackgroundColor: '#141413' },
      files: {},
      flowr: { formatVersion: 1, entityId: entity.id, title: entity.title },
    },
    null,
    2,
  );
}

export function parseFlowrFile(json: string): { entityId?: string; title?: string; blocks: EditorBlock[] } {
  let doc: any;
  try {
    doc = JSON.parse(json);
  } catch {
    throw new Error('invalid-flowr-file');
  }
  if (!doc || doc.type !== 'excalidraw' || !Array.isArray(doc.elements)) {
    throw new Error('invalid-flowr-file');
  }
  const canvasId = doc.flowr?.entityId ?? '';
  return {
    entityId: doc.flowr?.entityId,
    title: doc.flowr?.title,
    blocks: doc.elements.map((el: any, i: number) => elementToBlock(el, i, canvasId)),
  };
}
