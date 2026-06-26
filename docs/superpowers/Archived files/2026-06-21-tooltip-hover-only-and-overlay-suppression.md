# Tooltip Hover-Only & Overlay Suppression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make all tooltips show only on hover, and auto-hide/suppress when any overlay (popup, menu, modal, drag) is active.

**Architecture:** Create a `TooltipOverlayContext` that tracks active overlays via a Set of IDs. The provider auto-tracks global overlays (modal, contextMenu from zustand store) and exposes `useTooltipSuppression(active)` hook for local overlays. The `Tooltip` component subscribes to `isSuppressed` — hides immediately when any overlay is active, and won't show new ones.

**Tech Stack:** React Context + zustand (auto-track global overlays)

## Global Constraints

- All tooltips must show only on mouse hover (not keyboard focus)
- Any visible tooltip must hide immediately when an overlay activates
- No new tooltips may appear while any overlay is active
- Native `title` attributes (which show on focus) must be removed

---
### Task 1: Create TooltipOverlayContext

**Files:**
- Create: `src/components/layout/TooltipOverlayContext.tsx`

**Interfaces:**
- Consumes: zustand store for `modal`, `contextMenu`, `taskContextMenu`
- Produces: `TooltipOverlayProvider` (JSX component), `useTooltipOverlay()` (hook returning `{ isSuppressed, registerOverlay, unregisterOverlay }`), `useTooltipSuppression(active: boolean)` (convenience hook)

- [ ] **Step 1: Write the context file**

```tsx
'use client';

import React, { createContext, useContext, useCallback, useRef, useState, useEffect, useMemo } from 'react';
import { useStore } from '@/data/store';

interface TooltipOverlayContextValue {
  isSuppressed: boolean;
  registerOverlay: (id: string) => void;
  unregisterOverlay: (id: string) => void;
}

const TooltipOverlayContext = createContext<TooltipOverlayContextValue>({
  isSuppressed: false,
  registerOverlay: () => {},
  unregisterOverlay: () => {},
});

export function useTooltipOverlay() {
  return useContext(TooltipOverlayContext);
}

/**
 * Register an overlay ID while `active` is true. The overlay is unregistered
 * when `active` becomes false or the component unmounts.
 */
export function useTooltipSuppression(active: boolean) {
  const { registerOverlay, unregisterOverlay } = useTooltipOverlay();
  const idRef = useRef<string>('');

  useEffect(() => {
    if (active) {
      if (!idRef.current) {
        idRef.current = `overlay-${Math.random().toString(36).slice(2, 9)}`;
      }
      registerOverlay(idRef.current);
      return () => unregisterOverlay(idRef.current);
    }
  }, [active, registerOverlay, unregisterOverlay]);
}

export function TooltipOverlayProvider({ children }: { children: React.ReactNode }) {
  const [overlayIds, setOverlayIds] = useState<Set<string>>(new Set());

  // Auto-track global store overlays (modals, context menus)
  const modal = useStore(s => s.modal);
  const contextMenu = useStore(s => s.contextMenu);
  const taskContextMenu = useStore(s => s.taskContextMenu);
  const hasGlobalOverlay = !!(modal || contextMenu || taskContextMenu);

  useEffect(() => {
    if (hasGlobalOverlay) {
      setOverlayIds(prev => new Set(prev).add('__global__'));
      return () => {
        setOverlayIds(prev => {
          const next = new Set(prev);
          next.delete('__global__');
          return next;
        });
      };
    }
  }, [hasGlobalOverlay]);

  const registerOverlay = useCallback((id: string) => {
    setOverlayIds(prev => new Set(prev).add(id));
  }, []);

  const unregisterOverlay = useCallback((id: string) => {
    setOverlayIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const value = useMemo<TooltipOverlayContextValue>(() => ({
    isSuppressed: overlayIds.size > 0,
    registerOverlay,
    unregisterOverlay,
  }), [overlayIds.size, registerOverlay, unregisterOverlay]);

  return (
    <TooltipOverlayContext.Provider value={value}>
      {children}
    </TooltipOverlayContext.Provider>
  );
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd /Users/mktsoy/Dev/flowr-app && npx tsc --noEmit --pretty 2>&1 | head -30
```
Expected: No errors for TooltipOverlayContext.tsx

