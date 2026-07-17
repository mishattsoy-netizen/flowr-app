# Brain Canvas — Design (P2)

Date: 2026-07-17 · Status: **Design, not yet implemented.**
Relationship to prior specs: this is **P2** of `2026-07-14-brain-design.md` §8 ("node canvas on the existing whiteboard engine … manual edges … split-mode integration"), refined against what actually exists in the codebase. Builds on P2a (`2026-07-16-brain-presets-design.md`, multi-brain presets — implemented). Depends on nothing from P2a beyond what's already shipped.

**Explicitly out of scope for this spec** (see §9 for why, and the follow-up spec that will cover it): migrating existing `type:'memory'` brain nodes into real note entities, and fully retiring the `memory` node type from tools/prompts/compiler. This spec's canvas renders memory nodes correctly as they exist today; the migration is separate, deliberately sequenced after, because it's a live-data change that shouldn't block shipping the UI the user actually asked for.

## 1. Vision

Replace the current 680px list-modal `BrainPanel` with a full-screen spatial canvas — the same "this is a real workspace, not a popup" feeling the existing whiteboard already gives users, applied to the brain. Nodes are draggable cards positioned freely; edges are drawn between them with labeled, rounded-elbow connectors from fixed per-side connector points. The sidebar switches into a brain-scoped browsing mode. Clicking a node opens its real content in the existing split-mode right column, canvas staying visible on the left.

Explicit design intent (owner, 2026-07-17): this should feel **playful and a little game-like** — token/priority counters, tag pills, a budget meter, the sense of visibly building something personal against a fixed cap — not a dry admin table.

## 2. What gets reused vs. built new

The existing whiteboard (`CanvasPage.tsx` + friends) is a large, deeply-featured engine (arrows, shapes, frames, resize/rotate, style panels, binding drags) built tightly around `EditorBlock`/`useStore`'s whiteboard data model. It is **not** a generic reusable canvas — investigated directly (`CanvasBlock.tsx`, `useDrag.ts`) and confirmed the coupling runs deep (DOM-transform caching keyed to `EditorBlock` fields, binding/freeze logic, snap-guide wiring).

**Reused as-is:**
- `useCanvasViewport` (`src/hooks/useCanvasViewport.ts`) — pan/zoom + ctrl/cmd-wheel zoom-at-cursor. Genuinely generic: takes a container ref, returns `{viewport, setViewport, viewportRef}`, zero data coupling. Used directly.
- `computeElbowPoints` (`src/lib/geometry/arrowPath.ts`) — pure function, `[number,number][] → [number,number][]`, no `EditorBlock`/store coupling. Used directly for edge routing.
- The SVG path-string construction pattern in `VectorPath.tsx`/`arrowPath.ts` (Catmull-Rom/polyline path building, arrowhead-free since brain edges have no heads) — imitated, not imported, since the brain's edge component takes brain node positions, not whiteboard blocks.

