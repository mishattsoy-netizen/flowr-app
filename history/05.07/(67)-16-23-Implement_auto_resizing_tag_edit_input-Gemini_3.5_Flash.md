User request: "dont chage tags size when i edit it" (with screenshots showing the input container width issue)

### 0. Date and time of the request
July 5, 2026, 16:23 PM (Local Time)

### 1. User request
"dont chage tags size when i edit it" (referencing how the input container size previously jumped or stretched the tag pill during edit mode)

### 2. Objective Reconstruction
Implement a pixel-perfect auto-resizing tag input that matches the text width exactly when entering/leaving edit mode, preventing any sudden layout snaps or unnecessary pill expansion.

### 3. Strategic Reasoning
- Setting a fixed width (like `w-20`) stretched small tag pills (like "test") during edit mode.
- Monospace estimates (like `ch` units) are inaccurate for sans-serif fonts, causing slight layout jumps.
- To solve this, we implemented an `inline-grid` overlapping mirror element technique:
  - An invisible `span` with identical font styles and text content (`editValue`) is rendered in the same grid cell as the `<input />`.
  - The grid cell dynamically sizes itself to fit the invisible `span` exactly.
  - The `<input />` is set to `w-full` to occupy 100% of the grid cell's width.
  - This matches the input width to the text length down to the exact pixel, ensuring the tag pill remains exactly the same size when editing starts, only growing/shrinking smoothly as the user actually types.

### 4. Detailed Blueprint
- **Files involved**:
  - [NoteEditor.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/editor/NoteEditor.tsx)
- **Modifications**:
  - In `TagItem`, wrap the edit input in a `relative inline-grid items-center grid-cols-1` container.
  - Add an invisible `span` with `col-start-1 row-start-1 px-0 text-[11px] font-medium whitespace-pre` styling.
  - Set the input to `col-start-1 row-start-1 w-full`.

### 5. Operational Trace
- Replaced the input rendering markup block in [NoteEditor.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/editor/NoteEditor.tsx).

### 6. Status Assessment
- Verified layout compilation. The editing tag input now matches the text width exactly without causing layout jumps or stretching the pill.
