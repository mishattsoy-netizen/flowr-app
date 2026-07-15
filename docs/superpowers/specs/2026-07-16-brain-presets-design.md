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
- `is_default` marks the brain new sessions fall back to if `active_brain_id` is ever null (should not normally happen once new-chat always sets it, but keeps the invariant enforceable server-side rather than assumed).
- Every brand-new user account gets its "Main" brain auto-created at account setup, not lazily on first use — the new-chat picker always has at least one real card, no empty state to design for.

## 3. Ownership & security

Unchanged from P1 §6, scoped down one level: every `brain_nodes`/`brain_edges` query already filters by `user_id`; it now also filters by `brain_id`, and `brain_id` itself is validated to belong to `user_id` before any node operation touches it (same "validate ownership before use" chokepoint pattern as `assertOwnedEntity`). A `brain_id` the caller doesn't own behaves like a nonexistent one — generic "not found," never a distinguishing error.

## 4. Tool scope: `manage_brain` targets the active brain only

`manage_brain` (P1 Task 5) gets **no new `brain_id` parameter.** It always operates on `bot_session_states.active_brain_id` for the current session — never a brain named or implied elsewhere in the conversation.

**Why (owner-decided, 2026-07-16):** letting the model address a brain by name reopens the exact bug class the P1 security work (ownership validation, `assertOwnedEntity`) was built to close — the model would have to resolve a fuzzy name to an ID itself, with real chances of targeting the wrong brain or needing an extra `list_brains` round-trip. It also breaks the mental model established for the pill/UI: "you're *in* a brain for this conversation; what you tell the bot to remember goes there." If a user wants to add to a brain other than the one active in the current chat, the supported path is switching the pill first (§5), not asking the bot to cross-target.

## 5. Session binding & the pill

**New-chat page:** shows the user's brains as cards (title + description), including "Main." Picking one sets `active_brain_id` for the new session before the first message is sent.

**Mid-session switch (pill in the message bar, next to the actions button — icon + current brain name):** swappable at any time, not locked once chosen. Selecting a different brain:
1. Compiles + pins the new brain's version to the session (`active_brain_id` updates, same repin mechanism P1's `refresh` op already uses).
2. Inserts a visible system-style divider in the message list ("Switched to Trading brain") so the transcript itself is unambiguous about which brain was active for which messages — both what the bot *read* and what `manage_brain` calls *wrote* before vs. after the divider are legible without guessing.

**Cache cost, precisely:** turns before a swap are cached exactly as in P1 (pinned compile reused every turn). The swap turn itself is one cache-miss (a fresh prefix write for the new brain), identical in cost to what `refresh` already pays today. Turns after the swap cache normally again against the new pinned version. This is categorically cheaper than P3's later concern (reclassifying every message would cache-miss constantly) — a user manually swapping brains is a rare, deliberate action, not a per-message event.

## 6. UI surfaces

- **New-chat page**: brain preset cards (title, description, maybe a small budget/node-count indicator) — pick one to start the session.
- **Message bar pill**: icon + active brain name, next to the actions button. Click to open a switcher (same brain list as the new-chat cards). Triggers the mid-session swap in §5.
- **Brain management** (rename, edit description, create, delete): lives in the existing Brain page (P1 Task 8) — add a brain-switcher/list at the top of that panel, reusing its existing node/edge/budget views scoped to whichever brain is selected there. Not a new page.

Canvas/graph view and drag-and-drop from the home-page sidebar are explicitly **out of scope for P2a** — they land in P2b, once there's a spatial graph to drop onto.

## 7. Out of scope (deferred to later phases)

- **P2b**: canvas rendering of the brain graph; drag-and-drop of home-page entities (unsorted items, workspaces with children) onto the active brain, calling the existing `add_node` op on drop.
- **P3**: "auto" brain selection — the classifier (`classifyIntentV2` in `classifier.ts`) gains a `brain` field alongside its existing `category`/`complexity`/`action` JSON output, matched against each brain's `description`. The classifier's user prompt is already built fresh per message (message text, image/reply-context hints), so adding brain candidates to it is additive, not a new shape. What's deliberately NOT decided here: how often an auto-selected brain change should actually repin the main-chain cache (naive "reclassify and repin every message" would cache-miss constantly, unlike the rare manual swap in §5) — that tradeoff gets designed in P3, once P2a's manual selection exists as a fallback/baseline to compare against and to fall back to if auto picks wrong.

## 8. Build order

1. Migration: `brains` table, `brain_id` on `brain_nodes`/`brain_edges`, `active_brain_id` on `bot_session_states`; backfill existing users into an auto-created "Main" brain.
2. `brainStore.ts` functions gain a `brainId` parameter (or are scoped via the session's active brain where called from the bot pipeline); last-brain-deletion guard.
3. New-chat brain-picker cards + session creation sets `active_brain_id`.
4. Message-bar pill + mid-session swap (repin + chat divider).
5. Brain page gets a brain switcher/list at the top, scoped views.
6. Live verification: multi-brain isolation (nodes in Brain A never leak into Brain B's compile), last-brain-delete guard, swap-divider correctness, cache-hit/miss behavior around a swap matches §5's description.
