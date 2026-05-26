'use server'

import { cookies } from 'next/headers'

export async function acceptInvite(token: string) {
  const cookieStore = await cookies()
  cookieStore.set('beta_invite_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60,
    path: '/',
    sameSite: 'lax',
  })
}