- [ ] **Step 3: Commit**

```bash
cd /Users/mktsoy/Dev/flowr-app && git add src/components/layout/TooltipOverlayContext.tsx && git commit -m "feat: add TooltipOverlayContext for centralized overlay suppression

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---
### Task 2: Update Tooltip component + Shell provider

**Files:**
- Modify: `src/components/layout/Tooltip.tsx`
- Modify: `src/components/layout/Shell.tsx`

**Interfaces:**
- Consumes: `useTooltipOverlay()` from Task 1
- Produces: Updated `<Tooltip>` that hides on pointerdown and when suppressed; `<Shell>` wrapped with `TooltipOverlayProvider`

- [ ] **Step 1: Add context subscription + onPointerDown to Tooltip**

Replace the existing imports section (lines 1-5) and add the context subscription logic.

Changes to `Tooltip.tsx`:
1. Add import: `import { useTooltipOverlay } from './TooltipOverlayContext';`
2. Inside the component, add: `const { isSuppressed } = useTooltipOverlay();`
3. Add an `onPointerDown` handler that hides the tooltip:

```tsx
const handlePointerDown = () => {
  if (timerRef.current) clearTimeout(timerRef.current);
  setIsVisible(false);
  setHasCalculated(false);
};
```

4. In the `handleMouseEnter` function, add a check at the top:

```tsx
const handleMouseEnter = () => {
  if (disabled || !content || isSuppressed) return;
  // ... rest of existing function
};
```

5. Add a `useEffect` to hide when suppression activates:

```tsx
useEffect(() => {
  if (isSuppressed && isVisible) {
    setIsVisible(false);
    setHasCalculated(false);
    if (timerRef.current) clearTimeout(timerRef.current);
  }
}, [isSuppressed, isVisible]);
```

6. For non-React-element children (the `<span>` wrapper), add `onPointerDown={handlePointerDown}`:

Replace:
```tsx
< span
  ref={triggerRef as any}
  className="inline-block"
  onMouseEnter={handleMouseEnter}
  onMouseLeave={handleMouseLeave}
  onClickCapture={handleClick}
>
```
With:
```tsx
<span
  ref={triggerRef as any}
  className="inline-block"
  onMouseEnter={handleMouseEnter}
  onMouseLeave={handleMouseLeave}
  onClickCapture={handleClick}
  onPointerDown={handlePointerDown}
