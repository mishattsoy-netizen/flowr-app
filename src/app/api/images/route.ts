import { NextRequest, NextResponse } from 'next/server'

const SUPABASE_PROJECT_URL = 'https://qmufalwubepttjxehvit.supabase.co'

// Matches exactly the filenames this app generates: (ai|upload)-<timestamp>-<uuid>.<ext>
// (see src/app/api/ai/chat/route.ts and src/app/api/ai/upload/route.ts).
const SAFE_FILENAME = /^(ai|upload)-\d+-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpe?g|gif|webp)$/i

const ALLOWED_CONTENT_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
}

export async function GET(req: NextRequest) {
  const filename = req.nextUrl.searchParams.get('file')
  if (!filename) {
    return NextResponse.json({ error: 'file query param required' }, { status: 400 })
  }
  if (!SAFE_FILENAME.test(filename)) {
    return NextResponse.json({ error: 'Invalid file parameter' }, { status: 400 })
  }

  const ext = filename.split('.').pop()!.toLowerCase()
  const contentType = ALLOWED_CONTENT_TYPES[ext] || 'application/octet-stream'

  const bucketName = filename.startsWith('upload-') ? 'user_uploads' : 'generated_images'
  const url = `${SUPABASE_PROJECT_URL}/storage/v1/object/public/${bucketName}/${encodeURIComponent(filename)}`
  try {
    const res = await fetch(url)
    if (!res.ok) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 })
    }

    const blob = await res.blob()
    return new NextResponse(blob, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Content-Security-Policy': "default-src 'none'",
      },
    })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch image' }, { status: 500 })
  }
}
