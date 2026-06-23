# History Report

User request: "fix collapse button in the unselected row doesnt have same effect as options buttons or plus"

## 0. Date and Time
2026-05-26 at 13:01

## 1. User Request
User request: "fix collapse button in the unselected row doesnt have same effect as options buttons or plus"

## 2. Objective Reconstruction
The collapse/expand chevron button on tree items (folders, workspaces, collections) had a different visual hover effect compared to the Plus and Options buttons in the same row. The chevron was implemented as an absolutely-positioned overlay inside the icon area, while Plus and Options use the `btn-sidebar-utility` class which gives a clean 22×22 rounded pill effect.

## 3. Strategic Reasoning
The root cause was architectural: the chevron lived inside `getIcon()` as an absolute overlay div, positioned over the folder icon. This approach caused:
- Different hover shape (not a square pill)
- Icon fading out (group-hover:opacity-0 on the icon)
- Different interaction feel vs Plus/Options

Fix: move the chevron into the same right-side actions strip as Plus and Options, using `btn-sidebar-utility` — the exact same class.

## 4. Detailed Blueprint
- TreeItem.tsx: Remove absolute chevron overlay from `getIcon()` function
- TreeItem.tsx: Remove `group-hover:opacity-0` from the folder icon div
- TreeItem.tsx: Add `isCollapsible && <button className="btn-sidebar-utility">` in the actions strip, before the Plus button

## 5. Operational Trace
- Simplified `getIcon()` — folder icon no longer fades on hover, no more absolute overlay div
- In the actions `<div>` (which already handles opacity-0/group-hover:opacity-100), added chevron as first button when `isCollapsible` is true
- All three buttons (Chevron, Plus, Options) now share identical `btn-sidebar-utility` styling: 22×22, rounded-tiny, hover:bg-app-dark, hover:text-bone-100

## 6. Status Assessment
- ✅ Collapse button now has identical hover effect as Plus and Options
- ✅ Icon no longer fades/disappears on hover
- ✅ All three action buttons appear together on row hover with consistent style
