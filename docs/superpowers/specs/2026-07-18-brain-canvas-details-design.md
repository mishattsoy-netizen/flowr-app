# Brain Canvas — Left Stats Panel & Node/Connection Details Panel — Design

Date: 2026-07-18 · Status: **Design, not yet implemented.**

Relationship to prior specs: builds on `2026-07-17-brain-canvas-design.md` (P2, the spatial canvas — implemented) and its two follow-ups, `2026-07-17-brain-per-node-token-count.md` (per-node token cost, implemented) and `2026-07-17-brain-memory-migration.md` (memory→entity migration, implemented). This spec is the next visible layer on top: a redesigned left stats/switcher panel, and a brand-new right-side details panel for inspecting and editing nodes/connections without leaving the canvas.

## 1. Vision

The brain canvas today lets you place, drag, and connect nodes, but has no dedicated place to actually *look at* a node's metadata or a connection's details — clicking a node jumps straight into the note editor, and there's no way to inspect or edit an edge at all. This spec adds a details panel (game-like, per the original canvas spec's framing) that becomes the primary way to inspect nodes and connections, plus consolidates the top-left brain switcher and top-right stats readout into one richer panel with real usage analytics.

## 2. Scope split

This is two independent, separately buildable pieces:

- **Part A — Left panel.** Replaces `BrainPresetPicker` (top-left) and `BrainStatsPanel` (top-right) with a single panel, anchored top-left, with a compact default view and an expandable analytics section.
- **Part B — Details panel.** A new right-side panel with two modes (Details, Connections) that opens on single-clicking a node or a connection line.

They share no runtime state and can be built/shipped in either order.

## 3. Part A — Left panel

### 3.1 What it replaces

- `BrainPresetPicker.tsx` (brain switcher dropdown, top-left) — removed as a separate component, folded in.
- `BrainStatsPanel.tsx` (nodes/edges/budget readout, top-right) — removed as a separate component, folded in.

### 3.2 Compact view (default)

Single panel, anchored where `BrainPresetPicker` sits today (top-left):

