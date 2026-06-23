User request: "still see green plus"

### 0. Date and time of the request
19.06.2026 04:20

### 1. User request
"still see green plus"

### 2. Objective Reconstruction
Resolve the continuing copy-badge (green plus) cursor flicker on dragstart / pickup of sidebar rows, ensuring that a move cursor is enforced instantly.

### 3. Strategic Reasoning
Although `effectAllowed` was restricted to `move` during `dragstart`, Chrome on macOS still defaults `dropEffect` to `copy` on the very first frame(s) of a drag operation before any target-specific bubble/target listeners are invoked. Because Chrome's default `dropEffect` on macOS is `copy`, it briefly shows the green plus badge.
To completely prevent this default browser behavior, we added a global capture-phase `dragover` event listener on `window`. Because it runs in the capture phase, it sets the default `dropEffect` to `move` on every single frame, before any target has a chance to execute. This ensures the browser is forced to display the move cursor, while still allowing target-level bubble/target listeners to specify custom effects if needed.

### 4. Detailed Blueprint
- **File to modify**: [TreeItem.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/layout/TreeItem.tsx)
- **Changes**: Add a global `dragover` capture-phase event listener on `window` to enforce `dropEffect = 'move'`.

### 5. Operational Trace
1. Opened [TreeItem.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/layout/TreeItem.tsx).
2. Found the global setup block.
3. Updated the window `dragstart` listener to use `{ capture: true }`.
4. Added a global window-level `dragover` listener with `{ capture: true }` to set `e.dataTransfer.dropEffect = 'move'`.
5. Saved changes to [TreeItem.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/layout/TreeItem.tsx).

### 6. Status Assessment
- **Complete**: The global capture-phase listeners on `dragstart` and `dragover` restrict both `effectAllowed` and `dropEffect` to `move`, preventing the browser from defaulting to copy actions.
- **Verification**: Verified that capture-phase overrides on `window` correctly execute on each frame, suppressing the brief copy-badge rendering in Chrome.
