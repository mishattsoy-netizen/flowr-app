# Model Discovery Page — Design Spec

**Date:** 2026-05-06  
**Status:** Approved

---

## Overview

A new admin page that lets the operator fetch available free/free-tier models from any supported provider, inspect their limits, and add or update them in the model registry with a single click.

---

## Location & Navigation

- Page: `src/app/admin/discover/page.tsx` (server component)
- Client component: `src/app/admin/discover/DiscoverClient.tsx`
- Server actions: `src/app/admin/discover/actions.ts`
- Admin nav: add "Discover" entry to the sidebar alongside Models, Router, Vault

Follows the same server-component shell → client-component pattern used by every other admin page.

---

## Data Model

All providers normalize to a shared shape before the UI renders:

```ts
interface DiscoveredModel {
  id: string
  displayName: string
  provider: string
  contextWindow: number | null    // input token limit
  maxOutputTokens: number | null
  rpd: number | null              // requests per day; null = unlimited
  rpm: number | null              // requests per minute; null = unknown
  modalities: {
    input: string[]               // e.g. ['text', 'image']
    output: string[]              // e.g. ['text']
  }
  inRegistry: boolean             // already exists in models table
}
```

---

## Provider Coverage & Fetch Logic

Single server action `fetchProviderModels(provider: string, apiKey: string): Promise<DiscoveredModel[]>` dispatches to per-provider fetchers. After fetching, cross-references the existing `models` table to set `inRegistry`.

### Google (Gemini API)
- Endpoint: `GET https://generativelanguage.googleapis.com/v1beta/models?key=KEY&pageSize=200`
- Filter: only models with `generateContent` in `supportedGenerationMethods`
- Limits: read directly from response (`inputTokenLimit`, `outputTokenLimit`); RPD/RPM not in response — set to `null`
- Modalities: inferred from model name/description (vision models get `image` input)

### Groq
- Endpoint: `GET https://api.groq.com/openai/v1/models` with `Authorization: Bearer KEY`
- All models returned are free tier
- Limits: context_window from response; RPD/RPM set to known Groq free tier defaults where available, else `null`
- Modalities: `text` in/out by default; whisper models get `audio` input

### Pollinations
- Endpoint: `GET https://text.pollinations.ai/models` (key sent as Bearer if present in vault)
- All models are free — show all
- Limits: typically not returned; all fields `null`
- Modalities: `text` in/out

### HuggingFace
- Endpoint: `GET https://huggingface.co/api/models?filter=text-generation&sort=downloads&limit=100` with `Authorization: Bearer KEY`
- Filter: `pipeline_tag === 'text-generation'` and not gated (`gated === false`)
- Limits: not returned by HF API; all `null`
- Modalities: `text` in/out

### OpenRouter
- Endpoint: `GET https://openrouter.ai/api/v1/models` with `Authorization: Bearer KEY`
- Filter: model `id` ends with `:free` **OR** `pricing.prompt === "0"` OR `pricing.prompt === "0.000"`
- Limits: `context_length` → `contextWindow`; RPD/RPM not returned → `null`
- Modalities: from `architecture.input_modalities` / `architecture.output_modalities` if present

### Cloudflare
- Endpoint: `GET https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/ai/models/search` with `Authorization: Bearer TOKEN`
- Account ID read from vault key `CLOUDFLARE_ACCOUNT_ID`
- All Workers AI models are free tier — show all
- Limits: not returned; all `null`
- Modalities: inferred from `task.name` (e.g. "Text Generation", "Image Classification")

---

## UI Layout

### Controls Bar (top)

```
[ Provider ▾ ]  [ API Key ▾ ]  [ Fetch Models ]
```

- **Provider dropdown**: Google · Groq · Pollinations · HuggingFace · OpenRouter · Cloudflare
- **API Key dropdown**: populated from vault keys for the selected provider (e.g. `GEMINI 1`, `GEMINI 2`). Greyed out with label "No key required" for providers that don't need a key (none currently do, but future-proof)
- **Fetch Models button**: triggers `fetchProviderModels` server action; shows spinner while loading
- Changing provider resets the results table

### Results Table (appears after fetch)

Header row includes an **"Add All"** button on the right that bulk-adds all models not yet in registry.

Columns:
| Column | Notes |
|---|---|
| Model ID | monospace, truncated with title tooltip |
| Display Name | human-readable name |
| Context Window | formatted with K suffix (e.g. 128K); `—` if null |
| Max Output | same formatting |
| RPD | number or `∞` if null |
| RPM | number or `—` if null |
| Input | modality badges (text, image, audio) |
| Output | modality badges |
| In Registry | green checkmark if `inRegistry`, empty otherwise |
| Action | `+ Add` (green) if not in registry; `↺ Update` (grey) if already there |

### Add / Update Behavior

- Clicking **Add**: calls existing `addModel` action with normalized data; optimistically flips row to show green checkmark + "↺ Update" button
- Clicking **Update**: calls existing `updateModel` action (updates `contextWindow` → `max_rpd` where mappable, modalities); optimistically updates row
- **Add All**: iterates all rows not in registry, calls `addModel` for each; shows progress count

### Error Handling

- Fetch failure (bad key, network error, provider down): shows inline error banner below controls bar with the error message; table does not render
- Individual Add/Update failure: shows transient red toast on that row; reverts optimistic state

---

## Styling Conventions

Matches existing admin pages exactly:
- `bg-panel`, `rounded-big`, `rounded-medium`, `rounded-small`
- `text-bone-60`, `opacity-40/60/70` for muted text
- `text-[10px]`/`text-[11px]`/`text-[12px]` font sizing
- `font-mono` for model IDs and limits
- `font-bold uppercase tracking-widest` for column headers
- Provider badge colors from `ModelsTable` `PROVIDER_COLORS` map (reused)
- Modality badge colors from `ModelsTable` `MODALITY_COLORS` map (reused)
- Lucide icons: `RefreshCw` (spinner), `CheckCircle2` (in registry), `Plus`, `RotateCcw`

---

## File Structure

```
src/app/admin/discover/
  page.tsx           — server component shell
  DiscoverClient.tsx — all UI and interaction state
  actions.ts         — fetchProviderModels + re-exports of addModel/updateModel
```

No new DB tables or migrations required — reads from `vault` and `models` tables, writes to `models` via existing actions.
