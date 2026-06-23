# History Report — Sidebar Row Hover Only on Non-Button Area

### 0. Date and Time
May 27, 2026 at 14:32

### 1. User Request
User request: "when row is not selected in the left sidebar and i hover option, plus or collapse button, dont highlight whole row, only small button container"

### 2. Objective Reconstruction
On unselected sidebar rows, hovering the utility buttons (Plus, Options/MoreHorizontal, collapse chevron) was lighting up the entire row background. The fix makes the row background only activate when the hover target is the row body itself — not any of those buttons.

### 3. Strategic Reasoning
The row `div` had `hover:bg-[var(--app-dark)]` which fires on any child hover due to CSS event bubbling. The cleanest fix is the CSS `:has()` selector combined with a stable class name on the buttons container. The rule becomes: highlight the row background only when hovering `[&:hover:not(:has(.sidebar-actions:hover))]`. This way:
- Hovering the text/icon area → row highlights ✓
- Hovering a `.sidebar-actions` button → row stays plain, button highlights via its own `btn-sidebar-utility` class ✓

### 4. Files Changed
- `src/components/layout/TreeItem.tsx`

### 5. Operational Trace
1. Changed `hover:bg-[var(--app-dark)]` → `[&:hover:not(:has(.sidebar-actions:hover))]:bg-[var(--app-dark)]` on the row `div`.
2. Added class `sidebar-actions` to the right-side utility buttons `div` (Plus + MoreHorizontal).
3. Added class `sidebar-actions` directly to the collapse chevron `button` as well (it lives separately in the icon slot).

### 6. Status Assessment
Completed. The `:has()` selector has broad browser support (Chrome 105+, Safari 15.4+). The `btn-sidebar-utility` buttons still receive their own small hover highlight as before.
