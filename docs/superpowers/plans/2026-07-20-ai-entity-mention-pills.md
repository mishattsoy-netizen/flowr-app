# AI Entity Mention Pills — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Flowr AI can emit `@mention` pills when referring to the user's entities (notes, folders, canvases, workspaces) — pixel-identical to the user's own mentions and clickable to open the entity.

**Architecture:** The AI writes a markdown link `[@Title](flowr:type:id)` inline in its final text answer. The assistant message renderer's `a` tag handler detects the `flowr:` scheme, resolves the entity by id in the store, and renders the exact same pill button markup used by `parseMentions`. A static prompt instruction teaches the AI the syntax and when to use it.

**Tech Stack:** React (JSX/TSX), Tailwind CSS, react-markdown, vitest, Zustand store

## Global Constraints

- Mentionable types: note, folder, canvas, workspace (excludes tasks, tags)
- Only entities the AI has a real `id` for from a tool result may be mentioned
- Pill visual markup must match `parseMentions` output byte-for-byte (same className string, same icon helper call, same onClick dispatch)
- The `flowr:` prefix must be detected BEFORE `ensureAbsoluteUrl` (which would otherwise prepend `https://` and break the href)
- No changes to tool definitions, tool handlers, message storage, or `parseMentions`
- Spec reference: `docs/superpowers/specs/2026-07-20-ai-entity-mention-pills-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/bot/services/promptBuilder.ts` | Modify | Add `[ENTITY MENTIONS]` static prompt block to `finalSysPrompt` |
| `src/lib/bot/services/promptBuilder.test.ts` | Modify | Test that the new block appears in the static prompt |
| `src/components/assistant/components/ChatMessage.tsx` | Modify | Add `stripAt` + `parseEntityHref` helpers, add `flowr:` early-return branch in `a` renderer |

## Unit & Integration test plan

| Test | Task | Verification |
|------|------|-------------|
| `buildSystemPrompt` output contains ENTITY MENTIONS block | Task 1 | Vitest assert `staticPrompt.toContain(...)` |
| `parseEntityHref` parses valid and invalid hrefs correctly | Task 2 | Manual check: `parseEntityHref('flowr:note:doc-123')` returns `{type:'note', id:'doc-123'}` |
| `stripAt` removes leading `@` | Task 2 | Manual check: `stripAt('@Meeting Notes')` → `'Meeting Notes'` |
| Pill renders from a `flowr:` link in assistant content | Task 2 | Manual: craft AI message with `[@Note](flowr:note:doc-123)`, verify pill DOM in browser |
| Fallback — id not in store (generic icon, clickable) | Task 2 | Manual: use a fictitious id, verify pill renders with link-text label |
| Coexistence — `flowr:` link + plain `@Title` both render as pills | Task 2 | Manual: message with both syntaxes, verify both pills rendered side-by-side |

---

### Task 1: Add `[ENTITY MENTIONS]` prompt block

**Files:**
- Modify: `src/lib/bot/services/promptBuilder.ts`
- Test: `src/lib/bot/services/promptBuilder.test.ts`

**Interfaces:**
- Consumes: none (standalone)
- Produces: static prompt string containing `[ENTITY MENTIONS]` with the mention syntax and rules

- [ ] **Step 1: Write the failing test**

In `src/lib/bot/services/promptBuilder.test.ts`, add a new `describe` block at the end of the file (before the final closing):

```ts
describe('buildSystemPrompt — entity mentions', () => {
  const mentionPhrases = [
    'flowr:<type>:<id>',
    'write it as a clickable mention',
    'Only mention entities you have a real',
    'Mentionable types: note, folder, canvas, workspace',
  ]

  it('includes entity mention instructions in the static prompt', async () => {
    const { staticPrompt } = await buildSystemPrompt('REGULAR', baseContext)
    for (const phrase of mentionPhrases) {
      expect(staticPrompt).toContain(phrase)
    }
  })

  it('still strips the static prompt for IMAGE_GEN', async () => {
    const { staticPrompt, dynamicContext } = await buildSystemPrompt('IMAGE_GEN', baseContext)
    expect(staticPrompt).toBe('')
    expect(dynamicContext).toBe('')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/lib/bot/services/promptBuilder.test.ts
```

Expected: The `entity mention instructions` test FAILS — `staticPrompt` does not contain the mention phrases yet. The `IMAGE_GEN` test PASSES (that case already returns empty).

- [ ] **Step 3: Add the entity-mentions block and append it**

In `src/lib/bot/services/promptBuilder.ts`, define the block constant and append it to `finalSysPrompt`. Insert the constant definition **before** the `finalSysPrompt += dateTimeRules` line (~line 138), and insert the append line **after** `finalSysPrompt += dateTimeRules` and **before** the security override `if` block:

**A. Constant definition** — insert before `finalSysPrompt += dateTimeRules`:

```ts
  const entityMentions = `\n\n[ENTITY MENTIONS]
