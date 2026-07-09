# Chat Streaming Stability & Reveal-on-Remount Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two chat UI bugs: (1) incomplete markdown tables/pills/code-blocks visibly snap from raw text into formatted content mid-stream, with inconsistent reveal pacing, and (2) the word-by-word typing animation replays every time the chat panel unmounts and remounts, because its "already finished" flag is local component state instead of persisted store state.

**Architecture:** A new pure, unit-tested function (`deferIncompleteBlock`) truncates streaming text to the last "safe" (structurally complete) point before handing it to the existing word-reveal hook. The reveal hook's pacing function becomes a fixed constant instead of a value recalculated against the growing text length. A new `hasRevealed` field on the message object (Zustand-persisted, survives remounts) replaces local `useState` as the reveal-completion gate, set once by the single shared stream-completion function (`finishAILoading`) already called from every terminal code path in both streaming functions.

**Tech Stack:** React, Zustand, TypeScript, Vitest.

---

## Reference: current state (verified by direct inspection during planning)

- `src/components/assistant/hooks/useWordReveal.ts` — `getWordRevealDelay` (lines 17-26) recalculates per-word delay against the current growing word count with an 8-second total-time cap. The rest of the hook (tokenization, `isGrowth` detection, interval-based reveal loop) is correct and untouched by this plan.
- `src/components/assistant/components/ChatMessage.tsx` — confirmed current line numbers (re-verify with `grep -n` before editing, since this is a large, actively-touched file and other work may shift them):
  - Line 16: `import { useWordReveal } from '../hooks/useWordReveal';`
  - Line 1066: `const [hasFinishedTypingState, setHasFinishedTypingState] = useState(false);`
  - Lines 1068-1071: the `useWordReveal(targetContent, { enabled: isLast && !hasFinishedTypingState, initialProgress: 'complete' })` call.
  - Lines 1073-1079: the `useEffect` that sets `hasFinishedTypingState` based on `isAILoading`/`isRevealing`.
  - Lines 1080-1093: `displayContent` `useMemo`, reads `revealedText`/`isRevealing`/`isAILoading`/`isLast`/`targetContent`. Untouched by this plan except for its dependency on `revealedText` still working correctly once `useWordReveal` receives `safeContent` instead of `targetContent`.
  - Line 1094: `const hasFinishedTyping = hasFinishedTypingState;` — confirmed dead code, never read anywhere else in the file (verified via `grep -n "hasFinishedTyping\b"` returning only this one line). Deleted outright, not renamed.
  - `stableAppendStreamingCursor` is defined at line 379 and already has its own odd-backtick-count code-fence detection (lines 385-386) — reused by `deferIncompleteBlock`'s code-fence check rather than reimplemented.
- `src/data/store.types.ts` — `AIMessage` interface at line 267, `tokens_used?: number;` at line 285 (insertion point reference for the new field).
- `src/data/store.ts` — `finishAILoading: async (chatId) => {...}` at line 1105, confirmed 9 call sites across `sendAIMessage`/`regenerateAIMessage`'s completion paths (`grep -n "finishAILoading"`). This plan only edits the function's own body, not any call site.
- No `src/components/assistant/utils/` directory exists yet — created fresh by this plan.
- Existing test convention confirmed via `src/lib/bot/services/usageWindows.test.ts`: `vitest`, `describe`/`it`/`expect`, colocated `<name>.test.ts` next to the source file.
- Full design rationale: [docs/superpowers/specs/2026-07-10-streaming-stability-design.md](../specs/2026-07-10-streaming-stability-design.md).

## Out of scope (per spec)

- Consolidating the duplicated SSE-consumption code in `sendAIMessage`/`regenerateAIMessage`.
- Changing the 50ms/30ms store flush-throttle values.
- Any server-side change to `runChain`'s output/chunking.
- A skeleton/shimmer placeholder for deferred blocks (explicitly declined — no placeholder at all).

---

