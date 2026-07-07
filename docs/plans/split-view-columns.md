# Split-View Columns from Header Tabs

## Context

Replace the old `type: 'mixed'` entity approach with a universal split-view feature driven by the tab strip. When more than one tab is open, the header shows a Columns2 toggle button that splits the main content area into two independent, resizable columns — each showing a different tab's content. This eliminates the need for mixed pages entirely.

### User requirements
1. **Toggle button**: `Columns2` icon on the right side of the header bar — visible only when `openTabIds.length > 1`
2. **Two columns**: splits the main content area horizontally into two independently scrollable panes
3. **No duplicate tabs**: each open tab can only appear in one column at a time
4. **Tab drag between columns**: drag a tab from one column group to the other in the header strip to reassign it
5. **Desktop dual-window**: in the Electron build, show each column as a separate native OS window (Phase 2)
6. **Resizable divider**: drag the vertical divider between columns; same resize pattern as the sidebar
7. **Collapse on threshold**: when a column width drops below ~180px, collapse it and return to single-column layout, merging all tabs back

### What this replaces
- `MixedPage.tsx` (entity type `'mixed'`) — a hardcoded note+canvas split. After this feature lands, mixed pages can be migrated to split-view tabs.
- The store field `mixedLayoutSplit` can be repurposed as `splitViewPosition`.

---

## Implementation Plan

### Step 1: Store State & Actions (`store.types.ts` + `store.ts`)

**New state fields** (add to `AppState` interface):
```ts
isSplitView: boolean;            // whether split view is active (default: false)
splitViewLeftId: string | null;  // entity ID in left column (default: null)
splitViewRightId: string | null; // entity ID in right column (default: null)
splitViewPosition: number;       // divider position in % (0-100, default: 50)
```

**New actions** (add to `AppState` interface + implement in store):
```ts
toggleSplitView: () => void;
assignTabToColumn: (tabId: string, column: 'left' | 'right') => void;
setSplitViewPosition: (pos: number) => void;
```

**`toggleSplitView()` implementation logic:**
- If turning **on**:
  - `isSplitView = true`
  - `splitViewLeftId = activeTabId` (the currently active tab → left column)
  - `splitViewRightId = first id in openTabIds that differs from activeTabId`
  - `splitViewPosition = 50`
- If turning **off**:
  - `isSplitView = false`
  - `splitViewLeftId = splitViewRightId = null`
  - The entity that was in the focused/left column remains `activeEntityId`

**`assignTabToColumn(tabId, column)`:**
- Updates `splitViewLeftId` or `splitViewRightId` to `tabId`
- If the tab was already in the other column, swaps the two column assignments

**`setSplitViewPosition(pos)`:**
- Clamps to MIN_COLUMN_PCT and MAX_COLUMN_PCT
- If `pos` would make a column narrower than COLLAPSE_THRESHOLD_PX (computed from container width), call `toggleSplitView()` to exit split mode

