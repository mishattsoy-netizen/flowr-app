User request: "this one a bit wider XD"

### 0. Date and time of the request
- Date: 2026-06-26
- Time: 05:52

### 1. User request
"this one a bit wider XD"

### 2. Objective Reconstruction
- Adjust the width of the "Ratio" select dropdown in the export panel of the canvas interface so that options like "Screen" and their adjacent checkmarks can render fully without truncation.

### 3. Strategic Reasoning
- The trigger button for "Ratio" has a narrow width of about `70px`, which is too tight for displaying "Screen" (~42px), spacing (~6px), padding (~16px), and a checkmark (~10px) simultaneously.
- Setting the `popupWidth` parameter explicitly to `95px` resolves the text clipping completely without making the menu feel bulky or unbalanced relative to its sibling selectors.

### 4. Detailed Blueprint
- **Modify** [CanvasStylePanel.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/CanvasStylePanel.tsx):
  - Pass `popupWidth={95}` to the Ratio `ExportSelect` component.

### 5. Operational Trace
- Passed `popupWidth={95}` to the Ratio dropdown component call.
- Validated the change by running `npx tsc --noEmit`.

### 6. Status Assessment
- Ratio select dropdown renders options cleanly without text clipping.
- Compilation checks succeeded.
