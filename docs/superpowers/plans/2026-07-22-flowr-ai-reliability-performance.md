# Flowr AI Reliability & Performance Improvement Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the defects found in the 2026-07-22 transcript analysis (stray `###` blocks, invisible patches, fabricated write claims, dead turns, stale logs) and harden the AI pipeline's reliability without touching model configuration.

**Architecture:** All changes are surgical fixes inside the existing bot pipeline: the markdown↔blocks converter (`src/lib/editor/markdownBlocks.ts`), the tool handlers (`src/lib/bot/tools/handlers.ts`), the output guard (`src/lib/bot/outputGuard.ts`), the providers (`src/lib/bot/providers/*.ts`), and the chain router (`src/lib/bot/chainRouter.ts`). Each task is independently shippable.

**Tech Stack:** TypeScript, Next.js, Vitest (`npm test` = `vitest run`), Supabase.

## Global Constraints

- Follow project CLAUDE.md: surgical changes only, no adjacent refactors, match existing style.
- Model configuration (chain order, model IDs, provider selection) is explicitly OUT OF SCOPE — the user handles that separately.
- Test runner: `npx vitest run <file>` for a single file, `npm test` for all.
- All new logic gets a unit test in the same directory as the module (existing convention: `foo.ts` → `foo.test.ts`).
- Never delete user data; content-listing changes may only collapse/summarize, not hide-and-lose.
- Commit after every task with a conventional-commit message.

## Background: evidence from transcripts (2026-07-22, `transcripts/ai-transcript-2026-07-22T*.md`)

1. `### 1. Title` headings from the model became a literal `###` text block + a numbered list restarting at "1." on every item (report note `doc-1784680509355`).
2. A successful `update_content` patch was invisible to the user ("i dont see any updates in note") because the patch path regenerates every block ID; the open editor never reconciled. Cost 3 extra turns.
3. gemini-3.1-flash-lite claimed "I've placed it in a quote block immediately below the title" with zero write calls in the turn — the existing `hasUngroundedActionClaim` guard missed it because "placed" isn't in its verb list.
4. Two dead turns: one where the model's reply was leaked reasoning ("- Wait, let's look at the first row of"), one where the user saw only the fallback "✅ Looked up 3 item(s)" — both were recorded as `success: true`, so the chain never failed over to the next model.
5. A patch op failed because the model sent `find: "<strong>~−$4,865</strong>"` while the note body markdown had `**~−$4,865**` — patch matching doesn't normalize HTML.
6. Every transcript's "Live Logs" section contains the same stale logs from an earlier request — the capture buffer in `src/lib/logger.ts` is module-global and never cleared per request.
7. `list_content` listings carry ~20 orphaned root-level "New Note" entries, wasting input tokens on every tool-enabled turn.
8. Grok emitted entity mentions as `[Title](flowr:folder:...)` without the `@` the renderer expects.
9. Transcripts don't record the raw markdown the model sent to `create_content`/`update_content` — the stored blocks overwrite the `content` arg in `capturedToolCalls` (key collision), which made debugging #1 harder than it should have been.
10. AI-authored notes containing `[@Title](flowr:note:doc-…)` render as a plain underlined `<a target="_blank">` link (the `inlineToHtml` fallback at `markdownBlocks.ts:101`) — clicking tries to open `flowr:note:doc-…` in the browser and does nothing. Chat already renders these as clickable mention pills (`ChatMessage.tsx:1322-1350`); notes should too, and the editor should let the user insert the same pill by typing `@` (search popup, like the existing `/` slash menu).

---

### Task 1: Fix `### 1. Title` heading corruption in the markdown parser

The "forgiving parser" list-splitter fires on the space inside a heading like `### 1. Size that assumed an edge`, splitting it into a bare `###` line plus a numbered-list line. The bare `###` then fails the heading regex and becomes a literal text block.

**Files:**
- Modify: `src/lib/editor/markdownBlocks.ts:158-162` (the `cleanedMd` replaces in `parseMarkdownToBlocks`)
- Modify: `src/lib/editor/markdownBlocks.ts:130` (`classifyLine` — tolerate a bare `###` line)
- Test: `src/lib/editor/markdownBlocks.test.ts`

