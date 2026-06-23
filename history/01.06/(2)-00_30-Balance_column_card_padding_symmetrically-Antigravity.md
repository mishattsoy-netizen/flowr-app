Date and time: 01.06.2026, 00:30

User request: "fix right padding in the collumn is nigger then left"

### Objective Reconstruction
Fix the visual asymmetry inside Kanban columns where the right-side gap between the task cards and the column border was larger than the left-side gap.

### Strategic Reasoning
- **Asymmetry Source**: The `OverlayScrollbar` scroller element originally had `pr-2` (padding-right: 8px) on its `scrollClassName` to avoid scrollbar thumb overlap. Combined with the column container's default padding `p-4` (16px), this resulted in a left padding of 16px and a right padding of 24px (16px + 8px), causing cards to look off-center.
- **Resolution**: Since the overlay scrollbar thumb track is absolute-positioned outside the scroller boundary (using a wide `20px` transparent container offset to `right-[-10px]`), the thumb floats harmlessly inside the column's native `16px` right padding area and does not visually overlap the task cards even if `pr-2` is removed. Removed the `pr-2` class to restore perfect 16px horizontal symmetry.

### Detailed Blueprint
- Update `/src/components/tracker/KanbanColumn.tsx`:
  - Change `scrollClassName="flex flex-col pr-2"` on `OverlayScrollbar` to `scrollClassName="flex flex-col"`.

### Operational Trace
- Swapped padding classes in `/src/components/tracker/KanbanColumn.tsx` using `replace_file_content`.

### Status Assessment
- Horizontal card alignment inside columns is now perfectly balanced and symmetrical.
- Custom scrollbar continues to hover correctly without overlapping card interactive elements.
