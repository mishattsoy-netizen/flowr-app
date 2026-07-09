# Chat Streaming Stability & Reveal-on-Remount Fix

## Summary

The assistant chat UI has two distinct classes of bugs reported as "feels janky/unstable":

**1. Unstable streaming/formatting** — markdown tables, `[m]...[/m]` mono-pills, and code blocks sometimes render as raw broken text mid-stream, then visibly "snap" into their formatted form once closing syntax arrives. Reveal pacing is inconsistent — sometimes the final message appears instantly with no visible typing, sometimes it's very slow.

**2. Animation replay on remount** — navigating away from the chat panel and back re-triggers the word-by-word reveal animation on the last message and the "thinking" status indicator, even though that content finished streaming and displaying long ago.

Root causes, confirmed by direct code inspection:

- **`src/components/assistant/hooks/useWordReveal.ts`** (`getWordRevealDelay`, lines 17-26): recalculates per-word delay against the *current, still-growing* total token count every time the streaming text grows, with a hard 8-second cap on total reveal time. For long answers, this races to finish and can "catch up" near-instantly; for short bursts it can feel arbitrarily slow or fast depending on exactly how many words have accumulated at each recalculation. Pacing is not tied to real network cadence and is not stable across a single message.
- **No incomplete-markdown handling anywhere in the render path.** `src/components/assistant/components/ChatMessage.tsx` feeds the raw, ever-growing accumulated string straight into `react-markdown` (`remarkGfm`) on every update (lines ~1803-1808). A half-arrived table row (`| foo | bar` with no closing separator row yet) or a half-arrived `[m]...` pill renders as literal text until its closing syntax lands, then re-parses as the formatted element on the next render — this is the visible "snap." There IS a related-but-insufficient existing mechanism, `stableAppendStreamingCursor` (`ChatMessage.tsx:379`), which detects an odd number of ` ``` ` fences and force-appends a closing fence so the streaming cursor doesn't visually break a code block — but this only covers code fences (not tables or pills), and it works by force-closing the block early rather than deferring its render, which is a different (narrower, more ad-hoc) technique than what this spec adopts.
- **The "already finished revealing" flag is local component state, not persisted.** `ChatMessage.tsx:1066`, `const [hasFinishedTypingState, setHasFinishedTypingState] = useState(false)`, resets to `false` on every mount. It gates `useWordReveal`'s `enabled` flag together with `isLast` (`AIAssistant.tsx:875`, `ChatConversation.tsx:159`), which is purely positional — true for whichever message happens to be last in the array, regardless of how long ago it actually finished. `src/components/layout/Shell.tsx:486` conditionally mounts/unmounts `<AIAssistant>` entirely (`{isAiPanelMounted && <AIAssistant .../>}`) rather than hiding it via CSS, so navigating away and back is a genuine full remount, wiping this local flag and replaying the reveal.

## Goals

- Incomplete tables, `[m]...[/m]` pills, and code blocks never render as visible raw/broken markdown mid-stream — the block is held back in full until its closing syntax arrives, then rendered fully formatted in one step. Prose text before and after the block continues streaming normally, uninterrupted.
- Word-reveal pacing is a fixed, predictable per-word rate — no recalculation against a growing total, no hard time cap. Long answers take proportionally longer to reveal; short answers reveal quickly. No "races to catch up" behavior.
- A message that has already finished revealing (in this session) never replays its reveal animation, no matter how many times the containing panel is unmounted and remounted.
- The "thinking"/status indicator inherits the same fix implicitly, since it flows through the same `targetContent`/reveal pipeline as the final answer (confirmed: `StatusTyping` is invoked from inside the same markdown `p` renderer that renders final answer text, not a separate code path).

## Non-goals

- Consolidating the two duplicated SSE-consumption implementations in `sendAIMessage` and `regenerateAIMessage` (`src/data/store.ts`) into one shared function — real duplication, but a separate refactor unrelated to the reported bugs, and touching it risks destabilizing working code for no user-visible benefit right now.
- Changing the SSE chunking/flush-throttle values themselves (currently 50ms in `sendAIMessage`, 30ms in `regenerateAIMessage`) — these just gate how often the store updates, not the actual rendering correctness bugs this spec addresses.
- Changing anything about how `runChain` produces or chunks its own output server-side.
- A skeleton/shimmer placeholder for deferred blocks (considered, explicitly declined) — holding back with no placeholder at all is simpler and sufficient.

## Design

### 1. Defer incomplete structural blocks during streaming

New pure function, e.g. `src/components/assistant/utils/deferIncompleteBlock.ts`, exported and unit-testable in isolation:

```typescript
/**
 * Given the full accumulated streaming text, returns the text truncated
 * right before any currently-open, not-yet-closed structural block
 * (a GFM table row, a fenced code block, or an [m]...[/m] mono-pill).
 * The full original text is returned once the stream is done (isDone=true)
 * or once no block is left open.
 */
