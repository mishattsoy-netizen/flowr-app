// Tool-loop hop ceiling. Smart tier gets more room for multi-step chains;
// Light tier stays tight (cheap models shouldn't spin).
export const MAX_TOOL_HOPS_SMART = 8
export const MAX_TOOL_HOPS_LIGHT = 4

/** Resolve hop ceiling from the per-request context flag set in chainRouter. */
export function resolveMaxToolHops(ctx: any): number {
  return ctx?.toolTier === 'smart' ? MAX_TOOL_HOPS_SMART : MAX_TOOL_HOPS_LIGHT
}
