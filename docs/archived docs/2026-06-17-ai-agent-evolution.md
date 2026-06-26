# AI Agent Evolution Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Evolve the Flowr AI bot from a fragile classification-gated pipeline to an agentic architecture where models autonomously decide when to use tools, while maintaining streaming, free-tier economics, and admin configurability.

**Architecture:** 4 incremental phases, each independently deployable and reversible. Phase 1 adds an output sanitization guard. Phase 2 decouples tools from classification. Phase 3 simplifies the classifier from 10+ categories to 4. Phase 4 adds tool calling to OpenRouter (the last provider without it).

**Tech Stack:** Next.js, TypeScript, Vitest, Supabase (DB/Auth), Google Gemini SDK, OpenAI-compatible REST APIs (Groq, Nvidia, OpenRouter)

---

## Phase 1: Output Guard

Adds a universal sanitization layer that strips internal metadata blocks from all user-facing responses. Fixes the "internal leakage" problem with zero architectural risk.

---

### Task 1: Create Output Guard — Sanitizer Function

**Files:**
- Create: `src/lib/bot/outputGuard.ts`

**Step 1: Create the output guard module**

```typescript
// src/lib/bot/outputGuard.ts

/**
 * Patterns that should never appear in user-facing responses.
 * Order: longest/most-specific first to avoid partial matches.
 * Each entry: [regex, description] for traceability.
 */
export const SANITIZE_PATTERNS: [RegExp, string][] = [
  // Bracketed block pairs — content between [TAG]...[/TAG]
  [/\[VISION_CONTEXT\][\s\S]*?\[\/VISION_CONTEXT\]/gi, 'vision context block'],
  [/\[THINKING\][\s\S]*?\[\/THINKING\]/gi, 'thinking block'],
  [/\[REASONING\][\s\S]*?\[\/REASONING\]/gi, 'reasoning block'],
  [/\[INTERNAL\][\s\S]*?\[\/INTERNAL\]/gi, 'internal block'],

  // Bracketed blocks — content from [TAG] to double newline (or end of string)
  [/\[THINK CHAIN DIRECTION\][\s\S]*?(?:\n\n|\n?$)/gi, 'think chain direction'],
  [/\[SESSION MEMORY SUMMARY\][\s\S]*?(?:\n\n|\n?$)/gi, 'session memory summary'],
  [/\[SEARCH DATA(?::\s*[^\]]+)?\][\s\S]*?(?:\n\n|\n?$)/gi, 'search data block'],
  [/\[SEARCH FAILED\][\s\S]*?(?:\n\n|\n?$)/gi, 'search failed block'],
  [/\[IMAGE FACTS\][\s\S]*?(?:\n\n|\n?$)/gi, 'image facts block'],
  [/\[VISION DATA[^\]]*\][\s\S]*?(?:\n\n|\n?$)/gi, 'vision data block'],
  [/\[CURRENT CONTEXT\][\s\S]*?(?:\n\n|\n?$)/gi, 'current context block'],
  [/\[ADVISOR PREPARATION\][\s\S]*?(?:\n\n|\n?$)/gi, 'advisor preparation block'],
  [/\[RESTRICTIONS\][\s\S]*?(?:\n\n|\n?$)/gi, 'restrictions block'],

  // Inline context hints — single-line [CONTEXT: ...]
  [/\[CONTEXT:[^\]]*\]\s*/gi, 'context hint'],

  // XML-style thought tags
  [/<thought>[\s\S]*?<\/thought>/gi, 'thought xml tags'],
  [/<thinking>[\s\S]*?<\/thinking>/gi, 'thinking xml tags'],
]

/**
 * Strip all internal metadata from a model response before it reaches the user.
 * Must be idempotent — calling it twice produces the same output.
 */
export function sanitizeOutput(content: string): string {
  if (!content) return content

  let result = content
  for (const [pattern] of SANITIZE_PATTERNS) {
    result = result.replace(pattern, '')
  }

  // Collapse triple+ newlines left by removed blocks into double newlines
  result = result.replace(/\n{3,}/g, '\n\n')

  // Trim leading/trailing whitespace
  return result.trim()
}
```

