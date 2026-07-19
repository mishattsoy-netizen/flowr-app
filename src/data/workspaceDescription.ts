import type { Entity, Space } from './store.types'
import { upsertEntity } from '@/lib/sync'
import { entityToSQLiteRow } from '@/lib/legacyImport'
import { isDesktop } from '@/lib/env'

/**
 * Update a workspace entity's title + description (max 500 chars).
 * Standalone so UI can call it without depending on a store action that may be
 * missing after HMR of a long-lived zustand persist instance.
 */
export function applyWorkspaceDescription(
  getEntities: () => Entity[],
  setEntitiesAndSpaces: (
    mapEntity: (e: Entity) => Entity,
    mapSpace: (s: Space) => Space
  ) => void,
  id: string,
  title: string,
  description: string
): void {
  const trimmedTitle = title.trim()
  if (!trimmedTitle) return
  const desc = (description ?? '').slice(0, 500)
  const now = Date.now()

  setEntitiesAndSpaces(
    e =>
      e.id === id
        ? { ...e, title: trimmedTitle, description: desc, lastModified: now }
        : e,
    w => (w.id === id ? { ...w, name: trimmedTitle, lastModified: now } : w)
  )

  const updated = getEntities().find(e => e.id === id)
  if (!updated) return

  if (updated.syncMode !== 'local-only') {
    void upsertEntity(updated)
  }

  // Desktop SQLite subscriber only mirrors notes/canvases — push workspaces explicitly.
  if (typeof window !== 'undefined' && isDesktop() && (window as any).flowrDB) {
    try {
      ;(window as any).flowrDB.upsertEntity(entityToSQLiteRow(updated))
    } catch {
      /* ignore */
    }
  }
}
