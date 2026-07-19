# AI Entity Mention Pills — Design

**Date:** 2026-07-20
**Status:** Approved, pending implementation plan

## Goal

Flowr AI can reference the user's entities (notes, folders, canvases, workspaces) with clickable `@mention` pills, visually identical to the user's own mentions. "Instead of plain text 'note,' it should use `@note` and a pill is generated in the message bubble alongside text, clickable."

## Architecture

Three moving parts — all reuse existing infrastructure:

1. **Prompt instruction** → `src/lib/bot/services/promptBuilder.ts` — teaches the AI a markdown-link syntax for mentioning entities.
2. **Renderer branch** → `src/components/assistant/components/ChatMessage.tsx` `a` renderer — detects entity-mention links and renders the identical pill button.
3. **No changes** to tools, storage, or `parseMentions` — the system already carries `{id, title, type}` in tool results and already renders `@Title` plain-text mentions as pills for assistant messages.

### Why the link syntax, not plain `@Title`

The user's own mentions are plain `@Title` text, matched by `parseMentions` at render time. That works for the user (who picks exact titles from a dropdown). For the AI, title-matching is fragile:

- Case sensitivity (`@meeting notes` ≠ `Meeting Notes`) — the AI may miscase.
- Title collisions (two notes named "Meeting Notes") — wrong one opens.
- Renames break existing mentions — a note renamed after the message was sent loses its pill.

The AI **has the entity's `id` and `type`** from every content-tool result. A markdown link `[@Title](flowr:type:id)` carries that authoritative id into the renderer, which resolves the pill by id — immune to all three failure modes above, and the rendered pill title is the store's **current** title, not a frozen copy.

The pill's visual markup is copied verbatim from `parseMentions`, so the user sees no difference.

## Detailed Design

### 1. Prompt instruction (`promptBuilder.ts`)

Add a `[ENTITY MENTIONS]` block to `buildSystemPrompt`, appended to the final system prompt before return. Placement: after existing blocks (brain, date rules, etc.), before `[/SYSTEM]` or final return.

```
[ENTITY MENTIONS]
When referring to a specific note, folder, canvas, or workspace whose `id`, `type`,
and `title` you received from a preceding tool result (list_content, create_content,
update_content, append_to_note, move_content), write it as a clickable mention:

  [@<title>](flowr:<type>:<id>)

Examples:
- [@Meeting Notes](flowr:note:doc-1719000000000)
- [@Project Alpha](flowr:workspace:workspace-1719000000001)
- [@Design Assets](flowr:folder:folder-1719000000002)

Rules:
- Only mention entities you have a real `id` for from a tool result — never invent ids.
- Copy the title exactly as the tool returned it (the displayed title comes from the
  user's current data; your copy helps if the entity is temporarily unavailable).
- Write mentions in plain paragraph text — not inside bold, italic, code, or bullet
  marks. These prevent the pill from rendering.
- Mentionable types: note, folder, canvas, workspace. Do NOT use @mentions for tasks,
  tags, or other entity kinds — refer to those in plain text.
- Use a mention ONLY when you want the user to be able to click to open that entity.
  For casual non-navigational references, use plain text instead.
```

### 2. Renderer addition (`ChatMessage.tsx`)

A new early-return branch in the `a` renderer (`markdownComponents.a`, line ~1275), placed **before** `ensureAbsoluteUrl` and the existing citation/pill logic.

```tsx
// ── Entity mention pill (flowr:<type>:<id>) ──

const parseEntityHref = (href: string) => {
  if (!href || !href.startsWith('flowr:')) return null;
  const rest = href.slice('flowr:'.length);
  const colonIdx = rest.indexOf(':');
  if (colonIdx === -1) return null;
  return { type: rest.slice(0, colonIdx), id: rest.slice(colonIdx + 1) };
};

const entityRef = parseEntityHref(href);
if (entityRef && ['note','folder','canvas','workspace'].includes(entityRef.type)) {
  const store = useStore.getState();
  const resolved = store.entities.find(e => e.id === entityRef.id)
    || store.spaces.find(s => s.id === entityRef.id);
  const label = resolved?.title ?? stripAt(typeof children === 'string' ? children : '');

  return (
    <button
      className="inline-flex items-center gap-1.5 px-1.5 py-[1px] mx-[1px] rounded-[8px] bg-[var(--bone-6)] hover:bg-[var(--bone-10)] text-[var(--bone-100)] font-medium tracking-tight text-[13px] align-middle select-all transition-colors cursor-pointer"
      onClick={() => entityRef.type === 'workspace'
        ? store.setActiveSpaceId(entityRef.id)
        : store.addTab(entityRef.id)}
      title={entityRef.type === 'workspace' ? `Switch to ${label}` : `Open ${label}`}
    >
      {getEntityIconReact(resolved?.type ?? entityRef.type, resolved?.icon)}
      <span>{label}</span>
    </button>
  );
}
// ── existing ensureAbsoluteUrl, citation, pill: logic continues below ──
```

