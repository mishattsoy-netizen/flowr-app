User request: "use this #EFEEEB for my messages, selected item, hover fill..."

## 0. Date and time of the request
21.05 15:39

## 1. User request
User request: "use this #EFEEEB for my messages, selected item, hover fill..."

## 2. Objective Reconstruction
The user wants to replace the current light mode color for messages, selected items, and hover fills (which was either `#EBEBE6` or a transparent `rgba(0,0,0,0.06)` overlay) with a specific, warmer solid grey color `#EFEEEB`.

## 3. Strategic Reasoning
I previously assigned `var(--app-dark)` as the background color for messages and selected items (like slider pills). Thus, updating the light mode value of `--app-dark` from `#EBEBE6` to `#EFEEEB` in `globals.css` instantly updates all these components. For hover fills, most of the codebase was using `bg-[var(--bone-6)]` (a 6% black overlay). To unify hover fills with the new color without breaking transparent borders that also rely on `--bone-6`, I mass-replaced all instances of `bg-[var(--bone-6)]` with `bg-[var(--app-dark)]` in the components, and also updated the global `@theme` variable `--color-hover` to point to `--app-dark`.

## 4. Detailed Blueprint
- `globals.css`: Change `--app-dark: #EBEBE6;` to `--app-dark: #EFEEEB;` in `:root`.
- `globals.css`: Change `--color-hover: var(--bone-6);` to `--color-hover: var(--app-dark);` in `@theme inline`.
- Across all `src/components`: Replace instances of `bg-[var(--bone-6)]` (which handles `hover:bg-[var(--bone-6)]` and static fills) with `bg-[var(--app-dark)]`.

## 5. Operational Trace
- Edited `src/app/globals.css` to update `--app-dark` in light mode.
- Edited `src/app/globals.css` to map `--color-hover` to `--app-dark`.
- Executed a Python script to scan all `.tsx` and `.ts` files in `src/components` and mass-replace `bg-[var(--bone-6)]` with `bg-[var(--app-dark)]`.

## 6. Status Assessment
The components and utilities correctly reference `--app-dark` for their backgrounds, providing a solid `#EFEEEB` fill in light mode and `#121212` in dark mode for messages, selected tabs/pills, and all interactive hover states across the application. The unified UI consistency is preserved while satisfying the precise color preference.
