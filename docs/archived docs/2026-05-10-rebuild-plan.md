# Rebuild Plan — Post-OpenCode Reset Recovery

> **Root Cause:** `opencode` ran `git reset --hard 94f6f9c` + overwrote working files, destroying all uncommitted work accumulated across multiple sessions since Flowr 4.7.0 (`e86b759`).
>
> **Impact:** ~100+ reports in history/09.05 document features that no longer exist in the codebase.
>
> **Recovery Sources:** History reports, conversation logs, surviving design docs, and surviving untracked files (new components in `src/components/admin/`).

---

## Priority Legend

| Priority | Meaning |
|----------|---------|
| 🔴 P0 | Core functionality broken — rebuild immediately |
| 🟡 P1 | Important feature regression — rebuild in this session |
| 🟢 P2 | Polish/enhancement — can wait |

---

## Phase 1: Critical Infrastructure (🔴 P0)

### 1.1 — OpenRouter Provider Routing + Fallbacks
**Lost from:** Reports #68, #69, #71, #77, #78, #105
**Files affected:**
- `src/lib/bot/providers/openrouter.ts` — add `openrouterProvider` param, `provider.order` + `allow_fallbacks: true`
- `src/lib/bot/chainRouter.ts` — pass `modelConfig.openrouter_provider` to `runOpenRouter`
- `src/lib/bot/pipeline.ts` — same
- `src/lib/bot/thinkChain.ts` — same
- `src/lib/bot/orchestrator.ts` — same
- `src/lib/bot/classifier.ts` — same
- `src/lib/bot/advisor.ts` — same

**What to rebuild:**
- `runOpenRouter` signature: add optional `openrouterProvider?: string` parameter
- When provided, append `provider: { order: [openrouterProvider], allow_fallbacks: true }` to request body
- All callers pass `modelConfig.openrouter_provider` through

**Complexity:** Medium — touches many files but same 1-line change in each caller

---

### 1.2 — ChatMessage.tsx Full Rebuild
**Lost from:** Reports #79, #87–#103, #107, #108 + this session's fixes
**File:** `src/components/assistant/components/ChatMessage.tsx` (currently at 572 lines / old e86b759 version)

**What to rebuild (in order):**
1. **Imports:** Add `CornerUpLeft, ChevronDown, ChevronUp, Brain, CheckCircle2, XCircle, Clock, Sparkles, FileText, ClipboardCopy` to lucide imports. Add `remarkGfm`, `clsx`, `DropdownMenu`, `parseMarkdownToBlocks`, `generateId`, `Entity` type
2. **Pipeline/Thinking UI:** `hasThinking` detection, `isStepsExpanded` toggle, `thoughtContent` extraction, Brain icon + "Show thinking" button, expandable pipeline steps with Crimson Text styling
3. **Rich Markdown Rendering:** `markdownComponents` object with proper heading/list/table/code/bold/italic styling using DM Sans + Crimson Text + DM Mono
4. **Copy to Note Split Button:** `DropdownMenu` with "Copy to active note" / "Create new note" options using `parseMarkdownToBlocks`
5. **Reply Button:** `CornerUpLeft` icon with `onReply(msg)` callback
6. **Citations Section:** Source links with favicons, styled pill layout
7. **Model Info Badge:** Model name + completion time + token count pill
8. **Typography Fixes:**
   - Crimson Text for prose/thinking
   - DM Sans 14.5px medium for body
   - DM Mono for code blocks
   - All text sizes +2px from original defaults
   - Semibold and italic support in markdown
9. **Null Safety:** All `msg.content` accesses guarded with `|| ''`
10. **Store Integration:** Use `addEntity` (not `createEntity`), `entities.find()` (not `getEntityById`), `parseMarkdownToBlocks` (not `markdownToBlocks`)

**Complexity:** High — this is the largest single rebuild item

---

### 1.3 — Cloudflare Provider Arg Fix
**Lost from:** Report #108
**File:** `src/lib/bot/chainRouter.ts` line ~379
**Fix:** Remove 4th arg `system_prompt` from `runCloudflare()` call (function only takes 3)

**Complexity:** Trivial — 1 line

---

### 1.4 — markdownToBlocks.ts EditorBlock Fix
**Lost from:** Report #108
**File:** `src/lib/utils/markdownToBlocks.ts`
**Fix:** Add `content: ""` to `divider` and `table` block push calls (3 locations)

**Complexity:** Trivial — 3 lines

---

## Phase 2: Admin Panel Features (🟡 P1)

### 2.1 — Paid Model Support (Discover Page + Router)
**Lost from:** Reports #61–#64
**Files affected:**
- `src/data/store.types.ts` — add `isPaid?: boolean` to `FlowRouterModel`
- `src/components/admin/model-utils.ts` — add `is_paid`, `prompt_cost`, `completion_cost` to `RegistryModel`
- `src/components/admin/RouterManager.tsx` — gold `$` badge indicator for paid models
- `src/lib/router-config.ts` — join pricing data from `models` table in `getRouterChain`
- `src/lib/bot/chainRouter.ts` — cost projection check ($0.10 threshold)
- `src/lib/bot/providers/openrouter.ts` — cost logging to `cost_log` table
- `src/app/admin/discover/DiscoverClient.tsx` — paid filter toggle, pricing display

