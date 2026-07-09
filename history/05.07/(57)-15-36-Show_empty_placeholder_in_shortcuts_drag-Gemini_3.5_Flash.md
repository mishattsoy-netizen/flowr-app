User request: "chage shortcuts dnd a bit. when i pick up card, show empty placeholder in its place"

### 0. Date and time of the request
July 5, 2026, 15:36 PM (Local Time)

### 1. User request
"chage shortcuts dnd a bit. when i pick up card, show empty placeholder in its place"

### 2. Objective Reconstruction
Modify the drag-and-drop behavior of shortcuts in the dashboard shortcuts grid so that dragging a shortcut card leaves a dashed empty placeholder in its position, rather than showing a dimmed dark background card.

### 3. Strategic Reasoning
- Previously, when a shortcut item was being dragged, `isDragging` applied the class `bg-[var(--app-dark)] border-transparent`. This showed the item's details (icon, text) on a dark background.
- To make the drag-and-drop feedback cleaner and match modern grid layout patterns, we want the grid slot of the dragged item to appear as an empty placeholder box.
- By checking `isDragging`, we conditionalize the card's inner content. If it is being dragged, we render a dashed box styled as `border border-dashed border-[var(--bone-10)] bg-transparent opacity-[0.08]`.
- We keep the outer container wrapper so that all pragmatic HTML5 drag-and-drop listener props (`dragProps`) remain active and attached to the DOM position.

### 4. Detailed Blueprint
- **Files involved**:
  - [ShortcutsWidget.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/workspace/widgets/ShortcutsWidget.tsx)
- **Modifications**:
  - Inside the `ShortcutItem` component's return statement, wrap the inner button in a conditional check `{isDragging ? (...) : (...)}`.
  - For the `isDragging` state, render a dashed empty box.
  - Simplify the `button`'s class names since `isDragging` styles are no longer needed there.

### 5. Operational Trace
- Edited [ShortcutsWidget.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/workspace/widgets/ShortcutsWidget.tsx).
- Verified that the conditional placeholder matches the style of empty slots in the grid.

### 6. Status Assessment
- Successfully updated the drag-and-drop visual representation for shortcut cards.