export function deferIncompleteBlock(text: string, isDone: boolean): string
```

Detection scans line-by-line from the end for open-block starts:
- **Table**: a line matching `/^\s*\|.*\|\s*$/` (a pipe-delimited row) that is not followed by a blank line and a subsequent non-table line — i.e., we're still inside a contiguous run of `|`-prefixed lines with no blank-line terminator yet.
- **Code fence**: an odd total count of ` ``` ` occurrences in the text — mirrors the existing `stableAppendStreamingCursor` detection (`ChatMessage.tsx:385-386`), reused rather than reimplemented.
- **Mono-pill**: text contains `[m]` after the last `[/m]` (i.e., an unclosed `[m]` tag).

If any of these are detected as open, truncate `text` to end right before the line where that block started (the last preceding blank line, or start of string). If `isDone` is true (stream fully finished), always return the full original text regardless of detected open blocks — this is a safety net so a genuinely malformed/never-closed block (e.g. the model forgot a closing fence) doesn't permanently hide content once streaming has stopped.

This function is applied to `targetContent` before it's handed to `useWordReveal` in `ChatMessage.tsx`, with `isDone` passed as `!isAILoading` (already available in this component's scope, used at lines 1043/1055 for the same purpose — "is this message still actively streaming"):

```typescript
const safeContent = useMemo(
  () => deferIncompleteBlock(targetContent, !isAILoading),
  [targetContent, isAILoading]
);
const { revealedText, isRevealing } = useWordReveal(safeContent, {
  enabled: isLast && !msg.hasRevealed,
  initialProgress: 'complete',
});
```

The reveal animation only ever operates on the "safe" (block-complete-or-absent) prefix of the real content. Once the deferred block's closing syntax arrives in a later store update, the newly-larger "safe" prefix naturally includes it, and reveals it via the normal word-by-word mechanism like any other new content. Once `isAILoading` becomes false (stream genuinely finished, whether or not a block ever looked "open"), `deferIncompleteBlock` always returns the full text — this is what guarantees a message never gets stuck permanently truncated due to a false-positive open-block detection.

Note: this changes what `useWordReveal` receives, not the raw `targetContent` stored in Zustand — the full raw text is always what's persisted; only the client-side reveal input is truncated.

### 2. Fixed word-reveal pacing, no growing-total recalculation, no time cap

In `src/components/assistant/hooks/useWordReveal.ts`, replace `getWordRevealDelay`:

```typescript
// Before: recalculated against current (growing) total word count,
// capped at 8000ms total regardless of length.
function getWordRevealDelay(wordCount: number): number {
  if (wordCount <= 2) return 0;
  let delay = Math.round(Math.min(6000, 2000 + wordCount * 8) / wordCount);
  delay = Math.max(12, Math.min(250, delay));
  const totalMs = wordCount * delay;
  if (totalMs > 8000) {
    delay = Math.max(8, Math.round(8000 / wordCount));
  }
  return delay;
}

// After: fixed rate, independent of total length.
const WORD_REVEAL_DELAY_MS = 22; // ~45 words/sec — tuned to feel brisk, not sluggish
function getWordRevealDelay(_wordCount: number): number {
  return WORD_REVEAL_DELAY_MS;
}
```

`_wordCount` parameter is kept (unused) rather than removed, so the function signature and all call sites in `useWordReveal.ts` (`start()`, line 84) don't need to change — minimal diff.

No other logic in `useWordReveal.ts` changes — the existing `isGrowth` detection (does new text start with old text — i.e., is this an append, not a full replacement) and interval-based reveal loop are correct and untouched. Only the delay's *value source* changes from "computed against a moving target" to "constant."

### 3. Persisted `hasRevealed` flag, replacing the `isLast`-based reveal gate

`src/data/store.types.ts`, `AIMessage` interface: add one optional field, alongside the existing `tokens_used?: number` (no migration needed — purely a client-side/in-memory field, never sent to or read from the DB):

```typescript
hasRevealed?: boolean;
```

`src/data/store.ts`, `finishAILoading(chatId)` (the single shared completion function already called from every terminal code path in both `sendAIMessage` and `regenerateAIMessage` — confirmed via `grep`, 9 call sites, all at stream-completion points): mark the most recent assistant message in the relevant chat's message array as revealed, immediately before or alongside its existing `set(...)` call:

