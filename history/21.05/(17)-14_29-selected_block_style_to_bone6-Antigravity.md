User request: "change this selected block effect to same as hover but bone6"

### 0. Date and time of the request
- **Date**: May 21, 2026
- **Time**: 14:29

### 1. User request
"change this selected block effect to same as hover but bone6"

### 2. Objective Reconstruction
The goal was to modify the visual style of editor blocks in their selected state. Specifically:
- Make the selected block container highlight look exactly like its hover state (same border radius, margins, paddings, bounds).
- Replace the previous background color and active border/shadow with a solid background matching `var(--bone-6)`.
- Completely eliminate any surrounding box-shadows or borders (`box-shadow: none`) so that the visual effect is a clean, flat solid background.

### 3. Strategic Reasoning
- The hover highlight and the selected highlight target the same internal layout wrapper components (`.flex-1.flex.items-start` and `.relative.w-full`) within editor blocks.
- To perfectly match the hover layout state, we updated the existing `.selected-block` targets in `globals.css` to use `background-color: var(--bone-6)` and `box-shadow: none`. This naturally maintains all layout traits (paddings, radii) of the containers while switching colors cleanly.
- To ensure full consistency and prevent visual artifacts, we also surgically replaced inline tailwind selection background styles (`bg-white/[0.01]`) with `bg-[var(--bone-6)]` across all individual block components in `BlockRenderer.tsx` (Dividers, Databases, Tables, Image/Video, Embeds, Columns, and Lists).

### 4. Detailed Blueprint
1. **Modify custom styles in globals.css**:
   - Locate `.selected-block .flex-1.flex.items-start` and `.selected-block .relative.w-full`.
   - Update `background-color` from `var(--bone-5)` to `var(--bone-6)`.
   - Remove `box-shadow` border/outline (`box-shadow: none`).
2. **Update selection backgrounds in BlockRenderer.tsx**:
   - Search for occurrences where `isSelected` assigns a custom background.
   - Replace utility background class `bg-white/[0.01]` with `bg-[var(--bone-6)]` for Divider, Database, Table, Image/Video, Embed, Column, and List/Checklist blocks.
3. **Verify and test**:
   - Execute a TypeScript compile check `npx tsc --noEmit` to verify type safety and syntactical correctness.

### 5. Operational Trace
- **File Edited**: [globals.css](file:///Users/mktsoy/Dev/flowr-4-main/src/app/globals.css) (Lines 1097-1101)
  - Replaced:
    ```css
    .selected-block .flex-1.flex.items-start,
    .selected-block .relative.w-full {
      background-color: var(--bone-5);
      box-shadow: 0 0 0 1px var(--bone-15);
    }
    ```
    With:
    ```css
    .selected-block .flex-1.flex.items-start,
    .selected-block .relative.w-full {
      background-color: var(--bone-6);
      box-shadow: none;
    }
    ```
- **File Edited**: [BlockRenderer.tsx](file:///Users/mktsoy/Dev/flowr-4-main/src/components/editor/BlockRenderer.tsx) (Various Lines)
  - Replaced selection `bg-white/[0.01]` highlight with `bg-[var(--bone-6)]` in 7 places corresponding to standard Divider, Database, Table, Image/Video, Embed, Column, and List/Checklist blocks.
- **Verification Command Executed**:
  - Ran `npx tsc --noEmit` in `/Users/mktsoy/Dev/flowr-4-main` which completed successfully with zero compiler errors.

### 6. Status Assessment
- **Completed**: The selection styling changes have been successfully implemented across all block types.
- **Outcome**: When a block is selected, its highlight box now has a solid `var(--bone-6)` background with exactly the same boundaries and smooth curves as its hover state, without any surrounding outline borders or shadow artifacts.
