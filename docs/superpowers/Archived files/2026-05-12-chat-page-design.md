# Chat Page — Design Spec
**Date:** 2026-05-12
**Status:** Approved for implementation

---

## Overview

A dedicated full-screen Chat view added to the main app workspace. It lives alongside Dashboard and Tracker as a fixed sidebar navigation entry. Users can run persisted conversations (saved to Supabase) or temporary sessions (Zustand only). The sidebar AI assistant is also upgraded with session management controls, and both views share state so they stay in sync.

Two follow-on specs will cover Extensions and Design Mode, which are UI stubs in this build.

---

## Scope

**In scope (this spec):**
- `ChatPage` component — two-pane layout (history panel + conversation area)
- Sidebar "Chat" nav entry
- History panel — date-grouped conversation list, collapsible
- Persisted conversations — Supabase `conversations` + `messages` tables
- Temporary chat — Zustand-only session, survives navigation away and back
- Conversation view — reuses existing `ChatMessage` component, streams via existing `/api/ai/chat`
- Message input bar — reuses existing `AIAssistant` bar; only the `+` popup is new
- `+` popup — media upload, context toggle, extension stubs (UI only), design mode stub (UI only)
- Sidebar assistant header — new session controls, API key button removed
- Delete confirmation dialog for conversations
- Real-time sync between Chat page and sidebar when same conversation is open

**Out of scope (separate specs):**
- Extensions (Gmail, Figma, GitHub, Telegram, Obsidian, Notion, TradingView, etc.)
- Design Mode (bot-generated interactive blocks that can be dropped into notes)

---

## Layout

```
| App Sidebar | History Panel   | Conversation Area              |
|             | [+ New] [Temp]  |                                |
| Dashboard   | ─────────────   | [Bot avatar] Hi, how can I     |
| Tracker     | Today           | help you today?                |
| 💬 Chat ←  | • Research...   |                                |
| Notes...    | • Code help     | [User] What is X?              |
|             | Yesterday       | [Bot] Here's the answer...     |
|             | • UI session    |                                |
|             |                 | [+ ][TOOLS][DEFAULT↑][○][▶]   |
```

The Chat page renders inside the existing `Shell` — the app left sidebar and right AI panel are unaffected.

---

## Navigation

### Sidebar entry
- Add a `MessageSquare` icon entry labeled "Chat" below the Tracker entry in `src/components/layout/Sidebar.tsx`
- Clicking calls `setActiveEntityId('chat')` — same pattern as Dashboard and Tracker
- This is a fixed nav item, not a workspace entity; it does not appear in the entity tree

### WorkspaceRouter
- In `src/components/WorkspaceRouter.tsx`, add:
  ```ts
  if (activeEntityId === 'chat') return <ChatPage />;
  ```
  alongside the existing `dashboard` and `tracker` checks.

---

## Components

### `ChatPage` (`src/components/chat/ChatPage.tsx`)
Top-level component. Renders a two-pane layout:
- Left: `<ChatHistoryPanel />` (collapsible, default width ~260px)
- Right: `<ChatConversation />` (flex-1)

### `ChatHistoryPanel` (`src/components/chat/ChatHistoryPanel.tsx`)
- Header row: `[+ New Chat]` button, `[Temp Chat]` button
- Conversation list, grouped by date: Today / Yesterday / Last 7 days / Older
- Each entry: conversation title (auto-generated from first user message, truncated to ~40 chars), hover actions (rename, delete)
- Delete triggers `DeleteConfirmModal` before executing Supabase delete
- Collapse toggle (chevron) — panel width animates to 0, toggle remains visible to re-expand

### `ChatConversation` (`src/components/chat/ChatConversation.tsx`)
- Empty state: centered bot avatar + "Ask Flowr AI" tagline + 3–4 suggested prompt chips
- Message list: reuses existing `<ChatMessage />` from `src/components/assistant/components/ChatMessage.tsx`
- Auto-scrolls to bottom on new message
- Streaming via existing `/api/ai/chat` SSE endpoint — no API changes

### Message input bar
- Reuses the existing `AIAssistant` input bar component directly (or extracted as a shared sub-component)
- **No visual changes** to the bar itself — it looks exactly as it does in the sidebar
- The **only behavioral change**: the `[+]` button opens a new popup instead of the current attachment menu

