// src/lib/attachmentLimits.test.ts
import { describe, it, expect } from 'vitest';
import { exceedsUploadCap, MAX_ATTACHMENT_BYTES } from './attachmentLimits';

describe('exceedsUploadCap', () => {
  it('returns false for a file under the cap', () => {
    expect(exceedsUploadCap(1024)).toBe(false);
  });
  it('returns true for a file over the cap', () => {
    expect(exceedsUploadCap(MAX_ATTACHMENT_BYTES + 1)).toBe(true);
  });
  it('returns false for a file exactly at the cap', () => {
    expect(exceedsUploadCap(MAX_ATTACHMENT_BYTES)).toBe(false);
  });
});
