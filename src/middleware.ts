import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/utils/supabase/middleware'

export async function middleware(request: NextRequest) {
  const supabaseUrl = 'https://qmufalwubepttjxehvit.supabase.co'
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.next()
  }

  // Pass invite pages through — they handle their own validation
  if (request.nextUrl.pathname.startsWith('/invite')) {
    return NextResponse.next()
  }

  const { supabase, supabaseResponse } = await createClient(request)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isAdminPath = request.nextUrl.pathname.startsWith('/admin')
  const isLoginPath = request.nextUrl.pathname === '/login'
  const isGuestPath = request.nextUrl.searchParams.has('guest')
  const isRootOrApp = request.nextUrl.pathname === '/' || request.nextUrl.pathname === '/app' || request.nextUrl.pathname === '/welcome'
  const isAuthCallbackPath = request.nextUrl.pathname === '/auth/callback'

  if (!user && !isLoginPath && !isGuestPath && !isAuthCallbackPath) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    if (!isRootOrApp) {
      url.searchParams.set('redirect', request.nextUrl.pathname)
    }
    return NextResponse.redirect(url)
  }

  if (user && isLoginPath) {
    if (request.nextUrl.searchParams.get('error') !== 'not_invited') {
      const url = request.nextUrl.clone()
      url.pathname = '/app'
      return NextResponse.redirect(url)
    }
  }

  // Block authenticated users who are not beta-approved
  if (user && isRootOrApp && serviceKey) {
    const { createClient: createAdminClient } = await import('@supabase/supabase-js')
    const adminClient = createAdminClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    })
    const { data: approved } = await adminClient
      .from('beta_approved_users')
      .select('email')
      .eq('email', user.email)
      .maybeSingle()

    if (!approved) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('error', 'not_invited')
      return NextResponse.redirect(url)
    }
  }

  if (user && isAdminPath && serviceKey) {
    const { createClient: createAdminClient } = await import('@supabase/supabase-js')
    const adminClient = createAdminClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    })
    const { data: adminData } = await adminClient
      .from('admins')
      .select('email')
      .eq('email', user.email)
      .single()

    if (!adminData) {
      const url = request.nextUrl.clone()
      url.pathname = '/app'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/admin/:path*', '/login', '/', '/app', '/invite/:path*', '/welcome'],
}