**Step 2: Commit**

```bash
git add src/lib/bot/outputGuard.ts
git commit -m "feat: add output guard sanitization module"
```

---

### Task 2: Write Tests for Output Guard

**Files:**
- Create: `src/lib/bot/outputGuard.test.ts`

**Step 1: Write the failing tests**

```typescript
// src/lib/bot/outputGuard.test.ts
import { describe, it, expect } from 'vitest'
import { sanitizeOutput, SANITIZE_PATTERNS } from './outputGuard'

describe('sanitizeOutput', () => {
  it('returns empty string for empty input', () => {
    expect(sanitizeOutput('')).toBe('')
  })

  it('passes through clean text unchanged', () => {
    const clean = 'Hello! Here is your answer.\n\nIt has multiple paragraphs.'
    expect(sanitizeOutput(clean)).toBe(clean)
  })

  it('strips [THINK CHAIN DIRECTION] blocks', () => {
    const input = '[THINK CHAIN DIRECTION]\nReviewed: search, vision\nGap found: none\nDirection: Answer directly\n\nHere is the actual answer.'
    expect(sanitizeOutput(input)).toBe('Here is the actual answer.')
  })

  it('strips [SESSION MEMORY SUMMARY] blocks', () => {
    const input = 'Answer start.\n\n[SESSION MEMORY SUMMARY]\nUser likes dark mode.\nPrevious topic: coding.\n\nAnswer continues.'
    expect(sanitizeOutput(input)).toBe('Answer start.\n\nAnswer continues.')
  })

  it('strips [SEARCH DATA] blocks', () => {
    const input = '[SEARCH DATA]\nResult 1: ...\nResult 2: ...\n\nBased on my research, here is the answer.'
    expect(sanitizeOutput(input)).toBe('Based on my research, here is the answer.')
  })

  it('strips [SEARCH DATA: model-id] variant', () => {
    const input = '[SEARCH DATA: tavily-search]\nResult 1: ...\n\nThe answer is 42.'
    expect(sanitizeOutput(input)).toBe('The answer is 42.')
  })

  it('strips [VISION_CONTEXT]...[/VISION_CONTEXT] paired blocks', () => {
    const input = 'Before.\n[VISION_CONTEXT]The image shows a cat.[/VISION_CONTEXT]\nAfter.'
    expect(sanitizeOutput(input)).toBe('Before.\n\nAfter.')
  })

  it('strips <thought>...</thought> XML tags', () => {
    const input = '<thought>I need to think about this carefully.</thought>\n\nThe answer is 42.'
    expect(sanitizeOutput(input)).toBe('The answer is 42.')
  })

  it('strips <thinking>...</thinking> XML tags', () => {
    const input = '<thinking>Let me reason step by step.</thinking>\n\nHere is my conclusion.'
    expect(sanitizeOutput(input)).toBe('Here is my conclusion.')
  })

  it('strips [CONTEXT: ...] inline hints', () => {
    const input = '[CONTEXT: An image is present earlier in the conversation.]\nUser asked about weather.'
    expect(sanitizeOutput(input)).toBe('User asked about weather.')
  })

  it('strips [INTERNAL]...[/INTERNAL] paired blocks', () => {
    const input = 'Start.\n[INTERNAL]Debug info here.[/INTERNAL]\nEnd.'
    expect(sanitizeOutput(input)).toBe('Start.\n\nEnd.')
  })

  it('strips multiple different blocks in one response', () => {
    const input = [
      '[THINK CHAIN DIRECTION]',
      'Direction: be concise',
      '',
      '[SESSION MEMORY SUMMARY]',
      'User prefers short answers.',
      '',
      'The actual response the user should see.',
    ].join('\n')
    expect(sanitizeOutput(input)).toBe('The actual response the user should see.')
  })

  it('is idempotent — calling twice gives the same result', () => {
    const input = '[SEARCH DATA]\ndata\n\nClean text.'
    const first = sanitizeOutput(input)
    const second = sanitizeOutput(first)
    expect(first).toBe(second)
  })

  it('does not corrupt partial brackets that are user content', () => {
    const input = 'Use array[0] to access the first element.'
    expect(sanitizeOutput(input)).toBe('Use array[0] to access the first element.')
  })

  it('collapses excessive newlines left by removed blocks', () => {
    const input = 'Paragraph 1.\n\n[SEARCH DATA]\nstuff\n\n\n\nParagraph 2.'
    const result = sanitizeOutput(input)
    expect(result).not.toContain('\n\n\n')
  })

  it('SANITIZE_PATTERNS is a non-empty array', () => {
    expect(SANITIZE_PATTERNS.length).toBeGreaterThan(10)
    for (const [pattern, desc] of SANITIZE_PATTERNS) {
      expect(pattern).toBeInstanceOf(RegExp)
      expect(desc).toBeTruthy()
    }
  })
})
```

