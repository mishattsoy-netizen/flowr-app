# Sidebar Drag-and-Drop Refinement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix left sidebar drag-and-drop/repositioning for workspaces, folders, and pages, ensuring proper nesting vs sibling reordering detection and separation between workspace list and unsorted list, without any rendering or state errors.

**Architecture:** Refine the custom Pragmatic DnD drop zones, hitboxes, and target detection. Divide folders and workspaces into three vertical hover zones (top 30% for preceding sibling, bottom 30% for succeeding sibling, middle 40% for nesting child), and separate sibling array updates between top-level workspaces and unsorted items sharing `parentId === null`.

**Tech Stack:** `@atlaskit/pragmatic-drag-and-drop`, `@atlaskit/pragmatic-drag-and-drop-hitbox`, React 19, Zustand.

---

## Workspace & Workspace Content Rules

To ensure 100% correctness, the drag-and-drop system enforces these structural rules:

1. **Workspace Top-Level Reordering (Flat Hierarchy):**
   - Workspaces (entities of type `workspace` or `collection`) are strictly top-level containers.
   - They can **only** be repositioned relative to each other inside the "Workspaces" section of the sidebar.
   - You **cannot** nest a workspace inside a folder or inside another workspace.
   - Sibling reordering of workspaces is isolated and does not affect the order of unsorted root-level items.

