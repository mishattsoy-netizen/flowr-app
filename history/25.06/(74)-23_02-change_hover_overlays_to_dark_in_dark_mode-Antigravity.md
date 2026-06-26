User request: "change hover to dark"

## 0. Date and time of the request
25.06.2026 23:02

## 1. User request
"change hover to dark"

## 2. Objective Reconstruction
The user wants hover and active state overlays in dark mode to be dark/black-based overlays (`rgba(0, 0, 0, ...)`) rather than light warm-white overlays (`rgba(233, 233, 226, ...)`). This ensures a darker background highlights design on hover and active states across the panels, toolbars, and buttons in dark mode.

## 3. Strategic Reasoning
Instead of modifying multiple components that use standard variables like `--bone-6` or `--bone-10` for hover backgrounds, the custom CSS variables `--bone-2` through `--bone-15` in `src/app/globals.css` (specifically within the `.dark` class block) were modified to be black-based overlays. Since they are used for background/active fills, changing their base colors to `rgba(0, 0, 0, ...)` cascades across all button hovers and active backgrounds while leaving foreground/text variables intact.

## 4. Detailed Blueprint
- **File to modify:** `src/app/globals.css`
  - In the `.dark` class block, change `--bone-2`, `--bone-3`, `--bone-5`, `--bone-6`, `--bone-10`, `--bone-12`, and `--bone-15` values from `rgba(233, 233, 226, ...)` to `rgba(0, 0, 0, ...)`.
- **File to update:** `BRANDING/PREFERENCES.md`
  - Update preferences documentation to reflect that `--bone-2` through `--bone-15` variables are now black overlays in both modes.

## 5. Operational Trace
- Replaced the `.dark` definitions of `--bone-5`, `--bone-2`, `--bone-3`, `--bone-6`, `--bone-10`, `--bone-12`, and `--bone-15` in `src/app/globals.css` with their `rgba(0, 0, 0, ...)` equivalents.
- Updated `BRANDING/PREFERENCES.md` to document the new hover/active overlay specification.

## 6. Status Assessment
Changes completed successfully. Hover backgrounds and active selection states on the floating panels, toolbars, and selectors are now beautifully dark.
