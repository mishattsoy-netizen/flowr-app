export async function getVaultPath(): Promise<string | null> {
  if (typeof window !== 'undefined' && (window as any).flowrFS?.getVaultPath) {
    return await (window as any).flowrFS.getVaultPath();
  }
  return localStorage.getItem('flowr_vault_path');
}

export async function setVaultPath(path: string): Promise<void> {
  if (typeof window !== 'undefined' && (window as any).flowrFS?.setVaultPath) {
    await (window as any).flowrFS.setVaultPath(path);
  }
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

export function getEntityPath(
  entity: { title: string; type: string; parentId: string | null; workspaceId?: string | null },
  entities: Array<{ id: string; title: string; parentId: string | null }>,
  workspaces: Array<{ id: string; name: string }>
): string {
  const segments: string[] = [];

  const ext = entity.type === 'canvas' ? '.canvas' : '.md';
  const fileName = sanitizeFileName(entity.title) + ext;
  segments.push(fileName);

  let currentParentId = entity.parentId;
  while (currentParentId) {
    const parent = entities.find(e => e.id === currentParentId);
    if (!parent) break;
    segments.unshift(sanitizeFileName(parent.title));
    currentParentId = parent.parentId;
  }

  if (entity.workspaceId) {
    const ws = workspaces.find(w => w.id === entity.workspaceId);
    if (ws) {
      segments.unshift(sanitizeFileName(ws.name));
    }
  }

  return segments.join('/');
}
