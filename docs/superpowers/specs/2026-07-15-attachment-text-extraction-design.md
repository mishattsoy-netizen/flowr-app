# Text-First Attachment Extraction + Twin Caching — Design

**Date:** 2026-07-15
**Status:** Approved design, pre-implementation

## Problem

When a user sends a text-bearing attachment (PDF, slide deck, screenshot, blog/post
image, phone/PC screenshot), the vision pipeline produces a purely *aesthetic*
"digital twin" — a visual description of how the document looks, not its content.

Real example (transcript `2026-07-15T02-53-51`): a 3-page Czech student-internship
contract was twinned as:

> "Printed on crisp, white A4 paper with black, high-contrast text… clean and
> bureaucratic, featuring official school branding at the top…"

None of the actual clauses, articles, dates, or party names were extracted. The
answering model literally cannot see the document's content — only that it is a
document. This makes attachments unreliable for their most common real use: sending
the bot something with text in it and asking about that text.

Three coupled defects:

1. **Twins describe, never transcribe.** The narration prompt
   (`prompts/chains/image_narration.txt`) asks only for "subject, environment,
   lighting, colors, mood."
2. **No size discipline.** Twins are whatever length the model returns; a large doc
   has no cap and no compaction pressure tied to it.
3. **Twin token double-count + no caching win.** The current-turn twin rides in the
   volatile `[VISION DATA]` block (never cached), and the token meter counts each
   twin as a flat 258-token image credit *plus* its full text — double-counting once
   the twin *is* the text.

## Goals

- Extract **real text** from text-bearing attachments; keep visual descriptions for
  genuinely visual inputs (design refs, photos, diagrams).
- Generous per-attachment size cap that **costs context** (drives compaction) rather
  than hard-rejecting.
- Never re-feed a text document's image after the first pass — the transcript is
  authoritative, cheaper, faster, and higher-quality than re-analyzing pixels.
- Position stable twins so they sit in the **cached prefix**, not re-billed every turn.
- Keep the token meter honest (count only what is actually in the payload each turn).

## Non-Goals

- No new OCR/PDF library dependency. Reuse the existing vision-LLM call.
- No change to how attachments are uploaded, resolved to base64, or stored
  (that path was fixed separately on 2026-07-14).
- No change to the compaction algorithm itself — only what feeds its input.

---

## Core Model

Each attachment is handled **independently**. The vision model runs once per
attachment and self-selects a mode:

- **Text-dominant** (document, PDF, slide, screenshot, post, receipt, chat capture):
  transcribe **all visible text verbatim**, preserving structure (headings, lists,
  tables best-effort), prefixed with a one-line `[what this is]`. → twin *is* the text.
- **Visual-dominant** (photo, design mockup, diagram, artwork): describe visually as
  today. → twin is the description.
- **Mixed** (e.g. a slide with a chart): transcribe the text + a brief note on the
  visual element.

### What the answering (PRIMARY) chain receives

| Attachment kind | This turn PRIMARY sees | Later turns |
|---|---|---|
| **Text doc** | twin transcript in `[VISION DATA]` — **image never fed** | twin only (history) |
| **Visual image** | **raw image only** (no twin this turn) | twin only (history) |

Rationale:

- **Text doc, never fed as image.** A verbatim transcript is strictly better than
  re-reading pixels: cheaper (text tokens ≪ vision tokens; no per-turn PDF re-parse),
  faster, and higher fidelity (deterministic, nothing lost). So a text attachment is
  *never* sent to PRIMARY as an image — not even on turn one.
- **Visual image, image-only this turn.** Feeding both the pixels *and* a description
  of the same pixels in the same turn is redundant waste. The model looks at the real
  image once; the twin is generated in parallel and saved to history for later turns
  when the image is gone.

**Consequence:** the current-turn `[VISION DATA]` block only ever contains **text-doc
transcripts**. Visual twins appear only once they are history. This shrinks the
volatile per-turn block and helps caching.

### Mixed batch example — 1 visual image + 4 PDFs

- 4 PDFs → 4 transcript twins → all four transcripts placed in this turn's
  `[VISION DATA]`; none fed as images.
- 1 image → described → twin saved to history; the **raw image** is fed to PRIMARY
  this turn (no twin in `[VISION DATA]`).
- PRIMARY this turn sees: **raw image + 4 PDF transcripts**.
- Next turn: image gone; all 5 twins are text in history.

---

## Size Cap

