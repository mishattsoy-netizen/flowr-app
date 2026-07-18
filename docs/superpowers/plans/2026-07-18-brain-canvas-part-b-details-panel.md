# Brain Canvas Part B — Details Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a right-side details panel with two modes (Details, Connections) that opens on single-clicking a canvas node or connection line, replacing today's "single-click opens the editor" behavior. Includes clickable edges and in-place edge relabeling.

**Architecture:** One backend addition (`updateBrainEdge` + `update_edge` action). One SVG change to make edges clickable. A new `BrainDetailsPanel` component with two internal modes, driven by canvas selection state. The panel reuses the existing connect-tool state machine (`connectMode`/`connectSource`) as-is — it only adds a new entry point that pre-seeds the source.

**Tech Stack:** React + Tailwind, SVG hit-testing, Next.js API route, Supabase, vitest.

**Spec:** `docs/superpowers/specs/2026-07-18-brain-canvas-details-design.md` §4 (Part B). Field-per-kind matrix §4.2A. Approved mockups: `.superpowers/brainstorm/1030-1784320977/content/details-panel-v2.html`.

> **NOTE on Part C fields:** This plan builds the panel's Details mode with the fields that exist **today** (Title, Preview, Priority, Workspace, `🔗 N`, Open editor). The Type / Custom tag / Lifecycle field rows and the per-kind Workspace/Section branching (§4.2A) are added by **Part C**, which slots new field rows into the `DetailsMode` component this plan creates. Build Part B first; Part C extends it.

---

## File Structure

- `src/lib/bot/services/brainStore.ts` — add `updateBrainEdge` (create fn)
- `src/lib/bot/services/brainStore.edge.test.ts` — not applicable (DB-bound); covered by API-level manual verification
- `src/app/api/ai/user-brain/route.ts` — add `update_edge` action (modify)
- `src/components/brain/canvas/BrainCanvasConnections.tsx` — add invisible hit-stroke path + onClick (modify)
- `src/components/brain/canvas/BrainDetailsPanel.tsx` — the new panel shell + mode switch (create)
- `src/components/brain/canvas/DetailsMode.tsx` — Details mode content (create)
- `src/components/brain/canvas/ConnectionsMode.tsx` — Connections mode content (create)
- `src/components/brain/canvas/BrainCanvasPage.tsx` — selection→panel wiring, click-semantics change, editor coexistence (modify)

---

## Task 1: Backend — `updateBrainEdge` + `update_edge` action

**Files:**
- Modify: `src/lib/bot/services/brainStore.ts` (add after `removeBrainEdge`, ~line 457)
- Modify: `src/app/api/ai/user-brain/route.ts` (`switch` block + imports)

- [ ] **Step 1: Read the existing edge functions**

Read `addBrainEdge` and `removeBrainEdge` in `brainStore.ts` (~lines 432–465) to copy their exact signature shape, the `logRevision` call pattern, and the `.eq(...)` chain (user_id/brain_id/deleted_at guards).

- [ ] **Step 2: Add `updateBrainEdge`**

```typescript
export async function updateBrainEdge(
  userId: string, actor: 'user' | 'bot', brainId: string, edgeId: string, label: string
): Promise<{ success: true } | { error: string }> {
  if (!supabaseAdmin) return { error: 'Supabase not configured' }
  const { data, error } = await supabaseAdmin.from('brain_edges')
    .update({ label: label?.trim() ?? '' })
    .eq('id', edgeId).eq('user_id', userId).eq('brain_id', brainId).is('deleted_at', null)
    .select('id')
  if (error) return { error: error.message }
  if (!data || data.length === 0) return { error: `Brain edge '${edgeId}' not found.` }
  await logRevision(userId, actor, 'update_edge', { id: edgeId, brain_id: brainId, label })
  return { success: true }
}
```

Note: confirm `brain_edges` has a `deleted_at` column (it does per the P1 migration) — if the local schema differs, drop that `.is('deleted_at', null)` guard to match `removeBrainEdge`'s actual chain.

- [ ] **Step 3: Add the `update_edge` API action**

In `route.ts`, import `updateBrainEdge` and add alongside `connect`/`disconnect` (lines 77–80):

