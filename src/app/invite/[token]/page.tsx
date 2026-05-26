import { redirect } from 'next/navigation'
import { validateInviteToken } from '@/lib/beta'
import { acceptInvite } from './actions'

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

  await acceptInvite(token)
  redirect('/login')
}
