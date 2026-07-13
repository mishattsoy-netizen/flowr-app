# Header Button & Tab Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every square icon-button in the app's headers (single-column `HeaderBar`, desktop split-view inline in `HeaderBar`, and web split-view `ColumnHeader`) share one size/icon/corner-radius spec, align tab-adjacent buttons to the tab's baseline, unify left-padding rules, match split-view bar height to single-view, and scope the "Reset ratio" hover-reveal to the split-controls cluster only.

**Architecture:** This is a styling-only change across two existing files — `src/components/layout/HeaderBar.tsx` (handles both single-column mode AND desktop split-view, since `ColumnHeader` is web-only) and `src/components/layout/ColumnHeader.tsx` (web split-view only, one instance per column via `SplitViewLayout.tsx`). No new components, no logic changes, no store changes.

**Tech Stack:** React, Tailwind CSS (with inline `style` for numeric px values), `lucide-react` icons, `cn()` classname helper.

---

## Context: three header render paths, not two

Reading the code turned up a detail that changes scope slightly from the original design doc: `ColumnHeader.tsx` is only rendered when `!isDesktopEnv` (see `src/components/layout/SplitViewLayout.tsx:171,224`). On desktop, split-view header content is rendered **inline inside `HeaderBar.tsx`** (lines ~732-784), reusing the `EntityHeaderControls` and `StaticTabPill` helper components defined at the top of that same file. So there are three render paths to fix, not two:

1. **Single-column mode** — `HeaderBar.tsx`, the `openTabIds.map(...)` tab strip + its own Plus button (~line 553-730)
2. **Desktop split-view** — `HeaderBar.tsx`, the `splitViewActive` inline block (~line 732-784), using `EntityHeaderControls` (~line 53-101) and `StaticTabPill` (~line 103-186)
3. **Web split-view** — `ColumnHeader.tsx`, the whole file

`EntityHeaderControls` is shared between path 1 (single-column tab controls via a separate render, see below) and path 2 — actually on inspection, path 1 doesn't currently use `EntityHeaderControls` at all; only path 2 (desktop split) does. Single-column mode has no per-tab Options/Read-Edit buttons in the tab strip today — confirmed by reading `HeaderBar.tsx:569-712`, which renders only the tab pill and close button, no Options/Read-Edit. This is existing behavior and out of scope to change.

---

## Task 1: Fix Reset-ratio hover scope (already done, verify + commit)

**Files:**
- Modify: `src/components/layout/HeaderBar.tsx:504,789-790`

This was already edited in the current working tree. Verify it's correct and commit it as its own change before starting the broader consistency work, so it's isolated in history.

- [ ] **Step 1: Verify the current diff**

Run: `git diff src/components/layout/HeaderBar.tsx`

