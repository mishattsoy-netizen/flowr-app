// src/lib/attachmentLimits.ts
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024; // 5MB, MVP cap per architecture_design_doc.md §5

export function exceedsUploadCap(sizeBytes: number): boolean {
  return sizeBytes > MAX_ATTACHMENT_BYTES;
}
