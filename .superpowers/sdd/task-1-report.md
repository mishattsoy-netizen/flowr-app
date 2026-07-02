# Task 1 Report: Purge legacy — comments, connection type, legacy endpoints, auto-layout

## What was implemented

### Step 1 — Remove types (`src/data/store.types.ts`)
- Removed `'comment'` and `'connection'` from `BlockType`.
- Removed from `EditorBlock`: `fromId`, `toId`, `fromSide`, `toSide`, `autoLayout`, `layoutDirection`, `layoutGap`, `layoutPaddingTop/Right/Bottom/Left`, `layoutAlign`, `layoutCrossAlign`, `frameResizingH/V`, `childResizingH/V`. Kept `clipContent` per the brief (Task 8 will make clipping unconditional).
- Removed `FrameLayoutDirection`, `FrameResizeMode`, `ChildResizeMode` type exports.
- Removed `fixedPointType` from `ArrowBinding`.
- Removed the 8 auto-layout action signatures (`setFrameAutoLayout`, `setFrameLayoutDirection`, `setFrameLayoutGap`, `setFramePadding`, `setFrameAlignment`, `setFrameResizing`, `setChildResizing`) from `AppState` — kept `setFrameClipContent`. **This goes beyond the brief's literal "Step 1" list** (see Cascades below) but was necessary: these actions' signatures reference the now-deleted `FrameLayoutDirection`/`FrameResizeMode`/`ChildResizeMode` types and cannot compile otherwise.

### Step 2 — Chase compile errors, delete dead code
Deleted the legacy branches exactly as the brief specified in every file it named:
- `CanvasBlock.tsx`: removed the `block.type === 'comment'` render branch, removed `'comment'` from the double-click gate and `isNoteBlock` check, removed dead `block.type !== 'connection'` conditions (always-true after `'connection'` was removed from `BlockType`).
- `CanvasToolbar.tsx`: removed `comment` from `CONTENT_TOOLS` and `CanvasTool`, removed unused `MessageSquarePlus` import, renamed the `frame` tool's `label` from `'Frame'` to `'Section'` (shortcut `F` and `Frame` icon unchanged).
- `CanvasPage.tsx`: removed `'comment'` tool creation-on-click handling and the `C` keyboard shortcut, removed `type: 'connection'` filter paths, changed the arrow filter to `!(b.startBinding || b.endBinding)`, removed the `computeAutoLayout` import and the entire auto-layout recompute block in `handleDragCommit`, removed a stray `autoLayout: false, layoutDirection: 'freeform'` object literal from frame creation.
- `CanvasConnections.tsx`: filter now reads `b.type === 'shape' && (b.shapeKind === 'arrow' || b.shapeKind === 'line') && (b.startBinding || b.endBinding)`.
- `resolvePoints.ts`: deleted `legacyEndpoint()` and the two `fromId`/`toId` fallback lines.
- `VectorPath.tsx`: `hasStart` simplified to `!!block.startBinding`.
- `useCanvasMultiSelect.ts`, `useCanvasSnap.ts` (6 occurrences), `Dashboard.tsx`, `WorkspacePage.tsx`, `CanvasLayersPanel.tsx`: removed dead `b.type === 'connection'` comparisons surfaced by tsc.
- `frontmatter.ts`, `markdownBlocks.ts`: removed `'comment'`/`'connection'` from block-type checks/sets surfaced by tsc.
- `store.ts`: removed the `'connection'`-migration branch inside `migrateBlock()` (kept the `'section'→'frame'` and shape-editMode migrations, which are unrelated); removed the `computeAutoLayout` import and all 8 auto-layout action implementations (kept `setFrameClipContent`).
- `store.setSyncMode.test.ts`, `store.moveEntity.test.ts`, `store.addEntity.test.ts`: removed the now-stale `vi.mock('@/lib/frameLayout', () => ({ computeAutoLayout: vi.fn() }))` mocks (store.ts no longer imports `frameLayout`).

`canvasSync.ts` and `Sidebar.tsx` required no changes — grep confirmed no references to any removed field.

