# Link Summarization & YouTube Transcripts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable the bot to extract YouTube transcripts and read web page content on demand.

**Architecture:** A new `youtube-extract.ts` provider fetches transcripts (with optional time-range filtering) using the `youtube-transcript` npm package. The existing WEB_SEARCH auto-path in `chainRouter.ts` intercepts YouTube URLs before the Exa/Tavily pipeline — keeping batching intact for non-YouTube URLs. A new `read_url` tool lets the model fetch any URL (YouTube or web) when classified as COMPLEX/PRIMARY, not just within WEB_SEARCH.

**Tech Stack:** Next.js (App Router), TypeScript, `youtube-transcript` (npm)

## Global Constraints

- Install `youtube-transcript@^1.3.1` (caret pin so minor/patch auto-updates within `npm update`)
- Use `fetchTranscript` (the idiomatic function import), NOT `YoutubeTranscript.fetchTranscript` (class wrapper)
- 10,000 character cap for auto-injected YouTube transcripts (WEB_SEARCH `[SEARCH DATA]`)
- 60,000 character cap for explicit `read_url` tool calls
- Preserve Exa/Tavily batching for non-YouTube URLs in `chainRouter.ts`
- All error logs must log `e.message`, not the full error object `e`
- Before every commit, run `git status` and confirm only the expected files are staged

---

## File Structure

- **Install:** `youtube-transcript` (npm package)
- **Create:** `src/lib/bot/providers/youtube-extract.ts` — YouTube transcript fetcher, URL detector, timestamp parser
- **Modify:** `src/lib/bot/chainRouter.ts` — intercept YouTube URLs in WEB_SEARCH auto-path, keeping batching for non-YouTube
- **Modify:** `src/lib/bot/tools/definitions.ts` — add `read_url` tool definition
- **Modify:** `src/lib/bot/tools/handlers.ts` — add `read_url` tool handler

---

### Task 1: Install `youtube-transcript` npm package

- [ ] **Step 1: Install the package**

```bash
npm install youtube-transcript@^1.3.1
```

Expected output: `+ youtube-transcript@1.3.1`

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(deps): add youtube-transcript"
```

---

### Task 2: Create the YouTube extractor provider

**Files:**
- Create: `src/lib/bot/providers/youtube-extract.ts`

**Interfaces:**
- Produces: `extractYoutubeTranscript(url, options?)` → `Promise<ExtractedPage | null>`
- Produces: `isYouTubeUrl(url)` → `boolean`
- Produces: `parseTimestamp(str)` → `number | null`
- Consumes: `ExtractedPage` from `./content-extract`

- [ ] **Step 1: Create the file**

```typescript
import { fetchTranscript } from 'youtube-transcript';
import { logger } from '../../logger';
import type { ExtractedPage } from './content-extract';

const AUTO_CAP_CHARS = 10_000;   // auto-injection (WEB_SEARCH)
const TOOL_CAP_CHARS = 60_000;   // explicit read_url tool call

export interface TranscriptOptions {
  /** Start time in seconds (e.g. 300 for 5:00) */
  startTime?: number;
  /** End time in seconds (e.g. 600 for 10:00) */
  endTime?: number;
  /** Language code (e.g. 'en', 'de') */
  lang?: string;
}

/**
 * Fetch a YouTube video transcript with optional time-range filtering.
 * Returns null if the video has no captions or the fetch fails.
 */
export async function extractYoutubeTranscript(
  url: string,
  options?: TranscriptOptions
): Promise<ExtractedPage | null> {
  try {
    logger.info(`Extracting YouTube transcript for: ${url}`);
    const allSegments = await fetchTranscript(url, { lang: options?.lang });

    if (!allSegments || allSegments.length === 0) return null;

    // Filter by time range when provided
    const filtered = allSegments.filter(s => {
      if (options?.startTime !== undefined && s.offset < options.startTime) return false;
      if (options?.endTime !== undefined && s.offset >= options.endTime) return false;
      return true;
    });

    if (filtered.length === 0) return null;

    const fullText = filtered.map(s => s.text).join(' ');

    // When a specific time range was requested, use the larger cap
    // (the user intentionally chose that window — don't truncate it)
    const cap = (options?.startTime !== undefined || options?.endTime !== undefined)
      ? TOOL_CAP_CHARS
      : AUTO_CAP_CHARS;

    const content = fullText.slice(0, cap).trim();
    if (!content) return null;

    return { url, title: 'YouTube Video Transcript', content };
  } catch (error: any) {
    logger.warn(`Failed to extract YouTube transcript: ${error.message}`);
    return null;
  }
}

