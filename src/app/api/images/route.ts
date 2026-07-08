import { NextRequest, NextResponse } from 'next/server'

const SUPABASE_PROJECT_URL = 'https://qmufalwubepttjxehvit.supabase.co'

export async function GET(req: NextRequest) {
  const filename = req.nextUrl.searchParams.get('file')
  if (!filename) {
    return NextResponse.json({ error: 'file query param required' }, { status: 400 })
  }

  const url = `${SUPABASE_PROJECT_URL}/storage/v1/object/public/generated_images/${filename}`
  try {
    const res = await fetch(url)
    if (!res.ok) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 })
    }

    const blob = await res.blob()
    return new NextResponse(blob, {
      headers: {
        'Content-Type': res.headers.get('Content-Type') || 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch image' }, { status: 500 })
  }
}
