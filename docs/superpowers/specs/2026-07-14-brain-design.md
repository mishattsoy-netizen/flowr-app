# Flowr AI Brain — Design

Date: 2026-07-14 · Status: **Approved design, not yet implemented.**
Relationship to `2026-07-11-bot-rework-design.md`: this spec **supersedes §7 (Memory v2)** and **absorbs the static half of §3 (Context pack)** of that document. The dynamic task snapshot (due-today/overdue) stays a separate, smaller, per-turn concern outside this spec. Advisor-reviewed 2026-07-14; all findings folded in.

## 1. Vision

A "Brain" page in the chat sidebar where users manage what the bot knows — which workspaces, entities, and memories it carries into every conversation without being asked. Inspired by the Obsidian-vault + Claude Code pattern (agent builds and navigates a personal knowledge base), but differentiated: Flowr's brain is **curated and budgeted** — nodes cost tokens, the budget meter is finite and tier-bound, and choosing what your bot knows is the game. Not a passive graph visualization.

Three properties make the Obsidian pattern work, and all three are requirements here:
- **Inspectable** — the user can see exactly what the bot knows ("view as bot sees it" compiled preview).
- **Editable** — wrong knowledge can be fixed or removed directly.
- **Growing** — the bot itself builds and maintains the brain via tools; users can prompt "build a brain about my trading" or run an interview flow, and watch it grow.

## 2. Architecture overview

**The brain is a compiled text document; the page is an editor for it.** Every visual element has defined compile semantics — nothing is decoration:

- **Node** = a source (workspace ref, entity ref, or freetext memory) → compiles to its content/summary with a visible token cost.
- **Edge** = a stated relationship → compiles to a plain-English sentence ("Trading journal informs the risk-rules note: check rules before logging trades"). The label is the payload. No glyph notation (`A ←x→ B` is tokenizer-hostile and reads as decoration).
- **Section** = explicit grouping via a `section` node and a `section_id` membership field. Sections are NOT derived from graph clusters (cluster-derived headings are order-unstable — one new edge would reshuffle the compiled text and churn the cache).

The compiled `[BRAIN]` block is injected into the **static system prompt** (prompt-cache-friendly), positioned **before the per-chain instruction divergence point** with a cache boundary after it, so the brain segment caches once across all tool-enabled categories instead of being cache-written per category.

**Content is referenced, never copied.** An entity node resolves the entity's current content at compile time. Edit the note → the brain reflects it on the next compile. One source of truth, no rot.

## 3. Data model

```sql
brain_nodes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL,
  type        text NOT NULL CHECK (type IN ('workspace','entity','memory','section')),
  ref_id      text REFERENCES entities(id) ON DELETE SET NULL, -- workspace/entity refs only
  content     text,                    -- freetext memory nodes only
  label       text,                    -- display name / short description override
  section_id  uuid REFERENCES brain_nodes(id) ON DELETE SET NULL, -- explicit membership
  priority    integer NOT NULL DEFAULT 0,  -- higher = survives budget pressure longer
  pinned      boolean NOT NULL DEFAULT false, -- never dropped by budget
  enabled     boolean NOT NULL DEFAULT true,
  created_by  text NOT NULL CHECK (created_by IN ('user','bot')),
  position    jsonb,                   -- {x,y}, unused until canvas phase
  deleted_at  timestamptz,             -- soft delete (undo/recovery)
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
)

brain_edges (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL,
  from_node   uuid NOT NULL REFERENCES brain_nodes(id) ON DELETE CASCADE,
  to_node     uuid NOT NULL REFERENCES brain_nodes(id) ON DELETE CASCADE,
  label       text NOT NULL,           -- the payload; compiles to a sentence
  created_by  text NOT NULL CHECK (created_by IN ('user','bot')),
  deleted_at  timestamptz,
  created_at  timestamptz DEFAULT now()
)

brain_revisions (                      -- audit/undo for bot edits gone wrong
  id          bigserial PRIMARY KEY,
  user_id     uuid NOT NULL,
  actor       text NOT NULL CHECK (actor IN ('user','bot')),
  op          text NOT NULL,           -- add_node/connect/remove/...
  payload     jsonb NOT NULL,          -- enough to reconstruct the pre-op state
  created_at  timestamptz DEFAULT now()
)

brain_compiles (                       -- compiled text cache, shared across sessions
  user_id     uuid NOT NULL,
  version     text NOT NULL,           -- derived version key, see §4
  compiled    text NOT NULL,
  token_count integer NOT NULL,
  dropped_node_ids uuid[],             -- what the budget dropped, surfaced in UI
  created_at  timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, version)
)

brain_config (                         -- admin-editable tier limits
  tier         text PRIMARY KEY,       -- 'free' | 'pro' | ...
  token_limit  integer NOT NULL,       -- placeholder: free 2000, pro 10000
  per_node_cap integer NOT NULL DEFAULT 2000
)
```

