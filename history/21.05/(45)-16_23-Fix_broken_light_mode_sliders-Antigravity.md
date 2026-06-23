User request: "you broke the sliders in light mode"

## 0. Date and time of the request
21.05 16:23

## 1. User request
User request: "you broke the sliders in light mode"

## 2. Objective Reconstruction
The slider components were invisible in light mode after the previous bone-3 changes. Both the track and the pill were effectively invisible (track = 3% black on white, pill = white on near-white).

## 3. Strategic Reasoning
Two problems caused the sliders to break:
1. `bg-bone-3` (3% black) on a white background is nearly transparent — the track disappeared entirely.
2. `--slider-pill: var(--app-panel)` = pure white on a `#F7F7F6` sidebar = invisible.

The fix was to introduce two new CSS variables:
- `--slider-track`: 8% black in light mode (clearly visible), and 6% white (`bone-6`) in dark mode.
- `--slider-pill-shadow`: subtle box-shadow in light mode to differentiate the white pill from the white/grey track. None in dark mode.

These variables are applied natively via `style={{ background: 'var(--slider-track)' }}` on the track container and `boxShadow: 'var(--slider-pill-shadow)'` on the pill. This approach bypasses any Tailwind compilation issues and is guaranteed to be runtime-dynamic.

## 4. Detailed Blueprint
- `src/app/globals.css`: Added `--slider-track` and `--slider-pill-shadow` to both `:root` and `.dark`.
- `src/components/layout/Sidebar.tsx`: Switched track to `style={{ background: 'var(--slider-track)' }}`, added `boxShadow` to pill style.
- `src/components/workspace/widgets/SmartTaskStackWidget.tsx`: Same.
- `src/components/workspace/widgets/GenericStackedWidget.tsx`: Same, added shadow to pillStyle memo.

## 6. Status Assessment
Sliders now have clear visual presence in both light mode (8% black track + shadowed white pill) and dark mode (6% white track + flat bone-6 pill).
