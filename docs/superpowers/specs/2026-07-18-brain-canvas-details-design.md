# Brain Canvas — Left Stats Panel & Node/Connection Details Panel — Design

Date: 2026-07-18 · Status: **Design, not yet implemented.**

Relationship to prior specs: builds on `2026-07-17-brain-canvas-design.md` (P2, the spatial canvas — implemented) and its two follow-ups, `2026-07-17-brain-per-node-token-count.md` (per-node token cost, implemented) and `2026-07-17-brain-memory-migration.md` (memory→entity migration, implemented). This spec is the next visible layer on top: a redesigned left stats/switcher panel, and a brand-new right-side details panel for inspecting and editing nodes/connections without leaving the canvas.

## 1. Vision

The brain canvas today lets you place, drag, and connect nodes, but has no dedicated place to actually *look at* a node's metadata or a connection's details — clicking a node jumps straight into the note editor, and there's no way to inspect or edit an edge at all. This spec adds a details panel (game-like, per the original canvas spec's framing) that becomes the primary way to inspect nodes and connections, plus consolidates the top-left brain switcher and top-right stats readout into one richer panel with real usage analytics.

## 2. Scope split

Three pieces:

- **Part A — Left panel.** Replaces `BrainPresetPicker` (top-left) and `BrainStatsPanel` (top-right) with a single panel, anchored top-left, with a compact default view and an expandable analytics section.
- **Part B — Details panel.** A new right-side panel with two modes (Details, Connections) that opens on single-clicking a node or a connection line.
- **Part C — Node taxonomy** (§4C, second design increment). Custom tags, Memory (brain-only) node type, and temporary lifecycle. Surfaces mostly through Part B's field rows but has its own backend/schema/compiler changes.

Parts A and B share no runtime state and can be built in either order. Part C depends on Part B's details panel as its editing surface, so it builds after (or alongside) B. All designed now, built together ("design all now, build after").

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
4. **Nodes by custom tag** — chip list, one per distinct tag combo in use (+ an "Untagged" chip), each showing the tag color dot, its name if named, and count. Requires the Custom tag columns (§3.7 / §4C.1).
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

### 3.7 New backend: per-node Custom tag

> **Superseded/extended by §4C.1.** This section originally specced a bare `color` column; Part C extends it to a **Custom tag** (color + optional name). The authoritative representation is in §4C.1 (`tag_color` + `tag_name`). Kept here for the card-border behavior, which is unchanged.

The Custom tag is a color plus an optional reusable name (see §4C.1 for storage and the reusable picker). No fixed enum, no meaning imposed by the system (per owner: "purely user-chosen... like a highlighter/label system"). Settable via `updateBrainNode`'s existing `UPDATABLE_NODE_FIELDS` list (add `'tag_color'` and `'tag_name'` to that array — `brainStore.ts:376`).

**Card border color**: `BrainNodeCard`'s border currently switches between `--bone-10` (idle) and `--accent` (selected/highlighted, per this session's earlier "highlight uses the real border" work). When a node has a `tag_color` set and is NOT selected/highlighted, its idle border uses that color instead of `--bone-10`. Selected/highlighted state still overrides to the accent/blue ring regardless of tag color (selection must always be visually unambiguous).

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
   - **Type** — pill showing **Note** / **Memory** (§4C.2), click toggles the value (flips the entity's `brain_only` flag). Memory hides the note from workspaces/Unsorted; deleting a Memory is a confirmed permanent action.
   - **Custom tag** — a tag swatch (color dot + name if set), click opens the reusable tag picker (§4C.1: dropdown of existing color+name combos, or define a new one).
   - **Lifecycle** — pill showing **Permanent** or the active window (§4C.3), click opens a date editor (optional start, required end to be temporary). Clearing the end date returns it to Permanent.
   - **Workspace** — pill showing the node's parent workspace or "Unsorted", click opens the same workspace picker used in the tasks panel. Selecting a different workspace reassigns the underlying entity's parent and moves it to the root of the newly selected workspace (no sub-folder placement). (For a Memory node, this pre-sets where it lands if later switched back to Note.)
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

## 4C. Part C — Node taxonomy: custom tags, memory nodes, temporary lifecycle

Second design increment (added after the details-panel design was approved). Three related features that change what a node *is*, not just how it's inspected. Designed now, built together with Parts A/B ("design all now, build after"). All three surface primarily through the details panel's field rows (§4.2.4) — same pill-editor pattern as Priority.

### 4C.1 Custom tags (renames & extends §3.7's "color tag")

The §3.7 color tag becomes a **Custom tag**: a color **plus an optional name**. Same single nullable representation, extended to carry a name.

- **Storage**: instead of a bare `color text`, a node's tag is `{ color, name }`. Simplest representation: two nullable columns `tag_color text` and `tag_name text` on `brain_nodes` (a node may have a color with no name, but not a name with no color). (§3.7's `color`-only plan is superseded by this — there is one tag concept, named "Custom tag", nothing is called "color tag" anymore.)
- **Reusable tag picker**: focusing the Custom tag field in the details panel shows a dropdown of the user's **existing color+name combos** (distinct `(tag_color, tag_name)` pairs already in use across their nodes) so a tag like "Trading" is defined once and reused, not retyped. Picking a combo sets both fields; a "new tag" affordance lets you define a fresh color+name.
- **Card border** (unchanged from §3.7): a tagged, non-selected node's idle border uses `tag_color`; selection/highlight still overrides to the accent ring.
- **Expanded-panel breakdown** (§3.4 item 3): "Nodes by custom tag" — one chip per distinct tag combo in use (named tags show their name, color-only tags show e.g. "● (unnamed)"), plus an "Untagged" chip.
- **Bot sees named tags** (compiler change). In the compiled `[BRAIN]` block, nodes with a **named** tag are rendered under a light grouping heading for that tag (e.g. a `[Trading]` group), so the model learns which nodes share a category. Rules:
  - Only **named** tags group; color-only and untagged nodes cost zero extra tokens (rendered as today, ungrouped).
  - **Grouping is presentational only and MUST NOT constrain edges.** Edges are compiled from `brain_edges` independently of grouping — two nodes in *different* tag groups can be connected, and that edge still renders in the block exactly as an intra-group edge would. Grouping changes the *order/headers* nodes are listed under, never which edges exist or render.
  - Grouping interacts with existing budget-drop (§compiler): drop policy is unchanged (priority/updated_at); a group heading is emitted only if at least one of its nodes survived the budget cut.

