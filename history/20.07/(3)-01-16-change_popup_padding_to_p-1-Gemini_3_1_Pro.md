User request: "make them p-1 instead"

### 0. Date and time of the request
20.07.2026 01:16

### 1. User request
User request: "make them p-1 instead"

### 2. Objective Reconstruction
Following the previous task where all context menus were standardized to use a `p-1.5` padding globally, the user requested to change this global standardized padding to `p-1`.

### 3. Strategic Reasoning
Since all manual and inline padding overrides across the application's 26 context popup components were already stripped out in the previous step, updating the padding globally requires only a single modification. The `@utility popup-glass-small` class in `globals.css` serves as the single source of truth for all small context popups. By changing its internal `@apply` padding value from `p-1.5` to `p-1`, the change automatically cascades to all popups immediately without having to touch the individual component files again.

### 4. Detailed Blueprint
- Locate the `@utility popup-glass-small` block in `src/app/globals.css`.
- Update the `@apply` directive to use `p-1` instead of `p-1.5`.

### 5. Operational Trace
- Edited `src/app/globals.css`, modifying line 520 from `@apply border border-[var(--bone-12)] rounded-[var(--radius-regular)] transition-none p-1.5;` to `@apply border border-[var(--bone-12)] rounded-[var(--radius-regular)] transition-none p-1;`.

### 6. Status Assessment
The context popups now globally use a 4px padding (`p-1`) instead of 6px (`p-1.5`). The change has been successfully applied to the CSS utility. No further action is required.
