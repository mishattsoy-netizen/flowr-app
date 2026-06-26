User request: "what do you suggest?" → "b. write all proper 4 plans"

## Date and Time
27.06.2026, 01:44

## Objective Reconstruction
After verifying a 1,314-line local-first architecture plan and finding 5 inaccuracies and 7 gaps, the user asked for a recommendation. I proposed splitting the monolithic plan into 4 independent milestones. The user chose this approach and asked me to write all 4 detailed plans.

## Strategic Reasoning
The original plan tried to do everything at once (Electron + file format + sync modes + migration + feature removal). This creates high risk of breaking the working web app. By splitting into 4 milestones:
- M1 (Cleanup): Pure subtraction, removes ~500 lines of dead code, zero risk to core features
- M2 (Markdown): Pure library code with unit tests, no UI changes
- M3 (Electron): Desktop shell with file I/O, web app untouched
- M4 (Sync Modes): The complex sync logic, built on solid foundations from M1-M3

Each milestone ships independently. If any milestone takes longer than expected, the others aren't blocked.

## Detailed Blueprint
Wrote 4 comprehensive plans covering:
- M1: Life mode removal (7 types, 7 arrays, 15 actions, 7 SQL tables), Knowledge types removal (3 types, 3 arrays, 9 actions, 3 SQL tables), Database/Embed block removal, schema.sql sync
- M2: frontmatter.ts, columnsMarkdown.ts, pill link import, comprehensive test suites
- M3: electron/main.js, electron/preload.js, env.ts, fileVault.ts, persistence.ts, VaultSetupModal.tsx
- M4: SyncMode type system, store migration 17→18, persistence adapter upgrade, conflict resolution, cloud→local migration, bot tool adaptation

## Operational Trace
- Researched additional codebase details: next.config.ts (rewrites block static export), middleware.ts (auth gating), SupabaseProvider.tsx life/knowledge sync, NoteEditor.tsx 1s debounce, partialize function, store.ts actions, schema.sql full tables
- Grep searched for all life mode, knowledge type, database block, and embed block references across components
- Verified bot tool names are `create_note`, `update_note`, `append_note_blocks`, `delete_note`, `create_folder`, `list_notes` (NOT what the original plan claimed)
- Confirmed schema.sql has ALTER TABLE blocks for workspace_id/widget_layout but missing subtasks/completed_at/description/user_due_date
- Created implementation_plan.md artifact with all 4 plans, exact file paths, line numbers, and code diffs

## Status Assessment
- Completed: All 4 milestone plans written with full code references
- Awaiting: User review and approval before any implementation begins
- Key architectural decision documented: Electron will use Next.js dev server (not static export) because middleware.ts and rewrites are incompatible with `next export`
- Recommended push points: M1=Flowr-1.6, M2=Flowr-1.7, M3=Flowr-1.8, M4=Flowr-2.0
