import { getClassifierConfig } from '@/app/admin/bot/classifier/actions'
import KeywordsClient from './KeywordsClient'

export default async function KeywordsPage() {
  const { keywords } = await getClassifierConfig('default')
  return <KeywordsClient initialKeywords={keywords} />
}
