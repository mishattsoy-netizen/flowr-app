import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { validateInviteToken } from '@/lib/beta'

interface Props {
  params: Promise<{ token: string }>
}

export default async function InvitePage({ params }: Props) {
  const { token } = await params
  const valid = await validateInviteToken(token)

  if (!valid) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center max-w-sm px-6">
          <h1 className="text-2xl font-display font-medium text-foreground mb-2">Invalid Invite</h1>
          <p className="text-sm text-muted-foreground">
            This invite link is invalid or has already been used. Ask for a new one.
          </p>
        </div>
      </div>
    )
  }

  const cookieStore = await cookies()
  cookieStore.set('beta_invite_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60, // 1 hour
    path: '/',
    sameSite: 'lax',
  })

  redirect('/login')
}
