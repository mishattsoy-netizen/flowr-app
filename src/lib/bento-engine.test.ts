import { describe, it, expect } from 'vitest';
import { recoverLayout, validateLayout } from './bento-engine';
import type { BentoLayoutItem } from '@/components/bento/types';

describe('recoverLayout', () => {
  it('correctly clamps shortcuts widget to new dimensions (minW: 4, maxH: 2)', () => {
    const invalidLayout: BentoLayoutItem[] = [
      { i: 'recent', type: 'recent', row: 0, order: 0, w: 2, h: 4 },
      { i: 'tasks', type: 'smart-tasks', row: 0, order: 1, w: 4, h: 2 },
      { i: 'shortcuts', type: 'shortcuts', row: 2, order: 0, w: 2, h: 4 }, // violating both minW: 4 and maxH: 2
    ];

    const recovered = recoverLayout(invalidLayout);
    expect(recovered).not.toBeNull();
    
    const shortcuts = recovered!.find(it => it.type === 'shortcuts')!;
    expect(shortcuts.w).toBeGreaterThanOrEqual(4);
    expect(shortcuts.h).toBeLessThanOrEqual(2);
    expect(validateLayout(recovered!).valid).toBe(true);
  });

  it('performs fallback reconstruction when simple clamping creates invalid grid layouts', () => {
    // A layout that will definitely fail simple validation due to horizontal gaps
    // when width is clamped, triggering our sequential reconstruction fallback.
    const complexInvalidLayout: BentoLayoutItem[] = [
      { i: 'recent', type: 'recent', row: 0, order: 0, w: 2, h: 4 },
      { i: 'tasks', type: 'smart-tasks', row: 0, order: 1, w: 4, h: 2 },
      { i: 'shortcuts', type: 'shortcuts', row: 1, order: 1, w: 2, h: 4 }, // overlaps tasks & leaves gap in row 3
    ];

    const recovered = recoverLayout(complexInvalidLayout);
    expect(recovered).not.toBeNull();
    expect(validateLayout(recovered!).valid).toBe(true);

    const shortcuts = recovered!.find(it => it.type === 'shortcuts')!;
    expect(shortcuts.w).toBeGreaterThanOrEqual(4);
    expect(shortcuts.h).toBeLessThanOrEqual(2);
  });
});
