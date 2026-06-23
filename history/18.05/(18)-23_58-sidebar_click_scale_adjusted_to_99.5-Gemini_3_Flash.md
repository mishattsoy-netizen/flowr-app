User request: "change to 99.5"

### 0. Date and Time of the Request
- **Date**: 18.05.2026
- **Time**: 23:58

### 1. User Request
User request: "change to 99.5"

### 2. Objective Reconstruction
Modify the click active scale factor of all left sidebar items (`.sidebar-item-row`) to a more subtle and premium `99.5%` (`scale-[0.995]`) instead of `99%` (`scale-[0.99]`).

### 3. Strategic Reasoning
- While a `99%` (`0.99`) scale factor provides a clear tactile click press, a `99.5%` (`0.995`) press animation feels incredibly subtle, high-end, and perfectly aligned with a professional, non-intrusive "digital instrument" interactive feedback philosophy.
- The change was made directly to the `.sidebar-item-row` class definition inside `src/app/globals.css` using Tailwind active-state utility class mapping.

### 4. Detailed Blueprint
- File to modify: `src/app/globals.css`
- Change `@apply active:scale-[0.99];` to `@apply active:scale-[0.995];`.

### 5. Operational Trace
- Identified the active scale definition inside the `.sidebar-item-row` CSS block at line 357-359 of `src/app/globals.css`.
- Replaced the rule with `active:scale-[0.995]` using the `replace_file_content` tool.

### 6. Status Assessment
- **Status**: Completed successfully.
- **Verification**: The active scale-down on clicking sidebar items is now set to a very elegant and responsive `0.995`.
