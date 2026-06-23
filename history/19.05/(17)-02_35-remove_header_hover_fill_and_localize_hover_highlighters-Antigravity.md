User request: "remove header fill on hover and change header text color and collapse icon from 30 to 100 only when i hove one pf them, not whole container"

## 0. Date and time of the request
Date: 19.05 (May 19, 2026)
Time: 02:35

## 1. User request
"remove header fill on hover and change header text color and collapse icon from 30 to 100 only when i hove one pf them, not whole container"

## 2. Objective Reconstruction
- Remove the gray background fill on hover (`hover:bg-[var(--bone-6)]`) from the sidebar section headers.
- Change the header text and collapse chevron colors from `bone-30` to `bone-100` only when the user hovers over the text/chevron sub-group itself (not the entire row container).

## 3. Strategic Reasoning
- **Premium Minimalism**: Eliminating the background hover fill on these top-level categories keeps the interface extremely light and clean.
- **Micro-focused Highlights**: Introducing localized triggers (`group/header-label`) on the label-and-chevron sub-flex containers ensures that highlighting to `bone-100` only happens when the cursor is directly on top of the text/chevron itself, rather than when hovering anywhere within the empty container boundaries.

## 4. Detailed Blueprint
- `src/components/layout/Sidebar.tsx`:
  - Remove `hover:bg-[var(--bone-6)]` and `hover:text-[var(--bone-100)]` from the header row elements.
  - Wrap the label spans and `ChevronDown` icons inside `<div className="flex items-center gap-1 group/header-label">`.
  - Override label span classes to use `text-[var(--bone-30)] group-hover/header-label:text-[var(--bone-100)] transition-colors duration-75`.
  - Override `ChevronDown` text classes to use `text-[var(--bone-30)] group-hover/header-label:text-[var(--bone-100)]`.

## 5. Operational Trace
- Edited `src/components/layout/Sidebar.tsx`:
  - Removed `hover:bg-[var(--bone-6)]` background fills and `hover:text-[var(--bone-100)]` text highlights from the three headers (Pinned, Unsorted, Workspaces).
  - Wrapped header labels and collapse arrows in a localized flex container with `group/header-label`.
  - Assigned explicit `text-[var(--bone-30)] group-hover/header-label:text-[var(--bone-100)]` to the inner spans and chevrons.

## 6. Status Assessment
- **Completed**: Header hover background fill removed, and localized hover highlight configured for labels and collapse icons.
