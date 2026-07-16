# Flowr AI Brain — Presets (P2a) — Design

Date: 2026-07-16 · Status: **Approved design, not yet implemented.**
Relationship to `2026-07-14-brain-design.md`: this spec **extends** it, filling in the "Per-agent brains" future consideration named in that spec's §11. Does not change or reopen the P1 build (Tasks 1-5 done; Tasks 6-8 continue unchanged against a single implicit brain — this phase is additive, layered in after). §3's data model, §4's compile pipeline, and §6's security model all carry forward unchanged per-brain instead of per-user.

## 1. Vision

Today's brain (P1) is one implicit knowledge base per user. This phase makes "brain" a first-class, nameable thing: a user can maintain several — a Trading brain, a Studying brain, a Main default — each with its own nodes, edges, and a short description, and pick which one is active for a given conversation.

This is phase one of a three-phase expansion (owner-approved order):
- **P2a (this spec)** — multi-brain data model, manual selection UI (new-chat cards + mid-session pill).
- **P2b** — canvas view + drag-and-drop from the home-page sidebar onto the brain graph.
- **P3** — "auto" mode: the classifier picks a brain per message from its description, instead of the user picking manually.

P2a is the dependency root for the other two: you cannot drag a note onto a graph of a brain that doesn't exist as a distinct entity yet, and you cannot auto-route between brains that aren't nameable/describable yet.

## 2. Data model

`brain_id` becomes a real dimension instead of an implicit "the one brain a user has." Additive migration — every existing row gets a `brain_id` pointing at an auto-created `"Main"` brain, so P1 users see zero disruption.

```sql
brains (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL,
  title       text NOT NULL,             -- "Main", "Trading", "Studying"
  description text,                      -- 1-3 sentences; shown in picker UI AND
                                          -- (P3) fed to the classifier as the routing signal
  is_default  boolean NOT NULL DEFAULT false, -- the auto-created "Main" brain; guards last-brain deletion
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
)

brain_nodes  -- (P1 table) + brain_id uuid NOT NULL REFERENCES brains(id) ON DELETE CASCADE
brain_edges  -- (P1 table) + brain_id uuid NOT NULL REFERENCES brains(id) ON DELETE CASCADE
brain_config -- (P1 table) stays per-tier, not per-brain — budget is a subscription property, not a per-brain one

bot_session_states -- + active_brain_id uuid REFERENCES brains(id)
                    -- (pinned_brain_version from P1 is unchanged; it already
                    -- versions "the compiled brain for this session" — with
                    -- multiple brains it now versions "the compiled ACTIVE
                    -- brain for this session", same field, same semantics)
```

**Node sharing across brains.** A single underlying entity/memory can appear in more than one brain (e.g. a core fact about you belongs in both Trading and Studying) — `brain_nodes` rows are NOT deduplicated by `ref_id`/`content` across brains; each brain that includes something owns its own node row, the way `entities` are already referenced-not-copied by nodes today. Two separate node rows pointing at the same `ref_id` in two different brains is expected, not a bug.

**Migration for existing users:** for every distinct `user_id` with at least one Supabase account row (not just those with existing `brain_nodes`/`brain_edges` — a user with an empty brain still needs a "Main" row to exist for the new-chat picker to show something), create one `brains` row (`title: 'Main'`, `is_default: true`). For users who DO have existing `brain_nodes`/`brain_edges`, backfill `brain_id` on those rows to point at their new Main brain. Every `bot_session_states` row gets `active_brain_id` set to the same Main brain.

