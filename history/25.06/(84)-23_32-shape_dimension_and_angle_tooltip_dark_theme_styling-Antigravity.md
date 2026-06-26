User request: "make size and angle boxes under shape folled with dark color"

## 0. Date and time of the request
25.06.2026 23:32

## 1. User request
"make size and angle boxes under shape folled with dark color"

## 2. Objective Reconstruction
Change the styling of the live sizing (dimensions) and angle (rotation) tooltip overlays rendered underneath active shape blocks inside `CanvasBlock.tsx`. Replace their high-contrast light background fills with a dark-theme background overlay matching the premium bone design guidelines.

## 3. Strategic Reasoning
High-contrast light tooltips (`bg-[var(--bone-100)] text-background`) appear excessively bright and visually distracting in dark mode. Refactoring them to use dark-theme variables (`bg-[var(--app-dark)] text-[var(--bone-90)] border border-[var(--bone-12)] shadow-md`) keeps them visually subtle and consistent with other canvas inspector tools. We also updated `font-bold` to `font-medium` and corners to `rounded-[var(--radius-tiny)]` to adhere to branding styling preferences.

## 4. Detailed Blueprint
- **CanvasBlock.tsx:**
  - Update `.dimension-label` container's class to use dark-theme fills, light-text, border, shadow, and medium font weight.
  - Update `.rotation-label` container's class to match the same styling layout.

## 5. Operational Trace
- Modified [CanvasBlock.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/CanvasBlock.tsx) styles inside tooltip blocks.
- Ran `npx tsc --noEmit` which completed successfully with exit code 0.

## 6. Status Assessment
Completed and validated. Sizing and rotation overlay tooltips render as soft, dark pills with clean borders.
