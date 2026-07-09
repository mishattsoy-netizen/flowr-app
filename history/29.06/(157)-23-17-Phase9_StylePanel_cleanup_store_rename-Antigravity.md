User request: "phase 9"

### 0. Date and time
Date: 29.06.2026
Time: 23:17

### 1. User request
User request: "phase 9" — executed Phase 9 from the user's workflow (which corresponds to Phase 8 and Phase 10 in the `PLANS/frame-group-autolayout.md` plan: Style Panel validation, unused cleanups, and store renaming/migration).

### 2. Objective Reconstruction
Complete the Frame & Group implementation by:
1. Validating that the Style Panel (`CanvasStylePanel.tsx`) is fully wired up with all auto layout components (alignment picker, flow direction picker, resize dropdown, padding control) and selection analysis checks.
2. Cleaning up unused `moveCanvasSection` assignment in `CanvasBlock.tsx`.
3. Renaming `moveCanvasSection` to `moveCanvasFrame` in `store.types.ts` and `store.ts` for clean structural architecture while adding a deprecated `moveCanvasSection` alias for backwards-compatibility.
4. Verifying type safety via `tsc`.

### 3. Strategic Reasoning
Since the layout components in the Style Panel were already prepared, we verified their integration and then cleaned up legacy `section` remnants in the store and components. Aliasing `moveCanvasSection` to `moveCanvasFrame` keeps compatibility with any older layers/actions while offering a clean `frame` structure moving forward.

### 4. Detailed Blueprint
Modified:
- `CanvasBlock.tsx` — removed unused `moveCanvasSection` variable from store retrieval.
- `store.types.ts` — declared `moveCanvasFrame` and marked `moveCanvasSection` as deprecated.
- `store.ts` — renamed implementation to `moveCanvasFrame` and added `moveCanvasSection` pointing to it.

### 5. Operational Trace
- Inspected `CanvasStylePanel.tsx` helper components and layout sections.
- Removed unused `const moveCanvasSection = useStore(s => s.moveCanvasSection)` inside `CanvasBlock.tsx`.
- Changed types in `store.types.ts` to expose `moveCanvasFrame` and deprecated `moveCanvasSection`.
- Changed methods in `store.ts` to implement `moveCanvasFrame` and delegate `moveCanvasSection` to it.
- Executed `npx tsc --noEmit` to verify type safety.

### 6. Status Assessment
- Completed: Style Panel validated, unused cleanups done, actions renamed, type safety confirmed.
- All phases of the Figma-like Frame and Group ecosystem are now fully implemented and integrated.
