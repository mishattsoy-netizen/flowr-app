# Header Button & Tab Consistency

## Problem

`HeaderBar.tsx` (single-column mode) and `ColumnHeader.tsx` (split-view, one per column) implement visually similar headers — tabs with concave-corner "bridges," leading action buttons (Options, Read/Edit), a Plus button, and trailing action buttons (Split/Pin/Swap/Exit) — but with independently-drifted values:

- Square button sizes: `HeaderBar` uses `32px`/`28px` (desktop/web) via `var(--radius-medium)`; `ColumnHeader`'s trailing cluster (Pin/Swap/Exit) is fixed `28px` with hardcoded `rounded-[6px]`.
- Options icon: `MoreHorizontal` in `HeaderBar` vs `MoreVertical` in `ColumnHeader`.
- Left padding before the first element: `HeaderBar` uses `20px` desktop / `8px` web / `12px` split-active; `ColumnHeader` uses `16px` (Home/Tracker) or `8px` (otherwise) regardless of platform.
- Bar height: `HeaderBar` is `50px` desktop / `42px` web; `ColumnHeader` is fixed `42px` always.
- Plus-button-to-tab alignment: in `ColumnHeader`, leading buttons (Options/Read-Edit) and the tab share the same vertical inset so their bottom corners align on one baseline. In `HeaderBar`'s single-column tab strip, the Plus button instead centers in a full-height box, breaking that alignment.

## Goals

Make every square icon-button in both headers share one size/icon/corner spec, and make left padding follow one consistent rule keyed off "does a button lead the tab" rather than per-mode hardcoded values.

## Design

### 1. Unified button spec

All square icon-buttons — Options, Read/Edit, Plus (both modes), Split toggle, Pin, Swap, Exit split, Reset ratio, and the collapsed-sidebar Search/PanelLeft buttons — use:

- Size: `32px` desktop / `28px` web (`w-8 h-8` / `w-7 h-7`)
- Icon: `16px` (`w-4 h-4`), `strokeWidth={2}`
- Corner radius: `var(--radius-medium)`

This removes `ColumnHeader`'s hardcoded `w-7 h-7` (always, no desktop variant) and hardcoded `rounded-[6px]` on the Pin/Swap/Exit cluster, and removes `HeaderBar`'s split-controls' oversized `w-[18px] h-[18px]` icons (which currently don't match the `16px` used elsewhere).

All buttons are vertically centered within `BAR_H` via `items-center` on their row.

### 2. Options icon → `MoreVertical` everywhere

`HeaderBar`'s `EntityHeaderControls` switches from `MoreHorizontal` to `MoreVertical`, matching `ColumnHeader`.

### 3. Tab-adjacent button-to-tab baseline alignment

For a button sitting immediately next to a tab (Options/Read-Edit before it, or Plus after it), the button's own top/bottom inset within `BAR_H` matches the tab's inset (`top-[6px]`, flush at bottom), so the button's and tab's bottom corners land on the same baseline and visually align — as already implemented in `ColumnHeader`. Port this to `HeaderBar`'s single-column Plus button, which currently centers in a separate full-height box instead.

This alignment requirement applies **only** to buttons adjacent to a tab. Trailing action buttons (Pin/Swap/Exit/Reset ratio/Split toggle) are not adjacent to a tab — they only need the unified spec (#1) and vertical centering, no baseline alignment.

### 4. Unified left-padding rule

Applies identically across `HeaderBar` (single-column) and both columns of `ColumnHeader`, on both desktop and web:

- **20px** — when the leading element is a bare tab with nothing before it (Home/Dashboard, Tracker, or Chat as the first item in that header/column)
- **10px** — when the leading element is a button (Options and/or Read/Edit before a Note/Canvas tab; or the Plus button in an empty split column)

This replaces `HeaderBar`'s current `20/8/12` split and `ColumnHeader`'s current `16/8` split with one shared rule, independent of platform.

### 5. Split-view header height matches single-view

`ColumnHeader`'s `BAR_H` changes from a hardcoded `42` to `isDesktopEnv ? 50 : 42`, matching `HeaderBar`, so split mode isn't shorter than single mode on desktop.

## Out of scope

- Tab pill visuals themselves (concave corners, active/inactive styling, drag-to-reorder) are unchanged.
- No changes to which buttons appear in which mode — only their sizing, icon, corner-radius, alignment, and the header's left padding.
