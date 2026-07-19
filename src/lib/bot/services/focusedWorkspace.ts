import { supabaseAdmin } from '../../supabase'

export type FocusedWorkspace = {
  id: string
  title: string
  description: string | null
}

/**
 * Resolve the workspace the user is currently looking at:
 * - active entity is a workspace → that workspace
 * - active entity is a note/folder/canvas → walk parent_id until a workspace
 * Caps parent walk at 8 to avoid cycles.
 */
export async function resolveFocusedWorkspace(
  userId: string,
  activeEntityId: string | null | undefined
): Promise<FocusedWorkspace | null> {
  if (!userId || !activeEntityId || !supabaseAdmin) return null
  // System tabs / non-entity ids
  if (['dashboard', 'chat', 'tracker', 'brain', 'unsorted'].includes(activeEntityId)) {
    return null
  }

  let id: string | null = activeEntityId
  for (let i = 0; i < 8 && id; i++) {
    const res = await supabaseAdmin
      .from('entities')
      .select('id, title, type, description, parent_id')
      .eq('id', id)
      .eq('owner_id', userId)
      .maybeSingle()

    const data = res.data as {
      id: string
      title: string
      type: string
      description: string | null
      parent_id: string | null
    } | null
    if (res.error || !data) return null
    if (data.type === 'workspace') {
      const desc =
        typeof data.description === 'string' && data.description.trim()
          ? data.description.trim().slice(0, 500)
          : null
      return { id: data.id, title: data.title || 'Workspace', description: desc }
    }
    id = data.parent_id ?? null
  }
  return null
}

/** Compact line for [CURRENT CONTEXT]. Empty string if no focus. */
export function formatFocusedWorkspaceLine(ws: FocusedWorkspace): string {
  const desc = ws.description ? ` — ${ws.description}` : ''
  return `Active workspace: "${ws.title}"${desc}\n(Workspace id: ${ws.id})\n`
}
