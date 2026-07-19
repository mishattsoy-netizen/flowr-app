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
import { isDesktop } from './env';
import type { Entity, AppTask, Space, TaskAttachment } from '@/data/store';

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function getCurrentUserId(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data?.user?.id ?? null;
}

// ─── Self-originated DELETE suppression ─────────────────────────────────────────
//
// When this client deletes a row from the DB (e.g. toggling cloud sync OFF, which
// removes the cloud copy of a now-local-only workspace), Supabase echoes that DELETE
// back to us as a realtime event. Without a guard, the realtime handler would then
// remove the entity from the *local* store as well — destroying data the user only
// meant to make local-only, and overwriting localStorage with the emptied array.
//
// We record each ID we delete ourselves and skip the matching realtime echo exactly
// once. Entries expire after a short window so a genuine *remote* delete of the same
// ID later still propagates.

const SELF_DELETE_TTL_MS = 10_000;
const selfDeletedAt = new Map<string, number>();

export function markSelfDeleted(id: string): void {
  selfDeletedAt.set(id, Date.now());
}

/**
 * Returns true if `id` was deleted by this client within the suppression window,
 * meaning the incoming realtime DELETE is our own echo and should be ignored.
 * Consumes the record so a subsequent real remote delete is not suppressed.
 */
export function consumeSelfDeleteEcho(id: string, now: number = Date.now()): boolean {
  const ts = selfDeletedAt.get(id);
  if (ts === undefined) return false;
  selfDeletedAt.delete(id);
  return now - ts <= SELF_DELETE_TTL_MS;
}

// ─── Row ↔ Store mappers ──────────────────────────────────────────────────────

function parseTimestamp(val: any): number | undefined {
  if (val === undefined || val === null) return undefined;
  if (typeof val === 'number') return val;
  const num = Number(val);
  if (!isNaN(num)) return num;
  const parsed = new Date(val).getTime();
  return isNaN(parsed) ? undefined : parsed;
}

function rowToWorkspace(row: Record<string, any>): Space {
  return {
    id:           row.id,
    name:         row.name,
    type:         row.type ?? 'personal',
    ownerId:      row.owner_id ?? null,
    createdAt:    parseTimestamp(row.created_at) ?? 0,
    lastModified: row.last_modified ?? 0,
    icon:         row.icon ?? undefined,
    color:        row.color ?? undefined,
    settings:     row.settings ?? undefined,
    syncMode:     row.sync_mode ?? 'full-sync',
    isDefault:    row.is_default ?? undefined,
  };
}

