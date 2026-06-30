// Browser stub for '@opentelemetry/api' — pulled in by Next.js server internals.
const noop = () => {};
const noopSpan = {
  setAttribute: noop, setStatus: noop, end: noop, recordException: noop,
  isRecording: () => false, spanContext: () => ({}),
};
export const trace = {
  getTracer: () => ({
    startSpan: () => noopSpan,
    startActiveSpan: (_n: any, _a: any, fn?: any) => fn?.(noopSpan),
  }),
  getActiveSpan: () => noopSpan,
};
export const context = {
  active: () => ({}),
  with: (_ctx: any, fn: any) => fn(),
  bind: (_ctx: any, fn: any) => fn,
};
export const propagation = { inject: noop, extract: (_: any, c: any) => c };
export const SpanStatusCode = { UNSET: 0, OK: 1, ERROR: 2 };
export const SpanKind = { INTERNAL: 0, SERVER: 1, CLIENT: 2, PRODUCER: 3, CONSUMER: 4 };
export const ROOT_CONTEXT = {};
export const diag = { error: noop, warn: noop, info: noop, debug: noop, verbose: noop };
export default { trace, context, propagation, SpanStatusCode, SpanKind, ROOT_CONTEXT, diag };
