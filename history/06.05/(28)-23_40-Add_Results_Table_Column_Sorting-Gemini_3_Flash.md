User request: "add ability to sort models by any column header like id or rpds, asceding or descending"

### 1. Objective Reconstruction
The objective of this request was to add a fully interactive sorting capability to the Discover page's `ResultsTable`. Users can click any applicable column header (like Model ID, Display Name, Context, Max Out, RPD, RPM, or Saved status) to toggle ascending or descending sort order.

### 2. Strategic Reasoning
- **Modularity**: Implemented the sorting state (`sortField` and `sortAsc`) inside the `ResultsTable` client component itself, avoiding unnecessary re-renders of the parent `DiscoverClient` controls wrapper.
- **Accurate Sorting**: Added support for various data types:
  - **Strings**: Uses `localeCompare` for safe, alphabetical string comparisons on `id` and `displayName`.
  - **Booleans**: Handles `inRegistry` saved status cleanly.
  - **Numbers / Nulls**: Handles context limit, max output token count, RPD, and RPM. Pushes `null` values cleanly to the bottom when sorting in ascending order so they don't break order continuity.
- **User Indicators**: Rendered visual sort-direction triangles (`▲` for ascending, `▼` for descending) next to active sorted column headers.

### 3. Detailed Blueprint
- **`src/app/admin/discover/DiscoverClient.tsx`**:
  - Defined `HEADERS` configuration holding sorted fields.
  - Implemented `sortField` and `sortAsc` state and the `handleSort` handler.
  - Wrapped models in a `React.useMemo` to sort them reactively.
  - Replaced static column headers with clickable `<button>` elements connected to `handleSort`.

### 4. Operational Trace
- Edited `src/app/admin/discover/DiscoverClient.tsx` using `replace_file_content` to apply the sorting logic and headers layout.
- Verified successful compilation.

### 5. Status Assessment
- **Completed**: Columns are now fully sortable in both ascending and descending directions with clear indicators.