/** Check if a URL points to YouTube */
export function isYouTubeUrl(url: string): boolean {
  return /youtube\.com|youtu\.be/i.test(url);
}

/**
 * Parse a human timestamp like "5:30" or "1:02:15" into total seconds.
 * Returns null for invalid input.
 */
export function parseTimestamp(str: string): number | null {
  if (!str) return null;
  const parts = str.trim().split(':').map(Number);
  if (parts.some(isNaN)) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 1) return parts[0];
  return null;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/bot/providers/youtube-extract.ts
git commit -m "feat(bot): create youtube-extract provider with time-range filtering"
```

---

### Task 3: Wire YouTube extraction into the WEB_SEARCH auto-path

**Files:**
- Modify: `src/lib/bot/chainRouter.ts`

**Interfaces:**
- Consumes: `extractYoutubeTranscript`, `isYouTubeUrl` from `./providers/youtube-extract`
- Consumes: `extractContent`, `formatExtractedPages` from `./providers/content-extract` (already imported)
- Context: The existing WEB_SEARCH block at lines 644-665 fetches URLs using `extractContent(urls, context)`. This is a batch call that sends all URLs to Exa/Tavily at once. YouTube URLs would fail there (Exa/Tavily can't extract transcripts). We need to handle them separately before the batch call.

- [ ] **Step 1: Add the import**

Open `src/lib/bot/chainRouter.ts` and add this line after the existing `content-extract` import (line 19):

```typescript
import { extractYoutubeTranscript, isYouTubeUrl } from './providers/youtube-extract'
```

- [ ] **Step 2: Replace the URL-fetching try block**

Find this block (lines 649-662 in the current file):

```typescript
      try {
        const pages = await extractContent(urls, context)
        const formatted = formatExtractedPages(pages)
        if (formatted) {
          system_prompt = `${system_prompt}\n\n[SEARCH DATA]\n${formatted}\n\n`
          logger.info(`[WEB_SEARCH] Injected extracted content for ${pages.filter(p => p.content).length}/${urls.length} pasted URL(s)`)
          routingTrace.push({ model: 'content-extract', category, key: 'URL_FETCH', success: true })
        } else {
          logger.warn(`[WEB_SEARCH] URL fetch returned no content for: ${urls.join(', ')}`)
        }
      } catch (e: any) {
        logger.warn(`[WEB_SEARCH] URL fetch failed: ${e.message}`)
      }
```

Replace it with:

```typescript
      try {
        const ytUrls = urls.filter(u => isYouTubeUrl(u));
        const webUrls = urls.filter(u => !isYouTubeUrl(u));

        let pages: ExtractedPage[] = [];

        // YouTube URLs: extract transcripts individually
        for (const url of ytUrls) {
          const ytPage = await extractYoutubeTranscript(url);
          if (ytPage) pages.push(ytPage);
        }

        // Non-YouTube URLs: batch-process through Exa → Tavily → fetch
        if (webUrls.length > 0) {
          const webPages = await extractContent(webUrls, context);
          if (webPages && webPages.length > 0) pages.push(...webPages);
        }

        const formatted = formatExtractedPages(pages)
        if (formatted) {
          system_prompt = `${system_prompt}\n\n[SEARCH DATA]\n${formatted}\n\n`
          logger.info(`[WEB_SEARCH] Injected extracted content for ${pages.filter(p => p.content).length}/${urls.length} pasted URL(s)`)
          routingTrace.push({ model: 'content-extract', category, key: 'URL_FETCH', success: true })
        } else {
          logger.warn(`[WEB_SEARCH] URL fetch returned no content for: ${urls.join(', ')}`)
        }
      } catch (e: any) {
        logger.warn(`[WEB_SEARCH] URL fetch failed: ${e.message}`)
      }
