import { Entity } from '@/data/store.types';
import { isDesktop } from './env';
import { getVaultPath, sanitizeFileName, getEntityPath } from './fileVault';
import { serializeFrontmatter, needsBlockBackup } from './editor/frontmatter';
import { blocksToMarkdown } from './editor/markdownBlocks';

export async function saveEntityToFile(entity: Entity, blocks: any[]): Promise<void> {
  if (!isDesktop() || !(window as any).flowrFS) return;
  
  // Folders and workspaces are represented by directories in the file system.
  // Do not create empty .md files for them.
  if (entity.type === 'folder' || entity.type === 'workspace') return;

  const vault = await getVaultPath();
  if (!vault) return;

  const { useStore } = await import('@/data/store');
  const state = useStore.getState();
  const relPath = getEntityPath(entity, state.entities, state.spaces);
  const filePath = `${vault}/${relPath}`;

  const { findLocalFileForEntity, deleteVaultFile } = await import('./syncFileScan');
  const oldPath = await findLocalFileForEntity(vault, entity);
  if (oldPath && oldPath !== filePath) {
    try {
      await deleteVaultFile(oldPath);
    } catch (e) {
      console.warn('Failed to delete old file path:', oldPath, e);
    }
  }

  let content = '';
  if (entity.type === 'canvas') {
    const { serializeCanvas } = await import('./canvas/flowrFile');
    content = serializeCanvas({ id: entity.id, title: entity.title }, blocks);
  } else {
    const meta = {
      id: entity.id,
      title: entity.title,
      syncMode: entity.syncMode,
      lastModified: entity.lastModified,
      spaceId: entity.spaceId || null,
      parentId: entity.parentId || null,
      version: 1,
      blocks: needsBlockBackup(blocks) ? blocks : undefined
    };
    content = serializeFrontmatter(meta) + '\n\n' + blocksToMarkdown(blocks);
  }

  const { recordLocalWrite } = await import('./vaultSyncBridge');
  recordLocalWrite(filePath);

  await (window as any).flowrFS.writeFile(filePath, content);
}

export async function saveEntity(entity: Entity): Promise<void> {
  if (entity.syncMode === 'cloud-only' || entity.syncMode === 'full-sync') {
     const { upsertEntity } = await import('@/lib/sync'); // Avoid circular dep
     await upsertEntity(entity);
  }
  if (isDesktop() && (entity.syncMode === 'local-only' || entity.syncMode === 'full-sync')) {
     let blocks: any[] = entity.content || [];
     if (entity.type === 'canvas') {
       const { useStore } = await import('@/data/store');
       blocks = useStore.getState().blocks.filter(b => b.canvasId === entity.id);
     }
     await saveEntityToFile(entity, blocks);
  }
}
