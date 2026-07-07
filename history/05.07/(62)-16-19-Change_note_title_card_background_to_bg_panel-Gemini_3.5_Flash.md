User request: "change bg to panel" (referencing note title widget background)

### 0. Date and time of the request
July 5, 2026, 16:19 PM (Local Time)

### 1. User request
"change bg to panel" (referencing note title widget background)

### 2. Objective Reconstruction
Change the background color of the note editor's header/title card component from `bg-sidebar` to `bg-panel` for design consistency.

### 3. Strategic Reasoning
- The title widget previously used the `bg-sidebar` background class, making it visually match the sidebar's distinct background.
- Changing it to `bg-panel` aligns it with the main page panels (similar to tables and lists), offering a more integrated card layout within the editor workspace.

### 4. Detailed Blueprint
- **Files involved**:
  - [NoteEditor.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/editor/NoteEditor.tsx)
- **Modifications**:
  - Replace the two occurrences of `bg-sidebar` within the note header card markup structure with `bg-panel`.

### 5. Operational Trace
- Modified the title card container div and the info footer metadata section in [NoteEditor.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/editor/NoteEditor.tsx).

### 6. Status Assessment
- Successfully changed the title card background style.