```

Note: The `ExtractedPage` type needs to be imported — it may or may not already be available. Check if it's already used in scope. If the file uses `extractContent` and `formatExtractedPages` already, the type may be inferred. Add the import only if the TypeScript compiler complains:

```typescript
import type { ExtractedPage } from './providers/content-extract'
```

- [ ] **Step 3: Build-check**

```bash
npx tsc --noEmit --pretty 2>&1 | head -40
```

Expected: No type errors. If you get `Cannot find name 'ExtractedPage'`, add the import from Step 2's note.

- [ ] **Step 4: Commit**

```bash
git add src/lib/bot/chainRouter.ts
git commit -m "feat(bot): intercept YouTube URLs in WEB_SEARCH path, preserve batching for web URLs"
```

---

### Task 4: Add the `read_url` tool definition

**Files:**
- Modify: `src/lib/bot/tools/definitions.ts`

**Context:** The `FLOWR_TOOLS` array lists all tools the model can call. The `read_url` tool goes right before `manage_brain` (the last tool in the array).

- [ ] **Step 1: Insert the tool definition**

Open `src/lib/bot/tools/definitions.ts`. Find the `manage_brain` entry (starting at line 237). Right before it, add:

```typescript
  {
    name: "read_url",
    description: "Read the full text content or transcript of a specific URL (articles, docs, YouTube videos). Use this when the user provides a link and asks you to summarize, read, or analyze it. Supports YouTube time ranges — pass startTime/endTime as seconds if the user says 'from X to Y'.",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "The URL to read. REQUIRED." },
        startTime: {
          type: "number",
          description: "Optional. Start time in seconds for YouTube transcript (e.g. 300 for 5:00). Only use for YouTube URLs."
        },
        endTime: {
          type: "number",
          description: "Optional. End time in seconds for YouTube transcript (e.g. 600 for 10:00). Only use for YouTube URLs."
        },
        lang: {
          type: "string",
          description: "Optional. Language code for YouTube transcript (e.g. 'en' for English, 'de' for German)."
        }
      },
      required: ["url"]
    }
  },
