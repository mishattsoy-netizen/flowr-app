User request: "rows dont have hover effect in light mode"

### 0. Date and time of the request
2026-06-09 16:04

### 1. User request
"rows dont have hover effect in light mode"

### 2. Objective Reconstruction
Resolve the issue where block rows inside the document editor do not show a hover background effect when running in light mode. Change the hardcoded `bg-white/[0.01]` class which is invisible on light/white backgrounds to a theme-aware background color style.

### 3. Strategic Reasoning
- The editor rows (rendered via `BlockRenderer.tsx`) previously used `bg-white/[0.01]` to apply a very subtle background tint on hover or focus in dark mode.
- In light mode, this 1% white overlay is drawn on top of a light background, making it completely invisible to users.
- By switching to the semantic theme variable `bg-[var(--bone-2)]` (which maps to `rgba(0, 0, 0, 0.02)` in light mode, and `rgba(233, 233, 226, 0.02)` in dark mode), we ensure the hover background represents a 2% translucent overlay of the correct text-color contrast. This resolves light mode hover visibility cleanly and preserves dark mode hover styling without introducing heavy hardcoded colors.
- The folding trigger chevron container hover style of `hover:bg-white/10` is similarly replaced with `hover:bg-[var(--bone-10)]` for theme-aware visibility.

### 4. Detailed Blueprint
- **File**: [BlockRenderer.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/editor/BlockRenderer.tsx)
  - Replace `group-hover:bg-white/[0.01]` on line 604 with `group-hover:bg-[var(--bone-2)]`.
  - Replace `isFocused ? "bg-white/[0.01]" : "group-hover:bg-white/[0.01]"` on line 657 with `isFocused ? "bg-[var(--bone-2)]" : "group-hover:bg-[var(--bone-2)]"`.
  - Replace `hover:bg-white/10` on line 666 with `hover:bg-[var(--bone-10)]`.
- **File**: [PREFERENCES.md](file:///Users/mktsoy/Dev/flowr-app/BRANDING/PREFERENCES.md)
  - Document the block hover background preference.

### 5. Operational Trace
- Modified `BlockRenderer.tsx` using `multi_replace_file_content` to transition row and control hover styles from white opacity values to the theme-aware `var(--bone-2)` and `var(--bone-10)` CSS variables.
- Updated the living branding guide `BRANDING/PREFERENCES.md` to declare `var(--bone-2)` as the standard block hover footprint background token.
- Executed `npm run test` to ensure vitest suites in the `src/` directory compile and pass without regressions.

### 6. Status Assessment
- **Completed**: Block row hover effects are now visible in both light mode and dark mode.
- **Unresolved**: None.
