User request: "i dont see changed"

## 0. Date and time of the request
21.05 16:17

## 1. User request
User request: "i dont see changed" (referring to font weight changes in light mode)

## 2. Objective Reconstruction
The font weight changes previously set via CSS variables (`--weight-medium: 600` in light mode) were not being applied visually. The user confirmed the changes were invisible.

## 3. Strategic Reasoning
The root cause was that Tailwind v4's `@theme inline` resolves CSS variable values **at build time**. So even though `--font-weight-medium: var(--weight-medium)` was defined in the theme block, Tailwind bakes the initial `:root` value (600) as a static value into the utility class output. When the `.dark` class switches `--weight-medium` to 500 at runtime, Tailwind's already-generated `font-medium` class is not dynamic — it just uses whatever was resolved at build time.

The fix was to add direct CSS override rules in `@layer base` that use `:root` and `.dark` selectors to override `font-weight` at runtime via specificity — bypassing Tailwind's build-time resolution entirely. These rules are guaranteed to apply dynamically when the `.dark` class is added or removed from the root element.

## 4. Detailed Blueprint
- `src/app/globals.css`: Added to `@layer base`:
  - `:root .font-medium` → `font-weight: 600 !important` (light mode)
  - `:root .font-semibold` → `font-weight: 700 !important` (light mode)
  - `.dark .font-medium` → `font-weight: 500 !important` (dark mode)
  - `.dark .font-semibold` → `font-weight: 600 !important` (dark mode)
- `.next` cache cleared and dev server restarted.

## 5. Operational Trace
- Modified `@layer base` in `globals.css`.
- Cleared the Next.js `.next` build cache and restarted the dev server with `rm -rf .next && npm run dev`.

## 6. Status Assessment
The font weights should now visibly update in light mode. The CSS specificity overrides are runtime-dynamic and guaranteed to apply correctly as the `.dark` class is toggled.
