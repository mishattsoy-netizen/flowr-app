import { NextRequest, NextResponse } from 'next/server'
import { getSessionState } from '@/lib/bot/context'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  let chatId = searchParams.get('chatId')

  if (!chatId) {
    return NextResponse.json({ error: 'chatId is required' }, { status: 400 })
  }

  try {
    const sessionState = await getSessionState(chatId)
    return NextResponse.json(sessionState)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
