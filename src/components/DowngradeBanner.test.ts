// src/components/DowngradeBanner.test.ts
import { describe, it, expect } from 'vitest';
import { shouldShowGraceBanner } from './DowngradeBanner';

describe('shouldShowGraceBanner', () => {
  it('returns false when gracePeriodEndsAt is null', () => {
    expect(shouldShowGraceBanner(null)).toBe(false);
  });
  it('returns true when gracePeriodEndsAt is in the future', () => {
    expect(shouldShowGraceBanner(Date.now() + 1000 * 60 * 60)).toBe(true);
  });
  it('returns false when gracePeriodEndsAt is in the past', () => {
    expect(shouldShowGraceBanner(Date.now() - 1000)).toBe(false);
  });
});
