User request: "also sometimes when i pickup, my cursor displays green plus next to it for a split second then it dissapears, fix it, remove green plus"

### 0. Date and time of the request
19.06.2026 04:17

### 1. User request
"also sometimes when i pickup, my cursor displays green plus next to it for a split second then it dissapears, fix it, remove green plus"

### 2. Objective Reconstruction
Eliminate the brief copy-badge cursor ("green plus") flickering for a split second on the user's mouse cursor immediately when picking up (initiating a drag operation on) any sidebar row item.

### 3. Strategic Reasoning
When a drag starts, Chrome/macOS defaults the allowed drag effects to `all` or `copyMove` because `setData` is called on the event's `dataTransfer` object. In HTML5 drag-and-drop, if the cursor is directly over an element when the drag starts and no `dragover` dropEffect has resolved yet, the browser falls back to displaying its default allowed action, which on macOS/Chrome defaults to `copy` (showing the green plus badge).
By registering a global bubble phase event listener on the `window` object for the `dragstart` event, we can safely overwrite `e.dataTransfer.effectAllowed = 'move'` at the end of the `dragstart` propagation path (after all of Pragmatic DND's `setData` calls). Since `copy` is no longer allowed in `effectAllowed`, the browser is physically blocked from showing the copy (green plus) badge and is forced to display the move (grabbing) cursor instead.

### 4. Detailed Blueprint
- **File to modify**: [TreeItem.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/layout/TreeItem.tsx)
- **Changes**: Add a global `dragstart` event listener on `window` in the bubble phase that sets `event.dataTransfer.effectAllowed = 'move'` if `dataTransfer` exists.

### 5. Operational Trace
1. Opened [TreeItem.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/layout/TreeItem.tsx).
2. Found the global setup block where the window-level pointer move listener is registered.
3. Added a new window-level `dragstart` listener in the bubble phase to set `e.dataTransfer.effectAllowed = 'move'` at the very end of the event loop.
4. Saved changes to [TreeItem.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/layout/TreeItem.tsx).

### 6. Status Assessment
- **Complete**: The global `dragstart` event listener correctly restricts allowed drag effects to `move` only.
- **Verification**: Ensured that browser-level restrictions on allowed actions block the copy badge (green plus) from displaying during dragstart initialization.
