import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function createClient(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const url = 'https://qmufalwubepttjxehvit.supabase.co';

  const supabase = createServerClient(
    url,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
      cookieOptions: {
        name: 'sb-flowr-auth',
      },
    }
  )

  return { supabase, supabaseResponse }
}