2. **Workspace Content Nesting & Detection:**
   - Folders and pages (notes, canvases) inside a workspace are "workspace content".
   - You can drag folders/pages and drop them *into* a workspace to nest them (setting their `parentId` to the workspace's ID).
   - The drop target must correctly detect when you are trying to nest an item (center zone drop) versus when you are trying to reorder it as a sibling of another nested item (top/bottom zone drop).
   - Reordering of nested items at any depth (folders in folders, pages in folders, etc.) must remain isolated to the sibling list of their parent folder/workspace.

3. **Unsorted Root-Level Transition:**
   - Items can be dragged out of folders or workspaces and dropped into the "Unsorted" section or on unsorted items to make them root-level unsorted items (`parentId = null`).

---


### Task 1: Add Drag Type Info to TreeItem Draggable

**Files:**
- Modify: `src/components/layout/TreeItem.tsx:75-92`

**Step 1: Write the failing test**

We don't have visual tests, but we can verify compilation and check that the draggable object exposes the entity's type in `source.data`.

**Step 2: Run test to verify it fails**

Run: `npm run build`
Expected: Succeeds (no changes yet).

**Step 3: Write minimal implementation**

Modify `src/components/layout/TreeItem.tsx` inside the `draggable` `useEffect` to include `entityType: entity.type` in `getInitialData`:

```typescript
  useEffect(() => {
    const el = elementRef.current;
    if (!el || isDragOverlay) return;

    return draggable({
      element: el,
      getInitialData: () => ({
        type: 'tree-item',
        id: myId,
        entityType: entity.type, // added
        parentId: entity.parentId,
        workspaceId: entity.workspaceId,
        isPinned: idOverride?.startsWith('pinned-') || false,
      }),
      onGenerateDragPreview: ({ nativeSetDragImage, source, location }) => {
        disableNativeDragPreview({ nativeSetDragImage });
        setPreview(true);
      },
      onDrag: ({ location }) => {
        const node = previewRef.current;
        if (!node) return;
        node.style.transform = `translate(${location.current.input.clientX}px, ${location.current.input.clientY}px)`;
        dragCursor.x = location.current.input.clientX;
        dragCursor.y = location.current.input.clientY;
      },
      onDragStart: () => setIsDraggingLocal(true),
      onDrop: () => {
        setIsDraggingLocal(false);
        setPreview(false);
      },
    });
  }, [myId, entity.parentId, entity.workspaceId, entity.type, idOverride, isDragOverlay]);
```

**Step 4: Run test to verify it passes**

Run: `npm run build`
Expected: Succeeds.

**Step 5: Commit**

```bash
git add src/components/layout/TreeItem.tsx
git commit -m "feat(sidebar-dnd): add entityType to TreeItem draggable initial data"
```

---

### Task 2: Implement Tri-Zone Hitbox and Drop Validation in TreeItem

**Files:**
- Modify: `src/components/layout/TreeItem.tsx:109-163`

**Step 1: Write the failing test**

Verify compilation passes and check drag events.

**Step 2: Run test to verify it fails**

Run: `npm run build`
Expected: Succeeds.

**Step 3: Write minimal implementation**

Update `dropTargetForElements` in `src/components/layout/TreeItem.tsx` to:
1. Validate types in `canDrop`:
   - Workspaces/collections can only be dropped on other workspaces/collections.
   - Folders and pages can only be dropped on folders and pages (not on workspaces, except to nest *inside* them).
2. Calculate three vertical zones (top 30%, bottom 30%, middle 40%) for folders and workspaces:
   - Top 30%: `'top'`
   - Bottom 30%: `'bottom'`
   - Middle 40%: `null` (nest inside)
   - For pages, split 50/50 (`'top'` / `'bottom'`).
3. Set `closestEdge` state only when it changes.

```typescript
  useEffect(() => {
    const el = elementRef.current;
    if (!el || isDragOverlay) return;

    return dropTargetForElements({
      element: el,
      canDrop: ({ source }) => {
        if (source.data.type !== 'tree-item' || source.data.id === myId) return false;
        
        const sourceIsWorkspace = source.data.entityType === 'workspace' || source.data.entityType === 'collection';
        const targetIsWorkspace = entity.type === 'workspace' || entity.type === 'collection';
        
        if (sourceIsWorkspace) {
          // Workspaces can only drop on other workspaces to reorder them
          return targetIsWorkspace;
        } else {
          // Folders/pages can drop inside workspaces, or on folders/pages
          return true;
        }
      },
      getData: ({ input, element }) => attachClosestEdge(
        { type: 'tree-item', id: myId },
        { input, element, allowedEdges: ['top', 'bottom'] }
      ),
      onDragEnter: () => {
        setIsOver(true);
        const rect = elementRef.current?.getBoundingClientRect();
        if (!rect || !dragCursor.ready) return;
        const clientY = dragCursor.y;

        const sourceIsWorkspace = activeDragId ? (entities.find(e => e.id === activeDragId)?.type === 'workspace' || entities.find(e => e.id === activeDragId)?.type === 'collection') : false;
        const targetIsWorkspace = entity.type === 'workspace' || entity.type === 'collection';

        let edge: Edge | null = null;
        if (targetIsWorkspace) {
          if (sourceIsWorkspace) {
            // Workspace on workspace -> sibling reorder
            edge = clientY < rect.top + rect.height / 2 ? 'top' : 'bottom';
          } else {
            // Non-workspace on workspace -> always nest
            edge = null;
          }
        } else if (isFolder) {
          const threshold = rect.height * 0.3;
          if (clientY < rect.top + threshold) {
            edge = 'top';
          } else if (clientY > rect.bottom - threshold) {
            edge = 'bottom';
          } else {
            edge = null;
          }
        } else {
          edge = clientY < rect.top + rect.height / 2 ? 'top' : 'bottom';
        }

        if (edge !== edgeRef.current) {
          edgeRef.current = edge;
          setClosestEdge(edge);
        }
      },
      onDrag: () => {
        const rect = elementRef.current?.getBoundingClientRect();
        if (!rect || !dragCursor.ready) return;
        const clientY = dragCursor.y;

        const sourceIsWorkspace = activeDragId ? (entities.find(e => e.id === activeDragId.replace('pinned-', ''))?.type === 'workspace' || entities.find(e => e.id === activeDragId.replace('pinned-', ''))?.type === 'collection') : false;
        const targetIsWorkspace = entity.type === 'workspace' || entity.type === 'collection';

        let edge: Edge | null = null;
        if (targetIsWorkspace) {
          if (sourceIsWorkspace) {
            edge = clientY < rect.top + rect.height / 2 ? 'top' : 'bottom';
          } else {
            edge = null;
          }
        } else if (isFolder) {
          const threshold = rect.height * 0.3;
          if (clientY < rect.top + threshold) {
            edge = 'top';
          } else if (clientY > rect.bottom - threshold) {
            edge = 'bottom';
          } else {
            edge = null;
          }
        } else {
          edge = clientY < rect.top + rect.height / 2 ? 'top' : 'bottom';
        }

        if (edge !== edgeRef.current) {
          edgeRef.current = edge;
          setClosestEdge(edge);
        }
      },
      onDragLeave: () => {
        setIsOver(false);
        edgeRef.current = null;
        setClosestEdge(null);
      },
      onDrop: () => {
        setIsOver(false);
        edgeRef.current = null;
        setClosestEdge(null);
      },
    });
  }, [myId, isFolder, entity.type, activeDragId, entities, isDragOverlay]);
```

**Step 4: Run test to verify it passes**

Run: `npm run build`
Expected: Succeeds.

**Step 5: Commit**

```bash
git add src/components/layout/TreeItem.tsx
git commit -m "feat(sidebar-dnd): implement tri-zone hitbox logic and drop validation in TreeItem"
```

---

### Task 3: Render Drop Lines and Nest Highlights in TreeItem

**Files:**
- Modify: `src/components/layout/TreeItem.tsx:228, 419-426`

**Step 1: Write the failing test**

Confirm page loads and renders drop elements.

**Step 2: Run test to verify it fails**

Run: Check the browser, verify lines do not show on folders.

**Step 3: Write minimal implementation**

1. Update `isFolderDropTarget` to only highlight when the edge is `null` (nesting inside folder/workspace):
```typescript
  const isFolderDropTarget = isOver && isFolder && closestEdge === null;
```
2. Enable sibling insertion line render for folder targets by removing the `!isFolder` restriction:
```typescript
      {isOver && closestEdge && (
        <div
          className={cn(
            "absolute left-3 right-3 h-px bg-[var(--bone-30)] pointer-events-none z-10",
            closestEdge === 'top' ? '-top-px' : '-bottom-px'
          )}
        />
      )}
```

**Step 4: Run test to verify it passes**

Run: `npm run build`
Expected: Passes.

**Step 5: Commit**

```bash
git add src/components/layout/TreeItem.tsx
git commit -m "feat(sidebar-dnd): show drop lines on folders and only highlight folder on nesting"
```

---

### Task 4: Refine Tri-Zone Edge Calculation and Container Validation in Sidebar

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`

**Step 1: Write the failing test**

Confirm compilation.

**Step 2: Run test to verify it fails**

Run: Try dropping in browser, dropping inside folder registers as sibling drop.

**Step 3: Write minimal implementation**

1. Update `DroppableZone` in `src/components/layout/Sidebar.tsx` to support `canDrop`:
```typescript
function DroppableZone({ id, children, className, canDrop }: { id: string, children: React.ReactNode, className?: string, canDrop?: (args: any) => boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return dropTargetForElements({
      element: el,
      getData: () => ({ id }),
      canDrop: canDrop || (() => true),
    });
  }, [id, canDrop]);
  return <div ref={ref} className={className}>{children}</div>;
}
```
2. Set up `canDrop` rules for sections:
   - `workspaces-container`:
     `canDrop={({ source }) => source.data.entityType === 'workspace' || source.data.entityType === 'collection'}`
   - `unsorted-container`:
     `canDrop={({ source }) => source.data.entityType !== 'workspace' && source.data.entityType !== 'collection'}`
   - `pinned-container`:
     `canDrop={({ source }) => source.data.entityType !== 'workspace' && source.data.entityType !== 'collection'}`
3. Update `monitorForElements.onDrop` edge calculation in `src/components/layout/Sidebar.tsx` to match the exact same tri-zone logic:
```typescript
        let edge: 'top' | 'bottom' | null = null;
        const targetEl = target.element;
        const input = location.current.input;
        const clientY = input?.clientY ?? (dragCursor.ready ? dragCursor.y : null);
        if (targetEl instanceof HTMLElement && clientY != null) {
          const rect = targetEl.getBoundingClientRect();
          const overEntity = entities.find(e => e.id === overId);
          const isFolderTarget = overEntity && (overEntity.type === 'folder' || overEntity.type === 'collection' || overEntity.type === 'workspace');
          const sourceIsWorkspace = source.data.entityType === 'workspace' || source.data.entityType === 'collection';
          const targetIsWorkspace = overEntity && (overEntity.type === 'workspace' || overEntity.type === 'collection');

          if (targetIsWorkspace) {
            if (sourceIsWorkspace) {
              edge = clientY < rect.top + rect.height / 2 ? 'top' : 'bottom';
            } else {
              edge = null; // Always nest when dropping non-workspace on workspace
            }
          } else if (isFolderTarget) {
            const threshold = rect.height * 0.3;
            if (clientY < rect.top + threshold) {
              edge = 'top';
            } else if (clientY > rect.bottom - threshold) {
              edge = 'bottom';
            } else {
              edge = null; // Nest inside
            }
          } else {
            edge = clientY < rect.top + rect.height / 2 ? 'top' : 'bottom';
          }
        }
