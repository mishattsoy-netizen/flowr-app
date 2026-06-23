User request: "why is dark mode changing aswell"

## 0. Date and time of the request
21.05 15:50

## 1. User request
User request: "why is dark mode changing aswell"

## 2. Objective Reconstruction
The user noticed that the recent styling changes to the navigation sliders (making the track darker and the pill white without shadow) unintentionally broke the dark mode aesthetic, making the pill look flat or wrongly colored in the dark theme. The objective is to restrict those specific stylistic changes to light mode only, restoring the original high-contrast dark mode styling for the sliders.

## 3. Strategic Reasoning
When I previously swapped `bg-[var(--app-dark)] shadow-sm` for `bg-panel` (pill) and `bg-panel` for `bg-[var(--bone-6)]` (track), these Tailwind classes applied universally across both color schemes. To decouple the themes, I needed to explicitly add Tailwind's `dark:` pseudo-class modifiers. By appending `dark:bg-panel` to the track and `dark:bg-[var(--app-dark)] dark:shadow-sm` to the pill, light mode gets the new flat white aesthetic, while dark mode correctly falls back to its original polished appearance.

## 4. Detailed Blueprint
- `src/components/layout/Sidebar.tsx`: Add `dark:bg-panel` to track and `dark:bg-[var(--app-dark)] dark:shadow-sm` to the sliding pill.
- `src/components/workspace/widgets/SmartTaskStackWidget.tsx`: Same as above.
- `src/components/workspace/widgets/GenericStackedWidget.tsx`: Same as above.

## 5. Operational Trace
- Used `multi_replace_file_content` to inject the `dark:` utility classes into the three sliding pill components.

## 6. Status Assessment
The slider UI is now correctly isolated between modes:
- **Light mode**: Darker track (`bg-[var(--bone-6)]`) with a flat white pill (`bg-panel`).
- **Dark mode**: Standard track (`bg-panel`) with the darker active pill + shadow (`bg-[var(--app-dark)] shadow-sm`).
