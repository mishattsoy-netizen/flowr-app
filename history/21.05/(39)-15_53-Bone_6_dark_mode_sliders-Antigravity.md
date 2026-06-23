User request: "in dark mode for  switches use bone 6 as bg and bone 6 for pill"

## 0. Date and time of the request
21.05 15:53

## 1. User request
User request: "in dark mode for  switches use bone 6 as bg and bone 6 for pill"

## 2. Objective Reconstruction
The user wants to refine the dark mode styling for the navigation sliders (Sidebar, Smart Task Stack, Generic Stack). Specifically, they want both the slider track and the active sliding pill to use the `var(--bone-6)` translucent overlay, while omitting any shadows. Because opacity stacks, stacking a 6% white pill over a 6% white track results in an elegant, slightly lighter active state.

## 3. Strategic Reasoning
To implement this, I updated the three slider components to standardize the dark mode classes. Since the slider tracks already use `bg-[var(--bone-6)]` universally, I just removed the `dark:bg-panel` override so they remain `bone-6` in both modes. For the pill, I updated the dark mode override from `dark:bg-[var(--app-dark)] dark:shadow-sm` to simply `dark:bg-[var(--bone-6)]`. This removes the shadow and layers the two translucent backgrounds on top of each other.

## 4. Detailed Blueprint
- `src/components/layout/Sidebar.tsx`: Change track to remove `dark:bg-panel` and change pill to use `dark:bg-[var(--bone-6)]` without shadow.
- `src/components/workspace/widgets/SmartTaskStackWidget.tsx`: Same changes as above.
- `src/components/workspace/widgets/GenericStackedWidget.tsx`: Same changes as above.

## 5. Operational Trace
- Used `multi_replace_file_content` to apply the class adjustments across all three slider components, ensuring consistency across the dashboard.

## 6. Status Assessment
The dark mode sliders now perfectly match the requested design: a flat, translucent 6% white track with a flat, translucent 6% white active pill layered on top, creating a subtle and clean "glass-on-glass" highlighting effect without any shadows.
