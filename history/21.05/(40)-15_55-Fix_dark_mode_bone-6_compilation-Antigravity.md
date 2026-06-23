User request: "i dont see changes"

## 0. Date and time of the request
21.05 15:55

## 1. User request
User request: "i dont see changes"

## 2. Objective Reconstruction
The user reported that the previous changes applied to the dark mode sliders (using `bone-6` for track and pill) were not visible or did not take effect as intended.

## 3. Strategic Reasoning
When using arbitrary CSS variable values in Tailwind v4 alongside pseudo-selectors (like `dark:bg-[var(--bone-6)]`), there can occasionally be compilation quirks or hot-reload failures, preventing the classes from being generated. To fix this comprehensively and ensure the styles are strictly enforced by the build system, I manually registered `--color-bone-6` inside the `@theme inline` block of `globals.css`. I then refactored all instances of the arbitrary bracket syntax `bg-[var(--bone-6)]` to the standard Tailwind utility classes `bg-bone-6` and `dark:bg-bone-6`. 

## 4. Detailed Blueprint
- `src/app/globals.css`: Added `--color-bone-6: var(--bone-6);` inside `@theme inline`.
- `src/components/layout/Sidebar.tsx`: Changed `bg-[var(--bone-6)]` to `bg-bone-6` and `dark:bg-[var(--bone-6)]` to `dark:bg-bone-6`.
- `src/components/workspace/widgets/SmartTaskStackWidget.tsx`: Same as above.
- `src/components/workspace/widgets/GenericStackedWidget.tsx`: Same as above.

## 5. Operational Trace
- Added the missing `bone-6` color to the theme object in `globals.css` and replaced all slider component class names with standard utilities.

## 6. Status Assessment
The styles are now firmly integrated into the standard Tailwind utility pipeline. If the changes are still not appearing, it is highly likely that a hard refresh of the browser or a restart of the local dev server is required to pick up the `@theme` injection in Tailwind v4.