```

The insertion point should look like:

```typescript
  // ... end of list_content ...

  {
    name: "read_url",
    // ... (the block above)
  },

  {
    name: "manage_brain",
    // ...
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/bot/tools/definitions.ts
git commit -m "feat(bot): add read_url tool definition with YouTube time-range support"
```

---

### Task 5: Add the `read_url` tool handler

**Files:**
- Modify: `src/lib/bot/tools/handlers.ts`

**Context:** Handlers live inside the `toolHandlers` object as async methods. The existing `manage_brain` handler closes the object. We add `read_url` before `manage_brain` to keep alphabetical order, or after everything before the closing brace.

- [ ] **Step 1: Add imports**

Find the top of `src/lib/bot/tools/handlers.ts` and add after the existing imports:

```typescript
import { extractContent } from '../providers/content-extract'
import { extractYoutubeTranscript, isYouTubeUrl } from '../providers/youtube-extract'
```

- [ ] **Step 2: Add the handler**

Find the `manage_brain` handler (starts at line 842). Add `read_url` as a sibling method inside `toolHandlers`, right before `manage_brain`:

```typescript
  // ── READ URL ──────────────────────────────────────────────────────────────────
  async read_url(args: any, context: any) {
    const { url, startTime, endTime, lang } = args;
    if (!url) return { error: "'url' is required" };

    try {
      if (isYouTubeUrl(url)) {
        const ytPage = await extractYoutubeTranscript(url, {
          startTime: startTime !== undefined ? Number(startTime) : undefined,
          endTime: endTime !== undefined ? Number(endTime) : undefined,
          lang: lang || undefined,
        });
        if (ytPage) {
          return { success: true, url, content: ytPage.content };
        }
        return { error: 'Failed to extract YouTube transcript. The video might not have captions enabled.' };
      }

      // Non-YouTube URL: use existing Exa → Tavily → fetch pipeline
      const webPages = await extractContent([url], context);
      if (webPages && webPages.length > 0 && webPages[0].content) {
        return { success: true, url, content: webPages[0].content };
      }
      return { error: 'Failed to extract readable text from the URL.' };
    } catch (e: any) {
      logger.error('read_url failed:', e.message);
      return { error: e.message };
    }
  },
```

The insertion should look like:

```typescript
  // ── MANAGE BRAIN ──────────────────────────────────────────────────────────────
  async manage_brain(args: any, context: any) {
```

Note: `logger` is already imported at line 1 of handlers.ts. `extractContent` is imported from `../providers/content-extract` (correct path: handlers is in `tools/`, content-extract is in `providers/`). `extractYoutubeTranscript` and `isYouTubeUrl` from `../providers/youtube-extract` (sibling path).

- [ ] **Step 3: Build-check**

```bash
npx tsc --noEmit --pretty 2>&1 | head -40
```

Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/bot/tools/handlers.ts
git commit -m "feat(bot): implement read_url tool handler with YouTube time-range support"
```

---

### Task 6: Integration verification

- [ ] **Step 1: Verify WEB_SEARCH auto-path for YouTube**

Paste a YouTube link (without any command text). The classifier should categorize it as `WEB_SEARCH`. Verify:
- The status shows "Reading linked page(s)"
- The bot responds with content from the transcript, not "I can't browse the web" or a keyword search
- No errors in the console

- [ ] **Step 2: Verify `read_url` tool for YouTube**

Send: "Watch this video and add the key takeaways to my notes: https://youtube.com/..."
Expected: Classifies as COMPLEX/PRIMARY → model calls `read_url` → then calls `create_content`

- [ ] **Step 3: Verify time-range filtering**

Send: "Read the section from 5:00 to 10:00 of this video using read_url: https://youtube.com/..."
Expected: Transcript content only covers the 5:00–10:00 time window

- [ ] **Step 4: Verify web article still works**

Send: "Summarize this article: https://example.com/article"
Expected: Fetches via Exa/Tavily/fetch pipeline as before — no regression

- [ ] **Step 5: Verify tool-listing coherence**

Open the running app's bot settings or check the tool registry. Confirm `read_url` appears alongside the other 6 tools (create_content, update_content, append_to_note, move_content, delete_content, list_content, manage_brain).

---

## Self-Review Checklist

**1. Spec coverage:**
- YouTube transcript extraction: ✅ Task 2 (provider) + Task 3 (auto-path) + Task 5 (tool handler)
- Web page content fetching via `read_url`: ✅ Task 4 (definition) + Task 5 (handler)
- Time-range filtering (`startTime`/`endTime`): ✅ Task 2 (options param + filtering logic) + Task 4 (tool params) + Task 5 (passes through)
- Language selection: ✅ Task 2 (`lang` option) + Task 4 (tool param)
- Auto-path WEB_SEARCH integration: ✅ Task 3

**2. Placeholder scan:** No TBDs, TODOs, "implement later", or "similar to Task N" present. Every step has exact code or exact commands.

**3. Type consistency:**
- `extractYoutubeTranscript(url, options?)` returns `Promise<ExtractedPage | null>` — matches `ExtractedPage` from `content-extract.ts` ✅
- `isYouTubeUrl(url)` returns `boolean` — used in both chainRouter and handler ✅
- `parseTimestamp(str)` returns `number | null` — available but not wired into the tool yet (model parses timestamps from natural language) ✅
- `read_url` parameters: `{ url: string, startTime?: number, endTime?: number, lang?: string }` — consistent across definition and handler ✅
- Handler returns `{ success: true, url, content }` or `{ error: string }` — matches existing tool pattern ✅

**Gap found:** `parseTimestamp` is defined but not automatically used. The model receives `startTime`/`endTime` as seconds and passes them directly. If the model can't convert "5:00" to 300, the tool won't help. This is acceptable — the model handles simple arithmetic reliably, and the `parseTimestamp` helper is available for future use if needed.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-17-youtube-transcript-and-read-url.md`.

Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
