# Unfinished work inventory

Snapshot for review. Compiled from `docs/superpowers/specs/`, `plans/`, and living progress tables (mainly bot rework + Brain).  
**Date:** 2026-07-19  

Statuses reflect what the **docs** say. Some design headers are stale (e.g. Brain P1 still marked “not yet implemented” at the top of its file while §0/notes say P1 shipped). Prefer the progress tables and dated notes when they disagree with the title line.

---

## How to use this list

| Priority band | Meaning |
|---------------|---------|
| **P0 product gaps** | Designed, not started, user-visible capability missing |
| **P1 designed builds** | Spec/plan exists; build or finish next |
| **P2 polish / verify** | Mostly built; needs live test or small leftover |
| **P3 deferred / non-goals** | Explicitly later or out of scope for now |

---

## P0 — Product gaps (designed, not built)

### 1. Notifications v1
- **Status:** ⬜ Not started  
- **Source:** `docs/superpowers/specs/2026-07-11-bot-rework-design.md` §8 (bot rework step 7)  
- **Summary:** Task `reminder` is stored but nothing fires. Need a periodic scheduler for reminders/due dates, a `NotificationProvider` abstraction (v1: **Telegram** + **in-app**), an in-app **bell** (replaces Download Desktop next to profile) + toast when the app is open, and wire `create_content.reminder` into the scheduler. Email/Apple later. Foundation for future scheduled actions / briefs (those remain non-goals for v1).

### 2. ~~Workspace description~~ → done (2026-07-19)
- UI: brain popup + workspace page edit control.  
- AI: Brain compile already includes descriptions; **also** active-workspace inject into `[CURRENT CONTEXT]`, `list_content` returns description, create/update workspace can set description.

### 2b. Dynamic context pack (due-today / overdue tasks) — deprioritized
- Owner preference: skip unless needed; prefer workspace descriptions over auto task dump.
- **Status:** Unscheduled leftover  
- **Source:** `2026-07-11-bot-rework-design.md` §3 / §5 — static half superseded by Brain  
- **Summary:** Per-turn injection of “due today / overdue” task snapshot so the bot knows what’s on the plate without the user listing tasks. Workspace map + memory injection moved to Brain; **this dynamic slice never shipped**.

### 3. Telegram as account-linked connector
- **Status:** Dormant stack; redesign not written  
- **Source:** `docs/superpowers/specs/2026-07-08-remove-router-chains-platform-design.md`  
- **Summary:** `telegram.ts`, webhook, `notifications.ts`, `usageGuard` kept as-is. Intended future: proper account link, chat parity with the app, task reminders via Telegram. Attachments/Telegram parity code marked done but **not live-tested on a real bot**.

---

## P1 — Designed builds (spec/plan exists)

### 4. Brain P2b — canvas + drag-and-drop
- **Status:** Design/plans exist; implementation not marked shipped  
- **Sources:**  
  - `docs/superpowers/specs/2026-07-17-brain-canvas-design.md`  
  - `docs/superpowers/specs/2026-07-18-brain-canvas-details-design.md`  
  - Plans: `2026-07-17-brain-canvas.md`, `2026-07-18-brain-canvas-part-a-left-panel.md`, `part-b-details-panel.md`, `part-c-node-taxonomy.md`  
- **Summary:** Spatial brain graph, left panel, details/edges panel, node taxonomy. Drag entities from home sidebar onto the brain. Builds on multi-brain (P2a). Also flagged: **typed/hierarchical edges** (structural parent/child, not only freeform labels).

### 5. Brain P3 — auto brain selection
- **Status:** Direction only; full design TBD  
- **Source:** `docs/superpowers/specs/2026-07-16-brain-presets-design.md`  
- **Summary:** Classifier picks a brain per message from each brain’s description. Cache/repin tradeoffs not decided (naive per-message switch would thrash prompt cache). Needs P2a as baseline + manual fallback.

### 6. Brain idle auto-capture
- **Status:** Deferred to Brain P3+  
- **Source:** Bot rework Memory v2 → superseded by Brain  
- **Summary:** Old “idle-run auto-capture” of facts into memory; rehomed as future Brain growth, not a separate Memory v2 track.

### 7. Settings Phase 2+
- **Status:** Phase 1 structure planned/partially owned; Phase 2 deferred  
- **Source:** `docs/superpowers/specs/2026-07-17-settings-phase1-structure-ui-design.md`  
- **Summary:** Still open: **Privacy** tab, **Notifications** settings toggles (UI prefs, not the §8 product), AI prefs polish, OAuth link/unlink, more connectors. Phase 1 was “structure + tab consistency,” not full settings product.

### 8. Zero-flash shell SSR (loading Scope 4)
- **Status:** Spec approved; **not planned into tasks**  
- **Source:** `docs/superpowers/specs/2026-07-15-zero-flash-shell-ssr-design.md`  
- **Related:** `docs/superpowers/plans/2026-07-15-stable-refresh.md` (Scopes 1–3 done; Scope 4 separate)  
- **Summary:** Eliminate flash of empty shell on tab load via SSR/hydration strategy. Stable-refresh Scopes 1–3 are code-complete but Scope 2 still wants a **manual multi-space cloud smoke-test**.