**Step 2: Run tests to verify they pass**

Run: `npx vitest run src/lib/bot/outputGuard.test.ts`
Expected: All tests PASS (the implementation was written in Task 1)

**Step 3: Commit**

```bash
git add src/lib/bot/outputGuard.test.ts
git commit -m "test: add output guard sanitization tests"
```

---

### Task 3: Integrate Output Guard into Chain Router

**Files:**
- Modify: `src/lib/bot/chainRouter.ts:1-5` (imports)
- Modify: `src/lib/bot/chainRouter.ts:1466-1468` (main return path)
- Modify: `src/lib/bot/chainRouter.ts:534-536` (vision fast return)
- Modify: `src/lib/bot/chainRouter.ts:586-588` (vision answer return)

**Step 1: Add import at top of file**

At the top of `src/lib/bot/chainRouter.ts`, add this import alongside the existing imports:

```typescript
import { sanitizeOutput } from './outputGuard'
```

**Step 2: Sanitize the main return path**

At line ~1466-1468, wrap `finalContent` before the return:

```typescript
// Before the return block at ~L1466:
if (typeof finalContent === 'string') {
  finalContent = sanitizeOutput(finalContent)
}

return {
  type: category === 'IMAGE_GEN' ? 'photo' : 'text',
  content: finalContent as any,
  // ... rest unchanged
```

**Step 3: Sanitize vision fast-return path**

At line ~534, wrap `metadata.next_instructions`:

```typescript
return {
  type: 'text',
  content: sanitizeOutput(metadata.next_instructions),
  // ... rest unchanged
```

**Step 4: Sanitize vision answer return path**

At line ~586-588, wrap `content`:

```typescript
return {
  type: 'text',
  content: typeof content === 'string' ? sanitizeOutput(content) : content,
  // ... rest unchanged
```

**Step 5: Run all tests**

Run: `npx vitest run`
Expected: All tests PASS

**Step 6: Commit**

```bash
git add src/lib/bot/chainRouter.ts
git commit -m "feat: integrate output guard into all response paths"
```

---

## Phase 2: Tool Injection — Decouple Tools from Classification

Makes tools always available to text-based chains. The model decides when to use tools — no classifier gate needed.

---

### Task 4: Enable Tools for Text-Based Categories

**Files:**
- Modify: `src/lib/bot/chainRouter.ts:1027` (useTools flag)

**Step 1: Change the useTools condition**

At line 1027 of `src/lib/bot/chainRouter.ts`, the current code:

```typescript
useTools: category === 'TOOLS',
```

Replace with:

```typescript
useTools: ['REGULAR', 'COMPLEX', 'CODING', 'TOOLS', 'ADVISOR'].includes(category),
```

This enables the existing tool calling loops in Google (`src/lib/bot/providers/google.ts:222-242`), Groq (`src/lib/bot/providers/groq.ts:88-162`), and Nvidia (`src/lib/bot/providers/nvidia.ts:88-167`) for all text-based chains.

**Important:** The providers already handle this correctly:
- Google: checks `context?.useTools && useSystemInstruction` (L115) and only activates `functionDeclarations` when both are true. Falls back to streaming when false.
- Groq: checks `!context?.useTools || modelId.includes('vision')` (L68) — streams when no tools, loops when tools.
- Nvidia: checks `!context?.useTools` (L69) — same pattern.

