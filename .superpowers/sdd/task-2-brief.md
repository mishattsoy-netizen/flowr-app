# Task 2: Gate the store file-write subscriber on syncMode

**Files:**
- Modify: `src/data/store.ts:2596-2610`

This subscriber has no existing test file and is wired directly into module-load-time `useStore.subscribe`, which is awkward to unit test in isolation. We verify this task via the manual test plan in Task 6 instead of an automated test, consistent with how the rest of this subscriber block is (currently) untested.

## Step 1: Read current code

Current (`src/data/store.ts:2596-2611`):

```typescript
if (isDesktop()) {
  useStore.subscribe((state, prevState) => {
    // Basic detection for M3: if lastModified changed, save it
    // In M4 this will be replaced by direct calls to saveEntity() on store actions
    for (const entity of state.entities) {
      if (entity.type !== 'note' && entity.type !== 'canvas' && entity.type !== 'mixed') continue;
      const prev = prevState.entities.find(e => e.id === entity.id);
      if (!prev || prev.lastModified !== entity.lastModified) {
        const blocks = entity.type === 'canvas'
          ? state.blocks.filter(b => b.canvasId === entity.id)
          : (entity.content || []);
        saveEntityToFile(entity, blocks);
      }
    }
  });
}
```

## Step 2: Add the syncMode gate

Replace the block with:

```typescript
if (isDesktop()) {
  useStore.subscribe((state, prevState) => {
    // Basic detection for M3: if lastModified changed, save it
    // In M4 this will be replaced by direct calls to saveEntity() on store actions
    for (const entity of state.entities) {
      if (entity.type !== 'note' && entity.type !== 'canvas' && entity.type !== 'mixed') continue;
      if (entity.syncMode === 'cloud-only') continue;
      const prev = prevState.entities.find(e => e.id === entity.id);
      if (!prev || prev.lastModified !== entity.lastModified) {
        const blocks = entity.type === 'canvas'
          ? state.blocks.filter(b => b.canvasId === entity.id)
          : (entity.content || []);
        saveEntityToFile(entity, blocks);
      }
    }
  });
}
```

## Step 3: Commit

```bash
git add src/data/store.ts
git commit -m "fix: skip local file writes for cloud-only entities"
```
