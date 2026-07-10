// src/lib/legacyImport.ts
import type { Entity, AppTask, Space } from '@/data/store.types';

export function parseLegacyLocalStorageSnapshot(
  raw: string,
  importTime: number = Date.now()
): { entities: Entity[]; tasks: AppTask[]; spaces: Space[] } {
  try {
    const parsed = JSON.parse(raw);
    const state = parsed?.state ?? {};
    const entities: Entity[] = Array.isArray(state.entities) ? state.entities : [];
    const tasks: AppTask[] = (Array.isArray(state.tasks) ? state.tasks : []).map((t: any) => ({
      ...t,
      lastModified: t.lastModified ?? importTime,
    }));
    const spaces: Space[] = (Array.isArray(state.spaces) ? state.spaces : []).map((s: any) => ({
      ...s,
      lastModified: s.lastModified ?? importTime,
    }));
    return { entities, tasks, spaces };
  } catch {
    return { entities: [], tasks: [], spaces: [] };
  }
}

export function entityToSQLiteRow(entity: Entity): any {
  return {
    id: entity.id,
    title: entity.title,
    type: entity.type,
    parent_id: entity.parentId ?? null,
    last_modified: entity.lastModified,
    icon: entity.icon ?? null,
    tags: JSON.stringify(entity.tags ?? []),
    content: typeof entity.content === 'string' ? entity.content : JSON.stringify(entity.content || []),
    sort_order: entity.sortOrder ?? 0,
    space_id: entity.spaceId ?? null,
    sync_mode: entity.syncMode,
    paired_entity_id: entity.pairedEntityId ?? null,
    widget_layout: entity.widgetLayout ? JSON.stringify(entity.widgetLayout) : null,
  };
}

export function taskToSQLiteRow(task: AppTask): any {
  return {
    id: task.id,
    title: task.title,
    completed: task.completed ? 1 : 0,
    due_date: task.dueDate ?? null,
    end_date: task.endDate ?? null,
    include_time: task.includeTime ? 1 : null,
    reminder: task.reminder ?? null,
    entity_id: task.entityId ?? null,
    space_id: task.spaceId ?? null,
    note: task.note ?? null,
    color: task.color ?? null,
    priority: task.priority ?? null,
    status: task.status ?? null,
    position: task.position ?? null,
    created_at: task.createdAt ?? null,
    completed_at: task.completedAt ?? null,
    last_modified: task.lastModified,
    subtasks: task.subtasks ? JSON.stringify(task.subtasks) : null,
    attachments: task.attachments ? JSON.stringify(task.attachments) : null,
    description: task.description ?? null,
    user_due_date: task.userDueDate ?? null,
    tag: task.tag ?? null,
    sync_mode: task.syncMode,
  };
}

export function spaceToSQLiteRow(space: Space): any {
  return {
    id: space.id,
    name: space.name,
    type: space.type,
    icon: space.icon ?? null,
    color: space.color ?? null,
    settings: space.settings ? JSON.stringify(space.settings) : null,
    is_default: space.isDefault ? 1 : 0,
    created_at: space.createdAt ?? null,
    last_modified: space.lastModified,
    sync_mode: space.syncMode,
  };
}