Applied to each attachment's extracted text **after** the vision call returns:

- **Cap: 4000 tokens per attachment** (~16k chars).
- Under cap → use as-is.
- Over cap → truncate to the cap and append:
  `[truncated — approximately N more characters omitted. Ask me to continue for the rest.]`
- **No hard rejection.** The full (capped) twin counts toward `token_usage_total`
  exactly as twins do today, so several large docs naturally push the session past the
  0.8 compaction threshold — the user "pays" in context, as intended. The cap is
  per-attachment, so a batch of large docs still stacks in total.

---

## Token Meter Correction

The meter is an *estimate that feeds compaction*; it must reflect what is actually in
the payload each turn. Current bug: flat 258 image credit **+** full twin text on every
twin, every turn.

New rule, split by what is actually sent:

| Situation | Counted |
|---|---|
| **Text-doc twin** (any turn) | `estimateTokens(twinText)` only — **no** image credit ever |
| **Visual image, current turn** (raw image in payload, no twin) | **flat image credit** only |
| **Visual twin, later turns** (image gone, twin in history) | `estimateTokens(twinText)` only |

The flat image credit applies **only when the raw image is actually in the payload**
(a visual attachment on its arrival turn). Once anything becomes history it is
text-only. This eliminates the double-count and keeps big text docs driving compaction
by their real text size.

---

## Twin Caching

Payload order today (verified): **static system prompt** (cached prefix) →
**history array** → **dynamicContext + `[CURRENT REQUEST]`** (volatile user message,
never cached).

Twins for in-history images already live in the history array via
`resolveTwinForUserMessage` (`memory.ts`), which reads `context_messages.image_description`
off the stored message row. That position is *already* in the cacheable prefix.

The caching win is therefore about **not re-templating the current twin into the
volatile block once it becomes history**:

- The current turn's fresh **text-doc** twin rides in `[VISION DATA]` (it's new — can't
  be cached anyway).
- It is persisted onto the message row (as today, via `image_description`), so from the
  *next* turn on it is rebuilt in stable history position by `resolveTwinForUserMessage`
  and sits in the cached prefix — no longer re-billed as fresh dynamic content.
- Visual twins never occupy the current-turn block at all (see Core Model), so they only
  ever appear in the cached history region.

No new storage or schema is needed — this rides the existing
`context_messages.image_description` mechanism.

---

## Components Touched

- **`prompts/chains/image_narration.txt`** — rewrite: mode-aware transcribe-or-describe
  instructions (verbatim text for text-dominant; visual description otherwise; text +
  brief visual note for mixed).
- **`lib/bot/image-narration.ts`** — apply the 4000-token cap + truncation marker to the
  returned text. Return whether the result was a transcript or a visual description
  (mode signal), so the caller can decide image-feeding.
- **`lib/bot/chainRouter.ts`** —
  - Use the per-attachment mode signal to decide which buffers are fed to PRIMARY:
    text-doc buffers are dropped; visual buffers are fed (current turn only).
  - `[VISION DATA]` for the current turn assembled from text-doc transcripts only.
  - Token-meter block: apply the split-by-payload counting rule above.
- **`lib/bot/memory.ts` / client history builder** — unchanged mechanism; twins continue
  to be re-injected from `image_description`. (Confirm the visual-twin-only-in-history
  behavior is consistent with re-injection.)

## Testing

- **Text extraction:** a text-image fixture → twin contains the actual text, not just a
  visual blurb. (Assert on transcript substring, mode = transcript.)
- **Visual description:** a non-text image fixture → twin is a visual description,
  mode = visual.
- **Cap:** an over-cap text input → twin truncated at ~4000 tokens with the marker
  appended; nothing beyond the cap present.
- **Image-feeding decision:** given 1 visual + N text-doc buffers, only the visual
  buffer is passed to PRIMARY; text-doc buffers are dropped.
- **Token meter:** text-doc twin counts text-only (no image credit); a current-turn
  visual counts the flat credit only; a history visual twin counts text-only. Pin the
  no-double-count regression.

## Rollout / Risk

- Mode misclassification (a text doc described visually, or vice versa) degrades that
  one attachment but never errors — acceptable, and the prompt biases explicitly toward
  transcription for anything with substantial text.
- The 4000-token cap is generous for typical docs (several pages) and bounded for
  pathological ones; the truncation marker gives the user an explicit "ask to continue"
  path.
- Purely additive to the existing vision call — no new dependency, no new external
  service, no schema change.
