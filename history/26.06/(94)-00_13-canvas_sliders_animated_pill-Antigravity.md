User request: "make sliders in canvas behaviour same as in nav slider"

## 0. Date and time
26.06.2026 00:13

## 1. User request
"make sliders in canvas behaviour same as in nav slider"

## 2. Objective Reconstruction
The Canvas inspector panel had two static tab-group sliders (Canvas Pattern: None/Grid/Dots, and Border Weight style: solid/dashed/dotted) that used plain background color toggling. The user wants them to use the same animated sliding pill as the navigation bar slider.

## 3. Fix Applied
Added a reusable `SliderGroup<T>` component to `CanvasStylePanel.tsx`:
- Same visual approach as nav slider: `var(--slider-track)` background, absolute animated pill using `var(--slider-pill)` + `transition-all duration-250 ease-out`
- Uses `useLayoutEffect` + `getBoundingClientRect()` to measure button position and animate the pill precisely (same technique as RecentWidget/SmartTaskStackWidget)
- Buttons sit above the pill via `relative z-10`
- Supports a `renderLabel` prop for icons+text (used for Canvas Pattern)

Replaced two old static tab groups with `<SliderGroup>`:
- Border weight stroke style: solid / dashed / dotted
- Canvas pattern: None / Grid / Dots

## 4. Operational Trace
- Modified `CanvasStylePanel.tsx`: added `useLayoutEffect` to imports, added `SliderGroup` component, replaced 2 tab groups.
- Ran `npx tsc --noEmit` → exit 0.

## 5. Status Assessment
Both canvas sliders now animate with the sliding pill exactly like the nav bar.
