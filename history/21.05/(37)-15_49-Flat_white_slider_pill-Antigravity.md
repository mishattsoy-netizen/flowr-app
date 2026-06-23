User request: "and ill should be white without shadow"

## 0. Date and time of the request
21.05 15:49

## 1. User request
User request: "and ill should be white without shadow"

## 2. Objective Reconstruction
The user wants to remove the shadow from the sliding active pill on the navigation sliders (Sidebar, SmartTaskStackWidget, GenericStackedWidget) and set its background color to the standard panel color (which renders as white in light mode), essentially reverting it from the `#EFEEEB` `bg-[var(--app-dark)]` styling.

## 3. Strategic Reasoning
To achieve the clean, flat look requested, I located the three instances of the sliding navigation/tab widget. For each slider pill, I removed the `shadow-sm` class and replaced `bg-[var(--app-dark)]` with `bg-panel`. Additionally, I ensured that all of their container tracks use `bg-[var(--bone-6)]` to properly contrast with the flat white pill.

## 4. Detailed Blueprint
- `src/components/layout/Sidebar.tsx`: Change sliding pill class from `bg-[var(--app-dark)] shadow-sm` to `bg-panel`.
- `src/components/workspace/widgets/SmartTaskStackWidget.tsx`: Change sliding pill class from `bg-[var(--app-dark)] shadow-sm` to `bg-panel` and track container to `bg-[var(--bone-6)]`.
- `src/components/workspace/widgets/GenericStackedWidget.tsx`: Change sliding pill class from `bg-[var(--app-dark)] shadow-sm` to `bg-panel` and track container to `bg-[var(--bone-6)]`.

## 5. Operational Trace
- Replaced the styling strings for the sliding pill and container track in `Sidebar.tsx`, `SmartTaskStackWidget.tsx`, and `GenericStackedWidget.tsx` using `multi_replace_file_content`.

## 6. Status Assessment
The slider pills now correctly display as flat white (`bg-panel`) rectangles without shadows across all three multi-tab navigation headers, sitting on top of the slightly darker grey (`bg-[var(--bone-6)]`) slider track.
