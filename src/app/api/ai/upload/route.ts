import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { supabaseAdmin, isSupabaseEnabled } from '@/lib/supabase'

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

    if (isSupabaseEnabled && supabaseAdmin) {
      // Ensure bucket exists
      const { data: buckets } = await supabaseAdmin.storage.listBuckets();
      const hasBucket = buckets?.some((b: any) => b.name === 'user_uploads');
      if (!hasBucket) {
        await supabaseAdmin.storage.createBucket('user_uploads', {
          public: true,
          fileSizeLimit: 10485760,
        }).catch(() => {});
      }
      const { error: uploadError } = await supabaseAdmin.storage
        .from('user_uploads')
        .upload(filename, buffer, {
          contentType: mimeType,
          cacheControl: '31536000',
          upsert: false,
        });
      
      if (!uploadError) {
        return NextResponse.json({ url: `/api/images?file=${filename}` })
      } else {
        console.error('[Upload API] Supabase upload error:', uploadError);
      }
    }

    // Local disk fallback only helps on a persistent filesystem (desktop/dev).
    // On serverless (Vercel), writes land in an ephemeral copy that's gone by
    // the next invocation, so the returned /user_uploads/... URL 404s on the
    // very next page load. Try it, but if it's not durable, use a self-contained
    // data URL instead — same pattern as the generated-image upload fallback.
    try {
      const publicDir = path.join(process.cwd(), 'public', 'user_uploads')
      if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true })
      }

      const filePath = path.join(publicDir, filename)
      fs.writeFileSync(filePath, buffer)

      if (process.env.VERCEL) {
        return NextResponse.json({ url: dataUrl });
      }

      const relativeUrl = `/user_uploads/${filename}`
      return NextResponse.json({ url: relativeUrl })
    } catch (fsError) {
      console.warn('[Upload API] Local write failed, falling back to data URL', fsError);
      return NextResponse.json({ url: dataUrl });
    }

  } catch (error: any) {
    console.error('[Upload API] Error saving file upload:', error)
    return NextResponse.json({ error: error.message || 'Upload failed' }, { status: 500 })
  }
}