### 4C.2 Node type: Note vs Memory

A new **Type** field in the details panel (§4.2.4, a pill like Priority) with two values: **Note** and **Memory**. This is the "brain-only note" concept — modeled as a visibility flag on a real entity note, **not** a revival of the retired `type='memory'` brain-node kind (that kind errors on creation at `brainStore.ts:332` and stays retired).

- **Note** (default): a normal entity note. Visible in its workspace / Unsorted **and** on the canvas. This is every node today.
- **Memory**: the *same* entity note (openable in the editor identically), but **hidden from all workspace and Unsorted views** — it lives only in the brain tree/canvas. Backed by a new `brain_only boolean` (default false) on the note's **entity** (not the brain_node — the flag is about the note's workspace visibility, which is an entity-level property). Workspace/Unsorted list queries add `AND NOT brain_only`.
- **Switching Type** in the panel flips `brain_only`:
  - Note → Memory: sets `brain_only = true` (note disappears from workspaces, stays on canvas).
  - Memory → Note: sets `brain_only = false` (note appears in Unsorted, or its assigned workspace if one is set — same as saving any note).
- **Delete semantics differ by type** (§4.1 / context-menu delete + any panel delete):
  - Deleting a **Note** node: soft-deletes only the `brain_node` (`removeBrainNodes` already does exactly this — `ref_id` is `ON DELETE SET NULL`, the entity is untouched). The note survives in its workspace. No confirmation beyond today's behavior.
  - Deleting a **Memory** node: because a Memory's note exists *nowhere but here*, removing it is effectively permanent. **Requires a confirmation dialog** ("This memory exists only in your brain — deleting it is permanent."). On confirm, both the brain_node and its entity are deleted.

### 4C.3 Temporary lifecycle (start/end dates)

Any node (Note or Memory) can be made **temporary** by giving it an **end date** (required to be temporary) and an **optional start date**. No status enum — the four lifecycle states derive purely from two nullable date columns on `brain_nodes` (`active_from timestamptz`, `active_until timestamptz`) compared against `now()`:

| State | Condition | In compiled block? | Canvas render |
|---|---|---|---|
| Permanent | `active_until IS NULL` | yes | normal |
| Scheduled | `active_from > now()` | no (not active yet) | distinct "pending" style |
| Active temporary | `active_from ≤ now() < active_until` (or no start) | yes | normal + a subtle countdown/temporary marker |
| Dead ("dead braincell") | `active_until < now()` | **no** | dimmed / monochrome, static (no shimmer/animation) |