Expected: shows `group/header` → unchanged at line 504 (still present, now unused — that's fine, harmless), and at the split-controls wrapper (~line 789) `group/header` renamed to `group/splitctrls`, and the Reset-ratio inner div's `group-hover/header:opacity-100` renamed to `group-hover/splitctrls:opacity-100`.

- [ ] **Step 2: Manually verify in the running app**

Run the dev server (check for an existing `run` skill or `package.json` scripts first). Open split view with two panes. Hover over empty header space away from the Pin/Swap/Exit/Split cluster — Reset-ratio button must stay hidden. Hover directly over the Pin/Swap/Exit cluster — Reset-ratio button must fade in.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/HeaderBar.tsx
git commit -m "fix: scope reset-ratio button reveal to split controls hover only"
```

---

## Task 2: Unify Options icon to MoreVertical

**Files:**
- Modify: `src/components/layout/HeaderBar.tsx:6-10` (import), `:83` (usage)
- Verify only (already correct): `src/components/layout/ColumnHeader.tsx:6,147`

- [ ] **Step 1: Update the lucide-react import in HeaderBar.tsx**

Current (`HeaderBar.tsx:5-10`):
```tsx
import {
  ArrowLeft, ArrowRight, RotateCw, RotateCcw, Home, MessageCircle,
  ListTodo, Menu, X, ChevronRight, ChevronLeft, Plus, PanelLeft, Columns2,
  File, Frame, Folder, Search, Pin, ArrowLeftRight,
  MoreVertical, BookOpen, Pencil, MoreHorizontal
} from 'lucide-react';
```

Change to:
```tsx
import {
  ArrowLeft, ArrowRight, RotateCw, RotateCcw, Home, MessageCircle,
  ListTodo, Menu, X, ChevronRight, ChevronLeft, Plus, PanelLeft, Columns2,
  File, Frame, Folder, Search, Pin, ArrowLeftRight,
  MoreVertical, BookOpen, Pencil
} from 'lucide-react';
```

(Drops the now-unused `MoreHorizontal` import.)

- [ ] **Step 2: Swap the icon in EntityHeaderControls**

Current (`HeaderBar.tsx:83`):
```tsx
          <MoreHorizontal className="w-4 h-4" />
```

Change to:
```tsx
          <MoreVertical className="w-4 h-4" />
```

- [ ] **Step 3: Confirm ColumnHeader.tsx already uses MoreVertical (no change needed)**

Run: `grep -n "MoreVertical\|MoreHorizontal" src/components/layout/ColumnHeader.tsx`

Expected: only `MoreVertical` appears (import at line 6, usage at line 147). No edit needed here.

- [ ] **Step 4: Manually verify**

Open a Note or Canvas tab in single-column mode's desktop split view (the Options button only renders for non-dashboard/chat/tracker entities via `EntityHeaderControls`). Confirm the Options button now shows a vertical three-dot icon (⋮), matching the icon already used in web split-view.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/HeaderBar.tsx
git commit -m "fix: use MoreVertical icon for options button in desktop split header"
```

---

## Task 3: Unify square-button spec in ColumnHeader.tsx (web split-view)

**Files:**
- Modify: `src/components/layout/ColumnHeader.tsx`

`ColumnHeader.tsx` currently hardcodes `w-7 h-7` (no desktop variant — but this file only renders on web anyway, per `SplitViewLayout.tsx`, so `w-7 h-7`/28px stays correct for the Options/Read-Edit/Plus buttons already). The buttons that need fixing are the **right-side cluster** (Pin/Swap/Exit) at lines 255-298 and 327-339, which use hardcoded `w-[28px] h-[28px]` via inline `style` and `rounded-[6px]` instead of `rounded-[var(--radius-medium)]`, plus icon size `w-4 h-4` (already correct) — only the corner radius and the sizing mechanism need to change for consistency with the rest of the file's buttons (which use Tailwind width/height classes, not inline style).

- [ ] **Step 1: Fix the Pin button (right column, connected state)**

Current (`ColumnHeader.tsx:256-275`):
```tsx
            {column === 'right' && !['dashboard', 'chat', 'tracker'].includes(splitViewLeftId || '') && !['dashboard', 'chat', 'tracker'].includes(splitViewRightId || '') && (
              <Tooltip content={splitViewPinned ? "Unpin pair" : "Pin pair"}>
                <button
                  onClick={e => { e.stopPropagation(); togglePin(); }}
                  className={cn(
                    "flex items-center justify-center text-[var(--bone-100)] rounded-[6px] shrink-0 z-10",
                    splitViewPinned
                      ? "bg-[var(--bone-10)]"
                      : "hover:bg-[var(--bone-6)]"
                  )}
                  style={{ width: 28, height: 28 }}
                >
                  <Pin
                    strokeWidth={2}
                    className="w-4 h-4"
                    fill={splitViewPinned ? "currentColor" : "none"}
                  />
                </button>
              </Tooltip>
            )}
```

Change to:
```tsx
            {column === 'right' && !['dashboard', 'chat', 'tracker'].includes(splitViewLeftId || '') && !['dashboard', 'chat', 'tracker'].includes(splitViewRightId || '') && (
              <Tooltip content={splitViewPinned ? "Unpin pair" : "Pin pair"}>
                <button
                  onClick={e => { e.stopPropagation(); togglePin(); }}
                  className={cn(
                    "flex items-center justify-center w-7 h-7 rounded-[var(--radius-medium)] text-[var(--bone-100)] shrink-0 z-10 transition-colors",
                    splitViewPinned
                      ? "bg-[var(--bone-10)]"
                      : "hover:bg-[var(--bone-6)]"
                  )}
                >
                  <Pin
                    strokeWidth={2}
                    className="w-4 h-4"
                    fill={splitViewPinned ? "currentColor" : "none"}
                  />
                </button>
              </Tooltip>
            )}
```

- [ ] **Step 2: Fix the Swap button**

Current (`ColumnHeader.tsx:276-286`):
```tsx
            {column === 'right' && (
              <Tooltip content="Swap columns">
                <button
                  onClick={e => { e.stopPropagation(); swapColumns(); }}
                  className="flex items-center justify-center text-[var(--bone-100)] rounded-[6px] shrink-0 hover:bg-[var(--bone-6)] z-10"
                  style={{ width: 28, height: 28 }}
                >
                  <ArrowLeftRight strokeWidth={2} className="w-4 h-4" />
                </button>
              </Tooltip>
            )}
```

Change to:
```tsx
            {column === 'right' && (
              <Tooltip content="Swap columns">
                <button
                  onClick={e => { e.stopPropagation(); swapColumns(); }}
                  className="flex items-center justify-center w-7 h-7 rounded-[var(--radius-medium)] text-[var(--bone-100)] shrink-0 hover:bg-[var(--bone-6)] z-10 transition-colors"
                >
                  <ArrowLeftRight strokeWidth={2} className="w-4 h-4" />
                </button>
              </Tooltip>
            )}
```

- [ ] **Step 3: Fix the Exit split view button (connected-column variant, lines 287-297)**

Current (`ColumnHeader.tsx:287-297`):
```tsx
            {column === 'right' && (
              <Tooltip content="Exit split view">
                <button
                  onClick={e => { e.stopPropagation(); toggleSplitView(); }}
                  className="flex items-center justify-center text-[var(--bone-100)] rounded-[6px] shrink-0 bg-[var(--bone-6)] hover:bg-[var(--bone-12)] z-10"
                  style={{ width: 28, height: 28 }}
                >
                  <Columns2 strokeWidth={2} className="w-4 h-4" />
                </button>
              </Tooltip>
            )}
```

Change to:
```tsx
            {column === 'right' && (
              <Tooltip content="Exit split view">
                <button
                  onClick={e => { e.stopPropagation(); toggleSplitView(); }}
                  className="flex items-center justify-center w-7 h-7 rounded-[var(--radius-medium)] text-[var(--bone-100)] shrink-0 bg-[var(--bone-6)] hover:bg-[var(--bone-12)] z-10 transition-colors"
                >
                  <Columns2 strokeWidth={2} className="w-4 h-4" />
                </button>
              </Tooltip>
            )}
```

- [ ] **Step 4: Fix the Exit split view button (empty-column variant, lines 328-338)**

Current (`ColumnHeader.tsx:328-338`):
```tsx
            {column === 'right' && (
              <Tooltip content="Exit split view">
                <button
                  onClick={e => { e.stopPropagation(); toggleSplitView(); }}
                  className="flex items-center justify-center text-[var(--bone-100)] rounded-[6px] shrink-0 bg-[var(--bone-6)] hover:bg-[var(--bone-12)]"
                  style={{ width: 28, height: 28 }}
                >
                  <Columns2 strokeWidth={2} className="w-4 h-4" />
                </button>
              </Tooltip>
            )}
```

Change to:
```tsx
            {column === 'right' && (
              <Tooltip content="Exit split view">
                <button
                  onClick={e => { e.stopPropagation(); toggleSplitView(); }}
                  className="flex items-center justify-center w-7 h-7 rounded-[var(--radius-medium)] text-[var(--bone-100)] shrink-0 bg-[var(--bone-6)] hover:bg-[var(--bone-12)] transition-colors"
                >
                  <Columns2 strokeWidth={2} className="w-4 h-4" />
                </button>
              </Tooltip>
            )}
```

- [ ] **Step 5: Manually verify**

Open web build (`isDesktop()` returns false), enter split view, open Note/Canvas in both columns. Confirm Pin/Swap/Exit buttons now have the same rounded corner style as Options/Read-Edit/Plus buttons in the same header (`var(--radius-medium)` instead of a sharper `6px`).

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/ColumnHeader.tsx
git commit -m "fix: unify web split-header trailing buttons to shared radius/size spec"
```

---

## Task 4: Unify square-button spec in HeaderBar.tsx (desktop split-controls + collapsed-sidebar buttons)

**Files:**
- Modify: `src/components/layout/HeaderBar.tsx:513-531` (collapsed-sidebar Search/PanelLeft), `:790-813` (Reset ratio/Pin/Swap/Exit)

The desktop split-controls cluster (Reset ratio/Pin/Swap/Exit) already uses `rounded-[var(--radius-medium)]` and `w-8 h-8`/`w-7 h-7` sizing — correct per spec — but its icons are oversized at `w-[18px] h-[18px]` instead of the standard `w-4 h-4` (16px) used everywhere else. The collapsed-sidebar Search/PanelLeft buttons use hardcoded `rounded-[6px]` and inline `style={{ width: 28, height: 28 }}` instead of the shared Tailwind class pattern.

- [ ] **Step 1: Fix icon sizes in the desktop split-controls cluster**

Current (`HeaderBar.tsx:790-813`):
```tsx
          <div className="flex items-center opacity-0 group-hover/splitctrls:opacity-100 transition-opacity">
            <Tooltip content="Reset ratio">
              <button onClick={() => setSplitViewPosition(50)} className={`flex items-center justify-center text-[var(--bone-100)] rounded-[var(--radius-medium)] shrink-0 opacity-70 hover:opacity-100 hover:bg-[var(--bone-6)] transition-opacity ${isDesktopEnv ? 'w-8 h-8' : 'w-7 h-7'}`}>
                 <RotateCcw strokeWidth={2} className="w-[18px] h-[18px]" />
              </button>
            </Tooltip>
          </div>
          {splitViewLeftId && splitViewRightId && (
            <Tooltip content={splitViewPinned ? "Unpin pair" : "Pin pair"}>
              <button onClick={togglePin} className={cn(`flex items-center justify-center text-[var(--bone-100)] rounded-[var(--radius-medium)] shrink-0 transition-opacity ${isDesktopEnv ? 'w-8 h-8' : 'w-7 h-7'}`, splitViewPinned ? "bg-[var(--bone-10)] opacity-100 hover:bg-[var(--bone-12)]" : "opacity-70 hover:opacity-100 hover:bg-[var(--bone-6)]")}>
                 <Pin strokeWidth={2} className="w-[18px] h-[18px]" fill={splitViewPinned ? "currentColor" : "none"} />
              </button>
            </Tooltip>
          )}
          <Tooltip content="Swap columns">
            <button onClick={swapColumns} className={`flex items-center justify-center text-[var(--bone-100)] rounded-[var(--radius-medium)] shrink-0 opacity-70 hover:opacity-100 hover:bg-[var(--bone-6)] transition-opacity ${isDesktopEnv ? 'w-8 h-8' : 'w-7 h-7'}`}>
               <ArrowLeftRight strokeWidth={2} className="w-[18px] h-[18px]" />
            </button>
          </Tooltip>
          <Tooltip content="Exit split view">
            <button onClick={toggleSplitView} className={`flex items-center justify-center text-[var(--bone-100)] rounded-[var(--radius-medium)] shrink-0 bg-[var(--bone-10)] opacity-100 hover:bg-[var(--bone-12)] transition-opacity ${isDesktopEnv ? 'w-8 h-8' : 'w-7 h-7'}`}>
               <Columns2 strokeWidth={2} className="w-[18px] h-[18px]" />
            </button>
          </Tooltip>
```

Change to (only the icon `className` values change, `w-[18px] h-[18px]` → `w-4 h-4`):
```tsx
          <div className="flex items-center opacity-0 group-hover/splitctrls:opacity-100 transition-opacity">
            <Tooltip content="Reset ratio">
              <button onClick={() => setSplitViewPosition(50)} className={`flex items-center justify-center text-[var(--bone-100)] rounded-[var(--radius-medium)] shrink-0 opacity-70 hover:opacity-100 hover:bg-[var(--bone-6)] transition-opacity ${isDesktopEnv ? 'w-8 h-8' : 'w-7 h-7'}`}>
                 <RotateCcw strokeWidth={2} className="w-4 h-4" />
              </button>
            </Tooltip>
          </div>
          {splitViewLeftId && splitViewRightId && (
            <Tooltip content={splitViewPinned ? "Unpin pair" : "Pin pair"}>
              <button onClick={togglePin} className={cn(`flex items-center justify-center text-[var(--bone-100)] rounded-[var(--radius-medium)] shrink-0 transition-opacity ${isDesktopEnv ? 'w-8 h-8' : 'w-7 h-7'}`, splitViewPinned ? "bg-[var(--bone-10)] opacity-100 hover:bg-[var(--bone-12)]" : "opacity-70 hover:opacity-100 hover:bg-[var(--bone-6)]")}>
                 <Pin strokeWidth={2} className="w-4 h-4" fill={splitViewPinned ? "currentColor" : "none"} />
              </button>
            </Tooltip>
          )}
          <Tooltip content="Swap columns">
            <button onClick={swapColumns} className={`flex items-center justify-center text-[var(--bone-100)] rounded-[var(--radius-medium)] shrink-0 opacity-70 hover:opacity-100 hover:bg-[var(--bone-6)] transition-opacity ${isDesktopEnv ? 'w-8 h-8' : 'w-7 h-7'}`}>
               <ArrowLeftRight strokeWidth={2} className="w-4 h-4" />
            </button>
          </Tooltip>
          <Tooltip content="Exit split view">
            <button onClick={toggleSplitView} className={`flex items-center justify-center text-[var(--bone-100)] rounded-[var(--radius-medium)] shrink-0 bg-[var(--bone-10)] opacity-100 hover:bg-[var(--bone-12)] transition-opacity ${isDesktopEnv ? 'w-8 h-8' : 'w-7 h-7'}`}>
               <Columns2 strokeWidth={2} className="w-4 h-4" />
            </button>
          </Tooltip>
```

- [ ] **Step 2: Fix collapsed-sidebar Search/PanelLeft buttons**

Current (`HeaderBar.tsx:513-531`):
```tsx
      {!isDesktopEnv && isSidebarCollapsed && (
        <div className="flex items-center gap-1 shrink-0 mr-2 z-10">
          <button
            onClick={toggleCommandPalette}
            className="flex items-center justify-center text-[var(--bone-100)] rounded-[6px] shrink-0 transition-opacity opacity-70 hover:opacity-100 hover:bg-[var(--bone-6)] [-webkit-app-region:no-drag]"
            style={{ width: 28, height: 28 }}
          >
            <Search strokeWidth={2} className="w-4 h-4"/>
          </button>
          <button
            onClick={toggleSidebar}
            className="flex items-center justify-center text-[var(--bone-100)] rounded-[6px] shrink-0 transition-opacity opacity-70 hover:opacity-100 hover:bg-[var(--bone-6)] [-webkit-app-region:no-drag]"
            style={{ width: 28, height: 28 }}
          >
            <PanelLeft strokeWidth={2} className="w-4 h-4"/>
          </button>
          <div className="w-[1px] h-4 bg-[var(--bone-10)] ml-1 mr-0" />
        </div>
      )}
```

Change to:
```tsx
      {!isDesktopEnv && isSidebarCollapsed && (
        <div className="flex items-center gap-1 shrink-0 mr-2 z-10">
          <button
            onClick={toggleCommandPalette}
            className="flex items-center justify-center w-7 h-7 rounded-[var(--radius-medium)] text-[var(--bone-100)] shrink-0 transition-opacity opacity-70 hover:opacity-100 hover:bg-[var(--bone-6)] [-webkit-app-region:no-drag]"
          >
            <Search strokeWidth={2} className="w-4 h-4"/>
          </button>
          <button
            onClick={toggleSidebar}
            className="flex items-center justify-center w-7 h-7 rounded-[var(--radius-medium)] text-[var(--bone-100)] shrink-0 transition-opacity opacity-70 hover:opacity-100 hover:bg-[var(--bone-6)] [-webkit-app-region:no-drag]"
          >
            <PanelLeft strokeWidth={2} className="w-4 h-4"/>
          </button>
          <div className="w-[1px] h-4 bg-[var(--bone-10)] ml-1 mr-0" />
        </div>
      )}
```

(Note: this block only renders when `!isDesktopEnv`, i.e. web, so `w-7 h-7`/28px is the correct fixed size — this matches the same size the desktop version would use if it existed here, and matches every other web-mode button already at 28px.)

- [ ] **Step 3: Manually verify**

Desktop app: enter split view, hover the split-controls cluster — Reset/Pin/Swap/Exit icons should visually shrink slightly to match the Options/Plus button icon size elsewhere in the header (16px, not 18px). Web: collapse the sidebar — Search/PanelLeft buttons in the header should have the same rounded-corner style as other header buttons (not a sharper corner).

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/HeaderBar.tsx
git commit -m "fix: normalize icon sizes and corner radius in header desktop/web button clusters"
```

---

## Task 5: Match ColumnHeader.tsx bar height to HeaderBar.tsx

**Files:**
- Modify: `src/components/layout/ColumnHeader.tsx:6,92,94`

- [ ] **Step 1: Import isDesktop and compute BAR_H conditionally**

Current (`ColumnHeader.tsx:8`):
```tsx
import { isDesktop } from '@/lib/env';
```

This import already exists (used at line 92 for `isDesktopEnv`). Confirm it's already imported — no import change needed.

Current (`ColumnHeader.tsx:92,94`):
```tsx
  const isDesktopEnv = isDesktop();

  const BAR_H = 42;
```

Change line 94 to:
```tsx
  const BAR_H = isDesktopEnv ? 50 : 42;
```

Note: since `ColumnHeader` only renders when `!isDesktopEnv` (per `SplitViewLayout.tsx:171,224`), `BAR_H` will always evaluate to `42` in practice today. This edit is made for correctness/consistency with `HeaderBar.tsx`'s formula and to avoid a latent bug if `ColumnHeader` is ever rendered on desktop in the future — it does not change current runtime behavior.

- [ ] **Step 2: Manually verify no visual change on web**

Web split view: header height should look unchanged (still 42px, since `isDesktopEnv` is false here).

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/ColumnHeader.tsx
git commit -m "fix: compute ColumnHeader bar height with same desktop/web formula as HeaderBar"
```

---

## Task 6: Unify left-padding rule (20px bare-tab / 10px button-led) across all three render paths

**Files:**
- Modify: `src/components/layout/HeaderBar.tsx:556` (single-column tab strip), `:735,759` (desktop split-view columns)
- Modify: `src/components/layout/ColumnHeader.tsx:104` (web split-view column)

Rule: **20px** when the leading element is a bare tab (Home/Dashboard, Tracker, or Chat as first item, no Options/Read-Edit button before it). **10px** when the leading element is a button (Options and/or Read-Edit before a Note/Canvas tab, or the Plus/"New Entity" button in an empty split column). Applies identically on desktop and web.

- [ ] **Step 1: Single-column tab strip (HeaderBar.tsx)**

Current (`HeaderBar.tsx:553-557`):
```tsx
      <div
        ref={tabsRef}
        className="hidden md:flex flex-1 items-end min-w-0 z-10 relative"
        style={{ height: BAR_H, gap: M, paddingLeft: splitViewActive ? 12 : (isDesktopEnv ? 20 : 8), paddingRight: splitViewActive ? 0 : 8 }}
      >
```

In single-column mode (`splitViewActive` false here — this branch of the ternary only fires when not in split view, i.e. the leading element is always the first tab in `openTabIds`, never a leading button since single-column mode never renders `EntityHeaderControls`), the leading element is always a bare tab. So the non-split-active branch should be `20` unconditionally (not `isDesktopEnv ? 20 : 8`), per the new unified rule. The `splitViewActive ? 12` branch is dead weight now too — that padding is fully superseded by the per-column padding added in Step 2 below (`splitViewActive` layout branches at lines 735/759 have their own `paddingLeft`, and this outer wrapper's padding only matters for the non-split-active tab strip).

Change to:
```tsx
      <div
        ref={tabsRef}
        className="hidden md:flex flex-1 items-end min-w-0 z-10 relative"
        style={{ height: BAR_H, gap: M, paddingLeft: splitViewActive ? 0 : 20, paddingRight: splitViewActive ? 0 : 8 }}
      >
```

- [ ] **Step 2: Desktop split-view columns (HeaderBar.tsx)**

Current left column (`HeaderBar.tsx:735`):
```tsx
            <div className="flex items-end h-full min-w-0" style={{ width: `calc( (100vw - ${(leftWidth || 0) + 24 + (rightWidth ? rightWidth + 8 : 0)}px) * ${splitViewPosition / 100} - 4px )`, paddingLeft: (splitViewLeftId && ['dashboard', 'tracker', 'chat'].includes(splitViewLeftId)) ? 20 : 8 }}>
```

Change to:
```tsx
            <div className="flex items-end h-full min-w-0" style={{ width: `calc( (100vw - ${(leftWidth || 0) + 24 + (rightWidth ? rightWidth + 8 : 0)}px) * ${splitViewPosition / 100} - 4px )`, paddingLeft: (splitViewLeftId && ['dashboard', 'tracker', 'chat'].includes(splitViewLeftId)) ? 20 : 10 }}>
```

Current right column (`HeaderBar.tsx:759`):
```tsx
            <div className="flex items-end h-full justify-between min-w-0 flex-1 group/split-header" style={{ paddingLeft: (splitViewRightId && ['dashboard', 'tracker', 'chat'].includes(splitViewRightId)) ? 20 : 8 }}>
```

Change to:
```tsx
            <div className="flex items-end h-full justify-between min-w-0 flex-1 group/split-header" style={{ paddingLeft: (splitViewRightId && ['dashboard', 'tracker', 'chat'].includes(splitViewRightId)) ? 20 : 10 }}>
```

This already correctly treats a `null`/empty column (`splitViewLeftId`/`splitViewRightId` falsy) as the button-led (10px) case, since the condition requires the id to be truthy AND in the bare-tab list — an empty column's Plus/"New Entity" button is a leading button, matching the rule.

- [ ] **Step 3: Web split-view column (ColumnHeader.tsx)**

Current (`ColumnHeader.tsx:102-105`):
```tsx
    <div
      className="w-full flex items-center shrink-0 relative z-10 bg-sidebar"
      style={{ height: BAR_H, paddingLeft: (entityId === 'dashboard' || entityId === 'tracker') ? 16 : 8, paddingRight: 12 }}
    >
```

This condition is missing the `'chat'` case (chat is a bare tab in the other two paths but isn't listed here) and uses `16`/`8` instead of `20`/`10`. Change to:
```tsx
    <div
      className="w-full flex items-center shrink-0 relative z-10 bg-sidebar"
      style={{ height: BAR_H, paddingLeft: (entityId === 'dashboard' || entityId === 'tracker' || entityId === 'chat') ? 20 : 10, paddingRight: 12 }}
    >
```

Note: `entityId === null` (empty column) falls into the `10` branch, matching the empty-column-has-a-leading-Plus-button rule from Step 2.

- [ ] **Step 4: Manually verify all three paths**

Single-column mode: open Home tab — confirm header content starts ~20px from the left edge (measure visually against sidebar edge or use browser devtools). Open a Note tab as the only tab — single-column mode doesn't render Options/Read-Edit in the tab strip (confirmed in Task context above), so it should still show 20px (bare tab, no leading button) — this is correct per the rule since there's no leading button to trigger the 10px case here.

Desktop split-view: put Home in left column, Note in right column. Left column content should start at 20px from its container edge; right column (Note, with Options button showing) should start at 10px.

Web split-view: same check as desktop split-view, using `ColumnHeader`.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/HeaderBar.tsx src/components/layout/ColumnHeader.tsx
git commit -m "fix: unify header left-padding to 20px bare-tab / 10px button-led rule"
```

---

## Task 7: Align single-column Plus button to tab baseline

**Files:**
- Modify: `src/components/layout/HeaderBar.tsx:714-730`

Currently the single-column "+ New Tab" button centers within the full `BAR_H` via `items-center justify-center` on a box with `height: BAR_H`. Per the design, it should instead sit with the same top-inset as the tab (`top-[6px]`, flush with the bottom), so its bottom edge/corners align with the tab pill's baseline — matching how `ColumnHeader.tsx`'s Plus button and `HeaderBar.tsx`'s desktop-split Plus button (in the `EntityHeaderControls`-adjacent `mr-[3px]`/`ml-[3px]` wrapper divs) already behave, since those wrapper divs use `h-full` inside a row whose own height is `BAR_H` — but the key difference is those live inside a flex row using `items-end` (see `HeaderBar.tsx:555` `items-end`, and `ColumnHeader.tsx:116` `items-center` — worth re-checking each's alignment base).

