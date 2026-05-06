User request: "fix text typing in wrong direciton in notes also wehn i hold any key to stream type in note it gives thiserro: Maximum update depth exceeded."

## Objective Reconstruction
The objective was to resolve two critical editor issues:
1.  **Text Direction:** Text in the `NoteEditor` and `BlockRenderer` was occasionally typing in the incorrect direction (RTL behavior).
2.  **Runtime Error:** A "Maximum update depth exceeded" error occurred during rapid typing (stream typing), caused by a state update loop in the `Sidebar` component.

## Strategic Reasoning
1.  **Direction Fix:** To eliminate any possibility of inherited RTL behavior, we explicitly forced `direction: ltr` and `dir="ltr"` at both the content container and individual block levels. This ensures that even if the browser or parent components have RTL settings, the editor remains consistently LTR.
2.  **Loop Fix:** The `Sidebar` component had a `useEffect` that called `setIsMounted(true)` whenever `entities` changed. During rapid typing, `entities` updates frequently (even with debouncing), causing `setIsMounted` to trigger redundant re-renders. Combined with other state synchronizations (`setWorkspaces`, etc.), this led to React's update limit being exceeded. We isolated the mount logic to a single-run effect and stabilized the scroll fade updates.

## Detailed Blueprint
- **Sidebar.tsx**:
    - Refactor `useEffect` hooks to separate mount logic from data-driven updates.
    - Remove `entities` as a dependency for the initial mounting state.
- **BlockRenderer.tsx**:
    - Force `direction: ltr` and `dir="ltr"` on the `contentEditable` div.
- **NoteEditor.tsx**:
    - Add `direction: ltr` to the main `editor-content-container` as a defensive measure.

## Operational Trace
1.  Modified `src/components/layout/Sidebar.tsx`:
    - Moved `setIsMounted(true)` to a `useEffect` with an empty dependency array `[]`.
    - Created a secondary `useEffect` for scroll fade updates that respects the `isMounted` state but doesn't trigger state updates itself.
2.  Modified `src/components/editor/BlockRenderer.tsx`:
    - Added `dir="ltr"` and `direction: 'ltr'` to the primary block rendering div.
3.  Modified `src/components/editor/NoteEditor.tsx`:
    - Added `dir="ltr"` and `style={{ direction: 'ltr' }}` to the main editor container div.

## Status Assessment
- **Text Direction:** Fixed. All editor blocks are now strictly LTR.
- **Update Loop:** Fixed. The `Sidebar` no longer attempts to re-mount or trigger redundant state updates during rapid store changes.
- **Next Recommendation:** Monitor for any legitimate RTL requirements in the future; if needed, we should implement a per-note direction toggle rather than relying on browser auto-detection which has proven unstable here.
