User request: "make color boxes full width and move title above it"

## 0. Date and time of the request
25.06.2026 23:23

## 1. User request
"make color boxes full width and move title above it"

## 2. Objective Reconstruction
In the Style Panel (Canvas Background and Canvas Pattern settings), refactor the Color input field layout to move the "Color" label to a dedicated line above the input box and allow the input container (holding the color swatch, text value, and opacity percent) to span the full width of the sidebar panel container.

## 3. Strategic Reasoning
Rendering labels inline next to inputs (using `PropRow`) severely limits the horizontal space available for text input boxes inside a compact 250px-wide sidebar. Moving the "Color" title to its own header line above the input and removing `PropRow` gives the color input boxes 100% width, making them much easier to read and interact with, matching standard design tool layouts.

## 4. Detailed Blueprint
- **CanvasStylePanel.tsx:**
  - In Canvas Background: Replace the `PropRow` wrapper for Color with a vertical `flex flex-col gap-1 mb-1` block rendering a `Color` label above a full-width input container.
  - In Canvas Pattern: Replace the `PropRow` wrapper for Color with a vertical `flex flex-col gap-1 mt-2.5` block rendering a `Color` label above a full-width input container.

## 5. Operational Trace
- Modified [CanvasStylePanel.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/CanvasStylePanel.tsx) layouts inside Canvas Background and Canvas Pattern configuration blocks.
- Ran `npx tsc --noEmit` which completed successfully with exit code 0.

## 6. Status Assessment
Completed and validated. Color inputs are now stacked vertically under their respective "Color" headings and take up the entire sidebar panel width.
