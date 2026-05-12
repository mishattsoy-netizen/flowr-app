User request: "in router show rpd's as 1K or 14.4K or 500 or 1.5k no 14.000 or 1.500"

### Objective Reconstruction
The goal was to improve the visual density and readability of the RPD (Requests Per Day) limits in the admin dashboard by adopting a compact "K" notation for large numbers.

### Strategic Reasoning
1.  **Data Density**: Standard numbers with multiple commas (like 14,400) take up significant horizontal space and are harder to scan. Converting to compact notation (14.4K) provides a cleaner, more modern look.
2.  **Fractional Precision**: I used `toLocaleString` with `maximumFractionDigits: 1` to ensure that numbers like 1,500 become **1.5K** rather than just 1K or 2K.
3.  **Context-Aware Formatting**: Numbers under 1,000 are left as-is (e.g., 500) to maintain necessary precision for smaller quotas.
4.  **Cross-Page Consistency**: I applied this formatting to both the Router Orchestration matrix and the Model Registry table to ensure a unified design language.

### Detailed Blueprint
1.  **`src/components/admin/RouterManager.tsx`**:
    -   Implemented inline logic to divide RPD by 1000 and append "K" for values ≥ 1000.
    -   Handled nulls (∞) and special cases (FREE).
2.  **`src/components/admin/ModelsTable.tsx`**:
    -   Updated the `RpdBar` component to include a `formatVal` helper function.
    -   Applied this helper to both the `used` and `max` displays.

### Operational Trace
-   **Modified**: `src/components/admin/RouterManager.tsx` - Updated matrix display.
-   **Modified**: `src/components/admin/ModelsTable.tsx` - Updated registry bars.

### Status Assessment
All RPD displays now use the requested compact formatting. 14,400 is now **14.4K**, and 500 remains **500**.

### Next Recommendation
None. The UI is now much cleaner and easier to scan.
