User request: "how do we fix this. all icons that are not 100 opacity like bone 60 or others have overlaping strokes thta create layered wffect?"

# Date and Time of the Request
May 26, 2026 at 00:40

# Objective Reconstruction
Explain the root cause of overlapping/layered stroke artifacts inside Lucide/SVG icons when using semi-transparent colors (like `var(--bone-30)`), and provide a concrete solution to prevent this behavior. Apply this fix surgically to the placeholder icons in all four widget files to verify and demonstrate the resolution.

# Strategic Reasoning
- **The Problem**: When SVGs contain multiple intersecting or touching path/line elements, applying a semi-transparent color (using alpha, e.g. `rgba(..., 0.3)`) directly to the `stroke` property makes the browser paint each path individually with transparency. Where paths join or intersect, the alpha colors add up (overlap), creating a darker, "layered" look.
- **The Solution**: Apply a 100% solid opacity color to the stroke (like `var(--bone-100)` or standard `currentColor`), and instead apply the transparency using the CSS `opacity` property (e.g. CSS `opacity: 0.25` or Tailwind's `opacity-25` class) to the SVG parent or container wrapper itself.
- **Why this works**: Applying `opacity` on the SVG container tells the browser to first render all underlying solid lines at full opacity (flattening all path intersections cleanly so no overlap is visible), and then composite the entire rendered SVG flatly onto the screen with the requested transparency.

# Detailed Blueprint
1. Explain the mechanism clearly with code examples.
2. Edit all 4 recently updated widgets (`ShortcutsWidget.tsx`, `RecentWidget.tsx`, `AllFilesWidget.tsx`, `SmartTaskStackWidget.tsx`):
   - Replace the semi-transparent stroke colors (`text-[var(--bone-30)] opacity-40`) with a solid color (`text-[var(--bone-100)]`) and flat group opacity (`opacity-25`).

# Operational Trace
- Surgical changes made to prevent overlap artifacts on widget placeholder SVGs:
  - **ShortcutsWidget.tsx**: Changed Layout icon from `text-[var(--bone-30)] opacity-40` to `text-[var(--bone-100)] opacity-25`.
  - **RecentWidget.tsx**: Changed Clock icon from `text-[var(--bone-30)] opacity-40` to `text-[var(--bone-100)] opacity-25`.
  - **AllFilesWidget.tsx**: Changed Search icon from `text-[var(--bone-30)] opacity-40` to `text-[var(--bone-100)] opacity-25`.
  - **SmartTaskStackWidget.tsx**: Changed CheckCircle2 icon from `text-[var(--bone-30)] opacity-40` to `text-[var(--bone-100)] opacity-25`.

# Status Assessment
- Overlapping stroke issue explained in detail.
- Proactively applied the solution to all 4 widgets to guarantee the placeholder icons render perfectly flat and uniform.
