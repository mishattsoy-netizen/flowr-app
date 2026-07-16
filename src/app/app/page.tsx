import { cookies } from 'next/headers';
import { AppClient } from './AppClient';

export default async function AppPage() {
  const cookieStore = await cookies();
  const initialEntityId = cookieStore.get('flowr-initial-entity')?.value || 'dashboard';

  return <AppClient initialEntityId={initialEntityId} />;
}
