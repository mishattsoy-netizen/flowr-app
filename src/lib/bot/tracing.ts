const MAX_FIELD_CHARS = 12000

function cap(s: string | undefined | null): string | undefined {
  if (!s) return undefined
  return s.length > MAX_FIELD_CHARS ? s.slice(0, MAX_FIELD_CHARS) + '\n…[truncated]' : s
}

export interface StepTrace {
  index: number
  chain: string
  model: string
  provider: string
  key?: string
  matched_keyword?: string
  success: boolean
  input_system?: string
  input_user?: string
  input_history_count?: number
  output?: string
  error?: string
  duration_ms: number
  started_at: string
}

export class TraceCollector {
  private traces: StepTrace[] = []
  private counter = 0

  async run<T>(
    meta: {
      chain: string
      model: string
      provider: string
      key?: string
      input_system?: string
      input_user?: string
      input_history_count?: number
    },
    fn: () => Promise<T>
  ): Promise<T> {
    const index = this.counter++
    const started_at = new Date().toISOString()
    const t0 = Date.now()

    try {
      const result = await fn()
      this.traces.push({
        index,
        chain: meta.chain,
        model: meta.model,
        provider: meta.provider,
        key: meta.key,
        success: true,
        input_system: cap(meta.input_system),
        input_user: cap(meta.input_user),
        input_history_count: meta.input_history_count,
        output: cap(typeof result === 'string' ? result : (result && typeof result === 'object' && 'content' in (result as any) ? (result as any).content : undefined)),
        duration_ms: Date.now() - t0,
        started_at,
      })
      return result
    } catch (err: any) {
      this.traces.push({
        index,
        chain: meta.chain,
        model: meta.model,
        provider: meta.provider,
        key: meta.key,
        success: false,
        input_system: cap(meta.input_system),
        input_user: cap(meta.input_user),
        input_history_count: meta.input_history_count,
        error: err?.message ?? String(err),
        duration_ms: Date.now() - t0,
        started_at,
      })
      throw err
    }
  }

  recordFailed(
    meta: {
      chain: string
      model: string
      provider: string
      key?: string
      input_system?: string
      input_user?: string
      input_history_count?: number
      error?: string
    },
    duration_ms = 0
  ) {
    this.traces.push({
      index: this.counter++,
      chain: meta.chain,
      model: meta.model,
      provider: meta.provider,
      key: meta.key,
      success: false,
      input_system: cap(meta.input_system),
      input_user: cap(meta.input_user),
      input_history_count: meta.input_history_count,
      error: meta.error,
      duration_ms,
      started_at: new Date().toISOString(),
    })
  }

  recordSuccess(
    meta: {
      chain: string
      model: string
      provider: string
      key?: string
      matched_keyword?: string
      input_system?: string
      input_user?: string
      input_history_count?: number
      output?: string
    },
    duration_ms = 0
  ) {
    this.traces.push({
      index: this.counter++,
      chain: meta.chain,
      model: meta.model,
      provider: meta.provider,
      key: meta.key,
      matched_keyword: meta.matched_keyword,
      success: true,
      input_system: cap(meta.input_system),
      input_user: cap(meta.input_user),
      input_history_count: meta.input_history_count,
      output: cap(meta.output),
      duration_ms,
      started_at: new Date().toISOString(),
    })
  }

  get all(): StepTrace[] {
    return this.traces
  }
}
