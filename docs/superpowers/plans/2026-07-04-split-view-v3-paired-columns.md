# Split View v3: Paired Columns — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the tab-per-column split view with a paired-column model where each column shows exactly one entity, entities can be temporarily split or permanently pinned, and empty columns show a placeholder.

**Architecture:** Store-level changes introduce `pairedEntityId` on entities and new split state (`splitViewActive`, `splitViewLeftId`, `splitViewRightId`, `splitViewPinned`). `SplitViewLayout` is rewritten with single-entity columns, a simplified `ColumnHeader`, a new `ColumnPlaceholder` for empty columns, and drop targets for sidebar drag-and-drop. `Shell.tsx` condition is updated to use new state fields.

**Tech Stack:** React (Next.js "use client"), Zustand with persist/migration v22, Tailwind CSS, lucide-react icons, @atlaskit/pragmatic-drag-and-drop (existing in project)

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/data/store.types.ts` | Edit | Entity + AppState type changes, action signatures |
| `src/data/store.ts` | Edit | New actions, migration v21→v22, partialize update |
| `src/components/layout/ColumnHeader.tsx` | Rewrite | Single-entity header: icon + title + X close |
| `src/components/layout/ColumnPlaceholder.tsx` | New | Empty column state: logo, actions, search, recents |
| `src/components/layout/SplitViewLayout.tsx` | Rewrite | Two columns with drop targets, divider with pin button, placeholder support |
| `src/components/layout/Shell.tsx` | Edit | Update split conditional to use `splitViewActive` |
| `src/components/layout/HeaderBar.tsx` | Edit | Remove split-column indicator strips, update toggle call |
| `src/components/layout/Sidebar.tsx` | Edit | No functional changes needed — drag already emits `tree-item` type with entity `id` |
| `src/components/editor/NoteEditor.tsx` | Edit | Unused import cleanup |
| (No Sidebar changes for drag) | — | Sidebar drag emits `tree-item` with entity `id` — SplitViewLayout drop targets consume this |

---

### Task 1: Update Store Types (`store.types.ts`)

**Files:**
- Modify: `src/data/store.types.ts:171-185` (Entity interface — add pairedEntityId)
- Modify: `src/data/store.types.ts:424-427` (AppState — remove old split fields)
- Modify: `src/data/store.types.ts:514-516` (AppState actions — remove assignTabToColumn, add new actions)

- [ ] **Step 1: Add `pairedEntityId` to Entity interface**

In `src/data/store.types.ts`, add to the `Entity` interface (after `workspaceId`):

```ts
  workspaceId?: string | null;

  pairedEntityId: string | null;
  sortOrder?: number;
```

- [ ] **Step 2: Replace old split fields with new ones in AppState**

In `src/data/store.types.ts`, replace `isSplitView`, `splitViewLeftId`, `splitViewRightId`:

```ts
  // Remove these three lines:
  // isSplitView: boolean;
  // splitViewLeftId: string | null;
  // splitViewRightId: string | null;
  // Keep splitViewPosition

  // Add:
  splitViewActive: boolean;
  splitViewLeftId: string | null;
  splitViewRightId: string | null;
  splitViewPinned: boolean;
```

- [ ] **Step 3: Replace action signatures**

Remove `assignTabToColumn` signature and add new action signatures:

```ts
  // Remove:
  // assignTabToColumn: (tabId: string, column: 'left' | 'right') => void;

  // Add:
  setColumnEntity: (column: 'left' | 'right', entityId: string | null) => void;
  togglePin: () => void;
  exitSplitView: () => void;
```

- [ ] **Step 4: Run TypeScript check to verify types compile**

Run: `npx tsc --noEmit 2>&1 | Select-String -Pattern "store.types" | Select-Object -First 20`
Expected: Type errors for store.ts referencing old field names (will be fixed in Task 2)

---

### Task 2: Update Store Logic (`store.ts`)

**Files:**
- Modify: `src/data/store.types.ts` — (already done in Task 1)
- Modify: `src/data/store.ts:249-252` (initial state)
- Modify: `src/data/store.ts:359-399` (split view actions)
- Modify: `src/data/store.ts:1683-1716` (setActiveEntityId)
- Modify: `src/data/store.ts:1736-1751` (removeTab)
- Modify: `src/data/store.ts:2587-2629` (partialize)
- Modify: `src/data/store.ts:2453-2586` (migration)

- [ ] **Step 1: Update default state**

In `src/data/store.ts`, replace the split view defaults:

```ts
// Remove:
// isSplitView: false,
// splitViewLeftId: null,
// splitViewRightId: null,

