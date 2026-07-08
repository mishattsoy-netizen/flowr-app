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
  entity: { title: string; type: string; parentId: string | null; spaceId?: string | null },
  entities: Array<{ id: string; title: string; type?: string; parentId: string | null }>,
  spaces: Array<{ id: string; name: string }>
): string {
  const segments: string[] = [];

  const ext = entity.type === 'canvas' ? '.flowr' : '.md';
  const fileName = sanitizeFileName(entity.title) + ext;
  segments.push(fileName);

  let currentParentId = entity.parentId;
  let isUnsorted = true;

  while (currentParentId) {
    const parent = entities.find(e => e.id === currentParentId);
    if (!parent) break;
    
    isUnsorted = false;

    // Do NOT include 'workspace' type entities in the path. 
    // The Space object already provides the workspace folder name.
    if (parent.type !== 'workspace') {
      segments.unshift(sanitizeFileName(parent.title));
    }
    
    currentParentId = parent.parentId;
  }

  // If the entity itself is a 'workspace', it is not unsorted.
  if (entity.type === 'workspace') {
    isUnsorted = false;
  }

  // Only prefix with the Space folder if it's NOT unsorted.
  // Unsorted items should be placed directly at the vault root.
  if (entity.spaceId && !isUnsorted) {
    const ws = spaces.find(w => w.id === entity.spaceId);
    if (ws) {
      segments.unshift(sanitizeFileName(ws.name));
    }
  }

  return segments.join('/');
}
