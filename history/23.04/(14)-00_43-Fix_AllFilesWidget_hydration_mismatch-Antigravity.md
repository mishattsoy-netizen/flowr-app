User request: "Hydration mismatch error in AllFilesWidget.tsx"

### Objective Reconstruction
Resolve a React hydration mismatch error appearing in the `AllFilesWidget`. The mismatch occurred because `@dnd-kit` generates dynamic ARIA attributes (like `aria-describedby`) that were differing between the server-rendered HTML and the client-rendered properties.

### Strategic Reasoning
Hydration mismatches in Next.js are common when using libraries that rely on client-side global counters or window-specific logic (like DnD kits). The standard solution is to defer the rendering of the dynamic content until after the component has mounted on the client (`useEffect`). This ensures the client and server start with a consistent baseline and only initialize complex interactive states once the browser environment is fully available.

### Detailed Blueprint
1.  **AllFilesWidget.tsx**:
    *   Introduced an `isMounted` state variable initialized to `false`.
    *   Set `isMounted` to `true` inside a `useEffect` hook.
    *   Wrapped the `DndContext` and `SortableContext` in a conditional block that only renders them if `isMounted` is true.
    *   Provided a "Skeleton" (static list) fallback for the server-side render to prevent layout shifts while maintaining visual continuity during hydration.

### Operational Trace
- Implemented client-side mount detection.
- Refactored widget content to handle async hydration of DnD features.

### Status Assessment
The console warning should be resolved, and the widget will now hydrate safely without attribute mismatches.
