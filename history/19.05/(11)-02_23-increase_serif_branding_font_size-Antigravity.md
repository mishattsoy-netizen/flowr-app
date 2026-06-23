User request: "bigger"

## 0. Date and time of the request
Date: 19.05 (May 19, 2026)
Time: 02:23

## 1. User request
"bigger"

## 2. Objective Reconstruction
Increase the font size of the text-only branding element in the sidebar:
- For full layout "Flowr", scale the size up from `20px` to `24px` (`text-[24px]`).
- For collapsed layout "F", scale the size up from `19px` to `23px` (`text-[23px]`).

## 3. Strategic Reasoning
Increasing the font size to `24px` provides a much stronger, weightier visual signature for the Literata typeface. It makes the branding feel more intentional and premium, matching standard top-level page headers while preserving the tight tracking.

## 4. Detailed Blueprint
- `src/components/layout/Sidebar.tsx`: Change the font size utility classes of both full and collapsed brand text spans.

## 5. Operational Trace
- Edited `src/components/layout/Sidebar.tsx` to set:
  - `text-[24px]` for the expanded "Flowr" span.
  - `text-[23px]` for the collapsed "F" span.

## 6. Status Assessment
- **Completed**: Branding text successfully scaled up to 24px/23px.
