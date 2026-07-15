You are acting as a critical design advisor. Review a feature design for Flowr (a productivity app: notes, tasks, whiteboard canvas, plus an AI assistant bot) and tell me honestly whether it's the best version of this spec — what's wrong, what's missing, what's over- or under-engineered. Do NOT implement anything; this is a design review. You may read the codebase at c:\Users\misha\Documents\Dev\flowr-app copy\flowr-app copy to verify claims (key files: src/lib/bot/services/promptBuilder.ts, src/lib/bot/tools/definitions.ts and handlers.ts, src/lib/bot/context.ts, supabase/schema.sql, docs/superpowers/specs/2026-07-11-bot-rework-design.md).

## Product context
The owner (solo founder, 19) wants a "Brain" page in the chat sidebar: a place where users manage what the bot knows — inspired by the Obsidian-vault+Claude-Code trend (agent builds/navigates a personal knowledge vault). Goals: (1) users control which workspaces/entities/memories the bot knows without asking; (2) visually pleasing/gamified so it feels essential, not complex; (3) the BOT can build and maintain its own brain via tools ("build a brain about my trading" → bot creates nodes/connections; interview flows for profile sections); (4) per-subscription-tier token budget so users can't dump 100k tokens of context (e.g. Pro pays $20, ~$15 API credits, brain limit ~10-20k tokens, injected cached).

## Relevant existing architecture (verified in code)
- Bot pipeline: classifier → category chains; system prompt split into STATIC part (cached, prompt-caching verified working ~79-85% hit) and per-turn dynamicContext (date/time block, page context, session summary, pending confirmations). Nothing workspace/task-related is proactively injected today.
- Existing `bot_memories` table + `manage_memory` tool already exist (memory cards, op-style single tool).
- §6b server-side confirmation gate exists for destructive tool ops (dry-run → pending_action → next-turn confirm, turn_seq-scoped).
- Existing canvas/whiteboard engine in the app (shapes, connectors) that could be reused for a node UI.
- Data: `entities` table (notes/folders/workspaces conflated via type column, no description field), `tasks` table. A "workspace" for the bot = entities row with type='workspace'.
- Recent hard-won lesson (§7b): token metrics must only count PERSISTED, compactable data; provider-reported prompt_tokens include ephemeral tool payloads and caused a phantom 132% memory-usage bug. Server must own invariants (budgets, confirmations), never trust the model.
- Roadmap: this Brain feature would supersede §7 "Memory v2" (memory cards + idle-run auto-capture + weekly consolidation via a background SYSTEM chain) and absorb the static half of §3 "Context pack" (workspace map injection; the dynamic due-today/overdue task snapshot would stay separate).

## The design under review

1. **Data model**: new tables `brain_nodes` (id, user_id, type: workspace|entity|memory|section, ref_id for refs — content referenced not copied, content only for freetext memory nodes, label, enabled, created_by user|bot, nullable x/y position for later canvas, timestamps) and `brain_edges` (from_node, to_node, label — label is the payload). Existing bot_memories imported as memory nodes. Documents/images as node types deferred.
2. **Compile + injection**: server-side compileBrain(userId) → one [BRAIN] text block (sections from clusters, node content resolved at compile time, edges become "A ←label→ B" lines). Stored, marked stale on brain/referenced-content change, recompiled lazily. Injected into the STATIC system prompt for cache-friendliness. Dynamic task snapshot stays separate/per-turn/unbudgeted.
3. **Budget**: enforced at compile time server-side. Per-tier token limits in an admin-editable config table. Over budget → lowest-priority disabled nodes drop with visible warning, nothing silently truncated mid-node.
4. **Bot tools**: one `manage_brain` tool with op param (add_node, connect, update, remove, list), mirroring manage_memory. Destructive ops go through the §6b confirm gate. Budget rejection returns structured error the bot relays.
5. **Phases**: P1 data+compile+budget+tool+plain list page (bot can build brain via chat from day one). P2 canvas UI on existing canvas engine + split-mode note editing + manual edges. P3 interview flow prompt pattern + gamification polish.
6. **Acceptance tests**: (a) transcript shows [BRAIN] block injected + cache-hit on repeat turns; (b) an edge label measurably changes an answer (anti-decoration bar); (c) "build a brain about X" produces real nodes visible in UI; (d) server refuses bot adds past budget.
7. **Spec handling**: new spec doc; old spec's §7 marked superseded, §3 split, workspaces-own-table idea logged as future consideration.

## Questions I want your judgment on
1. Is the compile-to-static-prompt architecture sound, or are there traps (cache invalidation cost when brain changes mid-conversation? stale compile vs. referenced note edited? multi-device)? 
2. Is referencing entity content at compile time (not copying) correct, or does it make budget enforcement unstable (note grows → brain silently over budget)?
3. Is one manage_brain op-tool right, or should brain ops fold INTO the existing manage_memory tool instead (one less tool)?
4. Sections/clusters: is deriving sections from graph clusters over-clever? Would an explicit section/parent field be more robust?
5. Is the edge model (freetext label compiled as a relation line) actually going to change model behavior enough to pass the anti-decoration test, or is this wishful?
6. What's missing entirely? (Think: RLS/security, cross-user leakage, versioning/undo for bot edits gone wrong, what happens on entity deletion when brain references it, compile latency in the request path, migration of bot_memories, admin observability.)
7. Is the phasing right — anything in P2/P3 that must be pulled into P1, or P1 scope that should be cut?
8. Tier/budget economics: any flaw in "10-20k tokens cached ≈ affordable for $15 credit user"?

Be a harsh critic. Rank your findings by severity: what would actually break or embarrass the product vs. nice-to-have. Keep the report under 800 words.