```

**Step 4: Run test to verify it passes**

Run: `npm run build`
Expected: Succeeds.

**Step 5: Commit**

```bash
git add src/components/layout/Sidebar.tsx
git commit -m "feat(sidebar-dnd): implement matching tri-zone edge and container drop rules in Sidebar"
```

---

### Task 5: Separate Workspace and Unsorted Sibling Reordering Lists in Sidebar

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`

**Step 1: Write the failing test**

Confirm compilation.

**Step 2: Run test to verify it fails**

Run: Dragging workspace items should mix up sorting indices with the unsorted list items.

**Step 3: Write minimal implementation**

Modify `onDrop` parent calculation and reordering in `src/components/layout/Sidebar.tsx` to:
1. Correctly determine `newParentId` based on `edge`:
```typescript
        let newParentId: string | null = entity.parentId;
        let newWorkspaceId = entity.workspaceId;

        if (overId === 'unsorted-container') {
          newParentId = null;
          newWorkspaceId = 'ws-personal';
        } else if (overId === 'workspaces-container') {
          newParentId = null;
          newWorkspaceId = activeWorkspaceId;
        } else if (overEntity) {
          if (edge === null) {
            // Nest inside
            newParentId = overEntity.id;
            newWorkspaceId = overEntity.workspaceId;
          } else {
            // Sibling
            newParentId = overEntity.parentId;
            newWorkspaceId = overEntity.workspaceId;
          }
        }

        // Restrict workspaces to root level only
        if (entity.type === 'workspace' || entity.type === 'collection') {
          newParentId = null;
        }
```
2. Filter the siblings list carefully to avoid mixing workspaces and unsorted items:
```typescript
        const freshEntities = useStore.getState().entities;
        
        let currentSiblings: Entity[];
        if (newParentId === null) {
          if (entity.type === 'workspace' || entity.type === 'collection') {
            currentSiblings = freshEntities
              .filter(e => e.parentId === null && (e.type === 'workspace' || e.type === 'collection') && (e.workspaceId || 'ws-personal') === (newWorkspaceId || 'ws-personal'))
              .sort((a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999));
          } else {
            currentSiblings = freshEntities
              .filter(e => e.parentId === null && e.type !== 'workspace' && e.type !== 'collection' && (e.workspaceId || 'ws-personal') === (newWorkspaceId || 'ws-personal'))
              .sort((a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999));
          }
        } else {
          currentSiblings = freshEntities
            .filter(e => e.parentId === newParentId)
            .sort((a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999));
        }
```
3. Update positioning and commit indices correctly:
```typescript
        const fromIdx = currentSiblings.findIndex(e => e.id === entityId);
        let toIdx = currentSiblings.findIndex(e => e.id === overId);
        
        if (toIdx === -1) {
          // If dropped on container or nested inside, append to end
          toIdx = currentSiblings.length;
        } else if (edge === 'bottom') {
          toIdx += 1;
        }

        if (fromIdx !== -1) {
          // Position within its siblings
          const siblingsWithoutSelf = currentSiblings.filter(e => e.id !== entityId);
          const insertIdx = fromIdx < toIdx ? toIdx - 1 : toIdx;
          siblingsWithoutSelf.splice(insertIdx, 0, currentSiblings[fromIdx]);
          
          reorderEntities(siblingsWithoutSelf.map(e => e.id));
          
          if (favoriteIds.includes(entityId)) {
            setSectionSortMode('pinned', 'manual');
          } else if (entity.type === 'workspace' || entity.type === 'collection') {
            setSectionSortMode('workspaces', 'manual');
          } else {
            setSectionSortMode('unsorted', 'manual');
          }
        }
```

**Step 4: Run test to verify it passes**

Run: `npm run build`
Expected: Succeeds.

**Step 5: Commit**

```bash
git add src/components/layout/Sidebar.tsx
git commit -m "feat(sidebar-dnd): isolate workspace and unsorted sibling lists for clean reordering"
```

---

### Task 6: Manual Verification and Edge Case Checks

**Step 1: Perform the following tests in local environment**
1. Reorder workspaces relative to each other (Workspaces section). Ensure they do not disappear or mix with unsorted items.
2. Drag a note from the Unsorted section and drop it *inside* a workspace to nest it.
3. Drag a folder from a workspace and drop it into the Unsorted container to make it a root-level item.
4. Drag nested pages inside a folder to reorder them as siblings.
5. Drag folders inside folders to verify nested folder reordering.
6. Verify no rerender loops or lag occur during dragging.

**Expected:** All tests pass smoothly with clear visual line/highlight feedback.

**Step 2: Commit**

```bash
git commit --allow-empty -m "test(sidebar-dnd): manually verified all drag-and-drop operations"
```
