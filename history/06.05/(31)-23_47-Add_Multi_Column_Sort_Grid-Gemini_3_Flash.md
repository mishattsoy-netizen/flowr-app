User request: "add sorting ting ascending descending and new none. and add ability to apply multiple sortings at the asame time"

### 1. Objective Reconstruction
The objective was to implement an advanced, professional multi-column sorting system that:
1. Cycles sorting states across three states: **None** → **Ascending** (`'asc'`) → **Descending** (`'desc'`) → **None** (un-sorted/removed).
2. Allows users to apply multiple sortings at the same time, with each clicked column acting as a subsequent sort priority (primary, secondary, tertiary, etc.).

### 2. Strategic Reasoning
- **Multi-Sort State Chaining**: Modeled sorting as an ordered array of `SortConfig` configurations (`{ field, direction }[]`).
- **Mathematical Sorting Logic**: Programmed the sort comparator to evaluate each active configuration in priority order. If elements differ on a given configuration field, it returns the result immediately. If they are equal, it moves to the next active configuration in the chain (falling back to relative document position if all active fields match).
- **Interactive Badges**: Rendered priority numbers (e.g. `1`, `2`, `3`) inside subtle accent-tnted badges next to active sort triangles (`▲` or `▼`) to show the user exactly how their multi-column sorting is being prioritized.

### 3. Detailed Blueprint
- **`src/app/admin/discover/DiscoverClient.tsx`**:
  - Defined `SortConfig` interface holding `field` and `direction` properties.
  - Re-implemented `handleSort` to cycle configurations: if missing → `'asc'`, if `'asc'` → `'desc'`, if `'desc'` → removed.
  - Rewrote `sortedModels` `React.useMemo` to chain comparisons across the active configurations array.
  - Modified header rendering to display direction triangles and priority numbers when multi-sorting is active.

### 4. Operational Trace
- Edited `src/app/admin/discover/DiscoverClient.tsx` using `replace_file_content` to apply multi-column sorting.
- Verified successful compilation.

### 5. Status Assessment
- **Completed**: Advanced priority-based multi-column sorting is now fully active, allowing complex data grids with visual feedback badges.
