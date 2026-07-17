import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isSupabaseEnabled, supabaseUrl, supabaseAnonKey } from '@/lib/supabase'
import {
  listBrain, addBrainNode, updateBrainNode, removeBrainNodes,
  restoreBrainNode, addBrainEdge, removeBrainEdge, compileBrain,
  listUserBrains, createBrain, updateBrainMeta, deleteBrain,
  getOrCreateDefaultBrain, switchActiveBrain, fetchBrainRows,
} from '@/lib/bot/services/brainStore'
import { logger } from '@/lib/logger'

async function authedUserId(req: NextRequest): Promise<string | null> {
  if (!isSupabaseEnabled) return null
  // Use the resolved supabaseUrl (matches this app's real proxy/port setup,
  // see lib/supabase.ts's getSupabaseUrl), NOT the raw NEXT_PUBLIC_SUPABASE_URL
  // env var directly — that raw value can point at the wrong host/port in a
  // server context (e.g. a stale localhost:3000 while the app runs on a
  // different port), which makes auth.getUser() silently fail to validate
  // the token and return no user, producing an unhelpful 401. Matches the
  // already-working pattern in /api/usage/route.ts.
  const supabaseClient = createClient(
    supabaseUrl!,
    supabaseAnonKey!,
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } }
  )
  const { data } = await supabaseClient.auth.getUser()
  return data.user?.id ?? null
}

export async function GET(req: NextRequest) {
  try {
    const userId = await authedUserId(req)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { searchParams } = new URL(req.url)
    const requestedBrainId = searchParams.get('brain_id')

    // Lightweight mode for the sidebar's per-brain node list: raw rows only,
    // skips compileBrain (budget/dropped/broken calc) since the sidebar just
    // needs titles/types to render rows, not the compiled preview.
    if (searchParams.get('nodes_only') === 'true' && requestedBrainId) {
      const { nodes } = await fetchBrainRows(userId, requestedBrainId)
      return NextResponse.json({ brainId: requestedBrainId, nodes })
    }

    const brainId = requestedBrainId || (await getOrCreateDefaultBrain(userId)).id
    const [state, brains] = await Promise.all([
      listBrain(userId, brainId),
      listUserBrains(userId),
    ])
    return NextResponse.json({ ...state, brains })
  } catch (e: any) {
    logger.error('user-brain GET failed:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await authedUserId(req)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await req.json()

    switch (body.action) {
      case 'add_node':
        return NextResponse.json(await addBrainNode(userId, 'user', body.brain_id, body))
      case 'update_node':
        // Safe to pass body.updates straight through: updateBrainNode
        // whitelists to UPDATABLE_NODE_FIELDS internally (mass-assignment
        // guard, see brainStore.ts) — a raw JSON body can't smuggle
        // user_id/type/ref_id/brain_id/etc. into the SET clause. Do not add
        // a second whitelist here; one authoritative chokepoint is the point.
        return NextResponse.json(await updateBrainNode(userId, 'user', body.brain_id, body.node_id, body.updates ?? {}))
      case 'remove_node':
        return NextResponse.json(await removeBrainNodes(userId, 'user', body.brain_id, body.node_ids ?? [body.node_id]))
      case 'restore_node':
        return NextResponse.json(await restoreBrainNode(userId, body.brain_id, body.node_id))
      case 'connect':
        return NextResponse.json(await addBrainEdge(userId, 'user', body.brain_id, body.from, body.to, body.label))
      case 'disconnect':
        return NextResponse.json(await removeBrainEdge(userId, 'user', body.brain_id, body.edge_id))
      case 'recompile': {
        const compiled = await compileBrain(userId, body.brain_id)
        return NextResponse.json({ success: true, tokenCount: compiled.tokenCount, version: compiled.version })
      }
      case 'list_brains':
        return NextResponse.json({ brains: await listUserBrains(userId) })
      case 'create_brain':
        return NextResponse.json(await createBrain(userId, body.title, body.description))
      case 'update_brain':
        return NextResponse.json(await updateBrainMeta(userId, body.brain_id, {
          title: body.title,
          description: body.description,
          icon: body.icon,
        }))
      case 'delete_brain':
        return NextResponse.json(await deleteBrain(userId, body.brain_id))
      case 'switch_active_brain':
        // sessionId here is the chat session's id (same format chainRouter
        // uses, e.g. "chat:<uuid>") — the client sends whatever it already
        // uses to identify the active chat.
        if (!body.session_id) return NextResponse.json({ error: "'session_id' is required" }, { status: 400 })
        return NextResponse.json(await switchActiveBrain(body.session_id, userId, body.brain_id))
      default:
        return NextResponse.json({ error: `Unknown action '${body.action}'` }, { status: 400 })
    }
  } catch (e: any) {
    logger.error('user-brain POST failed:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