Streaming is NOT broken: when the model decides NOT to call any tools, the providers still stream normally. The tool loop only activates when the model actually emits tool calls.

**Step 2: Verify streaming still works**

The key insight: at line 1047-1050, REGULAR and COMPLEX keep `routeContext.onChunk` (streaming). The provider code (e.g., Groq L68) branches: if `useTools` is true but the model never calls a tool, the non-streaming path runs once and returns the text directly — which is fine. The provider handles this internally.

BUT: there's a subtle issue. When `useTools=true`, Groq and Nvidia skip the streaming path entirely (L68-85) and go to the non-streaming tool loop. Even if the model doesn't call any tools, the response won't stream.

To fix this, we need a "try streaming first, fall back to tool loop if model calls tools" pattern. However, this is complex and can be Phase 2b. For now, the non-streaming behavior for tool-enabled categories is acceptable — the response still arrives, just not token-by-token.

**Step 3: Commit**

```bash
git add src/lib/bot/chainRouter.ts
git commit -m "feat: enable tools for all text-based categories"
```

---

### Task 5: Remove TOOLS from Classifier Categories

**Files:**
- Modify: `src/lib/bot/classifier.ts:31-35` (VALID_CATEGORIES)
- Modify: `src/lib/bot/classifier.ts:108` (classifier prompt)
- Modify: `src/lib/bot/classifier.ts:123` (tag map)

**Step 1: Remove TOOLS from VALID_CATEGORIES**

At line 31-35, change:

```typescript
const VALID_CATEGORIES: (IntentCategory | 'MULTI_CHAIN')[] = [
  'REGULAR', 'COMPLEX',
  'IMAGE_GEN', 'WEB_SEARCH', 'AUDIO', 'TOOLS',
  'CODING', 'RESEARCH', 'MULTI_CHAIN', 'ADVISOR',
]
```

To:

```typescript
const VALID_CATEGORIES: (IntentCategory | 'MULTI_CHAIN')[] = [
  'REGULAR', 'COMPLEX',
  'IMAGE_GEN', 'WEB_SEARCH', 'AUDIO',
  'CODING', 'RESEARCH', 'MULTI_CHAIN', 'ADVISOR',
]
```

**Step 2: Remove TOOLS from classifier prompt**

At line 108, remove the line:
```
TOOLS: Intent that requires specialized tools.
```

**Step 3: Remap /tool tag**

At line 123, change:
```typescript
'/tool': 'TOOLS',
```
To:
```typescript
'/tool': 'COMPLEX',
```

This ensures users who type `/tool` still get a chain that has tools enabled (since COMPLEX now has `useTools: true` from Task 4).

**Step 4: Run existing classifier tests**

Run: `npx vitest run src/lib/bot/classifier.test.ts`
Expected: All tests PASS (existing tests test `resolveImageContext`, not the TOOLS category)

**Step 5: Commit**

```bash
git add src/lib/bot/classifier.ts
git commit -m "feat: remove TOOLS classification — tools now available in all text chains"
```

---

### Task 6: Add Tool Status Feedback to Chain Router

**Files:**
- Modify: `src/lib/bot/chainRouter.ts:1090-1120` (after model response handling)

**Step 1: Find where captured tool calls are processed**

After the model response comes back with `capturedToolCalls`, add a status update so users see "🔧 Using tools" during tool execution. Find the block where `capturedToolCalls` is extracted from the response (search for `capturedToolCalls` in chainRouter.ts) and add:

```typescript
// After extracting capturedToolCalls from the response:
if (capturedToolCalls && capturedToolCalls.length > 0) {
  const toolStatus: PipelineStep = {
    chain: category,
    goal: `Executed ${capturedToolCalls.length} tool(s)`,
    status: 'done',
    label: getStatusLabel('TOOLS', '🔧 Tools used')
  }
  onStatus(toolStatus)
}
```

