import { supabase } from './supabase';
import type { EditorBlock, CanvasStyleExt } from '@/data/store';
import { activeDragOffsets } from '@/lib/canvasDragState';

// ─── Row ↔ store mappers ──────────────────────────────────────────────────────

function blockToRow(b: EditorBlock, userId: string, workspaceId: string): Record<string, unknown> {
  const dbStyle = {
    ...(b.canvasStyleExt ?? {}),
    startArrowhead: b.startArrowhead,
    endArrowhead: b.endArrowhead,
    editMode: b.editMode,
    pointRadiuses: b.pointRadiuses,
    startBinding: b.startBinding,
    endBinding: b.endBinding,
  };
  return {
    id:           b.id,
    canvas_id:    b.canvasId!,
    user_id:      userId,
    space_id:     workspaceId,
    type:         b.type,
    shape_kind:   b.shapeKind ?? null,
    x:            b.x ?? null,
    y:            b.y ?? null,
    width:        b.width ?? null,
    height:       b.height ?? null,
    content:      b.content ?? null,
    style:        dbStyle,
    points:       b.points ?? null,
    parent_id:    b.parentId ?? null,
    z_index:      b.zIndex ?? 0,
    group_id:     b.groupId ?? null,
    updated_at:   new Date().toISOString(),
  };
}

function rowToBlock(row: Record<string, unknown>): EditorBlock {
  const dbStyle = (row.style as any) ?? {};
  const { startArrowhead, endArrowhead, editMode, pointRadiuses, startBinding, endBinding, ...canvasStyleExt } = dbStyle;
  return {
    id:             row.id as string,
    canvasId:       row.canvas_id as string,
    type:           row.type as EditorBlock['type'],
    content:        (row.content as string) ?? '',
    shapeKind:      (row.shape_kind as EditorBlock['shapeKind']) ?? undefined,
    x:              (row.x as number) ?? 0,
    y:              (row.y as number) ?? 0,
    width:          (row.width as number) ?? undefined,
    height:         (row.height as number) ?? undefined,
    canvasStyleExt: Object.keys(canvasStyleExt).length > 0 ? canvasStyleExt : undefined,
    points:         (row.points as [number, number][]) ?? undefined,
    parentId:       (row.parent_id as string) ?? undefined,
    zIndex:         (row.z_index as number) ?? undefined,
    groupId:        (row.group_id as string) ?? undefined,
    startArrowhead: startArrowhead ?? undefined,
    endArrowhead:   endArrowhead ?? undefined,
    editMode:       editMode ?? undefined,
    pointRadiuses:  pointRadiuses ?? undefined,
    startBinding:   startBinding ?? undefined,
    endBinding:     endBinding ?? undefined,
  };
}

// ─── Debounce ─────────────────────────────────────────────────────────────────

const pendingUpserts = new Map<string, ReturnType<typeof setTimeout>>();
// Rows queued behind the debounce, kept alongside the timer so a flush (page hide/unload) can
// write them immediately instead of losing them when the timer never gets to fire.
const pendingRows = new Map<string, Record<string, unknown>>();

async function writeRow(row: Record<string, unknown>): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('canvas_blocks').upsert(row, { onConflict: 'id' });
  if (error) console.error('[canvasSync] upsertCanvasBlock', error.message, error.details, error.hint, error.code);
}

/**
 * Same upsert as writeRow, but issued with `fetch(..., { keepalive: true })` so the browser
 * finishes sending it even after the page has started tearing down (normal supabase-js
 * requests get aborted by the tab close/reload before their promise ever resolves). Auth is
 * read synchronously from the same client's already-restored local session — no network round
 * trip — so this stays fast enough to fire from a `pagehide`/`visibilitychange` handler.
 */
