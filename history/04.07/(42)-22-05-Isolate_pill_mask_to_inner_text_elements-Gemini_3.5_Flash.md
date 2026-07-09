### 0. Date and time of the request
Date: 04.07.2026
Time: 22:05 (Start) - 22:05 (End)

### 1. User request
User request: "bg of pill is dimmed aswel not just text fix it"

### 2. Objective Reconstruction
- Isolate the transparent overflow fade mask in task card pills so that it applies ONLY to the text label.
- Keep the background capsule shape (the gray background and borders of the pill) fully solid, opaque, and unmasked when text overflows.

### 3. Strategic Reasoning
- Because the `mask-image` class (`text-fade`) was previously attached to the outer `span` container (which holds the pill background), the mask faded out the background capsule along with the text.
- Re-structured the layout by moving the `text-fade` and `truncate` classes to a new nested inner `span` container containing the text label, keeping the outer capsule's background completely unaffected.

### 4. Detailed Blueprint
- `src/components/tracker/TaskCard.tsx`: Wrap tag text and workspace name text inside an inner `span className="text-fade truncate max-w-full leading-none"` and remove the `text-fade` class from the parent container.

### 5. Operational Trace
- Replaced the HTML markup template inside `TaskCard.tsx`.
- Verified TypeScript compilation.

### 6. Status Assessment
Completed successfully. Pill backgrounds remain fully opaque and intact when overflowing, with the fade mask gracefully applied strictly to the text label on the right side.
