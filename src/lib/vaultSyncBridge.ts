import { getVaultPath, getEntityPath, sanitizeFileName } from './fileVault';
import { parseFrontmatter } from './editor/frontmatter';
import { parseMarkdownToBlocks, blocksToMarkdown } from './editor/markdownBlocks';
import { Entity } from '@/data/store.types';

// Loopback prevention map: maps absoluteFilePath -> timestamp of last write
const localWrites = new Map<string, number>();

export function recordLocalWrite(filePath: string) {
  localWrites.set(filePath, Date.now());
}

function cleanOldWrites() {
  const now = Date.now();
  for (const [path, time] of localWrites.entries()) {
    if (now - time > 10000) {
      localWrites.delete(path);
    }
  }
}

// Compare two content arrays to see if they are structurally equal (avoid infinite render/write cycles)
function isContentEqual(blocksA: any[] | undefined, blocksB: any[] | undefined): boolean {
  if (!blocksA || !blocksB) return blocksA === blocksB;
  if (blocksA.length !== blocksB.length) return false;
  for (let i = 0; i < blocksA.length; i++) {
    const a = blocksA[i];
    const b = blocksB[i];
    if (a.type !== b.type || a.style !== b.style || a.content !== b.content || a.checked !== b.checked) {
      return false;
    }
  }
  return true;
}

export async function handleLocalFileChanged(data: { eventType: string; filename: string; absolutePath: string }) {
  cleanOldWrites();

  const { eventType, filename, absolutePath } = data;

  // 1. Loopback check
  const lastWriteTime = localWrites.get(absolutePath);
  if (lastWriteTime && Date.now() - lastWriteTime < 2000) {
    return; // Ignored as it was recently written by Flowr itself
  }

  const flowrFS = (window as any).flowrFS;
  if (!flowrFS) return;

  const { useStore } = await import('@/data/store');
  const state = useStore.getState();
  const vault = await getVaultPath();
  if (!vault) return;

  // Normalize path format for lookup
  const normalizedFilename = filename.replace(/\\/g, '/');

  let fileContent: string | null = null;
  try {
    fileContent = await flowrFS.readFile(absolutePath);
  } catch (err) {
    // File was deleted
  }

  if (fileContent === null) {
    // ————— FILE DELETED —————
    // Find the entity currently occupying this path
    const match = state.entities.find(e => {
      if (e.syncMode === 'cloud-only') return false;
      const expectedRelPath = getEntityPath(e, state.entities, state.workspaces);
      return expectedRelPath.toLowerCase() === normalizedFilename.toLowerCase();
    });

    if (match) {
      console.log(`[Sync Bridge] Local file deleted for entity: ${match.title} (${match.id}). Deleting entity.`);
      state.deleteEntity(match.id);
    }
    return;
  }

  // ————— FILE ADDED OR MODIFIED —————
  if (!filename.endsWith('.md') && !filename.endsWith('.flowr')) return;

  const titleFromFilename = filename.split(/[/\\]/).pop()?.replace(/\.(md|flowr)$/, '') || 'Untitled';

  if (filename.endsWith('.flowr')) {
    // .flowr Excalidraw-compatible JSON sync
    try {
      const { parseFlowrFile } = await import('./canvas/flowrFile');
      const parsed = parseFlowrFile(fileContent);
      const title = parsed.title || titleFromFilename;
      if (parsed.entityId) {
        const existing = state.entities.find(e => e.id === parsed.entityId);
        if (existing) {
          if (existing.title !== title) {
            console.log(`[Sync Bridge] Updating canvas entity from local file: ${title}`);
            state.renameEntity(existing.id, title);
          }
          state.replaceCanvasBlocks(existing.id, parsed.blocks);
        } else {
          console.log(`[Sync Bridge] Importing new canvas entity: ${title}`);
          state.addEntity({ id: parsed.entityId, title, type: 'canvas', parentId: null, syncMode: 'full-sync', lastModified: Date.now() });
          state.replaceCanvasBlocks(parsed.entityId, parsed.blocks);
        }
      } else {
        // Foreign .excalidraw-style file dropped into the vault: import as new canvas
        console.log(`[Sync Bridge] Importing foreign .flowr/.excalidraw file as new canvas: ${title}`);
        const newId = state.addEntity({ title, type: 'canvas', parentId: null, syncMode: 'full-sync' });
        state.replaceCanvasBlocks(newId, parsed.blocks.map(b => ({ ...b, canvasId: newId })));
      }
    } catch (e) {
      console.warn('[Sync Bridge] Invalid .flowr file, leaving untouched:', absolutePath, e);
    }
    return;
  }

  // .md markdown sync
  const { meta, body } = parseFrontmatter(fileContent);
  const blocks = parseMarkdownToBlocks(body);

  if (meta.id) {
    // Recognized file
    const existing = state.entities.find(e => e.id === meta.id);
    if (existing) {
      const title = meta.title || titleFromFilename;
      const contentChanged = !isContentEqual(existing.content, blocks);
      const titleChanged = existing.title !== title;

      if (contentChanged || titleChanged) {
        console.log(`[Sync Bridge] Updating note entity from local file: ${title}`);
        if (titleChanged) {
          state.renameEntity(existing.id, title);
        }
        if (contentChanged) {
          state.updateEntityContent(existing.id, blocks);
        }
      }
    } else {
      // Recognized ID but missing from store (e.g. synced from other device local sync)
      console.log(`[Sync Bridge] Importing recognized note: ${meta.title || titleFromFilename}`);
      state.addEntity({
        id: meta.id,
        title: meta.title || titleFromFilename,
        type: 'note',
        parentId: meta.workspaceId || null,
        syncMode: (meta.syncMode as any) || 'full-sync',
        content: blocks,
        lastModified: meta.lastModified || Date.now()
      });
    }
  } else {
    // ————— UNRECOGNIZED FILE (Manually added) —————
    console.log(`[Sync Bridge] Importing manually created file: ${titleFromFilename}`);
    
    // Resolve workspace folder from directory path if added in a subfolder
    let parentWorkspaceId: string | null = null;
    const parts = normalizedFilename.split('/');
    if (parts.length > 1) {
      const firstFolder = parts[0];
      const matchWs = state.workspaces.find(w => sanitizeFileName(w.name).toLowerCase() === firstFolder.toLowerCase());
      if (matchWs) parentWorkspaceId = matchWs.id;
    }

    const newEntityId = state.addEntity({
      title: titleFromFilename,
      type: 'note',
      parentId: null, // Starts at root of workspace/vault
      workspaceId: parentWorkspaceId, // Auto-assign to matched workspace folder
      syncMode: 'full-sync',
      content: blocks
    });

    // Write back the generated frontmatter meta block to the local file to make it recognized
    setTimeout(async () => {
      const freshEntity = useStore.getState().entities.find(e => e.id === newEntityId);
      if (freshEntity) {
        const { saveEntityToFile } = await import('./persistence');
        recordLocalWrite(absolutePath);
        await saveEntityToFile(freshEntity, blocks);
      }
    }, 100);
  }
}
