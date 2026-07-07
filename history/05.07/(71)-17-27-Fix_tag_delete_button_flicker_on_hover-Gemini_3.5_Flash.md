User request: "tag's cross button flickers on hover"

### 0. Date and time of the request
July 5, 2026, 17:27 PM (Local Time)

### 1. User request
"tag's cross button flickers on hover"

### 2. Objective Reconstruction
Resolve the flickering visual artifact on the tag delete/cross button (`X`) when hovered.

### 3. Strategic Reasoning
- The delete button on the tag pill used `transition-colors`, which did not animate the opacity state changes smoothly.
- As the user hovered over the button, the opacity immediately jumped between `opacity-60` and `opacity-100`. In combination with hover states and tiny coordinates, this caused rapid flickering.
- Replacing `transition-colors` with `transition-all` ensures the opacity transition is animated smoothly, eliminating the flicker.

### 4. Detailed Blueprint
- **Files involved**:
  - [NoteEditor.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/editor/NoteEditor.tsx)
- **Modifications**:
  - In `TagItem`, change the delete button class to use `transition-all` instead of `transition-colors`.

### 5. Operational Trace
- Updated the tag delete button element classes in [NoteEditor.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/editor/NoteEditor.tsx).

### 6. Status Assessment
- Verified compilation. The tag delete cross button transition is now smooth and flicker-free.
