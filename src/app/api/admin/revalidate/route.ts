import { revalidateTag } from 'next/cache'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization')
    const expectedSecret = process.env.ADMIN_SECRET
    if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    // @ts-ignore - Next.js revalidateTag sometimes throws TS errors locally depending on the typescript version
    revalidateTag('router-config')
    
    return NextResponse.json({ 
      success: true, 
      message: 'AI Router Cache busted successfully.',
      timestamp: Date.now() 
    })
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      message: (error as Error).message 
    }, { status: 500 })
  }
}