Re-reading the actual DOM structure: the tab strip container (`HeaderBar.tsx:555`) uses `items-end`, and the tab pill itself (`StaticTabPill`/inline tab render) is a `height: BAR_H` box whose visual tab shape starts at `top-[6px]` — i.e., the tab's baseline (bottom) is flush with the container's bottom edge already, because `items-end` aligns all flex children's bottom edges to the container's bottom edge, and each child is `height: BAR_H` so there's no extra alignment happening from `items-end` alone; the visual inset comes from `top-[6px]` inside each tab's own box.

The Plus button wrapper (lines 716-719) is also `height: BAR_H` and sits in the same `items-end` row, so its bottom edge is already flush with the tab's bottom edge at the container level. The actual misalignment is that the **button itself** (`w-8 h-8`/`w-7 h-7`) is centered via `items-center justify-center` inside that full-height box — meaning the button's own bottom edge sits at `(BAR_H - buttonSize) / 2` from the box bottom, not flush like the tab's visual shape (which is inset only `6px` from top, running to the very bottom, i.e. 0px from the box bottom).

To align the Plus button's bottom edge with the tab's bottom edge (both flush with 0px from the box bottom), and its top margin should equal that same value for symmetry per your stated rule ("top, bottom and to-tab margins are same") — concretely, inset the button 6px from the top and 0px from the bottom, same as the tab's visual shape, rather than vertically centering it.