**Guardrails (owner decisions, 2026-07-16):**
- A user always has at least one brain. Deleting the last remaining brain is blocked at the API layer (mirrors `updateBrainNode`'s server-owned validation pattern from P1) — the UI should grey out delete on a user's only brain rather than let the request round-trip and fail.
- `is_default` marks the brain new sessions fall back to if `active_brain_id` is ever null (should not normally happen once the message bar's pill always sets it — see §5's revision — but keeps the invariant enforceable server-side rather than assumed).
- **Revised during planning (2026-07-16):** this codebase has no DB-trigger-on-signup pattern anywhere (verified — no `on_auth_user_created`/`handle_new_user` trigger exists; per-user config rows like `brain_config` are read lazily with a fallback, never trigger-created). Matching that existing convention: a user's "Main" brain is **lazily get-or-created** the first time anything touches their brain (first compile, first `list`, first `manage_brain` call), not created at account signup via a trigger. A `getOrCreateDefaultBrain(userId)` helper in `brainStore.ts` does this — check for an existing `is_default: true` row first, only insert if none exists. Two concurrent first-requests racing to create it is a known, accepted edge case (not a correctness bug — worst case is a brief duplicate that read-paths should tolerate by picking the oldest `is_default` row; do not treat this as something requiring a DB unique constraint or advisory lock for P2a).

## 3. Ownership & security

Unchanged from P1 §6, scoped down one level: every `brain_nodes`/`brain_edges` query already filters by `user_id`; it now also filters by `brain_id`, and `brain_id` itself is validated to belong to `user_id` before any node operation touches it via a new `assertOwnedBrain(userId, brainId)` chokepoint (mirrors `assertOwnedEntity`'s pattern exactly). A `brain_id` the caller doesn't own behaves like a nonexistent one — generic "not found," never a distinguishing error.

**This is the P2a-equivalent of P1's #1 embarrassment scenario, not a minor detail.** Every one of these `brainStore.ts` functions currently filters by `user_id` alone and must gain a `brain_id` filter: `fetchBrainRows` (both the node and edge queries), `addBrainNode` (the node-count check AND the insert), `updateBrainNode`, `removeBrainNodes`, `restoreBrainNode`, `addBrainEdge` (the endpoint-ownership check AND the insert), `removeBrainEdge`, `listBrain`, and `computeBrainVersion`/`compileBrain` (via their call to `fetchBrainRows`). Missing even one = a node in Brain A silently leaks into Brain B's compiled `[BRAIN]` block for the same user — cross-brain prompt contamination. The acceptance test for this phase must include a live two-brain isolation check, not just a code read-through.

**Compile-cache key.** `brain_compiles`' primary key is `(user_id, version)`. `computeBrainVersion`'s hash input must include `brain_id` explicitly (not just rely on the fetched node/edge set differing) — otherwise two structurally-identical brains (e.g. two brand-new empty brains) hash to the same version key and collide in the cache table. Cheap to add, and removes a fragile "it happens to differ because the data differs" assumption.

## 4. Tool scope: `manage_brain` targets the active brain only

`manage_brain` (P1 Task 5) gets **no new `brain_id` parameter.** It always operates on `bot_session_states.active_brain_id` for the current session — never a brain named or implied elsewhere in the conversation.

**Why (owner-decided, 2026-07-16):** letting the model address a brain by name reopens the exact bug class the P1 security work (ownership validation, `assertOwnedEntity`) was built to close — the model would have to resolve a fuzzy name to an ID itself, with real chances of targeting the wrong brain or needing an extra `list_brains` round-trip. It also breaks the mental model established for the pill/UI: "you're *in* a brain for this conversation; what you tell the bot to remember goes there." If a user wants to add to a brain other than the one active in the current chat, the supported path is switching the pill first (§5), not asking the bot to cross-target.

## 5. Session binding & the pill

**Revised during planning (2026-07-16):** this codebase has no dedicated "new chat" landing page — `startNewChat()` just clears client state (`activeChatId: null`, `pendingNewChat: true`); the actual chat row is created lazily on the first message send (`sendAIMessage` in `store.ts`). There is nothing to put preset cards "on" before that point. The pill (below) subsumes both roles the original design split across two surfaces: it's clickable to pick a brain BEFORE the first message of a new session (while `pendingNewChat` is true and no session exists yet), and clickable to swap AFTER a session exists. One control, two moments — not a lost feature, a merged one.

**The pill** lives in the message bar's "Right Actions" row (`src/components/assistant/AIAssistant.tsx`, next to the existing mode selector — same row as "Regular"/"Thinking"/"Advisor"): icon + current brain name. Click opens a switcher listing the user's brains (title + description). Selecting one:
1. **Before the first send of a new session** (`pendingNewChat` true): just sets the client-side `activeBrainId` the store will send as part of the first `/api/ai/chat` request body — no repin needed yet, since no session/pin exists.
2. **Mid-session** (a real `activeChatId` already exists): calls a repin — compiles the new brain and overwrites `bot_session_states.active_brain_id` AND `pinned_brain_version` together, in the same operation (this is the exact mechanism P1's `refresh` op already performs; a swap that updates `active_brain_id` without also overwriting the pin would leave `getBrainBlockForSession` still serving the OLD brain's compile, since it short-circuits on the existing pin — this must not be split into two separate writes). Inserts a visible system-style divider in the message list ("Switched to Trading brain") so the transcript is unambiguous about which brain was active for which messages.

**Cache cost, precisely:** turns before a swap are cached exactly as in P1 (pinned compile reused every turn). The swap turn itself is one cache-miss (a fresh prefix write for the new brain), identical in cost to what `refresh` already pays today. Turns after the swap cache normally again against the new pinned version. This is categorically cheaper than P3's later concern (reclassifying every message would cache-miss constantly) — a user manually swapping brains is a rare, deliberate action, not a per-message event.

## 6. UI surfaces

- **Message bar pill** (`AIAssistant.tsx`): icon + active brain name, in the Right Actions row. Click to open a switcher (list of the user's brains). Triggers the pre-session pick or mid-session swap described in §5. This is the ONLY brain-selection surface — no separate new-chat page (see §5's revision).
- **Brain management** (rename, edit description, create, delete): lives in the existing Brain page (P1 Task 8) — add a brain-switcher/list at the top of that panel, reusing its existing node/edge/budget views scoped to whichever brain is selected there. Not a new page.

Canvas/graph view and drag-and-drop from the home-page sidebar are explicitly **out of scope for P2a** — they land in P2b, once there's a spatial graph to drop onto.

## 7. Out of scope (deferred to later phases)

- **P2b**: canvas rendering of the brain graph; drag-and-drop of home-page entities (unsorted items, workspaces with children) onto the active brain, calling the existing `add_node` op on drop. Also flagged for design here (owner, 2026-07-16, Obsidian-graph-inspired): **typed/hierarchical edges**, not just labeled ones — a central "parent" node with several "child" nodes explicitly connected below it (sequence/order/hierarchy that's structural, not just a sentence). Today's `brain_edges` are flat and untyped (`from`, `to`, one freeform `label`); a real hierarchy needs an edge *kind* the compiler treats differently (nesting children under a parent in the compiled text, not just appending a trailing relationship sentence), plus answers for whether a parent's priority/pin status cascades to children and whether budget-drop respects the hierarchy. Note the tension with the P1 spec's explicit rejection of *cluster-derived* grouping (order-instability, cache churn) — this idea is about *explicit* typed edges forming structure, not auto-derived clustering, so it doesn't directly conflict, but the distinction needs to be reasoned through carefully when this is designed, not assumed. Belongs with the canvas work since the hierarchy is inherently spatial.
- **P3**: "auto" brain selection — the classifier (`classifyIntentV2` in `classifier.ts`) gains a `brain` field alongside its existing `category`/`complexity`/`action` JSON output, matched against each brain's `description`. The classifier's user prompt is already built fresh per message (message text, image/reply-context hints), so adding brain candidates to it is additive, not a new shape. What's deliberately NOT decided here: how often an auto-selected brain change should actually repin the main-chain cache (naive "reclassify and repin every message" would cache-miss constantly, unlike the rare manual swap in §5) — that tradeoff gets designed in P3, once P2a's manual selection exists as a fallback/baseline to compare against and to fall back to if auto picks wrong.

## 8. Build order

1. Migration: `brains` table, `brain_id` on `brain_nodes`/`brain_edges`, `active_brain_id` on `bot_session_states`; backfill existing users into an auto-created "Main" brain.
2. `brainStore.ts` functions gain a `brainId` parameter (or are scoped via the session's active brain where called from the bot pipeline); last-brain-deletion guard.
3. New-chat brain-picker cards + session creation sets `active_brain_id`.
4. Message-bar pill + mid-session swap (repin + chat divider).
5. Brain page gets a brain switcher/list at the top, scoped views.
6. Live verification: multi-brain isolation (nodes in Brain A never leak into Brain B's compile), last-brain-delete guard, swap-divider correctness, cache-hit/miss behavior around a swap matches §5's description.
