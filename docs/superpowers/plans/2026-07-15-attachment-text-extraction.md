# Attachment Text-First Extraction + Twin Caching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make vision "digital twins" transcribe the actual text of text-bearing attachments (PDFs, slides, screenshots, posts) instead of only describing their appearance, while keeping visual descriptions for genuinely visual inputs — and fix the token-meter double-count this introduces if done naively.

**Architecture:** The existing single vision-LLM call (`narrateGeneratedImage`) gets a mode-aware prompt: it self-selects TRANSCRIPT (verbatim text) or VISUAL (description) per attachment and tags its response so the caller can parse the mode back out. Three new pure, independently-testable helper functions do the decision logic that today is tangled inline inside the giant `runChain` function in `chainRouter.ts`: capping/truncating narration text, partitioning attachments into "feed as image" vs "feed as transcript text," and computing the token-meter's image credit without double-counting. `chainRouter.ts` becomes a thin caller of these three functions.

**Tech Stack:** TypeScript, Vitest. No new dependencies — reuses the existing vision-LLM providers (Google/Cloudflare/OpenRouter/Groq) already wired into `image-narration.ts`.

**Spec:** `docs/superpowers/specs/2026-07-15-attachment-text-extraction-design.md`

---

### Task 1: `capNarrationText` — truncate over-cap text with a marker

**Files:**
- Modify: `src/lib/bot/image-narration.ts`
- Test: `src/lib/bot/image-narration.test.ts` (create)

The cap is 4000 tokens. `estimateTokens` in `src/lib/bot/context.ts` uses a fixed ratio (`Math.ceil(text.length / 3.5)`, `CHARS_PER_TOKEN = 3.5`, not exported). Rather than adding a cross-file import for one ratio, duplicate the constant here with a comment — this keeps `image-narration.ts` free of a new dependency for a single number.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/bot/image-narration.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { capNarrationText } from './image-narration'

