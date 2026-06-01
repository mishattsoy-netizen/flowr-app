User request: "pills should be without fill when idle, just stroke and text+icon and on hover fill with dark and remove stroke. also they mustnt be round and make them smaller so they fit in one row'"

### 0. Date and time of the request
01.06.2026, 18:04

### 1. User request
User request: "pills should be without fill when idle, just stroke and text+icon and on hover fill with dark and remove stroke. also they mustnt be round and make them smaller so they fit in one row'"

### 2. Objective Reconstruction
Refine the styling, border-radius, scaling, and interactive hover transitions of the 5 quick access pills beneath the centered new-chat message input:
1. **Idle State**: Hollow styling with transparent backgrounds (`bg-transparent`) and a subtle outline stroke (`border-[var(--bone-10)]`).
2. **Hover State**: Fill the background with a soft dark color (`hover:bg-[var(--bone-6)]`) and hide the stroke (`hover:border-transparent`) without causing shifting/reflow bugs.
3. **Border-Radius**: Replace circular layouts (`rounded-full`) with the standard square-ish theme corners (`rounded-[var(--radius-medium)]`).
4. **Dimensions**: Reduce button padding and text size (`px-2.5 py-1 text-[11px] font-medium w-3 h-3 icons`) to fit all 5 pills within a single unified row.

### 3. Strategic Reasoning
Reducing padding and text size increases horizontal space, enabling all 5 buttons to rest in one row across standard screens and avoiding wrapping. Aligning corners to `rounded-[var(--radius-medium)]` standardizes them with other system cards. Applying `hover:border-transparent` during fill keeps the layout size consistent, preventing ugly jumping/jittering when borders are removed.

### 4. Detailed Blueprint
- **[ChatConversation.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/chat/ChatConversation.tsx)**:
  - Shrink Lucide icons in `QUICK_ACCESS_PILLS` to `w-3 h-3 shrink-0`.
  - Update the map loop button classes to feature `px-2.5 py-1`, `rounded-[var(--radius-medium)]`, `bg-transparent border border-[var(--bone-10)]`, and `hover:bg-[var(--bone-6)] hover:border-transparent`.

### 5. Operational Trace
- Adjusted icon dimensions inside the `QUICK_ACCESS_PILLS` array in `ChatConversation.tsx`.
- Updated suggestion buttons CSS classes to align with hollow idle states, square-ish corners, smaller font/spacing parameters, and filled borderless hovers.

### 6. Status Assessment
- Successfully corrected. The pills now present a sleek, uniform, border-only horizontal layout that fits in one row.
