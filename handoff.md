# Handoff for Fable 5: Finish Split Headers

## Current State & Problem Description
The split view headers (`ColumnHeader.tsx`) are currently broken in layout and styling compared to the main `HeaderBar.tsx`. 

Based on the latest user feedback and screenshots, here is exactly what the user is seeing and requesting to be fixed:

1. **Vertical Alignment is Broken (Buttons Shifted Up)**
   - The left-side controls (More Vertical, Pencil), the active tab text ("Home"), the new "+" button, and the right-side controls (Pin, Swap, Close Split) are not vertically aligned. 
   - The controls and buttons appear shifted *upwards* relative to the tab itself, making the header look completely misaligned.

2. **Missing Bottom Borders**
   - The horizontal segmented bottom border (the `color-mix` line) only exists inside the `Spacer` div. Because the `Spacer` sits *before* the right-side controls, the line completely stops early, leaving the right side of the header (under the buttons) with no bottom border at all.
   - In the "Empty Column" state (when no tab is open in a split column), there is absolutely no bottom border rendered at all.

3. **Plus Button Sizing and Spacing (Pending Request)**
   - The user previously requested that the new "+" button (New Entity) in the single-column mode must be the exact same size as it is in the split headers.
   - It must also have the exact same gap to the tab as the left buttons do.

## Next Agent Instructions
1. **Fix Vertical Alignment (`ColumnHeader.tsx`)**
   - Inspect the flex containers inside `ColumnHeader.tsx`. Ensure that the `items-center` alignment is perfectly matching the tab text's visual baseline. 
   - Note that tabs might have specific top/bottom padding or absolute positioning that is misaligning them from standard flex items.

2. **Fix Missing Horizontal Borders (`ColumnHeader.tsx`)**
   - Refactor how the bottom horizontal border is rendered in `ColumnHeader.tsx`. Instead of attaching it to the `Spacer`, it should probably be a single absolute full-width line at the bottom of the entire `ColumnHeader` container, and then properly masked out *only* where the active tab sits (similar to how `HeaderBar.tsx` might handle its continuous borders).
   - Ensure the empty column state *also* renders the continuous bottom border.

3. **Standardize the Plus Button**
   - Ensure the "+" button shares the exact same CSS classes, dimensions (`w-7 h-7` or similar), and spacing (`gap` or `ml`) across both `HeaderBar.tsx` and `ColumnHeader.tsx`.
   - Match the spacing to the left buttons as requested.

4. **Flawless Tab Corners at All Zooms**
   - Ensure the concave corner borders perfectly connect with the tab borders (no sub-pixel gaps, detachments, or double lines) in *both* `HeaderBar.tsx` and `ColumnHeader.tsx`.
   - This must be thoroughly tested across all Chrome zoom levels (from 67% up to 250%+).
   - Use identical `color-mix` values for the straight vertical tab borders and the corner borders so that a 1px structural overlap mathematically bridges any fractional gaps without creating dark overlapping artifacts.

5. **Column Header Side Paddings**
   - Keep in mind the original side paddings for the ColumnHeader container: `paddingLeft: (entityId === 'dashboard' || entityId === 'tracker') ? 16 : 8, paddingRight: 12`.
   - Ensure these paddings are preserved when refactoring the flex alignment.

Please completely resolve the `ColumnHeader.tsx` layout to be visually identical to the polished `HeaderBar.tsx` design.
