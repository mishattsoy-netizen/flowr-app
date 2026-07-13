# Handoff: §5b Native attachments — delete the twin pre-pass, wire images to PRIMARY

**You are implementing one section of a living spec.** Read `docs/superpowers/specs/2026-07-11-bot-rework-design.md` §5b first (search for "## 5b. Native vision"). That section is the source of truth for *why*; this doc is the source of truth for *exactly what to change, file by file*. If they ever conflict, the spec wins on intent, this doc wins on mechanics — but if you find a real conflict, stop and flag it instead of guessing.

**Do not invent a new plan doc.** When you finish, update the spec's §5b and §0 sections in place (there's a template at the bottom of this doc). Do not create a "plan 6" or similar.

## The one-sentence goal

Today, an uploaded image never reaches the PRIMARY model as an image — it's intercepted by a separate "VISION" pre-pass that (a) describes it in text, (b) sometimes short-circuits and returns that text directly to the user without ever creating the task/note the user asked for, and (c) sometimes hands off to PRIMARY via a fragile JSON-parsing scheme that the current vision prompt doesn't even emit anymore. You are deleting that interception for the common case and making PRIMARY receive the image natively (as a real image, alongside the user's text), while keeping one small, clean piece — a plain-text description generator — alive for the few things that still need text-only image context (history replay, RESEARCH/WEB_SEARCH chains).

## Two things that sound similar but are NOT the same — do not confuse them

1. **The VISION *pre-pass* in `chainRouter.ts`** (~lines 282-591) — this is what you are deleting/replacing. It runs when a user uploads an image, calls a vision model, and tries to parse special JSON/markers out of its response.
2. **The VISION *router chain config*** (the admin-configurable list of vision-capable models, fetched via `getRouterChain('VISION', mode)`) — this is a data table, NOT code you're deleting. A completely separate, unrelated feature — `src/lib/bot/image-narration.ts`'s `narrateGeneratedImage()` — also calls `getRouterChain('VISION', 'default')` to describe **AI-generated** images (e.g. after IMAGE_GEN produces a picture, so it can be described in history/logging). That feature is NOT part of this task. Leave `image-narration.ts` completely untouched. Do NOT delete the 'VISION' entry from `router-config.ts`'s category list or any admin UI for it.

## Files you will touch

1. `src/lib/bot/chainRouter.ts` — biggest change, described in detail below.
2. `src/lib/bot/services/providerExecution.ts` — add image passthrough to `executeProvider`.
3. `src/lib/bot/prompts/chains/classifier_v2.txt` — fix a stale rule, add an attachment hint.
4. `src/lib/bot/classifier.ts` — thread an attachment-hint string into the classifier's user prompt.
5. `docs/superpowers/specs/2026-07-11-bot-rework-design.md` — mark §5b done, update §0. Separate commit from the code.

Do NOT touch: `image-narration.ts`, `memory.ts`, `deepResearch.ts`, `promptBuilder.ts`. They already do the right thing (see "Why these are left alone" below) — verify that claim is still true after your changes, but you should not need to edit them.

---

## Step 1 — `chainRouter.ts`: replace the VISION pre-pass

### 1a. Locate the block

Find the comment `// 1. Specialized Vision Flow (Buffer or URL)` (around line 282). It runs through to a closing `}` around line 592, right before the comment `// 2. Standard Routing Flow` (there are two `// 2. Standard Routing Flow` comments in the file today — a leftover duplicate; that's fine, it's cosmetic, don't worry about it).

Inside that block:
- Lines ~283-302: URL-sniffing logic that detects an image URL pasted as plain text in the prompt and fetches it into a buffer. **KEEP THIS** — it's how "here's an image: https://...png" turns into an actual buffer. Just note it sets `activeBuffer`/`activeBuffers`.
- Lines ~319-591: the actual VISION model call + response parsing + early returns. **THIS is what you delete/replace.**

### 1b. What replaces it

Replace the whole `if (activeBuffer) { ... }` block (roughly 319-591) with a **much smaller** step that does ONE thing: generate a plain-text description of the image(s) and stash it in `context.vision_notes` / `context._visionImageDescription`, WITHOUT ever returning early and WITHOUT any JSON/`[VISION_CONTEXT]`/`logic_nature`/`FAST_SIMPLE` parsing. Something like:

```ts
if (activeBuffer) {
  onStatus({
    chain: 'VISION',
    goal: 'Describing visual input',
    label: getStatusLabel('VISION', 'Scanning Image'),
    status: 'running'
  })

  try {
    const { narrateGeneratedImage } = await import('./image-narration')
    // narrateGeneratedImage takes ONE buffer today — loop if activeBuffers.length > 1,
    // or check its signature and extend it to accept Buffer[] if that's cleaner.
    const description = await narrateGeneratedImage(activeBuffer, context)
    if (description) {
      context && (context.vision_notes = `[IMAGE DESCRIPTION]\n${description.description}`)
      context && (context._visionImageDescription = description.description)
    }
  } catch (e: any) {
    logger.warn(`Image description failed: ${e.message}`)
    // Non-fatal — PRIMARY still gets the native image below. Do NOT return here.
  }

  onStatus({ chain: 'VISION', status: 'done', goal: 'Describing visual input' })
}
```

Important behavioral differences from the old code:
- **No early `return`.** Every path continues to classification and PRIMARY.
- **No `forcedCategory` from vision metadata.** Delete all `logic_nature`/`FAST_SIMPLE`/`[VISION_CONTEXT]` parsing entirely — it's dead (the current `vision.txt`/whatever prompt `narrateGeneratedImage` uses doesn't emit it, and shouldn't).
- Check `narrateGeneratedImage`'s exact signature in `image-narration.ts` before wiring this — it currently takes a single `Buffer`, not `Buffer[]`. Decide: either call it once per buffer and join descriptions, or extend it to accept multiple. Prefer extending it minimally (it already loops `for (const model of chain)` — you'd add an outer loop or a `Buffer[]` param) OVER calling it once per image if there's more than one, to avoid N separate model calls. Use your judgment; keep it simple.
- This step must NOT be gated by category — it runs whenever `activeBuffer` is truthy, before classification, same as before.

### 1c. Force Smart tier when attachments are present

Spec requirement (§5b): "any turn with attachments goes to the Smart tier." Find where `selectTier(...)` is called for PRIMARY (~line 686, inside the `if (routerV2 && category === 'PRIMARY')` block). Force tier to `'smart'` when `activeBuffers.length > 0`, e.g.:

```ts
const tier = activeBuffers.length > 0
  ? 'smart'
  : selectTier({ action: v2Flags?.action ?? true, complexity: v2Flags?.complexity ?? 'normal', extendedThinking: thinkingEnabled })
```

### 1d. Pass the actual image buffers into `executeProvider`

Find the `executeProvider(...)` call (~line 1071-1084). Add `activeBuffers` (or just the array, whatever it's called after your edit) as a new argument — see Step 2 for the exact parameter to add. Only PRIMARY category should receive buffers here; for other categories, pass `undefined` (they already work off `vision_notes` text, unchanged) — e.g.:

```ts
const result = await executeProvider(
  modelConfig,
  category,
  category === 'IMAGE_GEN' ? activePromptForGen : finalUserPrompt,
  system_prompt,
  historyForChain,
  activeKey,
  providerKeys,
  context,
  routeContext,
  temperature,
  prompt,
  augmentSearchQuery,
  category === 'PRIMARY' ? activeBuffers : undefined  // NEW ARG
)
```

Confirm the exact variable name holding the buffer array at that point in the function (it should still be `activeBuffers`, declared at the top of the function — check it wasn't shadowed or gone out of scope; it's declared with the vision URL-sniffing code near the top, well before this call site, so it should still be alive).

---

## Step 2 — `providerExecution.ts`: wire images through `executeProvider`

Add a new parameter, e.g. `imageBuffers?: Buffer[]`, as the LAST parameter of `executeProvider`'s signature (to avoid disturbing existing positional call sites elsewhere in the codebase — grep for other callers of `executeProvider` first and confirm there's only the one call site in `chainRouter.ts`; if there are more, make sure they still compile, passing `undefined` explicitly if needed).

Then, inside the `switch (modelConfig.provider.toLowerCase())`, pass it to the 4 providers that accept it. Check each function signature yourself before editing (do not trust this doc blindly — re-verify against the current file) — as of the last read, they were:

- `runGoogle(modelId, prompt, systemPrompt, imageBuffers?, context?, history?)` — 4th positional param. Currently called as `runGoogle(modelConfig.id, activePromptForGen, system_prompt, undefined, routeContext, historyForChain)` — change `undefined` to `imageBuffers`.
- `runGroq(modelId, prompt, systemPrompt?, aiApiKey?, context?, history?, imageBuffers?)` — LAST positional param. Currently called without it — append `imageBuffers` as a new final argument.
- `runOpenRouter(modelId, prompt, systemPrompt?, history?, aiApiKey?, context?, imageBuffers?)` — LAST positional param. Currently called without it — append `imageBuffers`.
- `runNvidia(modelId, prompt, systemPrompt?, history?, aiApiKey?, context?, imageBuffers?)` — LAST positional param. Currently called without it — append `imageBuffers`.

Do NOT add image support to any other provider branch (huggingface, cloudflare, pollinations, ollama, siliconflow, core/exa/tavily search). Those are correctly left as text-only.

---

## Step 3 — `classifier_v2.txt` and `classifier.ts`: attachment hint, remove stale rule

### 3a. Remove the stale rule

In `classifier_v2.txt`, delete the line starting `PRIOR IMAGE: if history contains [VISION CONTEXT - DIGITAL TWIN]...`. That rule is about a case (image markers baked into history text) that still exists via `memory.ts` (untouched, see below) for OLD turns, but per spec the classifier now gets an explicit attachment hint instead — replace the deleted line with something like:

```
ATTACHMENTS: if this message has an attachment hint like "[2 images attached]", the user is very likely asking about that attachment right now — bias toward PRIMARY unless they clearly reference an unrelated external topic.
```

### 3b. Add the attachment hint

In `classifier.ts`, function `classifyIntentV2` (~line 168), the classifier's user-facing prompt is built at:

```ts
const finalUserPrompt = `${replyPrefix}${contextHint}\nUser: "${message}"`
```

Add a new parameter to `classifyIntentV2` (e.g. `attachmentCount?: number` or pass a pre-built string), and prepend a hint when attachments are present, e.g.:

```ts
const attachmentHint = attachmentCount && attachmentCount > 0 ? `[${attachmentCount} image${attachmentCount > 1 ? 's' : ''} attached]\n` : ''
const finalUserPrompt = `${attachmentHint}${replyPrefix}${contextHint}\nUser: "${message}"`
```

Then update the ONE call site in `chainRouter.ts` (where `classifyIntentV2(...)` is called, ~line 612) to pass `activeBuffers.length`.

Do NOT touch `resolveImageContext`/`hasVisionContext`/`refersToPriorImage`/`mixedIntent` logic in `classifier.ts` — that's about text markers left in OLD history by `memory.ts`, which you are not changing, and it still needs to work for follow-up turns days after an image was uploaded.

---

## Why these files are left alone (context so you don't "fix" them unnecessarily)

- **`memory.ts`**: when a message is replayed as history, it needs a TEXT description of any image that was in it (you can't replay a raw buffer as history text). It reads `image_description` off the stored message row and injects `[VISION CONTEXT - DIGITAL TWIN]\n<description>` into the replayed text. Your new Step 1b description-generation step is exactly what produces that `image_description` value (it flows out via `context._visionImageDescription`, which the calling route (`route.ts`/webhook) already reads and stores on the message row — confirm this wiring still holds after your edit, but do not change `memory.ts` itself).
- **`deepResearch.ts`**: reads `context.vision_notes` to seed a research query when RESEARCH category has an attached image. RESEARCH is not natively multimodal (per spec), so it still needs this text. Your new step still populates `vision_notes`, so this keeps working unchanged.
- **`promptBuilder.ts`**: injects `context.vision_notes` into `[VISION DATA]` in `dynamicContext` for any category. Same reasoning — still populated by your new step, so unchanged.
- **`image-narration.ts`**: unrelated feature (describes AI-*generated* images, not uploads). Not part of this task.

---

## Verification checklist before you consider this done

1. `npx tsc --noEmit` — must be clean.
2. `npm test` — must stay at the current passing count (whatever it is when you start; do not let it regress). If you add new logic (e.g. the tier-forcing on attachments), consider adding a small test but it's not mandatory.
3. Manually trace (read the code, don't just assume) one full path: image + "create a note from this" → activeBuffer truthy → description step runs, does NOT return → classifier runs with attachment hint → PRIMARY, tier forced to smart → `executeProvider` called with `activeBuffers` for PRIMARY → `runOpenRouter`/`runGoogle`/etc. receives the buffer natively → tool call for `create_content` is reachable (nothing short-circuits before it).
4. Confirm `image-narration.ts` and its only caller (~line 1248 in `chainRouter.ts`, the IMAGE_GEN post-processing narration step) are UNTOUCHED and still compile/work.
5. Grep the whole repo for `FAST_SIMPLE`, `logic_nature`, `VISION_CONTEXT` to confirm you removed all the dead parsing in `chainRouter.ts` — but do NOT remove the `[VISION CONTEXT - DIGITAL TWIN]` STRING LITERAL usage in `memory.ts` (that one is intentionally kept, different mechanism, see above).

## After implementation — update the spec (separate commit)

In `docs/superpowers/specs/2026-07-11-bot-rework-design.md`:
- Change the §5b status line from `> **Status: NEXT.**` to `> **Status: ✅ DONE (2026-07-13).**` (or today's actual date) and add 2-4 sentences describing what shipped, following the style of §5c/§5d's "Shipped:" paragraphs already in that doc (root cause → what changed → what was verified). Be honest about anything NOT verified yet (e.g. no cross-device/real end-to-end test was run — that's explicitly deferred by the app owner).
- Update §0's progress table/summary to reflect §5b done.
- Commit the spec update separately from the code commit, with a message like `docs: mark §5b native attachments as done`.

## Explicit stop condition

Once §5b is implemented, tested (tsc + npm test), and the spec is updated — STOP. Do not proceed to §5d bugs 1-2 (Telegram album batching, attachment persistence), do not attempt any cross-device test, do not push or deploy anything. The app owner is pushing live and testing manually themselves after this lands. If everything above is done, report back what you changed and stop.