**Interfaces:**
- Consumes: existing `parseMarkdownToBlocks(md: string): EditorBlock[]`
- Produces: same signature, no API change. Later tasks (3) rely on its output shape being unchanged.

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/editor/markdownBlocks.test.ts` (match the file's existing describe/it style):

```ts
describe('heading + numbered-list interaction', () => {
  it('keeps "### 1. Title" as a single subheading block', () => {
    const blocks = parseMarkdownToBlocks('### 1. Size that assumed an edge')
    expect(blocks).toHaveLength(1)
    expect(blocks[0].type).toBe('text')
    expect(blocks[0].style).toBe('subheading')
    expect(blocks[0].content).toBe('1. Size that assumed an edge')
  })

  it('still splits mashed numbered lists after prose', () => {
    const blocks = parseMarkdownToBlocks('Steps: 1. First 2. Second')
    const numbered = blocks.filter(b => b.type === 'numberedList')
    expect(numbered).toHaveLength(2)
  })

  it('drops a bare ### line instead of emitting a text block', () => {
    const blocks = parseMarkdownToBlocks('###\n1. First item')
    expect(blocks.some(b => b.content === '###')).toBe(false)
    expect(blocks[0].type).toBe('numberedList')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/editor/markdownBlocks.test.ts`
Expected: the first and third new tests FAIL (subheading test gets 2 blocks; bare-`###` test finds the text block).

- [ ] **Step 3: Implement the fix**

In `parseMarkdownToBlocks`, change the numbered-list splitter so it never fires when the preceding non-space character is a heading marker:

```ts
  // Numbered lists: "1. ", "2. ", etc. — but never split a heading like "### 1. Title"
  cleanedMd = cleanedMd.replace(/([^\s#])\s+(\d+\.\s+)/g, '$1\n$2')
```

In `classifyLine`, right after the `line === '---'` check, treat a bare heading-marker line as blank so already-mangled content degrades gracefully:

```ts
  if (/^#{1,6}$/.test(line)) return { indent, kind: { kind: 'blank' } }
```

- [ ] **Step 4: Run the whole markdownBlocks suite**

Run: `npx vitest run src/lib/editor/markdownBlocks.test.ts`
Expected: ALL tests pass (new and pre-existing — the pre-existing suite guards against regressions in the splitter).

- [ ] **Step 5: Commit**

```bash
git add src/lib/editor/markdownBlocks.ts src/lib/editor/markdownBlocks.test.ts
git commit -m "fix(ai): stop list-splitter from mangling '### 1. Title' headings into stray ### blocks"
```

---

### Task 2: HTML-tolerant patch matching in `applyPatchOps`

Models quote note text with HTML (`<strong>…</strong>`) but the patch body is markdown (`**…**`). First attempt fails, wasting a round-trip; weaker models give up entirely.

**Files:**
- Modify: `src/lib/bot/tools/handlers.ts:52-70` (`applyPatchOps`)
- Test: `src/lib/bot/tools/applyPatchOps.test.ts` (create)

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `applyPatchOps(markdown: string, ops: { find: string; replace: string }[]): string` — same exported signature, now with a tag-stripped fallback match. Task 3 calls it unchanged.

- [ ] **Step 1: Write the failing test**

Create `src/lib/bot/tools/applyPatchOps.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { applyPatchOps } from './handlers'

describe('applyPatchOps', () => {
  it('replaces an exact match', () => {
    expect(applyPatchOps('net **~−$4,865** total', [{ find: '~−$4,865', replace: '-$4,699.07' }]))
      .toBe('net **-$4,699.07** total')
  })

  it('falls back to an HTML-stripped find when the raw find misses', () => {
    const body = 'net **~−$4,865** total'
    const out = applyPatchOps(body, [{ find: '<strong>~−$4,865</strong>', replace: '-$4,699.07' }])
    expect(out).toBe('net **-$4,699.07** total')
  })

  it('strips HTML from replace text when falling back', () => {
    const body = 'net ~−$4,865 total'
    const out = applyPatchOps(body, [{ find: '<strong>~−$4,865</strong>', replace: '<strong>-$4,699.07</strong>' }])
    expect(out).toBe('net **-$4,699.07** total')
  })

  it('still throws listing genuinely missing finds', () => {
    expect(() => applyPatchOps('abc', [{ find: 'zzz', replace: 'y' }]))
      .toThrow(/were not found/)
  })
})
```

Note: `handlers.ts` imports `supabaseAdmin` at module level — if importing it in a test environment throws on missing env, move `applyPatchOps` (and only it) into a new file `src/lib/bot/tools/applyPatchOps.ts` and re-export it from `handlers.ts` so existing imports keep working. Prefer not moving it if the import is harmless.

- [ ] **Step 2: Run test to verify the fallback cases fail**

Run: `npx vitest run src/lib/bot/tools/applyPatchOps.test.ts`
Expected: exact-match and missing-find tests PASS; both HTML-fallback tests FAIL with the "were not found" throw.

- [ ] **Step 3: Implement the fallback**

Replace the loop body in `applyPatchOps`:

```ts
export function applyPatchOps(markdown: string, ops: { find: string; replace: string }[]): string {
  let result = markdown
  const missing: string[] = []
  // Models often quote note text as HTML (<strong>x</strong>) while the body
  // is markdown (**x**). If the raw find misses, retry with tags stripped —
  // converting <strong>/<b> to ** so the replacement stays formatted.
  const htmlToMd = (s: string) => s
    .replace(/<\/?(?:strong|b)>/gi, '**')
    .replace(/<\/?(?:em|i)>/gi, '*')
    .replace(/<[^>]+>/g, '')
  for (const op of ops) {
    if (typeof op?.find !== 'string' || typeof op?.replace !== 'string') {
      missing.push(String(op?.find ?? '(invalid op)'))
      continue
    }
    if (result.includes(op.find)) {
      result = result.replace(op.find, op.replace)
      continue
    }
    const strippedFind = htmlToMd(op.find)
    if (strippedFind !== op.find && result.includes(strippedFind)) {
      result = result.replace(strippedFind, htmlToMd(op.replace))
      continue
    }
    missing.push(op.find)
  }
  if (missing.length > 0) {
    throw new Error(`Patch failed — these 'find' strings were not found in the note body: ${missing.map(m => JSON.stringify(m)).join(', ')}`)
  }
  return result
}
```

- [ ] **Step 4: Run tests to verify all pass**

Run: `npx vitest run src/lib/bot/tools/applyPatchOps.test.ts`
Expected: 4/4 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/bot/tools/handlers.ts src/lib/bot/tools/applyPatchOps.test.ts
git commit -m "fix(ai): tolerate HTML-quoted find strings in update_content patch ops"
```

---

### Task 3: Preserve block IDs when patching a note

The patch path does `blocksToMarkdown → applyPatchOps → parseMarkdownToBlocks` (`handlers.ts:451-453`), which regenerates every block ID. Open editors reconcile by block ID, so a successful patch looks like "nothing changed" to the user (the exact complaint in the 00:19 transcript). Re-attach the old IDs to structurally matching blocks.

**Files:**
- Create: `src/lib/editor/reattachBlockIds.ts`
- Modify: `src/lib/bot/tools/handlers.ts:453` (patch branch of `update_content`)
- Test: `src/lib/editor/reattachBlockIds.test.ts`

**Interfaces:**
- Consumes: `EditorBlock` type from `src/lib/editor/markdownBlocks.ts` (or wherever `EditorBlock` is exported — check the import used by `markdownBlocks.ts` itself and reuse it).
- Produces: `reattachBlockIds(oldBlocks: EditorBlock[], newBlocks: EditorBlock[]): EditorBlock[]` — returns `newBlocks` with IDs carried over from `oldBlocks` where blocks correspond.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/editor/reattachBlockIds.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { reattachBlockIds } from './reattachBlockIds'

const b = (id: string, type: string, content: string, extra: object = {}) =>
  ({ id, type, content, ...extra }) as any

describe('reattachBlockIds', () => {
  it('keeps every old ID when only one block content changed', () => {
    const oldB = [b('a', 'text', 'Title'), b('b', 'table', ''), b('c', 'text', 'net ~−$4,865')]
    const newB = [b('x', 'text', 'Title'), b('y', 'table', ''), b('z', 'text', 'net -$4,699.07')]
    const out = reattachBlockIds(oldB, newB)
    expect(out.map(x => x.id)).toEqual(['a', 'b', 'c'])
    expect(out[2].content).toBe('net -$4,699.07')
  })

  it('keeps new IDs for inserted blocks and old IDs around them', () => {
    const oldB = [b('a', 'text', 'one'), b('c', 'text', 'three')]
    const newB = [b('x', 'text', 'one'), b('y', 'text', 'two'), b('z', 'text', 'three')]
    const out = reattachBlockIds(oldB, newB)
    expect(out[0].id).toBe('a')
    expect(out[2].id).toBe('c')
    expect(out[1].id).toBe('y')
  })

  it('never assigns the same old ID twice', () => {
    const oldB = [b('a', 'text', 'dup')]
    const newB = [b('x', 'text', 'dup'), b('y', 'text', 'dup')]
    const out = reattachBlockIds(oldB, newB)
    const ids = out.map(x => x.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('does not reuse an ID across different block types', () => {
    const oldB = [b('a', 'text', 'same')]
    const newB = [b('x', 'quote', 'same')]
    const out = reattachBlockIds(oldB, newB)
    expect(out[0].id).toBe('x')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/editor/reattachBlockIds.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/lib/editor/reattachBlockIds.ts`:

```ts
import type { EditorBlock } from './markdownBlocks'

/**
 * Carry block IDs from a note's previous blocks over to freshly re-parsed
 * blocks so client editors (which reconcile by block ID) see a patch as an
 * in-place edit, not a full replacement.
 *
 * Two passes: (1) exact matches on type+content claim their old ID; (2) the
 * remaining new blocks claim the ID of the nearest unclaimed old block of the
 * same type, scanning outward from the same index. Anything unmatched keeps
 * its freshly generated ID.
 */
export function reattachBlockIds(oldBlocks: EditorBlock[], newBlocks: EditorBlock[]): EditorBlock[] {
  const claimed = new Set<number>()
  const out = newBlocks.map(nb => ({ ...nb }))

  // Pass 1: exact type+content matches, nearest index first.
  for (let i = 0; i < out.length; i++) {
    const idx = findMatch(oldBlocks, out[i], i, claimed, true)
    if (idx !== -1) { out[i].id = oldBlocks[idx].id; claimed.add(idx) }
  }
  // Pass 2: same-type positional matches for content-edited blocks.
  for (let i = 0; i < out.length; i++) {
    if (claimed.size === oldBlocks.length) break
    if (oldBlocks.some((ob, j) => claimed.has(j) && ob.id === out[i].id)) continue
    if (oldBlocks.some((_, j) => claimed.has(j)) && oldBlocks.find((ob, j) => claimed.has(j) && ob.id === out[i].id)) continue
    const already = oldBlocks.some((ob, j) => claimed.has(j) && ob.id === out[i].id)
    if (already) continue
    const idx = findMatch(oldBlocks, out[i], i, claimed, false)
    if (idx !== -1) { out[i].id = oldBlocks[idx].id; claimed.add(idx) }
  }
  return out
}

function findMatch(oldBlocks: EditorBlock[], nb: EditorBlock, around: number, claimed: Set<number>, exact: boolean): number {
  for (let d = 0; d < oldBlocks.length; d++) {
    for (const j of d === 0 ? [around] : [around - d, around + d]) {
      if (j < 0 || j >= oldBlocks.length || claimed.has(j)) continue
      const ob = oldBlocks[j]
      if (ob.type !== nb.type) continue
      if (exact && ob.content !== nb.content) continue
      return j
    }
  }
  return -1
}
```

Simplify pass 2's guard while implementing: the intent is "skip new blocks that already got an old ID in pass 1" — track that with a `Set<number>` of matched new-block indices instead of the ID lookups shown above:

```ts
export function reattachBlockIds(oldBlocks: EditorBlock[], newBlocks: EditorBlock[]): EditorBlock[] {
  const claimedOld = new Set<number>()
  const matchedNew = new Set<number>()
  const out = newBlocks.map(nb => ({ ...nb }))

  for (let i = 0; i < out.length; i++) {
    const idx = findMatch(oldBlocks, out[i], i, claimedOld, true)
    if (idx !== -1) { out[i].id = oldBlocks[idx].id; claimedOld.add(idx); matchedNew.add(i) }
  }
  for (let i = 0; i < out.length; i++) {
    if (matchedNew.has(i)) continue
    const idx = findMatch(oldBlocks, out[i], i, claimedOld, false)
    if (idx !== -1) { out[i].id = oldBlocks[idx].id; claimedOld.add(idx); matchedNew.add(i) }
  }
  return out
}
```

Use the simplified version; it is the implementation of record.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/editor/reattachBlockIds.test.ts`
Expected: 4/4 PASS.

- [ ] **Step 5: Wire into the patch branch**

In `src/lib/bot/tools/handlers.ts`, patch branch of `update_content` (currently line ~453):

```ts
import { reattachBlockIds } from '../../editor/reattachBlockIds'
// ...
          const currentMd = blocksToMarkdown(existing.content || [])
          const patchedMd = applyPatchOps(currentMd, patch)
          updates.content = reattachBlockIds(existing.content || [], parseMarkdownToBlocks(patchedMd))
```

- [ ] **Step 6: Run the full test suite**

Run: `npm test`
Expected: all suites pass (this verifies no other consumer of the patch path broke).

- [ ] **Step 7: Commit**

```bash
git add src/lib/editor/reattachBlockIds.ts src/lib/editor/reattachBlockIds.test.ts src/lib/bot/tools/handlers.ts
git commit -m "fix(ai): preserve block IDs through update_content patches so open editors show the change"
```

---

### Task 4: Catch more fabricated-write phrasings in the grounding guard

`hasUngroundedActionClaim` missed "I've **placed** it in a quote block" because its verb list is only deleted/created/updated/moved. Extend it with the verbs models actually use, keeping the app-entity co-occurrence requirement that prevents prose false positives.

**Files:**
- Modify: `src/lib/bot/outputGuard.ts:74-77` (`ACTION_CLAIM_RE`)
- Test: `src/lib/bot/outputGuard.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `hasUngroundedActionClaim(content, capturedToolCalls)` unchanged signature; Task 5 relies on `MUTATING_TOOLS` also being exported (add `export` to it here).

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/bot/outputGuard.test.ts` (follow its existing import/describe style):

```ts
describe('hasUngroundedActionClaim — extended verbs', () => {
  const readOnly = [{ tool: 'list_content', success: true }]

  it('catches "I\'ve placed it in a quote block" with no write call', () => {
    const reply = "It's right at the top of the note. I've placed it in a quote block immediately below the title."
    expect(hasUngroundedActionClaim(reply, readOnly)).toBe(true)
  })

  it('catches "I added the balance to your note"', () => {
    expect(hasUngroundedActionClaim('I added the balance to your note.', readOnly)).toBe(true)
  })

  it('catches "has been saved to the folder"', () => {
    expect(hasUngroundedActionClaim('The report has been saved to the folder.', readOnly)).toBe(true)
  })

  it('does not flag prose without app entities', () => {
    expect(hasUngroundedActionClaim('The company was created in 2019 and has been renamed twice.', readOnly)).toBe(false)
  })

  it('does not flag when a mutation succeeded', () => {
    const calls = [{ tool: 'update_content', success: true }]
    expect(hasUngroundedActionClaim('I added the balance to your note.', calls)).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify the new-verb cases fail**

Run: `npx vitest run src/lib/bot/outputGuard.test.ts`
Expected: the three "catches" tests FAIL; the two negative tests PASS.

- [ ] **Step 3: Extend the regex and export MUTATING_TOOLS**

```ts
// Conservative: only past/perfect claims of completed content mutations.
const ACTION_CLAIM_RE =
  /\b(has been|have been|was|were|already)\s+(permanently\s+)?(deleted|created|updated|moved|renamed|placed|added|appended|saved|written|logged|inserted)\b|\b(successfully)\s+(deleted|created|updated|moved|placed|added|appended|saved)\b|\bI (have|'ve) (deleted|created|updated|moved|placed|added|appended|saved|written|logged|inserted)\b|\bI (added|placed|appended|saved|wrote|logged|inserted)\b/i
```

Also change `const MUTATING_TOOLS` to `export const MUTATING_TOOLS` (Task 5 imports it).

- [ ] **Step 4: Run the full outputGuard suite**

Run: `npx vitest run src/lib/bot/outputGuard.test.ts`
Expected: ALL pass, including pre-existing tests (they guard against over-matching).

- [ ] **Step 5: Commit**

```bash
git add src/lib/bot/outputGuard.ts src/lib/bot/outputGuard.test.ts
git commit -m "fix(ai): grounding guard catches placed/added/appended/saved fabricated-write claims"
```

---

### Task 5: Dead read-only turns fail over to the next model instead of showing "✅ Looked up N item(s)"

When a model runs tools but emits no final text, every provider substitutes `summarizeToolCalls(...)`. That's the right behavior when a mutation succeeded (the user learns what happened) — but when the turn was read-only, the user asked for something and got "✅ Looked up 3 item(s)". Throwing instead lets the existing chain failover retry with the next (stronger) model — which is exactly what fixed this session when the user manually typed "try again".

**Files:**
- Create: `src/lib/bot/services/emptyToolTurn.ts`
- Modify: `src/lib/bot/providers/google.ts:288-290`
- Modify: `src/lib/bot/providers/groq.ts:~172`
- Modify: `src/lib/bot/providers/nvidia.ts:~177`
- Modify: `src/lib/bot/providers/openrouter.ts:~258`
- Test: `src/lib/bot/services/emptyToolTurn.test.ts`

**Interfaces:**
- Consumes: `MUTATING_TOOLS` exported from `src/lib/bot/outputGuard.ts` (Task 4).
- Produces: `shouldFailEmptyToolTurn(capturedToolCalls: any[]): boolean` — true when the turn must be treated as an empty response (throw), false when the summary fallback is acceptable.

- [ ] **Step 1: Write the failing test**

Create `src/lib/bot/services/emptyToolTurn.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { shouldFailEmptyToolTurn } from './emptyToolTurn'

describe('shouldFailEmptyToolTurn', () => {
  it('fails a turn with only successful reads', () => {
    expect(shouldFailEmptyToolTurn([{ tool: 'list_content', success: true }])).toBe(true)
  })

  it('allows the summary when a mutation succeeded', () => {
    expect(shouldFailEmptyToolTurn([
      { tool: 'list_content', success: true },
      { tool: 'create_content', success: true },
    ])).toBe(false)
  })

  it('allows the summary when a mutation failed (user must see the error)', () => {
    expect(shouldFailEmptyToolTurn([{ tool: 'delete_content', success: false, error: 'not found' }])).toBe(false)
  })

  it('allows the summary for a pending confirmation', () => {
    expect(shouldFailEmptyToolTurn([{ tool: 'delete_content', status: 'pending_confirmation', success: false }])).toBe(false)
  })

  it('fails an empty call list', () => {
    expect(shouldFailEmptyToolTurn([])).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/bot/services/emptyToolTurn.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/lib/bot/services/emptyToolTurn.ts`:

```ts
import { MUTATING_TOOLS } from '../outputGuard'

/**
 * A model that ran tools but produced no reply text is only salvageable when
 * the tool activity itself tells the user something: a mutation happened, a
 * mutation failed, or a confirmation is pending. A read-only turn with no
 * text is a dead turn — the caller should throw so the chain fails over to
 * the next model instead of showing "Looked up N item(s)".
 */
export function shouldFailEmptyToolTurn(capturedToolCalls: any[]): boolean {
  const calls = capturedToolCalls ?? []
  return !calls.some(c =>
    MUTATING_TOOLS.has(c?.tool) || c?.status === 'pending_confirmation'
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/bot/services/emptyToolTurn.test.ts`
Expected: 5/5 PASS.

- [ ] **Step 5: Wire into all four providers**

In each provider, at the existing `summarizeToolCalls` substitution site, guard it. The google.ts site (`~line 288`) becomes:

```ts
          if (!responseContent && capturedToolCalls.length >= 0 && !responseContent) {
            // keep original condition shape — see below
          }
```

Concretely, replace:

```ts
          if (!responseContent && capturedToolCalls.length > 0) {
            responseContent = summarizeToolCalls(capturedToolCalls)
          }
```

with:

```ts
          if (!responseContent && capturedToolCalls.length > 0) {
            if (shouldFailEmptyToolTurn(capturedToolCalls)) {
              throw new Error('Model ran read-only tools and produced no reply — treating as empty response')
            }
            responseContent = summarizeToolCalls(capturedToolCalls)
          }
```

and add the import at the top of each provider:

```ts
import { shouldFailEmptyToolTurn } from '../services/emptyToolTurn'
```

Apply the same replacement in `groq.ts` (`finalContent` variable), `nvidia.ts` (`finalContent`), and `openrouter.ts` (`finalContent`) — the variable name differs, the pattern is identical. Do NOT touch the sites where content is empty with zero tool calls; those already throw.

- [ ] **Step 6: Run the full test suite**

Run: `npm test`
Expected: all pass. (Provider files likely have no direct tests; the suite catches import/type errors via any modules that import them.)

- [ ] **Step 7: Manual smoke check via transcript replay**

Start the dev server, send a read-only prompt that a weak model tends to drop (e.g. "list my workspaces" is fine — it produces text; instead verify by temporarily reviewing logs on real traffic). Acceptance: a turn that previously ended as "✅ Looked up N item(s)" now shows a real reply produced by a failover model, and the transcript's Routing Trace shows the first model with `success: false`.

- [ ] **Step 8: Commit**

```bash
git add src/lib/bot/services/emptyToolTurn.ts src/lib/bot/services/emptyToolTurn.test.ts src/lib/bot/providers/google.ts src/lib/bot/providers/groq.ts src/lib/bot/providers/nvidia.ts src/lib/bot/providers/openrouter.ts
git commit -m "fix(ai): read-only turns with no reply text fail over to the next model"
```

---

### Task 6: Per-request Live Logs in transcripts

`capturedLogs` in `src/lib/logger.ts` is a module-global buffer that is never cleared, so every transcript's "Live Logs" section shows stale logs from earlier requests (all eight 2026-07-22 transcripts carry the same 00:07:29 block). Capture a start marker per request and slice.

**Files:**
- Modify: `src/lib/logger.ts` (add `getCapturedLogsSince`)
- Modify: `src/lib/bot/chainRouter.ts` (record request start time, pass sliced logs into `buildTranscript` as `capturedLogs`)
- Test: `src/lib/logger.test.ts` (create)

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `getCapturedLogsSince(sinceIso: string): LogEntry[]` in `src/lib/logger.ts`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/logger.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { logger, getCapturedLogsSince, clearCapturedLogs } from './logger'

describe('getCapturedLogsSince', () => {
  beforeEach(() => clearCapturedLogs())

  it('returns only entries at or after the marker', async () => {
    logger.info('old entry')
    await new Promise(r => setTimeout(r, 5))
    const marker = new Date().toISOString()
    logger.info('new entry')
    const logs = getCapturedLogsSince(marker)
    expect(logs.some(l => l.message.includes('new entry'))).toBe(true)
    expect(logs.some(l => l.message.includes('old entry'))).toBe(false)
  })
})
```

(Adjust the `logger` import name to whatever `src/lib/logger.ts` actually exports — check the file's export block first; the capture push is at line 21.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/logger.test.ts`
Expected: FAIL — `getCapturedLogsSince` is not exported.

- [ ] **Step 3: Implement**

In `src/lib/logger.ts`, next to `getCapturedLogs`:

```ts
export function getCapturedLogsSince(sinceIso: string): LogEntry[] {
  return capturedLogs.filter(l => l.timestamp >= sinceIso)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/logger.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire into the transcript build**

In `src/lib/bot/chainRouter.ts`: at the top of the main chain entry function (same scope where `routingTrace` is initialized), capture:

```ts
  const requestStartIso = new Date().toISOString()
```

Then find the `buildTranscript({ ... })` call (line ~1293) and pass:

```ts
              capturedLogs: getCapturedLogsSince(requestStartIso),
```

adding the import:

```ts
import { getCapturedLogsSince } from '../logger'
```

`buildTranscript` already prefers `d.capturedLogs` when non-empty (`transcript.ts:42`), so no change there. Note: do NOT call `clearCapturedLogs()` per request — concurrent requests share the buffer; slicing is safe, clearing is not.

- [ ] **Step 6: Run the full suite and commit**

Run: `npm test` → all pass.

```bash
git add src/lib/logger.ts src/lib/logger.test.ts src/lib/bot/chainRouter.ts
git commit -m "fix(ai): transcripts capture only this request's live logs, not the global stale buffer"
```

---

### Task 7: Collapse untitled "New Note" noise in list_content results

Root-level listings currently include ~20 empty "New Note" entities, wasting model input tokens on every tool-enabled turn and pushing real items toward the 40k truncation cap. Collapse them into one summary entry when the model is browsing (no `searchQuery`); keep them fully visible when a search targets them or `readContent` is requested.

**Files:**
- Modify: `src/lib/bot/tools/handlers.ts` (list_content handler — locate it via `grep -n "list_content" src/lib/bot/tools/handlers.ts`, it's the first handler in the exported map)
- Create: `src/lib/bot/tools/collapseUntitled.ts`
- Test: `src/lib/bot/tools/collapseUntitled.test.ts`

**Interfaces:**
- Consumes: the item shape list_content returns: `{ id, title, type, description, parent_id, last_modified }`.
- Produces: `collapseUntitledNotes(items: any[]): { items: any[]; collapsedCount: number }` — pure function applied to the result list.

- [ ] **Step 1: Write the failing test**

Create `src/lib/bot/tools/collapseUntitled.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { collapseUntitledNotes } from './collapseUntitled'

const note = (id: string, title: string) =>
  ({ id, title, type: 'note', description: null, parent_id: null, last_modified: 1 })

describe('collapseUntitledNotes', () => {
  it('collapses multiple root-level "New Note" items into a count', () => {
    const items = [note('a', 'New Note'), note('b', 'New Note'), note('c', 'Real Note')]
    const { items: out, collapsedCount } = collapseUntitledNotes(items)
    expect(collapsedCount).toBe(2)
    expect(out).toHaveLength(1)
    expect(out[0].title).toBe('Real Note')
  })

  it('keeps a single "New Note" (may be the one the user means)', () => {
    const items = [note('a', 'New Note'), note('c', 'Real Note')]
    const { items: out, collapsedCount } = collapseUntitledNotes(items)
    expect(collapsedCount).toBe(0)
    expect(out).toHaveLength(2)
  })

  it('never collapses non-note types or titled items', () => {
    const items = [
      { ...note('a', 'New Note'), type: 'folder' },
      { ...note('b', 'New Note'), type: 'folder' },
    ]
    expect(collapseUntitledNotes(items).collapsedCount).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/bot/tools/collapseUntitled.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/lib/bot/tools/collapseUntitled.ts`:

```ts
/**
 * Untitled scratch notes ("New Note") accumulate at workspace root and bloat
 * every browse-mode list_content payload. Collapse 2+ of them into a count the
 * model can relay ("…plus N untitled notes") — data is untouched, only the
 * listing is summarized. Searches and readContent calls bypass this entirely.
 */
export function collapseUntitledNotes(items: any[]): { items: any[]; collapsedCount: number } {
  const isUntitled = (it: any) => it?.type === 'note' && (it?.title === 'New Note' || !it?.title?.trim())
  const untitled = items.filter(isUntitled)
  if (untitled.length < 2) return { items, collapsedCount: 0 }
  return { items: items.filter(it => !isUntitled(it)), collapsedCount: untitled.length }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/bot/tools/collapseUntitled.test.ts`
Expected: 3/3 PASS.

- [ ] **Step 5: Wire into list_content**

In the list_content handler in `handlers.ts`, at the point where the final `{ success: true, count, items }` result is assembled, apply the collapse ONLY when browsing (no `searchQuery` and no `readContent`):

```ts
import { collapseUntitledNotes } from './collapseUntitled'
// ... inside list_content, before returning:
        if (!args.searchQuery && !args.readContent) {
          const collapsed = collapseUntitledNotes(resultItems)
          if (collapsed.collapsedCount > 0) {
            resultItems = collapsed.items
            ;(result as any).untitled_notes_hidden = collapsed.collapsedCount
          }
        }
```

Adapt variable names to the handler's actual locals (read the handler before editing). The `untitled_notes_hidden` field tells the model the omission exists, so it can still say "you also have N untitled notes" or search for them explicitly.

- [ ] **Step 6: Run the full suite and commit**

Run: `npm test` → all pass.

```bash
git add src/lib/bot/tools/collapseUntitled.ts src/lib/bot/tools/collapseUntitled.test.ts src/lib/bot/tools/handlers.ts
git commit -m "perf(ai): collapse untitled New Note clutter from browse-mode list_content payloads"
```

---

### Task 8: Normalize entity mentions missing the `@` prefix

Grok emitted `[Trades analysis reports](flowr:folder:...)` — valid link, wrong syntax for the pill renderer, which expects `[@Title](flowr:type:id)`. Normalize in the output pipeline instead of hoping every model obeys the prompt.

**Files:**
- Modify: `src/lib/bot/outputGuard.ts` (add `normalizeEntityMentions`)
- Modify: `src/lib/bot/chainRouter.ts:1265-1266` (call it after `stripToolAnnotations`)
- Test: `src/lib/bot/outputGuard.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `normalizeEntityMentions(content: string): string`.

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/bot/outputGuard.test.ts`:

```ts
describe('normalizeEntityMentions', () => {
  it('adds the missing @ to flowr entity links', () => {
    expect(normalizeEntityMentions('See [My Note](flowr:note:doc-123).'))
      .toBe('See [@My Note](flowr:note:doc-123).')
  })

  it('leaves correct mentions untouched', () => {
    const s = 'See [@My Note](flowr:note:doc-123).'
    expect(normalizeEntityMentions(s)).toBe(s)
  })

  it('ignores ordinary URLs', () => {
    const s = 'See [docs](https://example.com).'
    expect(normalizeEntityMentions(s)).toBe(s)
  })
})
```

- [ ] **Step 2: Run tests to verify the first fails**

Run: `npx vitest run src/lib/bot/outputGuard.test.ts`
Expected: first test FAILS (function missing), others fail to compile — that's the expected failure state.

- [ ] **Step 3: Implement**

In `src/lib/bot/outputGuard.ts`:

```ts
/** The pill renderer requires [@Title](flowr:type:id); models sometimes drop the @. */
export function normalizeEntityMentions(content: string): string {
  if (!content) return content
  return content.replace(/\[(?!@)([^\]\n]+)\]\((flowr:(?:note|folder|canvas|workspace):[^)\s]+)\)/g, '[@$1]($2)')
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/bot/outputGuard.test.ts`
Expected: ALL pass.

- [ ] **Step 5: Wire into chainRouter**

At `chainRouter.ts` where the reply is finalized (currently):

```ts
              finalContent = sanitizeOutput(finalContent)
              finalContent = stripToolAnnotations(finalContent)
```

add:

```ts
              finalContent = normalizeEntityMentions(finalContent)
```

and extend the existing import from `./outputGuard`.

- [ ] **Step 6: Run the full suite and commit**

Run: `npm test` → all pass.

```bash
git add src/lib/bot/outputGuard.ts src/lib/bot/outputGuard.test.ts src/lib/bot/chainRouter.ts
git commit -m "fix(ai): auto-repair entity mentions missing the @ prefix"
```

---

### Task 9: Record the model's raw markdown args in transcripts

`capturedToolCalls.push({ ...call.args, ...output, ... })` lets `output.content` (the stored blocks) overwrite `call.args.content` (the raw markdown the model sent). Debugging Task 1's bug required inferring the raw markdown from the block structure. Preserve a truncated copy.

**Files:**
- Modify: `src/lib/bot/providers/google.ts:272` (the `capturedToolCalls.push` in the tool loop)
- Modify: the equivalent `capturedToolCalls.push` in `src/lib/bot/providers/groq.ts`, `src/lib/bot/providers/nvidia.ts`, `src/lib/bot/providers/openrouter.ts` (find with `grep -n "capturedToolCalls.push" src/lib/bot/providers/*.ts`)
- Test: none practical at the provider level — verify via a transcript smoke check (Step 3).

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `raw_args_content?: string` field on captured tool-call entries; the transcript renders it automatically inside the existing Tool Calls JSON dump.

- [ ] **Step 1: Implement in all four providers**

Replace each push of the form:

```ts
                capturedToolCalls.push({ ...call.args, ...output, tool: call.name, success: !output?.error && !isPending })
```

with:

```ts
                capturedToolCalls.push({
                  ...call.args,
                  ...output,
                  ...(typeof call.args?.content === 'string'
                    ? { raw_args_content: call.args.content.slice(0, 4000) }
                    : {}),
                  tool: call.name,
                  success: !output?.error && !isPending,
                })
```

Keep each provider's exact local variable names (`call` vs `toolCall` etc. — read before editing).

- [ ] **Step 2: Run the full suite**

Run: `npm test`
Expected: all pass (type/compile safety).

- [ ] **Step 3: Smoke check**

Trigger one AI note creation in the dev app, open the newest file in `transcripts/`, and confirm the create_content entry in "## Tool Calls" now contains `raw_args_content` with the model's original markdown (` ### `-style headings visible pre-conversion).

- [ ] **Step 4: Commit**

```bash
git add src/lib/bot/providers/google.ts src/lib/bot/providers/groq.ts src/lib/bot/providers/nvidia.ts src/lib/bot/providers/openrouter.ts
git commit -m "chore(ai): record raw markdown tool args in transcripts for debugging"
```

---

### Task 10: Delete the orphaned "New Note" scratch entities (one-time data cleanup, user-confirmed)

Task 7 hides the noise from the model; the ~20 root-level empty "New Note" entities are still real rows the user probably doesn't want. This is user data — do NOT script-delete it silently.

**Files:** none (data operation).

- [ ] **Step 1: Enumerate them**

Query via the app (or Supabase dashboard): entities where `title = 'New Note'`, `parent_id IS NULL`, and content is empty/default. Produce the exact list of IDs + last-modified dates.

- [ ] **Step 2: Show the list to the user and get explicit confirmation**

Present the list. Only proceed for the rows the user approves. If any have content, exclude them and say so.

- [ ] **Step 3: Delete approved rows and verify**

Delete via the app's own delete path (soft-delete/trash if it exists — check how `delete_content` works before choosing the mechanism). Verify with a fresh list_content that they're gone and Task 7's `untitled_notes_hidden` count drops to 0.

---

### Task 11: Mention pills in note content — serialization layer

`inlineToHtml` (`src/lib/editor/markdownBlocks.ts:67-107`) sends `[@Title](flowr:note:id)` to the generic-link fallback, producing `<a href="flowr:note:id" target="_blank">@Title</a>` — a dead link in the browser. Route `flowr:` links to a mention-pill anchor instead, and make `htmlToText` round-trip it back to `[@Title](flowr:type:id)` so patches and exports preserve it.

**Files:**
- Modify: `src/lib/editor/markdownBlocks.ts:77-103` (`inlineToHtml` link replacement)
- Modify: `src/lib/editor/markdownBlocks.ts:271-294` (`htmlToText`)
- Test: `src/lib/editor/markdownBlocks.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: mention anchors of the exact shape `<a href="flowr:<type>:<id>" data-mention="1" class="entity-pill" contenteditable="false">Title</a>`. Tasks 12 and 13 target the `data-mention="1"` attribute and `a[href^="flowr:"]` selector — keep both stable.

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/editor/markdownBlocks.test.ts`:

```ts
describe('flowr entity mention pills', () => {
  it('converts [@Title](flowr:note:id) to a mention-pill anchor', () => {
    const blocks = parseMarkdownToBlocks('See [@Trade History](flowr:note:doc-123) for data.')
    expect(blocks[0].content).toContain('data-mention="1"')
    expect(blocks[0].content).toContain('href="flowr:note:doc-123"')
    expect(blocks[0].content).toContain('contenteditable="false"')
    expect(blocks[0].content).toContain('>Trade History</a>')
    expect(blocks[0].content).not.toContain('target="_blank"')
  })

  it('handles a flowr link whose label lacks the @ prefix', () => {
    const blocks = parseMarkdownToBlocks('See [Trade History](flowr:note:doc-123).')
    expect(blocks[0].content).toContain('data-mention="1"')
    expect(blocks[0].content).toContain('>Trade History</a>')
  })

  it('round-trips a mention pill back to [@Title](flowr:type:id) markdown', () => {
    const md = 'See [@Trade History](flowr:note:doc-123) for data.'
    const roundTripped = blocksToMarkdown(parseMarkdownToBlocks(md))
    expect(roundTripped).toContain('[@Trade History](flowr:note:doc-123)')
  })

  it('leaves ordinary web links untouched', () => {
    const blocks = parseMarkdownToBlocks('See [docs](https://example.com).')
    expect(blocks[0].content).toContain('target="_blank"')
    expect(blocks[0].content).not.toContain('data-mention')
  })
})
```

(`blocksToMarkdown` is already exported — it's imported by `handlers.ts`. Import it in the test alongside `parseMarkdownToBlocks`.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/editor/markdownBlocks.test.ts`
Expected: the three mention tests FAIL; the web-link test PASSES.

- [ ] **Step 3: Implement in `inlineToHtml`**

Inside the link `s.replace(...)` callback in `inlineToHtml`, immediately after `displayLabel` is computed and BEFORE the `if (isPill)` branch, add:

```ts
    // Entity mentions: [@Title](flowr:type:id) — render as a mention pill,
    // never as a navigable browser link (flowr: is not a real protocol).
    if (cleanUrl.startsWith('flowr:')) {
      const mentionLabel = displayLabel.startsWith('@') ? displayLabel.slice(1) : displayLabel;
      return `<a href="${cleanUrl}" data-mention="1" class="entity-pill" contenteditable="false">${mentionLabel}</a>`;
    }
```

- [ ] **Step 4: Implement in `htmlToText`**

At the TOP of `htmlToText` (before the existing `entity-pill` rules, which would otherwise claim these anchors and emit the wrong `[pill:…]` syntax), add:

```ts
  // Mention pills round-trip as [@Title](flowr:type:id) — must run before the
  // generic entity-pill rules below.
  s = s.replace(/<a[^>]*data-mention="1"[^>]*href="(flowr:[^"]*)"[^>]*>([^<]*)<\/a>/g, '[@$2]($1)');
  s = s.replace(/<a[^>]*href="(flowr:[^"]*)"[^>]*data-mention="1"[^>]*>([^<]*)<\/a>/g, '[@$2]($1)');
```

(Two variants because attribute order differs between our generated HTML and browser-normalized contentEditable output — same defensive pattern the existing entity-pill rules use.)

- [ ] **Step 5: Run the full markdownBlocks suite**

Run: `npx vitest run src/lib/editor/markdownBlocks.test.ts`
Expected: ALL pass, including Task 1's tests and the pre-existing suite.

- [ ] **Step 6: Commit**

```bash
git add src/lib/editor/markdownBlocks.ts src/lib/editor/markdownBlocks.test.ts
git commit -m "feat(editor): serialize flowr entity links as mention pills instead of dead browser links"
```

---

### Task 12: Mention pills in note content — styling and click-to-open

Give `flowr:` anchors inside note blocks the same pill look as chat mentions, and make clicking them open the entity in the app. Use the `a[href^="flowr:"]` attribute selector so notes saved BEFORE Task 11 (plain `<a href="flowr:…">` with no classes — e.g. the existing Report #1 note) get the styling and behavior too, with no data migration.

**Files:**
- Modify: `src/app/globals.css` (append pill styles)
- Modify: `src/components/editor/BlockRenderer.tsx` (click handling — the component already delegates clicks; find the existing content click handler via `grep -n "onClick" src/components/editor/BlockRenderer.tsx` around the `data-block-content` element at line ~1479)
- Test: manual (contentEditable DOM behavior; no vitest DOM harness exists in this repo for the editor — verify via the checklist in Step 4)

**Interfaces:**
- Consumes: anchor shape from Task 11 (`a[href^="flowr:"]`, optional `data-mention="1"`).
- Produces: nothing consumed by later tasks; Task 13 inserts anchors that this task styles.

- [ ] **Step 1: Add pill styling to globals.css**

Append (matching the chat pill's look — `bg-[var(--bone-6)]`, hover `--bone-10`, 8px radius, 13px medium text — translated to plain CSS since this is stored-HTML content, not JSX):

```css
/* ── Entity mention pills inside note blocks (flowr:<type>:<id> anchors) ──
   Attribute selector on purpose: also upgrades legacy plain <a> links saved
   before pills existed. */
[data-block-content] a[href^="flowr:"] {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 1px 6px;
  margin: 0 1px;
  border-radius: 8px;
  background: var(--bone-6);
  color: var(--bone-100);
  font-weight: 500;
  font-size: 0.925em;
  letter-spacing: -0.01em;
  text-decoration: none;
  cursor: pointer;
  user-select: all;
  transition: background-color 0.15s ease;
  vertical-align: baseline;
}
[data-block-content] a[href^="flowr:"]:hover {
  background: var(--bone-10);
}
[data-block-content] a[href^="flowr:"]::before {
  content: '@';
  opacity: 0.55;
  font-weight: 600;
}
```

- [ ] **Step 2: Open the entity on click**

In `BlockRenderer.tsx`, in the click handler attached to the block content (the same handler tree that hosts `handleContextMenu` at line ~250 — read the component's existing `onClick` on the `data-block-content` element first and add to it, or add a new delegated handler beside `handleContextMenu` if none exists):

```tsx
  const handleMentionClick = useCallback((e: React.MouseEvent) => {
    const anchor = (e.target as HTMLElement).closest('a') as HTMLAnchorElement | null;
    if (!anchor || !contentRef.current?.contains(anchor)) return;
    const href = anchor.getAttribute('href') || '';
    if (!href.startsWith('flowr:')) return;
    e.preventDefault();
    e.stopPropagation();
    const [, type, ...idParts] = href.split(':');
    const id = idParts.join(':');
    if (!type || !id) return;
    const store = useStore.getState();
    if (type === 'workspace' && store.spaces.some(s => s.id === id)) {
      store.setActiveSpaceId(id);
    } else {
      store.addTab(id);
    }
  }, []);
```

Wire it: `onClick={handleMentionClick}` on the same element that has `onContextMenu={handleContextMenu}` (composing with any existing onClick — call the existing handler after the mention check falls through). `useStore` — add to the component's existing imports from `@/data/store` (check what path `BlockRenderer.tsx` already imports the store from and reuse it; `ChatMessage.tsx:1325` shows the same `useStore.getState()` pattern).

Also verify the hover popup (`activeInlineBtn`, line ~224) still appears for flowr anchors — it should, and its OPEN action gets fixed for free in Step 3.

- [ ] **Step 3: Fix the hover popup's OPEN action for flowr links**

The COPY/OPEN/DELETE popup (visible in the user's screenshot) currently treats `flowr:note:doc-…` as a URL and opens it in the browser (nothing happens). Find the popup's OPEN handler (`grep -n "isStandardLink\|window.open" src/components/editor/BlockRenderer.tsx`) and branch:

```tsx
  if (activeInlineBtn.url.startsWith('flowr:')) {
    const [, type, ...idParts] = activeInlineBtn.url.split(':');
    const id = idParts.join(':');
    const store = useStore.getState();
    if (type === 'workspace' && store.spaces.some(s => s.id === id)) store.setActiveSpaceId(id);
    else if (id) store.addTab(id);
  } else {
    window.open(/* existing behavior unchanged */)
  }
```

- [ ] **Step 4: Manual verification checklist**

Run the dev app and confirm:
1. The existing Report #1 note's `@Trade History — $60K Funded Account` link now renders as a pill (legacy anchor, no data-mention attribute — proves the attribute-selector path).
2. Clicking it opens the Trade History note in a tab.
3. Ask the AI to create a note referencing another note — the new note shows a pill (Task 11 path).
4. A normal `https://` link in a note still opens in the browser.
5. Hover popup OPEN on a flowr link opens the entity in-app.

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css src/components/editor/BlockRenderer.tsx
git commit -m "feat(editor): render flowr entity links as clickable mention pills in notes"
```

---

### Task 13: `@` mention popup in the note editor

Typing `@` in a note block opens a caret-anchored popup listing entities (notes, folders, canvases, workspaces); typing filters live; Enter/click inserts the same mention pill Task 11/12 defined, replacing the typed `@query`. Modeled directly on the existing slash-menu machinery: trigger in `NoteEditor.tsx`'s keydown (`'/'` case, line ~1447), query derivation (`slashQuery`, line ~2006), inline insertion (the `type === 'link'` branch of `insertBlock`, lines ~1723-1772), and `SlashCommandMenu.tsx` for the popup component's keyboard/outside-click/scroll-close patterns.

**Files:**
- Create: `src/components/editor/MentionMenu.tsx`
- Modify: `src/components/editor/NoteEditor.tsx` (trigger state, query memo, insert callback, render)
- Test: manual checklist (Step 6) — same rationale as Task 12.

**Interfaces:**
- Consumes: pill anchor shape from Task 11; store shape from `@/data/store` (`entities: {id,title,type,icon}[]`, `spaces`, whatever NoteEditor already imports).
- Produces: `MentionMenu` component with props `{ position: {x,y}, search: string, onClose: () => void, onSelect: (item: { id: string; title: string; type: string }) => void }`.

- [ ] **Step 1: Create `MentionMenu.tsx`**

```tsx
"use client";

import { useState, useRef, useEffect, useMemo } from 'react';
import { FileText, Folder, Presentation, Box } from 'lucide-react';
import { useStore } from '@/data/store';

interface MentionMenuProps {
  position: { x: number; y: number };
  search: string;
  onClose: () => void;
  onSelect: (item: { id: string; title: string; type: string }) => void;
}

const ICON_CLS = "w-4 h-4";
const MENTIONABLE = new Set(['note', 'folder', 'canvas', 'workspace']);

function iconFor(type: string) {
  if (type === 'note') return <FileText strokeWidth={2} className={ICON_CLS} />;
  if (type === 'folder') return <Folder strokeWidth={2} className={ICON_CLS} />;
  if (type === 'canvas') return <Presentation strokeWidth={2} className={ICON_CLS} />;
  return <Box strokeWidth={2} className={ICON_CLS} />;
}

export function MentionMenu({ position, search, onClose, onSelect }: MentionMenuProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const entities = useStore(s => s.entities);

  const items = useMemo(() => {
    const all = entities
      .filter(e => MENTIONABLE.has(e.type) && e.title?.trim())
      .map(e => ({ id: e.id, title: e.title, type: e.type }));
    const q = search.trim().toLowerCase();
    const matched = q ? all.filter(i => i.title.toLowerCase().includes(q)) : all;
    // Prefix matches first, then substring; cap for render performance.
    return matched
      .sort((a, b) => {
        const ap = a.title.toLowerCase().startsWith(q) ? 0 : 1;
        const bp = b.title.toLowerCase().startsWith(q) ? 0 : 1;
        return ap - bp || a.title.localeCompare(b.title);
      })
      .slice(0, 30);
  }, [entities, search]);

  // Keyboard nav — same pattern as SlashCommandMenu.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, items.length - 1)); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)); }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (items[activeIndex]) { onSelect(items[activeIndex]); onClose(); }
      }
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [items, activeIndex, onClose, onSelect]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  useEffect(() => {
    const handleScroll = (e: Event) => {
      if (menuRef.current && menuRef.current.contains(e.target as Node)) return;
      onClose();
    };
    document.addEventListener('scroll', handleScroll, true);
    return () => document.removeEventListener('scroll', handleScroll, true);
  }, [onClose]);

  useEffect(() => { setActiveIndex(0); }, [search]);

  return (
    <div
      ref={menuRef}
      className="fixed z-[150] popup-glass-small w-[280px] max-h-[300px] flex flex-col overflow-hidden gap-[3px]"
      style={{ left: position.x, top: position.y }}
    >
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {items.length === 0 && (
          <div className="px-3.5 py-4 text-center text-sm text-muted-foreground">No matches</div>
        )}
        {items.map((item, idx) => (
          <button
            key={item.id}
            className={`popup-item border-none flex items-center gap-2 w-full text-left ${idx === activeIndex ? 'bg-hover text-foreground' : ''}`}
            onClick={() => { onSelect(item); onClose(); }}
            onMouseEnter={() => setActiveIndex(idx)}
          >
            {iconFor(item.type)}
            <span className="truncate">{item.title}</span>
            <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground/40">{item.type}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
```

Check the store import path and entity shape against what `NoteEditor.tsx` already imports (`grep -n "useStore\|from '@/data/store'" src/components/editor/NoteEditor.tsx`) and adjust field access if the entity list lives under a different selector. If workspaces are NOT in `entities`, additionally merge `useStore(s => s.spaces)` mapped to `{ id, title: name, type: 'workspace' }` — mirror how `ChatMessage.tsx:1325-1332` resolves both.

- [ ] **Step 2: Add trigger state + query memo in `NoteEditor.tsx`**

Beside the `slashMenu` state (line ~481):

```tsx
  const [mentionMenu, setMentionMenu] = useState<{ blockId: string; position: { x: number; y: number }; anchorTextOffset: number } | null>(null);
```

Include it in the tooltip suppression at line ~497: `useTooltipSuppression(Boolean(activeOptionsMenu || slashMenu || mentionMenu || isDragging));`

In the keydown handler where `'/'` is handled (line ~1447), add an `'@'` case. Unlike `/` (empty-block only), `@` triggers anywhere in text, Notion-style — but only at a word boundary so emails ("user@domain") don't trigger:

```tsx
    if (e.key === '@') {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        const node = range.startContainer;
        const prevChar = node.nodeType === Node.TEXT_NODE && range.startOffset > 0
          ? (node.textContent || '')[range.startOffset - 1]
          : '';
        if (prevChar === '' || /\s/.test(prevChar)) {
          setTimeout(() => {
            const s = window.getSelection();
            if (!s || s.rangeCount === 0) return;
            const caretRect = s.getRangeAt(0).getBoundingClientRect();
            setMentionMenu({
              blockId,
              position: { x: caretRect.left, y: caretRect.bottom + 6 },
              anchorTextOffset: range.startOffset,
            });
          }, 10);
        }
      }
    }
```

Query memo, beside `slashQuery` (line ~2006) — read the LIVE DOM, not block state, because block state persists on a debounce and lags typing:

```tsx
  const mentionQuery = useMemo(() => {
    if (!mentionMenu) return '';
    const el = document.querySelector(`[data-block-id="${mentionMenu.blockId}"] [data-block-content]`);
    const text = el?.textContent ?? '';
    const lastAt = text.lastIndexOf('@');
    if (lastAt === -1) return '';
    return text.substring(lastAt + 1);
  }, [mentionMenu, blocks]);
```

(The `blocks` dep re-runs the memo as typing updates block state — same trick `slashQuery` uses. If filtering feels one-keystroke laggy in practice, switch to a `useState` updated from the block's `onInput`; start with the memo since it matches the existing slash pattern.)

Close the menu when the user deletes back past the `@` or presses space with no selection made: inside the same keydown handler, when `mentionMenu` is set (mirror `slashMenuRef` at lines ~858-861 with a `mentionMenuRef` — the handler is mount-only, direct state capture would be stale):

```tsx
    const currentMentionMenu = mentionMenuRef.current;
    if (currentMentionMenu && (e.key === ' ' || (e.key === 'Backspace' && !mentionQueryRef.current))) {
      setMentionMenu(null);
    }
```

(`mentionQueryRef` mirrors `mentionQuery` the same way; empty query + Backspace means the `@` itself is being deleted.)

- [ ] **Step 3: Implement the insert callback**

Modeled on `insertBlock`'s `type === 'link'` branch (lines ~1723-1772) — delete the typed `@query`, insert the pill, restore caret:

```tsx
  const insertMention = useCallback((item: { id: string; title: string; type: string }) => {
    if (!mentionMenu) return;
    const blockId = mentionMenu.blockId;
    const el = document.querySelector(`[data-block-id="${blockId}"] [data-block-content]`) as HTMLElement;
    if (!el) { setMentionMenu(null); return; }

    blocksHostRef.current?.focus();
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      const node = range.startContainer;
      const offset = range.startOffset;
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || "";
        const lastAtIdx = text.lastIndexOf('@', offset);
        if (lastAtIdx !== -1) {
          range.setStart(node, lastAtIdx);
          range.setEnd(node, offset);
          range.deleteContents();
        }
      }

      const a = document.createElement('a');
      a.href = `flowr:${item.type}:${item.id}`;
      a.setAttribute('data-mention', '1');
      a.className = 'entity-pill';
      a.setAttribute('contenteditable', 'false');
      a.textContent = item.title;
      range.insertNode(a);

      const space = document.createTextNode(' ');
      range.setStartAfter(a);
      range.collapse(true);
      range.insertNode(space);
      range.setStartAfter(space);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    }

    updateBlock(blockId, { content: el.innerHTML });
    setMentionMenu(null);
  }, [mentionMenu, updateBlock]);
```

- [ ] **Step 4: Render the menu**

Beside the `slashMenu` portal (line ~2380):

```tsx
      {mentionMenu && (
        <Portal>
          <MentionMenu
            position={mentionMenu.position}
            search={mentionQuery}
            onClose={() => setMentionMenu(null)}
            onSelect={insertMention}
          />
        </Portal>
      )}
```

Add the import: `import { MentionMenu } from './MentionMenu';`

- [ ] **Step 5: Run the suite + typecheck**

Run: `npm test` and `npx tsc --noEmit` (if the repo has no dedicated typecheck script — check `package.json` scripts first and use the project's own lint/typecheck command if one exists).
Expected: no failures, no new type errors.

- [ ] **Step 6: Manual verification checklist**

1. Type `@` at the start of an empty block → popup opens under the caret listing entities.
2. Type `tra` → list filters to matches (e.g. "Trade History — $60K Funded Account"); prefix matches rank first.
3. Enter or click a row → typed `@tra` is replaced by a pill; caret sits after the pill; typing continues normally.
4. The pill persists after reload (block content saved via `updateBlock`) and round-trips through the AI: ask the AI to read the note — the tool payload shows `[@Title](flowr:type:id)` (Task 11's serializer).
5. Clicking the inserted pill opens the entity (Task 12).
6. `user@domain.com` typed mid-sentence does NOT open the popup (word-boundary guard).
7. Backspacing over the `@` closes the popup; Escape closes it; clicking elsewhere closes it.

- [ ] **Step 7: Commit**

```bash
git add src/components/editor/MentionMenu.tsx src/components/editor/NoteEditor.tsx
git commit -m "feat(editor): @ mention popup with entity search inserts mention pills in notes"
```

---

## Deferred / rejected ideas (documented so they aren't re-litigated)

- **Model chain reordering, removing gemini-3.6-flash, flash-lite demotion** — real wins (14s dead-model tax per request), but explicitly out of scope: user handles model config.
- **Direct-Google SDK migration** (`Role 'function' is not supported` on newer Gemini models) — the right fix is moving to the `@google/genai` SDK, which is a provider rewrite, not a surgical fix. Revisit as its own project. The failover chain currently absorbs it.
- **Heuristic detection of leaked chain-of-thought replies** (turn 1's "- Wait, let's look at…") — any text heuristic risks eating legitimate replies. Task 5 shrinks the blast radius (dead turns fail over); full fix belongs with the SDK migration above.
- **Prompt-prefix stabilization for provider-side implicit caching** — promising cost lever (every turn resends ~20k stable tokens), but requires auditing where volatile content (timestamps, session state) sits in the prompt assembly across providers first. Do a measurement pass before designing the change.

## Self-review notes

- Spec coverage: all 6 numbered suggestions from the conversation map to Tasks 1 (parser), 3 (block IDs), 4+5 (fabrication + dead turns), 2 (patch HTML), 6 (logs), 7+10 (New Note clutter), 8 (mentions in chat replies); Task 9 is the added debugging improvement; cost items live in Task 7 and the deferred-caching note. Tasks 11-13 cover the note-side mention pills + `@` popup requested after reviewing the report note (dead `flowr:` links).
- Task ordering note: 11 → 12 → 13 is a strict sequence (serializer shape → styling/click → insertion). Task 3 and Task 11 both touch `markdownBlocks.ts` round-tripping — whichever runs second must re-run the other's tests (`npx vitest run src/lib/editor/`), and Task 3's `reattachBlockIds` treats a pill edit as a content change (IDs still preserved by type match).
- Line numbers cited were verified against the working tree on 2026-07-22; re-`grep` before editing since the tree has uncommitted changes.
- Type consistency: `MUTATING_TOOLS` export added in Task 4 and consumed in Task 5 — if Task 5 is executed first, add the `export` keyword as part of Task 5 instead.