async function writeRowKeepalive(row: Record<string, unknown>): Promise<void> {
  if (!supabase) return;
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const apikey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const baseUrl = (supabase as any).supabaseUrl as string | undefined;
  if (!token || !apikey || !baseUrl) {
    // Fall back to the regular client — best effort, may not survive teardown.
    return writeRow(row);
  }
  try {
    await fetch(`${baseUrl}/rest/v1/canvas_blocks?on_conflict=id`, {
      method: 'POST',
      keepalive: true,
      headers: {
        'Content-Type': 'application/json',
        apikey,
        Authorization: `Bearer ${token}`,
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify([row]),
    });
  } catch (e) {
    console.error('[canvasSync] writeRowKeepalive', e);
  }
}

export async function upsertCanvasBlock(
  block: EditorBlock, userId?: string, workspaceId?: string
): Promise<void> {
  if (!supabase || !block.canvasId) return;
  const existing = pendingUpserts.get(block.id);
  if (existing) clearTimeout(existing);

  let resolvedUid = userId;
  if (!resolvedUid) {
    const { data } = await supabase.auth.getUser();
    resolvedUid = data?.user?.id;
  }
  if (!resolvedUid) return;

  let resolvedWsId: string = workspaceId || 'ws-personal';
  if (!workspaceId) {
    const { data } = await supabase
      .from('entities')
      .select('space_id')
      .eq('id', block.canvasId)
      .single();
    if (data?.space_id) {
      resolvedWsId = data.space_id;
    }
  }

  const row = blockToRow(block, resolvedUid, resolvedWsId);
  pendingRows.set(block.id, row);
  pendingUpserts.set(block.id, setTimeout(() => {
    pendingUpserts.delete(block.id);
    pendingRows.delete(block.id);
    writeRow(row);
  }, 300));
}

/**
 * Writes every debounced-but-not-yet-sent block immediately. A hard refresh/tab close tears
 * down the page well before a 300ms debounce timer fires, silently dropping the write (the
 * edit looks saved locally, then reverts once the next session's initial load overwrites it
 * with the last row that actually reached Supabase). Call this from a `pagehide`/
 * `visibilitychange` listener so the pending edit lands before that can happen.
 */
export function flushPendingCanvasUpserts(): void {
  if (pendingRows.size === 0) return;
  for (const timer of pendingUpserts.values()) clearTimeout(timer);
  pendingUpserts.clear();
  const rows = [...pendingRows.values()];
  pendingRows.clear();
  for (const row of rows) writeRowKeepalive(row);
}

export async function deleteCanvasBlock(blockId: string): Promise<void> {
  if (!supabase) return;
  const pending = pendingUpserts.get(blockId);
  if (pending) { clearTimeout(pending); pendingUpserts.delete(blockId); }
  const { error } = await supabase.from('canvas_blocks').delete().eq('id', blockId);
  if (error) console.error('[canvasSync] deleteCanvasBlock', error);
}

export async function loadCanvasBlocks(canvasId: string): Promise<EditorBlock[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('canvas_blocks')
    .select('*')
    .eq('canvas_id', canvasId);
  if (error) { console.error('[canvasSync] loadCanvasBlocks', error); return []; }
  return (data ?? []).map(rowToBlock);
}

// ─── Realtime subscription ────────────────────────────────────────────────────

type OnChange = (blocks: EditorBlock[]) => void;

export function subscribeCanvasBlocks(
  canvasId: string,
  getCurrentBlocks: () => EditorBlock[],
  onChange: OnChange
): () => void {
  if (!supabase) return () => {};

  let currentUserId: string | null = null;
  supabase.auth.getUser().then((res: any) => {
    currentUserId = res?.data?.user?.id || null;
  });

  const channel = supabase
    .channel(`canvas_blocks:${canvasId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'canvas_blocks', filter: `canvas_id=eq.${canvasId}` },
      (payload: { eventType: string; old: Record<string, unknown>; new: Record<string, unknown> }) => {
        // Skip updates initiated by the current user to prevent self-conflict loopbacks
        if (payload.eventType !== 'DELETE' && payload.new && payload.new.user_id === currentUserId) {
          return;
        }

        const incoming = payload.eventType !== 'DELETE' ? rowToBlock(payload.new as Record<string, unknown>) : null;

        // Skip updates for elements currently being dragged by this user
        if (incoming && activeDragOffsets.has(incoming.id)) {
          return;
        }

        const current = getCurrentBlocks();
        if (payload.eventType === 'DELETE') {
          onChange(current.filter(b => b.id !== (payload.old as Record<string, unknown>).id));
        } else {
          if (!incoming) return;
          const idx = current.findIndex(b => b.id === incoming.id);
          if (idx === -1) {
            onChange([...current, incoming]);
          } else {
            const next = [...current];
            next[idx] = incoming;
            onChange(next);
          }
        }
      }
    )
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}