When referring to a specific note, folder, canvas, or workspace whose
\`id\`, \`type\`, and \`title\` you received from a preceding tool result
(list_content, create_content, update_content, append_to_note, move_content),
write it as a clickable mention:

  [@<title>](flowr:<type>:<id>)

Examples:
- [@Meeting Notes](flowr:note:doc-12345)
- [@Project Alpha](flowr:workspace:workspace-67890)
- [@Design Assets](flowr:folder:folder-11111)
- [@Whiteboard](flowr:canvas:canvas-22222)

Rules:
- Only mention entities you have a real \`id\` for from a tool result —
  never invent ids or use @mention for entities you haven't seen.
- Copy the title EXACTLY as the tool returned it (the displayed title comes
  from the user's current data; your copy helps fallback if needed).
- Write @mentions in plain paragraph text — NOT inside bold, italics, code
  fences, or bullet/list markup. These hide the mention and prevent
  the pill from rendering correctly.
- Mentionable types: note, folder, canvas, workspace. Do NOT use @mention
  for tasks, tags, or other entity kinds — refer to those in plain text.
- Use a mention ONLY when you want the user to be able to click to open
  that entity. For casual non-navigational references, use plain text.\`
```

**B. Append line** — insert after the existing `finalSysPrompt += dateTimeRules` (line ~144), before the security override block:

```diff
  finalSysPrompt += dateTimeRules

+ finalSysPrompt += entityMentions

  if (context.isGlobalPromptEnabled) {
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/lib/bot/services/promptBuilder.test.ts
```

Expected: All tests PASS. The `entity mention instructions` test now finds the phrases in `staticPrompt`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/bot/services/promptBuilder.ts src/lib/bot/services/promptBuilder.test.ts
git commit -m "feat(ai): add entity mention prompt block

Adds [ENTITY MENTIONS] section to the static system prompt that
teaches the AI to emit clickable @mention pills using the
[@Title](flowr:type:id) markdown link syntax.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: Add `flowr:` link renderer branch

**Files:**
- Modify: `src/components/assistant/components/ChatMessage.tsx`

**Interfaces:**
- Consumes: `useStore.getState().entities`, `useStore.getState().spaces`, `useStore.getState().addTab`, `useStore.getState().setActiveSpaceId`, `getEntityIconReact(type, icon?)` (all already present in file)
- Produces: `parseEntityHref(href: string): { type: string; id: string } | null`, `stripAt(text: string): string`, and the pill button early-return in the `a` renderer

- [ ] **Step 1: Add the two helper functions**

Insert these two functions immediately **above** the existing `getEntityIconReact` function (~line 657 in `ChatMessage.tsx`). They are pure, no React dependencies:

```typescript
/**
 * Parses "flowr:<type>:<id>" into { type, id }.
 * Returns null if the href doesn't start with "flowr:" or lacks a colon separator.
 */
function parseEntityHref(href: string): { type: string; id: string } | null {
  if (!href || !href.startsWith('flowr:')) return null
  const rest = href.slice('flowr:'.length)
  const colonIdx = rest.indexOf(':')
  if (colonIdx === -1) return null
  return { type: rest.slice(0, colonIdx), id: rest.slice(colonIdx + 1) }
}

/** Removes a single leading '@' if present. */
function stripAt(text: string): string {
  return text.startsWith('@') ? text.slice(1) : text
}
```

- [ ] **Step 2: Manual verification of helper functions**

The app must be running (`npm run dev`). In the browser DevTools console, type the functions (they are pure — paste directly) and run:

```javascript
// --- paste helper definitions ---
function parseEntityHref(href) {
  if (!href || !href.startsWith('flowr:')) return null
  const rest = href.slice('flowr:'.length)
  const colonIdx = rest.indexOf(':')
  if (colonIdx === -1) return null
  return { type: rest.slice(0, colonIdx), id: rest.slice(colonIdx + 1) }
}
function stripAt(text) {
  return text.startsWith('@') ? text.slice(1) : text
}

// --- stripAt tests ---
console.assert(stripAt('@Meeting Notes') === 'Meeting Notes', 'strip @')
console.assert(stripAt('text@sign.com') === 'text@sign.com', 'keep non-leading @')
console.assert(stripAt('plain') === 'plain', 'pass-through')

// --- parseEntityHref tests ---
console.assert(parseEntityHref(null) === null, 'null → null')
console.assert(parseEntityHref('https://x.com') === null, 'http → null')
const r1 = parseEntityHref('flowr:note:doc-123')
console.assert(r1 !== null, 'valid → not null')
console.assert(r1.type === 'note', 'type = note')
console.assert(r1.id === 'doc-123', 'id = doc-123')
console.assert(parseEntityHref('flowr:folder:folder-456').type === 'folder', 'folder type')
console.assert(parseEntityHref('flowr:workspace:ws-789').type === 'workspace', 'workspace type')
console.assert(parseEntityHref('flowr:canvas:c-111').type === 'canvas', 'canvas type')
console.assert(parseEntityHref('flowr:xc') === null, 'no-colon → null')

console.log('All assertions passed ✓')
```

- [ ] **Step 3: Add the entity-mention early-return in the `a` renderer**

In `markdownComponents.a` (`ChatMessage.tsx:~1275`), insert the early-return block **after** `const isCitation = ...` (line 1276) and **before** `const ensureAbsoluteUrl = ...` (line 1278):

