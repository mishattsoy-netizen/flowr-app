User request: "remove border from pill in sliders"

## 0. Date and time
26.06.2026 00:11

## 1. User request
"remove border drom pill in sliders"

## 2. Objective Reconstruction
Remove the visible border/ring from active slider pill buttons across the app (nav, Recent widget, Tasks widget, Shortcuts, etc.).

## 3. Strategic Reasoning
The border was part of `--slider-pill-shadow`:
- Light mode: `0 1px 3px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.06)` — the second value is the 1px ring border.
- Dark mode: `inset 0 0 0 1px var(--bone-6)` — an inset ring border.

All slider pills across the app use `boxShadow: 'var(--slider-pill-shadow)'`, so changing the CSS variable fixes every slider at once.

## 4. Fix Applied
- `globals.css` `:root`: removed the `0 0 0 1px rgba(0,0,0,0.06)` ring from the shadow, kept the soft drop shadow.
- `globals.css` `.dark`: changed `inset 0 0 0 1px var(--bone-6)` to `none`.

## 5. Operational Trace
- Modified `globals.css` lines 27 and 83.

## 6. Status Assessment
Border removed from all slider pills in both light and dark mode. The pill retains its background color distinction (and drop shadow in light mode) without a border.
