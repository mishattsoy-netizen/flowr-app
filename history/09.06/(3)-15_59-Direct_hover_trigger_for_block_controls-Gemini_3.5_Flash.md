User request: "now hover over these buttons, they dont apear. they appear only when i hover the row first"

### 0. Date and time of the request
Date: 09.06.2026
Time: 15:59

### 1. User request
User request: "now hover over these buttons, they dont apear. they appear only when i hover the row first"

### 2. Objective Reconstruction
The objective is to make the hover controls (plus/drag handle buttons) appear immediately when the user moves their mouse directly over the buttons' area (the left margin), without requiring them to hover the text/row content of the block first.

### 3. Strategic Reasoning
- Previously, the `BlockControls` wrapper used Tailwind's `invisible` class (which sets `visibility: hidden`) when the parent block was not hovered.
- In CSS, elements with `visibility: hidden` do not receive pointer/mouse events. As a result, if the user moved their mouse from the left margin directly onto the buttons' location, the wrapper could not capture the hover event, and the controls remained hidden.
- By removing `invisible` and instead relying purely on `opacity-0` with `pointer-events-auto` (the default), the transparent controls wrapper can receive mouse events.
- Since `BlockControls` is a DOM child of the parent block, hovering the controls wrapper automatically triggers `:hover` on the parent block.
- This chain immediately activates `group-hover:opacity-100` and `hover:opacity-100`, making the controls fade in dynamically over `150ms`.

### 4. Detailed Blueprint
- **Modify** [BlockRenderer.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/editor/BlockRenderer.tsx):
  - In `BlockControls`, remove the `invisible` and `group-hover:visible` classes when inactive/hidden.
  - Keep `visible` inside the active branch (`(menuOpen || isDragging || isFocused || isSelected) ? "opacity-100 visible" : ...`).
  - Add `hover:opacity-100` and `transition-opacity duration-150` to the wrapper for a smooth fade-in interaction when the mouse directly hovers over the buttons.

### 5. Operational Trace
1. Analyzed the hover behavior of `BlockControls` in `BlockRenderer.tsx` and identified that `visibility: hidden` (via the `invisible` class) prevented mouse interactions when hidden.
2. Removed `invisible` and `group-hover:visible` and replaced them with `hover:opacity-100` and `transition-opacity duration-150` on the wrapper class list.
3. Verified compilation by running the unit tests.

### 6. Status Assessment
- **Completed**: Hover controls now trigger immediately on direct mouse hover in the left margin.
- **Verified**: Unit tests pass successfully.
