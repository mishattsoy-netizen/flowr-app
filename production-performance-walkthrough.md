# Root Cause Analysis: Local vs. Live AI Performance Gap

After a deep investigation of the codebase, here are **every divergence point** I found between your local dev server and the live deployed app that could cause the 2-4x slower responses, worse quality, incorrect answers, and missed intent you're experiencing.

---

## 🔴 Critical: `unstable_cache` with `revalidate: false` (The #1 Suspect)

**File:** [router-config.ts](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/lib/router-config.ts#L182-L189)

```typescript
const getCachedForMode = (m: RouterMode) => unstable_cache(
  async () => fetchRouterChainFromDb(category, m),
  ['router-chain', category, m],
  { tags: ['router-config'], revalidate: false }
)()
```

**What this does:** `revalidate: false` tells Next.js to cache the router chain configuration **indefinitely** — it never expires on its own. The only way to bust it is calling `revalidateTag('router-config')` via the admin panel.

**Why this is devastating in production:**
- When you deploy, the **first request** to each category fetches the model chains from Supabase and caches them forever.
- If you later change model chains in Supabase (add better models, reorder priorities, enable/disable models), **the live app never sees those changes** until you explicitly hit the `/api/admin/revalidate` endpoint.
- Locally, `next dev` **does NOT use this cache** — `unstable_cache` is effectively a no-op in dev mode. Every request re-fetches fresh chains from Supabase. So locally you always get the latest config, but production is frozen to whatever was cached at deploy time.

**Impact:** This alone could explain the wrong models being used, slower responses (hitting a deprioritized/rate-limited model), and worse quality (using an older, less capable model chain).

---

## 🔴 Critical: `process.cwd()` Prompt Loading in Standalone Build

**Files:**
- [prompts/index.ts](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/lib/bot/prompts/index.ts#L4) — `const PROMPTS_DIR = join(process.cwd(), 'src', 'lib', 'bot', 'prompts')`
- [classifier.ts](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/lib/bot/classifier.ts#L195) — `fs.readFileSync(path.join(process.cwd(), 'src/lib/bot/prompts/chains/classifier_v2.txt'), ...)`

**What this does:** The system prompt files, classifier prompt, and all chain prompts are loaded from disk at runtime using `process.cwd() + 'src/lib/bot/prompts/...'`.

**Why this is devastating in production:**
- Your Next.js config uses `output: 'standalone'` ([next.config.ts:7](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/next.config.ts#L7)). In standalone mode, the production server runs from `.next/standalone/`, NOT from the project root. `process.cwd()` points to `.next/standalone/`, where `src/lib/bot/prompts/` **does not exist**.
- When `readFileSync` fails, the code falls back to hardcoded defaults:
  - `getChainPrompt()` → falls back to generic one-liners like `"You produce the final user-facing answer."` instead of your carefully crafted multi-paragraph prompts.
  - `classifyIntentV2()` → returns `{ classification: null, error: 'classifier_v2.txt missing' }`, which means **classification fails entirely** and returns a system overload error, or falls back to the old v1 classifier.
  
**Impact:** This is likely why the live app misses your request intent and gives lower quality answers — it's running with stripped-down fallback prompts instead of your real system prompts! The classifier may be misrouting requests because it can't read its own prompt file.

---

## 🟡 Significant: Vercel Function Timeout (if deployed on Vercel)

Your chat API route has **no `maxDuration` export**. On Vercel's free/hobby tier, serverless functions default to a **10-second timeout**. Your AI pipeline (classifier → narration → search → synthesis) regularly takes 5-15 seconds:

- Classifier: ~1-2s
- Image narration: ~2-4s  
- Search (Tavily + retry): ~2-5s
- Model response: ~3-8s

If any of these chains are slow, the function will be killed at 10s, and the user gets a partial or empty response.

**Impact:** Explains the 2-4x longer response time perception (request gets killed, retried by client, then hits a cold start).

---

## 🟡 Significant: Cold Starts & In-Memory State Loss

**Files affected:**
- [chainRouter.ts](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/lib/bot/chainRouter.ts#L90-L120) — `modelFailureCache` (in-memory cooldown map)
- [prompts/index.ts](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/lib/bot/prompts/index.ts#L6) — `const cache = new Map()` (prompt cache)

In production (serverless), every cold start resets the in-memory `modelFailureCache`. This means:
- A model that **just** failed and was put on cooldown will be retried immediately on the next cold-started instance, wasting time on a model that's known-broken.
- Conversely, locally, the dev server stays warm and the cooldown works perfectly.

---

## 🟡 Significant: Vault Key Fetch Latency

**File:** [vault.ts](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/lib/vault.ts)

Every model attempt calls `getProviderKeys()`, which:
1. Fetches `vault_accounts` from Supabase
2. Fetches `vault` keys for those accounts
3. Decrypts each key

In production (Vercel → Supabase), each DB query has ~50-100ms of network latency. The chain prefetches keys in parallel, but this still adds 100-200ms of overhead **per request** that doesn't exist locally (where Supabase is usually same-region or mocked).

---

## 🟢 Minor: `sharp` Not Available in Standalone

Your new `image-resizer.ts` uses `sharp`, which requires native binaries. In standalone builds, `sharp` might not be bundled correctly. The dynamic import catches this gracefully (falls back to raw buffers), but it means production images won't be resized — paying full token cost for large screenshots.

---

## Summary: Ranked by Impact

| # | Issue | Impact | Fix Difficulty |
|---|-------|--------|----------------|
| 1 | **`process.cwd()` prompt loading broken in standalone** | 🔴 Prompts silently fall back to generic defaults | Medium — copy prompts into standalone output, or embed them at build time |
| 2 | **`unstable_cache` with `revalidate: false`** | 🔴 Stale model chains cached forever after deploy | Easy — add `revalidate: 300` (5 min) or bust cache on each deploy |
| 3 | **No `maxDuration` on chat route** | 🟡 Requests killed at 10s on Vercel | Easy — add `export const maxDuration = 60` |
| 4 | **Cold start resets model cooldowns** | 🟡 Wastes time retrying known-broken models | Low priority — acceptable tradeoff |
| 5 | **Vault key fetch latency** | 🟡 100-200ms per request | Low priority — already parallelized |

> [!IMPORTANT]
> **Issue #1 (prompts not found) is almost certainly your primary culprit.** When the classifier can't read its prompt, it either crashes or falls back to a completely different classification logic. When chain prompts fall back to generic one-liners, the model has no personality, no formatting rules, no tool instructions — it's flying blind.
