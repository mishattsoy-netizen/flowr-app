# ADVISOR & Thinking Mode — Efficiency & Stability Plan

**Date:** 2026-05-31
**Status:** Plan only — no code changes made yet
**Scope:** `src/lib/bot/advisor.ts`, `src/lib/bot/thinkChain.ts`, `src/lib/bot/chainRouter.ts`, provider layer; plus an optional per-chain `thinking_budget` design.

---

## 0. Context — the "effort level" question

There is **no effort-level concept** in the bot today (no `effort` / `reasoning_effort` / `reasoningEffort` key anywhere in config or code). Each chain is tuned by **model choice + temperature** only. The CLASSIFIER routing (REGULAR vs COMPLEX vs WEB_SEARCH …) already acts as the de-facto "effort" mechanism at the routing layer.

**Decision: stay automatic (router-driven). Do _not_ add an OpenAI-style `low/medium/high` effort enum.**

Reasons:
- The fleet doesn't share an effort API: Gemini/Gemma use `thinkingBudget` (tokens) or no thinking at all; Llama (Groq) and Flux (Cloudflare) have no reasoning knob; DeepSeek V4 uses OpenRouter's `reasoning` field. An enum would be a leaky abstraction over APIs that mostly lack the knob.
- The router already encodes effort; a parallel per-call enum risks the two disagreeing.
- A user-facing selector contradicts Flowr's design of hiding the pipeline.

If "think harder" is ever needed, use the optional per-chain `thinking_budget` (Section 3) — automatic, invisible, graceful.

---

## 1. ADVISOR — findings

**Works well:** fail-open design (`advisor.ts:230`), one-question discipline in the prompt, structured `ADVISOR_STATE` block.

### Issues

1. **Fragile state-block parsing, no fallback** — `advisor.ts:111`.
   Requires exact `---ADVISOR_STATE---\n…\n---END_ADVISOR_STATE---` fence. If the model omits the trailing newline, wraps it in a code block, or emits trailing prose, `stateMatch` fails → `parsedState = null` → phase silently defaults to `planning` **forever**. The advisor can never reach `ready` in this failure mode; it loops asking questions.

2. **`gathered_constraints` resets on parse miss** — `advisor.ts:124,131`.
   On a failed JSON parse, constraints fall back to the previous round's list, discarding everything learned that turn.

3. **No round ceiling enforced in code** — prompt says "4–6 rounds" but nothing forces `ready` after N rounds. A model that keeps asking will keep asking — unbounded.

4. **DeepSeek-R1 as 3rd fallback is wrong tool** — chain is `deepseek-v4-flash → gemini-3.1-flash-lite → DeepSeek-R1`. R1 is a reasoning model that emits long `<think>` blocks — likely to violate "state block must be last" and is slow. Bad fit for a conversational turn-taker.

5. **`message` duplicated in prompt** — `advisor.ts:84` appends `[USER MESSAGE]\n${message}` even though it's already the last turn of `[ADVISOR CONVERSATION HISTORY]`. Token waste; can make the model answer the message twice.

---

## 2. Thinking mode — findings

6. **🔴 The "correction" is a no-op (biggest bug)** — `thinkChain.ts:160`.
   When the think pass decides `Correction needed: WEB_SEARCH`, the code sets `correctedContext = accumulatedContext` (unchanged) and **re-runs the same think prompt** — it never invokes the WEB_SEARCH chain. The correction mechanism produces zero new information; it just burns a second model call re-thinking identical context. Then `chainRouter.ts:842` injects that unchanged context as `[SEARCH DATA]`, **falsely labeling non-search context as search results**.
   *(Per owner decision 2026-05-31: documented only, not yet fixed.)*

7. **Parser default masks failure** — `thinkChain.ts:32`.
   If the model doesn't emit `Direction for final output:`, `direction = raw` — the entire raw thinking dump gets injected as `[THINK CHAIN DIRECTION]` into the final system prompt. The answer chain then receives a wall of meta-reasoning as its "direction."

8. **`confidence` parsed but never used** — `thinkChain.ts:50`. Dead signal that could gate whether correction runs at all.

9. **Latency** — thinking adds a full serial model call (sometimes two) before the answer chain starts, with no `max_tokens` cap on the think model. On COMPLEX it's the same slow DeepSeek model twice in series.

10. **Per-chain `temperature` silently dropped for OpenRouter** — `openrouter.ts:87-92` omits `temperature` from the request body. ADVISOR and COMPLEX (both OpenRouter) ignore their configured `0.7`. Same plumbing as `thinking_budget` (Section 3).

---

## 3. Optional per-chain `thinking_budget` (design sketch, not yet built)

**Principle:** set per chain in config (automatic, invisible to users), applied only by providers that support it, silently ignored elsewhere. No user-facing enum.

### Config shape — `bot configs(premission to edit needed!)/router-chains.json`
```jsonc
"COMPLEX": {
  "chain": [ /* ...models... */ ],
  "system_prompt": "...",
  "temperature": 0.7,
  "thinking_budget": "high"   // NEW. "off" | "low" | "medium" | "high" | <number>. Omitted = current behavior.
}
```