// Add:
splitViewActive: false,
splitViewLeftId: null,
splitViewRightId: null,
splitViewPinned: false,
splitViewPosition: 50,  // keep this
```

- [ ] **Step 2: Replace `toggleSplitView`, `assignTabToColumn`, `setSplitViewPosition` with new actions**

Replace lines 359-399:

```ts
toggleSplitView: () => {
  const state = get();
  if (state.splitViewActive) {
    // Exit split: keep left column entity as active
    set({
      splitViewActive: false,
      activeEntityId: state.splitViewLeftId ?? state.activeEntityId,
      activeTabId: state.splitViewLeftId ?? state.activeEntityId,
      splitViewLeftId: null,
      splitViewRightId: null,
      splitViewPinned: false,
    });
  } else {
    // Enter split: active entity → left, paired entity → right (or empty)
    const leftId = state.activeTabId ?? state.openTabIds[0] ?? 'dashboard';
    const leftEntity = state.entities.find(e => e.id === leftId);
    const rightId = leftEntity?.pairedEntityId ?? null;
    const isPinned = !!(leftEntity?.pairedEntityId);
    set({
      splitViewActive: true,
      splitViewLeftId: leftId,
      splitViewRightId: rightId,
      splitViewPinned: isPinned,
      splitViewPosition: 50,
    });
  }
},

setColumnEntity: (column, entityId) => {
  const state = get();
  if (column === 'left') {
    set({ splitViewLeftId: entityId });
    // Update activeEntityId to the new left entity
    if (entityId) set({ activeEntityId: entityId, activeTabId: entityId });
  } else {
    set({ splitViewRightId: entityId });
  }
  // Recompute pinned state
  const next = { ...get() };
  const leftE = next.entities.find(e => e.id === next.splitViewLeftId);
  const rightE = next.entities.find(e => e.id === next.splitViewRightId);
  const pinned = !!(leftE?.pairedEntityId && leftE.pairedEntityId === next.splitViewRightId &&
                     rightE?.pairedEntityId && rightE.pairedEntityId === next.splitViewLeftId);
  set({ splitViewPinned: pinned });
},

togglePin: () => {
  const state = get();
  const leftId = state.splitViewLeftId;
  const rightId = state.splitViewRightId;
  if (!leftId || !rightId) return;

  if (state.splitViewPinned) {
    // Unpin: clear pairedEntityId on both
    set(s => ({
      entities: s.entities.map(e =>
        e.id === leftId ? { ...e, pairedEntityId: null } :
        e.id === rightId ? { ...e, pairedEntityId: null } : e
      ),
      splitViewPinned: false,
    }));
  } else {
    // Pin: set bidirectional pairedEntityId
    set(s => ({
      entities: s.entities.map(e =>
        e.id === leftId ? { ...e, pairedEntityId: rightId } :
        e.id === rightId ? { ...e, pairedEntityId: leftId } : e
      ),
      splitViewPinned: true,
    }));
  }
},

exitSplitView: () => {
  const state = get();
  set({
    splitViewActive: false,
    activeEntityId: state.splitViewLeftId ?? state.activeEntityId,
    activeTabId: state.splitViewLeftId ?? state.activeEntityId,
    splitViewLeftId: null,
    splitViewRightId: null,
    splitViewPinned: false,
  });
},