>
```

7. For React-element children, clone the pointerdown event in the same way as click:

Replace:
```tsx
return (
  <>
    {React.cloneElement(child, {
      ref: setRefs,
      onMouseEnter: (e: React.MouseEvent) => {
        child.props.onMouseEnter?.(e);
        handleMouseEnter();
      },
      onMouseLeave: (e: React.MouseEvent) => {
        child.props.onMouseLeave?.(e);
        handleMouseLeave();
      },
      onClick: (e: React.MouseEvent) => {
        child.props.onClick?.(e);
        handleClick();
      }
    })}
    {tooltipBody}
  </>
);
```
With:
```tsx
return (
  <>
    {React.cloneElement(child, {
      ref: setRefs,
      onMouseEnter: (e: React.MouseEvent) => {
        child.props.onMouseEnter?.(e);
        handleMouseEnter();
      },
      onMouseLeave: (e: React.MouseEvent) => {
        child.props.onMouseLeave?.(e);
        handleMouseLeave();
      },
      onClick: (e: React.MouseEvent) => {
        child.props.onClick?.(e);
        handleClick();
      },
      onPointerDown: (e: React.PointerEvent) => {
        child.props.onPointerDown?.(e);
        handlePointerDown();
      },
    })}
    {tooltipBody}
  </>
);
```

- [ ] **Step 2: Wrap Shell with TooltipOverlayProvider**

In `Shell.tsx`, add the import:
```tsx
import { TooltipOverlayProvider } from './TooltipOverlayContext';
```

Find the outermost return JSX in `Shell` (should be something like):
```tsx
return (
  <div className={...}>
```

Wrap the content:
```tsx
return (
  <TooltipOverlayProvider>
    <div className={...}>
      {/* existing content */}
    </div>
  </TooltipOverlayProvider>
);
```

- [ ] **Step 3: Verify compilation**

```bash
cd /Users/mktsoy/Dev/flowr-app && npx tsc --noEmit --pretty 2>&1 | head -30
```
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
cd /Users/mktsoy/Dev/flowr-app && git add src/components/layout/Tooltip.tsx src/components/layout/Shell.tsx && git commit -m "feat: subscribe Tooltip to overlay context, add pointerdown handler

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---
### Task 3: Integrate in NoteEditor — options menu, slash menu, and drag suppression

**Files:**
- Modify: `src/components/editor/NoteEditor.tsx`

**Interfaces:**
- Consumes: `useTooltipSuppression` from Task 1
- Local state: `activeOptionsMenu`, `slashMenu`, `isDragging` (already exist)

- [ ] **Step 1: Add suppression hook**

Add import:
```tsx
import { useTooltipSuppression } from '../layout/TooltipOverlayContext';
```

After the existing state declarations (around line 462 where `isDragging` is declared), add:

```tsx
// Suppress tooltips when any popup/menu is open or a drag is in progress
useTooltipSuppression(Boolean(activeOptionsMenu || slashMenu || isDragging));
```

- [ ] **Step 2: Verify compilation**

```bash
cd /Users/mktsoy/Dev/flowr-app && npx tsc --noEmit --pretty 2>&1 | head -30
```
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
cd /Users/mktsoy/Dev/flowr-app && git add src/components/editor/NoteEditor.tsx && git commit -m "feat: suppress tooltips during options menu, slash menu, and drag in NoteEditor

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---
### Task 4: Integrate in BlockRenderer — suppression + remove native title attributes

**Files:**
- Modify: `src/components/editor/BlockRenderer.tsx`

**Interfaces:**
- Consumes: `useTooltipSuppression` from Task 1, `isDraggingGlobal` prop (already exists)
- Removes: 12 native `title="..."` attributes

- [ ] **Step 1: Add suppression hook near top of component**

Add import (inside the file, with existing imports):
```tsx
import { useTooltipSuppression } from '../layout/TooltipOverlayContext';
```

Inside the `BlockRenderer` component function, add:
```tsx
useTooltipSuppression(isDraggingGlobal);
```

- [ ] **Step 2: Remove all native `title` attributes**

Find and remove ALL `title="Save"`, `title="Cancel"`, `title="Edit Label"`, `title="Edit URL"` occurrences. These appear in the three link-edit popover sections (around lines 655, 665, 706, 740, 750, 773, 1135, 1145, 1179, 1213, 1223, 1246).

For each one, simply delete the `title="..."` attribute from the `<button>` element.

Example — change this (line 655):
```tsx
className="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--bone-5)] text-green-500 hover:text-green-400 cursor-pointer"
title="Save"
>
```
To:
```tsx
className="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--bone-5)] text-green-500 hover:text-green-400 cursor-pointer"
>
```

- [ ] **Step 3: Verify compilation**

```bash
cd /Users/mktsoy/Dev/flowr-app && npx tsc --noEmit --pretty 2>&1 | head -30
```
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
cd /Users/mktsoy/Dev/flowr-app && git add src/components/editor/BlockRenderer.tsx && git commit -m "feat: suppress tooltips during block drag and remove native title attrs

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---
### Task 5: Remove native title attributes from DatabaseBlock and LinkPreview

**Files:**
- Modify: `src/components/editor/DatabaseBlock.tsx`
- Modify: `src/components/editor/LinkPreview.tsx`

- [ ] **Step 1: Remove 6 title attributes from DatabaseBlock**

In `DatabaseBlock.tsx`, find and remove these `title` attributes:
- line 134: `title="Move left"`
- line 141: `title="Move right"`
- line 148: `title="Delete column"`
- line 206: `title="Move up"`
- line 213: `title="Move down"`
- line 220: `title="Delete row"`

For each, simply delete the `title="..."` string from the `<button>` element.

- [ ] **Step 2: Remove 2 title attributes from LinkPreview**

In `LinkPreview.tsx`, find and remove:
- line 72: `title="Copy Link"`
- line 79: `title="Remove Link"`

Simply delete the `title="..."` string from each `<button>`.

- [ ] **Step 3: Verify compilation**

```bash
cd /Users/mktsoy/Dev/flowr-app && npx tsc --noEmit --pretty 2>&1 | head -30
```
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
cd /Users/mktsoy/Dev/flowr-app && git add src/components/editor/DatabaseBlock.tsx src/components/editor/LinkPreview.tsx && git commit -m "fix: remove native title attributes that show on focus

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---
### Task 6: Integrate in SelectionToolbar — link/highlight popover suppression

**Files:**
- Modify: `src/components/editor/SelectionToolbar.tsx`

**Interfaces:**
- Consumes: `useTooltipSuppression` from Task 1
- Local state: `showLinkPopover`, `showHighlightPicker` (already exist)

- [ ] **Step 1: Add suppression hook**

Add import:
```tsx
import { useTooltipSuppression } from '../layout/TooltipOverlayContext';
```

Add the hook call inside the SelectionToolbar component function (before the early return):
```tsx
// When link popover or highlight picker is open, suppress tooltip on the trigger buttons
useTooltipSuppression(Boolean(showLinkPopover || showHighlightPicker));
```

- [ ] **Step 2: Verify compilation**

```bash
cd /Users/mktsoy/Dev/flowr-app && npx tsc --noEmit --pretty 2>&1 | head -30
```
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
cd /Users/mktsoy/Dev/flowr-app && git add src/components/editor/SelectionToolbar.tsx && git commit -m "feat: suppress tooltips during link popover and highlight picker

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---
### Task 7: Integrate in Sidebar — drag state suppression

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`

**Interfaces:**
- Consumes: `useTooltipSuppression` from Task 1
- Local state: `activeDragId` (already exists at line 109)

- [ ] **Step 1: Add suppression hook**

Add import:
```tsx
import { useTooltipSuppression } from './TooltipOverlayContext';
```

Add the hook call after `activeDragId` is declared (around line 110):
```tsx
const [activeDragId, setActiveDragId] = useState<string | null>(null);
// Suppress tooltips while any sidebar item is being dragged
useTooltipSuppression(activeDragId !== null);
```

- [ ] **Step 2: Verify compilation**

```bash
cd /Users/mktsoy/Dev/flowr-app && npx tsc --noEmit --pretty 2>&1 | head -30
```
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
cd /Users/mktsoy/Dev/flowr-app && git add src/components/layout/Sidebar.tsx && git commit -m "feat: suppress tooltips during sidebar drag operations

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---
## Verification

1. Run the dev server:
```bash
cd /Users/mktsoy/Dev/flowr-app && npm run dev
```

2. Navigate to a notes page and confirm:
   - Hovering toolbar buttons shows tooltip after 500ms
   - Clicking "Bold" etc. hides the tooltip
   - Clicking the link button opens the link popover → tooltip hides
   - While link popover or highlight picker is open, hovering toolbar buttons shows no tooltip
   - Clicking a block's "Drag / Options" button opens the options menu → tooltip hides
   - While options menu is open, hovering other elements shows no tooltip
   - Dragging a block → tooltip suppressed during drag
   - Opening a context menu → tooltip suppressed
   - Opening a modal → tooltip suppressed

3. Navigate to dashboard with collapsed sidebar:
   - Hover sidebar icons → tooltip appears
   - Drag a sidebar item → tooltip suppressed during drag

4. Open a page with a database block and inline link:
   - Hovering the database control buttons shows no native tooltip (title removed)
   - Tab to any button → no native tooltip appears (removed title)