```typescript
      a: ({ href, children }: any) => {
        const isCitation = typeof children === 'string' && /^\[\d+\]$/.test(children);

        // ── Entity mention pill (flowr:<type>:<id>) ──
        const entityRef = parseEntityHref(href)
        if (entityRef && ['note','folder','canvas','workspace'].includes(entityRef.type)) {
          const store = useStore.getState()
          const resolved = store.entities.find((e: any) => e.id === entityRef.id)
            || store.spaces.find((s: any) => s.id === entityRef.id)
          const label = resolved?.title ?? stripAt(typeof children === 'string' ? children : '')

          return (
            <button
              className="inline-flex items-center gap-1.5 px-1.5 py-[1px] mx-[1px] rounded-[8px] bg-[var(--bone-6)] hover:bg-[var(--bone-10)] text-[var(--bone-100)] font-medium tracking-tight text-[13px] align-middle select-all transition-colors cursor-pointer"
              onClick={() => entityRef.type === 'workspace'
                ? store.setActiveSpaceId(entityRef.id)
                : store.addTab(entityRef.id)}
              title={entityRef.type === 'workspace' ? `Switch to ${label}` : `Open ${label}`}
            >
              {getEntityIconReact(resolved?.type ?? entityRef.type, (resolved as any)?.icon)}
              <span>{label}</span>
            </button>
          )
        }
        // ── end entity mention pill ──

        const ensureAbsoluteUrl = (urlStr: string): string => {
```

- [ ] **Step 4: Visual verification — pill renders correctly**

With the app running (`npm run dev`), open the AI assistant. Use browser DevTools to find a known entity id from the store, then craft a test verification:

```javascript
// In browser DevTools console:
const store = window.__ZUSTAND_STORE__ || /* access via React DevTools */
// Find a known entity:
const entity = /* pick any note from the sidebar whose id you know */ 
// Manually verify that parseEntityHref + the render path work by
// inspecting the ChatMessage component with a mock children-array
// containing the flowr: link text.
```

**Visual checklist (inspect the rendered DOM):**
- Pill background: `rgba(0,0,0,0.06)` in light theme (CSS var `--bone-6`).
- Pill contains: an icon (16px, 60% opacity) + a span with the entity title.
- Pill font: 13px, `font-weight: 500/600`, `-0.05em` letter-spacing, `border-radius: 8px`.
- Hover: background darkens to `--bone-10`.

- [ ] **Step 5: Verify fallback (id not in store)**

Use a fictitious id to confirm the fallback renders a pill with the link-text label and a generic icon:

```javascript
// Simulate: the AI wrote [@Mystery Note](flowr:note:doc-nonexistent-99999)
// parseEntityHref('flowr:note:doc-nonexistent-99999') → { type: 'note', id: 'doc-nonexistent-99999' }
// store.entities.find(...) → undefined (not in store)
// store.spaces.find(...) → undefined
// label = stripAt('Mystery Note') → 'Mystery Note'
// resolved.type = undefined → uses entityRef.type = 'note' → generic FileText icon
// onClick uses entityRef.id → addTab('doc-nonexistent-99999') (best-effort)
```

Expected: Pill renders with "Mystery Note" label, FileText icon. Clickable but may open a blank tab (expected for a non-existent id).

- [ ] **Step 6: Commit**

```bash
git add src/components/assistant/components/ChatMessage.tsx
git commit -m "feat(ai): render entity mention pills from flowr: links

The 'a' renderer detects flowr:<type>:<id> hrefs and returns the
identical clickable pill button (same markup as parseMentions).
Resolves entity by id in the store for the authoritative title/icon;
falls back gracefully to the link text when the id is not found.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: Integration verification

**Files:**
- None — verify only

- [ ] **Step 1: Run the app**

```bash
npm run dev
```

- [ ] **Step 2: Verify the prompt block is live**

Open the AI assistant, ask a question that triggers a `list_content` call (e.g. "find my notes about meetings"), then follow up with "reference that note in your answer using an @mention". The AI should emit `[@title](flowr:type:id)` syntax in its final text reply.

If needed, inspect the outgoing request payload in the Network tab to confirm the `[ENTITY MENTIONS]` block is present in the system prompt.

- [ ] **Step 3: Verify coexistence with plain `@Title` mentions**

Ensure that both mention types render correctly side-by-side:
- A plain `@Title` text mention (the existing `parseMentions` title-match path).
- A `[@Title](flowr:note:doc-id)` id-bearing link (the new `parseEntityHref` path).

Both should produce visually identical pills — same size, colors, icons, hover effect. The only difference is that the `flowr:` pill survives a note rename (it resolves the title fresh from the store, while the plain `@Title` pill freezes at the old title).

- [ ] **Step 4: Verify click behavior**

- Click a `flowr:note:id` pill → the note opens in a tab (`addTab` fires).
- Click a `flowr:workspace:id` pill → the workspace switches (`setActiveSpaceId` fires).
- Click a `flowr:folder:id` pill → the folder opens in a tab.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "docs: integration verification for entity mention pill feature

Co-Authored-By: Claude <noreply@anthropic.com>"
```