setSplitViewPosition: (pos) => set({ splitViewPosition: Math.max(15, Math.min(85, pos)) }),
```

- [ ] **Step 3: Modify `setActiveEntityId` for auto-split on paired entity open**

Around line 1670, after calculating `nextRecent`, before tab management. Insert after the `let nextTabs` declaration and before the `if (id)` block:

```ts
// Auto-split: if the opened entity has a pairedEntityId, enter split view
const openingEntity = id ? state.entities.find(e => e.id === id) : null;
const pairedId = openingEntity?.pairedEntityId;
if (id && pairedId && !state.splitViewActive) {
  const pairedEntity = state.entities.find(e => e.id === pairedId);
  if (pairedEntity) {
    // Ensure paired entity is also in openTabIds
    if (!nextTabs.includes(pairedId)) {
      nextTabs.push(pairedId);
    }
    set({
      openTabIds: nextTabs,
      activeTabId: id,
      activeEntityId: id,
      recentEntityIds: nextRecent,
      splitViewActive: true,
      splitViewLeftId: id,
      splitViewRightId: pairedId,
      splitViewPinned: true,
      splitViewPosition: 50,
    });
    // Update navigation history
    const newHistory = state.navigationHistory.slice(0, state.historyIndex + 1);
    newHistory.push(id);
    set({
      navigationHistory: newHistory,
      historyIndex: newHistory.length - 1,
    });
    return;
  }
}
```

- [ ] **Step 4: Update `removeTab` for split view awareness**

Around line 1736, modify to handle split view exit when closing the only open tab:

```ts
removeTab: (id) => {
  const state = get();
  const nextTabs = state.openTabIds.filter(tid => tid !== id);
  let nextActive = state.activeTabId;

  // If we removed the active tab, pick the last remaining tab or dashboard
  if (state.activeTabId === id) {
    nextActive = nextTabs[nextTabs.length - 1] || 'dashboard';
  }
  if (state.activeEntityId === 'chat' && nextActive !== 'chat') {
    state.cleanupActiveChatIfEmpty();
  }

  // If in split view and closing a tab that's in a column, handle exit
  if (state.splitViewActive) {
    const leftId = state.splitViewLeftId;
    const rightId = state.splitViewRightId;
    if (id === leftId || id === rightId) {
      // Close that column's entity. If this leaves only one entity total, exit split.
      if (nextTabs.length <= 1) {
        set({
          openTabIds: nextTabs,
          activeTabId: nextActive,
          activeEntityId: nextActive,
          splitViewActive: false,
          splitViewLeftId: null,
          splitViewRightId: null,
          splitViewPinned: false,
        });
        return;
      }
      // Otherwise remove from column — the remaining entity could stay
      // or we can move the partner to become active
      const survivingId = id === leftId ? rightId : leftId;
      if (nextTabs.includes(survivingId || '')) {
        set({
          openTabIds: nextTabs,
          activeTabId: survivingId,
          activeEntityId: survivingId,
        });
      } else {
        set({
          openTabIds: nextTabs,
          activeTabId: nextActive,
          activeEntityId: nextActive,
          splitViewActive: false,
          splitViewLeftId: null,
          splitViewRightId: null,
          splitViewPinned: false,
        });
      }
      return;
    }
  }

  set({
    openTabIds: nextTabs,
    activeTabId: nextActive,
    activeEntityId: nextActive,
  });
},
```

- [ ] **Step 5: Update `partialize` to persist new split state**

In the `partialize` return object, replace `isSplitView: state.isSplitView` with:

```ts
splitViewActive: state.splitViewActive,
splitViewPosition: state.splitViewPosition,
```

- [ ] **Step 6: Add migration v21→v22 to handle old split state + default pairedEntityId**

In the migration block, after the v21 migration code, add:

```ts
// Version 22: split view v3 paired columns + pairedEntityId on entities
if (version < 22) {
  // Drop old split state fields — new ones start fresh
  delete state.isSplitView;
  delete state.splitViewLeftId;
  delete state.splitViewRightId;

  // Add pairedEntityId: null to all entities
  if (Array.isArray(state.entities)) {
    state.entities = state.entities.map((e: any) => ({
      ...e,
      pairedEntityId: e.pairedEntityId ?? null,
    }));
  }
}
```

And bump version to 22 at the top.

- [ ] **Step 7: Run TypeScript check**

Run: `npx tsc --noEmit 2>&1 | Select-String -Pattern "store.ts|store.types" | Select-Object -First 30`
Expected: Zero type errors in store files (there may be errors in other files referencing old field names — those are fixed in subsequent tasks)

---

### Task 3: Rewrite `ColumnHeader.tsx`

**Files:**
- Rewrite: `src/components/layout/ColumnHeader.tsx`

- [ ] **Step 1: Write the simplified ColumnHeader**

Replace entire contents of `ColumnHeader.tsx`:

```tsx
"use client";

import { useStore } from '@/data/store';
import { getEntityIcon } from '@/data/icons';
import { X, Columns2, FileText, Frame, LayoutDashboard, MessageSquare, ListTodo } from 'lucide-react';
import { cn } from '@/lib/utils';
import { stripHtml } from '@/lib/utils';
import { isDesktop } from '@/lib/env';

