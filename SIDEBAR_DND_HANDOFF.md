# Sidebar Drag-and-Drop — Session Handoff

Context for picking this back up. Covers `src/components/layout/TreeItem.tsx`
and `src/components/layout/Sidebar.tsx`.

## Done and committed this session

- `6c72fbc` — insert-line color/position bugs: line inherited drag-opacity,
  anchored to the wrong box for expanded subtrees, drifted 1px between rows,
  and the folder-exit seam double-rendered from two components. Also fixed
  `getRedirectedTarget`'s "nest into folder" redirect wrongly firing across
  workspaces when the previous sibling's own last child wasn't itself an
  expanded folder.
- `343b967` — dragging a folder/workspace now dims its expanded children too,
  not just its own row.
- `3b27a9b` — dropping into the blank space below the last workspace now
  shows a line and drops correctly (into the last workspace's root for
  regular items, after it at depth 0 for another workspace). Also fixed:
  workspace-type drags were falling into a horizontal depth-picking zone
  meant for regular items, causing wrong reorder targets; and the 1px
  trailing gap after an expanded folder's last child (regressed back to 2px
  earlier in the session).
- `869b858` — top-level Unsorted-section items showed the insert line one
  depth too deep (a redirect meant only for workspaces was matching any
  depth-0 target).

## Known remaining issue (not fixed, cosmetic only)

**Dead zone in a note's hitbox when adjacent to a folder boundary.**

- Spec (confirmed already correct in code): notes use a 50/50 top/bottom
  split for the insert-line edge (`TreeItem.tsx` ~line 633); folders and
  workspaces use 30% top / 40% middle-nest / 30% bottom (~line 621-631,
  `canInsertIn` branch).
- Symptom: hovering the center of a note that sits directly above or below
  an expanded folder shows no insert line, even though the 50/50 edge math
  never produces `null` for a note. Notes with plain notes as neighbors
  (e.g. multiple notes in Unsorted) don't have this problem.
- Confirmed via testing: **the drop itself works correctly** even in the
  dead zone — this is a rendering/hit-testing issue only, not a logic bug.
- Working theory (not yet verified): the neighboring folder's
  `AfterFolderSpacer` hit-target (`h-5 -top-2`, i.e. it reaches 8px above and
  12px below its own zero-height anchor point) overlaps into the note's own
  row hitbox, "winning" the pointer hit-test in that overlap band so the
  note's own `dropTargetForElements` never fires `onDragEnter` there. If
  true, the fix is to shrink the spacer's hit-target or change how
  overlapping targets are prioritized — but this touches the same
  hit-testing machinery responsible for several of the bugs fixed above, so
  budget for a few iterations and re-verify each committed fix doesn't
  regress.
- Suggested approach next time: instrument `isOver` on both the note's own
  drop target and the neighboring `AfterFolderSpacer` simultaneously across
  a slow cursor sweep (top to bottom of the note), to see whether there's a
  band where the spacer reports `isOver=true` while the note's own does not.
  That will confirm or rule out the hitbox-overlap theory before changing
  anything.

## General notes for whoever picks this up

- This codebase's DnD hit-testing is unusually fiddly: several fixes this
  session required literal pixel-rect measurements (via a temporary
  `console.log` + `getBoundingClientRect()` in the relevant render, since
  static code reading repeatedly produced wrong theories). Don't trust
  source-reading alone for anything involving `AfterFolderSpacer`'s
  positioning or hit-target overlap — verify empirically.
- There are two conceptually separate "redirect" implementations that must
  be kept in sync: `getRedirectedTarget` in `TreeItem.tsx` (drives the
  visual insert-line) and a near-duplicate block inline in `Sidebar.tsx`'s
  `onDrop` handler (drives the actual reorder). Changing one without the
  other has caused "line shows one thing, drop does another" bugs twice
  this session.
