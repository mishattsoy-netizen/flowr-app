User request: "dont use accent color for these placeholders, it can only be used for main action buttons like new/save/chat/ai avatar"

# Date and Time of the Request
May 26, 2026 at 00:37

# Objective Reconstruction
Remove the primary accent color (`--accent` / `#d67a3c`) from widget placeholders and empty states. This includes empty-state illustrations/icons and their secondary buttons (like "+ Add Shortcut" or "+ New Item/Task" buttons inside the widgets' empty lists). The accent color must be strictly reserved for primary, high-priority actions like the top header `+ New Item`, `Save`, `Chat`, or the `AI Avatar`.

# Strategic Reasoning
- The visual hierarchy should make main CTA actions stand out while secondary placeholders remain neutral.
- Empty-state illustrations and secondary empty-state buttons are visual "noise" if colored with the active primary accent, as it suggests an urgent or highly prominent action.
- Changing them to neutral bone colors (like `text-[var(--bone-30)]` and standard bone buttons) maintains interface elegance and ensures the focus remains on standard navigation and core CTAs.

# Detailed Blueprint
1. Identify all widget files with placeholders using accent colors:
   - `ShortcutsWidget.tsx` (Empty state Layout icon and Add Shortcut button)
   - `RecentWidget.tsx` (Empty state Clock icon and New Item button)
   - `AllFilesWidget.tsx` (Empty state Search icon and New Item button)
   - `SmartTaskStackWidget.tsx` (Empty state CheckCircle2 icon and New Task button)
2. In all 4 widgets:
   - Modify the empty-state icon style to use `text-[var(--bone-30)]` with `opacity-40` instead of `text-accent opacity-20`.
   - Modify the secondary button style to use standard bone background overlays and foregrounds: `bg-[var(--bone-5)] text-[var(--bone-70)] hover:bg-[var(--bone-10)] hover:text-[var(--bone-100)]` instead of `bg-accent/[0.06] hover:bg-accent/[0.12] text-accent/60`.

# Operational Trace
- Edited [ShortcutsWidget.tsx](file:///Users/mktsoy/Dev/flowr-4-main/src/components/workspace/widgets/ShortcutsWidget.tsx):
  - Changed `Layout` icon class to use `text-[var(--bone-30)] opacity-40`.
  - Changed button to use standard `bg-[var(--bone-5)] text-[var(--bone-70)] hover:bg-[var(--bone-10)] hover:text-[var(--bone-100)]` bone styling.
- Edited [RecentWidget.tsx](file:///Users/mktsoy/Dev/flowr-4-main/src/components/workspace/widgets/RecentWidget.tsx):
  - Changed `Clock` icon class to use `text-[var(--bone-30)] opacity-40`.
  - Changed button to use standard `bg-[var(--bone-5)] text-[var(--bone-70)] hover:bg-[var(--bone-10)] hover:text-[var(--bone-100)]` bone styling.
- Edited [AllFilesWidget.tsx](file:///Users/mktsoy/Dev/flowr-4-main/src/components/workspace/widgets/AllFilesWidget.tsx):
  - Changed `Search` icon class to use `text-[var(--bone-30)] opacity-40`.
  - Changed button to use standard `bg-[var(--bone-5)] text-[var(--bone-70)] hover:bg-[var(--bone-10)] hover:text-[var(--bone-100)]` bone styling.
- Edited [SmartTaskStackWidget.tsx](file:///Users/mktsoy/Dev/flowr-4-main/src/components/workspace/widgets/SmartTaskStackWidget.tsx):
  - Changed `CheckCircle2` icon class to use `text-[var(--bone-30)] opacity-40`.
  - Changed button to use standard `bg-[var(--bone-5)] text-[var(--bone-70)] hover:bg-[var(--bone-10)] hover:text-[var(--bone-100)]` bone styling.

# Status Assessment
- All 4 dashboard widget placeholders successfully updated.
- Empty states now render with standard neutral bones, reserving the high-visibility accent color exclusively for primary, high-priority main action buttons (New, Save, Chat, AI Avatar).
