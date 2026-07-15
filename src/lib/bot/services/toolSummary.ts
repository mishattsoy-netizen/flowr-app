const VERBS: Record<string, string> = {
  create_content: 'Created',
  update_content: 'Updated',
  append_to_note: 'Appended to',
  move_content: 'Moved',
  delete_content: 'Deleted',
  manage_brain: 'Updated brain',
}

// Past verb → imperative for failure phrasing ("Deleted" → "Delete ... failed")
const FAIL_VERBS: Record<string, string> = {
  create_content: 'Create',
  update_content: 'Update',
  append_to_note: 'Append to',
  move_content: 'Move',
  delete_content: 'Delete',
  manage_brain: 'Update brain',
}

/**
 * Deterministic user-facing summary for turns where the model executed tools
 * but produced no text. Replaces the "Successfully executed N tool action(s)."
 * placeholder — the user must always learn WHAT happened.
 */
export function summarizeToolCalls(calls: any[]): string {
  if (!calls || calls.length === 0) return ''
  const parts: string[] = []
  let anyFailure = false

  for (const c of calls) {
    const failed = c.success === false || !!c.error
    if (failed) anyFailure = true
    const verb = VERBS[c.tool] ?? null
    const title = c.title ? `"${String(c.title).slice(0, 60)}"` : ''

    if (c.tool === 'list_content' || Array.isArray(c.items) || Array.isArray(c.results)) {
      const n = (c.items?.length ?? c.results?.length ?? 0)
      parts.push(`Looked up ${n} item(s)`)
    } else if (verb && failed) {
      parts.push(`${FAIL_VERBS[c.tool]} ${title} failed${c.error ? ` (${c.error})` : ''}`.replace(/\s+/g, ' ').trim())
    } else if (verb) {
      parts.push(`${verb} ${title}`.trim())
    }
  }

  if (parts.length === 0) return `✅ Completed ${calls.length} action(s)`
  return `${anyFailure ? '⚠️' : '✅'} ${parts.join(' · ')}`
}
