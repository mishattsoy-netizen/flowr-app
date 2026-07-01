import { Entity } from '@/data/store.types';
import { isDesktop } from './env';
import { getVaultPath, sanitizeFileName } from './fileVault';
import { serializeFrontmatter, needsBlockBackup } from './editor/frontmatter';
import { blocksToMarkdown } from './editor/markdownBlocks';

export async function saveEntityToFile(entity: Entity, blocks: any[]): Promise<void> {
  if (!isDesktop() || !(window as any).flowrFS) return;
  const vault = await getVaultPath();
  if (!vault) return;

  const fileName = sanitizeFileName(entity.title) + (entity.type === 'canvas' ? '.canvas' : '.md');
  const filePath = `${vault}/${fileName}`; // simplified for M3, will use folders later

  let content = '';
  if (entity.type === 'canvas') {
    content = JSON.stringify({ entity, blocks }, null, 2);
  } else {
    const meta = {
      id: entity.id,
      title: entity.title,
      syncMode: entity.syncMode,
      lastModified: entity.lastModified,
      version: 1,
      blocks: needsBlockBackup(blocks) ? blocks : undefined
    };
    content = serializeFrontmatter(meta) + '\n\n' + blocksToMarkdown(blocks);
  }

  await (window as any).flowrFS.writeFile(filePath, content);
}

export async function saveEntity(entity: Entity): Promise<void> {
  if (entity.syncMode === 'cloud-only' || entity.syncMode === 'full-sync') {
     const { upsertEntity } = await import('@/lib/sync'); // Avoid circular dep
     await upsertEntity(entity);
  }
  if (isDesktop() && (entity.syncMode === 'local-only' || entity.syncMode === 'full-sync')) {
     await saveEntityToFile(entity, entity.type === 'canvas' ? [] : (entity.content || []));
  }
}