This ensures the UI shows tool activity even though tools are no longer a separate classification category.

**Step 2: Commit**

```bash
git add src/lib/bot/chainRouter.ts
git commit -m "feat: add tool execution status feedback to UI"
```

---

## Phase 3: Simplified Classifier

Collapse 10+ categories into 4 primary routing categories. **Wait for user approval before starting this phase.**

---

### Task 7: Collapse Classifier Categories

**Files:**
- Modify: `src/lib/bot/classifier.ts:31-35` (VALID_CATEGORIES)
- Modify: `src/lib/bot/classifier.ts:101-116` (DEFAULT_CLASSIFIER_PROMPT)
- Modify: `src/lib/bot/classifier.ts:118-124` (TAG_CATEGORY_MAP)
- Modify: `src/lib/bot/classifier.ts:311-325` (guardCategory)

**Step 1: Update VALID_CATEGORIES**

```typescript
const VALID_CATEGORIES: (IntentCategory | 'MULTI_CHAIN')[] = [
  'COMPLEX',       // All text — questions, analysis, coding, advice, tools, reasoning
  'WEB_SEARCH',    // Needs current/live data — news, prices, product comparisons
  'IMAGE_GEN',     // Image creation
  'AUDIO',         // Voice/audio
]
```

**Step 2: Update DEFAULT_CLASSIFIER_PROMPT**

```typescript
const DEFAULT_CLASSIFIER_PROMPT = `Classify user intent into exactly ONE category:
COMPLEX: Any text-based request — questions, analysis, coding, advice, tool use, reasoning, step-by-step thinking.
WEB_SEARCH: Requires current or live data — news, prices, stock quotes, product comparisons, new software versions (e.g. "Gemini 3.1", "GPT-5"), sports scores, weather, or anything likely after training cutoff.
IMAGE_GEN: Requests to create, draw, design, or generate images or art.
AUDIO: Voice interaction or audio related.

PRIOR IMAGE: If history contains [VISION CONTEXT - DIGITAL TWIN] or [Image: ...] and the message refers to it ("from my image", "in the picture", "from the document"), the answer is in history, not on the web — classify COMPLEX, NEVER WEB_SEARCH, even if it names a product.

Respond ONLY with the category name.`
```

**Step 3: Update TAG_CATEGORY_MAP**

```typescript
const TAG_CATEGORY_MAP: Record<string, IntentCategory> = {
  '/search': 'WEB_SEARCH',
  '/research': 'WEB_SEARCH',
  '/code': 'COMPLEX',
  '/image': 'IMAGE_GEN',
  '/tool': 'COMPLEX',
}
```

**Step 4: Update guardCategory**

