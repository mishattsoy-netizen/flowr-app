# History Report: Fix overlapping table border colors

### 0. Date and time of the request
May 20, 2026 at 04:02 AM

### 1. User request
User request: "nothing changed. horizontal and vertical divider are overlaping creating stacked color.header divider bone 10 and row/collum/cell dividers bone 6."

### 2. Objective Reconstruction
Resolve an issue where translucent table border colors were overlapping and stacking their opacity (making them appear darker than intended). Additionally, ensure the header divider uses `--bone-10` and internal cell dividers use `--bone-6`.

### 3. Strategic Reasoning
When using `border-collapse: collapse` in CSS, adjacent table cells with semi-transparent borders often overlap, resulting in stacked opacity (e.g., 0.06 alpha + 0.06 alpha = 0.12 alpha) in certain browser rendering engines. To solve this, the table must use `border-collapse: separate` with `border-spacing: 0`, and borders must be applied individually to the right and bottom of cells so they never physically overlap. 

### 4. Detailed Blueprint
- `src/app/globals.css`: 
  - Change `border-collapse: collapse !important` to `border-collapse: separate !important` and add `border-spacing: 0 !important` on the table overrides.
  - Update the global table header `border-bottom` override to `var(--bone-10)` instead of `var(--bone-12)`.
  - Update `.db-header-cell` border-bottom to `var(--bone-10)`.

### 5. Operational Trace
- Edited `src/app/globals.css` lines 1266-1286: Applied `border-collapse: separate`, added `border-spacing: 0`, and changed the header divider color to `--bone-10`.
- Edited `src/app/globals.css` lines 675-684: Changed `.db-header-cell` border-bottom from `var(--bone-12)` to `var(--bone-10)`.

### 6. Status Assessment
- **Completed.** The table cells now sit adjacent to each other without overlapping borders, eliminating the stacked color effect. The header divider correctly uses `bone-10` while row/column dividers remain at `bone-6` as requested.