interface ColumnHeaderProps {
  column: 'left' | 'right';
  entityId: string | null; // null = empty column
}

function getTitleAndIcon(
  entityId: string | null,
  entities: ReturnType<typeof useStore.getState>['entities'],
  chatConversations: ReturnType<typeof useStore.getState>['chatConversations'],
  activeChatId: string | null,
  isTempChat: boolean,
) {
  if (!entityId || entityId === 'dashboard') return { title: 'Dashboard', Icon: LayoutDashboard };
  if (entityId === 'chat') {
    const ac = chatConversations.find(c => c.id === activeChatId);
    return { title: isTempChat ? 'Temporary Chat' : (ac?.title || 'Chat'), Icon: MessageSquare };
  }
  if (entityId === 'tracker') return { title: 'Tasks', Icon: ListTodo };
  const entity = entities.find(e => e.id === entityId);
  if (entity) {
    const Icon = entity.icon ? getEntityIcon(entity.icon) : entity.type === 'canvas' ? Frame : FileText;
    return { title: entity.title, Icon };
  }
  return { title: null, Icon: null };
}

export function ColumnHeader({ column, entityId }: ColumnHeaderProps) {
  const entities = useStore(s => s.entities);
  const chatConversations = useStore(s => s.chatConversations);
  const activeChatId = useStore(s => s.activeChatId);
  const isTempChat = useStore(s => s.isTempChat);
  const removeTab = useStore(s => s.removeTab);
  const exitSplitView = useStore(s => s.exitSplitView);
  const toggleSplitView = useStore(s => s.toggleSplitView);
  const splitViewPinned = useStore(s => s.splitViewPinned);
  const togglePin = useStore(s => s.togglePin);

  const isDesktopEnv = isDesktop();
  const BAR_H = isDesktopEnv ? 38 : 42;

  const { title, Icon } = getTitleAndIcon(entityId, entities, chatConversations, activeChatId, isTempChat);

  // Empty column — show nothing in header
  if (!entityId) {
    return (
      <div
        className="w-full flex items-center shrink-0 relative z-10 bg-sidebar"
        style={{ height: BAR_H, paddingLeft: 8, paddingRight: 8 }}
      >
        <div className="absolute inset-x-0 bottom-0 h-[1px] bg-[var(--bone-10)] z-0" />
        {/* Right-side controls */}
        {column === 'right' && (
          <div className="flex items-center gap-1 shrink-0 ml-auto z-10" style={{ height: BAR_H }}>
            <button
              onClick={e => { e.stopPropagation(); toggleSplitView(); }}
              className="flex items-center justify-center text-[var(--bone-100)] rounded-[10px] shrink-0 bg-[var(--bone-6)] hover:bg-[var(--bone-12)]"
              style={{ width: 28, height: 28 }}
              title="Exit split view"
            >
              <Columns2 strokeWidth={2} className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="w-full flex items-center shrink-0 relative z-10 bg-sidebar"
      style={{ height: BAR_H, paddingLeft: 8, paddingRight: 8 }}
    >
      {/* Bottom border line */}
      <div className="absolute inset-x-0 bottom-0 h-[1px] bg-[var(--bone-10)] z-0" />

      {/* Entity icon + title */}
      <div className="flex items-center gap-[5px] min-w-0 z-10" style={{ paddingLeft: 10 }}>
        {Icon && (
          <Icon strokeWidth={2} className="w-3.5 h-3.5 shrink-0 text-[var(--bone-100)] opacity-90" />
        )}
        <span
          className="font-medium text-[var(--bone-100)] truncate"
          style={{ fontSize: 13, lineHeight: 1 }}
        >
          {stripHtml(title || '')}
        </span>
      </div>

      {/* Right-side controls */}
      <div className="flex items-center gap-1 shrink-0 ml-auto z-10" style={{ height: BAR_H }}>
        {/* Close entity button */}
        <button
          onClick={() => { removeTab(entityId); }}
          className="flex items-center justify-center text-[var(--bone-100)] rounded-[6px] shrink-0 opacity-60 hover:opacity-100 hover:bg-[var(--bone-12)]"
          style={{ width: 24, height: 24 }}
          title="Close"
        >
          <X strokeWidth={2.5} className="w-3.5 h-3.5" />
        </button>

        {/* Pin button — only on right column header */}
        {column === 'right' && (
          <button
            onClick={e => { e.stopPropagation(); togglePin(); }}
            className={cn(
              "flex items-center justify-center text-[var(--bone-100)] rounded-[10px] shrink-0",
              splitViewPinned
                ? "bg-[var(--bone-10)]"
                : "hover:bg-[var(--bone-6)]"
            )}
            style={{ width: 28, height: 28 }}
            title={splitViewPinned ? "Unpin pair" : "Pin pair"}
          >
            <Pin strokeWidth={2} className="w-4 h-4" fill={splitViewPinned ? "currentColor" : "none"} />
          </button>
        )}

        {/* Exit split view — only on right column header */}
        {column === 'right' && (
          <button
            onClick={e => { e.stopPropagation(); toggleSplitView(); }}
            className="flex items-center justify-center text-[var(--bone-100)] rounded-[10px] shrink-0 bg-[var(--bone-6)] hover:bg-[var(--bone-12)]"
            style={{ width: 28, height: 28 }}
            title="Exit split view"
          >
            <Columns2 strokeWidth={2} className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

export default ColumnHeader;
```

Note: `Pin` icon needs to be added to lucide-react imports. We'll use `Pin` and `PinOff` from lucide-react. Actually, the spec says "Pin button shows filled icon when pinned, outlined when false" — so use `Pin` with `fill` attribute.

- [ ] **Step 2: Run TypeScript check for ColumnHeader**

Run: `npx tsc --noEmit 2>&1 | Select-String -Pattern "ColumnHeader" | Select-Object -First 10`
Expected: Zero errors for ColumnHeader

---

### Task 4: Create `ColumnPlaceholder.tsx`

**Files:**
- Create: `src/components/layout/ColumnPlaceholder.tsx`

- [ ] **Step 1: Write the ColumnPlaceholder component**

```tsx
"use client";

import { useStore, generateId } from '@/data/store';
import { Search, FileText, Frame } from 'lucide-react';
import { getEntityIcon } from '@/data/icons';
import { stripHtml } from '@/lib/utils';
import { useState } from 'react';

interface ColumnPlaceholderProps {
  column: 'left' | 'right';
  onOpenEntity: (entityId: string) => void;
}

export function ColumnPlaceholder({ column, onOpenEntity }: ColumnPlaceholderProps) {
  const entities = useStore(s => s.entities);
  const recentEntityIds = useStore(s => s.recentEntityIds);
  const addEntity = useStore(s => s.addEntity);
  const setActiveEntityId = useStore(s => s.setActiveEntityId);
  const [searchQuery, setSearchQuery] = useState('');

  const recentEntities = recentEntityIds
    .map(id => entities.find(e => e.id === id))
    .filter((e): e is NonNullable<typeof e> => !!e)
    .slice(0, 3);

  const searchResults = searchQuery.trim()
    ? entities
        .filter(e =>
          e.type === 'note' || e.type === 'canvas'
        )
        .filter(e =>
          e.title.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .slice(0, 5)
    : [];

  const handleNewEntity = (type: 'note' | 'canvas') => {
    const newId = generateId();
    addEntity({
      id: newId,
      title: `Untitled ${type === 'note' ? 'Note' : 'Canvas'}`,
      type,
      parentId: null,
      lastModified: Date.now(),
    });
    onOpenEntity(newId);
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 gap-6 min-h-0 overflow-y-auto">
      {/* Logo */}
      <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-[var(--bone-6)] mb-2">
        <span
          className="font-bold text-[var(--bone-60)] select-none"
          style={{ fontSize: 28, lineHeight: 1 }}
        >
          F
        </span>
      </div>

      {/* Quick action buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => handleNewEntity('note')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--bone-6)] hover:bg-[var(--bone-10)] text-[var(--bone-100)] text-sm font-medium transition-colors"
        >
          <FileText strokeWidth={2} className="w-4 h-4" />
          New Note
        </button>
        <button
          onClick={() => handleNewEntity('canvas')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--bone-6)] hover:bg-[var(--bone-10)] text-[var(--bone-100)] text-sm font-medium transition-colors"
        >
          <Frame strokeWidth={2} className="w-4 h-4" />
          New Canvas
        </button>
      </div>

      {/* Search bar */}
      <div className="w-full max-w-[280px] relative">
        <Search
          strokeWidth={2}
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--bone-40)] pointer-events-none"
        />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search entities..."
          className="w-full pl-9 pr-4 py-2 rounded-xl bg-[var(--bone-4)] border border-[var(--bone-10)] text-[var(--bone-100)] text-sm placeholder:text-[var(--bone-30)] outline-none focus:border-[var(--bone-30)] transition-colors"
        />
        {/* Search results dropdown */}
        {searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 rounded-xl bg-[var(--app-background)] border border-[var(--bone-10)] shadow-lg overflow-hidden z-50">
            {searchResults.map(entity => {
              const Icon = entity.icon
                ? getEntityIcon(entity.icon)
                : entity.type === 'canvas' ? Frame : FileText;
              return (
                <button
                  key={entity.id}
                  onClick={() => {
                    onOpenEntity(entity.id);
                    setSearchQuery('');
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--bone-4)] text-sm text-[var(--bone-100)] transition-colors"
                >
                  <Icon strokeWidth={2} className="w-4 h-4 shrink-0 opacity-70" />
                  <span className="truncate">{stripHtml(entity.title)}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Instruction text */}
      <p className="text-xs text-[var(--bone-40)] text-center max-w-[240px] leading-relaxed">
        Drag and drop any entity from the sidebar to open it here
      </p>

      {/* Recent entities */}
      {recentEntities.length > 0 && (
        <div className="w-full max-w-[280px]">
          <p className="text-xs text-[var(--bone-30)] mb-2 ml-1">Recent</p>
          <div className="flex flex-col gap-1">
            {recentEntities.map(entity => {
              const Icon = entity.icon
                ? getEntityIcon(entity.icon)
                : entity.type === 'canvas' ? Frame : FileText;
              return (
                <button
                  key={entity.id}
                  onClick={() => onOpenEntity(entity.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[var(--bone-4)] text-sm text-[var(--bone-100)] transition-colors"
                >
                  <Icon strokeWidth={2} className="w-4 h-4 shrink-0 opacity-70" />
                  <span className="truncate">{stripHtml(entity.title)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default ColumnPlaceholder;
```

- [ ] **Step 2: Run TypeScript check for ColumnPlaceholder**

Run: `npx tsc --noEmit 2>&1 | Select-String -Pattern "ColumnPlaceholder" | Select-Object -First 10`
Expected: Zero errors

---

### Task 5: Rewrite `SplitViewLayout.tsx`

**Files:**
- Rewrite: `src/components/layout/SplitViewLayout.tsx`

- [ ] **Step 1: Write the new SplitViewLayout with drop targets and placeholder support**

Replace entire contents:

```tsx
"use client";

import { useRef, useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useStore } from '@/data/store';
import { EntityPageRenderer } from '@/components/EntityPageRenderer';
import { ColumnHeader } from './ColumnHeader';
import { ColumnPlaceholder } from './ColumnPlaceholder';
import { dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';

const COLLAPSE_THRESHOLD_PX = 180;
const MIN_COLUMN_PCT = 15;
const MAX_COLUMN_PCT = 85;

export function SplitViewLayout() {
  const splitViewLeftId = useStore(s => s.splitViewLeftId);
  const splitViewRightId = useStore(s => s.splitViewRightId);
  const splitViewPosition = useStore(s => s.splitViewPosition);
  const setSplitViewPosition = useStore(s => s.setSplitViewPosition);
  const setColumnEntity = useStore(s => s.setColumnEntity);
  const toggleSplitView = useStore(s => s.toggleSplitView);

  const containerRef = useRef<HTMLDivElement>(null);
  const leftColRef = useRef<HTMLDivElement>(null);
  const rightColRef = useRef<HTMLDivElement>(null);
  const isResizingRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const [isResizing, setIsResizing] = useState(false);

  // ── Drop targets for sidebar drag-and-drop ──
  useEffect(() => {
    const leftEl = leftColRef.current;
    const rightEl = rightColRef.current;
    if (!leftEl || !rightEl) return;

    const cleanupLeft = dropTargetForElements({
      element: leftEl,
      getData: () => ({ column: 'left' as const }),
      onDrop: ({ source }) => {
        const entityId = source.data.id as string;
        if (entityId) setColumnEntity('left', entityId);
      },
    });

    const cleanupRight = dropTargetForElements({
      element: rightEl,
      getData: () => ({ column: 'right' as const }),
      onDrop: ({ source }) => {
        const entityId = source.data.id as string;
        if (entityId) setColumnEntity('right', entityId);
      },
    });

    return () => {
      cleanupLeft();
      cleanupRight();
    };
  }, [setColumnEntity]);

  // ── Resize logic ──
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    setIsResizing(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return;
      if (!containerRef.current) return;
      if (rafRef.current) return;

      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;

        const rect = containerRef.current!.getBoundingClientRect();
        const pct = ((e.clientX - rect.left) / rect.width) * 100;
        const clamped = Math.max(MIN_COLUMN_PCT, Math.min(MAX_COLUMN_PCT, pct));
        setSplitViewPosition(clamped);
      });
    };

    const stopResize = () => {
      if (!isResizingRef.current) return;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }

      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const leftPx = (rect.width * splitViewPosition) / 100;
        if (leftPx < COLLAPSE_THRESHOLD_PX || (rect.width - leftPx) < COLLAPSE_THRESHOLD_PX) {
          isResizingRef.current = false;
          setIsResizing(false);
          document.body.style.cursor = '';
          document.body.style.userSelect = '';
          toggleSplitView();
          return;
        }
      }

      isResizingRef.current = false;
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', stopResize);
    window.addEventListener('mouseleave', stopResize);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', stopResize);
      window.removeEventListener('mouseleave', stopResize);
    };
  }, [setSplitViewPosition, splitViewPosition, toggleSplitView]);

  const clampedPosition = Math.max(MIN_COLUMN_PCT, Math.min(MAX_COLUMN_PCT, splitViewPosition));

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex-1 flex flex-row overflow-hidden relative min-h-0",
        isResizing && "select-none"
      )}
    >
      {/* ── Left Column ── */}
      <div
        ref={leftColRef}
        className="flex flex-col h-full min-h-0 bg-[var(--app-background)]"
        style={{
          width: `${clampedPosition}%`,
          transition: isResizing ? 'none' : undefined,
        }}
      >
        <ColumnHeader column="left" entityId={splitViewLeftId} />
        {splitViewLeftId ? (
          <div className="flex-1 overflow-y-auto min-h-0">
            <EntityPageRenderer entityId={splitViewLeftId} />
          </div>
        ) : (
          <ColumnPlaceholder
            column="left"
            onOpenEntity={(entityId) => setColumnEntity('left', entityId)}
          />
        )}
      </div>

      {/* ── Divider ── */}
      <div
        onMouseDown={handleMouseDown}
        className={cn(
          "w-[6px] h-full cursor-col-resize shrink-0 z-50 flex items-center justify-center transition-colors duration-200 group",
          isResizing ? "bg-[var(--bone-15)]" : "bg-transparent hover:bg-[var(--bone-6)]"
        )}
      >
        <div
          className={cn(
            "h-full w-[2px] rounded-full transition-all duration-200",
            isResizing
              ? "bg-[var(--bone-70)]"
              : "bg-[var(--bone-30)] group-hover:bg-[var(--bone-50)] group-hover:w-[3px]"
          )}
        />
      </div>

      {/* ── Right Column ── */}
      <div
        ref={rightColRef}
        className="flex flex-col h-full min-h-0 flex-1"
        style={{ background: 'var(--app-background)' }}
      >
        <ColumnHeader column="right" entityId={splitViewRightId} />
        {splitViewRightId ? (
          <div className="flex-1 overflow-y-auto min-h-0">
            <EntityPageRenderer entityId={splitViewRightId} />
          </div>
        ) : (
          <ColumnPlaceholder
            column="right"
            onOpenEntity={(entityId) => setColumnEntity('right', entityId)}
          />
        )}
      </div>
    </div>
  );
}

export default SplitViewLayout;
```

- [ ] **Step 2: Run TypeScript check for SplitViewLayout**

Run: `npx tsc --noEmit 2>&1 | Select-String -Pattern "SplitViewLayout" | Select-Object -First 10`
Expected: Zero errors

---

### Task 6: Update `Shell.tsx`

**Files:**
- Modify: `src/components/layout/Shell.tsx:205-207, 411`

- [ ] **Step 1: Update split view subscription and conditional**

In `Shell.tsx`, replace the old split view subscriptions:

```tsx
// Remove:
// const isSplitView = useStore(state => state.isSplitView);
// const splitViewLeftId = useStore(state => state.splitViewLeftId);
// const splitViewRightId = useStore(state => state.splitViewRightId);

// Add:
const splitViewActive = useStore(state => state.splitViewActive);
```

Then update the conditional (line ~411):

```tsx
// Replace:
// {isSplitView && splitViewLeftId && splitViewRightId ? (

// With:
{splitViewActive ? (
```

Remove unused `splitViewPosition` and `setSplitViewPosition` subscriptions if present.

- [ ] **Step 2: Run TypeScript check for Shell**

Run: `npx tsc --noEmit 2>&1 | Select-String -Pattern "Shell" | Select-Object -First 10`
Expected: Zero Shell-related errors

---

### Task 7: Clean Up `HeaderBar.tsx`

**Files:**
- Modify: `src/components/layout/HeaderBar.tsx`

- [ ] **Step 1: Remove split view subscriptions and column indicator strips**

In `HeaderBar.tsx`:

Remove the old split subscriptions:
```tsx
// Remove:
// const isSplitView          = useStore(s => s.isSplitView);
// const splitViewLeftId      = useStore(s => s.splitViewLeftId);
// const splitViewRightId     = useStore(s => s.splitViewRightId);
// const assignTabToColumn    = useStore(s => s.assignTabToColumn);

// Keep toggleSplitView subscription
```

Remove the column indicator strip JSX inside the tab rendering loop. Remove the `isLeftColTab`/`isRightColTab` variables and the separator div:

```tsx
// Remove these lines:
// const isLeftColTab = isSplitView && tabId === splitViewLeftId;
// const isRightColTab = isSplitView && tabId === splitViewRightId;

// Remove the separator:
// {isRightColTab && (
//   <div key={`col-sep-${tabId}`} ...
// />

// Remove the column indicator strip:
// {isSplitView && (isLeftColTab || isRightColTab) && (
//   <div className="absolute top-0 inset-x-0 ..." />
// )}
```

- [ ] **Step 2: Update Columns2 button visibility**

The Columns2 button should still show when `openTabIds.length >= 1` (not `> 1`). Actually — the spec says "1+ tabs are open" — so keep it as `openTabIds.length > 0`:

```tsx
{/* Show Columns2 button when any tabs are open */}
{openTabIds.length > 0 && (
  <div ...>
    <button
      onClick={e => { e.stopPropagation(); toggleSplitView(); }}
      className={cn(
        "flex items-center justify-center text-[var(--bone-100)] rounded-[10px] shrink-0 [-webkit-app-region:no-drag]",
        // No splitViewActive check needed — button is always the same style
        "hover:bg-[var(--bone-6)]"
      )}
      style={{ width: 28, height: 28 }}
      title="Split view"
    >
      <Columns2 strokeWidth={2} className="w-4 h-4"/>
    </button>
  </div>
)}
```

Also update the `data-split-col` attributes — remove them (no longer needed).

- [ ] **Step 3: Run TypeScript check for HeaderBar**

Run: `npx tsc --noEmit 2>&1 | Select-String -Pattern "HeaderBar" | Select-Object -First 10`
Expected: Zero HeaderBar-related errors

---

### Task 8: Full TypeScript Check and Commit

**Files:**
- Various

- [ ] **Step 1: Run full TypeScript check**

Run: `npx tsc --noEmit`
Expected: Zero errors across all files

- [ ] **Step 2: Run the app and verify basic functionality**

Ask the user to test:
1. Open 2+ tabs → Columns2 button visible
2. Click Columns2 → left shows active tab, right shows placeholder
3. Click "New Note" in placeholder → opens in right column
4. Click pin button → pin icon fills
5. Close split view (Columns2 button in right header)
6. Reopen paired entity → auto-splits with partner

- [ ] **Step 3: Commit all changes**

```bash
git add src/data/store.types.ts src/data/store.ts \
  src/components/layout/ColumnHeader.tsx \
  src/components/layout/ColumnPlaceholder.tsx \
  src/components/layout/SplitViewLayout.tsx \
  src/components/layout/Shell.tsx \
  src/components/layout/HeaderBar.tsx
git commit -m "feat: implement split view v3 paired columns"
```
