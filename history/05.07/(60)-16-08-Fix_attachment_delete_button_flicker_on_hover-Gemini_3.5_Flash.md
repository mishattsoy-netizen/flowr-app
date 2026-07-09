User request: "delete button is flashing/flickerig on hover fix it"

### 0. Date and time of the request
July 5, 2026, 16:08 PM (Local Time)

### 1. User request
"delete button is flashing/flickerig on hover fix it"

### 2. Objective Reconstruction
Resolve the flashing/flickering effect on the attachment delete/trash button when hovered.

### 3. Strategic Reasoning
- The delete button had `transition-colors` class, which only transitioned color values.
- When hovering/unhovering the delete button directly, its opacity switched instantly between `opacity-30` (from `group-hover:opacity-30`) and `opacity-100` (from `hover:opacity-100`). The combination of instant opacity changes and mouse boundary triggers caused a flickering/flashing visual effect.
- Replacing `transition-colors` with `transition-all` ensures that both colors and opacity values transition smoothly, preventing any rapid flickering.
- Removed the unnecessary priority flag `!` from `!opacity-100` to prevent any parser/specificity issues.

### 4. Detailed Blueprint
- **Files involved**:
  - [TaskInspectorPanel.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/tracker/TaskInspectorPanel.tsx)
- **Modifications**:
  - Update the delete button class to use `transition-all` instead of `transition-colors`.
  - Change `hover:!opacity-100` to `hover:opacity-100`.

### 5. Operational Trace
- Edited the attachment list delete button tailwind class string in [TaskInspectorPanel.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/tracker/TaskInspectorPanel.tsx).

### 6. Status Assessment
- Successfully resolved the flickering behavior on hover.
