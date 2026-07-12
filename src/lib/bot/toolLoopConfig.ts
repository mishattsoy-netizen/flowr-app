// Tool-loop hop ceiling. Smart tier gets more room for multi-step chains;
// Light tier stays tight (cheap models shouldn't spin).
export const MAX_TOOL_HOPS_SMART = 8
export const MAX_TOOL_HOPS_LIGHT = 4

/** Resolve hop ceiling from the per-request context flag set in chainRouter. */
export function resolveMaxToolHops(ctx: any): number {
  return ctx?.toolTier === 'smart' ? MAX_TOOL_HOPS_SMART : MAX_TOOL_HOPS_LIGHT
}

// ── Repeat-call loop guard ──────────────────────────────────────────────────
// Nothing stops a model from re-issuing an identical tool call that just
// failed, burning every remaining hop on the same doomed request. This guard
// detects a repeat of a call that ALREADY FAILED and returns a nudge to feed
// back as the tool result, instead of re-running the handler.
//
// Deliberately NOT a hard loop-kill: legitimate retries exist (transient
// errors, re-reading after a write). We only intercept a repeat of something
// that already failed — an identical SUCCESSFUL call is left alone (re-reading
// is valid), and the model stays free to try a *different* call.

/** Stable identity for a tool call: name + canonically-ordered args. */
export function toolCallKey(toolName: string, args: any): string {
  const canon = (v: any): any => {
    if (v === null || typeof v !== 'object') return v
    if (Array.isArray(v)) return v.map(canon)
    return Object.keys(v).sort().reduce((acc: any, k) => { acc[k] = canon(v[k]); return acc }, {})
  }
  let argPart: string
  try {
    argPart = JSON.stringify(canon(args ?? {}))
  } catch {
    argPart = '[unserializable]'
  }
  return `${toolName}:${argPart}`
}

/**
 * If this exact call already failed earlier in the loop, returns a synthetic
 * tool result telling the model to stop repeating it. Returns null when the
 * call should run normally.
 *
 * `failedCalls` is a Map the caller keeps for the duration of one tool loop:
 * key -> the error message from the first failure.
 */
export function checkRepeatedFailure(
  toolName: string,
  args: any,
  failedCalls: Map<string, string>
): { error: string; repeated_call: true } | null {
  const key = toolCallKey(toolName, args)
  const priorError = failedCalls.get(key)
  if (priorError === undefined) return null
  return {
    error: `This exact ${toolName} call already failed with: "${priorError}". Do not repeat it — either change the arguments, use a different tool, or tell the user it could not be done.`,
    repeated_call: true,
  }
}

/** Record a failed call so a later identical call can be short-circuited. */
export function recordToolFailure(
  toolName: string,
  args: any,
  errorMessage: string,
  failedCalls: Map<string, string>
): void {
  failedCalls.set(toolCallKey(toolName, args), errorMessage)
}
