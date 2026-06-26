# DnD Sidebar & Notes Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate drag stutter in the **notes editor** (block reordering) and the **left sidebar** (page/folder tree) by migrating them off `@dnd-kit` onto `@atlaskit/pragmatic-drag-and-drop` (pragmatic-dnd) — the same library the tracker already uses smoothly.

**Architecture:** Avoid React context-driven updates during dragging. Each list item independently registers its own DOM node as a draggable element and drop target using pragmatic-dnd's hooks inside `useEffect` with empty dependency arrays (reading props from refs to avoid closure stale state). The main wrapper lists (Sidebar and NoteEditor) monitor all drag events and dispatch reorder/nest actions only at the completion of a drop.

**Tech Stack:** `@atlaskit/pragmatic-drag-and-drop`, `@atlaskit/pragmatic-drag-and-drop-hitbox`, React 19, Tailwind CSS.

---

### Task 1: Clean Up TreeItem Imports and Remove Sortable Context

**Files:**
- Modify: `src/components/layout/TreeItem.tsx:1-26`

**Step 1: Write the failing test**

We don't have a specific UI unit test suite for TreeItem, but we can verify the build fails when dnd-kit packages are deleted. 

**Step 2: Run test to verify it fails**

Run: `npm run build`
Expected: Passes (currently imports exist).

**Step 3: Write minimal implementation**

Modify `src/components/layout/TreeItem.tsx` imports. Remove `@dnd-kit` imports and add pragmatic-dnd imports:

```diff
-import { useSortable } from '@dnd-kit/sortable';
-import { useDndContext } from '@dnd-kit/core';
-import { CSS } from '@dnd-kit/utilities';
+import { draggable, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
+import { attachClosestEdge, type Edge, extractClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
+import { disableNativeDragPreview } from '@atlaskit/pragmatic-drag-and-drop/element/disable-native-drag-preview';
```

**Step 4: Run test to verify it passes**