| Token | Gemini (`thinkingBudget` tokens) | OpenRouter (`reasoning`) | Groq / Cloudflare |
|---|---|---|---|
| `"off"` | `0` | `{ exclude: true }` | ignored |
| `"low"` | `2048` | `{ effort: "low" }` | ignored |
| `"medium"` | `8192` | `{ effort: "medium" }` | ignored |
| `"high"` | `24576` | `{ effort: "high" }` | ignored |
| number `N` | `N` | `{ max_tokens: N }` | ignored |

### Translation layer — new `src/lib/bot/reasoning.ts`
```ts
export type ThinkingBudget = 'off' | 'low' | 'medium' | 'high' | number

export function toGeminiThinkingBudget(b?: ThinkingBudget): number | undefined {
  if (b == null) return undefined
  if (typeof b === 'number') return Math.max(0, b)
  return { off: 0, low: 2048, medium: 8192, high: 24576 }[b]
}

export function toOpenRouterReasoning(b?: ThinkingBudget):
  { effort?: 'low'|'medium'|'high'; max_tokens?: number; exclude?: boolean } | undefined {
  if (b == null) return undefined
  if (b === 'off') return { exclude: true }
  if (typeof b === 'number') return { max_tokens: b }
  return { effort: b }
}
```

### Wiring
- **OpenRouter** — after `requestBody` built (`openrouter.ts:87`):
  ```ts
  const reasoning = toOpenRouterReasoning(normContext.thinkingBudget)
  if (reasoning) requestBody.reasoning = reasoning
  ```
- **Gemini** — in `providers/google.ts` body assembly:
  ```ts
  const tb = toGeminiThinkingBudget(context.thinkingBudget)
  if (tb !== undefined) body.generationConfig.thinkingConfig = { thinkingBudget: tb }
  ```
- **Groq / Cloudflare** — nothing; the field never reaches them (no-op by construction).
- **Plumbing** — surface `thinking_budget` from `getRouterChain` in `router-config.ts`, pass into the `context` object each provider receives (same path as `openrouterProvider`). `temperature` should ride the same path — fixes issue #10 in the same pass.

### Why safe
Graceful degradation is structural (not conditional), no user surface, reversible (delete the field), single translation point.

---

## 4. Prioritized action plan

### P0 — correctness / stability
- [ ] **Harden `ADVISOR_STATE` parsing** (#1): tolerant regex (optional fences/newlines, strip ```` ```json ```` wrappers); JSON-anywhere fallback grabbing the last `{...}` containing `"phase"`. On total failure, **carry forward prior constraints** (fixes #2).
- [ ] **Fix think `direction` fallback** (#7): if `Direction for final output:` absent, set `direction = ''` and skip injection rather than dumping raw reasoning.
- [ ] **Think-chain correction no-op (#6)** — *documented only for now (owner decision 2026-05-31).* When picked up: either (a) **Minimal** — remove the `correctionChain` path entirely (single honest think pass, direction-only injection), or (b) **Real** — actually invoke the corrected chain and feed its real output back as `correctedContext`. Also stop mislabeling think context as `[SEARCH DATA]` (`chainRouter.ts:842`) unless a search chain truly ran.

### P1 — robustness
- [ ] **Hard round cap in code** (#3): force `phase: 'ready'` with existing constraints after `MAX_ROUNDS` (~6), regardless of model output.
- [ ] **Drop DeepSeek-R1 from ADVISOR chain** (#4); replace with a fast non-reasoning instruct model.
- [ ] **Cap think model output** (~`max_tokens: 1024`) — direction is short; bounds latency (#9).
- [ ] **Send `temperature` to OpenRouter** (#10) — same plumbing as `thinking_budget`.

### P2 — quality / cleanup
- [ ] **Use `confidence`** (#8): only attempt correction when `confidence !== 'high'`; skip think→answer overhead when pre-pass is already confident.
- [ ] **Remove duplicated `[USER MESSAGE]`** from advisor prompt (#5).

### Sequencing
P0 first (active bugs degrading every thinking-mode request). P1 next. P2 opportunistically.

---

## 5. File reference

| Concern | Location |
|---|---|
| ADVISOR state parsing | `src/lib/bot/advisor.ts:87-153` |
| ADVISOR prompt build (dup message) | `src/lib/bot/advisor.ts:47-85` |
| ADVISOR chain (DeepSeek-R1 fallback) | `bot configs(premission to edit needed!)/router-chains.json` → `ADVISOR` |
| Think correction no-op | `src/lib/bot/thinkChain.ts:154-196` |
| Think direction fallback | `src/lib/bot/thinkChain.ts:31-52` |
| Think → `[SEARCH DATA]` mislabel | `src/lib/bot/chainRouter.ts:835-843` |
| OpenRouter request body (temp/thinking) | `src/lib/bot/providers/openrouter.ts:87-92` |
| Gemini request body | `src/lib/bot/providers/google.ts` |
