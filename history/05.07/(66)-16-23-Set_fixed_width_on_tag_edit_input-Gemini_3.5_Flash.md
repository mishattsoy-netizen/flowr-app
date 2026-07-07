User request: "dont chage tags size when i edit it"

### 0. Date and time of the request
July 5, 2026, 16:23 PM (Local Time)

### 1. User request
"dont chage tags size when i edit it"

### 2. Objective Reconstruction
Prevent the tag pill's width from changing dynamically as characters are entered or removed during editing.

### 3. Strategic Reasoning
- Previously, the tag editing input used a dynamic inline width style `width: ${Math.max(editValue.length, 2)}ch` that recalculated on every keystroke. This caused the tag pill to constantly expand and shrink character-by-character while typing.
- Replacing the dynamic `ch`-based width style with a static Tailwind class (`w-20` / 80px) stabilizes the tag pill size during the editing phase, preventing layout jitter and keeping editing content visible.

### 4. Detailed Blueprint
- **Files involved**:
  - [NoteEditor.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/editor/NoteEditor.tsx)
- **Modifications**:
  - In `TagItem`, remove the dynamic `ch` width style on the `<input />` element.
  - Set the input class list to include `w-20`.

### 5. Operational Trace
- Edited the tag edit input properties in [NoteEditor.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/editor/NoteEditor.tsx).

### 6. Status Assessment
- Verified compilation. The tag pill size is now stable during editing.