function workspaceToRow(w: Space): Record<string, any> {
  const row: Record<string, any> = {
    id:            w.id,
    name:          w.name,
    type:          w.type,
    last_modified: w.lastModified ?? 0,
  };
  if (w.ownerId)  row.owner_id = w.ownerId;
  if (w.icon)     row.icon     = w.icon;
  if (w.color)    row.color    = w.color;
  if (w.settings) row.settings = w.settings;
  if (w.isDefault) row.is_default = true;
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

function tryParseJson(val: string, fallback: any): any {
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
}

function rowToEntity(row: Record<string, any>): Entity {
  const rawContent = (typeof row.content === 'string' ? tryParseJson(row.content, []) : row.content);
  const contentArray = Array.isArray(rawContent) ? rawContent : [];

  return {
    id:           row.id,
    title:        row.title,
    type:         row.type,
    parentId:     row.parent_id ?? null,
    lastModified: row.last_modified ?? 0,
    icon:         row.icon ?? undefined,
    tags:         (typeof row.tags === 'string' ? tryParseJson(row.tags, []) : row.tags) ?? [],
    content:      contentArray,
    widgetLayout: (typeof row.widget_layout === 'string' ? tryParseJson(row.widget_layout, undefined) : row.widget_layout) ?? undefined,
    spaceId:  row.space_id ?? null,
    sortOrder:    row.sort_order ?? undefined,
    syncMode:     row.sync_mode ?? 'full-sync',
    pairedEntityId: row.paired_entity_id ?? null,
    brainOnly:    row.brain_only === true,
    description:  row.description ?? null,
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
    sort_order:    e.sortOrder ?? null,
    brain_only:    e.brainOnly === true,
  };
  if (e.widgetLayout)  row.widget_layout  = e.widgetLayout;
  if (e.spaceId)   row.space_id   = e.spaceId;
  // Always send description so clears persist (null/undefined → empty string).
  row.description = e.description ?? null;
  row.sync_mode = e.syncMode;
  return row;
}

function rowToTask(row: Record<string, any>): AppTask {
  return {
    id:          row.id,
    title:       row.title,
    completed:   row.completed ?? false,
    lastModified: row.last_modified ?? 0,
    dueDate:     row.due_date ?? undefined,
    endDate:     row.end_date ?? undefined,
    includeTime: row.include_time ?? undefined,
    reminder:    row.reminder ?? undefined,
    entityId:    row.entity_id ?? null,
    spaceId: row.space_id ?? null,
    note:        row.note ?? undefined,
    color:       row.color ?? undefined,
    priority:    row.priority ?? undefined,
    subtasks:    (typeof row.subtasks === 'string' ? tryParseJson(row.subtasks, undefined) : row.subtasks) ?? undefined,
    status:      row.status ?? undefined,
    position:    row.position ?? null,
    createdAt:   parseTimestamp(row.created_at),
    completedAt: parseTimestamp(row.completed_at),
    syncMode:    row.sync_mode ?? 'full-sync',
    attachments: (typeof row.attachments === 'string' ? tryParseJson(row.attachments, undefined) : row.attachments) ?? undefined,
    tag:         row.tag ?? undefined,
  };
}

function taskToRow(t: AppTask): Record<string, any> {
  const row: Record<string, any> = {
    id:           t.id,
    title:        t.title,
    completed:    t.completed,
  };
  
  // Include all defined fields so the DB row is always a full reflection of
  // local state. Use explicit null for fields being cleared (e.g. removing a
  // color or moving a task out of a column) so Supabase writes NULL instead of
  // leaving the old value in place.
  row.due_date     = t.dueDate     ?? null;
  row.end_date     = t.endDate     ?? null;
  row.include_time = t.includeTime ?? null;
  row.reminder     = t.reminder    ?? null;
  row.entity_id    = t.entityId    ?? null;
  row.space_id = t.spaceId ?? null;
  row.note         = t.note        ?? null;
  row.color        = t.color       ?? null;
  row.status       = t.status      ?? null;
  row.position     = t.position    ?? null;
  
  if (t.priority !== undefined) {
    row.priority = (t.priority === 'low' || t.priority === 'medium' || t.priority === 'high') 
      ? t.priority 
      : null;
  }
  
  if (t.subtasks)   row.subtasks    = t.subtasks;
  if (t.createdAt) {
    row.created_at = typeof t.createdAt === 'number'
      ? new Date(t.createdAt).toISOString()
      : t.createdAt;
  }
  if (t.completedAt) {
    row.completed_at = typeof t.completedAt === 'number'
      ? t.completedAt
      : new Date(t.completedAt).getTime();
  }
  row.attachments = t.attachments ?? null;
  row.sync_mode = t.syncMode;
  row.tag = t.tag ?? null;
  row.last_modified = t.lastModified ?? 0;

  return row;
}



// ─── Initial load ─────────────────────────────────────────────────────────────

// Web must never see local-only rows — they're a desktop-exclusive concept.
// They can still physically exist in Supabase during the 24h purge grace
// window (see markForPurge), so this filter is the safety net for that
// window rather than something the read query alone can rely on.
export function filterLocalOnlyForWeb<T extends { syncMode: string }>(rows: T[], desktop: boolean): T[] {
  return desktop ? rows : rows.filter(r => r.syncMode !== 'local-only');
}

export async function loadFromSupabase(): Promise<{
  entities:   Entity[];
  tasks:      AppTask[];
  spaces: Space[];
  settings:   Record<string, any>;
} | null> {
  if (!supabase) return null;

  const [entRes, taskRes, spaceRes, setRes] =
    await Promise.all([
      supabase!.from('entities').select('*'),
      supabase!.from('tasks').select('*'),
      supabase!.from('spaces').select('*'),
      supabase!.from('settings').select('*'),
    ]);

  if (entRes.error) console.error('[Flowr sync] Entities error:', entRes.error);
  if (taskRes.error) console.error('[Flowr sync] Tasks error:', taskRes.error);
  if (spaceRes.error) console.error('[Flowr sync] Spaces error:', spaceRes.error);
  if (setRes.error) console.error('[Flowr sync] Settings error:', setRes.error);

  const { data: entityRows } = entRes;
  const { data: taskRows } = taskRes;
  const { data: workspaceRows } = spaceRes;
  const { data: settingRows } = setRes;

  const settings: Record<string, any> = {};
  (settingRows ?? []).forEach((row: any) => {
    settings[row.key] = row.value;
  });

  const desktop = isDesktop();
  return {
    entities:   filterLocalOnlyForWeb((entityRows     ?? []).map(rowToEntity), desktop),
    tasks:      filterLocalOnlyForWeb((taskRows        ?? []).map(rowToTask), desktop),
    spaces:     filterLocalOnlyForWeb((workspaceRows   ?? []).map(rowToWorkspace), desktop),
    settings,
  };
}

export interface DeltaCursors {
  entities: number;
  tasks: number;
  spaces: number;
}

export interface DeltaResult {
  entities: Entity[];
  tasks: AppTask[];
  spaces: Space[];
  settings: Record<string, any>;
  entityIds: Set<string>;
  taskIds: Set<string>;
  spaceIds: Set<string>;
}

/**
 * Delta load: for each table, fetch only rows changed after the cursor
 * (last_modified > cursor) as full rows, PLUS a lightweight `id, last_modified`
 * list of ALL rows. Callers upsert the changed rows and drop any local row
 * whose id is absent from the full id set — this catches deletions (including
 * ones made while this client was offline) without a full-row re-fetch and
 * without tombstones.
 */
export async function loadDeltaFromSupabase(cursors: DeltaCursors): Promise<DeltaResult | null> {
  if (!supabase) return null;

  const [entDelta, entIds, taskDelta, taskIds, spaceDelta, spaceIds, setRes] = await Promise.all([
    supabase!.from('entities').select('*').gt('last_modified', cursors.entities),
    supabase!.from('entities').select('id, last_modified'),
    supabase!.from('tasks').select('*').gt('last_modified', cursors.tasks),
    supabase!.from('tasks').select('id, last_modified'),
    supabase!.from('spaces').select('*').gt('last_modified', cursors.spaces),
    supabase!.from('spaces').select('id, last_modified'),
    supabase!.from('settings').select('*'),
  ]);

  const desktop = isDesktop();
  const settings: Record<string, any> = {};
  (setRes.data ?? []).forEach((row: any) => { settings[row.key] = row.value; });

  return {
    entities: filterLocalOnlyForWeb((entDelta.data ?? []).map(rowToEntity), desktop),
    tasks:    filterLocalOnlyForWeb((taskDelta.data ?? []).map(rowToTask), desktop),
    spaces:   filterLocalOnlyForWeb((spaceDelta.data ?? []).map(rowToWorkspace), desktop),
    settings,
    entityIds: new Set((entIds.data ?? []).map((r: any) => r.id as string)),
    taskIds:   new Set((taskIds.data ?? []).map((r: any) => r.id as string)),
    spaceIds:  new Set((spaceIds.data ?? []).map((r: any) => r.id as string)),
  };
}

// ─── Upsert / Delete helpers ──────────────────────────────────────────────────

export async function upsertSetting(key: string, value: any) {
  if (!supabase) return;
  const userId = await getCurrentUserId();
  if (!userId) return;
  const row = { ...settingToRow(key, value), owner_id: userId };
  const { error } = await supabase
    .from('settings')
    .upsert(row, { onConflict: 'owner_id,key' });

  if (error) {
    // Duplicate key is expected until the settings PK migration runs
    const isDuplicateKey = error.message.includes('duplicate key') || error.message.includes('settings_pkey') || error.message.includes('unique constraint');
    if (!isDuplicateKey) console.error('[Flowr sync] upsertSetting:', error.message);
  }
}

export async function upsertSpace(workspace: Space): Promise<{ error: any }> {
  if (!supabase) return { error: null };
  const userId = await getCurrentUserId();
  if (!userId) return { error: null };
  const row = { ...workspaceToRow(workspace), owner_id: userId };

  async function performUpsert(currentRow: Record<string, any>): Promise<{ error: any }> {
    const result = await supabase!.from('spaces').upsert(currentRow, { onConflict: 'id' });

    // Only retry on missing-column errors (helps during incremental schema rollouts).
    const isColumnError = result.error && result.error.message.includes('column') && result.error.message.includes('not find');

    if (result.error && isColumnError) {
      const match = result.error.message.match(/'([^']+)'/);
      const missingColumn = match ? match[1] : null;

      if (missingColumn && currentRow[missingColumn] !== undefined) {
        console.warn(`[Flowr sync] Column '${missingColumn}' missing in 'spaces' table. Retrying without it.`);
        const nextRow = { ...currentRow };
        delete nextRow[missingColumn];
        return performUpsert(nextRow);
      }
    }
    return result;
  }

  const { error } = await performUpsert(row);
  if (error) {
    // RLS violations are expected when a row belongs to another user (e.g. ws-personal).
    const isRls = error.message.includes('row-level security');
    if (!isRls) console.error('[Flowr sync] upsertSpace:', error.message);
  }
  return { error };
}