**Complexity:** High — spans types, DB, UI, and runtime

---

### 2.2 — Global Settings Pipeline/Context/Inner Chain Prompts
**Lost from:** Reports #27, #88, #89 and related conversation work
**File:** `src/app/admin/bot/global/GlobalSettingsClient.tsx`

**What to rebuild:**
- Pipeline prompt editing section (orchestrator, thinking, web-search, vision, etc.)
- Context prompt settings
- Inner chain prompt configuration
- Dynamic file-based prompt loading (already have pipeline-*.txt files surviving)

**Complexity:** Medium

---

### 2.3 — Remove Think Mode Admin Page
**Lost from:** Previous session work (the `/admin/bot/think` page should not exist as a separate page — its functionality was merged into Global Settings)
**Action:** Delete or redirect `src/app/admin/bot/think/` directory

**Complexity:** Trivial

---

### 2.4 — LogsTable Advisor/Classifier Trace Separation
**Lost from:** Report #106
**File:** `src/app/admin/logs/LogsTable.tsx`
**Fix:** Filter `advisor(...)` entries from `classifyTrace` before rendering pills. Only show actual classifier model attempts in the classify key row.

**Complexity:** Low — surgical filter in `parseChain` logic

---

### 2.5 — OpenRouter Provider Selector UI Component
**Lost from:** Reports #68, #71, #77
**Note:** File `src/components/admin/OpenRouterRoutingProviderSelector.tsx` exists as untracked — may have surviving code
**Check:** Verify if the untracked component file is still intact and wire it back into RouterManager

**Complexity:** Low if component survived, Medium if needs rebuild

---

## Phase 3: Chat & Editor Polish (🟢 P2)

### 3.1 — Note Block Styling (Match Chat)
**Lost from:** Reports #101–#103
**What:** Note block typography should use Crimson Text for prose, DM Sans for UI, DM Mono for code. Link pill buttons with 8px corners. All text sizes +2px.

**Complexity:** Low

---

### 3.2 — Slash Command Shortcuts Display
**Lost from:** Reports #80–#82
**What:** Show markdown keyboard shortcuts in the slash command menu items

**Complexity:** Low

---

### 3.3 — Code Block Container (Mono Card)
**Lost from:** Reports #83–#85
**What:** Containerized mono blocks with copy overlay, normalized paste styles, overflow fixes

**Complexity:** Low

---

### 3.4 — Chat Formatting Standardization
**Lost from:** Reports #86–#97
**What:** Pipeline step casing, Claude-style formatting, typography consistency, table styling, border radius unification, header font sizes, line heights

**Complexity:** Medium — many small changes across markdown components

---

### 3.5 — Editor Notion-Style Shortcuts
**Lost from:** Commit `9358ce7` (recovered via cherry-pick — verify BlockRenderer.tsx)
**File:** `src/components/editor/BlockRenderer.tsx`

**Complexity:** Already recovered — verify only

---

## Phase 4: Verification

### 4.1 — Surviving Untracked Files Audit
These files exist as untracked and may contain useful code:
- `src/components/admin/OpenRouterRoutingProviderSelector.tsx`
- `src/components/admin/OrchestratorPanel.tsx`
- `src/components/admin/PipelinePromptsPanel.tsx`
- `src/components/admin/PipelineStatusPanel.tsx`
- `src/components/admin/RowOptionsDropdown.tsx`
- `src/components/admin/SortableRouterGrid.tsx`

**Action:** Read each file to assess if they contain recoverable feature code

---

## Execution Order

```
1. Kill opencode process + commit current state as safety checkpoint
2. Phase 1.3 + 1.4 (trivial fixes, 5 min)
3. Phase 1.1 (OpenRouter provider routing, 15 min)
4. Phase 1.2 (ChatMessage full rebuild, 45-60 min)
5. Phase 2.4 (LogsTable fix, 10 min)
6. Phase 2.5 (Provider selector UI, 10 min)
7. Phase 2.3 (Remove think page, 2 min)
8. Phase 2.1 (Paid model support, 30 min)
9. Phase 2.2 (Global Settings pipeline prompts, 20 min)
10. Phase 3.x (Polish items, 30 min)
11. COMMIT + PUSH to GitHub immediately
```

**Estimated total rebuild time: 3–4 hours**

---

## Prevention

1. **Kill `opencode` process immediately** — it caused this
2. **Commit after every significant feature** — never accumulate uncommitted work
3. **Push to GitHub at each version milestone** — the remote was 60+ commits behind
4. **Never allow external AI tools write access to git** without supervision
