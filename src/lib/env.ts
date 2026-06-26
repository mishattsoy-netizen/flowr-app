export function isDesktop(): boolean {
  return typeof window !== 'undefined' && !!(window as any).__FLOWR_DESKTOP__;
}

export function isWeb(): boolean {
  return !isDesktop();
}