- Entity deletion → `ref_id` goes NULL → node enters a visible **"broken node"** state in the UI (badge, excluded from compile) rather than vanishing or erroring.
- "Workspace" for brain purposes = an `entities` row with `type='workspace'` — the legacy `workspaces` table is NOT used (it's dead for bot purposes; see the workspaces-own-table future consideration in §11).
- RLS enabled on all brain tables; the bot pipeline accesses them via `supabaseAdmin`, so RLS is defense-in-depth — the real guarantee is §6's ownership validation.

## 4. Compile pipeline

**Version key, not stale flags.** Hooking invalidation into every entity write path (editor autosave, bot tools, sync) is a wide surface where one missed hook = silently stale brain. Instead the version key is *derived* on demand:

```
version = hash(
  max(brain_nodes.updated_at) + node count + max(brain_edges.created_at) + edge count
  + max(entities.last_modified) over all referenced ref_ids
  + brain_config row for the user's tier
)
```

One cheap query; can't go stale undetected. Compile runs only when the key has no entry in `brain_compiles`.

**Session pinning (cache protection).** `bot_session_states` gains `pinned_brain_version text`. On a session's first turn, the current version is compiled (if needed) and pinned; subsequent turns reuse the pinned compile **even if the brain changes mid-conversation**. Recompile+repin happens on new sessions or an explicit user "refresh brain" action. This is load-bearing for the flagship flow: "build a brain about X" fires 10+ `manage_brain` ops — without pinning, every op busts the prompt cache on the next turn and brain-building runs fully uncached. Pinning also gives a clean answer for multi-device consistency (each session is internally consistent; new sessions see the latest brain).

**Compile format** (deterministic ordering — sections sorted by creation, nodes by priority desc then creation):

```
[BRAIN]
This is your knowledge base about the user, curated by them and by you.

## <Section label>
- <Workspace: title> — <description>. <N> notes, <M> tasks. Contains: <child titles, capped at 10, "+N more">.
- <Note: title> — <content, resolved at compile time, truncated at block boundary at per-node cap>
- <memory text>
<edge sentences for edges whose endpoints are both in this section>

## Unsorted
...
[/BRAIN]
```

- Entity content resolves via a blocks→markdown extraction (reuse the existing block-rendering utilities if extractable; otherwise a minimal extractor is in scope for P1).
- Edges whose endpoints span sections compile at the end under a "Connections" line list.
- The compiled text is exactly what "view as bot sees it" shows in the UI. No divergence.

**Static prompt restructure.** Current order interleaves per-chain instructions before the memory block. New order: `[global personality] [app context] [BRAIN]` → *cache boundary* → `[per-chain instructions]`. The big stable segment caches once across categories (Anthropic-style explicit breakpoints; prefix-based implicit caching on Google/Groq/OpenRouter gets the same benefit from prefix sharing).

## 5. Budget

**Server-owned, enforced at compile time — never trusted to the model** (same principle as §6b confirmations; same lesson as the §7b token-metric bug).

- Per-tier `token_limit` from `brain_config` (admin-editable; placeholders free=2k, pro=10k — **10k, not 20k**: at 20k with per-category cache writes and heavy use, brain cache costs plausibly eat $5-10/month of a $15-credit Pro user. Tune against real cache-read costs after launch).
- **Per-node cap** (`per_node_cap`, default 2k): one huge note cannot eat the whole budget. Content truncates at a block boundary with an explicit `[truncated]` marker.
- **Non-monotonicity handled**: because content is referenced, a note edit can push the brain over budget with zero brain edits. So add-time rejection alone is insufficient. The compile applies a **deterministic drop policy**: never drop `pinned` nodes; drop lowest `priority` first, oldest-updated first within equal priority; record `dropped_node_ids` in the compile row; UI shows a "dropped — over budget" badge; `manage_brain list` reports the same state to the bot.
- `manage_brain add_node` pre-checks projected total and returns a structured error when over ("brain is full — remove or unpin something, or upgrade"), which the bot relays conversationally.

## 6. Security (P1-blocking, advisor finding #1)

The bot pipeline runs on `supabaseAdmin` (bypasses RLS) and `entities.id` is client-generated text. Therefore:

- **Add-time**: `manage_brain add_node` with a `ref_id` MUST verify `entities.owner_id = user_id` server-side before inserting. Reject with a generic "not found" error (don't confirm foreign ids exist).
- **Compile-time**: the compile query joins on `owner_id = user_id`; any node failing the check is excluded and marked broken (ownership can change under future sharing features).
- Both checks get dedicated tests — a foreign-entity injection attempt is the #1 embarrassment scenario for this feature.

## 7. Bot tools & memory cutover

**One new tool, `manage_brain`**, op-style (mirrors the current `manage_memory` shape):

```
manage_brain({ op: "add_node" | "update_node" | "remove_node" | "connect" | "disconnect" | "list" | "refresh",
               type?, ref_id?, content?, label?, section_id?, priority?, pinned?,
               node_id?, from?, to?, edge_label? })
```

- `list` returns nodes with token costs, dropped/broken states, and budget usage — the bot can reason about its own brain.
- `remove_node` of a section or of multiple nodes goes through the **§6b dry-run → pending_action → next-turn-confirm gate** (existing infrastructure, no new safety code).
- Every bot-actor op writes a `brain_revisions` row. Nodes/edges soft-delete (`deleted_at`), restorable from the UI.
- `refresh` = recompile + repin the current session (explicit cache-bust, user-visible cost).

**`manage_memory` is retired in the same phase (owner decision, 2026-07-14):**
1. Migration imports all `bot_memories` rows as `memory`-type brain nodes (`created_by` preserved where known, else `'bot'`).
2. The `[USER MEMORY FACT SHEET]` block is removed from `promptBuilder.ts` — the brain block replaces it. **Never both** (double injection of the same fact is the embarrassing outcome).
3. The `manage_memory` tool definition is removed; `tools.txt` rules renumbered; prompt references updated.
4. `bot_memories` table is kept untouched as a backup until the import is live-verified, then dropped in a later cleanup migration.

**Interview flow** ("build a profile section — ask me what you need") is a prompt pattern over these tools, not new infrastructure: the bot asks questions in chat, then issues a sequence of `manage_brain` calls. Ships as P3 prompt work.

## 8. UI phases (data-first, owner decision)

- **P1 — plain Brain page** (chat sidebar): list grouped by section; enable/disable toggles; pin; simple priority reorder; budget meter ("Brain 6.2k / 10k"); broken/dropped badges; manual add (pick workspace/entity or write a memory); soft-delete + restore; **"view as bot sees it"** compiled preview. The bot can already build the brain via chat in P1 — the page is the honest MVP view of it.
- **P2 — canvas**: node canvas on the existing whiteboard engine (P1's nullable `position` field activates); manual edges; **split-mode integration** — clicking an entity node opens it in the existing note editor in the right/left column (the brain stores structure; content editing stays in the editor users know).
- **P3 — magic & game**: interview flows; growth animations; meter-as-progress-bar polish; bot-initiated brain suggestions. The idle-run auto-capture idea from the old §7 (Memory v2) lands here later as "bot adds memory nodes after idle sessions" — same SYSTEM-chain infrastructure dependency as before, unchanged.

## 9. Acceptance tests

1. **Injection & cutover**: a live transcript shows the `[BRAIN]` block present and `[USER MEMORY FACT SHEET]` absent; imported memories appear inside `[BRAIN]`.
2. **Cache**: repeat turns in one session cache-hit on the brain segment; a "build a brain about X" multi-op session does NOT bust the cache mid-session (pinning works); a new session picks up the new brain.
3. **Anti-decoration (contrastive)**: the same question asked with and without a single edge (`Trading journal — check risk rules before logging`) produces measurably different behavior. If an edge changes nothing, edges are decoration and the design has failed.
4. **Bot-built brain**: "build a brain about my trading" in chat produces real nodes/sections visible on the Brain page.
5. **Budget**: bot add past the limit → structured refusal, relayed conversationally; oversized note → truncated at per-node cap with marker; over-budget compile → deterministic drops with visible badges.
6. **Security**: add_node with a foreign user's entity id → rejected at add-time; a node whose entity changes owner → excluded at compile-time. Both unit-tested.
7. **Deletion**: deleting a referenced entity → broken-node badge, compile excludes it, nothing crashes.

## 10. Build order

1. Migration (tables §3 + `bot_session_states.pinned_brain_version` + import of `bot_memories`).
2. `compileBrain` + version key + budget/drop policy + per-node cap + ownership checks (+ unit tests — this layer is pure enough to test without mocking).
3. Static-prompt restructure + `[BRAIN]` injection + fact-sheet removal + session pinning in `chainRouter`.
4. `manage_brain` tool + §6b gating + revisions + `manage_memory` retirement.
5. P1 Brain page.
6. Live verification against the acceptance tests, then P2/P3 as separate efforts.

## 11. Future considerations (recorded so they're not lost)

- **Workspaces as their own table** (owner, 2026-07-14): `entities` currently conflates workspaces/folders/notes/canvases behind a type column, plus a dead legacy `workspaces` table. Splitting workspaces out is legitimate but touches the entity tree, RLS, client store, and sync — far beyond bot scope. Revisit at the very end of the rework.
- **Document/image node types** — brain nodes referencing uploaded files (§5c storage exists); needs a text-extraction story first.
- **AI-drafted workspace descriptions** — was §3's idea; now naturally a P3+ brain feature (bot drafts a workspace node's label/description).
- **Per-agent brains** — the Obsidian trend's end state (one brain per specialized agent: trader / advisor / manager). The data model already scopes by `user_id`; adding a `brain_id` dimension later is additive. Explicitly out of scope for v1.
- **`bot_memories` table drop** — after import is live-verified.
