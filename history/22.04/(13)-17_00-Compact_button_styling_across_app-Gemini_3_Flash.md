User request: "fix buttons style and make them more compact"

### 2. Objective Reconstruction
Refine the styling of buttons and tabs to be more compact and legible. Specifically, address contrast issues in active tabs where text was previously unreadable, and reduce the overall footprint of primary action buttons.

### 3. Strategic Reasoning
Based on the provided screenshot, the active tab had poor contrast (light text on light background). I shifted to using semantic tokens (`bg-accent` and `text-on-accent`) which provide a "bone-on-dark" high-contrast look consistent with the premium design system. I also reduced padding globally for primary buttons to satisfy the "compact" requirement.

### 4. Detailed Blueprint
- **Global CSS**: Update `.btn-accent` and `.btn-task` in `src/app/globals.css` (padding `px-6 py-2.5` -> `px-4 py-1.5`, font `text-sm` -> `text-xs`).
- **Widget Tabs**: Update `SmartTaskStackWidget.tsx` (padding `p-1` -> `p-0.5`, font `text-[11px]` -> `text-[10px]`, active colors `bg-accent` + `text-on-accent`).

### 5. Operational Trace
- Adjusted `globals.css` utility classes.
- Refactored `src/components/workspace/widgets/SmartTaskStackWidget.tsx` header section.
- Switched active tab text and icon colors to `text-on-accent` to ensure readability.

### 6. Status Assessment
Completed. Buttons are now more compact and tabs have significantly better readability.