The CODING→WEB_SEARCH hardware guard is no longer needed (CODING doesn't exist as a category). Update:

```typescript
const guardCategory = (cat: IntentCategory | 'MULTI_CHAIN'): IntentCategory | 'MULTI_CHAIN' => {
  if ((cat === 'WEB_SEARCH') && historyHasVisionContext && refersToPriorImage && !mixedIntent) {
    logger.info(`[Classifier guard] Downgrading ${cat} → COMPLEX: message refers to a prior uploaded image`)
    return 'COMPLEX'
  }
  return cat
}
```

**Step 5: Run tests**

Run: `npx vitest run src/lib/bot/classifier.test.ts`
Expected: All tests PASS (tests use `resolveImageContext`, not category names — verify this)

**Step 6: Commit**

```bash
git add src/lib/bot/classifier.ts
git commit -m "feat: simplify classifier to 4 categories (COMPLEX, WEB_SEARCH, IMAGE_GEN, AUDIO)"
```

---

### Task 8: Update Chain Router for Simplified Categories

**Files:**
- Modify: `src/lib/bot/chainRouter.ts` (multiple locations)

**Step 1: Map legacy categories to COMPLEX**

Find the line where `rawCategory` is normalized (search for `FAST_SIMPLE`). Update the mapping:

```typescript
// Normalize legacy / internal categories to the simplified set
if (rawCategory === 'FAST_SIMPLE' || rawCategory === 'REGULAR') rawCategory = 'COMPLEX'
if (rawCategory === 'MEDIUM_THINKING') rawCategory = 'COMPLEX'
if (rawCategory === 'CODING') rawCategory = 'COMPLEX'
if (rawCategory === 'ADVISOR') rawCategory = 'COMPLEX'
if (rawCategory === 'TOOLS') rawCategory = 'COMPLEX'
if (rawCategory === 'RESEARCH') rawCategory = 'WEB_SEARCH'
```

**Step 2: Update useTools to match new categories**

Update the useTools line (from Task 4) to the simplified set:

```typescript
useTools: ['COMPLEX'].includes(category),
```

(WEB_SEARCH, IMAGE_GEN, AUDIO don't need tools)

**Step 3: Update streaming categories**

```typescript
const TEXT_STREAM_CATEGORIES = ['COMPLEX']
```

**Step 4: Run all tests**

Run: `npx vitest run`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/lib/bot/chainRouter.ts
git commit -m "feat: update chain router for simplified 4-category system"
```

---

### Task 9: Database Migration for Keywords

**Files:**
- Create: `docs/migrations/2026-06-17-simplify-classifier-keywords.sql`

**Step 1: Write the migration script**

```sql
-- Migration: Remap classifier keywords from removed categories to COMPLEX/WEB_SEARCH
-- Run this in Supabase SQL editor after deploying Phase 3 code changes.
-- Safe to run multiple times (idempotent via string replacement).

-- Remap keyword categories in bot_settings
UPDATE bot_settings 
SET content = REPLACE(
  REPLACE(
    REPLACE(
      REPLACE(
        REPLACE(content, '"REGULAR"', '"COMPLEX"'),
        '"CODING"', '"COMPLEX"'
      ),
      '"ADVISOR"', '"COMPLEX"'
    ),
    '"TOOLS"', '"COMPLEX"'
  ),
  '"RESEARCH"', '"WEB_SEARCH"'
)
WHERE category = 'classifier_keywords';

-- Update any admin classifier prompt that references removed categories
-- (Optional — the DEFAULT_CLASSIFIER_PROMPT already handles fallback)
```

**Step 2: Commit**

```bash
git add docs/migrations/
git commit -m "docs: add migration script for simplified classifier keywords"
```

---

## Phase 4: OpenRouter Tool Calling

Adds function calling support to OpenRouter — the last provider without it.

---

### Task 10: Add Tool Loop to OpenRouter Provider

**Files:**
- Modify: `src/lib/bot/providers/openrouter.ts:1-4` (imports)
- Modify: `src/lib/bot/providers/openrouter.ts:86-92` (request body)
- Major modification: `src/lib/bot/providers/openrouter.ts:86-234` (add tool loop)

**Step 1: Add imports**

At the top of `openrouter.ts`, add:

```typescript
import { FLOWR_TOOLS } from '../tools/definitions'
import { toolHandlers } from '../tools/handlers'
```

**Step 2: Build tool definitions (before the key loop)**

After line 27 (before `const historyMessages`), add:

```typescript
const tools = FLOWR_TOOLS.map(t => ({
  type: 'function' as const,
  function: {
    name: t.name,
    description: t.description,
    parameters: t.parameters
  }
}))
```

**Step 3: Add tool-calling path**

The key change is to split the request into two paths based on `normContext.useTools`:

1. **No tools** — existing streaming/non-streaming path (unchanged)
2. **Tools enabled** — disable streaming, add `tools` + `tool_choice: 'auto'` to request body, implement the `while (hops < MAX_TOOL_HOPS)` loop identical to `groq.ts:88-162`

Insert before the `shouldStream` check at line 86:

```typescript
// Tool-calling path: non-streaming due to tool loop
if (normContext.useTools) {
  const MAX_TOOL_HOPS = 4
  let hops = 0
  const capturedToolCalls: any[] = []

  while (hops < MAX_TOOL_HOPS) {
    const toolRequestBody: any = {
      model: modelId,
      messages,
      tools,
      tool_choice: 'auto',
      max_tokens: normContext.max_tokens || 5000,
    }

    if (resolvedSessionId) {
      toolRequestBody.session_id = String(resolvedSessionId)
    }
    if (normContext.openrouterProvider) {
      toolRequestBody.provider = {
        order: [(normContext.openrouterProvider || '').trim()],
        allow_fallbacks: true
      }
    }

    const response = await fetch(`https://openrouter.ai/api/v1/chat/completions?cb=${Date.now()}`, {
      method: 'POST',
      headers: fetchHeaders,
      body: JSON.stringify(toolRequestBody),
      signal: normContext.signal,
    })

    const actualProvider = response.headers.get('x-openrouter-provider') || undefined

    if (response.status === 429) {
      logger.warn(`OpenRouter [${modelId}] key index ${i + 1} rate limited (429) — trying next key`)
      break
    }

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error(err.error?.message || `OpenRouter API Error: ${response.status}`)
    }

    const data = await response.json()
    const message = data.choices?.[0]?.message
    if (!message) throw new Error('OpenRouter returned empty response')

    messages.push(message)

    if (message.tool_calls && message.tool_calls.length > 0) {
      hops++
      for (const call of message.tool_calls) {
        const handler = toolHandlers[call.function.name]
        let output = { error: 'Tool not found' }

        if (handler) {
          try {
            const args = JSON.parse(call.function.arguments)
            output = await handler(args, normContext)
            if (['create_note', 'update_note', 'delete_note', 'create_folder'].includes(call.function.name)) {
              capturedToolCalls.push({ type: call.function.name, ...output, ...args })
            }
          } catch (e: any) {
            output = { error: e.message }
          }
        }

        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(output)
        })
      }
    } else {
      // No more tool calls — return final response
      const usage = data?.usage ? {
        prompt_tokens: data.usage.prompt_tokens,
        completion_tokens: data.usage.completion_tokens,
        total_tokens: data.usage.total_tokens,
      } : undefined

      return {
        content: message.content,
        provider: actualProvider,
        usage,
        reasoning: message.reasoning || undefined,
        capturedToolCalls: capturedToolCalls.length > 0 ? capturedToolCalls : undefined,
      } as any
    }
  }
  // If we exhausted tool hops, fall through to next key
  continue
}
```

**Note:** The `fetchHeaders` variable needs to be moved BEFORE this block (currently defined at line 135, needs to be before the tool-calling check). Move the `fetchHeaders` construction to just after `hasPdf` is determined.

**Step 4: Update return type**

The function's return type needs `capturedToolCalls` added:

```typescript
): Promise<{ content: string; provider?: string; usage?: { ... }; reasoning?: string; capturedToolCalls?: any[] } | null> {
```

**Step 5: Run full test suite**

Run: `npx vitest run`
Expected: All tests PASS

**Step 6: Commit**

```bash
git add src/lib/bot/providers/openrouter.ts
git commit -m "feat: add tool calling loop to OpenRouter provider"
```

---

## Post-Implementation: Verification Checklist

After all tasks are complete, verify end-to-end:

**Phase 1 verification:**
- [ ] Send a WEB_SEARCH query → response has NO `[SEARCH DATA]` blocks
- [ ] Enable Thinking → no `[THINK CHAIN DIRECTION]` in UI
- [ ] Transcript files (`/transcripts/`) still contain full internal data

**Phase 2 verification:**
- [ ] Send "create a note called Test" (no /tool tag) → note is created
- [ ] Send "hi, how are you?" → NO tool calls (model doesn't call tools)
- [ ] Admin routing trace shows tool call metadata

**Phase 3 verification:**
- [ ] Send a coding question → routes to COMPLEX, answers correctly
- [ ] Send "latest news about X" → routes to WEB_SEARCH
- [ ] Run keyword migration SQL → verify in Admin > Bot > Keywords

**Phase 4 verification:**
- [ ] Configure OpenRouter model in COMPLEX chain
- [ ] Send "create a note called OR Test" → tools fire via OpenRouter
- [ ] Test with non-tool-capable model → graceful fallback, no error
