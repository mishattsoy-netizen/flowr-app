User request: "i mean use -dark color for hover effects"

## 0. Date and time of the request
25.06.2026 23:05

## 1. User request
"i mean use -dark color for hover effects"

## 2. Objective Reconstruction
The user wants hover highlights on the floating canvas panel and toolbar buttons to use the theme's `--app-dark` (`var(--app-dark)`) color value. This achieves a darkened hover effect in both themes (#EFEEEB in light mode and #121212 in dark mode) without altering global variables like `--bone-10` which affect borders.

## 3. Strategic Reasoning
Standardizing button hover styles in the canvas components to use `hover:bg-[var(--app-dark)]` (instead of overlays like `--bone-10` or `--bone-8`) ensures a clean, dark hover highlight state. This leaves the core `--bone-` variables intact for borders, icons, and text, avoiding structural layout visibility issues.

## 4. Detailed Blueprint
- **Files to modify:**
  - `src/components/canvas/CanvasPage.tsx`
  - `src/components/canvas/CanvasToolbar.tsx`
  - `src/components/canvas/CanvasLayersPanel.tsx`
  - `src/components/canvas/CanvasStylePanel.tsx`
- **Classes to replace:**
  - `hover:bg-[var(--bone-10)]` -> `hover:bg-[var(--app-dark)]`
  - `hover:bg-[var(--bone-8)]` -> `hover:bg-[var(--app-dark)]`
  - `hover:bg-[var(--bone-6)]` -> `hover:bg-[var(--app-dark)]`
- **File to update:** `BRANDING/PREFERENCES.md`
  - Update preferences document to reflect that canvas toolbar and panel hover states are set to `hover:bg-[var(--app-dark)]`.

## 5. Operational Trace
- Replaced the hover utility classes using standard search-and-replace in `CanvasPage.tsx`, `CanvasToolbar.tsx`, `CanvasLayersPanel.tsx`, and `CanvasStylePanel.tsx`.
- Updated `BRANDING/PREFERENCES.md` with the new button hover design details.

## 6. Status Assessment
Changes completed successfully. Button hover highlights on the canvas floating elements now resolve to the clean, dark `--app-dark` color.
