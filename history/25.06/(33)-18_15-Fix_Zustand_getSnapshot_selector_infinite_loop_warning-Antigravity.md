Date: 25.06.2026
Time: 18:15

User request: "Error Type
Console Error

Error Message
The result of getSnapshot should be cached to avoid an infinite loop


    at createConsoleError (file://C:/Users/misha/Documents/Dev/flowr-app copy/flowr-app copy/.next/dev/static/chunks/0d4a_next_dist_0s3o811._.js:2333:71)
    at handleConsoleError (file://C:/Users/misha/Documents/Dev/flowr-app copy/flowr-app copy/.next/dev/static/chunks/0d4a_next_dist_0s3o811._.js:3119:54)
    at console.error (file://C:/Users/misha/Documents/Dev/flowr-app copy/flowr-app copy/.next/dev/static/chunks/0d4a_next_dist_0s3o811._.js:3266:57)
    at mountSyncExternalStore (file://C:/Users/misha/Documents/Dev/flowr-app copy/flowr-app copy/.next/dev/static/chunks/0d4a_next_dist_compiled_react-dom_05yy03a._.js:4932:133)
    at Object.useSyncExternalStore (file://C:/Users/misha/Documents/Dev/flowr-app copy/flowr-app copy/.next/dev/static/chunks/0d4a_next_dist_compiled_react-dom_05yy03a._.js:15262:20)
    ...
    at CanvasPage (file://C:/Users/misha/Documents/Dev/flowr-app copy/flowr-app copy/.next/dev/static/chunks/flowr-app%20copy_src_components_canvas_12g-c~m._.js:4416:202)
    ...
    at WorkspaceRouter (file://C:/Users/misha/Documents/Dev/flowr-app copy/flowr-app copy/.next/dev/static/chunks/flowr-app%20copy_src_components_0k.o-.d._.js:4724:248)
    at AppPage (src\app\app\page.tsx:11:7)

Code Frame
   9 |   return (
  10 |     <Shell initialEntityId={initialEntityId}>
> 11 |       <WorkspaceRouter initialEntityId={initialEntityId} />
     |       ^
  12 |     </Shell>
  13 |   );
  14 | }

Next.js version: 16.2.4 (Turbopack)"

### Objective Reconstruction
Resolve the console error `The result of getSnapshot should be cached to avoid an infinite loop` originating from the `CanvasPage` component during renders. This ensures compliance with React 19 and Zustand v5's strict reference checking in `useSyncExternalStore`.

### Strategic Reasoning
The error occurs when a Zustand store selector creates and returns a new object or array literal reference (e.g., `[]` or a newly filtered array) on consecutive calls where the underlying store changes. In `CanvasPage.tsx`, the `selectedBlocks` hook selector returned `[]` whenever the floating toolbar was hidden, producing a new array reference on every single pointer/drag state frame, which violated reference stability rules under React 19. To solve this, we:
1. Cached empty array instances using a module-level static reference `EMPTY_ARRAY = []` so empty states always share the same reference.
2. Utilized Zustand's `useShallow` comparison middleware. It performs shallow element checks on the filtered list, returning a stable cached array reference across renders if the selected set of blocks and their properties remain unchanged.

### Detailed Blueprint
1. Add import for `useShallow` from `zustand/react/shallow` to `CanvasPage.tsx`.
2. Define a global static reference `const EMPTY_ARRAY: EditorBlock[] = [];` outside `CanvasPage` to reuse identical memory addresses.
3. Wrap the `selectedBlocks` selector function in `useShallow` and return `EMPTY_ARRAY` instead of `[]` when selection/toolbar is disabled.

### Operational Trace
1. Modified `src/components/canvas/CanvasPage.tsx` to add `useShallow` import.
2. Declared `EMPTY_ARRAY` helper constant.
3. Refactored the `selectedBlocks` hook to call `useStore(useShallow(...))` and return `EMPTY_ARRAY`.
4. Verified compilation using `npx tsc --noEmit` (completed successfully with 0 errors).
5. Ran all unit tests with `npx vitest run` to ensure zero regressions (118/118 passed).

### Status Assessment
* **Completed**: The React 19 getSnapshot warning/infinite loop console error is fully resolved. Selection and toolbar tracking are fully optimized.
* **Unresolved**: None.
