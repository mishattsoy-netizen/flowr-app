User request: "make avatar a bit smaller"

### 0. Date and time of the request
May 29, 2026 at 01:52

### 1. User request
The user requested to scale down the profile avatar element displayed in the sidebar's footer section.

### 2. Objective Reconstruction
The objective was to adjust the dimensional bounding scale of the user profile avatar and its nested text initial inside `Sidebar.tsx` to present a more balanced, clean, and premium visual ratio inside the footer profile component.

### 3. Strategic Reasoning
1. **Visual Balance**: The profile avatar's original size of `40px` (`w-10 h-10`) felt slightly bulky next to the settings button and text labels in the uncollapsed view. Scaling it down to `32px` (`w-8 h-8`) creates a much cleaner visual balance and alignment inside the footer container.
2. **Text Proportion**: Correctly scaled the text fallback initials from `text-[13px]` to `text-[11px]` to preserve accurate typography proportions inside the newly sized `32px` circle.
3. **Padded Hover Area**: Kept the collapsed view settings button at `w-10 h-10` while using the centered `w-8 h-8` avatar inside it. This provides a very clean, premium hovered padding footprint around the avatar when in the collapsed sidebar state.

### 4. Detailed Blueprint
- **`Sidebar.tsx`**: Update the avatar image layout container from `w-10 h-10` to `w-8 h-8` and scale the initials text size down to `text-[11px]`.

### 5. Operational Trace
1. **Modified [Sidebar.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/layout/Sidebar.tsx)**:
   - Modified the avatar container's class to `"w-8 h-8"`.
   - Scaled down the initials text class to `"text-[11px]"`.
2. **Typechecked**:
   - Compiles clean with zero typescript errors.

### 6. Status Assessment
- **Completed**: Profile avatar size successfully scaled down to `w-8 h-8` in the sidebar footer, achieving a highly balanced, premium aesthetic.
- **Active state**: Typecheck clean.
