User request: "use bone 6 for sidebar and wigets borders"

### 0. Date and time of the request
Date: 2026-05-21  
Time: 02:31 CET  

### 1. User request
User request: "use bone 6 for sidebar and wigets borders"

### 2. Objective Reconstruction
The task is to transition the border styling for all sidebars, database grids, layouts, and widget containers from higher-contrast values like `var(--bone-12)` or `var(--bone-15)` to the more subtle and visually premium `var(--bone-6)` border style (resolving to `rgba(233, 233, 226, 0.06)`).

### 3. Strategic Reasoning
By standardizing sidebar and widget borders to use `var(--bone-6)`, we create a highly cohesive dark aesthetic against the `#1E1E1D` system background. High-contrast border variables (e.g. `--bone-12`) are replaced with `--bone-6` across widgets and tables, ensuring elements blend smoothly into the system visual layers while maintaining clean structural definition.

### 4. Detailed Blueprint
- Identify remaining widget styling targets:
  - `src/components/admin/VaultProviderWidget.tsx` (main panel border)
  - `src/app/admin/users/page.tsx` (overview metric widgets & node search wrappers)
  - `src/app/admin/presets/page.tsx` (register new tier widgets)
  - `src/app/admin/page.tsx` (dashboard panels & metric cards)
  - `src/app/admin/users/UsersTable.tsx` (database table wrappers & headers)
- Apply Tailwind structural replacements:
  - Substitute `border-[var(--bone-12)]` with `border-[var(--bone-6)]`.

### 5. Operational Trace
- **Updated `src/components/admin/VaultProviderWidget.tsx`**: Updated container border class at line 207 to `border-[var(--bone-6)]`.
- **Updated `src/app/admin/users/page.tsx`**: Replaced all high-contrast widget border classes (lines 38, 42, 49, 58, 59, 65, 68) with `border-[var(--bone-6)]`.
- **Updated `src/app/admin/presets/page.tsx`**: Changed line 18 widget container border to `border-[var(--bone-6)]`.
- **Updated `src/app/admin/page.tsx`**: Modified dashboard traffic telemetry panels, recent events container, and MetricCards at lines 31, 41, 63 to use `border-[var(--bone-6)]`.
- **Updated `src/app/admin/users/UsersTable.tsx`**: Aligned database grid outer wrapper and row headers border configurations on lines 48 and 51 to use `border-[var(--bone-6)]`.

### 6. Status Assessment
- **Completed**: Unified all sidebar and widget borders to use `var(--bone-6)`.
- **Outcome**: The visual representation matches the premium, low-contrast dark mode requirements flawlessly, resolving design inconsistencies across admin features.