**Persistence:** Add `isSplitView` and `splitViewPosition` to Zustand `partialize` for localStorage. Column IDs are session-only (don't survive reload — on reload, re-initialize from openTabIds).

---

### Step 2: SplitViewLayout Component (new file)

**File:** `src/components/layout/SplitViewLayout.tsx`

A client component that renders two content columns side by side with a draggable divider.

```tsx
interface SplitViewLayoutProps {
  leftEntityId: string;
  rightEntityId: string;
  splitPosition: number;
  onPositionChange: (pos: number) => void;
}
```

**Implementation:**
- Renders two `<div>` columns using `flex` layout
- Left column: `width: ${splitPosition}%`, `overflow-y: auto`
- Right column: `flex-1` (takes remaining space), `overflow-y: auto`
- Divider: an 8px-wide vertical strip with a centered 1px line, positioned between the two columns
- Each column renders page content by replicating WorkspaceRouter's `renderContent()` logic but with an explicit entity ID instead of reading `activeEntityId` from the store:

```
// SplitViewLayout internally:
const entity = entities.find(e => e.id === columnEntityId);
switch (entity?.type) {
  case 'note':   return <NotePage entity={entity} />;
  case 'canvas': return <CanvasPage entity={entity} />;
  // ... same for other types + special IDs (dashboard, tracker, chat, settings)
}
```

- Extract this render logic into a shared helper `renderEntityPage(entityId, entities)` that both `WorkspaceRouter` and `SplitViewLayout` can call. Place it in a new file `src/components/EntityPageRenderer.tsx` or inline in `src/lib/render-entity.tsx`.

**Resize logic** (mirrors Shell.tsx sidebar pattern):
- `useRef` for `isResizingRef` and `rafRef`
- `onMouseDown` on divider: sets ref, `body.cursor = 'col-resize'`, `body.userSelect = 'none'`
- `onMouseMove` (window listener): `requestAnimationFrame` → compute percentage from `e.clientX` relative to container
- `onMouseUp`/`onMouseLeave`: cleanup refs, restore cursor. **On mouseup, check collapse**: if either column < 180px, call `useStore.getState().toggleSplitView()` to exit split mode
- Divider visual: same pattern as sidebar — `w-2 cursor-col-resize`, hidden on mobile, 1px center line that appears on hover/active
- Transition: `transition: none` during active resize; otherwise no animation needed (instant column resize feels responsive)

**Boundary clamping:**
- `MIN_COLUMN_WIDTH = 180` (px, computed to percentage at runtime)
- On mousemove: clamp percentage so neither column drops below threshold
- On mouseup: if final position is at threshold boundary, collapse

---

### Step 3: WorkspaceRouter Refactor

**File:** `src/components/WorkspaceRouter.tsx`

Extract the `renderContent()` switch/case into a standalone function:
```ts
// src/lib/render-entity.tsx (new file)
export function EntityPage({ entityId }: { entityId: string }) {
  const entities = useStore(s => s.entities);
  // ... same renderContent logic, but takes explicit entityId
}
```

**WorkspaceRouter** becomes a thin wrapper:
```tsx
export function WorkspaceRouter({ initialEntityId }: { initialEntityId?: string }) {
  const activeEntityId = useStore(s => s.activeEntityId);
  return <EntityPage entityId={activeEntityId ?? 'dashboard'} />;
}
```

This lets `SplitViewLayout` render:
```tsx
<EntityPage entityId={leftEntityId} />
<EntityPage entityId={rightEntityId} />
```

---

### Step 4: HeaderBar Changes

**File:** `src/components/layout/HeaderBar.tsx`

**4a. Split toggle button**
- Import `Columns2` from lucide-react
- Add a button between the last tab and the `+` button (or after the `+` button, in the right-side controls area)
- Visible only when `openTabIds.length > 1`
- Active state: `isSplitView ? "opacity-100 bg-[var(--bone-6)]" : "opacity-50 hover:opacity-100 hover:bg-[var(--bone-6)]"`
- `onClick`: calls `toggleSplitView()` from the store

**4b. Column-group visual separation (split mode only)**
When `isSplitView` is true, the tab strip gets a visual divider between the left-column tabs and right-column tabs:

```
[Nav ◀▶↻] [Tab A] [Tab B]  │  [Tab C] [Tab D]  [+]  [⏸]
           └── Left col ──┘    └── Right col ──┘
```

Implementation:
- Between the tabs belonging to left vs right column, render a 1px vertical separator (`w-[1px] h-5 bg-[var(--bone-12)] self-center`)
- Determine which column a tab belongs to: `tabId === splitViewLeftId` → left; `tabId === splitViewRightId` → right; other tabs default to... left column? Or they appear after all assigned tabs.

**Simplification for MVP**: In split mode, each column shows exactly ONE entity at a time. The left column group = `[splitViewLeftId]`, the right column group = `[splitViewRightId]`. Other open tabs appear in a third "unassigned" section. Clicking an unassigned tab assigns it to the currently focused column.

Actually, even simpler: just partition `openTabIds` into left-assigned and right-assigned. The divider sits between the two groups. Adding "unassigned" adds complexity. For MVP, assign `activeTabId` to left and the next tab to right, and the rest are "unassigned" (shown after both groups, greyed out). Clicking one assigns it to the last-clicked column.

**Final simplified approach:**
- `splitViewLeftId` and `splitViewRightId` each map to exactly one tab
- The two assigned tabs get a colored dot indicator (left = blue dot, right = green dot, or similar)
- All other open tabs appear after the assigned ones, visually neutral
- Clicking any tab makes it the active for its assigned column (or assigns it to the column whose group it was clicked in)
- The visual divider sits between the two assigned tab groups

**4c. Drag between columns**
- When split view is active and a drag starts on a tab:
  - Track which column the dragged tab belongs to
  - On `mouseup`, detect which column group the cursor released over
  - If released over the other column's group, update `splitViewLeftId`/`splitViewRightId` via `assignTabToColumn()`
  - If released over the unassigned area, keep current assignment
- Visual feedback during drag: show a colored drop indicator at the target column group boundary

For the MVP, drag-between-columns can be simplified: dragging a tab from left group to right group (across the visual divider) triggers `assignTabToColumn` on drop. Implement by checking `e.clientX` relative to the column divider position in the tab strip.

---

### Step 5: Shell.tsx Integration

**File:** `src/components/layout/Shell.tsx`

**Changes to main content area (lines ~399-410):**

Replace the static `{children}` render with a split-aware render:

```tsx
{isSplitView && splitViewLeftId && splitViewRightId ? (
  <SplitViewLayout
    leftEntityId={splitViewLeftId}
    rightEntityId={splitViewRightId}
    splitPosition={splitViewPosition}
    onPositionChange={setSplitViewPosition}
  />
) : (
  children  // normal single-page WorkspaceRouter
)}
```

Add store subscriptions:
```tsx
const isSplitView = useStore(s => s.isSplitView);
const splitViewLeftId = useStore(s => s.splitViewLeftId);
const splitViewRightId = useStore(s => s.splitViewRightId);
const splitViewPosition = useStore(s => s.splitViewPosition);
const setSplitViewPosition = useStore(s => s.setSplitViewPosition);
```

**Note on header border/concave corners**: In split mode, both columns' header areas should connect visually to their content. Since both columns share the same header bar, the active tab's concave corner bridges connect to the respective column's top edge. This works naturally if both columns have `bg-[var(--app-background)]`.

---

### Step 6: Collapse Behavior Details

**In SplitViewLayout:**
- Track container width via `ResizeObserver` or `containerRef.current.getBoundingClientRect().width`
- `COLLAPSE_THRESHOLD_PX = 180`
- On mousemove: clamp position so neither column < 180px
- On mouseup: if final position would make a column < 180px, call `toggleSplitView()` to exit

**When exiting split view due to collapse:**
- The remaining (larger) column's entity becomes `activeEntityId`
- The collapsed column's entity stays in `openTabIds` but loses column assignment
- `isSplitView = false`

**When split view is toggled off manually:**
- Left column entity becomes active
- Right column entity stays in `openTabIds`
- `isSplitView = false`

---

### Step 7: Desktop Dual-Window (Phase 2 — document only)

**Approach for Electron:**
1. Add IPC handlers in `electron/main.js`:
   - `split-view:open` — creates a second `BrowserWindow` positioned to the right of the main window
   - `split-view:close` — closes the second window
   - `split-view:set-entity` — tells the second window which entity to display
2. In `electron/preload.js`, expose `flowrSplitView` API:
   - `open(entityId)` — opens second window showing entity
   - `close()` — closes second window
   - `onEntityChanged(callback)` — listen for entity changes from other window
3. In the React app:
   - When `isSplitView && isDesktop()`: call `window.flowrSplitView.open(splitViewRightId)`
   - The second window loads the same URL with a query param `?split-column=right`
   - On page load, if `?split-column=right`, render only the right column's content (no sidebar, no header tabs — just the entity page)
   - Entity changes sync via IPC
4. Window management:
   - Position second window at `mainWindow.getBounds().x + mainWindow.getBounds().width, mainWindow.getBounds().y`
   - Same height as main window
   - When second window closes → set `isSplitView = false` in main window

This is deferred to a follow-up PR. The web-column implementation is the priority.

---

### Step 8: Cleanup Old Mixed Pages

Once split-view columns are working, remove all traces of the old `'mixed'` entity type and `MixedPage` component. The split-view feature replaces this entirely.

**8a. Delete MixedPage component**
- Delete `src/components/editor/MixedPage.tsx`

**8b. Remove `'mixed'` from EntityType** (`store.types.ts:7`)
```ts
// Before:
export type EntityType = 'collection' | 'folder' | 'note' | 'canvas' | 'mixed' | 'workspace' | 'divider' | 'task';
// After:
export type EntityType = 'collection' | 'folder' | 'note' | 'canvas' | 'workspace' | 'divider' | 'task';
```

**8c. Remove `mixedLayoutSplit`** from store (replaced by `splitViewPosition`):
- `store.types.ts:424` — delete field
- `store.ts:250` — delete default value
- `store.ts:357` — delete setter
- `store.ts:2539` — remove from persistence partialize

**8d. Remove MixedPage from WorkspaceRouter** (`src/components/WorkspaceRouter.tsx`):
- Remove `import { MixedPage } from './editor/MixedPage';`
- Remove `case 'mixed': return <MixedPage entity={activeEntity} />;`

**8e. Remove mixed seed entity** (`store.ts:137`):
- Delete the seed entity `{ id: 'm1', title: 'Mixed 1', type: 'mixed', ... }`

**8f. Update `type === 'mixed'` icon fallbacks** (replace with default `FileText` icon):
- `HeaderBar.tsx:299`: `entity.type === 'mixed' ? Layers :` → remove
- `HeaderBar.tsx:561`: `ent?.type === 'mixed' ? I = Layers :` → remove
- `TreeItem.tsx:956`: delete `case 'mixed':` branch
- `Sidebar.tsx:668`: delete `case 'mixed':` branch
- `FolderView.tsx:75`: delete `case 'mixed':` branch
- `CommandPalette.tsx:494`: delete `case 'mixed':` branch
- `AllFilesWidget.tsx:44`: remove `if (entity.type === 'mixed') return Layers;`
- `RecentWidget.tsx:163`: remove `if (entity.type === 'mixed') return Layers;`
- `ShortcutsWidget.tsx:235`: remove `if (e.type === 'mixed') return Layers;`
- `ShortcutsWidget.tsx:379`: remove `else if (ent.type === 'mixed') { ... }`

**8g. Update entity type guards** — change `type === 'note' || type === 'canvas' || type === 'mixed'` to just `type === 'note' || type === 'canvas'`:
- `TreeItem.tsx:393`
- `Sidebar.tsx:254`
- `Sidebar.tsx:359`
- `store.ts:2573`
- `ChatMessage.tsx:853`: `isNoteActive = activeNote?.type === 'note' || activeNote?.type === 'mixed'` → remove mixed
- `AIAssistant.tsx:577`: `entity.type === 'note' || entity.type === 'mixed'` → remove mixed

**8h. Remove "Create Split Page" commands**:
- `CommandPalette.tsx:133,138`: delete the `{ id: 'split', ... }` option entry
- `AIAssistant.tsx:523`: delete the `{ id: 'split', label: 'Create Split Page', ... }` quick action entry

**8i. Migration for existing mixed entities**:
Add a one-time migration in the store's hydration/persistence layer that converts any entity with `type: 'mixed'` to `type: 'note'` (preserving all content and metadata). This ensures existing user data isn't lost. Run on app initialization, after Zustand hydration completes.

```ts
// In store.ts, after hydration:
entities.forEach(e => {
  if (e.type === 'mixed') e.type = 'note';
});
```

**8j. Remove `Layers` icon imports** where they were only used for mixed pages (check each file — some may still need `Layers` for other purposes like collections).

---

## Files to Create
| File | Purpose |
|---|---|
| `src/components/layout/SplitViewLayout.tsx` | Two-column layout with resizable divider |
| `src/components/EntityPageRenderer.tsx` | Shared entity-to-page-component render logic (extracted from WorkspaceRouter) |

## Files to Modify
| File | Changes |
|---|---|
| `src/data/store.types.ts` | Add `isSplitView`, `splitViewLeftId`, `splitViewRightId`, `splitViewPosition` + actions |
| `src/data/store.ts` | Implement new actions, add defaults, add to persist partialize |
| `src/components/layout/HeaderBar.tsx` | Add Columns2 toggle button, column-group visual separation, drag-between-columns |
| `src/components/layout/Shell.tsx` | Conditionally render SplitViewLayout vs single children |
| `src/components/WorkspaceRouter.tsx` | Extract render logic into shared EntityPageRenderer |

## Files to Delete
| File | Reason |
|---|---|
| `src/components/editor/MixedPage.tsx` | Replaced by split-view columns |
| `src/data/store.types.ts` `mixedLayoutSplit` field | Replaced by `splitViewPosition` |
| `src/data/store.types.ts` `'mixed'` entity type | Removed from type union |

## Files Touched in Cleanup (Step 8)
| File | Change |
|---|---|
| `src/data/store.types.ts` | Remove `'mixed'` type, remove `mixedLayoutSplit` field, remove `setMixedLayoutSplit` action |
| `src/data/store.ts` | Remove mixed seed entity, remove `mixedLayoutSplit` default/setter/partialize, add migration |
| `src/components/WorkspaceRouter.tsx` | Remove MixedPage import and case |
| `src/components/layout/HeaderBar.tsx` | Remove `entity.type === 'mixed'` icon fallbacks |
| `src/components/layout/Sidebar.tsx` | Remove mixed type checks |
| `src/components/layout/TreeItem.tsx` | Remove mixed case/checks |
| `src/components/layout/CommandPalette.tsx` | Remove "Create Split Page" command + icon case |
| `src/components/layout/FolderView.tsx` | Remove mixed icon case |
| `src/components/workspace/widgets/AllFilesWidget.tsx` | Remove mixed icon check |
| `src/components/workspace/widgets/RecentWidget.tsx` | Remove mixed icon check |
| `src/components/workspace/widgets/ShortcutsWidget.tsx` | Remove mixed icon/entity checks |
| `src/components/assistant/AIAssistant.tsx` | Remove "Create Split Page" action + mixed type check |
| `src/components/assistant/components/ChatMessage.tsx` | Remove mixed from isNoteActive |

---

## Verification

1. **Basic flow**: Open 3+ tabs → click Columns2 button → main area splits into two columns showing different tabs
2. **No duplicate**: Verify left and right columns show different content, never the same entity
3. **Resize**: Drag the divider — columns resize smoothly, no flicker
4. **Collapse**: Drag a column to <180px → it collapses, returns to single-column layout
5. **Tab assignment**: In split mode, click a tab → it becomes the active for its column group
6. **Drag between columns**: Drag a tab from left group to right group → entity appears in right column
7. **Toggle off**: Click Columns2 again → back to single-column, entity in left column remains active
8. **Persistence**: Reload the page — split position is restored, isSplitView is restored
9. **Mobile**: Split view is disabled on mobile (or columns stack vertically with a horizontal divider)
10. **No regressions**: Single-column mode works exactly as before; tab drag-to-reorder still works
11. **TypeScript**: `npx tsc --noEmit` passes clean
12. **Cleanup**: No references to `'mixed'` entity type remain in the codebase (`rg "type.*mixed" --type ts` returns only `mixedLayoutSplit` which is already removed)
13. **Cleanup**: No `MixedPage` import remains; `MixedPage.tsx` file deleted
14. **Cleanup**: Existing mixed-type entities in localStorage are auto-migrated to `note` type on load
15. **Cleanup**: No "Create Split Page" option in CommandPalette or AIAssistant
16. **Cleanup**: Sidebar still shows all existing entities (formerly-mixed entities now appear as notes)
