# Memory Usage Counter Fix (App + Telegram)

## Summary

The app's "Memory Usage" widget shows 0% when reopening an existing chat session from history, only updating after the next message is sent. Root cause: the widget computes a client-side estimate (`displayedTokens` in `AIAssistant.tsx`) from in-memory loaded messages — an estimate that resets to a "new chat" fallback (0 tokens) whenever the message array doesn't happen to contain an assistant message with a `tokens_used` field attached, which is common right after loading an old session from Supabase (that field is never persisted to the DB, only held in-memory during a live stream).

Meanwhile, a real, DB-persisted, always-fresh number already exists: `bot_session_states.token_usage_total`, updated by `runChain` (the shared entry point for both the web app and the Telegram bot) via `updateSessionState()` on every completed message, regardless of which platform sent it. The app already fetches this value into `aiSessionContext.token_usage_total` via `fetchAISessionContext()` on session open — it's just not being read by the widget.

This spec: (1) fixes the app widget to use the real persisted number, (2) adds a Telegram `/context` command surfacing the same percentage, and (3) confirms — no additional code needed — that cross-platform parity (Telegram and app showing the same counter for the same session) falls out for free once (1) lands, since both platforms already read/write the same `bot_session_states` row.

## Goals

- An existing session with real message history never shows 0% memory usage on open — it shows the real percentage immediately.
- The counter updates only when a message completes (matches current behavior — no mid-stream ticking, no live-typing estimate).
- A new `/context` Telegram command shows the session's memory usage as a percentage only (no raw token counts — those are intentionally hidden from users, matching the app widget's existing practice of only surfacing "34%" not "3,400 tokens").
- Opening a session in the app that was last used via Telegram (or vice versa) shows the same percentage, since both read from the same source.

## Non-goals

- Changing how `token_usage_total` itself is calculated, or the compaction/summarization logic that consumes it.
- A live, mid-stream-updating counter (explicitly rejected in favor of matching current update timing).
- Removing or changing the "legacy raw token count" data itself — only the client-side special-casing logic built around `displayedTokens` is removed, since it's dead weight once the real number is used directly.

## Design

### 1. App widget: read `token_usage_total` directly

In `src/components/assistant/AIAssistant.tsx`:

- Delete the `displayedTokens` computed value (lines ~284–310ish — the full IIFE that reverse-searches `aiMessages` for a `tokens_used` field, applies "legacy vs clean" branching, and adds draft-input token estimates). This logic is being replaced, not extended.
- Every one of its 7 call sites in the Memory Usage widget (the `ContextMeter` `usage` prop, the percentage displays, the progress-bar width/color logic, the "memory full" message threshold check, and the `belowMinTokens` message-count gate) switches to `aiSessionContext?.token_usage_total ?? 0`.
- No change to `context_limit`/`compaction_threshold` reads — those already come from `aiSessionContext` correctly.
- No change to `fetchAISessionContext()` itself, or its call sites (session open, after message completes) — the fetch timing already matches the "update only when I send a message" requirement; only the render logic's data source changes.

Net effect: on session open, `fetchAISessionContext` (already called, per `AIAssistant.tsx:325`) populates `aiSessionContext.token_usage_total` from the real `bot_session_states` row, and the widget now actually displays it instead of silently discarding it in favor of a client-side guess.

### 2. New Telegram `/context` command

`src/lib/bot/telegram-commands.ts`:
- Add `'/context'` to the `COMMANDS` list.
- Add `{ type: 'context' }` to the `BotCommand` union.
- Add a `case '/context': return { type: 'context' }` branch in `parseCommand`.

`src/app/api/telegram/webhook/route.ts`:
- Add a handler alongside the existing `cmd.type === 'status'` block (same location/style — after the auth-gate-requiring commands are resolved, since a session must exist to report on). Calls `getSessionState(activeChatId)` (already imported/available via `@/lib/bot/context`, same function the app's `/api/ai/memory/context` route calls) and replies with a percentage only:

```typescript
if (cmd.type === 'context') {
  if (!linkedAuthUserId || !activeChatId) {
    await telegram.sendMessage(chatId, '🔒 Please /login first to use the bot.')
    return NextResponse.json({ ok: true })
  }
  const { getSessionState } = await import('@/lib/bot/context')
  const sessionState = await getSessionState(activeChatId)
  const pct = sessionState
    ? Math.round((sessionState.token_usage_total / sessionState.context_limit) * 100)
    : 0
  await telegram.sendMessage(chatId, `🧠 *Memory Usage:* ${pct}%`)
  return NextResponse.json({ ok: true })
}
```

No raw token numbers in the reply — matches the app widget's existing convention of only surfacing a rounded percentage.

Add `/context — Session memory usage` to the `/help` command's text listing (alongside the existing `/status`, `/id`, etc. entries), so it's discoverable.

### 3. Cross-platform parity — no additional code

Confirmed structurally guaranteed by existing architecture: `runChain` is the single entry point both the web chat route and the Telegram webhook call, and it calls `updateSessionState(sid, { token_usage_total: totalUsage, ... })` (`chainRouter.ts:1297`) after every completed message on either platform, keyed by the same `chat_id`/`activeChatId` that `syncTelegramMessages` already uses to keep message history in sync between the two. Once the app widget reads this same persisted value (§1), opening a Telegram-active session in the app naturally shows the same percentage — no new sync code needed.

## Testing

- Manual: open an existing chat session with real history from the sidebar/history list. Confirm the Memory Usage widget shows a nonzero percentage immediately, without needing to send a message first.
- Manual: send a message in that session, confirm the percentage updates once the response completes (not before, not mid-stream).
- Manual: in Telegram, send `/context` in a session with existing history. Confirm the reply shows a percentage matching what the app shows for the same session (no raw token numbers in the reply).
- Manual: send a message via Telegram, then open that same session in the app. Confirm the app's Memory Usage percentage matches what `/context` reported after that message.
- Manual: start a genuinely new/empty session (no messages sent yet) in both app and Telegram. Confirm it correctly shows 0% (this is accurate — there's no context yet — not a bug case).
