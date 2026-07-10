import { Entity } from '@/data/store.types';
import { isDesktop } from './env';
import { getVaultPath, getEntityPath } from './fileVault';
import { serializeFrontmatter, needsBlockBackup } from './editor/frontmatter';
import { blocksToMarkdown } from './editor/markdownBlocks';

export async function saveEntity(entity: Entity): Promise<void> {
  if (entity.syncMode === 'cloud-only' || entity.syncMode === 'full-sync') {
     const { upsertEntity } = await import('@/lib/sync'); // Avoid circular dep
     await upsertEntity(entity);
  }
}

// Retained solely for src/lib/vaultSyncBridge.ts's OS file-watcher reconciler:
// when a user manually edits/creates a .md file in the vault folder outside
// the app, that reconciler needs to write the recognized frontmatter (id,
// syncMode, etc.) back into the file so it isn't re-imported as a duplicate
// on the next scan. This is a distinct feature from the app's own
// auto-save-on-edit path, which Task 14 correctly removed (SQLite write-
// through, via the store's isDesktop() subscriber, replaced it). Do not wire
// this back into the store's own save paths — the desktop write-through
// subscriber in store.ts already handles those via flowrDB directly.
export async function saveEntityToFile(entity: Entity, blocks: any[]): Promise<void> {
  if (!isDesktop() || !(window as any).flowrFS) return;

  if (entity.type === 'folder' || entity.type === 'workspace') return;

  const vault = await getVaultPath();
  if (!vault) return;

  const { useStore } = await import('@/data/store');
  const state = useStore.getState();
  const relPath = getEntityPath(entity, state.entities, state.spaces);
  const filePath = `${vault}/${relPath}`;

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
