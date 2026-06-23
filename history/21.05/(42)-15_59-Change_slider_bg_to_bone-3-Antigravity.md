User request: "use bone 3 for bg"

## 0. Date and time of the request
21.05 15:59

## 1. User request
User request: "use bone 3 for bg"

## 2. Objective Reconstruction
The user requested changing the slider track background to use `bone-3` instead of the previously set `bone-6`. This applies to the three slider components across the application.

## 3. Strategic Reasoning
To achieve this, I first verified that `--bone-3` was defined in the base theme variables in `globals.css`. I then added `--color-bone-3` to the Tailwind `@theme inline` block so the `bg-bone-3` utility class could be generated. Finally, I updated the track container in the three slider components to use `bg-bone-3` instead of `bg-bone-6`. This creates a higher contrast between the 3% white track and the 6% white active pill in dark mode.

## 4. Detailed Blueprint
- `src/app/globals.css`: Added `--color-bone-3: var(--bone-3);` to the Tailwind `@theme inline` block.
- `src/components/layout/Sidebar.tsx`: Changed the slider track class from `bg-bone-6` to `bg-bone-3`.
- `src/components/workspace/widgets/SmartTaskStackWidget.tsx`: Same as above.
- `src/components/workspace/widgets/GenericStackedWidget.tsx`: Same as above.

## 5. Operational Trace
- Edited `globals.css` to expose the tailwind variable.
- Used `multi_replace_file_content` to apply `bg-bone-3` exactly where `bg-bone-6` was used as the parent container's track background.

## 6. Status Assessment
The slider backgrounds are now lighter and subtler (`bone-3`), which provides a smoother transition and better contrast against the `bone-6` pill in dark mode and `bg-panel` pill in light mode. This completes the requested visual adjustment.
