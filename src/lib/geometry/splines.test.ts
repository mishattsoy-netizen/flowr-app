import { describe, it, expect } from 'vitest';
import { calculatePolylinePath } from './splines';

describe('calculatePolylinePath', () => {
  it('renders M/L segments', () => {
    expect(calculatePolylinePath([[0, 0], [10, 5], [20, 0]])).toBe('M 0 0 L 10 5 L 20 0');
  });
  it('empty/single point → empty string', () => {
    expect(calculatePolylinePath([])).toBe('');
    expect(calculatePolylinePath([[1, 1]])).toBe('');
  });
});
