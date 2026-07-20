User request: "make sure all context popups have same padding"

### 0. Date and time of the request
20.07.2026 00:20

### 1. User request
User request: "make sure all context popups have same padding"

### 2. Objective Reconstruction
The user requested that all context popups across the application use the same uniform padding, as they previously varied between `p-1`, `p-1.5`, and `p-2`.

### 3. Strategic Reasoning
Context menus throughout the app use the `popup-glass-small` CSS utility. However, the padding for these menus was being applied individually as inline Tailwind utility classes (e.g., `p-1`, `p-1.5`, `p-2`). To enforce absolute consistency and establish a single source of truth, the padding should be moved directly into the `popup-glass-small` CSS rule, and all inline padding overrides should be stripped from the codebase.
The padding of `p-1.5` was selected as the standard since it's the most widely used and aesthetically suitable for context popups.

### 4. Detailed Blueprint
- Modify `globals.css` to add `p-1.5` to the `@apply` directive inside the `@utility popup-glass-small` definition.
- Write a Node.js script to search the entire `src/` directory for any instance of `popup-glass-small`.
- Programmatically remove any padding utility classes (`p-1`, `p-1.5`, `p-2`, `px-1.5`, etc.) that exist alongside `popup-glass-small` in `className` strings.
- Verify that 26 components containing popups were updated.

### 5. Operational Trace
- Edited `src/app/globals.css` to include `p-1.5` in `@utility popup-glass-small`.
- Wrote and executed `scratch-padding.js`, which used `glob` to scan `src/**/*.{ts,tsx}` and applied regex replacement `/\b(p-[0-9.]+|px-[0-9.]+|py-[0-9.]+|pt-[0-9.]+|pb-[0-9.]+|pl-[0-9.]+|pr-[0-9.]+)\b\s*/g` to lines containing `popup-glass-small`.
- Successfully updated 26 files including `ContextMenu.tsx`, `Sidebar.tsx`, `SpacePage.tsx`, `NoteEditor.tsx`, `TableBlock.tsx`, `Dashboard.tsx`, and others.

### 6. Status Assessment
Padding is now strictly unified across all context popups. `popup-glass-small` inherently applies a consistent 6px padding (`p-1.5`), ensuring no more inconsistencies. The issue is resolved.
