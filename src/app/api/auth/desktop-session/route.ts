import { NextResponse } from 'next/server'

// In-memory session store (resides in memory of Next.js server process)
let savedSession: any = null

export async function GET() {
  if (savedSession) {
    const session = savedSession
    savedSession = null // Clear after reading once
    return NextResponse.json({ session })
  }
  return NextResponse.json({ session: null })
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    savedSession = body
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ success: false }, { status: 400 })
  }
}