### 9. Per-page loading polish
- **Status:** Design notes; small TODOs remain  
- **Source:** `docs/superpowers/specs/2026-07-16-per-page-loading-design.md`, `LOADING-ARCHITECTURE.md`  
- **Summary:** Unify readiness gates; known gap e.g. `isLoading` not always passed through `EntityPageRenderer` → `NotePage`.

---

## P2 — Mostly done / verify / partial

### 10. Brain P2a — multi-brain presets
- **Status:** Implemented (2026-07-16), **pending live verification**  
- **Source:** `docs/superpowers/specs/2026-07-16-brain-presets-design.md`  
- **Summary:** Multiple brains per user, default Main, mid-session brain pill, isolation by `brain_id`. Needs live two-brain isolation check and full acceptance pass.

### 11. Brain P1 — live acceptance gaps
- **Status:** P1 shipped; acceptance tests **3–7 not run** (owner decision)  
- **Source:** `docs/superpowers/specs/2026-07-14-brain-design.md`  
- **Summary:** Tests still open if you care: anti-decoration edges, bot-built brain via chat, budget refusal UX, security foreign-id, deleted-entity broken-node badge. 1–2 (injection + cache) were verified.

### 12. Bot tool rework (edit_content / confirmation flags)
- **Status:** 🟡 Partially done  
- **Source:** `2026-07-11-bot-rework-design.md` §7c / step 2b  
- **Summary:** `update_content` **patch** shipped. Full `edit_content` rename / old confirmation flag cleanup did not ship as originally planned; confirmation ownership folded into §6b (done). Residual naming/unification may still be incomplete vs original §7c vision.

### 13. Telegram attachments parity — live bot test
- **Status:** Code done; **not live-tested with real Telegram bot**  
- **Source:** Bot rework §5 / handoffs under `docs/superpowers/handoffs/`  
- **Summary:** Media groups, durable storage, clientTime, etc. need one real end-to-end bot session.

### 14. Classifier model swap
- **Status:** Deferred  
- **Source:** Bot rework §0  
- **Summary:** Optional swap llama-3.1-8b → gpt-oss if `action` flag misroutes again. Not required while few-shot counting holds.

### 15. Stable refresh — manual smoke
- **Status:** Code done; manual multi-space cloud smoke still called out  
- **Source:** `docs/superpowers/plans/2026-07-15-stable-refresh.md`  
- **Summary:** Boot/hydration/sync paths unit-tested; real multi-space cloud refresh not fully exercised by automation.

---

## P3 — Explicitly later / non-goals (don’t schedule as “unfinished product”)

| Item | Note |
|------|------|
| Daily / morning briefs | Bot rework non-goal |
| Gemini-style scheduled actions | Non-goal; notifications scheduler is the hook later |
| Email / Apple notification providers | After Telegram + in-app |
| PWA web push | PWA design; out of current core path |
| Widget timer browser Notification API | Old widget ecosystem plan only |
| Admin push/webhooks | Archived unified-admin deferred ideas |

---

## Suggested review order

1. **Notifications v1** — clear user pain (`reminder` does nothing)  
2. **Brain P2a live verify** → **P2b canvas** — largest designed unfinished surface  
3. **Due/overdue context pack** — small, high leverage for “what’s on my plate?”  
4. **Telegram connector redesign** — only if you care about bot + reminders outside the app  
5. **Settings Phase 2 / zero-flash SSR** — product polish, not AI capability  

---

## Key source files (bookmark)

| Topic | Path |
|-------|------|
| Bot rework living plan | `docs/superpowers/specs/2026-07-11-bot-rework-design.md` |
| Notifications design | same file, **§8** |
| Brain core | `docs/superpowers/specs/2026-07-14-brain-design.md` |
| Brain presets (P2a) | `docs/superpowers/specs/2026-07-16-brain-presets-design.md` |
| Brain canvas | `docs/superpowers/specs/2026-07-17-brain-canvas-design.md` |
| Brain canvas details | `docs/superpowers/specs/2026-07-18-brain-canvas-details-design.md` |
| Telegram dormant note | `docs/superpowers/specs/2026-07-08-remove-router-chains-platform-design.md` |
| Settings phase 1 / phase 2 backlog | `docs/superpowers/specs/2026-07-17-settings-phase1-structure-ui-design.md` |
| Zero-flash SSR | `docs/superpowers/specs/2026-07-15-zero-flash-shell-ssr-design.md` |
| Stable refresh | `docs/superpowers/plans/2026-07-15-stable-refresh.md` |
| Loading architecture | `docs/superpowers/LOADING-ARCHITECTURE.md` |

---

## Not tracked as formal “unfinished plans”

Recent work that is **not** in the living plans above (session/feature work):

- Reddit post extract (text + vision) for chat  
- YouTube transcript error honesty (network vs no captions)  
- `read_url` Reddit cache to avoid double fetch  

Add these to a plan only if you want them documented as product requirements.

---

*Update this file when a track ships or a new living spec gains a progress table.*
