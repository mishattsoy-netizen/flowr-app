User request: "no revert"

## 0. Date and time of the request
25.06.2026 23:03

## 1. User request
"no revert"

## 2. Objective Reconstruction
The user wants to revert the dark mode hover background changes, returning them back to the original light warm-white overlays (`rgba(233, 233, 226, ...)`).

## 3. Strategic Reasoning
Following the user's feedback, the background overlay variables (`--bone-2` through `--bone-15`) in `src/app/globals.css` within the `.dark` selector block were restored to their original light warm-white values. Additionally, `BRANDING/PREFERENCES.md` was reverted to its previous description of the `bg-[var(--bone-2)]` color behavior.

## 4. Detailed Blueprint
- **File to modify:** `src/app/globals.css`
  - Restore `--bone-2` through `--bone-15` in the `.dark` block.
- **File to update:** `BRANDING/PREFERENCES.md`
  - Revert the block hover backgrounds description to specify `rgba(233, 233, 226, 0.02)` in dark mode.

## 5. Operational Trace
- Modified `src/app/globals.css` to restore the `--bone-` variables in dark mode.
- Modified `BRANDING/PREFERENCES.md` to revert changes.

## 6. Status Assessment
Changes reverted successfully. Hover colors and borders are back to their original configuration.
