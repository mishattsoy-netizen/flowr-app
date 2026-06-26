"use client";
import type { ArrowheadStyle } from '@/data/store';

export function getMarkerIds(blockId: string) {
  return { start: `ah-s-${blockId}`, end: `ah-e-${blockId}` };
}

export function ArrowheadMarker({ id, style, strokeColor }: { id: string; style: ArrowheadStyle; strokeColor: string }) {
  if (style.type === 'none') return null;
  const s = style.size ?? 1;
  const w = 8 * s, h = 8 * s, rx = 6 * s, ry = 4 * s;

  if (style.type === 'circle') return (
    <marker id={id} markerUnits="userSpaceOnUse" markerWidth={w} markerHeight={h} refX={rx} refY={ry} orient="auto">
      <circle cx={4*s} cy={4*s} r={3.5*s} fill={strokeColor} />
    </marker>
  );
  if (style.type === 'bar') return (
    <marker id={id} markerUnits="userSpaceOnUse" markerWidth={w} markerHeight={h} refX={rx} refY={ry} orient="auto">
      <line x1={0} y1={0} x2={0} y2={h} stroke={strokeColor} strokeWidth={2*s} strokeLinecap="round" />
    </marker>
  );
  if (style.type === 'diamond') return (
    <marker id={id} markerUnits="userSpaceOnUse" markerWidth={w} markerHeight={h} refX={rx} refY={ry} orient="auto">
      <path d={`M0,${4*s} L${4*s},0 L${8*s},${4*s} L${4*s},${8*s} Z`} fill={strokeColor} />
    </marker>
  );

  return (
    <marker id={id} markerUnits="userSpaceOnUse" markerWidth={w} markerHeight={h} refX={rx} refY={ry} orient="auto">
      <path d={`M0,0 L0,${8*s} L${8*s},${4*s} z`} fill={style.type === 'triangle' ? 'none' : strokeColor} stroke={style.type === 'triangle' ? strokeColor : 'none'} strokeWidth={s} />
    </marker>
  );
}