export async function deleteSpaceFromDB(id: string) {
  if (!supabase) return;
  markSelfDeleted(id);
  const { error } = await supabase!.from('spaces').delete().eq('id', id);
  if (error) console.error('[Flowr sync] deleteSpace:', error.message);
}

export async function upsertEntity(entity: Entity): Promise<{ error: any }> {
  if (!supabase) return { error: null };
  const userId = await getCurrentUserId();
  if (!userId) return { error: null };
  const row = { ...entityToRow(entity), owner_id: userId };

  async function performUpsert(currentRow: Record<string, any>): Promise<{ error: any }> {
    const result = await supabase!.from('entities').upsert(currentRow, { onConflict: 'id' });

    // Only retry on missing-column errors (helps during incremental schema rollouts).
    // FK violations are no longer swallowed — they indicate real data bugs and must surface.
    const isColumnError = result.error && result.error.message.includes('column') && result.error.message.includes('not find');

    if (result.error && isColumnError) {
      const match = result.error.message.match(/'([^']+)'/);
      const missingColumn = match ? match[1] : null;

      if (missingColumn && currentRow[missingColumn] !== undefined) {
        console.warn(`[Flowr sync] Column '${missingColumn}' missing in 'entities' table. Retrying without it.`);
        const nextRow = { ...currentRow };
        delete nextRow[missingColumn];
        return performUpsert(nextRow);
      }
    }
    return result;
  }

  const { error } = await performUpsert(row);
  if (error) {
    const isRls = error.message.includes('row-level security');
    if (!isRls) console.error('[Flowr sync] upsertEntity:', error.message);
  }
  return { error };
}

