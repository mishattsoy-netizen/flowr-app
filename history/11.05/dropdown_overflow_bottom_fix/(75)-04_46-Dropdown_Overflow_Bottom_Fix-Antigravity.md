User request: "fix popup goest beyond screen in the bottom"

### Objective Reconstruction
The goal was to prevent the provider selection dropdown in the Model Registry from being cut off at the bottom of the screen, specifically when adding a new model in the "Add Row" section.

### Strategic Reasoning
1.  **Directional Flexibility**: I modified the `ProviderDropdown` component to accept an optional `up` prop. This allows specific instances of the dropdown to change their opening direction based on their position in the layout.
2.  **Upward Anchoring**: For bottom-anchored rows like "Add Row", opening the dropdown upwards (`bottom-full`) is the most reliable solution to avoid viewport overflow.
3.  **Animation Sync**: I synchronized the CSS animation origin (`origin-bottom` vs `origin-top`) with the opening direction to ensure the "scale-in" effect remains visually consistent and premium.

### Detailed Blueprint
1.  **`src/components/admin/ModelsTable.tsx`**:
    -   Modified `ProviderDropdown` to include an `up` boolean prop (default: false).
    -   Updated the positioning classes to use `bottom-full mb-1` and `origin-bottom` when `up` is true.
    -   Applied `up={true}` to the `ProviderDropdown` instance within the `AddRow` component.

### Operational Trace
-   **Modified**: `src/components/admin/ModelsTable.tsx` - Updated component logic and applied the fix to the footer row.

### Status Assessment
The provider dropdown in the "Add Row" section now opens upwards, ensuring it is always fully visible regardless of how far the user has scrolled or the screen size.

### Next Recommendation
Monitor if other dropdowns (like the one in the matrix or logs) exhibit similar behavior on small screens; we can apply the same `up` prop logic there if needed.
