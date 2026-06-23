User request: "increase dm sans font weight medium->semibold, semibold->bold in light mode"

## 0. Date and time of the request
21.05 15:35

## 1. User request
User request: "increase dm sans font weight medium->semibold, semibold->bold in light mode"

## 2. Objective Reconstruction
The user wants to dynamically increase the font weights associated with "medium" and "semibold" in light mode. Specifically, they want `font-medium` to render as `semibold` (600) and `font-semibold` to render as `bold` (700) in light mode, while retaining their default weights (500 and 600 respectively) in dark mode.

## 3. Strategic Reasoning
Since the application uses Tailwind CSS v4, font weights for utilities like `font-medium` and `font-semibold` are mapped to CSS variables internally (e.g. `--font-weight-medium`). By defining dynamic variables (`--weight-medium` and `--weight-semibold`) inside `:root` and `.dark` blocks, and wiring them into the `@theme inline` declaration, we can make the font weights theme-aware without needing to change any specific HTML tags throughout the codebase.

## 4. Detailed Blueprint
- `globals.css`: Define `--weight-medium: 600;` and `--weight-semibold: 700;` in the `:root` pseudo-class (light mode).
- `globals.css`: Define `--weight-medium: 500;` and `--weight-semibold: 600;` in the `.dark` class (dark mode).
- `globals.css`: Inside `@theme inline`, map `--font-weight-medium` to `var(--weight-medium)` and `--font-weight-semibold` to `var(--weight-semibold)`.

## 5. Operational Trace
- Edited `src/app/globals.css` to add the dynamic font weight variables to `:root` and `.dark`.
- Added the mappings to `@theme inline` in `src/app/globals.css` to override Tailwind v4's default weights.

## 6. Status Assessment
The font weights are now dynamically bound to the current theme. Text using `font-medium` will appear thicker (semibold) in light mode and normal (medium) in dark mode. Text using `font-semibold` will appear bold in light mode and semibold in dark mode. This addresses the user's legibility concerns smoothly and system-wide.
