export function isDesktop(): boolean {
  if (typeof window === 'undefined') {
    // Server-side: true only for the dedicated Electron-forked Next server
    // (see electron/main.js, which sets FLOWR_DESKTOP='1' on that fork's env).
    // The regular web deployment never sets this, so it correctly stays false
    // there. This must exactly match what the client will resolve to once it
    // hydrates, or React will report a hydration mismatch.
    return process.env.FLOWR_DESKTOP === '1';
  }
  return !!(window as any).__FLOWR_DESKTOP__;
}

export function isWeb(): boolean {
  return !isDesktop();
}