Run: `npm run build` (or check compilation/linting in Next.js).
Expected: Fails with "sortable not defined" (as we removed dnd-kit usage but haven't implemented pragmatic-dnd yet. This is expected at this step).

**Step 5: Commit**

```bash
git add src/components/layout/TreeItem.tsx
git commit -m "refactor(sidebar): clean up imports for TreeItem migration"
```

---

### Task 2: Implement Draggable Behavior on TreeItem

**Files:**
- Modify: `src/components/layout/TreeItem.tsx`

**Step 1: Write the failing test**

Verify that `TreeItem` registers as a draggable element when rendered.

**Step 2: Run test to verify it fails**

Run: Verify in browser that dragging sidebar items shows native selection instead of drag indicator.

**Step 3: Write minimal implementation**

Set up a `ref` on the outer `div` of `TreeItem` and register it using `draggable`:

```typescript
const elementRef = useRef<HTMLDivElement | null>(null);
const [isDraggingLocal, setIsDraggingLocal] = useState(false);

useEffect(() => {
  const el = elementRef.current;
  if (!el) return;

  return draggable({
    element: el,
    getInitialData: () => ({
      type: 'tree-item',
      id: idOverride || entity.id,
      parentId: entity.parentId,
      workspaceId: entity.workspaceId,
      isPinned: idOverride?.startsWith('pinned-') || false,
    }),
    onDragStart: () => setIsDraggingLocal(true),
    onDrop: () => setIsDraggingLocal(false),
  });
}, [entity.id, entity.parentId, entity.workspaceId, idOverride]);
```

Apply `elementRef` and class names on the outer container:
```typescript
<div
  ref={elementRef}
  className={cn(
    isWorkspace && "rounded-[var(--radius-small)] ",
    isWorkspace && isExpanded && "group/workspace",
    "relative group/treeitem",
    isDraggingLocal && "opacity-40"
  )}
>
```

**Step 4: Run test to verify it passes**

Run: Build the app and confirm that sidebar items now support basic pointer-driven dragging.

**Step 5: Commit**

```bash
git add src/components/layout/TreeItem.tsx
git commit -m "feat(sidebar): add pragmatic-dnd draggable to TreeItem"
```

---

### Task 3: Implement Drop Target and Edge Hitbox on TreeItem

**Files:**
- Modify: `src/components/layout/TreeItem.tsx`

**Step 1: Write the failing test**

Verify that hovering a dragged item over a `TreeItem` calculates the closest edge.

**Step 2: Run test to verify it fails**

Expected: Hovering shows no active drop indicators or lines.

**Step 3: Write minimal implementation**

Implement `dropTargetForElements` inside the same `useEffect` or a separate `useEffect`:

```typescript
const [closestEdge, setClosestEdge] = useState<Edge | null>(null);

useEffect(() => {
  const el = elementRef.current;
  if (!el) return;

  return dropTargetForElements({
    element: el,
    canDrop: ({ source }) => source.data.type === 'tree-item' && source.data.id !== (idOverride || entity.id),
    getData: ({ input, element }) => attachClosestEdge(
      { type: 'tree-item', id: idOverride || entity.id },
      { input, element, allowedEdges: ['top', 'bottom'] }
    ),
    onDragEnter: ({ self }) => setClosestEdge(extractClosestEdge(self.data)),
    onDragOver: ({ self }) => setClosestEdge(extractClosestEdge(self.data)),
    onDragLeave: () => setClosestEdge(null),
    onDrop: () => setClosestEdge(null),
  });
}, [entity.id, idOverride]);
```

Render the drop line indicator:
```typescript
{closestEdge && (
  <div
    className={cn(
      "absolute left-3 right-3 h-[2px] bg-[var(--bone-30)] rounded-full pointer-events-none z-10",
      closestEdge === 'top' ? '-top-1' : '-bottom-1'
    )}
  />
)}
```

**Step 4: Run test to verify it passes**

Verify that dragging one sidebar item over another shows an insertion indicator line at the closest edge.

**Step 5: Commit**

```bash
git add src/components/layout/TreeItem.tsx
git commit -m "feat(sidebar): add pragmatic-dnd drop target and edge lines to TreeItem"
```

---

### Task 4: Set Up Monitor and Reordering Logic in Sidebar

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`

**Step 1: Write the failing test**

Run the app and attempt to drag-and-drop to reorder sidebar items.

**Step 2: Run test to verify it fails**

Expected: Drop does not commit or perform reordering.

**Step 3: Write minimal implementation**

Initialize the `monitorForElements` at the `Sidebar` level. Add `@atlaskit/pragmatic-drag-and-drop/element/adapter` monitor to handle drop commits:

```typescript
useEffect(() => {
  return monitorForElements({
    canMonitor: ({ source }) => source.data.type === 'tree-item',
    onDrop: ({ source, location }) => {
      const activeData = source.data;
      const target = location.current.dropTargets[0];
      if (!target) return;
      const targetData = target.data;

      const activeId = activeData.id as string;
      const overId = targetData.id as string;
      const isPinnedDrag = activeData.isPinned as boolean;
      const entityId = isPinnedDrag ? activeId.replace('pinned-', '') : activeId;

      const edge = extractClosestEdge(target.data);
      
      // Perform reorder/unpin/move logic matching the previous handleDragEnd branching
      if (overId === 'pinned-container' || overId.startsWith('pinned-')) {
        if (!favoriteIds.includes(entityId)) {
          toggleFavorite(entityId);
        }
        // Handle favorites manual sorting
        const oldIndex = favoriteEntities.findIndex(e => e.id === entityId);
        const overEntityId = overId.startsWith('pinned-') ? overId.replace('pinned-', '') : overId;
        const newIndex = favoriteEntities.findIndex(e => e.id === overEntityId);
        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          const reordered = arrayMove(favoriteEntities, oldIndex, newIndex);
          reorderEntities(reordered.map(e => e.id));
          setSectionSortMode('pinned', 'manual');
        }
        return;
      }

      if (isPinnedDrag) {
        toggleFavorite(entityId);
        return;
      }

      const overEntity = entities.find(e => e.id === overId);
      const moveEntityAction = useStore.getState().moveEntity;

      let newParentId: string | null = null;
      let newWorkspaceId = activeWorkspaceId;

      if (overEntity) {
        if (overEntity.type === 'folder' || overEntity.type === 'collection' || overEntity.type === 'workspace') {
          newParentId = overEntity.id;
          newWorkspaceId = overEntity.workspaceId;
        } else {
          newParentId = overEntity.parentId;
          newWorkspaceId = overEntity.workspaceId;
        }
      }

      if (newParentId === entityId) return;

      if (newParentId !== entity.parentId || newWorkspaceId !== entity.workspaceId) {
        moveEntityAction(entityId, newParentId, newWorkspaceId);
      }

      const freshEntities = useStore.getState().entities;
      const currentSiblings = freshEntities
        .filter(e => e.parentId === newParentId && (e.workspaceId || 'ws-personal') === (newWorkspaceId || 'ws-personal'))
        .sort((a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999));

      const fromIdx = currentSiblings.findIndex(e => e.id === entityId);
      let toIdx = currentSiblings.findIndex(e => e.id === overId);
      if (edge === 'bottom') toIdx += 1;
      
      if (fromIdx !== -1 && toIdx !== -1 && fromIdx !== toIdx) {
        const reordered = arrayMove(currentSiblings, fromIdx, toIdx);
        reorderEntities(reordered.map(e => e.id));
      }
    }
  });
}, [entities, favoriteIds, favoriteEntities, activeWorkspaceId, toggleFavorite, reorderEntities]);
```

**Step 4: Run test to verify it passes**

Drag sidebar items and folders to reorder them or pin/unpin them. Verify the drop matches the visual location of the indicator line and sticks permanently.

**Step 5: Commit**

```bash
git add src/components/layout/Sidebar.tsx
git commit -m "feat(sidebar): implement monitorForElements drop reorder logic in Sidebar"
```

---

### Task 5: Migrate NoteEditor to pragmatic-dnd Monitor

**Files:**
- Modify: `src/components/editor/NoteEditor.tsx`

**Step 1: Write the failing test**

Compile the project and check NoteEditor page load.

**Step 2: Run test to verify it fails**

Expected: Notes drag-and-drop does not function.

**Step 3: Write minimal implementation**

Remove `@dnd-kit` providers from `NoteEditor.tsx` render function. Put a pragmatic-dnd `monitorForElements` inside a `useEffect` inside `NoteEditor`:

```typescript
import { monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';

useEffect(() => {
  return monitorForElements({
    canMonitor: ({ source }) => source.data.type === 'note-block',
    onDrop: ({ source, location }) => {
      const target = location.current.dropTargets[0];
      if (!target) return;
      const sourceId = source.data.blockId as string;
      const targetId = target.data.blockId as string;
      const edge = extractClosestEdge(target.data);

      const oldIndex = blocks.findIndex(b => b.id === sourceId);
      let newIndex = blocks.findIndex(b => b.id === targetId);
      if (edge === 'bottom') newIndex += 1;

      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        const nextBlocks = arrayMove(blocks, oldIndex, newIndex);
        setBlocks(nextBlocks);
        persistBlocks(nextBlocks);
      }
    }
  });
}, [blocks]);
```

**Step 4: Run test to verify it passes**

Confirm that dropping note blocks updates the local list and triggers persistence correctly.

**Step 5: Commit**

```bash
git add src/components/editor/NoteEditor.tsx
git commit -m "feat(editor): migrate NoteEditor to pragmatic-dnd monitor"
```

---

### Task 6: Migrate BlockRenderer to Draggable and DropTarget

**Files:**
- Modify: `src/components/editor/BlockRenderer.tsx`

**Step 2: Run test to verify it fails**

Verify that dragging note blocks displays native selection.

**Step 3: Write minimal implementation**

Set up `elementRef` on each block root in `BlockRenderer` and register using `draggable` and `dropTargetForElements`:

```typescript
const elementRef = useRef<HTMLDivElement | null>(null);
const [closestEdge, setClosestEdge] = useState<Edge | null>(null);

