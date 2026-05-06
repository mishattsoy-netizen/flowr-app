/**
 * Flowr sync layer — Supabase ↔ Zustand store
 *
 * Design:
 *  - `loadFromSupabase`  : called once on app boot; fetches all rows into the store
 *  - `upsertEntity`      : called whenever an entity is created / updated
 *  - `deleteEntity`      : called whenever an entity is deleted
 *  - `upsertTask`        : called whenever a task is created / updated
 *  - `deleteTask`        : called whenever a task is deleted
 *  - `subscribeRealtime` : sets up live listeners so changes from other devices
 *                          are reflected immediately without a refresh
 *
 * All functions are no-ops when Supabase is not configured.
 */

import { supabase } from './supabase';
import type { Entity, AppTask, Workspace } from '@/data/store';

// ─── Row ↔ Store mappers ──────────────────────────────────────────────────────

function rowToWorkspace(row: Record<string, any>): Workspace {
  return {
    id:           row.id,
    name:         row.name,
    type:         row.type ?? 'personal',
    ownerId:      row.owner_id ?? null,
    createdAt:    row.created_at ? new Date(row.created_at).getTime() : 0,
    icon:         row.icon ?? undefined,
    color:        row.color ?? undefined,
    settings:     row.settings ?? undefined,
  };
}

function workspaceToRow(w: Workspace): Record<string, any> {
  const row: Record<string, any> = {
    id:            w.id,
    name:          w.name,
    type:          w.type,
  };
  if (w.ownerId)  row.owner_id = w.ownerId;
  if (w.icon)     row.icon     = w.icon;
  if (w.color)    row.color    = w.color;
  if (w.settings) row.settings = w.settings;
  return row;
}

function rowToSetting(row: Record<string, any>): { key: string; value: any } {
  return {
    key: row.key,
    value: row.value,
  };
}

function settingToRow(key: string, value: any): Record<string, any> {
  return {
    key,
    value,
    updated_at: new Date().toISOString(),
  };
}

function rowToEntity(row: Record<string, any>): Entity {
  return {
    id:           row.id,
    title:        row.title,
    type:         row.type,
    parentId:     row.parent_id ?? null,
    lastModified: row.last_modified ?? 0,
    icon:         row.icon ?? undefined,
    tags:         row.tags ?? [],
    content:      row.content ?? [],
    widgetLayout: row.widget_layout ?? undefined,
    workspaceId:  row.workspace_id ?? null,
  };
}

function entityToRow(e: Entity): Record<string, any> {
  const row: Record<string, any> = {
    id:            e.id,
    title:         e.title,
    type:          e.type,
    parent_id:     e.parentId ?? null,
    last_modified: e.lastModified,
    icon:          e.icon ?? null,
    tags:          e.tags ?? [],
    content:       e.content ?? [],
  };
  if (e.widgetLayout)  row.widget_layout  = e.widgetLayout;
  if (e.workspaceId)   row.workspace_id   = e.workspaceId;
  return row;
}

function rowToTask(row: Record<string, any>): AppTask {
  return {
    id:          row.id,
    title:       row.title,
    completed:   row.completed ?? false,
    dueDate:     row.due_date ?? undefined,
    entityId:    row.entity_id ?? null,
    workspaceId: row.workspace_id ?? null,
    note:        row.note ?? undefined,
    color:       row.color ?? undefined,
    difficulty:  row.difficulty ?? undefined,
    createdAt:   row.created_at ?? undefined,
  };
}

function taskToRow(t: AppTask): Record<string, any> {
  const row: Record<string, any> = {
    id:           t.id,
    title:        t.title,
    completed:    t.completed,
  };
  
  // Important: Omit null/undefined fields to avoid schema cache errors 
  // on newly added columns and allow database defaults to kick in for others.
  if (t.dueDate)    row.due_date    = t.dueDate;
  if (t.entityId)   row.entity_id   = t.entityId;
  if (t.workspaceId) row.workspace_id = t.workspaceId;
  if (t.note)       row.note        = t.note;
  if (t.color)      row.color       = t.color;
  if (t.difficulty) row.difficulty  = t.difficulty;
  if (t.createdAt)  row.created_at  = t.createdAt;
  
  return row;
}

// ─── Initial load ─────────────────────────────────────────────────────────────

export async function loadFromSupabase(): Promise<{
  entities:   Entity[];
  tasks:      AppTask[];
  workspaces: Workspace[];
  settings:   Record<string, any>;
} | null> {
  if (!supabase) return null;

  const [{ data: entityRows }, { data: taskRows }, { data: workspaceRows }, { data: settingRows }] =
    await Promise.all([
      supabase!.from('entities').select('*'),
      supabase!.from('tasks').select('*'),
      supabase!.from('workspaces').select('*'),
      supabase!.from('settings').select('*'),
    ]);

  const settings: Record<string, any> = {};
  (settingRows ?? []).forEach((row: any) => {
    settings[row.key] = row.value;
  });

  return {
    entities:   (entityRows   ?? []).map(rowToEntity),
    tasks:      (taskRows     ?? []).map(rowToTask),
    workspaces: (workspaceRows ?? []).map(rowToWorkspace),
    settings,
  };
}

// ─── Upsert / Delete helpers ──────────────────────────────────────────────────

export async function upsertSetting(key: string, value: any) {
  if (!supabase) return;
  const row = settingToRow(key, value);
  const { error } = await supabase
    .from('settings')
    .upsert(row, { onConflict: 'key' });
  
  if (error) console.error('[Flowr sync] upsertSetting:', error.message);
}

