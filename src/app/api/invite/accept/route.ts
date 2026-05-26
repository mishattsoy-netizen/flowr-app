import { NextRequest, NextResponse } from 'next/server'
import { validateInviteToken } from '@/lib/beta'

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')

  if (!token) {
    return NextResponse.redirect(new URL('/login?error=auth_failed', request.url))
  }

  const valid = await validateInviteToken(token)
  if (!valid) {
    return NextResponse.redirect(new URL('/login?error=not_invited', request.url))
  }

  const response = NextResponse.redirect(new URL('/login', request.url))
  response.cookies.set('beta_invite_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60,
    path: '/',
    sameSite: 'lax',
  })
  return response
}