- **Read-time evaluation, no scheduler.** Expiry is enforced inside the pure `compileBrainDocument` (`brainCompiler.ts`) as one additional drop predicate alongside the existing broken/budget drops: a node whose window makes it inactive is excluded from render (added to a new `expiredNodeIds` / folded into the existing dropped set so the client can dim it). Because every compile re-reads the clock, a node "dies" automatically the first time the brain is compiled after `active_until` — **no cron job, no background delete.** Moving `active_until` into the future or clearing it (Type/lifecycle edit) revives it losslessly on the next compile.
- **Dead node edges**: stay **visible but dimmed** (matching the node, no shimmer). They're simply absent from the compiled block because the dead endpoint node is dropped — the edge rows in the block are computed from surviving nodes only. Reviving the node lights its edges back up. No edge data is deleted.
- **Distinct styles** (gamification + legibility): Note, Memory, active-temporary, and dead each get a visually distinct card treatment (exact styling at plan/design-polish time; the *states* and their triggers are fixed here). Dead = dimmed monochrome is the one concrete commitment.

### 4C.4 Bot can create Memory + temporary notes directly

The bot's note-creation path gains the two new flags so the Japan-trip auto-flow works end to end: user says "I'm in Japan next week until the 20th" → bot creates a **Memory** note (`brain_only = true`, so it never clutters Unsorted) that is **temporary** (`active_from`/`active_until` parsed from the user's dates), which auto-activates for the window and drops out of the brain block after the end date, remaining as a dead braincell on the canvas until the user revives or deletes it.

- Extends the existing note-creation tool definition (`src/lib/bot/tools/definitions.ts`) + handler (`handlers.ts`) with optional `brain_only`, `active_from`, `active_until` parameters. This is a deliberate, scoped exception to §4.7's "no `manage_brain` bot-behavior change" — it's the note-*creation* tool, not `manage_brain`, and it's the whole point of the feature.
- User can still edit every one of these fields afterward in the details panel (Type field + lifecycle dates), same as a manually-created node.

### 4C.5 Part C non-goals

- No recurring / repeating temporary windows — one `[active_from, active_until]` interval per node.
- No auto-deletion of dead nodes ever — they persist on the canvas until the user explicitly deletes them.
- No tag hierarchy / nested categories — Custom tag is a flat (color, name) pair, one per node.
- No bulk tag/type/lifecycle editing across a multi-selection in this increment (single focused node at a time, consistent with §4.4).

## 5. Data model changes summary

| Change | Type | Where |
|---|---|---|
| `brains.is_default` settable post-creation | new backend fn `setDefaultBrain` + API action | `brainStore.ts`, `route.ts` |
| AI-request-per-brain tracking | new table `brain_usage_events` + `logBrainUsageEvent` call | migration, `brainStore.ts`, `chainRouter.ts` |
| Pro tier limit 10k → 8k | data-only, one `UPDATE` | `brain_config` table |
| Custom tag (color + name) | new columns `brain_nodes.tag_color`, `brain_nodes.tag_name` + reusable picker + compiler grouping | migration, `UPDATABLE_NODE_FIELDS`, `brainCompiler.ts` |
| Memory (brain-only) node type | new column `entities.brain_only` (default false); workspace/Unsorted queries filter it out; Type field toggles it; Memory delete is permanent + confirmed | migration, entity list queries, details panel, delete flow |
| Temporary lifecycle | new columns `brain_nodes.active_from`, `brain_nodes.active_until`; read-time expiry drop in compile; dimmed dead-node render | migration, `brainCompiler.ts`, `UPDATABLE_NODE_FIELDS`, canvas render |
| Bot creates Memory + temporary notes | new optional `brain_only`/`active_from`/`active_until` params on note-creation tool | `tools/definitions.ts`, `tools/handlers.ts` |
| `per_node_cap` exposed to client | new field on `listBrain`/`BrainCanvasState` | `brainStore.ts`, `useBrainData.ts` |
| Edge relabel in place | new backend fn `updateBrainEdge` + API action `update_edge` | `brainStore.ts`, `route.ts` |
| Clickable connection lines | new hit-stroke `<path>`, no schema change | `BrainCanvasConnections.tsx` |
| Node workspace reassignment (move entity to new workspace root) | reuse/extend existing entity-move mutation, wired to the Workspace pill's picker | `brainStore.ts` or entity service, `route.ts` |

## 6. Explicitly out of scope

- Any change to the whiteboard's own (non-brain) canvas.
- Deleting/archiving brains (existing `deleteBrain` stays as-is, no new UI surfaced for it here — the left panel's dropdown only adds rename + set-default, not delete).
- Mobile/touch layout for either panel (existing brain canvas is desktop-first per the P2 spec; this follows the same assumption).
- Recurring/repeating temporary windows, tag hierarchies, and bulk tag/type/lifecycle edits across a multi-selection (§4C.5).
- Auto-deletion of dead nodes — they persist on the canvas until the user deletes them (§4C.5).
