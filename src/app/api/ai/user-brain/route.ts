import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isSupabaseEnabled } from '@/lib/supabase'
import {
  listBrain, addBrainNode, updateBrainNode, removeBrainNodes,
  restoreBrainNode, addBrainEdge, removeBrainEdge, compileBrain,
} from '@/lib/bot/services/brainStore'
import { logger } from '@/lib/logger'

async function authedUserId(req: NextRequest): Promise<string | null> {
  if (!isSupabaseEnabled) return null
  const supabaseClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } }
  )
  const { data } = await supabaseClient.auth.getUser()
  return data.user?.id ?? null
}

export async function GET(req: NextRequest) {
  try {
    const userId = await authedUserId(req)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json(await listBrain(userId))
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
        return NextResponse.json(await addBrainNode(userId, 'user', body))
      case 'update_node':
        // Safe to pass body.updates straight through: updateBrainNode
        // whitelists to UPDATABLE_NODE_FIELDS internally (mass-assignment
        // guard, see brainStore.ts) — a raw JSON body can't smuggle
        // user_id/type/ref_id/etc. into the SET clause. Do not add a
        // second whitelist here; one authoritative chokepoint is the point.
        return NextResponse.json(await updateBrainNode(userId, 'user', body.node_id, body.updates ?? {}))
      case 'remove_node':
        return NextResponse.json(await removeBrainNodes(userId, 'user', body.node_ids ?? [body.node_id]))
      case 'restore_node':
        return NextResponse.json(await restoreBrainNode(userId, body.node_id))
      case 'connect':
        return NextResponse.json(await addBrainEdge(userId, 'user', body.from, body.to, body.label))
      case 'disconnect':
        return NextResponse.json(await removeBrainEdge(userId, 'user', body.edge_id))
      case 'recompile': {
        const compiled = await compileBrain(userId)
        return NextResponse.json({ success: true, tokenCount: compiled.tokenCount, version: compiled.version })
      }
      default:
        return NextResponse.json({ error: `Unknown action '${body.action}'` }, { status: 400 })
    }
  } catch (e: any) {
    logger.error('user-brain POST failed:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
