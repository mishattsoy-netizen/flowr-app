User request: "fix popup, it should look like pther defeault popups. remove border from shortcut"

# Date and Time of the Request
May 26, 2026 at 00:52

# Objective Reconstruction
- Align the shortcut item context menu styling to exactly match the other default context menus / popups in the application using standard CSS utility styles.
- Remove the visible border from the shortcut item cards.

# Strategic Reasoning
- Consistent UI elements are critical for a premium visual aesthetic.
- By utilizing the pre-defined `@utility popup-glass-small` and `@utility popup-item` / `popup-item-danger` classes, the shortcuts options popup inherits standard roundings (`var(--radius-regular)`), border overlays (`var(--bone-12)`), shadows (`var(--popup-shadow-color)`), and layout margins to perfectly resemble standard app popups.
- Integrating default `Edit2` and `Trash2` Lucide icons into the popup menu buttons improves functional clarity.
- Removing the card outline (`border-[var(--bone-12)]`) from the shortcut element creates a flatter, cleaner, and less boxy design that integrates beautifully with the dashboard card grid.

# Detailed Blueprint
1. **Shortcut Item Border**:
   - In `ShortcutsWidget.tsx` (inside the `ShortcutItem` subcomponent), edit the button className.
   - Remove `border border-[var(--bone-12)]`.
2. **Standardize Context Menu Popup**:
   - In `ShortcutsWidget.tsx` (inside `ShortcutItem`'s options overlay), update the container class to `popup-glass-small p-1 flex flex-col gap-[3px] pointer-events-auto left-1/2 -translate-x-1/2 mt-1 min-w-[100px]`.
   - Update the Edit button to use the `popup-item` utility class and insert an `<Edit2 className="w-3.5 h-3.5" />` icon before its label span.
   - Update the Delete button to use the `popup-item-danger` utility class and insert a `<Trash2 className="w-3.5 h-3.5" />` icon before its label span.
   - Import `Edit2` and `Trash2` from `lucide-react` at the top of `ShortcutsWidget.tsx`.

# Operational Trace
- Edited [ShortcutsWidget.tsx](file:///Users/mktsoy/Dev/flowr-4-main/src/components/workspace/widgets/ShortcutsWidget.tsx):
  - Line 4: Added `Edit2` and `Trash2` Lucide icon imports.
  - Line 241: Changed button class to `className="w-full aspect-square flex flex-col items-center justify-center gap-1.5 rounded-2xl bg-[var(--bone-5)] hover:bg-[var(--app-dark)] transition-all duration-200"`.
  - Lines 262-277: Redesigned the `showMenu` context dropdown div and item buttons to leverage standard `popup-glass-small`, `popup-item`, and `popup-item-danger` classes and include beautiful mono Lucide icons.

# Status Assessment
- Shortcut item border removed.
- Options dropdown menu standardized with default popups, including exact sizing, shadows, transitions, padding, and Lucide icons.
