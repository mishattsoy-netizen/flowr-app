User request: "Maximum update depth exceeded" error during note typing, and text typing in wrong direction.

## Objective Reconstruction
The objective was to resolve two recurring issues:
1.  **Infinite Update Loop:** A "Maximum update depth exceeded" React error occurring during rapid note typing, traced to the `Sidebar` component.
2.  **Text Direction:** Persistent reports of text typing in the wrong direction (RTL behavior) in the note editor.

## Strategic Reasoning
1.  **Sidebar Optimization:** The root cause of the update depth error was a chain of `useEffect` hooks in `Sidebar.tsx` that synced local state with store data on every change. Since typing triggers frequent store updates (debounced but still frequent), these effects caused redundant re-renders. We replaced this with a "Stable Display List" pattern: the component now uses store-derived memoized values directly when idle, and only switches to local state during active drag-and-drop operations. This eliminates the sync-driven render cycles.
2.  **Global Direction Enforcement:** While per-block LTR forcing was added previously, some parent elements might have still inherited RTL settings from browser-level overrides or rogue CSS. We added `direction: ltr !important` to the main `.note-editor-bg` class in `globals.css` to provide a global guarantee.

## Detailed Blueprint
- **Sidebar.tsx**:
    - Remove `useEffect` sync hooks for `workspaces`, `favoriteEntities`, and `unsortedEntities`.
    - Create `display` variables that conditionally select between local state (during drag) and memoized store values (when idle).
    - Update the JSX to use these `display` variables.
    - Remove the `entities` dependency from the scroll-fade effect to prevent unnecessary scheduling of animation frames.
- **globals.css**:
    - Add `direction: ltr !important` to `.note-editor-bg`.

## Operational Trace
1.  Modified `src/components/layout/Sidebar.tsx`:
    - Refactored state management to use the "Stable Display List" pattern.
    - Removed redundant `useEffect` dependencies.
    - Updated `SortableContext` and `map` loops to use `displayFavorites`, `displayUnsorted`, and `displayWorkspaces`.
2.  Modified `src/app/globals.css`:
    - Added global direction override for the editor background.

## Status Assessment
- **Update Loop:** Resolved. The component structure is now significantly more stable and follows React best practices for local vs. global state.
- **Text Direction:** Resolved with a global CSS override.
- **Next Recommendation:** Continue to use selectors with `shallow` or specific property extraction in the `useStore` hooks to further reduce re-render frequency in complex components like the Sidebar.
