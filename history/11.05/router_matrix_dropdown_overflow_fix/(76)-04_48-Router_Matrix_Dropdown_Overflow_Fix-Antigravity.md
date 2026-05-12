User request: "same in the router" (referring to popups going beyond screen)

### Objective Reconstruction
The goal was to apply the same "open upward" logic to all dropdowns and popups in the Router Matrix grid to prevent them from being cut off at the bottom of the screen.

### Strategic Reasoning
1.  **Dynamic Viewport Awareness**: Instead of just hardcoding an "up" direction, I implemented "Smart Positioning" logic. The components now calculate their distance from the bottom of the viewport (`window.innerHeight`).
2.  **Automatic Flip**: If a component detects that it has less than 200-300px (depending on the content size) of space below it, it automatically flips to open upwards.
3.  **CreatePortal Integration**: For components like `ProviderSelector` and `RowOptionsDropdown`, I used `createPortal` to render the popups at the top level of the DOM. This avoids issues with `overflow: hidden` on parent containers and ensures popups can truly float over the entire UI.
4.  **Preserved Aesthetic**: The animated transitions and glassmorphism styling were preserved and synchronized with the dynamic opening direction.

### Detailed Blueprint
1.  **`src/components/admin/ModelDropdown.tsx`**:
    -   Added viewport height check to the `style` object.
    -   Flipped `top` to `bottom` positioning when near the edge.
2.  **`src/components/admin/RowOptionsDropdown.tsx`**:
    -   Implemented smart vertical calculation using `getBoundingClientRect`.
3.  **`src/components/admin/ProviderSelector.tsx`**:
    -   Refactored to use `createPortal`.
    -   Integrated smart vertical positioning.

### Operational Trace
-   **Modified**: `src/components/admin/ModelDropdown.tsx`
-   **Modified**: `src/components/admin/RowOptionsDropdown.tsx`
-   **Modified**: `src/components/admin/ProviderSelector.tsx`

### Status Assessment
All interactive elements in the Router Matrix now handle screen boundaries gracefully. Popups will "smart-flip" upwards whenever they are near the bottom of the grid.

### Next Recommendation
None. The UI is now much more robust across different screen resolutions and zoom levels.