- [ ] **Step 1: Change the Plus button wrapper from center-aligned to bottom-aligned with 6px top inset**

Current (`HeaderBar.tsx:714-730`):
```tsx
        {/* + New Tab (matches inactive hover container height for uniform spacing) */}
        {!splitViewActive && (
          <div
            className="flex items-center justify-center shrink-0 ml-[3px]"
            style={{ height: BAR_H }}
          >
            <button
              onClick={e => { e.stopPropagation(); if (newItemPopup) { setNewItemPopup(null); return; } const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setNewItemPopup({ x: r.right + 4, y: r.top }); }}
              className={cn(
                `flex items-center justify-center rounded-[var(--radius-medium)] text-[var(--bone-100)] transition-opacity shrink-0 [-webkit-app-region:no-drag] ${isDesktopEnv ? 'w-8 h-8' : 'w-7 h-7'}`,
                newItemPopup ? "opacity-100 bg-[var(--bone-6)]" : "opacity-70 hover:opacity-100 hover:bg-[var(--bone-6)]"
              )}
            >
              <Plus strokeWidth={2.5} className="w-4 h-4"/>
            </button>
          </div>
        )}
```

Change to:
```tsx
        {/* + New Tab — inset to match the tab's own top-[6px] visual inset, so the
            button's bottom edge/corners align with the tab's bottom baseline. */}
        {!splitViewActive && (
          <div
            className="flex items-end justify-center shrink-0 ml-[3px] pt-[6px]"
            style={{ height: BAR_H }}
          >
            <button
              onClick={e => { e.stopPropagation(); if (newItemPopup) { setNewItemPopup(null); return; } const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setNewItemPopup({ x: r.right + 4, y: r.top }); }}
              className={cn(
                `flex items-center justify-center rounded-[var(--radius-medium)] text-[var(--bone-100)] transition-opacity shrink-0 [-webkit-app-region:no-drag] ${isDesktopEnv ? 'w-8 h-8' : 'w-7 h-7'}`,
                newItemPopup ? "opacity-100 bg-[var(--bone-6)]" : "opacity-70 hover:opacity-100 hover:bg-[var(--bone-6)]"
              )}
            >
              <Plus strokeWidth={2.5} className="w-4 h-4"/>
            </button>
          </div>
        )}
```

