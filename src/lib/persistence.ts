import { Entity } from '@/data/store.types';

export async function saveEntity(entity: Entity): Promise<void> {
  if (entity.syncMode === 'cloud-only' || entity.syncMode === 'full-sync') {
     const { upsertEntity } = await import('@/lib/sync'); // Avoid circular dep
     await upsertEntity(entity);
  }
}
