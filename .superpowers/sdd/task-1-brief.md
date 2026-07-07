# Task 1: Update Store Types (store.types.ts)

**BASE:** 1e56d24

## Goal

Add `pairedEntityId` to the Entity interface, replace old split-view fields (`isSplitView`, `splitViewLeftId`, `splitViewRightId`) with new ones (`splitViewActive`, `splitViewLeftId`, `splitViewRightId`, `splitViewPinned`), and update action signatures.

## Files

- Modify: `src/data/store.types.ts`

## Steps

### Step 1: Add `pairedEntityId` to Entity interface

In `src/data/store.types.ts`, in the Entity interface (around line 184, after `workspaceId?: string | null;`), add:

```ts
  workspaceId?: string | null;

  pairedEntityId: string | null;
  sortOrder?: number;
```

### Step 2: Replace old split fields with new ones in AppState

In `src/data/store.types.ts`, in AppState interface, remove these three lines:

```ts
  isSplitView: boolean;
  splitViewLeftId: string | null;
  splitViewRightId: string | null;
```

And add these four lines (keep `splitViewPosition: number;` — it stays):

```ts
  splitViewActive: boolean;
  splitViewLeftId: string | null;
  splitViewRightId: string | null;
  splitViewPinned: boolean;
```

### Step 3: Replace action signatures

Remove:
```ts
  assignTabToColumn: (tabId: string, column: 'left' | 'right') => void;
```

Add:
```ts
  setColumnEntity: (column: 'left' | 'right', entityId: string | null) => void;
  togglePin: () => void;
  exitSplitView: () => void;
```

Note: `toggleSplitView` and `setSplitViewPosition` action signatures remain unchanged.

## Verification

Run: `npx tsc --noEmit 2>&1 | head -40`
Expected: Errors in store.ts referencing old field names (`isSplitView`, old `splitViewLeftId`/`splitViewRightId`, `assignTabToColumn`). These are expected and will be resolved in Task 2. store.types.ts itself should compile clean.
