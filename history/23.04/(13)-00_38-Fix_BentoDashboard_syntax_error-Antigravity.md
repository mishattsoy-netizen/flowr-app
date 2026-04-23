User request: "Build Error: Expected ',', got '}' in BentoDashboard.tsx"

### Objective Reconstruction
Resolve a build-breaking syntax error in `BentoDashboard.tsx`. This was a regression introduced during the drag logic optimization where a function declaration was accidentally deleted, leading to unbalanced braces.

### Strategic Reasoning
The fix involves restoring the `onPointerMove` function wrapper inside the `useEffect` hook and ensuring all nested blocks are properly closed.

### Detailed Blueprint
1.  **BentoDashboard.tsx**:
    *   Restored `const onPointerMove = (e: PointerEvent) => {`
    *   Wrapped the relative coordinate logic back inside this function.
    *   Verified the `gridRef.current` check and closing braces.

### Operational Trace
- Repaired the `useEffect` structure in `BentoDashboard.tsx`.

### Status Assessment
The project should now compile successfully, with all recent drag-and-drop improvements intact.
