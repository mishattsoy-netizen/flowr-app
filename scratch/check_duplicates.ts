import { supabaseAdmin } from '../src/lib/supabase'

async function checkDuplicates() {
  const { data, error } = await supabaseAdmin
    .from('models')
    .select('id')

  if (error) {
    console.error('Error fetching models:', error)
    return
  }

  const counts: Record<string, number> = {}
  data?.forEach((m: any) => {
    counts[m.id] = (counts[m.id] || 0) + 1
  })

  const duplicates = Object.entries(counts).filter(([id, count]) => count > 1)
  if (duplicates.length > 0) {
    console.log('Duplicates found:', duplicates)
  } else {
    console.log('No duplicates found in database.')
  }
}

checkDuplicates()
