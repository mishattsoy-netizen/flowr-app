import { describe, it, expect } from 'vitest';
import { buildLocalOnlyConfirmText } from './LocalOnlyConfirmModal';

describe('buildLocalOnlyConfirmText', () => {
  it('reports item and task counts and the 48 hour grace period', () => {
    const text = buildLocalOnlyConfirmText(5, 3);
    expect(text).toContain('5 items');
    expect(text).toContain('3 tasks');
    expect(text).toContain('48 hours');
  });

  it('uses singular wording for a count of one', () => {
    const text = buildLocalOnlyConfirmText(1, 1);
    expect(text).toContain('1 item,');
    expect(text).toContain('1 task)');
  });

  it('handles zero tasks', () => {
    const text = buildLocalOnlyConfirmText(2, 0);
    expect(text).toContain('0 tasks');
  });
});
