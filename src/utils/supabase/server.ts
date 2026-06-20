import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const url = rawUrl && rawUrl.includes('flowr.website')
    ? 'https://qmufalwubepttjxehvit.supabase.co'
    : rawUrl;

  return createServerClient(
    url,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
      cookieOptions: {
        name: 'sb-flowr-auth',
      },
    }
  )
}