useEffect(() => {
  const el = elementRef.current;
  if (!el) return;

  return draggable({
    element: el,
    getInitialData: () => ({ type: 'note-block', blockId: block.id }),
    onDragStart: () => setIsDraggingLocal(true),
    onDrop: () => setIsDraggingLocal(false),
  });
}, [block.id]);

useEffect(() => {
  const el = elementRef.current;
  if (!el) return;

  return dropTargetForElements({
    element: el,
    canDrop: ({ source }) => source.data.type === 'note-block' && source.data.blockId !== block.id,
    getData: ({ input, element }) => attachClosestEdge(
      { type: 'note-block', blockId: block.id },
      { input, element, allowedEdges: ['top', 'bottom'] }
    ),
    onDragEnter: ({ self }) => setClosestEdge(extractClosestEdge(self.data)),
    onDragOver: ({ self }) => setClosestEdge(extractClosestEdge(self.data)),
    onDragLeave: () => setClosestEdge(null),
    onDrop: () => setClosestEdge(null),
  });
}, [block.id]);
```

**Step 4: Run test to verify it passes**

Drag note blocks and check if the indicator line displays at the correct edge.

**Step 5: Commit**

```bash
git add src/components/editor/BlockRenderer.tsx
git commit -m "feat(editor): migrate BlockRenderer to pragmatic-dnd draggable/dropTarget"
```

---

### Task 7: Migrate TableBlock Nested Reordering

**Files:**
- Modify: `src/components/editor/TableBlock.tsx`

**Step 2: Run test to verify it fails**

Verify table row reordering fails or doesn't render.

**Step 3: Write minimal implementation**

Replace nested `@dnd-kit` context/sortable elements in table rows with pragmatic-dnd row drop targets:

```typescript
useEffect(() => {
  const el = rowRef.current;
  if (!el) return;

  return draggable({
    element: el,
    getInitialData: () => ({ type: 'table-row', rowId: id }),
  });
}, [id]);

useEffect(() => {
  const el = rowRef.current;
  if (!el) return;

  return dropTargetForElements({
    element: el,
    canDrop: ({ source }) => source.data.type === 'table-row' && source.data.rowId !== id,
    getData: ({ input, element }) => attachClosestEdge(
      { type: 'table-row', rowId: id },
      { input, element, allowedEdges: ['top', 'bottom'] }
    ),
  });
}, [id]);
```

**Step 4: Run test to verify it passes**

Verify table rows can be dragged and reordered.

**Step 5: Commit**

```bash
git add src/components/editor/TableBlock.tsx
git commit -m "feat(editor): migrate TableBlock nested rows to pragmatic-dnd"
```
