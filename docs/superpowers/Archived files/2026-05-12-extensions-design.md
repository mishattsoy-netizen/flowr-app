# Extensions — Design Spec
**Date:** 2026-05-12
**Status:** Ready for planning

---

## Overview

Extensions connect external services (Gmail, Figma, GitHub, Telegram, Obsidian, Notion, TradingView) to the chat bot. When an extension is active, the bot can read data from the service as conversation context and propose write actions (create issue, reply to email, etc.). Every proposed write action must be explicitly approved, modified, or rejected by the user before it executes.

---

## Scope

**In scope:**
- OAuth connection flow for each extension (Settings modal → Extensions tab)
- Token storage in Supabase (server-side, encrypted via RLS)
- Extension context injection into `/api/ai/chat` requests
- Write action proposal UI — Apply / Edit / Reject buttons on bot messages
- Extension active-state display in the `+` popup in chat
- Supported extensions: Gmail, Figma, GitHub, Telegram, Obsidian, Notion, TradingView

**Out of scope:**
- Extension-specific UI dashboards (e.g. a full inbox viewer)
- Webhook / real-time push from services to the app
- Extension marketplace or third-party extension development

---

## Extension Capabilities

| Extension | Read (context) | Write (with approval) |
|---|---|---|
| Gmail | Recent threads, unread count, labels | Reply, compose, label, archive |
| GitHub | Repos, open issues, PRs, commits | Create issue, comment, open PR |
| Figma | Files, pages, recent activity | Comment on file |
| Telegram | Recent messages from a bot/channel | Send message via bot |
| Obsidian | Vault notes (via local REST plugin) | Create/update note |
| Notion | Pages, databases | Create page, append block |
| TradingView | Watchlist, alerts (via their API) | Create/delete alert |

---

## Architecture

### OAuth Flow

```
User clicks "Connect" (Settings → Extensions tab)
  → Server route: GET /api/extensions/[name]/auth
    → Redirects to provider OAuth URL
  → Provider redirects to: GET /api/extensions/[name]/callback?code=...
    → Server exchanges code for access_token + refresh_token
    → Stores encrypted in Supabase `extension_tokens` table
    → Redirects user back to settings with ?connected=true
```

OAuth credentials (client ID, client secret) live in server environment variables — never exposed to the client.

### Token Storage — Supabase

```sql
create table extension_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  extension text not null,           -- 'gmail' | 'github' | 'figma' | ...
  access_token text not null,        -- encrypted at rest via Supabase Vault
  refresh_token text,
  expires_at timestamptz,
  scope text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, extension)
);

alter table extension_tokens enable row level security;
create policy "own tokens" on extension_tokens
  for all using (auth.uid() = user_id);
```

Tokens are never sent to the client. All extension API calls happen server-side in `/api/extensions/[name]/...` routes.

### Context Injection

When a user sends a message with one or more extensions active, the client includes `activeExtensions: string[]` in the request body. The `/api/ai/chat` route calls each active extension's context endpoint (`/api/extensions/[name]/context`) server-to-server (using the user's Supabase session to authorize token lookup), then prepends the results to the system prompt:

```
[EXTENSION CONTEXT: Gmail]
- 3 unread threads in inbox
- Most recent: "Re: Q2 Budget" from finance@company.com (2h ago)
- Thread preview: "Can you confirm the..."

[EXTENSION CONTEXT: GitHub]
- Repo: flowr-app — 2 open PRs, 5 open issues
- Most recent issue: "Chat page history panel doesn't collapse on mobile" (1h ago)
```

The context fetch is parallelized across active extensions and has a 3-second timeout per extension — timed-out extensions are skipped silently.

### Write Action Proposals

When the bot proposes a write action, it returns a structured JSON block alongside the natural language reply:

```json
{
  "action": {
    "extension": "github",
    "type": "create_issue",
    "params": {
      "repo": "flowr-app",
      "title": "Chat page history panel doesn't collapse on mobile",
      "body": "Steps to reproduce: ...",
      "labels": ["bug"]
    },
    "preview": "Create issue: 'Chat page history panel doesn't collapse on mobile' in flowr-app"
  }
}
```

The `ChatMessage` component detects this structured block and renders an action proposal card below the bot's text:

```
┌────────────────────────────────────────────────┐
│ 🔧 Proposed Action — GitHub                    │
│ Create issue: "Chat page history panel          │
│ doesn't collapse on mobile" in flowr-app        │
│                                                │
│ [Edit]  [Reject]  [Apply →]                    │
└────────────────────────────────────────────────┘
```

- **Apply** — POSTs to `/api/extensions/github/actions/create_issue` with the params
- **Edit** — Opens an inline JSON editor so the user can tweak params before applying
- **Reject** — Dismisses the card, no action taken

Action results (success or error) replace the proposal card inline.

---

## Settings Modal — Extensions Tab

A new "Extensions" tab is added to the existing Settings modal (`src/components/modals/SettingsModal.tsx`).

Layout per extension:

```
┌──────────────────────────────────────────────┐
│ [Gmail icon]  Gmail                          │
│ Read threads · Reply · Compose               │
│                              [Connect →]     │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│ [GitHub icon]  GitHub          ✓ Connected   │
│ Read issues/PRs · Create issue · Comment     │
│ Scope: repo, issues            [Disconnect]  │
└──────────────────────────────────────────────┘
```

- Connected extensions show scope granted and a Disconnect button
- Disconnect revokes the token on the server and deletes the Supabase row

---

## `+` Popup — Extension Active State

In the `ChatPlusMenu`, connected extensions show as toggleable chips (active = highlighted). Toggling enables/disables context injection for that extension in the current conversation.

```
Extensions
[Gmail ✓]  [GitHub ✓]  [Figma]  [Telegram]
[Obsidian]  [Notion]  [TradingView]
```

Unconnected extensions open the Settings modal on click (Extensions tab).

---

## API Routes

```
GET  /api/extensions/[name]/auth           → redirects to OAuth URL
GET  /api/extensions/[name]/callback       → exchanges code, stores token
POST /api/extensions/[name]/disconnect     → deletes token from Supabase
GET  /api/extensions/[name]/context        → returns context string for injection
POST /api/extensions/[name]/actions/[type] → executes approved write action
```

All routes require authentication (`Authorization: Bearer <supabase_access_token>`).

---

## Error Handling

- OAuth failure: redirect back to settings with `?error=oauth_failed`, show toast
- Context fetch timeout (>3s): skip extension, add note in system prompt: `[Gmail context unavailable]`
- Write action failure: show inline error on the action card with retry button
- Token expiry: server auto-refreshes using `refresh_token` before each API call; if refresh fails, mark extension as disconnected and prompt user to reconnect

---

## Security Notes

- Client IDs/secrets only in server env vars (`GMAIL_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, etc.)
- Tokens never returned to the client — all extension calls go through server routes
- RLS ensures users can only read their own tokens
- Write actions log to the existing `ai_request_logs` table with `extension` and `action_type` fields
- Scope is requested minimally — only what each extension's capabilities require