```typescript
finishAILoading: async (chatId) => {
  const { activeChatId, activeEntityId, isTempChat } = get();
  const sid = chatId || getChatSessionId(activeChatId, activeEntityId, get().activeSpaceId, isTempChat ? 'temp' : 'global');
  const currentActiveId = getChatSessionId(activeChatId, activeEntityId, get().activeSpaceId, isTempChat ? 'temp' : 'global');
  const isActive = !chatId || chatId === currentActiveId;

  set(s => {
    const msgs = s.chatMessagesMap[sid];
    const updatedMsgs = msgs && msgs.length > 0
      ? msgs.map((m, idx) => idx === msgs.length - 1 && m.role === 'assistant' ? { ...m, hasRevealed: true } : m)
      : msgs;
    return {
      isAILoading: isActive ? false : s.isAILoading,
      aiAbortController: isActive ? null : s.aiAbortController,
      loadingStatesMap: { ...s.loadingStatesMap, [sid]: false },
      abortControllersMap: { ...s.abortControllersMap, [sid]: null },
      ...(updatedMsgs ? { chatMessagesMap: { ...s.chatMessagesMap, [sid]: updatedMsgs } } : {}),
      ...(isActive && updatedMsgs ? { aiMessages: updatedMsgs } : {}),
      ...(isActive && isTempChat && updatedMsgs ? { tempChatMessages: updatedMsgs } : {}),
    };
  });

  const { pendingCompaction, compactAIChat } = get();
  if (pendingCompaction) {
    set({ pendingCompaction: false });
    await compactAIChat();
  }
},
```

The `idx === msgs.length - 1 && m.role === 'assistant'` guard marks only the last message, and only if it's actually an assistant reply (defensive — avoids marking a stray trailing user message in some edge-case ordering).

`src/components/assistant/components/ChatMessage.tsx`: replace the `isLast && !hasFinishedTypingState` reveal gate (line 1069) with a direct check on the message's own persisted field:

```typescript
// Before:
const [hasFinishedTypingState, setHasFinishedTypingState] = useState(false);
const { revealedText, isRevealing } = useWordReveal(targetContent, {
  enabled: isLast && !hasFinishedTypingState,
  initialProgress: 'complete',
});
useEffect(() => {
  if (isAILoading) {
    setHasFinishedTypingState(false);
  } else if (!isRevealing) {
    setHasFinishedTypingState(true);
  }
}, [isAILoading, isRevealing]);

// After (also incorporates §1's safeContent — see that section for the full combined snippet):
const { revealedText, isRevealing } = useWordReveal(safeContent, {
  enabled: isLast && !msg.hasRevealed,
  initialProgress: 'complete',
});
```

`isLast` is kept as an additional guard (not removed) — it prevents a non-last message from ever entering reveal mode in the first place (e.g. if message ordering briefly glitches), it's just no longer the *only* gate. The local `hasFinishedTypingState`/its `useEffect` are deleted entirely, since `msg.hasRevealed` (persisted, set once in `finishAILoading`) now serves the same purpose without the remount-reset problem. Any other reference to `hasFinishedTyping`/`hasFinishedTypingState` later in the same component (confirmed one more read further down, `const hasFinishedTyping = hasFinishedTypingState`) is updated to read `msg.hasRevealed` instead.

## Testing

- Manual: ask a question that produces a markdown table in the response. Watch the stream arrive. Confirm the table area shows nothing (or the preceding/following prose only) until the full table has arrived, then appears fully formatted in one step — no visible raw `| a | b |` text before the snap.
- Manual: same test with a response containing an `[m]...[/m]` pill and a fenced code block.
- Manual: ask a short question (few-word answer) and a very long question (long, multi-paragraph answer). Confirm reveal pacing feels consistent between them — proportional to length, not racing to finish within a fixed ceiling for the long one.
- Manual: send a message, let it fully stream and complete. Navigate away from the chat panel (e.g. switch to a different entity/view) and back. Confirm the completed message displays statically with no replay of the typing animation, and the "thinking" status text (if it was shown during that turn) does not reappear/retype either.
- Manual: send a message, navigate away WHILE it's still streaming, then navigate back. Confirm reasonable behavior — the in-progress reveal should resume or show the current state, not restart from zero (this exercises the `enabled: isLast && !msg.hasRevealed` gate while `hasRevealed` is still unset, which is expected — only a genuinely *completed* message is protected from replay).
- Automated: unit tests for `deferIncompleteBlock()` covering: complete text with no open blocks (returns unchanged), an open table with no closing blank line (returns truncated), a closed table followed by more prose (returns unchanged/full), an open code fence, a closed code fence, an open `[m]` pill, a closed `[m]...[/m]` pill, and the `isDone=true` override (always returns full text regardless of open-block detection).
- Automated: unit test for `getWordRevealDelay()` confirming it returns the same constant regardless of `wordCount` input (0, 1, 100, 10000).
