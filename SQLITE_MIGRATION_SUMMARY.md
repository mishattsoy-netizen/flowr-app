# SQLite Local Storage & Sync — Implementation Summary

Full spec: `docs/superpowers/specs/2026-07-09-sqlite-local-storage-and-sync-design.md`
Full plan (all tasks, checkboxes, verification notes): `docs/superpowers/plans/2026-07-09-sqlite-local-storage-and-sync.md`

## What shipped

Replaced desktop-local Markdown file-vault persistence with a local, unencrypted SQLite database (`better-sqlite3`, Electron main process), covering `entities`, `tasks`, and `spaces`. Supabase push is now debounced (1.5s per row) instead of firing on every keystroke. A one-time importer migrates existing users' localStorage/file-vault data into SQLite on first launch of the new version.

**Execution:** split across multiple AI models to conserve your Claude budget. Tasks 1-5 (schema, IPC bridge, `lastModified` migration) went to other providers. Task 6 (debounce wrapper) and Task 9 (boot hydration) — the two tasks flagged hardest, since they're where correctness bugs actually surfaced during design review — were done by me. Tasks 7-8 went to Gemini 3.1 Pro. Tasks 10-14 went to other models. Every task was independently re-verified by me afterward (re-running the real test suite and `tsc`, not trusting self-reports) before being committed.

## Task-by-task

| Task | What | Status |
|---|---|---|
| 1-3 | `better-sqlite3` schema (entities/tasks/spaces) + `flowrDB` IPC bridge | Done, verified with a direct Node smoketest against real SQLite |
| 4 | `lastModified` added to `AppTask`/`Space` (Supabase + local) | Done — found & fixed 3 space mutation sites that weren't bumping `lastModified` before pushing |
| 5 | Fixed `mergeCloudData`'s task/space merge to use real LWW instead of the old cloud-wins-on-load logic | Done |
| 6 | Debounce the ~20 (not ~13 as originally estimated) Supabase push call sites | Done — added an integration test proving the debounce works *and* that the pull path never re-triggers a push |
| 7-8 | Desktop write-through subscriber: entities/tasks/spaces → SQLite on edit | Done — found & removed a dead import Gemini's own typecheck missed |
| 9 | Boot-time SQLite hydration, sequenced before the Supabase merge | Done — found and fixed a real data-loss bug during implementation (see below) |
| 10 | One-time legacy importer (localStorage → SQLite) | Done |
| 11 | Downgrade grace-period banner | Done |
| 12 | Instant `local-only` lock on subscription expiry | **Partially done** — the lock function is correct but nothing in the app currently tracks the user's own subscription tier client-side, so it's never called. Dead code until that's built. |
| 13 | 5MB attachment upload cap | **Partially done** — cap logic is correct and tested, but there's no attachment-upload feature in the codebase yet to enforce it against. |
| 14 | Remove the old Markdown file-vault write path | Done — found & fixed a broken build: a file-watcher for externally-edited `.md` files still depended on the function that got deleted |

## Bugs found during verification (not present in the original written plan)

1. **Cloud-only entities could vanish on boot.** The old localStorage backup still pre-loads entities (including `cloud-only` ones) before SQLite hydration runs. Since hydration does a full replace, and SQLite was originally built to *exclude* `cloud-only` items, a slow/offline Supabase load at just the wrong moment would have wiped them from view. Fixed by making SQLite mirror every sync mode consistently (confirmed with you — no need to remove the `cloud-only` mode itself, just stop excluding it from the local mirror).

2. **Task 14 broke the build.** Deleting `saveEntityToFile` missed one remaining legitimate caller (the file-watcher for manually-edited vault files). Restored a trimmed version scoped to just that use.

3. **Push-echo invariant.** Verified end-to-end (with a real test, not just reasoning about it) that pulling remote changes never re-triggers a push back to Supabase — this was the specific failure mode the original design review was most worried about.

## What's genuinely not done

- Tasks 12 and 13 need real product surfaces (client-side subscription-tier tracking, an actual attachment-upload feature) before their logic does anything. Worth a follow-up spec.
- Per-block sync granularity, CRDT merging, dynamic storage-cap detection — all explicitly out of scope per the original spec.

## Verification

258 tests passing, `tsc --noEmit` clean, as of the last commit (`e04aa4d`). Full commit list:

```
18839d9 fix(sync): set lastModified on all remaining space mutations
1020c16 feat(sync): debounce per-entity Supabase push by 1.5s at existing call sites
9857c4c feat(db): write entities, tasks, and spaces through to SQLite on desktop
2a17f2e chore(db): verify Tasks 7-8, remove dead saveEntityToFile import, add subscriber tests
0e1f1b1 feat(db): load and merge local SQLite data on app boot
be77cf5 feat(db,billing): Tasks 10-14 - legacy import, downgrade banner/lock, attachment cap, file-vault cleanup
```
