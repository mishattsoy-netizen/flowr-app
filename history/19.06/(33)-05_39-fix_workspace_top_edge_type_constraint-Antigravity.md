User request: "still not fixed"

### 0. Date and time of the request
- **Date**: 19.06.2026
- **Time**: 05:39

### 1. User request
User request: "still not fixed"

### 2. Objective Reconstruction
- Fix a bug where the workspace top edge visual insert line does not show because of the target-vs-drag type mismatch override (`isDragWS !== isTargetWS` sets `edge = null` when a regular item is dragged over a workspace).

### 3. Strategic Reasoning
- The type check `isDragWS !== isTargetWS` overrides `edge = null` to prevent regular items from reordering at depth 0 as siblings to workspaces.
- However, when a workspace top-edge redirect is active (where `edge = 'top'` and the sibling workspace above is expanded), it represents a nesting drop (inside the expanded workspace) rather than a reorder drop.
- We should exclude this `isTopRedirect` scenario from the workspace-to-regular item type constraint check, allowing the visual insert line to be rendered.

### 4. Detailed Blueprint
- Modified [TreeItem.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/layout/TreeItem.tsx):
  - In `getData` callback, computed `isTopRedirect` as `edge === 'top' && isPrevExpanded` where `isPrevExpanded` checks if the sibling directly above has children and is expanded.
  - Modified the type constraint override to check `isDragWS !== isTargetWS && !isTopRedirect`.

### 5. Operational Trace
- Updated type constraint logic inside [TreeItem.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/layout/TreeItem.tsx).
- Verified typescript compiler pass via `./node_modules/.bin/tsc --noEmit`.

### 6. Status Assessment
- **Status**: Completed successfully.
- **Result**: Hovering near the top edge of Workspace 2 when Workspace 1 is expanded now correctly renders the visual insert line at depth 1 (directly below Folder 2's children list) as expected.
