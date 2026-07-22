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

  let anyPending = false

  for (const c of calls) {
    // A dry-run awaiting the user's yes/no is NOT a failure — it carries
    // status: 'pending_confirmation' and (for deletes) no real success flag.
    // Must be handled BEFORE the `failed` check below: the dry-run result is
    // logged with success:false, which would otherwise render "Delete failed"
    // to a user who was only ever shown a confirmation preview.
    if (c.status === 'pending_confirmation') {
      anyPending = true
      const items = Array.isArray(c.items_to_delete) ? c.items_to_delete : []
      const names = items
        .map((it: any) => (it?.title ? `"${String(it.title).slice(0, 60)}"` : (it?.type ?? 'item')))
        .join(', ')
      const verbLabel = FAIL_VERBS[c.tool] ?? 'Confirm'
      parts.push(
        names
          ? `${verbLabel} ${names}? Reply to confirm.`
          : `${verbLabel} — awaiting your confirmation.`
      )
      continue
    }

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
  // A real failure wins the icon; otherwise a pending confirmation shows the
  // question mark (it's neither done nor broken); else success.
  const icon = anyFailure ? '⚠️' : anyPending ? '❓' : '✅'
  return `${icon} ${parts.join(' · ')}`
}
