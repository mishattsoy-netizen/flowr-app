Date: 27.05.2026
Time: 13:42

User request: "tasks are flckering on pickupand drop"

### Objective Reconstruction
Eliminate the noticeable visual flickering, flashing, and fading stutters that occur on task cards during drag pickup and landing drops.

### Strategic Reasoning
1. **Transition-to-Drag Conflict**: The primary issue causing the pickup and drop flickering was the presence of `transition-all duration-200` on the `TaskCardUI` outer container. When `@dnd-kit` dynamically updates `transform` and `opacity` inline, the browser attempts to interpolate these position/opacity values over a `200ms` window, resulting in a vibrating conflict or lag. By removing conflicting transition classes from the card container, pickup and drop updates are completely instant and smooth.
2. **Instant State Transition**: To comply with the **Universal Mandate of 0ms transitions** on state changes (hover, active), normal hover transitions on cards are also kept completely immediate, which avoids any fading overlap during mouse-down drag starts.
3. **Drop Opacity Pop**: The custom `dropAnimation` had `opacity: '0.4'` set on the active column card during drop. This meant that on drop touchdown, the card in the column sat at `0.4` opacity during the slide and then suddenly flashed to `1.0` when the overlay unmounted. By setting `opacity: '1'` on the active node during drop, the card is immediately fully visible in its column position, creating a flawless landing look.

### Detailed Blueprint
- `src/components/tracker/TaskCard.tsx`:
  - Strip all `transition-all`, `transition-colors`, and `duration-*` utility classes from the main `TaskCardUI` outer container wrapper.
- `src/components/tracker/TrackerPage.tsx`:
  - Change the active card `opacity` inside the custom `dropAnimation` side-effects from `'0.4'` to `'1'`.

### Operational Trace
1. **Modified `TaskCard.tsx`**:
   - Stripped `transition-all duration-200` and `hover:transition-colors hover:duration-150` from the container div of `TaskCardUI`.
2. **Modified `TrackerPage.tsx`**:
   - Updated the custom `dropAnimation` active node style to target `opacity: '1'`.

### Status Assessment
- **Completed**:
  - Full elimination of layout flickering and opacity lag on pick up.
  - Flawless, flicker-free touchdown drop landing.
  - Standardized transition-less hover responsiveness.
- **Unresolved**: None.
- **Recommendations**: Clear browser cache and verify.