- Row 1: brain icon + name (click → dropdown of all brains, same list `BrainPresetPicker` shows today) + a "•••" or chevron for panel-level actions; a collapse/expand toggle on the right.
- Row 2: the budget bar (used/limit %, same visual as today's `BrainStatsPanel` gauge) with the percentage and limit shown inline.
- Row 3: a 4-cell stat grid — **Nodes**, **Edges**, **Active days**, **Requests** (see 3.5 for what "Requests" needs).

This compact view is always visible; it does not require expanding to see the basics.

### 3.3 Brain switcher, rename, set-default

Clicking the brain name/icon opens the same dropdown-of-brains list as today's `BrainPresetPicker` (title + `is_default` badge + selected checkmark). Two new actions are added to that surface:

- **Rename**: inline edit on the current brain's name (or a rename option in a per-brain row menu). Backend: `updateBrainMeta(userId, brainId, { title })` — already exists, no change needed.
- **Set as default**: a new action, needed because no code path exists today to change `is_default` after a brain's initial auto-creation. New backend function:

```typescript
// src/lib/bot/services/brainStore.ts
export async function setDefaultBrain(userId: string, brainId: string): Promise<{ success: true } | { error: string }> {
  if (!supabaseAdmin) return { error: 'Supabase not configured' }
  if (!(await assertOwnedBrain(userId, brainId))) return { error: `Brain '${brainId}' not found.` }
  // Two writes, not one atomic statement — brains.is_default has a unique
  // partial index (one default per user, see getOrCreateDefaultBrain's
  // comment at brainStore.ts:57-58), so the old default must be cleared
  // before the new one is set or the unique index rejects the insert.
  const { error: clearErr } = await supabaseAdmin.from('brains')
    .update({ is_default: false }).eq('user_id', userId).eq('is_default', true)
  if (clearErr) return { error: clearErr.message }
  const { error: setErr } = await supabaseAdmin.from('brains')
    .update({ is_default: true, updated_at: new Date().toISOString() })
    .eq('id', brainId).eq('user_id', userId)
  if (setErr) return { error: setErr.message }
  return { success: true }
}
```

New `manage_brain`-adjacent API action (`/api/ai/user-brain` POST, alongside the existing brain-meta actions) — exact action name and wiring decided at plan time, following the same pattern as `update_brain`/`create_brain` already in that route.

### 3.4 Expanded view

Clicking the expand toggle grows the panel downward (does not overlay/float — pushes content below it, matching the existing `canvas-floating-panel` positioning pattern). Sections, top to bottom:

1. **Same compact header + stat grid** (stays visible, not duplicated — expansion adds below it).
2. **Top 5 by usage** — the 5 nodes with the highest `perNodeTokens[id] / budget.limit` percentage, rendered as horizontal gradient bars (visual reference: dashboard-card screenshots provided — bold gradient fill, percentage label inside the bar). No reset affordance here — this is a live, always-current derived percentage (from `perNodeTokens`), not an accumulating counter, so there's nothing to reset.
3. **Priority distribution** — % of nodes at High/Medium/Low priority, as thin colored bars with percentage labels.
4. **Nodes by color tag** — chip list, one per color in use (+ an "Untagged" chip), each showing a colored dot and count. Requires the new `color` column (3.7).
5. **Activity** — a GitHub/Claude-contributions-style calendar (visual reference: attached screenshots) showing brain activity (node/edge edits + AI requests, see 3.5) over roughly the last 6 months, darker/lighter green cells by day intensity.
6. **Reset statistics** — a single affordance pinned at the very bottom of the expanded view (its own row, below all sections), separate from any individual section header. Clears only the accumulating counters that grow unbounded over time: this brain's `brain_usage_events` rows, which zeroes the **Requests** stat, **Active days** stat, current streak, and the activity calendar. Does not affect Top 5 by usage, priority distribution, or color-tag counts — those are live snapshots of current node state, not history.

### 3.5 New backend: AI request tracking

Nothing today logs when a brain is actually injected into a chat request — `logRevision` only logs node/edge edits (add/update/remove/connect/disconnect), not reads. `getBrainBlockForSession` (`brainStore.ts:260`, called from `chainRouter.ts:529`) is the injection point and needs a new log call.

```typescript
// New table: brain_usage_events (migration, exact columns/indexes decided at plan time)
// id, user_id, brain_id, created_at — one row per request that actually
// injected this brain's compiled block into context.

// In getBrainBlockForSession, after a successful compile/injection:
await logBrainUsageEvent(userId, brainId)
```

This single event stream powers three things in the expanded panel:
- **Requests** stat (compact + expanded): `COUNT(*)` for this brain.
- **Active days** stat: `COUNT(DISTINCT date_trunc('day', created_at))`.
- **Activity calendar**: daily counts, bucketed into the same 4 intensity levels the mockup shows.

**Reset statistics** (§3.4 item 6): deletes all of this brain's `brain_usage_events` rows, zeroing Requests, Active days, current streak, and the activity calendar. Nothing else is affected.

### 3.6 Tier limit change

Business/product decisions made during this brainstorm, not derived from code. Free tier has no AI access at all (per owner), so its `brain_config` row is inert and left untouched — only pro and max change:

```sql
UPDATE brain_config SET token_limit = 8000  WHERE tier = 'pro';
UPDATE brain_config SET token_limit = 14000 WHERE tier = 'max';
-- max's per_node_cap (3000) is unchanged — only the brain-wide limit moves.
```

No code change needed — both `token_limit` and `per_node_cap` are already read live from the table (`getBrainConfigForUser`). Free tier (2,000 / 1,000) is unchanged.

### 3.7 New backend: per-node color tag

New nullable column on `brain_nodes`:

```sql
ALTER TABLE brain_nodes ADD COLUMN IF NOT EXISTS color text;
```

Free-form — no fixed enum, no meaning imposed by the system (per owner: "purely user-chosen, no fixed meaning... like a highlighter/label system"). Stored as a hex string or a small fixed palette key (exact representation decided at plan time — a fixed palette of ~6-8 colors is simpler to build a legend for than arbitrary hex). Settable via `updateBrainNode`'s existing `UPDATABLE_NODE_FIELDS` list (add `'color'` to that array — `brainStore.ts:376`).

**Card border color**: `BrainNodeCard`'s border currently switches between `--bone-10` (idle) and `--accent` (selected/highlighted, per this session's earlier "highlight uses the real border" work). When a node has a `color` set and is NOT selected/highlighted, its idle border uses that color instead of `--bone-10`. Selected/highlighted state still overrides to the accent/blue ring regardless of tag color (selection must always be visually unambiguous).

### 3.8 Per-node usage bar on canvas cards

New: every `BrainNodeCard`'s footer gains a thin usage bar — `perNodeTokens[node.id] / per_node_cap` — next to (or replacing part of) the existing token-count pill. This requires exposing `per_node_cap` (currently server-only, read from `brain_config` inside `compileBrain`/`addBrainNode`) to the client, alongside the already-exposed `perNodeTokens`. Add `perNodeCap: number` to `listBrain`'s return (same seam `budget`/`perNodeTokens` already use) and thread it through `useBrainData`'s `BrainCanvasState` the same way.

