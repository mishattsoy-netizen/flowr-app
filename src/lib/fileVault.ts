export async function getVaultPath(): Promise<string | null> {
  return localStorage.getItem('flowr_vault_path');
}

export async function setVaultPath(path: string): Promise<void> {
  localStorage.setItem('flowr_vault_path', path);
}

export function sanitizeFileName(title: string): string {
  let clean = title.replace(/[<>:"/\\|?*\x00-\x1F]/g, '-');
  const reserved = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;
  if (reserved.test(clean)) clean = clean + '_';
  return clean.trim().substring(0, 120) || 'Untitled';
}

export async function pickVaultFolder(): Promise<string | null> {
  if (typeof window === 'undefined' || !(window as any).flowrFS) return null;
  const path = await (window as any).flowrFS.pickVaultFolder();
  // NOTE: does NOT auto-save — caller is responsible for calling setVaultPath
  return path;
}
