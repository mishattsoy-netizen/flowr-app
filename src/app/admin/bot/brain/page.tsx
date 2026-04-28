import { getBrainEntries } from './actions'
import BrainClient from './BrainClient'

export default async function BotBrainPage() {
  const entries = await getBrainEntries()
  return <BrainClient initialEntries={entries} />
}
