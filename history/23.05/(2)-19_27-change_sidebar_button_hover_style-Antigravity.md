User request: "change hover fill of hese buttons to dark same as list items in left sidebar"

### 0. Date and time of the request
May 23, 2026 at 19:27 (Local Time)

### 1. User request
User request: "change hover fill of hese buttons to dark same as list items in left sidebar"

### 2. Objective Reconstruction
The user wants to unify the hover highlight color of utility buttons across the sidebar and chat panels:
1. Change the hover background fill of all small icon buttons (e.g. `+`, settings, sun, chevrons, close, history) from the light/grey `bg-[var(--bone-6)]` to the darker, softer shade `bg-[var(--app-dark)]`.
2. Ensure the hover highlight matches the hover backdrop color of list items in the left sidebar to achieve solid visual alignment and remove color discordance.

### 3. Strategic Reasoning
- Standardizing the utility button hover state to use `hover:bg-[var(--app-dark)]` ensures a harmonious interface design, as `var(--app-dark)` is the unified backdrop color for hovered lists throughout the sidebar.
- Updating this state inside the shared `@utility btn-sidebar-utility` CSS class allows the visual design logic to automatically propagate to all matching toolbar items (e.g., chat panel headers, settings modals, workspace icons).
- Removing the inline CSS overrides `hover:bg-[var(--bone-6)]` within `TreeItem.tsx` prevents visual mismatching and unifies all list buttons under the single design system rule.

### 4. Detailed Blueprint
- **CSS Utility (`src/app/globals.css`)**:
  - Update `@utility btn-sidebar-utility` class definition.
  - Swap `hover:bg-[var(--bone-6)]` with `hover:bg-[var(--app-dark)]`.
- **Component File (`src/components/layout/TreeItem.tsx`)**:
  - Remove explicit `hover:bg-[var(--bone-6)]` overrides on buttons.
  - Update context menu active row overlay from `!bg-[var(--bone-6)]` to `!bg-[var(--app-dark)]`.

### 5. Operational Trace
- **Modified**: [globals.css](file:///Users/mktsoy/Dev/flowr-4-main/src/app/globals.css)
  - Swapped hover fill inside the shared utility.
- **Modified**: [TreeItem.tsx](file:///Users/mktsoy/Dev/flowr-4-main/src/components/layout/TreeItem.tsx)
  - Removed explicit button hover backgrounds and matched active highlight.
- **Verification**: Executed type checking with `npx tsc --noEmit` and confirmed successful zero-error compilation.

### 6. Status Assessment
- **Completed**: All sidebar utility buttons and chat toolbar buttons now hover with the dark background matching the left sidebar lists.
- **Result**: Visual cohesiveness is restored across all secondary buttons.
