User request: "fix shortcuts make it more minimalistic, no scale hovers and no accent colors"

# Date and Time of the Request
May 26, 2026 at 00:46

# Objective Reconstruction
Refactor active shortcut items in `ShortcutsWidget` to be extremely minimalistic and mono. Specifically:
- Remove any hover animation effects such as button translations/lifts (`hover:-translate-y-0.5`) and icon scale adjustments (`group-hover/shortcut:scale-110`).
- Remove the orange accent colors (`text-accent` and `hover:border-accent/40`) from active shortcut items. Use clean neutral/mono colors (`text-[var(--bone-70)]` and standard bone border hover states) instead.
- Remove high contrast drop shadows (`hover:shadow-lg`) from item hover interactions.

# Strategic Reasoning
- The user is aiming for a clean, unified, mono-aesthetic interface.
- Bold color splashes and dynamic scaling on minor secondary elements (like shortcut grid items) disrupt the layout's calm visual hierarchy.
- Transitioning active shortcuts to the standard mono-palette (`var(--bone-70)` default with `var(--bone-100)` hover highlighting) blends them beautifully into the overall bento widget ecosystem.
- Disabling translates and scale hovers provides a more solid, stable feel when interacting with dashboard shortcuts.

# Detailed Blueprint
1. In `ShortcutsWidget.tsx`, locate the mapping of the active `shortcuts` list.
2. In the `button` element:
   - Remove `hover:border-accent/40`, `hover:shadow-lg`, and `hover:-translate-y-0.5`.
   - Keep a clean transition duration of `duration-200`.
3. In the icon container `div` element:
   - Replace `text-accent` with `text-[var(--bone-70)] group-hover/shortcut:text-[var(--bone-100)]`.
   - Remove `group-hover/shortcut:scale-110`.
   - Speed up transitions to `duration-200`.

# Operational Trace
- Edited [ShortcutsWidget.tsx](file:///Users/mktsoy/Dev/flowr-4-main/src/components/workspace/widgets/ShortcutsWidget.tsx):
  - Line 147: Changed item button style to `className="w-full aspect-square flex flex-col items-center justify-center gap-1.5 rounded-2xl bg-[var(--bone-5)] border border-[var(--bone-12)] hover:bg-[var(--app-dark)] transition-all duration-200"`.
  - Line 149: Changed item icon wrapper style to `className="w-10 h-10 rounded-xl bg-[var(--bone-10)] flex items-center justify-center text-[var(--bone-70)] group-hover/shortcut:text-[var(--bone-100)] group-hover/shortcut:bg-[var(--bone-15)] transition-all duration-200"`.

# Status Assessment
- Active shortcut items successfully refactored.
- Orange icons, accent hover borders, scaling hovers, and translate-y transitions are completely removed, resulting in a beautiful, flat, mono visual style that is highly consistent with the rest of the application.