export async function deleteEntityFromDB(id: string): Promise<{ error: any }> {
  if (!supabase) return { error: null };
  markSelfDeleted(id);
  const { error } = await supabase!.from('entities').delete().eq('id', id);
  if (error) {
    const isFk = error.message.includes('foreign key constraint');
    if (!isFk) console.error('[Flowr sync] deleteEntity:', error.message);
  }
  return { error };
}

export async function upsertTask(task: AppTask): Promise<{ error: any }> {
  if (!supabase) return { error: null };
  const userId = await getCurrentUserId();
  if (!userId) return { error: null };
  const row = { ...taskToRow(task), owner_id: userId };
  
  async function performUpsert(currentRow: Record<string, any>): Promise<{ error: any }> {
    const result = await supabase!.from('tasks').upsert(currentRow, { onConflict: 'id' });

    // Only retry on missing-column errors (helps during incremental schema rollouts).
    // FK violations are no longer swallowed — they indicate real data bugs and must surface.
    const isColumnError = result.error && result.error.message.includes('column') && result.error.message.includes('not find');

    if (result.error && isColumnError) {
      const match = result.error.message.match(/'([^']+)'/);
      const missingColumn = match ? match[1] : null;

      if (missingColumn && currentRow[missingColumn] !== undefined) {
        console.warn(`[Flowr sync] Column '${missingColumn}' missing in 'tasks' table. Retrying without it.`);
        const nextRow = { ...currentRow };
        delete nextRow[missingColumn];
        return performUpsert(nextRow);
      }
    }
    return result;
  }

  const { error } = await performUpsert(row);
  if (error) {
    const isRls = error.message.includes('row-level security');
    const isFk = error.message.includes('foreign key constraint');
    if (!isRls && !isFk) console.error('[Flowr sync] upsertTask:', error.message);
  }
  return { error };
}

