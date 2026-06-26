User request: "make x nad y in canvas a bit bigger and centered with box. bot titles like Position, Rotation, Opacity... shouild be dimmed and section titles like POSITION, LAYOUT, OPACITY & CORNER... should be bone 100"

### 0. Date and time of the request
- Date: 2026-06-25
- Time: 20:41 (Local time: 20:41+03:00)

### 1. User request
"make x nad y in canvas a bit bigger and centered with box. bot titles like Position, Rotation, Opacity... shouild be dimmed and section titles like POSITION, LAYOUT, OPACITY & CORNER... should be bone 100"

### 2. Objective Reconstruction
Modify the canvas properties sidebar style panel ([CanvasStylePanel.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/CanvasStylePanel.tsx)):
1. Make the coordinates prefix labels `X` and `Y` inside input fields visually larger and vertically centered.
2. Dim properties' sub-labels and subtitles (`Alignment`, `Position`, `Rotation`, `Dimensions`, `Opacity`, `Corner radius`, `Weight`, and Row Labels like `Color` and `Locked`) to improve visual hierarchy.
3. Brighten all capitalized panel section headings (`POSITION`, `LAYOUT`, `OPACITY & CORNER`, `FILL`, `BORDER`, `OPTIONS`) to the brightest white/bone color (`var(--bone-100)`).

### 3. Strategic Reasoning
- **Sub-label Dimming**: The properties panel uses colors like `var(--bone-50)` or `var(--bone-60)` for labels, which didn't create enough contrast against active values. Dimming sub-labels to `var(--bone-30)` pushes them into the background, focusing attention on user-interactive values.
- **Section Headers**: Elevating the headers from `var(--bone-60)` to `var(--bone-100)` makes section boundaries extremely clear.
- **X & Y Center & Size**: The raw text labels `X` and `Y` were styled with `text-[9px]`, causing them to look too small compared to numeric values. Changing them to `text-[11px]` matches the numeric text size, and adding `leading-none` strips excess line height to allow the parent flexbox container to center them perfectly.

### 4. Detailed Blueprint
Modify [CanvasStylePanel.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/CanvasStylePanel.tsx):
- Update `PanelSection` title className to `text-[var(--bone-100)]`.
- Update `PropRow` label className to `text-[var(--bone-30)]`.
- Change subtitles with class `text-[var(--bone-50)]` to `text-[var(--bone-30)]`.
- Replace `X` and `Y` prefix spans inside `SidebarInput` with `<span className="text-[11px] font-bold leading-none select-none">X</span>` and `Y`.

### 5. Operational Trace
- Replaced the uppercase section title text color with `text-[var(--bone-100)]` inside `PanelSection` component.
- Replaced `text-[var(--bone-60)]` with `text-[var(--bone-30)]` inside `PropRow` to dim labels like `Color`, `Opacity`, and `Locked`.
- Replaced all sub-header titles (using class `text-[var(--bone-50)]`) with `text-[var(--bone-30)]`.
- Updated `X` and `Y` prefix `span`s from `text-[9px] font-bold` to `text-[11px] font-bold leading-none select-none`.

### 6. Status Assessment
- **Completed**: All visual updates have been successfully written to [CanvasStylePanel.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/CanvasStylePanel.tsx).
- **Verification**: Next.js automatically compiled the edits.
- **Result**: Section titles are now fully bright, sub-labels are dimmed to 30% bone color, and coordinates labels X/Y are larger and vertically aligned perfectly.
