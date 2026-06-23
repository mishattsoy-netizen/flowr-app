User request: "in left sidebar, instaert line and folder effects must be neutral colors not accent and no glow effects, keep it minimalistic(no folder border just fill) and mono"

# Date and Time of the Request
May 26, 2026 at 00:44

# Objective Reconstruction
Refactor the drag-and-drop indicator visual effects in the left sidebar to be purely neutral, mono, and minimalistic. Specifically:
- Make the horizontal insert indicator line a neutral/mono bone color, removing the accent color.
- Redesign the folder "drop inside" hover target so it does not have accent colors, glow shadows, borders, or pulsing animations. It must use a simple neutral bone background fill with a mono icon color.

# Strategic Reasoning
- The visual cues during drag-and-drop should align with a high-end, minimalistic, and non-distracting user interface.
- Removing bright accent colors, glowing rings, and animations reduces visual friction during user actions.
- Replaced the colored borders and shadows with a clean 12% opacity neutral mono background fill (`var(--bone-12)`) and flat white/bone icon text color (`var(--bone-100)`).
- Replaced the accent insert line with a standard mid-opacity bone divider color (`var(--bone-30)`), which matches existing dividers and hierarchy guide lines.

# Detailed Blueprint
1. **Insert Line**:
   - In `TreeItem.tsx`, update the horizontal insert line `div` styles.
   - Replace `bg-accent` with `bg-[var(--bone-30)]`.
2. **Folder Hover Fill**:
   - In `globals.css`, update `.is-dragging .sidebar-item-row.sidebar-folder-drop-target` and its hover state.
   - Replace background color mix with clean `var(--bone-12)`.
   - Remove `box-shadow` borders and glows (`box-shadow: none !important`).
   - Remove keyframes pulse animation (`animation: none !important`).
   - For `.is-dragging .sidebar-item-row.sidebar-folder-drop-target svg`, replace `var(--accent)` color with `var(--bone-100)`.

# Operational Trace
- Edited [TreeItem.tsx](file:///Users/mktsoy/Dev/flowr-4-main/src/components/layout/TreeItem.tsx):
  - Line 326: Changed `bg-accent` to `bg-[var(--bone-30)]`.
- Edited [globals.css](file:///Users/mktsoy/Dev/flowr-4-main/src/app/globals.css):
  - Changed `.sidebar-folder-drop-target` background-color to `var(--bone-12) !important`.
  - Set `box-shadow: none !important` and `animation: none !important`.
  - Set `svg` color to `var(--bone-100) !important`.
  - Deleted keyframe animation block `@keyframes sidebar-folder-drop-pulse` to keep css stylesheet clean.

# Status Assessment
- Insert indicator line and folder target effects successfully updated.
- All drag effects are now beautifully minimalistic, mono, and fit perfectly within the premium aesthetic of the application without any accent gradients or glows.