### Cascades beyond the brief's literal file list (flagged per "Discipline" instructions)
1. **`src/lib/frameLayout.ts` was not a pure auto-layout module** as the brief assumed ("Delete if present: auto-layout module"). It also exports `computeGroupBounds` and `computeGroupSpacing`, which are generic geometry helpers used by `groupUtils.ts` and the group-selection UI in `CanvasStylePanel.tsx` — unrelated to frame auto-layout. Deleted only `computeAutoLayout`, its internal helpers (`layoutHorizontal`, `layoutVertical`, `layoutGrid`, `applyCrossAlign`), and the `AutoLayoutResult` type. Kept `computeGroupBounds` and `computeGroupSpacing` and the file itself.
2. **`src/components/canvas/CanvasStylePanel.tsx`** (not in the brief's file list) had ~430 lines of frame auto-layout UI (Frame/Auto-Layout panel toggle, direction picker, resizing dropdowns, alignment picker, padding control, child-resize panel) all wired to the 8 deleted store actions and deleted `EditorBlock` fields. Collapsed the two-state Frame/Auto-Layout panel into a single plain "Frame" panel (W/H, uniform-gap display, Clip content toggle); removed the `isChildOfAutoLayoutFrame` panel entirely; removed now-dead analysis variables (`isChildOfAutoLayoutFrame`, `parentFrame`, `showFrameLayout`); removed now-unused local sub-components (`FlowDirectionPicker`, `AlignmentPicker`, `ResizeModeDropdown`, `PaddingControl`, `SVG_ICONS`, `RESIZE_OPTIONS`, `CHILD_RESIZE_OPTIONS`). Kept the group-selection Layout panel (uses only `computeGroupBounds`/`computeGroupSpacing`, unaffected).
3. **8 auto-layout store actions** (`setFrameAutoLayout`, `setFrameLayoutDirection`, `setFrameLayoutGap`, `setFramePadding`, `setFrameAlignment`, `setFrameResizing`, `setChildResizing`, and their `AppState` signatures) were deleted from `store.ts`/`store.types.ts`, contrary to a literal reading of "(remove references; keep actions)" in the brief's file list. These action bodies were 100% auto-layout logic (compute-and-persist via `computeAutoLayout`) and their signatures named the deleted `FrameLayoutDirection`/`FrameResizeMode`/`ChildResizeMode` types — they cannot exist without the types the brief explicitly removes. `setFrameClipContent` was kept (untouched by auto-layout, needed for the `clipContent` field the brief explicitly retains).

### Not touched (confirmed out of scope, left as pre-existing)
- `src/components/canvas/LayersPanel.tsx` — an unused/dead component (not imported anywhere, superseded by `CanvasLayersPanel.tsx`) still has `case 'comment'`/`case 'connection'` in an untyped `getIcon(type: string)` switch. Compiles fine (string, not `BlockType`); pre-existing dead code unrelated to this task.
- `src/hooks/useDrag.ts` and a resize handler in `src/components/canvas/CanvasBlock.tsx` read DOM attributes named `data-from-id`/`data-to-id`/`data-from-side`/`data-to-side` into locals named `fromId`/`toId`/`fromSide`/`toSide`. Verified these DOM attributes are never set anywhere (only `data-start-binding`/`data-end-binding` are set, by `VectorPath.tsx`) — so these branches are already dead/no-ops, but they are local variable names reading arbitrary DOM attributes, not usages of the deleted `EditorBlock.fromId/toId/fromSide/toSide` fields, and they compile cleanly. Left alone as out-of-scope live-drag rendering logic (not part of comment/connection/legacy-endpoint/auto-layout per the brief).
- `src/components/layout/Sidebar.tsx` — `fromIdx`/`toIdx` variables are unrelated sidebar drag-reorder indices, not canvas arrow endpoints.
- `src/components/assistant/components/ChatMessage.tsx` — `item.type === 'connection'` checks on an AI-tool-call payload (untyped `any`/loose object), not `EditorBlock`. Compiles fine, no change needed.

## Verification
- `npx tsc --noEmit` → **0 errors** (confirmed after each round of fixes and at the end).
- `npm test` → **144 tests passed (14 test files)**.
- `npm run build` → production build succeeded.
- Grep checks from the brief:
  - `grep -rn "computeAutoLayout" src` → no hits.
  - `grep -rn "fixedPointType" src` → no hits.
  - `grep -rn "'comment'" src/components/canvas src/data src/lib` → only the dead/unused `LayersPanel.tsx` (see above).
  - `grep -rln "fromSide\|toSide" src` → only `CanvasBlock.tsx` and `useDrag.ts`, both confirmed to be unrelated DOM-attribute-name reuse in dead branches (see above), not the deleted `EditorBlock` fields.

## Files changed
- `src/data/store.types.ts`
- `src/data/store.ts`
- `src/lib/frameLayout.ts` (partial — kept `computeGroupBounds`/`computeGroupSpacing`)
- `src/lib/geometry/resolvePoints.ts`
- `src/components/canvas/CanvasBlock.tsx`
- `src/components/canvas/CanvasPage.tsx`
- `src/components/canvas/CanvasToolbar.tsx`
- `src/components/canvas/CanvasConnections.tsx`
- `src/components/canvas/CanvasStylePanel.tsx`
- `src/components/canvas/CanvasLayersPanel.tsx`
- `src/components/canvas/edges/VectorPath.tsx`
- `src/components/dashboard/Dashboard.tsx`
- `src/components/workspace/WorkspacePage.tsx`
- `src/hooks/useCanvasMultiSelect.ts`
- `src/hooks/useCanvasSnap.ts`
- `src/lib/editor/frontmatter.ts`
- `src/lib/editor/markdownBlocks.ts`
- `src/data/store.setSyncMode.test.ts`
- `src/data/store.moveEntity.test.ts`
- `src/data/store.addEntity.test.ts`

Net: 20 files changed, 34 insertions(+), 1104 deletions(-).

## Self-review findings
- Every field/type in the brief's Step 1 list confirmed removed via grep.
- Every file-specific instruction in Step 2 followed verbatim where the brief gave an exact diff (e.g. the `!(b.startBinding || b.endBinding || b.fromId || b.toId)` → `!(b.startBinding || b.endBinding)` change, and the `VectorPath.tsx` `hasStart` line).
- No stubs left behind — every legacy branch was deleted outright, not commented out or no-op'd.
- Consulted the advisor before starting substantive edits because of the "keep actions" vs. Step 1 type-deletion tension and the discovery that `frameLayout.ts` wasn't pure auto-layout; both were resolved per its guidance and are documented above as cascades.
- Did not restructure/split any files; only deleted and made the minimal edits required to keep the remainder compiling.

## Concerns
None blocking. The three cascades beyond the brief's literal file list (frameLayout.ts partial delete, CanvasStylePanel.tsx auto-layout UI removal, 8 store actions removed) are a direct, unavoidable consequence of Step 1's type deletions — flagged per the task instructions rather than treated as a reason to stop.
