User request: "if you dont know exact rpds dont show them"

### 1. Objective Reconstruction
The objective was to improve the display of unknown RPD (Requests Per Day) limits. Instead of displaying an infinite symbol (`∞`) which implies unlimited capacity, we should display a standard empty/null dash (`—`) to clearly signal that the exact limit is unspecified or unknown.

### 2. Strategic Reasoning
- **Visual Accuracy**: Displays an infinite symbol (`∞`) only when we are positive a model is truly unlimited (e.g., local models). For models where the exact limit is simply not specified or fetched, displaying a clean dash (`—`) is much more precise and matches other empty states like `Context` and `Max Out`.
- **Consistency**: Now, all unknown fields in the discovery results table (Context Window, Max Output, RPD, RPM) use the exact same dash (`—`) standard fallback.

### 3. Detailed Blueprint
- **`src/app/admin/discover/DiscoverClient.tsx`**: Update the table cell for `m.rpd` to return `'—'` when `m.rpd === null`.

### 4. Operational Trace
- Edited `src/app/admin/discover/DiscoverClient.tsx` to replace `{m.rpd === null ? '∞' : m.rpd}` with `{m.rpd === null ? '—' : m.rpd}`.
- Confirmed successful compilation.

### 5. Status Assessment
- **Completed**: Unknown RPD fields now cleanly display a dash (`—`) instead of infinite symbols (`∞`), aligning perfectly with user preferences.
