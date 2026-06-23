User request: "create new color: sys color - #1E1E1D, use it as bg color for sidebars and tabs header only"

### 0. Date and time of the request
- Date: 21.05
- Time: 02:24

### 1. User request
User request: "create new color: sys color - #1E1E1D, use it as bg color for sidebars and tabs header only"

### 2. Objective Reconstruction
The user wants a new system-specific dark color `#1E1E1D` (named `sys color`) to be defined and used strictly as the background color for the left sidebars and top tab headers (`HeaderBar` / `bg-sidebar`), keeping the other panels at the default `#262626` background.

### 3. Strategic Reasoning
Because the left sidebar (`Sidebar.tsx`) and the top tab header (`HeaderBar.tsx`) are already styled using the semantic class `bg-sidebar` (which maps to `--color-sidebar`), I can surgically achieve this styling change without breaking code structure or other panels. I will define a new CSS variable `--sys-color: #1E1E1D` in `:root` inside `globals.css` and map `--color-sidebar: var(--sys-color)` under the Tailwind theme. This ensures only those two regions pick up the new color, keeping widgets and other panel containers styled with the normal `--color-panel` background.

### 4. Detailed Blueprint
- Add `--sys-color: #1E1E1D;` into `:root` in `globals.css`.
- In `globals.css`'s `@theme inline` block, change `--color-sidebar: var(--color-panel);` to `--color-sidebar: var(--sys-color);`.

### 5. Operational Trace
- Edited `/Users/mktsoy/Dev/flowr-4-main/src/app/globals.css` to add the custom color variable and bind it to the Tailwind `sidebar` theme color token.

### 6. Status Assessment
The new `sys color` `#1E1E1D` was created and successfully set as the background for the sidebar and the tab header. All other areas of the application retain their standard background colors as designed.