**Not reused, built new and smaller:**
- Node dragging: a small custom pointer handler (~50-80 lines) that updates `brain_nodes.position {x,y}` directly. No snapping, no alignment guides, no binding, no resize, no rotate. (Owner decision: no grid snap — organic feel matches how graph tools like Obsidian's graph view behave.)
- Node rendering: new `BrainNodeCard` component (see §5) — not `CanvasBlock`.
- Connection rendering: new `BrainCanvasConnections` component modeled on `CanvasConnections.tsx`'s SVG-overlay pattern, but driven by brain node/edge data, not whiteboard blocks.

This keeps the brain's data layer (`brainStore.ts`) fully decoupled from the whiteboard's sync/store internals — the two canvases share only pure geometry math and the viewport hook.

## 3. Surface & layout

Clicking "Brain" in the sidebar replaces the main content area (currently the chat area) with a full-screen canvas — the same slot `CanvasPage` occupies for a whiteboard entity. Canvas visually matches the existing whiteboard's colors/background pattern/style.

**Split-mode integration — a real behavior change, not just reuse.** Today, `setActiveEntityId`'s `id === 'chat'` branch (`store.ts:~2258`) force-exits split view, and chat/split-view are mutually exclusive in the same content slot (`store.ts:~445` guard). The brain canvas needs the opposite: canvas stays mounted on the left while a clicked node's note opens in the right column simultaneously. This spec extends the split-view mechanism with a `'brain'` slot value alongside `'chat'`, so entering brain mode does NOT force-exit split view, and clicking a brain node calls the existing `setColumnEntity('right', entityId)` action to populate the right column without disturbing the left (canvas) side. No new split-view infrastructure — this reuses `SplitViewLayout`/`EntityPageRenderer`/`setColumnEntity` exactly as they exist, with one guard-condition adjustment.

**Layout regions:**
- **Left (or full-width if nothing is open in split)**: the canvas.
- **Right column** (opens on node click): `EntityPageRenderer` showing the clicked note/workspace's real block editor — identical to how any other note opens in split mode today.
- **Top-left**: brain preset picker (replaces where the whiteboard's layers panel sits) — same dropdown-of-brains pattern already in `BrainPanel.tsx`, repositioned.
- **Top or right** (exact placement decided during implementation, not load-bearing): stats panel — budget meter (used/limit tokens, matches existing `BrainState.budget`), node count, maybe a "brain age" or growth indicator for the playful framing.
- **Toolbar**: add node, add existing note/workspace, connect tool, other canvas tools (pan/select — no shape/text/frame tools, those are whiteboard-only).

## 4. Sidebar in Brain mode

Toggling into Brain mode swaps the sidebar's content (chat history list) for a brain-scoped tree:

- **Each brain is a top-level foldable row** (matching `TreeItem.tsx`'s existing folder-expand pattern), not a full copy of the home-page entity tree. Expanding a brain row shows only the nodes actually IN that brain (memory/entity/workspace nodes), as rows.
- A **"Sessions"** button appears directly under the Brain toggle, to swap the sidebar back to normal chat history — Brain mode and chat-history mode are sidebar-level alternatives, not stacked.
- Clicking a node row in the sidebar does the same thing as clicking its canvas card: opens it in the split-mode right column.
- **Adding an existing note/workspace** is a dedicated action (toolbar button, opens a search/browse popover over the user's entities) — not achieved by dragging from a raw unsorted tree, since that tree isn't shown. Selecting an entity adds it as a node (type `entity` for notes — full content, referenced live; type `workspace` for workspace/folder entities — summary only, per the existing compiler behavior in `brainStore.ts:156-168`) to the current brain, appearing in both the canvas and the sidebar's expanded row for that brain.

## 5. Node cards

Bigger, information-dense cards (owner explicitly wants this over a minimal box — part of the "building something tangible" feel), modeled on the existing "Recent" widget card + task card styling:

```
┌─────────────────────────────────┐
│ 📝  Unsorted · 30m ago           │  ← header: type icon, parent workspace or "Unsorted", relative edited time
│ The Second Brain: Building Yo…   │  ← title (bold)
│ A centralized system to collect, │  ← faded content preview, 1-2 lines, truncated
│ organize...                      │
│ ─────────────────────────────    │
│ [Priority: 3]  [420 tok]  [#ai]  │  ← footer: priority pill, token-count pill, up to 2-3 tag pills
└─────────────────────────────────┘
   •                       •         ← 4 connector dots, one per side (top/right/bottom/left)
```

Connector dots render on hover or when the connect tool is active (matching the whiteboard's existing bind-dot show/hide pattern), not permanently visible, to keep the canvas readable.

**Explicitly deferred to a fast-follow, not this spec** (owner-agreed, to keep this pass focused on the new spatial/connector mechanics rather than new data):
- **Tags** — no `tags` column exists on `brain_nodes` today; this is new schema + tag CRUD UI. Card ships without the tag-pill row (or renders it empty/hidden) until the follow-up.
- **Per-node token count** — today's budget is computed compiler-side across the whole brain, not cached per-node. The token-count pill ships once that's computed/cached; until then the footer shows priority only.

Section nodes (`type: 'section'`) render as a distinct, simpler card style (or a background grouping region) — exact treatment decided during implementation; not a blocking design question since sections already exist and just need a canvas-appropriate visual, unlike the genuinely new mechanics above.

## 6. Connectors (edges)

**Interaction:** connect tool active → click a connector dot on node A → click a connector dot on node B → small inline input for the edge label → line appears. No drag-to-draw (simpler than the whiteboard's arrow tool, deliberately — brain edges don't need freeform routing or rebinding).

**Routing:** rounded, "smart" elbow paths between the two chosen dots — reusing `computeElbowPoints` (pure geometry, already exists) fed by a new small brain-specific function that maps `(node, side) → {x, y}` (side = top/right/bottom/left, offset from the node's stored `position` + card dimensions). No binding/rebinding-by-drag, no live re-resolution on the whiteboard's `resolvePoints` — brain edges are simpler: recompute the path whenever either endpoint's position changes (on drag-move, same as the whiteboard already does for its own connections, just without the bind-target machinery).

**Data:** unchanged — `brain_edges.label` is still the payload (spec `2026-07-14-brain-design.md` §2's "no glyph notation" principle holds; the elbow shape is visual routing, the label is still what compiles to the `[BRAIN]` block's connection sentences). No new columns needed; `from_node`/`to_node`/`label` already exist.

## 7. Adding nodes

- **"New node" (toolbar)**: click tool, click empty canvas space → creates a real note entity (via the existing entity-creation path, placed in `Unsorted`/no `parent_id` — same as any other quickly-created note, findable from the home sidebar too) → opens it immediately in the split-mode right column's block editor (full formatting: headings, tables, bullets — same editor notes already use) → a `type: 'entity'` brain node is created referencing it, positioned at the click point.
- **"Add existing"** (toolbar): search/browse popover over the user's entities (notes and workspaces) → selecting one adds it as a node (type `entity` or `workspace` per §4 above) at a default/cascading position on the canvas.

This means going forward, **all new memory-equivalent nodes are real note entities**, not `brain_nodes.content` strings — the toolbar's "new node" replaces the old small inline "Add a memory" text input, which is retired as part of this canvas replacing `BrainPanel`. Existing `type:'memory'` nodes (from P1's `bot_memories` import) keep working exactly as they compile today (the compiler's existing content fallback) — untouched by this spec, migrated in the follow-up (§9).

## 8. Non-goals for this spec

- No changes to the compiler (`brainCompiler.ts`), budget/drop-policy logic, or `[BRAIN]` injection — this is purely a new editing/visualization surface over the existing `brainStore.ts` API (which already has everything needed: `listBrain`, `addBrainNode`, `updateBrainNode` for position writes, `addBrainEdge`/`removeBrainEdge`).
- No tag schema/CRUD, no per-node token caching (§5).
- No migration of existing memory nodes, no retirement of the `memory` type from tools/prompts/compiler (§9, separate spec).
- No changes to `manage_brain`'s tool behavior — the bot's programmatic node creation is untouched; this spec is the human-editing surface only.

## 9. Follow-up spec (not this one)

A second, smaller spec will cover: one-time migration of every existing `type:'memory'` brain node into a real note entity (create entity, repoint `brain_node.ref_id` + `type`), then fully retiring the `memory` node type — `manage_brain`'s `add_node` tool definition/handler, `tools.txt` prompt rules, `brainCompiler.ts`'s content-fallback path, and any remaining UI referencing `brain_nodes.content` directly. Sequenced after this canvas ships specifically because it's a live-data migration with its own verification burden (same pattern as P2a's Task 1-3 migration, run and verified live by the implementer, not delegated) — bundling it into the canvas UI plan would put that risk on the critical path of the feature the user actually asked to see faster.