export async function upsertWorkspace(workspace: Workspace) {
  if (!supabase) return;
  const row = workspaceToRow(workspace);
  const { error } = await supabase
    .from('workspaces')
    .upsert(row, { onConflict: 'id' });
  if (error) console.error('[Flowr sync] upsertWorkspace:', error.message);
}

export async function deleteWorkspaceFromDB(id: string) {
  if (!supabase) return;
  const { error } = await supabase!.from('workspaces').delete().eq('id', id);
  if (error) console.error('[Flowr sync] deleteWorkspace:', error.message);
}

export async function upsertEntity(entity: Entity) {
  if (!supabase) return;
  const row = entityToRow(entity);
  let { error } = await supabase
    .from('entities')
    .upsert(row, { onConflict: 'id' });
  
  // If the new widget_layout column doesn't exist yet, retry without it
  if (error && error.message.includes('widget_layout')) {
    const fallbackRow = { ...row };
    delete fallbackRow.widget_layout;
    const { error: error2 } = await supabase
      .from('entities')
      .upsert(fallbackRow, { onConflict: 'id' });
    error = error2;
  }
  
  if (error) console.error('[Flowr sync] upsertEntity:', error.message);
}

export async function deleteEntityFromDB(id: string) {
  if (!supabase) return;
  const { error } = await supabase!.from('entities').delete().eq('id', id);
  if (error) console.error('[Flowr sync] deleteEntity:', error.message);
}

export async function upsertTask(task: AppTask) {
  if (!supabase) return;
  const row = taskToRow(task);
  let { error } = await supabase
    .from('tasks')
    .upsert(row, { onConflict: 'id' });

  // If the new workspace_id column doesn't exist yet, retry without it
  if (error && error.message.includes('workspace_id')) {
    const fallbackRow = { ...row };
    delete fallbackRow.workspace_id;
    const { error: error2 } = await supabase
      .from('tasks')
      .upsert(fallbackRow, { onConflict: 'id' });
    error = error2;
  }

  if (error) console.error('[Flowr sync] upsertTask:', error.message);
}

export async function deleteTaskFromDB(id: string) {
  if (!supabase) return;
  const { error } = await supabase!.from('tasks').delete().eq('id', id);
  if (error) console.error('[Flowr sync] deleteTask:', error.message);
}

// ─── Realtime subscriptions ───────────────────────────────────────────────────

type StoreSetters = {
  setEntities:   (entities: Entity[]) => void;
  getEntities:   () => Entity[];
  setTasks:      (tasks: AppTask[]) => void;
  getTasks:      () => AppTask[];
  setWorkspaces: (workspaces: Workspace[]) => void;
  getWorkspaces: () => Workspace[];
};

export function subscribeRealtime(store: StoreSetters) {
  if (!supabase) return () => {};

  const channel = supabase
    .channel('flowr-realtime')

    // ── entities ──
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'entities' },
      ({ new: row }: any) => {
        const entity = rowToEntity(row as Record<string, any>);
        const current = store.getEntities();
        if (!current.find(e => e.id === entity.id)) {
          store.setEntities([...current, entity]);
        }
      }
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'entities' },
      ({ new: row }: any) => {
        const updated = rowToEntity(row as Record<string, any>);
        store.setEntities(
          store.getEntities().map(e => (e.id === updated.id ? updated : e))
        );
      }
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'entities' },
      ({ old: row }: any) => {
        store.setEntities(store.getEntities().filter(e => e.id !== (row as any).id));
      }
    )

    // ── workspaces ──
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'workspaces' },
      ({ new: row }: any) => {
        const ws = rowToWorkspace(row as Record<string, any>);
        const current = store.getWorkspaces();
        if (!current.find(w => w.id === ws.id)) {
          store.setWorkspaces([...current, ws]);
        }
      }
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'workspaces' },
      ({ new: row }: any) => {
        const updated = rowToWorkspace(row as Record<string, any>);
        store.setWorkspaces(
          store.getWorkspaces().map(w => (w.id === updated.id ? updated : w))
        );
      }
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'workspaces' },
      ({ old: row }: any) => {
        store.setWorkspaces(store.getWorkspaces().filter(w => w.id !== (row as any).id));
      }
    )

    // ── tasks ──
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'tasks' },
      ({ new: row }: any) => {
        const task = rowToTask(row as Record<string, any>);
        const current = store.getTasks();
        if (!current.find(t => t.id === task.id)) {
          store.setTasks([...current, task]);
        }
      }
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'tasks' },
      ({ new: row }: any) => {
        const updated = rowToTask(row as Record<string, any>);
        store.setTasks(
          store.getTasks().map(t => (t.id === updated.id ? updated : t))
        );
      }
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'tasks' },
      ({ old: row }: any) => {
        store.setTasks(store.getTasks().filter(t => t.id !== (row as any).id));
      }
    )

    .subscribe();

  return () => {
    supabase!.removeChannel(channel);
  };
}
export async function clearAllDataFromCloud() {
  if (!supabase) return;
  
  // Caution: This is a destructive operation!
  await Promise.all([
    supabase.from('entities').delete().neq('id', '0'), // delete all
    supabase.from('tasks').delete().neq('id', '0'),
    supabase.from('workspaces').delete().neq('id', '0'),
    supabase.from('settings').delete().neq('id', '0'),
  ]);
}