This same bar (this node's own usage % of its cap) is what renders in the Details panel header (§4.2) — one computation, two render sites.

## 4. Part B — Details panel

### 4.1 Trigger and click-semantics change

**This is a breaking change to existing behavior.** Today, single-clicking a node calls `openBrainNode(entity.ref_id)`, opening the note directly in the split-view right column. That behavior moves into the details panel as a button; single-click now always opens the details panel instead.

- Single-click a node card → opens Details mode, focused on that node.
- Single-click a connection line (requires making edges hit-testable — see 4.5) → opens Connections mode, pre-scoped to that edge's two endpoints.
- Right-click a node → existing context menu gains a new **"Open in editor"** item above the existing **"Delete"** (this session's earlier work), so direct-open is still one click away without going through the panel.
- Shift/ctrl-click still accumulates multi-selection exactly as today; opening the panel with a multi-selection active shows the first-clicked node as focused (see 4.4).
- **Sidebar click stays as-is.** `BrainSidebarContent`'s node rows keep opening the editor directly on click — the sidebar is a browsing list, not the spatial canvas, so the "inspect first" flow doesn't apply there. Only canvas node/edge clicks route through the details panel.

### 4.1.1 Coexistence with the split-view editor column

The details panel and the split-view editor column occupy the same right-edge slot — they are mutually exclusive, not stacked. Clicking **"Open editor"** (§4.2, action row) triggers a slide transition: the details panel slides out to the right while the editor column slides in from the same side, replacing it. While the editor column is open, a persistent button (docked where the details panel's edge was, e.g. a small tab/handle on the column's outer edge) collapses the editor column and re-opens the details panel for the same node. Only one of {details panel, editor column} is ever visible at a time.

### 4.2 Details mode (single node focused)

Panel container: same visual language as the left panel and the app's existing floating-panel style (`bg-panel/98 backdrop-blur-xl border border-[var(--bone-12)] rounded-[16-18px] shadow`), anchored to the right edge of the canvas viewport (opposite side from the left stats panel), fixed width (~340-380px per the mockup).

Top to bottom:

1. **Header row**: usage-% bar for THIS node (`perNodeTokens[id] / perNodeCap`, same computation as §3.8's card footer bar) on the left, "•••" (options — exact menu contents decided at plan time, likely mirrors the right-click context menu) and "✕" close on the right.
2. **Title** — the node's display title, double-click to edit inline (commits via `updateBrainNode({ label })` on blur/Enter).
3. **Preview** — the node's content preview (same source as the canvas card's preview text), dimmed/truncated, not editable here (editing content is what "Open editor" is for).
4. **Field rows** (divider-separated, matching the tasks panel's pill-editor pattern referenced in the Figma drafts):
   - **Priority** — pill showing High/Medium/Low, click opens the same style of popup used elsewhere for priority selection.
   - **Color** — a color-swatch dot, click opens a color picker (small fixed palette per §3.7).
   - **Workspace** — pill showing the node's parent workspace or "Unsorted", click opens the same workspace picker used in the tasks panel. Selecting a different workspace reassigns the underlying entity's parent and moves it to the root of the newly selected workspace (no sub-folder placement).
5. **Action row**: `🔗 N` button (N = this node's total real edge count, from `state.edges` filtered by `from_node`/`to_node` — NOT limited to the current multi-selection) → switches to Connections mode. Beside it, **"Open editor"** button → calls the same `openBrainNode(ref_id)` this click used to trigger directly.
6. **Other selected nodes** (only rendered when the current multi-selection has more than one node): each as a separate floating card below the main panel (visually matching the main card's style, per the "v2" Figma draft — NOT merged into one continuous panel). Fixed order: nodes already connected to the focused node first, then unconnected ones. No drag/reorder/drop-to-connect anywhere in this list.
   - Clicking a card → it becomes the new focused node; the panel's Details view re-renders around it.
   - Hovering the right edge of an **unconnected** card reveals a one-click connect button (blue, matching the mockup) — clicking it calls `addBrainEdge(focusedNodeId, thatNodeId, '')` immediately, no drag, no label prompt (label can be added after, via Connections mode's label-chip edit).

### 4.3 Connections mode

Entered via the `🔗 N` button, or directly when clicking an edge line on canvas.

1. **Header**: "‹ Back to details" (returns to Details mode for the same focused node) + "✕" close.
2. **Connected chain**: focused node highlighted (blue background/border) at the top, then every node it has a real saved edge to, each as a row, connector lines drawn between adjacent rows, with an editable label chip on each line segment (click chip → inline text edit, commits via the new `updateBrainEdge`, §4.6). This list is **always the node's complete real edge set** — independent of what's currently multi-selected.
3. **"+ Connect to another node"** row: clicking it activates the connect tool (`setConnectMode(true)`) with `connectSource` pre-seeded to the focused node's id — the existing pending-connection dashed line (built earlier this session) immediately follows the cursor from this node, letting you drag-select any node in the whole brain, not just the current selection. This row does NOT accept a drag-and-drop from the selected-nodes list below (that's a distinct, simpler action — see next).
4. **Other selected, not-yet-connected nodes** (only rendered when relevant, i.e. the current multi-selection contains nodes not already in the connected chain above): same floating-card treatment as Details mode's §4.2.6, same hover-to-connect-instantly button, scoped only to the current selection.
5. Clicking any connected node's row (not the focused one) → it becomes the new focused node, panel re-centers (both the connected-chain list and the "other selected" list below recompute for the new focus).

### 4.4 Multi-select behavior

Opening the panel while multiple nodes are selected doesn't change which node is "focused" — the first node you single-clicked (the one that triggered the panel open, or the most recently clicked while the panel was already open) becomes focused; the rest render as the floating-card list per §4.2.6/§4.3.4. There is no separate "multi-select mode" — Details/Connections mode always centers on exactly one focused node, with the rest of the selection along for the ride as a static, click-to-refocus list.

### 4.5 New: clickable connection lines

`BrainCanvasConnections.tsx`'s `<svg>` is currently `pointer-events-none` (only the edge-label `<text>` is `pointer-events-auto`). Making the path itself clickable needs a standard SVG wide-invisible-hit-stroke technique: render a second, wider (`strokeWidth: 16` or similar), fully transparent `<path>` on top of the same `d` attribute, with `pointer-events: stroke` (or `auto` + `fill: none` + a generous `strokeWidth`), that carries the `onClick` handler. The visible thin stroke stays purely decorative.

### 4.6 New backend: edge relabel

Only `addBrainEdge`/`removeBrainEdge` exist today (`brainStore.ts:432`, `:457`) — no in-place label update, meaning today's only way to "change a label" is disconnect + reconnect (loses the edge's `id`/`created_at`/revision history). New function:

```typescript
// src/lib/bot/services/brainStore.ts
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

New API action `update_edge` in `/api/ai/user-brain` POST, mirroring the existing `connect`/`disconnect` actions.

### 4.7 Non-goals for this spec

- No changes to the connect tool's underlying click-source→click-target mechanic (§4.3's "+" button reuses it as-is, just pre-seeding the source).
- No drag-and-drop anywhere in the details panel (explicitly decided against during brainstorming — the hover-connect button covers the only case drag would have covered).
- No changes to `manage_brain`'s bot-facing tool behavior — this is a human-editing surface, same boundary the original P2 canvas spec drew.
- No sub-folder placement on workspace reassignment (§4.2.4) — moving a node to a new workspace always lands it at that workspace's root.

## 5. Data model changes summary

| Change | Type | Where |
|---|---|---|
| `brains.is_default` settable post-creation | new backend fn `setDefaultBrain` + API action | `brainStore.ts`, `route.ts` |
| AI-request-per-brain tracking | new table `brain_usage_events` + `logBrainUsageEvent` call | migration, `brainStore.ts`, `chainRouter.ts` |
| Pro tier limit 10k → 8k | data-only, one `UPDATE` | `brain_config` table |
| Node color tag | new column `brain_nodes.color` | migration, `UPDATABLE_NODE_FIELDS` |
| `per_node_cap` exposed to client | new field on `listBrain`/`BrainCanvasState` | `brainStore.ts`, `useBrainData.ts` |
| Edge relabel in place | new backend fn `updateBrainEdge` + API action `update_edge` | `brainStore.ts`, `route.ts` |
| Clickable connection lines | new hit-stroke `<path>`, no schema change | `BrainCanvasConnections.tsx` |
| Node workspace reassignment (move entity to new workspace root) | reuse/extend existing entity-move mutation, wired to the Workspace pill's picker | `brainStore.ts` or entity service, `route.ts` |

## 6. Explicitly out of scope

- Any change to the whiteboard's own (non-brain) canvas.
- Deleting/archiving brains (existing `deleteBrain` stays as-is, no new UI surfaced for it here — the left panel's dropdown only adds rename + set-default, not delete).
- Mobile/touch layout for either panel (existing brain canvas is desktop-first per the P2 spec; this follows the same assumption).