export async function deleteTaskFromDB(id: string): Promise<{ error: any }> {
  if (!supabase) return { error: null };
  markSelfDeleted(id);
  const { error } = await supabase!.from('tasks').delete().eq('id', id);
  if (error) console.error('[Flowr sync] deleteTask:', error.message);
  return { error };
}

// ─── Local-only purge (grace period) ─────────────────────────────────────────
//
// Every normal push path (debouncedPush*, saveEntity) is hard-suppressed for
// local-only rows — that's how local-only stays out of the cloud during
// day-to-day edits. But that same suppression means flipping a row to
// local-only through the normal path never informs Supabase at all: the
// cloud row would silently keep its OLD sync_mode forever.
//
// markForPurge/clearPurge are the only functions allowed to write local-only
// state to Supabase. They bypass the debounced push path on purpose.

export const PURGE_GRACE_MS = 24 * 60 * 60 * 1000;

export interface PurgeTargets {
  entityIds: string[];
  taskIds: string[];
  spaceIds?: string[];
}

export async function markForPurge(targets: PurgeTargets): Promise<{ error: any }> {
  if (!supabase) return { error: null };
  const purgeAt = new Date(Date.now() + PURGE_GRACE_MS).toISOString();
  const values = { sync_mode: 'local-only', purge_at: purgeAt };
  const ops: Promise<{ error: any }>[] = [];
  if (targets.entityIds.length) ops.push(supabase.from('entities').update(values).in('id', targets.entityIds));
  if (targets.taskIds.length)   ops.push(supabase.from('tasks').update(values).in('id', targets.taskIds));
  // spaces has no sync_mode column (see workspaceToRow) — only purge_at applies.
  if (targets.spaceIds?.length) ops.push(supabase.from('spaces').update({ purge_at: purgeAt }).in('id', targets.spaceIds));
  const results = await Promise.all(ops);
  const firstError = results.find(r => r.error)?.error ?? null;
  if (firstError) console.error('[Flowr sync] markForPurge:', firstError.message);
  return { error: firstError };
}

export async function clearPurge(targets: PurgeTargets, newMode: 'cloud-only' | 'full-sync'): Promise<{ error: any }> {
  if (!supabase) return { error: null };
  const values = { sync_mode: newMode, purge_at: null };
  const ops: Promise<{ error: any }>[] = [];
  if (targets.entityIds.length) ops.push(supabase.from('entities').update(values).in('id', targets.entityIds));
  if (targets.taskIds.length)   ops.push(supabase.from('tasks').update(values).in('id', targets.taskIds));
  // spaces has no sync_mode column (see workspaceToRow) — only purge_at applies.
  if (targets.spaceIds?.length) ops.push(supabase.from('spaces').update({ purge_at: null }).in('id', targets.spaceIds));
  const results = await Promise.all(ops);
  const firstError = results.find(r => r.error)?.error ?? null;
  if (firstError) console.error('[Flowr sync] clearPurge:', firstError.message);
  return { error: firstError };
}

// ─── Realtime subscriptions ───────────────────────────────────────────────────

type StoreSetters = {
  setEntities:   (entities: Entity[]) => void;
  getEntities:   () => Entity[];
  setTasks:      (tasks: AppTask[]) => void;
  getTasks:      () => AppTask[];
  setSpaces: (spaces: Space[]) => void;
  getWorkspaces: () => Space[];
  setShortcutsState: (shortcuts: Record<string, any>) => void;
};

