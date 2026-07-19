# Flowr AI — Unified Admin & AI Engine Design

**Date:** 2026-04-21  
**Status:** Approved

## Overview

Unify the Flowr web app and the Flowr AI Telegram bot into one system backed by a single Supabase instance. Both platforms share the same AI routing engine (`runChain`), the same vault, the same limit presets, and the same admin panel — with per-platform router configuration and independent per-user quotas.

---

## Section 1 — Database

### `router_chains` (updated)

Add a `platform` column. Each intent category gets two rows — one for `'app'`, one for `'telegram'`.

```sql
ALTER TABLE router_chains ADD COLUMN platform TEXT NOT NULL DEFAULT 'telegram';
ALTER TABLE router_chains DROP CONSTRAINT router_chains_category_key;
ALTER TABLE router_chains ADD CONSTRAINT router_chains_category_platform_key UNIQUE (category, platform);
```

Seed app rows with the same 7 categories (FAST_SIMPLE, COMPLEX_THINKING, MEDIUM_THINKING, IMAGE_GEN, WEB_SEARCH, AUDIO_VOICE, TOOL_CALLING). Telegram rows use router v1.6 models.

### `user_quotas` (new)

Tracks daily message usage for app (Supabase Auth) users. Independent from `telegram_users.messages_used_today`.

```sql
CREATE TABLE user_quotas (
  auth_user_id        UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  messages_used_today INT  NOT NULL DEFAULT 0,
  last_reset_date     DATE NOT NULL DEFAULT CURRENT_DATE
);
```

### Existing tables (unchanged)

- `telegram_users` — bot users, quota, preset assignment
- `vault` — key_id (PK), encrypted_value, iv, description, updated_at
- `limit_presets` — daily_msg_limit, daily_image_limit, has_vision, has_web_search, has_image_gen
- `message_logs` — per-message analytics for bot

---

## Section 2 — Admin Panel Structure

### Sidebar navigation (Option B — platform as top-level sections)

```
Overview          (shared)
▼ APP
    Router        (platform='app')
    Presets       (shared)
▼ TELEGRAM BOT
    Router        (platform='telegram', v1.6 models)
    Presets       (shared)
─────────────────
Vault             (shared)
Users             (shared, Telegram-only for now)
Analytics         (shared)
```

Collapsible sections. Active platform section expands on load based on current route. Shared sections always visible below a divider.

### Router page

`RouterManager` receives a `platform: 'app' | 'telegram'` prop. Fetches and saves only chains matching that platform. Both platforms display the same 7 intent categories.

### Presets page

Shared — no platform filter. Listed under both sections for discoverability but renders the same data.

### Branding

All "Flowr" references renamed to "Flowr AI" throughout the admin UI.

---

## Section 3 — App AI Unification

### New `/api/ai/chat` route

```
POST /api/ai/chat
Body: { prompt: string, buffer: Message[], userId: string }
Response: streamed text
```

Calls `runChain(prompt, buffer, { userId, platform: 'app' })`. Returns the streamed model response. Auth-gated — rejects unauthenticated requests.

### `runChain` update

Accepts `platform: 'app' | 'telegram'` in its options object. Passes platform to `getRouterChain(category, platform)`.

### `getRouterChain` update

```ts
getRouterChain(category: IntentCategory, platform: 'app' | 'telegram')
```

Queries `router_chains WHERE category = $1 AND platform = $2`. Falls back to FAST_SIMPLE for the same platform if the category row is missing.

### `sendAIMessage` (store.ts)

Replaces direct OpenRouter/Gemini provider calls with:

```ts
fetch('/api/ai/chat', {
  method: 'POST',
  body: JSON.stringify({ prompt, buffer, userId })
})
```

### UI simplification

- Remove `aiRuntime`, `localModel`, `aiGemmaMode`, `aiFlowrMode` state from store
- Remove model picker dropdown from the chat UI
- Assistant header shows "Flowr AI" only — no model selector

---

## Section 4 — Quota Enforcement

### Telegram users

Existing: `telegram_users.messages_used_today` incremented after each `runChain` call. Reset when `last_active` date changes. Limit from assigned `limit_presets.daily_msg_limit`.

### App users

New `user_quotas` table (see Section 1). After each successful `/api/ai/chat` response:

1. Upsert row for `auth_user_id`
2. If `last_reset_date < today`, reset `messages_used_today = 0` and update date
3. Increment `messages_used_today`

Quota check before `runChain`: if `messages_used_today >= limit`, return quota-exceeded error (no model call).

App users get a default limit (e.g., same as Standard preset: 50/day). Configurable via `limit_presets` in a future update.

### Cross-platform linking

Deferred. Telegram and app quotas are independent for now. Future: link by `telegram_id` via Telegram Login Widget.

### Admin Users page

Remains Telegram-only for now. App quota visibility deferred.

---

## Out of Scope (this spec)

- Telegram Login Widget / account linking
- App user management in admin panel
- `message_logs` for app-side analytics
- Push notifications or webhooks
