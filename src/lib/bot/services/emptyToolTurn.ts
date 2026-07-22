import { MUTATING_TOOLS } from '../outputGuard'

/**
 * A model that ran tools but produced no reply text is only salvageable when
 * the tool activity itself tells the user something: a mutation happened, a
 * mutation failed, or a confirmation is pending. A read-only turn with no
 * text is a dead turn — the caller should throw so the chain fails over to
 * the next model instead of showing "Looked up N item(s)".
 */
export function shouldFailEmptyToolTurn(capturedToolCalls: any[]): boolean {
  const calls = capturedToolCalls ?? []
  return !calls.some(c =>
    MUTATING_TOOLS.has(c?.tool) || c?.status === 'pending_confirmation'
  )
}
