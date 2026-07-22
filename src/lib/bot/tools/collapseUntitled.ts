/**
 * Untitled scratch notes ("New Note") accumulate at workspace root and bloat
 * every browse-mode list_content payload. Collapse 2+ of them into a count the
 * model can relay ("…plus N untitled notes") — data is untouched, only the
 * listing is summarized. Searches and readContent calls bypass this entirely.
 */
export function collapseUntitledNotes(items: any[]): { items: any[]; collapsedCount: number } {
  const isUntitled = (it: any) => it?.type === 'note' && (it?.title === 'New Note' || !it?.title?.trim())
  const untitled = items.filter(isUntitled)
  if (untitled.length < 2) return { items, collapsedCount: 0 }
  return { items: items.filter(it => !isUntitled(it)), collapsedCount: untitled.length }
}