## Task 1: `deferIncompleteBlock` — pure function + tests

**Files:**
- Create: `src/components/assistant/utils/deferIncompleteBlock.ts`
- Test: `src/components/assistant/utils/deferIncompleteBlock.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/components/assistant/utils/deferIncompleteBlock.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { deferIncompleteBlock } from './deferIncompleteBlock'

describe('deferIncompleteBlock', () => {
  it('returns text unchanged when there is no open block', () => {
    const text = 'Just some plain prose with no tables or code.'
    expect(deferIncompleteBlock(text, false)).toBe(text)
  })

  it('truncates an open table with no closing blank line', () => {
    const text = 'Here is a table:\n\n| a | b |\n| - | - |\n| 1 | 2'
    const result = deferIncompleteBlock(text, false)
    expect(result).toBe('Here is a table:')
  })

  it('returns full text when a table is closed by a blank line followed by more prose', () => {
    const text = 'Here is a table:\n\n| a | b |\n| - | - |\n| 1 | 2 |\n\nDone.'
    expect(deferIncompleteBlock(text, false)).toBe(text)
  })

  it('truncates an open code fence', () => {
    const text = 'Some code:\n\n```js\nconst x = 1;'
    const result = deferIncompleteBlock(text, false)
    expect(result).toBe('Some code:')
  })

  it('returns full text when a code fence is closed', () => {
    const text = 'Some code:\n\n```js\nconst x = 1;\n```\n\nDone.'
    expect(deferIncompleteBlock(text, false)).toBe(text)
  })

  it('truncates an open [m]...[/m] pill', () => {
    const text = 'Click here: [m]Open Note'
    const result = deferIncompleteBlock(text, false)
    expect(result).toBe('Click here:')
  })

  it('returns full text when a pill is closed', () => {
    const text = 'Click here: [m]Open Note[/m] to continue.'
    expect(deferIncompleteBlock(text, false)).toBe(text)
  })

  it('always returns full text when isDone is true, regardless of open blocks', () => {
    const text = 'Here is a table:\n\n| a | b |\n| - | - |\n| 1 | 2'
    expect(deferIncompleteBlock(text, true)).toBe(text)
  })

  it('handles empty string', () => {
    expect(deferIncompleteBlock('', false)).toBe('')
    expect(deferIncompleteBlock('', true)).toBe('')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/assistant/utils/deferIncompleteBlock.test.ts`
Expected: FAIL — module not found / `deferIncompleteBlock` is not defined.

- [ ] **Step 3: Implement `deferIncompleteBlock`**

Create `src/components/assistant/utils/deferIncompleteBlock.ts`:

```typescript
/**
 * Given the full accumulated streaming text, returns the text truncated
 * right before any currently-open, not-yet-closed structural block (a GFM
 * table, a fenced code block, or an [m]...[/m] mono-pill), so an incomplete
 * block never renders as raw/broken markdown mid-stream. Once isDone is
 * true, the full original text is always returned regardless of detected
 * open blocks — a safety net so a genuinely malformed/never-closed block
 * doesn't permanently hide content once streaming has stopped.
 */
export function deferIncompleteBlock(text: string, isDone: boolean): string {
  if (isDone || !text) return text

  const openFenceIndex = findOpenCodeFenceStart(text)
  if (openFenceIndex !== -1) {
    return text.slice(0, openFenceIndex).replace(/\s+$/, '')
  }

  const openPillIndex = findOpenPillStart(text)
  if (openPillIndex !== -1) {
    return text.slice(0, openPillIndex).replace(/\s+$/, '')
  }

  const openTableIndex = findOpenTableStart(text)
  if (openTableIndex !== -1) {
    return text.slice(0, openTableIndex).replace(/\s+$/, '')
  }

  return text
}

function findOpenCodeFenceStart(text: string): number {
  const fenceMatches = [...text.matchAll(/```/g)]
  if (fenceMatches.length % 2 === 0) return -1
  // Odd count: the last fence opens a block that never closed.
  return fenceMatches[fenceMatches.length - 1].index ?? -1
}

function findOpenPillStart(text: string): number {
  const lastClose = text.lastIndexOf('[/m]')
  const searchFrom = lastClose === -1 ? 0 : lastClose + 4
  const openIndex = text.indexOf('[m]', searchFrom)
  return openIndex
}

function findOpenTableStart(text: string): number {
  const lines = text.split('\n')
  let openTableStartLine = -1
  let inTable = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const isTableRow = /^\s*\|.*\|\s*$/.test(line)

    if (isTableRow && !inTable) {
      inTable = true
      openTableStartLine = i
    } else if (!isTableRow && line.trim() === '' && inTable) {
      // Blank line closes the table.
      inTable = false
      openTableStartLine = -1
    } else if (!isTableRow && line.trim() !== '' && inTable) {
      // A non-blank, non-table line also closes the table (e.g. stream ended mid-row is
      // the only way inTable stays true through to the end of the loop).
      inTable = false
      openTableStartLine = -1
    }
  }

  if (!inTable || openTableStartLine === -1) return -1

  // Compute the character offset of the start of openTableStartLine.
  let offset = 0
  for (let i = 0; i < openTableStartLine; i++) {
    offset += lines[i].length + 1 // +1 for the '\n' that split() consumed
  }
  return offset
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/assistant/utils/deferIncompleteBlock.test.ts`
Expected: PASS, all 9 tests green.

If any test fails, debug the specific detection function (`findOpenCodeFenceStart`/`findOpenPillStart`/`findOpenTableStart`) rather than adjusting the test's expected value — the test cases are drawn directly from the spec's examples.

- [ ] **Step 5: Commit**

```bash
git add src/components/assistant/utils/deferIncompleteBlock.ts src/components/assistant/utils/deferIncompleteBlock.test.ts
git commit -m "feat(chat): add deferIncompleteBlock to hide incomplete markdown mid-stream"
```

Before committing, run `git status` and confirm ONLY these two files are staged — this repo frequently has unrelated pre-existing uncommitted work in the tree; do not stage anything else, do not run `git add -A`/`git add .`.

---

## Task 2: Fixed word-reveal pacing

**Files:**
- Modify: `src/components/assistant/hooks/useWordReveal.ts`
- Test: `src/components/assistant/hooks/useWordReveal.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/components/assistant/hooks/useWordReveal.test.ts`. This tests only the exported pacing behavior indirectly is hard without a DOM/timer harness for the full hook, so this test targets the specific bug being fixed: the delay must be constant regardless of word count. Since `getWordRevealDelay` is not exported (it's a private helper), this task also exports it for testability — a minimal, justified visibility change:

```typescript
import { describe, it, expect } from 'vitest'
import { getWordRevealDelay } from './useWordReveal'

describe('getWordRevealDelay', () => {
  it('returns the same delay regardless of word count', () => {
    const delays = [0, 1, 2, 3, 10, 100, 1000, 10000].map(getWordRevealDelay)
    const first = delays[0]
    for (const d of delays) {
      expect(d).toBe(first)
    }
  })

  it('returns a positive, reasonably brisk delay', () => {
    const delay = getWordRevealDelay(50)
    expect(delay).toBeGreaterThan(0)
    expect(delay).toBeLessThan(100)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/assistant/hooks/useWordReveal.test.ts`
Expected: FAIL — `getWordRevealDelay` is not exported from the module (or the "same delay regardless of word count" assertion fails against the current growing-total implementation).

- [ ] **Step 3: Replace `getWordRevealDelay` and export it**

In `src/components/assistant/hooks/useWordReveal.ts`, find:

```typescript
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
```

Replace with:

```typescript
const WORD_REVEAL_DELAY_MS = 22; // ~45 words/sec — fixed rate, independent of message length

export function getWordRevealDelay(_wordCount: number): number {
  return WORD_REVEAL_DELAY_MS;
}
```

(The `_wordCount` parameter is kept, prefixed with `_` per convention for an intentionally-unused parameter, so `start()`'s existing call `getWordRevealDelay(total)` at the line below doesn't need to change.)

No other logic in this file changes — the tokenization, `isGrowth` detection, and interval-based reveal loop are correct and untouched.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/assistant/hooks/useWordReveal.test.ts`
Expected: PASS, both tests green.

- [ ] **Step 5: Run the full test suite to confirm no regressions**

Run: `npx vitest run`
Expected: all tests pass (no existing test depended on the old variable-delay behavior — confirmed via `grep -rn "getWordRevealDelay\|useWordReveal" src --include="*.test.ts"` returning no pre-existing test files for this hook before Step 1 created one).

- [ ] **Step 6: Commit**

```bash
git add src/components/assistant/hooks/useWordReveal.ts src/components/assistant/hooks/useWordReveal.test.ts
git commit -m "fix(chat): make word-reveal pacing a fixed rate instead of racing to an 8s cap"
```

Before committing, run `git status` and confirm ONLY these two files are staged.

---

## Task 3: Persisted `hasRevealed` flag

**Files:**
- Modify: `src/data/store.types.ts`
- Modify: `src/data/store.ts`

- [ ] **Step 1: Add `hasRevealed` to the `AIMessage` interface**

In `src/data/store.types.ts`, find:

```typescript
  tokens_used?: number;
```

Replace with:

```typescript
  tokens_used?: number;
  hasRevealed?: boolean;
```

- [ ] **Step 2: Mark the last assistant message as revealed in `finishAILoading`**

In `src/data/store.ts`, find the exact current body of `finishAILoading` (re-verify with `grep -n "finishAILoading: async"` first, since this is a shared, frequently-touched function — if the body has drifted from what's shown below, apply the same conceptual change to the actual current body: add the message-marking logic inside the existing `set(s => (...))` call, keep every other field the existing call already sets):

```typescript
      finishAILoading: async (chatId) => {
        const { activeChatId, activeEntityId, isTempChat } = get();
        const sid = chatId || getChatSessionId(activeChatId, activeEntityId, get().activeSpaceId, isTempChat ? 'temp' : 'global');
        const currentActiveId = getChatSessionId(activeChatId, activeEntityId, get().activeSpaceId, isTempChat ? 'temp' : 'global');
        const isActive = !chatId || chatId === currentActiveId;
        set(s => ({
          isAILoading: isActive ? false : s.isAILoading,
          aiAbortController: isActive ? null : s.aiAbortController,
          loadingStatesMap: { ...s.loadingStatesMap, [sid]: false },
          abortControllersMap: { ...s.abortControllersMap, [sid]: null }
        }));
        const { pendingCompaction, compactAIChat } = get();
        if (pendingCompaction) {
          set({ pendingCompaction: false });
          await compactAIChat();
        }
      },
```

Replace with:

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

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors. (Pre-existing unrelated errors elsewhere in the repo, if any, are not your concern — confirm you introduced none in `store.ts`/`store.types.ts`.)

- [ ] **Step 4: Commit**

```bash
git add src/data/store.types.ts src/data/store.ts
git commit -m "feat(chat): mark the last assistant message as hasRevealed once streaming finishes"
```

Before committing, run `git status` and confirm ONLY these two files are staged.

---

## Task 4: Wire `deferIncompleteBlock` and `hasRevealed` into `ChatMessage.tsx`

**Files:**
- Modify: `src/components/assistant/components/ChatMessage.tsx`

- [ ] **Step 1: Add the `deferIncompleteBlock` import**

Find (line 16):

```typescript
import { useWordReveal } from '../hooks/useWordReveal';
```

Replace with:

```typescript
import { useWordReveal } from '../hooks/useWordReveal';
import { deferIncompleteBlock } from '../utils/deferIncompleteBlock';
```

- [ ] **Step 2: Replace the reveal-gate block**

Find (re-verify current line numbers with `grep -n "hasFinishedTypingState\|useWordReveal(" src/components/assistant/components/ChatMessage.tsx` before editing, since Tasks 1-3 don't touch this file and line numbers should be unchanged from planning time, but confirm anyway):

```typescript
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
```

Replace with:

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

(The `useEffect` that set local `hasFinishedTypingState` is deleted entirely — `msg.hasRevealed`, set once by `finishAILoading` in Task 3, now serves that purpose as persisted state.)

- [ ] **Step 3: Remove the dead `hasFinishedTyping` line**

Find:

```typescript
  const hasFinishedTyping = hasFinishedTypingState;
```

Delete this line entirely. (Confirmed dead — `grep -n "hasFinishedTyping\b" src/components/assistant/components/ChatMessage.tsx` returns only this one declaration line, never read elsewhere in the file.)

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors. If TypeScript flags `hasFinishedTypingState`/`setHasFinishedTypingState` as still referenced somewhere, that means Step 2 or Step 3 missed a call site — search again with `grep -n "hasFinishedTypingState" src/components/assistant/components/ChatMessage.tsx` and remove any remaining reference (there should be none once Steps 2-3 are applied correctly).

- [ ] **Step 5: Manually verify in the browser**

Run: `npm run dev`. In the chat UI:
1. Ask a question that produces a markdown table (e.g. "give me a comparison table of X vs Y"). Confirm the table area shows nothing until the full table has streamed in, then appears fully formatted in one step — no visible raw `| a | b |` text.
2. Ask a short question and a long question. Confirm reveal pacing feels consistent (proportional to length) between them, not racing to finish the long one.
3. Send a message, let it fully complete. Navigate to a different view/entity and back to the chat. Confirm the completed message displays statically — no replay of the typing animation.

If any of these don't hold, do not mark the task complete — debug against the actual running app rather than assuming the code is correct from a read-through alone.

- [ ] **Step 6: Commit**

```bash
git add src/components/assistant/components/ChatMessage.tsx
git commit -m "fix(chat): defer incomplete markdown blocks and use persisted hasRevealed for reveal gating"
```

Before committing, run `git status` and confirm ONLY this one file is staged.

---

## Self-Review Notes

- **Spec coverage:** §1 (defer incomplete blocks) → Tasks 1 and 4 (function + wiring). §2 (fixed pacing) → Task 2. §3 (persisted `hasRevealed`, replacing the `isLast`-only gate) → Tasks 3 and 4. The spec's note that `StatusTyping`/the "thinking" indicator inherits the fix implicitly (same `targetContent`/reveal pipeline) requires no separate task — verified true by inspection (`StatusTyping` is invoked from inside the same `p` markdown renderer that renders final answer text), called out in Task 4 Step 5's manual verification instead of a redundant code task.
- **Type consistency:** `deferIncompleteBlock(text: string, isDone: boolean): string` signature (Task 1) matches its call site in Task 4 Step 2 exactly (`deferIncompleteBlock(targetContent, !isAILoading)`). `getWordRevealDelay`'s export (Task 2) is consumed only by its own test file — no other call site changes needed since `useWordReveal.ts`'s internal `start()` function already calls `getWordRevealDelay(total)` by its existing (now-exported, same) name. `AIMessage.hasRevealed` (Task 3) is read via `msg.hasRevealed` in Task 4 Step 2 — same field name, no drift.
- **Sequencing:** Task 1 (pure function) and Task 2 (hook fix) have no dependency on each other and could be done in either order, but both must land before Task 4, which imports/uses both. Task 3 (store field + `finishAILoading`) is independent of Tasks 1-2 but must also land before Task 4, which reads `msg.hasRevealed`. Task 4 is the integration point and must be last.
- **Placeholder scan:** none found — every step has complete, real code, not descriptions.
