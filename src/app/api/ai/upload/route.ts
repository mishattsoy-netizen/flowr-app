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

    const commaIndex = dataUrl.indexOf(',')
    if (commaIndex === -1) {
      return NextResponse.json({ error: 'Invalid data URL format' }, { status: 400 })
    }

    const header = dataUrl.substring(0, commaIndex)
    const base64Data = dataUrl.substring(commaIndex + 1)

    if (!header.startsWith('data:') || !header.endsWith(';base64')) {
      return NextResponse.json({ error: 'Invalid data URL format' }, { status: 400 })
    }

    const mimeType = header.substring(5, header.length - 7)
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
