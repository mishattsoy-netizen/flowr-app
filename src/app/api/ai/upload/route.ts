import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  try {
    const { name, type, dataUrl } = await req.json()

    if (!dataUrl || !dataUrl.startsWith('data:')) {
      return NextResponse.json({ error: 'Invalid file data' }, { status: 400 })
    }

    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
    if (!match) {
      return NextResponse.json({ error: 'Invalid data URL format' }, { status: 400 })
    }

    const mimeType = match[1]
    const base64Data = match[2]
    const buffer = Buffer.from(base64Data, 'base64')

    // Determine extension safely
    const ext = name?.split('.').pop() || mimeType.split('/')[1] || 'bin'
    const safeExt = ext.replace(/[^a-zA-Z0-9]/g, '')
    const filename = `upload-${Date.now()}-${crypto.randomUUID()}.${safeExt}`

    const publicDir = path.join(process.cwd(), 'public', 'user_uploads')
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true })
    }

    const filePath = path.join(publicDir, filename)
    fs.writeFileSync(filePath, buffer)

    const relativeUrl = `/user_uploads/${filename}`
    return NextResponse.json({ url: relativeUrl })
  } catch (error: any) {
    console.error('[Upload API] Error saving file upload:', error)
    return NextResponse.json({ error: error.message || 'Upload failed' }, { status: 500 })
  }
}
