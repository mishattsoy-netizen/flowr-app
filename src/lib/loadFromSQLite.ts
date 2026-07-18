import type { Entity, AppTask, Space } from '@/data/store.types';
import { isDesktop } from './env';

function parseJson<T>(str: string | null, fallback: T): T {
  if (!str) return fallback;
  try { return JSON.parse(str); } catch { return fallback; }
}

export function sqliteRowToEntity(row: Record<string, any>): Entity {
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    parentId: row.parent_id ?? null,
    lastModified: row.last_modified ?? 0,
    icon: row.icon ?? undefined,
    tags: parseJson(row.tags, []),
    content: parseJson(row.content, []),
    sortOrder: row.sort_order ?? undefined,
    spaceId: row.space_id ?? null,
    syncMode: row.sync_mode ?? 'local-only',
    pairedEntityId: row.paired_entity_id ?? null,
    widgetLayout: row.widget_layout ? parseJson(row.widget_layout, undefined) : undefined,
    brainOnly: row.brain_only === true || row.brain_only === 1,
    description: row.description ?? null,
  } as Entity;
}

export function sqliteRowToTask(row: Record<string, any>): AppTask {
  return {
    id: row.id,
    title: row.title,
    completed: !!row.completed,
    dueDate: row.due_date ?? undefined,
    endDate: row.end_date ?? undefined,
    includeTime: row.include_time ? true : undefined,
    reminder: row.reminder ?? undefined,
    entityId: row.entity_id ?? null,
    spaceId: row.space_id ?? null,
    note: row.note ?? undefined,
    color: row.color ?? undefined,
    priority: row.priority ?? undefined,
    status: row.status ?? undefined,
    position: row.position ?? null,
    createdAt: row.created_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
    lastModified: row.last_modified ?? 0,
    subtasks: row.subtasks ? parseJson(row.subtasks, undefined) : undefined,
    attachments: row.attachments ? parseJson(row.attachments, undefined) : undefined,
    description: row.description ?? undefined,
    userDueDate: row.user_due_date ?? undefined,
    tag: row.tag ?? undefined,
    syncMode: row.sync_mode ?? 'local-only',
  } as AppTask;
}

export function sqliteRowToSpace(row: Record<string, any>): Space {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    ownerId: null,
    createdAt: row.created_at ?? 0,
    lastModified: row.last_modified ?? 0,
    icon: row.icon ?? undefined,
    color: row.color ?? undefined,
    settings: row.settings ? parseJson(row.settings, undefined) : undefined,
    syncMode: row.sync_mode ?? 'local-only',
    isDefault: !!row.is_default,
  } as Space;
}

export async function loadFromSQLite(): Promise<{ entities: Entity[]; tasks: AppTask[]; spaces: Space[] }> {
  if (!isDesktop() || !(window as any).flowrDB) {
    return { entities: [], tasks: [], spaces: [] };
  }
  const [entityRows, taskRows, spaceRows] = await Promise.all([
    (window as any).flowrDB.getAllEntities(),
    (window as any).flowrDB.getAllTasks(),
    (window as any).flowrDB.getAllSpaces(),
  ]);
  return {
    entities: entityRows.map(sqliteRowToEntity),
    tasks: taskRows.map(sqliteRowToTask),
    spaces: spaceRows.map(sqliteRowToSpace),
  };
}