describe('capNarrationText', () => {
  it('leaves text under the cap unchanged', () => {
    const result = capNarrationText('short text')
    expect(result).toEqual({ text: 'short text', truncated: false })
  })

  it('truncates text over the cap and appends a marker', () => {
    const longText = 'x'.repeat(20000) // well over the ~14000 char cap (4000 tokens * 3.5)
    const result = capNarrationText(longText)
    expect(result.truncated).toBe(true)
    expect(result.text.startsWith('x'.repeat(100))).toBe(true)
    expect(result.text).toContain('[truncated — approximately')
    expect(result.text).toContain('more characters omitted. Ask me to continue for the rest.]')
  })

  it('keeps the capped portion at or under the char limit (excluding the marker)', () => {
    const longText = 'y'.repeat(20000)
    const result = capNarrationText(longText)
    const markerIndex = result.text.indexOf('\n\n[truncated')
    const cappedPortion = result.text.slice(0, markerIndex)
    expect(cappedPortion.length).toBeLessThanOrEqual(14000)
  })

  it('does not truncate text exactly at the cap', () => {
    const exactText = 'z'.repeat(14000)
    const result = capNarrationText(exactText)
    expect(result).toEqual({ text: exactText, truncated: false })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/bot/image-narration.test.ts`
Expected: FAIL — `capNarrationText` is not exported (module has no such export)

- [ ] **Step 3: Add `capNarrationText` to `image-narration.ts`**

Add near the top of `src/lib/bot/image-narration.ts`, after the imports:

```typescript
// Coupled to context.ts's CHARS_PER_TOKEN (3.5, not exported) — keep in sync if
// that ratio ever changes. Duplicated here rather than imported to avoid adding
// a cross-module dependency for a single constant.
const MAX_NARRATION_TOKENS = 4000
const MAX_NARRATION_CHARS = Math.floor(MAX_NARRATION_TOKENS * 3.5)

/**
 * Caps narration text at MAX_NARRATION_CHARS so one huge document can't blow a
 * turn's context budget. Not a hard reject — the capped text still counts
 * toward token_usage_total, so several large attachments naturally push the
 * session toward compaction (spec: 2026-07-15-attachment-text-extraction-design.md).
 */
export function capNarrationText(text: string, maxChars: number = MAX_NARRATION_CHARS): { text: string; truncated: boolean } {
  if (text.length <= maxChars) return { text, truncated: false }
  const omittedChars = text.length - maxChars
  const truncated = text.slice(0, maxChars).trimEnd()
  return {
    text: `${truncated}\n\n[truncated — approximately ${omittedChars} more characters omitted. Ask me to continue for the rest.]`,
    truncated: true,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/bot/image-narration.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/bot/image-narration.ts src/lib/bot/image-narration.test.ts
git commit -m "feat(vision): add capNarrationText for per-attachment size limit"
```

---

### Task 2: `parseNarrationResponse` — extract the model's mode tag

**Files:**
- Modify: `src/lib/bot/image-narration.ts`
- Test: `src/lib/bot/image-narration.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/bot/image-narration.test.ts`:

```typescript
import { parseNarrationResponse } from './image-narration'

describe('parseNarrationResponse', () => {
  it('parses a TRANSCRIPT-tagged response', () => {
    const raw = '[MODE: TRANSCRIPT]\n\nArticle 1: The intern shall attend all scheduled sessions.'
    const result = parseNarrationResponse(raw)
    expect(result.mode).toBe('transcript')
    expect(result.text).toBe('Article 1: The intern shall attend all scheduled sessions.')
  })

  it('parses a VISUAL-tagged response', () => {
    const raw = '[MODE: VISUAL]\nA dimly lit workspace with dual monitors and city lights beyond the window.'
    const result = parseNarrationResponse(raw)
    expect(result.mode).toBe('visual')
    expect(result.text).toBe('A dimly lit workspace with dual monitors and city lights beyond the window.')
  })

  it('is case-insensitive on the tag', () => {
    const raw = '[mode: transcript]\n\nSome transcribed text.'
    const result = parseNarrationResponse(raw)
    expect(result.mode).toBe('transcript')
  })

  it('falls back to visual mode when no tag is present', () => {
    const raw = 'Just a plain description with no tag at all.'
    const result = parseNarrationResponse(raw)
    expect(result.mode).toBe('visual')
    expect(result.text).toBe('Just a plain description with no tag at all.')
  })

  it('falls back to visual mode when the tag is malformed', () => {
    const raw = '[MODE TRANSCRIPT]\nMissing the colon.'
    const result = parseNarrationResponse(raw)
    expect(result.mode).toBe('visual')
    expect(result.text).toBe(raw.trim())
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/bot/image-narration.test.ts`
Expected: FAIL — `parseNarrationResponse` is not exported

- [ ] **Step 3: Add `parseNarrationResponse` to `image-narration.ts`**

Add directly below `capNarrationText`:

```typescript
const MODE_TAG_RE = /^\[MODE:\s*(TRANSCRIPT|VISUAL)\]\s*\n+([\s\S]*)$/i

/**
 * Extracts the model's self-selected mode tag (see image_narration.txt) from
 * its raw response. If the model didn't follow the tag format, falls back to
 * 'visual' — the historically safe default — and keeps the raw text as-is.
 */
export function parseNarrationResponse(raw: string): { mode: 'transcript' | 'visual'; text: string } {
  const trimmed = raw.trim()
  const match = trimmed.match(MODE_TAG_RE)
  if (match) {
    return {
      mode: match[1].toUpperCase() === 'TRANSCRIPT' ? 'transcript' : 'visual',
      text: match[2].trim(),
    }
  }
  return { mode: 'visual', text: trimmed }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/bot/image-narration.test.ts`
Expected: PASS (9 tests total)

- [ ] **Step 5: Commit**

```bash
git add src/lib/bot/image-narration.ts src/lib/bot/image-narration.test.ts
git commit -m "feat(vision): add parseNarrationResponse to extract the model's mode tag"
```

---

### Task 3: `partitionNarrationResults` — decide what gets fed to PRIMARY

**Files:**
- Modify: `src/lib/bot/image-narration.ts`
- Test: `src/lib/bot/image-narration.test.ts`

This is the core routing decision: text-doc attachments are never fed to PRIMARY as images (their transcript is strictly better); visual attachments ARE fed as raw images this turn (their twin is deliberately excluded from this turn's `[VISION DATA]` — see spec "Core Model"). A buffer with no narration result (call failed or returned nothing) is treated as visual by default — fail open, so PRIMARY still sees the raw image rather than silently losing the attachment.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/bot/image-narration.test.ts`:

```typescript
import { partitionNarrationResults } from './image-narration'

describe('partitionNarrationResults', () => {
  const bufA = Buffer.from('A')
  const bufB = Buffer.from('B')
  const bufC = Buffer.from('C')

  it('routes a transcript-mode result to transcriptDescriptions, not visualBuffers', () => {
    const result = partitionNarrationResults(
      [bufA],
      [{ description: 'Article 1: ...', mode: 'transcript' }]
    )
    expect(result.visualBuffers).toEqual([])
    expect(result.transcriptDescriptions).toEqual(['Article 1: ...'])
    expect(result.allDescriptions).toEqual(['Article 1: ...'])
  })

  it('routes a visual-mode result to visualBuffers, not transcriptDescriptions', () => {
    const result = partitionNarrationResults(
      [bufA],
      [{ description: 'A dimly lit workspace.', mode: 'visual' }]
    )
    expect(result.visualBuffers).toEqual([bufA])
    expect(result.transcriptDescriptions).toEqual([])
    expect(result.allDescriptions).toEqual(['A dimly lit workspace.'])
  })

  it('handles a mixed batch: 1 visual image + N text-doc attachments (spec example)', () => {
    const result = partitionNarrationResults(
      [bufA, bufB, bufC],
      [
        { description: 'A dimly lit workspace.', mode: 'visual' },
        { description: 'No Cookie Consent: ...', mode: 'transcript' },
        { description: 'No Terms of Service: ...', mode: 'transcript' },
      ]
    )
    expect(result.visualBuffers).toEqual([bufA])
    expect(result.transcriptDescriptions).toHaveLength(2)
    expect(result.allDescriptions).toHaveLength(3)
  })

  it('labels descriptions with an index only when there is more than one buffer', () => {
    const single = partitionNarrationResults([bufA], [{ description: 'text', mode: 'transcript' }])
    expect(single.transcriptDescriptions[0]).toBe('text')

    const multi = partitionNarrationResults(
      [bufA, bufB],
      [{ description: 'first', mode: 'transcript' }, { description: 'second', mode: 'transcript' }]
    )
    expect(multi.transcriptDescriptions[0]).toBe('Image 1:\nfirst')
    expect(multi.transcriptDescriptions[1]).toBe('Image 2:\nsecond')
  })

  it('fails open: a null narration result is treated as visual so PRIMARY still sees the raw image', () => {
    const result = partitionNarrationResults([bufA], [null])
    expect(result.visualBuffers).toEqual([bufA])
    expect(result.transcriptDescriptions).toEqual([])
    expect(result.allDescriptions).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/bot/image-narration.test.ts`
Expected: FAIL — `partitionNarrationResults` is not exported

- [ ] **Step 3: Add `partitionNarrationResults` to `image-narration.ts`**

Add directly below `parseNarrationResponse`:

```typescript
export interface NarrationPartition {
  /** Buffers to feed to PRIMARY as raw images this turn (visual attachments, plus any failed narrations). */
  visualBuffers: Buffer[]
  /** Text-doc transcripts only — this turn's [VISION DATA] content. */
  transcriptDescriptions: string[]
  /** Every twin (transcript AND visual) — persisted as image_description so later turns see every attachment's twin as text. */
  allDescriptions: string[]
}

/**
 * Splits narrated attachments into what PRIMARY needs THIS turn vs. what gets
 * persisted for later turns. See spec "Core Model": text-doc attachments are
 * never fed as images (their transcript is strictly better); visual
 * attachments ARE fed as raw images this turn, with their twin excluded from
 * this turn's [VISION DATA] to avoid paying for the same information twice.
 */
export function partitionNarrationResults(
  buffers: Buffer[],
  results: Array<{ description: string; mode: 'transcript' | 'visual' } | null>
): NarrationPartition {
  const visualBuffers: Buffer[] = []
  const transcriptDescriptions: string[] = []
  const allDescriptions: string[] = []
  const multi = buffers.length > 1

  buffers.forEach((buf, i) => {
    const result = results[i]
    if (!result?.description) {
      // Narration failed or returned nothing — fail open: still let PRIMARY
      // see the raw image directly rather than silently dropping it.
      visualBuffers.push(buf)
      return
    }
    const label = multi ? `Image ${i + 1}:\n${result.description}` : result.description
    allDescriptions.push(label)
    if (result.mode === 'transcript') {
      transcriptDescriptions.push(label)
    } else {
      visualBuffers.push(buf)
    }
  })

  return { visualBuffers, transcriptDescriptions, allDescriptions }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/bot/image-narration.test.ts`
Expected: PASS (14 tests total)

- [ ] **Step 5: Commit**

```bash
git add src/lib/bot/image-narration.ts src/lib/bot/image-narration.test.ts
git commit -m "feat(vision): add partitionNarrationResults to route text-docs vs visual images"
```

---

### Task 4: Rewrite the narration prompt and `narrateGeneratedImage`

**Files:**
- Modify: `src/lib/bot/prompts/chains/image_narration.txt`
- Modify: `src/lib/bot/image-narration.ts:9-58`

Wires the three new helpers into the actual provider call. The `description` field name is kept in the return type (now holding a transcript OR a description) so the other caller of this function — `chainRouter.ts`'s IMAGE_GEN path, which only reads `.description` — needs no changes.

- [ ] **Step 1: Replace the narration prompt file**

Replace the full contents of `src/lib/bot/prompts/chains/image_narration.txt`:

```
You are analyzing an attached file (image, PDF page, or screenshot) so an AI assistant can act on it. Choose exactly ONE mode based on what's actually in the image, then respond in that mode only.

MODE: TRANSCRIPT — use this whenever the input contains substantial readable text: a document, contract, PDF page, presentation slide, app/website/chat screenshot, social media post, receipt, form, or similar. Transcribe ALL visible text verbatim, preserving structure (headings, paragraphs, lists, table rows) as plain text. Do not summarize or paraphrase — reproduce the actual text.

MODE: VISUAL — use this only when the input is primarily a photo, artwork, design mockup, or diagram with no substantial text to transcribe. Describe the subject, environment, lighting, colors, and mood in 250-700 characters. Do not invent details not visible in the image.

Output format — your ENTIRE response must be exactly this shape, nothing else:
[MODE: TRANSCRIPT] or [MODE: VISUAL]
<blank line>
<your content>

Rules:
1. Pick the mode based on the actual content, not the file type.
2. TRANSCRIPT mode: start with one line naming what the document is (e.g. "Internship contract, 3 pages"), then the full verbatim transcript.
3. Output ONLY the mode tag line, a blank line, then the content. No preamble, no "Here is the description:", no closing remarks.
```

- [ ] **Step 2: Replace `narrateGeneratedImage`**

Replace lines 9-58 of `src/lib/bot/image-narration.ts` (the full `narrateGeneratedImage` function) with:

```typescript
export async function narrateGeneratedImage(
  imageBuffer: Buffer,
  context?: any
): Promise<{ description: string; modelId: string; provider: string; mode: 'transcript' | 'visual'; truncated: boolean } | null> {
  const chainCategory: IntentCategory = 'VISION'
  const systemPrompt = getChainPrompt('image_narration')

  const { chain } = await getRouterChain(chainCategory, 'default')
  if (!chain || chain.length === 0) {
    logger.warn(`No ${chainCategory} chain available for image narration`)
    return null
  }

  const prompt = 'Analyze this attachment as instructed.'

  // Strip onChunk so narration tokens don't leak into the user-facing chat stream
  // (the narration is returned as image_description, not as message content).
  const subContext = { ...(context || {}), onChunk: undefined }

  for (const model of chain) {
    if (!model.is_enabled) continue

    try {
      let response: any = null
      const provider = model.provider.toLowerCase()

      if (provider === 'google' || provider === 'gemini') {
        response = await runGoogle(model.id, prompt, systemPrompt, imageBuffer, subContext, [])
      } else if (provider === 'cloudflare') {
        response = await runCloudflare(model.id, prompt, subContext?.aiApiKey, systemPrompt, [], 'VISION')
      } else if (provider === 'openrouter') {
        response = await runOpenRouter(model.id, prompt, systemPrompt, [], subContext?.aiApiKey, { ...subContext, openrouterProvider: model.openrouter_provider }, imageBuffer)
      } else if (provider === 'groq') {
        response = await runGroq(model.id, prompt, systemPrompt, subContext?.aiApiKey, subContext, [], imageBuffer)
      }

      if (response) {
        const raw = typeof response === 'object' ? response.content : response
        if (raw && raw.length >= 10) {
          const { mode, text } = parseNarrationResponse(raw)
          const { text: capped, truncated } = capNarrationText(text)
          logger.info(`Narrated image using ${model.id} (mode=${mode}${truncated ? ', truncated' : ''}): ${capped.slice(0, 50)}...`)
          return { description: capped, modelId: model.id, provider: model.provider, mode, truncated }
        }
      }
    } catch (e: any) {
      logger.warn(`Narration failed with ${model.id}: ${e.message}`)
    }
  }

  return null
}
```

- [ ] **Step 3: Run the full narration test file to confirm nothing broke**

Run: `npx vitest run src/lib/bot/image-narration.test.ts`
Expected: PASS (14 tests — unchanged, this step only touched `narrateGeneratedImage` which has no direct unit tests, by design; it's exercised indirectly via `chainRouter.ts` in Task 5)

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/bot/prompts/chains/image_narration.txt src/lib/bot/image-narration.ts
git commit -m "feat(vision): mode-aware narration prompt — transcribe text docs, describe visuals"
```

---

### Task 5: `computeVisionTokenCredit` — fix the flat-credit double-count

**Files:**
- Modify: `src/lib/bot/context.ts`
- Test: `src/lib/bot/context.test.ts` (create)

This is the token-meter fix from the spec's "Token Meter Correction" section. Today, every `[VISION CONTEXT - DIGITAL TWIN]` block in history earns a flat 258-token credit **on top of** its real text already being counted via `estimateTokens(activeHistoryText)` — a double-count. The fix: the flat credit applies ONLY to (a) buffers actually fed as raw images this turn, and (b) legacy `[Image:]`/`[Image attached]` placeholders (images stripped with no twin available — there's no other signal of their weight). A digital-twin block never earns the flat credit; its weight is exactly its text.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/bot/context.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { computeVisionTokenCredit } from './context'

describe('computeVisionTokenCredit', () => {
  it('returns 0 when there are no current-turn images and no legacy placeholders', () => {
    expect(computeVisionTokenCredit(0, [])).toBe(0)
  })

  it('charges a flat credit per buffer actually fed to PRIMARY this turn', () => {
    expect(computeVisionTokenCredit(1, [])).toBe(258)
    expect(computeVisionTokenCredit(2, [])).toBe(516)
  })

  it('charges a flat credit per legacy [Image:] placeholder in history', () => {
    expect(computeVisionTokenCredit(0, ['some text [Image: a cat] more text'])).toBe(258)
  })

  it('charges a flat credit per legacy [Image attached] placeholder in history', () => {
    expect(computeVisionTokenCredit(0, ['user sent a photo [Image attached]'])).toBe(258)
  })

  // Regression test for a live bug (2026-07-15): a [VISION CONTEXT - DIGITAL TWIN]
  // block is real transcript/description text that's already counted via
  // estimateTokens() on the caller's concatenated history string. Charging a flat
  // 258-token credit ALSO for the twin marker double-counted every described
  // attachment on every turn it stayed in the active history window.
  it('does NOT charge a flat credit for a [VISION CONTEXT - DIGITAL TWIN] block (no double-count)', () => {
    const historyText = 'can see this image?\n\n[VISION CONTEXT - DIGITAL TWIN]\nA dimly lit workspace with dual monitors.'
    expect(computeVisionTokenCredit(0, [historyText])).toBe(0)
  })

  it('sums credits across current-turn buffers and multiple history messages, excluding twin blocks', () => {
    const history = [
      'first message [Image: old photo]',
      'second message\n\n[VISION CONTEXT - DIGITAL TWIN]\nA contract transcript.',
      'third message [Image attached]',
    ]
    // 2 current-turn visual buffers (2*258) + 1 legacy [Image:] (258) + 1 legacy
    // [Image attached] (258) = 4 * 258. The twin block contributes 0.
    expect(computeVisionTokenCredit(2, history)).toBe(4 * 258)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/bot/context.test.ts`
Expected: FAIL — `computeVisionTokenCredit` is not exported

- [ ] **Step 3: Add `computeVisionTokenCredit` to `context.ts`**

Add directly below `estimateTokens` (after line 23) in `src/lib/bot/context.ts`:

```typescript
const FLAT_IMAGE_TOKEN_CREDIT = 258

/**
 * Flat per-image token credit added on top of the real text already counted
 * via estimateTokens(). Only counts:
 *  - visualBufferCount: images actually sent as raw pixels THIS turn (never
 *    text-doc attachments — those are transcript-only, no image credit, ever;
 *    see docs/superpowers/specs/2026-07-15-attachment-text-extraction-design.md).
 *  - legacy [Image:]/[Image attached] placeholders in history text — images
 *    that were stripped with no twin available, so there's no other signal of
 *    their weight.
 * A [VISION CONTEXT - DIGITAL TWIN] block does NOT earn this credit: it's real
 * transcript/description text already counted via estimateTokens() on the
 * caller's concatenated history string. Adding a flat credit on top of that
 * double-counted every described attachment, on every turn it stayed in the
 * active history window (fixed 2026-07-15).
 */
export function computeVisionTokenCredit(visualBufferCount: number, historyPartTexts: string[]): number {
  let count = visualBufferCount
  for (const partText of historyPartTexts) {
    if (!partText) continue
    const matches1 = partText.match(/\[Image:/g)?.length || 0
    const matches2 = partText.match(/\[Image attached\]/g)?.length || 0
    count += matches1 + matches2
  }
  return count * FLAT_IMAGE_TOKEN_CREDIT
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/bot/context.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/bot/context.ts src/lib/bot/context.test.ts
git commit -m "fix(bot): stop double-counting digital twin tokens in the memory meter"
```

---

### Task 6: Wire `chainRouter.ts` to the new helpers

**Files:**
- Modify: `src/lib/bot/chainRouter.ts:330-360` (vision block)
- Modify: `src/lib/bot/chainRouter.ts:860` (PRIMARY buffer feed — line number shifts after the vision-block edit; locate by the string below)
- Modify: `src/lib/bot/chainRouter.ts:1068-1106` (token-meter block — line number shifts; locate by the string below)

No new tests in this task — the three functions it calls are already unit-tested (Tasks 1-3, 5). This task is pure wiring, verified by typecheck + the full existing suite (chainRouter.ts has no direct unit tests today; it's exercised via the app itself).

- [ ] **Step 1: Add the `visualBuffersForPrimary` declaration and rewrite the vision block**

In `src/lib/bot/chainRouter.ts`, find this exact block (currently lines 330-360):

```typescript
  if (activeBuffer) {
    onStatus({
      chain: 'VISION',
      goal: 'Describing visual input',
      label: getStatusLabel('VISION', 'Scanning Image'),
      status: 'running'
    })

    try {
      const { narrateGeneratedImage } = await import('./image-narration')
      const descriptions: string[] = []
      for (let i = 0; i < activeBuffers.length; i++) {
        const result = await narrateGeneratedImage(activeBuffers[i], context)
        if (result?.description) {
          descriptions.push(activeBuffers.length > 1 ? `Image ${i + 1}:\n${result.description}` : result.description)
        }
      }
      
      if (descriptions.length > 0) {
        const combined = descriptions.join('\n\n')
        if (context) {
          context.vision_notes = `[IMAGE DESCRIPTION]\n${combined}`
          context._visionImageDescription = combined
        }
      }
    } catch (e: any) {
      logger.warn(`Image description failed: ${e.message}`)
    }

    onStatus({ chain: 'VISION', status: 'done', goal: 'Describing visual input' })
  }
```

Replace it with:

```typescript
  // Buffers actually fed to PRIMARY as raw images this turn — populated below.
  // Text-doc attachments are never fed here (their transcript is authoritative);
  // visual attachments are fed here THIS turn only, then dropped from later turns
  // once their twin is in history. See spec "Core Model".
  let visualBuffersForPrimary: Buffer[] = []

  if (activeBuffer) {
    onStatus({
      chain: 'VISION',
      goal: 'Describing visual input',
      label: getStatusLabel('VISION', 'Scanning Image'),
      status: 'running'
    })

    try {
      const { narrateGeneratedImage, partitionNarrationResults } = await import('./image-narration')
      const narrationResults = await Promise.all(
        activeBuffers.map(buf => narrateGeneratedImage(buf, context))
      )
      const { visualBuffers, transcriptDescriptions, allDescriptions } = partitionNarrationResults(activeBuffers, narrationResults)
      visualBuffersForPrimary = visualBuffers

      // This turn's [VISION DATA] carries text-doc transcripts only — a visual
      // attachment's twin is deliberately excluded here since its raw pixels are
      // already in visualBuffersForPrimary; including both would pay twice for
      // the same information.
      if (transcriptDescriptions.length > 0) {
        const combined = transcriptDescriptions.join('\n\n')
        if (context) context.vision_notes = `[IMAGE DESCRIPTION]\n${combined}`
      }
      // Persisted as image_description so LATER turns (when the raw image is
      // gone) see every attachment's twin — transcript or visual — as text.
      if (allDescriptions.length > 0 && context) {
        context._visionImageDescription = allDescriptions.join('\n\n')
      }
    } catch (e: any) {
      logger.warn(`Image description failed: ${e.message}`)
    }

    onStatus({ chain: 'VISION', status: 'done', goal: 'Describing visual input' })
  }
```

- [ ] **Step 2: Feed `visualBuffersForPrimary` to PRIMARY instead of `activeBuffers`**

Find this line (search for the exact string — its line number shifted after Step 1's edit):

```typescript
              category === 'PRIMARY' ? activeBuffers : undefined
```

Replace with:

```typescript
              category === 'PRIMARY' ? visualBuffersForPrimary : undefined
```

Do not change any other use of `activeBuffers` in this file (the classifier signal at the `classifyIntentV2(...)` call and the tier-selection check `activeBuffers.length > 0` both intentionally keep counting ALL attachments, not just visual ones — an attachment of either kind still warrants the smart tier / attachment-aware classification).

- [ ] **Step 3: Rewrite the token-meter block to use `computeVisionTokenCredit`**

Find this exact block (search for `Update token usage` — its line number shifted after Step 1's edit):

```typescript
            // Update token usage
            if (typeof finalContent === 'string') {
              const sid = sessionId

              const historyWithResponse = [
                ...history,
                { role: 'model', parts: [{ text: finalContent || '' }] }
              ];

              let activeHistoryText = prompt || '';
              let activeImageCount = 0;

              if (inputBuffer) {
                activeImageCount += Array.isArray(inputBuffer) ? inputBuffer.length : 1;
              }

              // Same "messages after the watermark" window as historyForChain (line ~777) —
              // must stay in lockstep with the prompt window, or this estimate silently
              // diverges from what was actually sent (undercounting once the post-watermark
              // window grows past 5, or double-counting already-summarized messages right
              // after compaction).
              const watermark = sessionState?.last_compacted_message_id ?? null
              const limitHistory = currentSummary
                ? messagesAfterWatermark(historyWithResponse, watermark)
                : historyWithResponse;
              for (const h of limitHistory) {
                const partText = h.parts?.[0]?.text || h.content || '';
                activeHistoryText += partText;

                if (partText) {
                  const matches1 = partText.match(/\[Image:/g)?.length || 0;
                  const matches2 = partText.match(/\[Image attached\]/g)?.length || 0;
                  const matches3 = partText.match(/\[VISION CONTEXT - DIGITAL TWIN\]/g)?.length || 0;
                  activeImageCount += (matches1 + matches2 + matches3);
                }
              }

              const summaryTokens = currentSummary ? estimateTokens(currentSummary) : 0;
              const totalUsage = summaryTokens + estimateTokens(activeHistoryText) + (activeImageCount * 258);
```

Replace with:

```typescript
            // Update token usage
            if (typeof finalContent === 'string') {
              const sid = sessionId

              const historyWithResponse = [
                ...history,
                { role: 'model', parts: [{ text: finalContent || '' }] }
              ];

              let activeHistoryText = prompt || '';

              // Same "messages after the watermark" window as historyForChain (line ~777) —
              // must stay in lockstep with the prompt window, or this estimate silently
              // diverges from what was actually sent (undercounting once the post-watermark
              // window grows past 5, or double-counting already-summarized messages right
              // after compaction).
              const watermark = sessionState?.last_compacted_message_id ?? null
              const limitHistory = currentSummary
                ? messagesAfterWatermark(historyWithResponse, watermark)
                : historyWithResponse;
              const historyPartTexts = limitHistory.map(h => h.parts?.[0]?.text || h.content || '')
              activeHistoryText += historyPartTexts.join('')

              const summaryTokens = currentSummary ? estimateTokens(currentSummary) : 0;
              const imageTokenCredit = computeVisionTokenCredit(visualBuffersForPrimary.length, historyPartTexts);
              const totalUsage = summaryTokens + estimateTokens(activeHistoryText) + imageTokenCredit;
```

- [ ] **Step 4: Import `computeVisionTokenCredit`**

Find this line near the top of `src/lib/bot/chainRouter.ts`:

```typescript
import { getSessionState, updateSessionState, estimateTokens } from './context'
```

Replace with:

```typescript
import { getSessionState, updateSessionState, estimateTokens, computeVisionTokenCredit } from './context'
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. If `inputBuffer` is now unused anywhere else in the function, TypeScript will not error (it's still the function parameter and still used earlier at line ~240 `Array.isArray(inputBuffer) ? inputBuffer : ...`) — this is expected, no action needed.

- [ ] **Step 6: Run the full test suite**

Run: `npx vitest run`
Expected: PASS — all existing tests plus the 20 new tests from Tasks 1, 2, 3, 5 (14 in `image-narration.test.ts` + 6 in `context.test.ts`)

- [ ] **Step 7: Commit**

```bash
git add src/lib/bot/chainRouter.ts
git commit -m "feat(vision): wire text-first attachment routing into runChain

Text-doc attachments (PDFs, screenshots, slides) are transcribed and fed
to PRIMARY as text only — never as images. Visual attachments are fed as
raw images this turn, with their twin excluded from this turn's
[VISION DATA] and picked up as text once they're in history. Token meter
now credits only what's actually in the payload each turn."
```

---

### Task 7: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Full test suite**

Run: `npx vitest run`
Expected: all tests pass, including the 20 new tests

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Confirm no other callers of `narrateGeneratedImage` were missed**

Run: `grep -rn "narrateGeneratedImage" src --include="*.ts"`
Expected: exactly two call sites — `src/lib/bot/chainRouter.ts` (the vision block wired in Task 6, and the separate IMAGE_GEN narration call further down which only reads `.description` and needs no change) and the definition in `src/lib/bot/image-narration.ts`

- [ ] **Step 4: Manual smoke check (requires a running dev server + a real attachment)**

This step is not automatable in this plan — flag it to the user as a follow-up manual check before considering the feature done:
- Send a text-heavy PDF or screenshot → verify the bot can answer questions about specific text inside it (not just describe its appearance).
- Send a purely visual image (a photo or design) → verify the response still engages with visual content, not a wall of transcribed nonsense.
- Send 1 visual image + several text PDFs in one message → verify the bot addresses content from all of them.