**Pill markup**: Identical className string, identical `getEntityIconReact` call, identical onClick dispatch (`addTab` for entities, `setActiveSpaceId` for workspaces). Pixel-identical to `parseMentions` output.

**Title resolution**: Looks up the id in `entities` and `spaces` stores. If found → rendered title is the store's **current** title (survives renames — strictly better than the user's own frozen-title pills). Icon comes from `resolved.type` (e.g. a folder → `Folder` icon even though the href says `flowr:folder:...`). Custom entity icons (`resolved.icon`) are honored.

**Fallback** (id not in store — rare: just-created entity not yet synced, or deleted):
- Label = link text stripped of leading `@` (the AI's verbatim title copy).
- Icon = generic by `entityRef.type` (`FileText` for note, `Folder` for folder, `Frame` for canvas, `Box` for workspace).
- Still clickable — `addTab`/`setActiveSpaceId` called with the real id; may resolve at click time even if the store was stale.

**`stripAt` helper**: Removes a single leading `@` if present.

### 3. What doesn't change

- **Tool definitions & handlers** — untouched. They already return `{id, title, type}` in every content-tool result and survive into the next turn's model context.
- **`parseMentions`** — untouched. Still runs on assistant text at `ChatMessage.tsx:1257`. Any plain `@Title` the AI emits (without the `flowr:` link) still gets title-matched as before — side-by-side compatibility with the new id-based path.
- **Message storage** — untouched. Mentions are embedded in `AIMessage.content` as markdown text, same as any other content. No schema change.
- **Messagebar / `ChatInputEditable`** — untouched. The user's mention flow is unchanged.

## Behavior Contract

| Scenario | Behavior |
|---|---|
| AI writes `[@Note](flowr:note:doc-123)` in a paragraph | Pill renders inline, icon + current title from store, click → `addTab('doc-123')` |
| AI writes `[@Workspace](flowr:workspace:ws-456)` | Pill renders with workspace Box icon, click → `setActiveSpaceId('ws-456')` |
| Entity renamed since the AI's turn | Pill shows **new** title (resolved from store by id) |
| Id not in client store | Pill renders with link-text label, generic icon, still clickable (best-effort `addTab`/`setActiveSpaceId`) |
| AI writes `**[@x](flowr:note:id)**` (inside bold) | react-markdown resolves the `a` even inside `strong` or `em` (links are inline). The `a` renderer fires, the pill short-circuits with a `<button>` — fully rendered. The `<strong>` wrapper around the button is cosmetic; the pill's own `font-medium` keeps the correct weight. |
| AI writes `[@x](flowr:note:id)` inside a bullet | Pill renders in the `<li>`. react-markdown still resolves the `<a>`. Works. |
| AI writes `[@task](flowr:task:t-123)` | `parseEntityHref` returns `{ type: 'task' }` → not in the allowlist → falls through to normal link rendering (plain `<a>`) |
| AI writes `@Meeting Notes` as plain text (no link) | `parseMentions` picks it up via existing title-match path → same pill |
| AI invents `flowr:note:fake-id` with no real tool result | Pill renders with the AI's text as label, clickable but id resolves to nothing → addTab('fake-id') does nothing (or opens a blank tab). Prompt instruction prohibits this. |

## Testing Criteria

1. **Prompt test**: With the system prompt change, the AI emits `[@Title](flowr:type:id)` for a `list_content`-returned note when asked to reference it, not plain "the Note titled X."
2. **Render test**: A message with `[@Test Note](flowr:note:doc-123)` in assistant content renders as a pill button matching the user pill (compare className, icon, click behavior via React DevTools snap).
3. **Click test — note**: Clicking the pill on a known note id calls `addTab` with that id.
4. **Click test — workspace**: Clicking the pill on a known workspace id calls `setActiveSpaceId` with that id.
5. **Fallback test**: An entity id not in the store falls back to link-text label + generic icon, clickable.
6. **Coexistence test**: A message containing both a `flowr:` link and a plain `@Title` renders both types as pills side by side.
7. **Icon test**: A `flowr:folder:id` link renders with the `Folder` icon; `flowr:canvas:id` with `Frame`.