```typescript
      case 'update_edge':
        return NextResponse.json(await updateBrainEdge(userId, 'user', body.brain_id, body.edge_id, body.label ?? ''))
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/bot/services/brainStore.ts src/app/api/ai/user-brain/route.ts
git commit -m "feat(brain): updateBrainEdge + update_edge API action"
```

---

## Task 2: Clickable connection lines

**Files:**
- Modify: `src/components/brain/canvas/BrainCanvasConnections.tsx`

- [ ] **Step 1: Read the current edge rendering**

Read `BrainCanvasConnections.tsx` fully. Identify: the `<svg>` (currently `pointer-events-none`), each edge's visible `<path>` and its `d` attribute, and the existing `pointer-events-auto` label `<text>`. Note how edge identity (`edge.id`) is available in the render loop and whether an `onEdgeClick` prop already exists.

- [ ] **Step 2: Add an `onEdgeClick` prop**

Add `onEdgeClick?: (edgeId: string) => void` to the component's props interface.

- [ ] **Step 3: Render a transparent hit-stroke path per edge**

For each edge, alongside the visible thin `<path>`, render a second `<path>` with the **same `d`**, `stroke="transparent"`, `strokeWidth={16}`, `fill="none"`, `style={{ pointerEvents: 'stroke', cursor: 'pointer' }}`, and `onClick={() => onEdgeClick?.(edge.id)}`. Render it just before or after the visible path (z-order within the same `<g>` is fine since it's transparent). The `<svg>` itself stays `pointer-events-none`; only these hit-strokes and the existing labels are interactive (`pointer-events` on the child overrides the parent).

- [ ] **Step 4: Verify visually**

Start the dev server, open a brain with edges. Hover an edge line → cursor becomes a pointer along the whole line (not just the label). Clicking logs/does nothing yet (handler wired in Task 6).

Add a temporary `console.log('edge click', edgeId)` inside the handler to confirm hit-testing, then remove it before commit.

- [ ] **Step 5: Commit**

```bash
git add src/components/brain/canvas/BrainCanvasConnections.tsx
git commit -m "feat(brain): make connection lines clickable via invisible hit-stroke"
```

---

## Task 3: `BrainDetailsPanel` shell + Details mode (current fields)

**Files:**
- Create: `src/components/brain/canvas/BrainDetailsPanel.tsx`
- Create: `src/components/brain/canvas/DetailsMode.tsx`

- [ ] **Step 1: Read the approved mockup**

Read `.superpowers/brainstorm/1030-1784320977/content/details-panel-v2.html` — this is the approved visual target for Details mode (header usage bar, title, preview, field rows, `🔗 N` + Open editor action row, collapsed other-selected rows with hover-connect button). Match its structure and the app's floating-panel classes.

- [ ] **Step 2: Build the panel shell**

`BrainDetailsPanel.tsx` — props:

```typescript
interface BrainDetailsPanelProps {
  mode: 'details' | 'connections'
  focusedNodeId: string
  selectedNodeIds: string[]       // full multi-selection; focused is one of these
  nodes: BrainCanvasNode[]
  edges: BrainCanvasEdge[]
  perNodeTokens: Record<string, number>
  perNodeCap: number
  onClose: () => void
  onFocusNode: (id: string) => void          // click a collapsed/connected row → refocus
  onOpenEditor: (refId: string) => void
  onSetMode: (m: 'details' | 'connections') => void
  onStartConnectFrom: (nodeId: string) => void   // pre-seed connect tool
  onConnect: (fromId: string, toId: string) => void
  onUpdateEdgeLabel: (edgeId: string, label: string) => void
  onBreakEdge: (edgeId: string) => void
}
```

Container: `bg-panel/98 backdrop-blur-xl border border-[var(--bone-12)] rounded-[16px] shadow-[...] canvas-floating-panel`, anchored right edge, fixed width 360px. Render `DetailsMode` or `ConnectionsMode` based on `mode`.

- [ ] **Step 3: Build `DetailsMode` with today's fields**

Per spec §4.2 (Note/entity fields that exist today — Part C adds the rest):
1. Header: usage bar `perNodeTokens[focusedNodeId] / perNodeCap` (% fill), `•••` + `✕` (close → `onClose`).
2. Title: inline-editable, commits via `update_node` (`updateBrainNode({ label })`).
3. Preview: node's content preview, dimmed/truncated, read-only.
4. Field rows (today's set): **Priority** pill (existing priority-popup style), **Workspace** pill (parent workspace or "Unsorted"; click opens workspace picker — reuse the tasks-panel picker; reassign moves entity to that workspace root).
5. Action row: `🔗 N` (N = edges of focused node from `edges`, filtered by `from_node`/`to_node` === focusedNodeId; **not** limited to selection) → `onSetMode('connections')`. Beside it, **Open editor** → `onOpenEditor(node.ref_id)`.
6. Other-selected rows (only if `selectedNodeIds.length > 1`): each other selected node as a collapsed row, connected-first then unconnected; click → `onFocusNode`; hover right edge of an **unconnected** row → one-click connect button calling `onConnect(focusedNodeId, thatId)`. No drag anywhere.

Leave a clearly-marked insertion point comment where Part C adds Type/Tag/Lifecycle rows:
```tsx
{/* PART-C-FIELDS: Type / Custom tag / Lifecycle rows inserted here */}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (Not mounted yet — visual check in Task 6.)

- [ ] **Step 5: Commit**

```bash
git add src/components/brain/canvas/BrainDetailsPanel.tsx src/components/brain/canvas/DetailsMode.tsx
git commit -m "feat(brain): BrainDetailsPanel shell + Details mode (current fields)"
```

---

## Task 4: Connections mode

**Files:**
- Create: `src/components/brain/canvas/ConnectionsMode.tsx`

- [ ] **Step 1: Read the mockup's Connections panel**

The v2 mockup's right column is the target: focused node highlighted at top, its full real edge set below as a chain with editable label chips between rows, a "+ Connect to another node" row, and an "Other selected (not yet connected)" section.

- [ ] **Step 2: Build `ConnectionsMode`**

Per spec §4.3:
1. Header: "‹ Back to details" (→ `onSetMode('details')`) + `✕`.
2. Connected chain: focused node (blue highlight) at top, then **every** node it has a real edge to (from `edges`, both directions), each a row; a connector line + editable label chip on each segment. Chip click → inline edit → `onUpdateEdgeLabel(edgeId, text)`. Each edge row also has a break/detach affordance → `onBreakEdge(edgeId)`. This list is the node's complete real edge set, independent of selection.
3. "+ Connect to another node" row → `onStartConnectFrom(focusedNodeId)` (activates connect tool with source pre-seeded). Does NOT accept drops.
4. "Other selected, not-yet-connected" section (only if the selection has nodes not already in the connected chain): collapsed rows with the same hover-to-connect-instantly button (`onConnect`), scoped to selection.
5. Clicking any connected row (not the focused one) → `onFocusNode(thatId)` (panel re-centers).

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/brain/canvas/ConnectionsMode.tsx
git commit -m "feat(brain): Connections mode (real edge chain, editable labels, connect entry)"
```

---

## Task 5: Right-click "Open in editor" context-menu item

Per spec §4.1: since single-click no longer opens the editor, add "Open in editor" to the node right-click menu above "Delete".

**Files:**
- Modify: the node context-menu component (grep to locate — `git grep -n "Delete" src/components/brain/canvas/` and `src/components/layout/ContextMenu.tsx`)

- [ ] **Step 1: Locate the node context menu**

Run: `git grep -ln "context\|ContextMenu\|Delete" src/components/brain/canvas/`
Find where a brain node's right-click menu items (including "Delete") are defined.

- [ ] **Step 2: Add the item**

Add an "Open in editor" item directly above "Delete", calling the same `openBrainNode(ref_id)` handler single-click used to call.

- [ ] **Step 3: Verify + commit**

Verify in-app: right-click a node → menu shows "Open in editor" above "Delete"; clicking it opens the note.

```bash
git add <the context-menu file>
git commit -m "feat(brain): add 'Open in editor' to node right-click menu"
```

---

## Task 6: Wire selection → panel; change click semantics; editor coexistence

This is the integration task. **The single-click behavior change (§4.1) is breaking** — do it deliberately.

**Files:**
- Modify: `src/components/brain/canvas/BrainCanvasPage.tsx`

- [ ] **Step 1: Read the current click + editor-open flow**

In `BrainCanvasPage.tsx`, find: (a) the node single-click handler (currently calls `openBrainNode(entity.ref_id)`), (b) the multi-selection state (`selectedNodeIds` or equivalent), (c) how the split-view editor right column mounts/opens (`openBrainNode`), (d) the connect-tool state (`connectMode`, `connectSource`, `setConnectMode`).

- [ ] **Step 2: Add panel state**

Add state: `detailsPanel: { focusedNodeId: string; mode: 'details' | 'connections' } | null` and `editorOpen: boolean` (or reuse whatever tracks the split-view column). Rule (§4.1.1): **panel and editor are mutually exclusive** in the right slot.

- [ ] **Step 3: Change single-click to open the panel**

Node single-click → set `detailsPanel = { focusedNodeId: clickedId, mode: 'details' }` (instead of `openBrainNode`). Multi-select (shift/ctrl-click) still accumulates `selectedNodeIds`; opening the panel with a multi-selection focuses the just-clicked node (§4.4). Sidebar clicks are unchanged (do NOT touch `BrainSidebarContent`).

- [ ] **Step 4: Wire edge click**

Pass `onEdgeClick` to `BrainCanvasConnections` (Task 2): clicking an edge → open the panel in `connections` mode focused on one endpoint (e.g. `edge.from_node`).

- [ ] **Step 5: Mount `BrainDetailsPanel` and wire all callbacks**

Render `<BrainDetailsPanel />` when `detailsPanel !== null` and the editor is closed. Wire:
- `onClose` → `detailsPanel = null`.
- `onOpenEditor(refId)` → slide transition (§4.1.1): close the panel, open the editor column for that ref. Add the persistent collapse button on the editor column's outer edge that reverses it (re-opens the panel for the same node).
- `onFocusNode` → update `detailsPanel.focusedNodeId`.
- `onSetMode` → update `detailsPanel.mode`.
- `onStartConnectFrom(nodeId)` → `setConnectMode(true)` + set `connectSource = nodeId` (reuse existing machinery; the pending dashed line already follows the cursor).
- `onConnect(from, to)` → existing `connect` action (`addBrainEdge`), then refetch.
- `onUpdateEdgeLabel(edgeId, label)` → `update_edge` action (Task 1), then refetch.
- `onBreakEdge(edgeId)` → existing `disconnect` action, then refetch.

- [ ] **Step 6: Full manual verification**

Start the dev server:
- Single-click a node → details panel opens (editor does NOT open). ✓
- Multi-select then click → panel focuses last-clicked, others listed below. ✓
- Click an edge → Connections mode with that edge's endpoints. ✓
- `🔗 N` → Connections mode showing ALL real edges of the focused node. ✓
- Edit a label chip → persists after refetch. ✓
- "+ Connect" → connect tool active, dashed line from focused node follows cursor; drop on another node connects them. ✓
- Hover an unconnected selected row's right edge → one-click connect button works. ✓
- "Open editor" → panel slides out, editor slides in; collapse button brings the panel back. ✓
- Right-click → "Open in editor" still works (Task 5). ✓

- [ ] **Step 7: Commit**

```bash
git add src/components/brain/canvas/BrainCanvasPage.tsx
git commit -m "feat(brain): wire details panel — click opens panel, editor coexistence, edge click"
```

---

## Self-Review Notes (Part B)

- **Spec coverage:** §4.1 click change + sidebar-unchanged + right-click item (Tasks 3,5,6), §4.1.1 editor coexistence (Task 6 step 5), §4.2 Details mode (Task 3), §4.3 Connections mode (Task 4), §4.4 multi-select focus (Task 6), §4.5 clickable edges (Task 2), §4.6 edge relabel (Task 1). §4.2A/§4.2B per-kind + workspace-description and §4.7 tag/type/lifecycle are **Part C** (the `PART-C-FIELDS` insertion point in Task 3 is where they land).
- **Reuses, doesn't rebuild:** the connect-tool state machine is untouched; the panel only pre-seeds `connectSource`. Priority popup and workspace picker are reused from existing panels.
- **Type consistency:** `BrainCanvasNode`/`BrainCanvasEdge` come from `useBrainData.ts`; `perNodeCap` comes from Part A (or defaults to 2000 if Part B ships first — but Part B depends on nothing new from A except `perNodeCap`; if A hasn't shipped, add `perNodeCap` to the panel props with a 2000 fallback and note it).
- **Ordering caveat:** Part B's header usage bar uses `perNodeCap` (Part A, Task 4). If executing B before A, pull just that one-line `listBrain` change forward.
