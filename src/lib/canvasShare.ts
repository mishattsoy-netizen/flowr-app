export function getCanvasShareUrl(entityId: string): string {
  const base = typeof window !== 'undefined' ? window.location.origin : '';
  return `${base}/canvas/${entityId}`;
}

export function copyShareLinkToClipboard(entityId: string): void {
  const url = getCanvasShareUrl(entityId);
  navigator.clipboard.writeText(url).catch(console.error);
}