export function subscribeRealtime(store: StoreSetters) {
  if (!supabase) return () => {};

  const channel = supabase
    .channel('flowr-realtime')

    // ── settings ──
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'settings' },
      ({ new: row }: any) => {
        if (row && row.key === 'shortcuts' && row.value) {
          store.setShortcutsState(row.value);
        }
        if (row && row.key === 'recentEntityIds' && row.value) {
          import('@/data/store').then(({ useStore }) => useStore.setState({ recentEntityIds: row.value }));
        }
      }
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'settings' },
      ({ new: row }: any) => {
        if (row && row.key === 'shortcuts' && row.value) {
          store.setShortcutsState(row.value);
        }
        if (row && row.key === 'recentEntityIds' && row.value) {
          import('@/data/store').then(({ useStore }) => useStore.setState({ recentEntityIds: row.value }));
        }
      }
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'settings' },
      ({ old: row }: any) => {
        if (row && (row as any).key === 'shortcuts') {
          store.setShortcutsState({});
        }
        if (row && (row as any).key === 'recentEntityIds') {
          import('@/data/store').then(({ useStore }) => useStore.setState({ recentEntityIds: [] }));
        }
      }
    )

    // ── entities ──
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'entities' },
      ({ new: row }: any) => {
        const entity = rowToEntity(row as Record<string, any>);
        if (!isDesktop() && entity.syncMode === 'local-only') return;
        const current = store.getEntities();
        const existing = current.find(e => e.id === entity.id);
        if (!existing) {
          // New entity from another device
          store.setEntities([...current, entity]);
        }
      }
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'entities' },
      ({ new: row }: any) => {
        const incoming = rowToEntity(row as Record<string, any>);
        if (!isDesktop() && incoming.syncMode === 'local-only') {
          // A workspace just went local-only from another device (or this one).
          // Web must never show local-only — treat this update as a removal.
          store.setEntities(store.getEntities().filter(e => e.id !== incoming.id));
          return;
        }
        store.setEntities(
          store.getEntities().map(e => {
            if (e.id !== incoming.id) return e;
            // Skip if our local copy is newer (we just made the change).
            if ((e.lastModified ?? 0) > (incoming.lastModified ?? 0)) return e;
            return incoming;
          })
        );
      }
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'entities' },
      ({ old: row }: any) => {
        const id = (row as any).id;
        // Ignore our own delete echo — the user may have toggled this workspace to
        // local-only, which removes the cloud copy but must NOT wipe local data.
        if (consumeSelfDeleteEcho(id)) return;
        store.setEntities(store.getEntities().filter(e => e.id !== id));
      }
    )

    // ── spaces ──
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'spaces' },
      ({ new: row }: any) => {
        const ws = rowToWorkspace(row as Record<string, any>);
        if (!isDesktop() && ws.syncMode === 'local-only') return;
        const current = store.getWorkspaces();
        if (!current.find(w => w.id === ws.id)) {
          store.setSpaces([...current, ws]);
        }
      }
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'spaces' },
      ({ new: row }: any) => {
        const incoming = rowToWorkspace(row as Record<string, any>);
        if (!isDesktop() && incoming.syncMode === 'local-only') {
          store.setSpaces(store.getWorkspaces().filter(w => w.id !== incoming.id));
          return;
        }
        store.setSpaces(
          store.getWorkspaces().map(w => {
            if (w.id !== incoming.id) return w;
            return incoming;
          })
        );
      }
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'spaces' },
      ({ old: row }: any) => {
        const id = (row as any).id;
        if (consumeSelfDeleteEcho(id)) return;
        store.setSpaces(store.getWorkspaces().filter(w => w.id !== id));
      }
    )

    // ── tasks ──
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'tasks' },
      ({ new: row }: any) => {
        const task = rowToTask(row as Record<string, any>);
        if (!isDesktop() && task.syncMode === 'local-only') return;
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
        if (!isDesktop() && updated.syncMode === 'local-only') {
          store.setTasks(store.getTasks().filter(t => t.id !== updated.id));
          return;
        }
        store.setTasks(
          store.getTasks().map(t => {
            if (t.id !== updated.id) return t;
            // Merge: DB row wins for all mapped fields, but we preserve any
            // local-only fields (e.g. optimistic fields not yet in DB schema)
            return { ...t, ...updated };
          })
        );
      }
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'tasks' },
      ({ old: row }: any) => {
        const id = (row as any).id;
        // Ignore our own delete echo — disabling a workspace's cloud sync removes its
        // tasks from the DB but must NOT wipe the local copy.
        if (consumeSelfDeleteEcho(id)) return;
        store.setTasks(store.getTasks().filter(t => t.id !== id));
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
    supabase.from('spaces').delete().neq('id', '0'),
    supabase.from('settings').delete().neq('id', '0'),
  ]);
}