(`items-center` → `items-end` moves the button to the bottom of its `BAR_H` box; adding `pt-[6px]` reserves the same 6px top inset the tab uses, so the button is vertically positioned as if it were another `top-[6px]` shape — its bottom edge lands flush with the box bottom, same as the tab's visual shape.)

- [ ] **Step 2: Manually verify**

Single-column mode with 2+ tabs open: the Plus button after the last tab should now sit with its bottom edge level with the tabs' bottom edge (previously it would have looked vertically centered/floating relative to the tabs' bottom baseline — check before/after by comparing against a tab's bottom edge in devtools or visually). This should now visually match how the Plus button already sits next to the tab in split-view modes (`ColumnHeader.tsx:230-249`, `HeaderBar.tsx:741-756/765-780`), which use `h-full flex items-center` inside a row that's itself bottom-aligned via `items-end` at the row level — same resulting alignment, different mechanism (those rely on the outer row's `items-end`; the single-column tab strip's outer row is also `items-end`, but the Plus wrapper previously opted out of that with its own internal `items-center`).

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/HeaderBar.tsx
git commit -m "fix: align single-column plus button to tab baseline instead of centering"
```

---

## Task 8: Full manual pass across both platforms and both modes

**Files:** none (verification only)

- [ ] **Step 1: Desktop app — single-column mode**

Open several tabs including Home and a Note. Confirm: header height 50px, left padding 20px before first tab, Plus button bottom-aligned with tabs, all buttons using `var(--radius-medium)` corners and 16px icons.

- [ ] **Step 2: Desktop app — split view**

Open Home in one column, Note in the other. Confirm: 20px padding on the Home column, 10px padding on the Note column (Options/Read-Edit buttons present), Options icon is MoreVertical, Reset-ratio only appears on hovering the Pin/Swap/Exit cluster, all icons 16px.

- [ ] **Step 3: Web — single-column mode**

Same as Step 1 but in a browser (`isDesktop()` false). Confirm header height 42px, 20px left padding, collapsed-sidebar Search/PanelLeft buttons (if sidebar collapsed) use `var(--radius-medium)`.

- [ ] **Step 4: Web — split view**

Confirm `ColumnHeader.tsx` path: 20px padding for Home/Tracker/Chat columns, 10px for Note/Canvas/empty columns, Pin/Swap/Exit buttons use `var(--radius-medium)` not `6px`, header height still 42px (unchanged, since `isDesktopEnv` is false here).

- [ ] **Step 5: Confirm no regressions in tab drag-to-reorder**

Single-column mode: drag a tab to reorder. Since Task 7 only touched the Plus button wrapper (not the tab elements or `tabsRef` container), reordering should be unaffected — verify it still works smoothly.

---

## Self-Review Notes

- **Spec coverage:** All 6 numbered points from the design doc are covered — button spec (Tasks 3-4), Options icon (Task 2), left padding (Task 6), Plus-button baseline alignment (Task 7), bar height (Task 5), plus the additional Reset-ratio hover-scope fix (Task 1) requested after the design doc was written.
- **Correction from design doc:** The design doc assumed only two render paths (`HeaderBar` for single-column, `ColumnHeader` for split). Reading the code revealed `ColumnHeader` is web-only; desktop split-view is rendered inline in `HeaderBar.tsx` via `EntityHeaderControls`/`StaticTabPill`. This plan's tasks are scoped to the actual three render paths.
- **No automated tests:** This is pure Tailwind/inline-style layout work with no unit-testable behavior; verification is manual visual inspection per task, consolidated in Task 8.
