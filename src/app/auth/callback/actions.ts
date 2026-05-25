'use server'

import { cookies } from 'next/headers'
import { consumeInvite, isApprovedUser } from '@/lib/beta'

export async function processInviteAfterAuth(email: string): Promise<'approved' | 'rejected' | 'already_approved'> {
  const cookieStore = await cookies()
  const token = cookieStore.get('beta_invite_token')?.value

  if (token) {
    const error = await consumeInvite(token, email)
    cookieStore.delete('beta_invite_token')
    if (error) {
      const approved = await isApprovedUser(email)
      return approved ? 'already_approved' : 'rejected'
    }
    return 'approved'
  }

  const approved = await isApprovedUser(email)
  return approved ? 'already_approved' : 'rejected'
}
