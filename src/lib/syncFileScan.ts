import { parseFrontmatter } from './editor/frontmatter';
import { getVaultPath } from './fileVault';

export interface ParsedVaultFile {
  id: string;
  syncMode: string;
}

/**
 * Extracts { id, syncMode } from a vault file's content, handling both the
 * markdown-frontmatter format (.md) and the raw-JSON format (.canvas).
 * Returns null if the content can't be parsed as either.
 */
export function parseVaultFile(fileName: string, content: string): ParsedVaultFile | null {
  if (fileName.endsWith('.canvas')) {
    try {
      const parsed = JSON.parse(content);
      const id = parsed?.entity?.id;
      const syncMode = parsed?.entity?.syncMode;
      if (typeof id === 'string' && typeof syncMode === 'string') {
        return { id, syncMode };
      }
      return null;
    } catch {
      return null;
    }
  }

  const { meta } = parseFrontmatter(content);
  if (typeof meta.id === 'string' && typeof meta.syncMode === 'string') {
    return { id: meta.id, syncMode: meta.syncMode };
  }
  return null;
}

/**
 * Lists every file in the vault along with its parsed { id, syncMode }.
 * Files that fail to parse are silently skipped.
 */
export async function listVaultFiles(vaultPath: string): Promise<Array<{ path: string; fileName: string; parsed: ParsedVaultFile }>> {
  const flowrFS = (window as any).flowrFS;
  if (!flowrFS) return [];

  if (!flowrFS.listAllFiles) {
    const fileNames: string[] = await flowrFS.readdir(vaultPath);
    const results: Array<{ path: string; fileName: string; parsed: ParsedVaultFile }> = [];
    for (const fileName of fileNames) {
      if (!fileName.endsWith('.md') && !fileName.endsWith('.canvas')) continue;
      const path = `${vaultPath}/${fileName}`;
      try {
        const content: string = await flowrFS.readFile(path);
        const parsed = parseVaultFile(fileName, content);
        if (parsed) results.push({ path, fileName, parsed });
      } catch {
        // Unreadable file — skip it.
      }
    }
    return results;
  }

  const files = await flowrFS.listAllFiles(vaultPath);
  const results: Array<{ path: string; fileName: string; parsed: ParsedVaultFile }> = [];

  for (const file of files) {
    try {
      const content: string = await flowrFS.readFile(file.path);
      const parsed = parseVaultFile(file.name, content);
      if (parsed) results.push({ path: file.path, fileName: file.name, parsed });
    } catch {
      // Unreadable file — skip it.
    }
  }

  return results;
}

/**
 * Finds the vault file (if any) whose frontmatter/JSON id matches the given entity,
 * regardless of what the current filename would be (handles the case where the
 * entity's title changed while it was cloud-only, leaving an old-titled orphan).
 */
export async function findLocalFileForEntity(vaultPath: string, entity: { id: string }): Promise<string | null> {
  const files = await listVaultFiles(vaultPath);
  const match = files.find(f => f.parsed.id === entity.id);
  return match ? match.path : null;
}

export async function deleteVaultFile(path: string): Promise<void> {
  const flowrFS = (window as any).flowrFS;
  if (!flowrFS) return;
  await flowrFS.deleteFile(path);
}

const KEPT_FILES_STORAGE_KEY = 'flowr_kept_local_files';

/**
 * Files the user explicitly chose to keep via the SyncFileCleanupModal
 * ("Keep local copy"), keyed by entity id for recognized files or by vault
 * path for unrecognized ones. Persisted so the startup scan and mode-switch
 * check stop re-flagging the same file on every launch.
 */
function getKeptFileKeys(): Set<string> {
  try {
    const raw = localStorage.getItem(KEPT_FILES_STORAGE_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function keyForFlaggedFile(file: { path: string; entityId: string; recognized: boolean }): string {
  return file.recognized ? `entity:${file.entityId}` : `path:${file.path}`;
}

export function isFileKeptByUser(file: { path: string; entityId: string; recognized: boolean }): boolean {
  return getKeptFileKeys().has(keyForFlaggedFile(file));
}

export function markFilesKeptByUser(files: Array<{ path: string; entityId: string; recognized: boolean }>): void {
  const keys = getKeptFileKeys();
  for (const file of files) keys.add(keyForFlaggedFile(file));
  localStorage.setItem(KEPT_FILES_STORAGE_KEY, JSON.stringify(Array.from(keys)));
}

/** Clears a previously-recorded "keep" decision for an entity, e.g. when it's switched
 * back to cloud-only again and should be re-asked about fresh. */
export function clearKeptFileForEntity(entityId: string): void {
  const keys = getKeptFileKeys();
  keys.delete(`entity:${entityId}`);
  localStorage.setItem(KEPT_FILES_STORAGE_KEY, JSON.stringify(Array.from(keys)));
}

export { getVaultPath };
