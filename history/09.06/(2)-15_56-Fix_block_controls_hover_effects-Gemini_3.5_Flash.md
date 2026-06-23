User request: "fix plus and drag button hover effect isnt always triggered on hover, also in light mode these buttons font have hover fill effect"

### 0. Date and time of the request
Date: 09.06.2026
Time: 15:56

### 1. User request
User request: "fix plus and drag button hover effect isnt always triggered on hover, also in light mode these buttons font have hover fill effect"

### 2. Objective Reconstruction
The objective is to fix two visual/UX bugs in the block controls (the hover action buttons for adding and dragging blocks in the editor):
1. The hover effect (fade-in of the plus/drag handle wrapper) was not always triggering reliably when the mouse moved over the left margin space.
2. In light mode, the plus and drag handle buttons did not have a visible background fill change when hovered.

### 3. Strategic Reasoning
- **Hover Trigger Reliability**: The hover action buttons reside in a container that appears when the parent block is hovered. To make this work seamlessly when the mouse moves left of the text content, the parent block uses a `before` pseudo-element that creates a hover detection zone to the left of the block.
  - However, standard text blocks and checklist items have a small vertical height. If the mouse moved slightly above or below the line height, the hover was lost because the `before` zone was restricted to the block's exact `top-0 bottom-0` boundaries.
  - Adding a small vertical padding/offset (`top-[-4px] bottom-[-4px]`) to the pseudo-element expands the hover zone slightly, making it much more robust.
  - Additionally, `columns` and `column` blocks were missing the Tailwind `group` class, which meant `group-hover:` on their child controls could never be triggered. Adding `group` resolves this.
- **Light Mode Hover Fill Effect**: The hover background was hardcoded to `hover:bg-white/10`, which renders as an invisible white overlay on the white light-mode background. Changing this to `hover:bg-[var(--bone-10)]` and the text color on hover to `hover:text-[var(--bone-100)]` ensures theme-aware, high-contrast hover fill states across both light and dark modes.

### 4. Detailed Blueprint
- **Modify** [BlockRenderer.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/editor/BlockRenderer.tsx):
  - In all block wrapper elements, change the `before` pseudo-element classes from `before:top-0 before:bottom-0` to `before:top-[-4px] before:bottom-[-4px]` to widen the vertical hover boundary.
  - Add the `group` class to `columns` and `column` blocks so that their inner `BlockControls` can detect hover states.
  - Update `markerBtnClass` to use the theme-aware `hover:bg-[var(--bone-10)]` background and `hover:text-[var(--bone-100)]` text color on hover.

### 5. Operational Trace
1. Investigated [BlockRenderer.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/editor/BlockRenderer.tsx) to locate the `BlockControls` layout and hover styles.
2. Identified that standard hover buttons used `hover:bg-white/10` which was invisible on white backgrounds in light mode.
3. Identified that the vertical hover trigger boundary was too tight and that `columns`/`column` blocks lacked the `group` styling necessary to trigger parent hover states.
4. Used `multi_replace_file_content` to apply all the structural class changes across the 11 instances of block renderers and button styles.
5. Ran vitest unit tests to ensure no regressions were introduced.

### 6. Status Assessment
- **Completed**: The vertical hover triggers have been broadened, missing group classes added to columns, and the hover background states made theme-aware.
- **Verified**: Unit tests pass successfully. The changes immediately apply via hot-reloading.