### `ChatPlusMenu` (`src/components/chat/ChatPlusMenu.tsx`)
Popup that opens from the `[+]` button:

| Item | State | Behavior |
|---|---|---|
| Upload Media | Functional | Image / file attachment, same as existing |
| Context Toggle | Functional | Shares current active entity context with bot |
| Extensions | UI stub | Shows "Coming soon" badge, lists icons for Gmail, Figma, GitHub, Telegram, Obsidian, Notion, TradingView |
| Design Mode | UI stub | Shows "Coming soon" badge with description |

---

## Sidebar Assistant — Header Changes

The sidebar `AIAssistant` header is updated with session management controls:

**Added buttons:**
- `+` — New session (persisted to Supabase, sets `activeChatId`)
- Open in Chat — calls `setActiveEntityId('chat')`, opens the current `activeChatId` in the Chat page
- Temp — starts a temporary session (`isTempChat = true`, clears `activeChatId`)
- History (clock icon) — opens a modal/popover with the same date-grouped session list as `ChatHistoryPanel`

**Removed:**
- API key button (Key icon) — removed from the header

**Delete from history modal:** same confirmation dialog as the Chat page history panel.

---

## State — Zustand Store Additions

New fields added to the existing store (`src/data/store.ts`):

```ts
activeChatId: string | null        // ID of the currently open persisted conversation; null = temp
isTempChat: boolean                // true when active session is not persisted
tempChatMessages: AIMessage[]      // messages for the current temp session
chatHistoryOpen: boolean           // whether the history panel is expanded
```

New actions:
```ts
setActiveChatId(id: string | null): void
startTempChat(): void              // sets isTempChat=true, activeChatId=null, clears tempChatMessages
startNewChat(): Promise<void>      // creates Supabase conversation row, sets activeChatId
loadConversation(id: string): Promise<void>  // loads messages from Supabase, sets activeChatId
deleteConversation(id: string): Promise<void>
setChatHistoryOpen(open: boolean): void
```

**Sync:** Both the Chat page and sidebar assistant read from the same `activeChatId` and the same `aiMessages` array in Zustand. The existing `aiMessages` slice is reused — it represents the active conversation's messages regardless of which surface is displaying them. When the same conversation is open in both views, they render identical message streams with no extra sync logic. The floating assistant and sidebar assistant continue to use `aiMessages` as before; the Chat page simply reads and writes the same slice.

---

## Conversation Lifecycle

| Action | Result |
|---|---|
| Enter Chat view, no prior state | Temp chat starts automatically |
| Send message in temp chat | Writes to `tempChatMessages` in Zustand; no Supabase write |
| Click "New Chat" | Supabase `conversations` row created; subsequent messages write to `messages` table |
| Click "Temp" | `tempChatMessages` cleared; `isTempChat = true`; `activeChatId = null` |
| Switch to a persisted conversation | `tempChatMessages` cleared; messages loaded from Supabase |
| Navigate away (Notes, Dashboard) and return | Temp: `tempChatMessages` still in Zustand, shown on return. Persisted: reloads from Supabase |
| Delete conversation | Confirmation dialog → Supabase delete → history list updates |

---

## Database Schema

Two new Supabase tables:

```sql
create table conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  title text not null default 'New Chat',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  is_archived boolean default false
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete cascade not null,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  model text,
  pipeline_steps jsonb,
  created_at timestamptz default now()
);

-- RLS: users can only access their own conversations
alter table conversations enable row level security;
alter table messages enable row level security;

create policy "own conversations" on conversations
  for all using (auth.uid() = user_id);

create policy "own messages" on messages
  for all using (
    conversation_id in (select id from conversations where user_id = auth.uid())
  );
```

The conversation title is auto-set from the first user message (truncated to 60 chars) on the first successful bot reply.

---

## API

No changes to `/api/ai/chat`. The `conversation_id` is passed in the request body as optional metadata for logging but does not affect streaming behavior.

---

## Error Handling

- Supabase write failures: show a toast, message still appears in UI (optimistic)
- Conversation load failure: show inline error state in the conversation area with a retry button
- Delete failure: show toast, row remains in list

---

## Out-of-Scope Follow-On Specs

Two separate spec files will be created:
1. `2026-05-12-extensions-design.md` — Extensions architecture (Gmail, Figma, GitHub, etc.)
2. `2026-05-12-design-mode-design.md` — Design Mode (bot-generated interactive blocks → note pages)
