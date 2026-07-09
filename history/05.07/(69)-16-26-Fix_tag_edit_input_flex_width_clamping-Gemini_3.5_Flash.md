User request: "dont chage tags size when i edit it" (second follow-up for tag pill size during edit)

### 0. Date and time of the request
July 5, 2026, 16:26 PM (Local Time)

### 1. User request
"dont chage tags size when i edit it" (second follow-up showing "ui/ux" still stretching in edit mode)

### 2. Objective Reconstruction
Completely prevent the HTML `<input />` from stretching the grid container width when edit mode is active, ensuring the input's layout footprint is zero and its width is strictly determined by the mirror span.

### 3. Strategic Reasoning
- Even with `min-w-0 w-full` classes, the browser uses the input's default intrinsic size during the auto-layout/max-content phase of the grid column calculation because `w-full` (100%) is relative.
- To resolve this circular dependency, we changed the input classes to `w-0 min-w-full`.
- The `w-0` (width: 0) ensures that the input contributes 0px to the initial grid column layout calculations, letting the invisible mirror `span` solely dictate the width.
- The `min-w-full` (min-width: 100%) then expands the input to occupy the full width of the calculated column layout, yielding a pixel-perfect, non-stretching editor input.

### 4. Detailed Blueprint
- **Files involved**:
  - [NoteEditor.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/editor/NoteEditor.tsx)
- **Modifications**:
  - Update `w-full min-w-0` to `w-0 min-w-full` on the tag editor input inside `TagItem`.

### 5. Operational Trace
- Replaced the input className configuration in [NoteEditor.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/editor/NoteEditor.tsx).

### 6. Status Assessment
- Verified compilation and layout properties. The tag pill now keeps its exact size during edit.
