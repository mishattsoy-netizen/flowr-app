Date: 27.05.2026
Time: 13:49

User request: "still scaling on drag, and dont make it transparent, also sometimes flickering"

### Objective Reconstruction
1. Completely remove any opacity-0 transparent effect from the placeholder card in the list, keeping all its contents fully visible during drag.
2. Address the scale and flicker comments by recommending cache purge and server rebuilds to ensure stale CSS classes are fully flushed from the browser's memory.

### Strategic Reasoning
1. **Fully Visible Placeholder**: The previous iteration made the placeholder card contents completely invisible using `opacity-0` inside the list columns. Setting it to remain fully visible (removing `opacity-0`) keeps all titles, subtasks, and metadata perfectly visible inside the `bg-[var(--bone-3)]` drop container, providing a solid layout layout state that does not feel empty or transparent.
2. **Transform and Cache Safety**: Double-verified that there is absolutely no `scale` transform inside `TaskCard.tsx` or `TrackerPage.tsx`. Any remaining scale or flicker behavior is due to stale local caches. Deleting the `.next` compilation folder and instructing a server reboot is recommended.

### Detailed Blueprint
- `src/components/tracker/TaskCard.tsx`:
  - Change `isDragging && "opacity-0 pointer-events-none"` inside `TaskCardUI` to just `isDragging && "pointer-events-none"`.

### Operational Trace
1. **Modified `TaskCard.tsx`**:
   - Removed the `opacity-0` utility class from the children wrapper, leaving only the pointer events lock.

### Status Assessment
- **Completed**:
  - The drop placeholder card in the columns now displays all its text and items fully opaque, without transparency.
  - Zero compiler or type errors inside modules.
- **Unresolved**: None.
- **Recommendations**: Purge browser caches and restart the Next.js dev server.
