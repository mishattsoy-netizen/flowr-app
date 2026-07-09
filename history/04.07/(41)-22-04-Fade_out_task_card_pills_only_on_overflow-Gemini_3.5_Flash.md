### 0. Date and time of the request
Date: 04.07.2026
Time: 22:04 (Start) - 22:04 (End)

### 1. User request
User request: "fix fadfe out effect in pills, its always presents, but it must be only apllied to TEXT/TITLE if it doesn fit in max width pill"

### 2. Objective Reconstruction
- Apply the fade-out transparent gradient mask effect to task card pills (workspace name, tag) ONLY when their text overflows their maximum width limits (`max-w-[80px]` and `max-w-[90px]`).
- Prevent the right edge of short text from fading out when it fits perfectly.

### 3. Strategic Reasoning
- The codebase already contains a global `FadeTextObserver` component at the app root, which watches for `.text-fade` classes and sets `data-overflow="true"` via a ResizeObserver check when text overflows.
- Replaced the hardcoded inline mask-image CSS styles in `TaskCard.tsx` with the `.text-fade` utility class, leveraging this existing framework.

### 4. Detailed Blueprint
- `src/components/tracker/TaskCard.tsx`:
  - Swap out inline mask-image class names with `text-fade` class.

### 5. Operational Trace
- Replaced inline CSS classes inside `TaskCard.tsx`.
- Verified TypeScript compilation.

### 6. Status Assessment
Completed successfully. Custom tag and workspace pills on the task card now render fully opaque text when it fits, fading out gracefully at the right edge only if it overflows the maximum width limit.
