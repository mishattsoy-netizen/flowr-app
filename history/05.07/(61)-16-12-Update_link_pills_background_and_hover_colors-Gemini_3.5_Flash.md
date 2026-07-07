User request: "change pg to panel and add bone 5 on hover, and use same border as outer border of table"

### 0. Date and time of the request
July 5, 2026, 16:12 PM (Local Time)

### 1. User request
"change pg to panel and add bone 5 on hover, and use same border as outer border of table"

### 2. Objective Reconstruction
Modify the styling of inline link pills (`.inline-link-btn`) in both the Notes editor and Chat assistant to change their background color to the panel background (`var(--app-panel)` / `bg-panel`), set their hover background color to `var(--bone-5)` (5% opacity bone tint), and keep their border consistent with the outer table border (`var(--bone-10)`).

### 3. Strategic Reasoning
- The user requested updating the backgrounds of the inline link pills to match the panel background and hover states.
- By changing the background to `var(--app-panel)` (or `bg-panel`) and hover background to `var(--bone-5)`, the link pills now look more integrated with the editor/panel layout, showing a subtler highlighting style.
- The border remains `var(--bone-10)` to match the outer table border style.
- Both CSS (`globals.css`) and inline class lists in JS/TSX files have been updated for consistency.

### 4. Detailed Blueprint
- **Files involved**:
  - [globals.css](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/app/globals.css)
  - [markdownToBlocks.ts](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/lib/utils/markdownToBlocks.ts)
  - [markdownBlocks.ts](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/lib/editor/markdownBlocks.ts)
  - [NoteEditor.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/editor/NoteEditor.tsx)
  - [BlockRenderer.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/editor/BlockRenderer.tsx)
  - [ChatMessage.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/assistant/components/ChatMessage.tsx)
- **Modifications**:
  - Replace occurrences of `bg-[var(--bone-5)]` with `bg-panel`.
  - Replace occurrences of `hover:bg-[var(--bone-10)]` with `hover:bg-[var(--bone-5)]`.
  - Modify `.inline-link-btn` backgrounds inside `globals.css`.

### 5. Operational Trace
- Replaced the inline class lists and CSS tokens across all 6 files containing link pill definitions.

### 6. Status Assessment
- Successfully aligned the link pill styles with the panel background and hover states.
